const FollowUp = require('../../database/models/FollowUp');
const User = require('../../database/models/User');
const Customer = require('../../database/models/Customer');
const hubspotService = require('../../services/hubspotService');

// @desc    Get all follow-ups
// @route   GET /api/admin/follow-ups
// @access  Private/Admin
const getFollowUps = async (req, res) => {
  try {
    const { salesman, status, type, priority, search, startDate, endDate, source } = req.query;
    const filter = {};

    if (salesman) {
      filter.salesman = salesman;
    }
    if (status && status !== 'All') {
      filter.status = status;
    }
    if (type && type !== 'All') {
      filter.type = type;
    }
    if (priority && priority !== 'All') {
      filter.priority = priority;
    }
    if (search) {
      filter.$or = [
        { followUpNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate || endDate) {
      filter.dueDate = {};
      if (startDate) {
        filter.dueDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.dueDate.$lte = new Date(endDate);
      }
    }

    // Filter imported HubSpot tasks only
    if (source === 'hubspot') {
      filter.hubspotTaskId = { $exists: true, $ne: '' };
    }

    // Filter by approval status if needed
    if (req.query.approvalStatus) {
      filter.approvalStatus = req.query.approvalStatus;
      
      // If filtering for Pending approval, only show tasks created by salesman (not admin)
      // Admin tasks are auto-approved, so they shouldn't appear in Pending tab
      if (req.query.approvalStatus === 'Pending') {
        // Get all salesman users
        const salesmanUsers = await User.find({ role: 'salesman' }).select('_id');
        const salesmanIds = salesmanUsers.map(u => u._id);
        
        // Only show tasks created by salesman (not admin)
        if (salesmanIds.length > 0) {
          filter.createdBy = { $in: salesmanIds };
        } else {
          // If no salesmen exist, return empty result
          filter.createdBy = { $in: [] };
        }
      }
    }

    const followUps = await FollowUp.find(filter)
      .populate('salesman', 'name email')
      .populate('customer', 'name email phone company associatedContactName associatedContactEmail associatedCompanyName lastContact lastEngagement')
      .populate('relatedQuotation', 'quotationNumber total')
      .populate('relatedSample', 'sampleNumber productName')
      .populate('visitTarget', 'name address')
      .populate('approvedBy', 'name email')
      .populate('createdBy', 'name email role')
      .sort({ dueDate: 1, priority: -1 });

    res.status(200).json({
      success: true,
      count: followUps.length,
      data: followUps,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching follow-ups',
    });
  }
};

// @desc    Get single follow-up
// @route   GET /api/admin/follow-ups/:id
// @access  Private/Admin
const getFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id)
      .populate('salesman', 'name email phone')
      .populate('customer', 'name email phone address company city state associatedContactName associatedContactEmail associatedCompanyName lastContact lastEngagement')
      .populate('relatedQuotation', 'quotationNumber total status')
      .populate('relatedSample', 'sampleNumber productName status')
      .populate('visitTarget', 'name address city')
      .populate('approvedBy', 'name email')
      .populate('createdBy', 'name email role');

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found',
      });
    }

    res.status(200).json({
      success: true,
      data: followUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching follow-up',
    });
  }
};

// @desc    Create follow-up
// @route   POST /api/admin/follow-ups
// @access  Private/Admin
const createFollowUp = async (req, res) => {
  try {
    const {
      salesman,
      customer,
      customerName,
      customerEmail,
      customerPhone,
      associatedContactName,
      associatedContactEmail,
      associatedCompanyName,
      associatedCompanyDomain,
      type,
      priority,
      scheduledDate,
      dueDate,
      description,
      notes,
      relatedQuotation,
      relatedSample,
      relatedOrder,
      visitTarget,
    } = req.body;

    if (!salesman || !customerName || !type || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    const followUp = await FollowUp.create({
      salesman,
      customer,
      customerName,
      customerEmail,
      customerPhone,
      // Associated Contact (HubSpot-style)
      associatedContactName: associatedContactName || undefined,
      associatedContactEmail: associatedContactEmail || undefined,
      // Associated Company (HubSpot-style)
      associatedCompanyName: associatedCompanyName || undefined,
      associatedCompanyDomain: associatedCompanyDomain || undefined,
      type,
      priority: priority || 'Medium',
      scheduledDate: scheduledDate || dueDate,
      dueDate,
      description,
      notes,
      relatedQuotation,
      relatedSample,
      relatedOrder,
      visitTarget,
      createdBy: req.user._id,
      approvalStatus: 'Approved', // Admin created tasks are auto-approved
      source: 'app', // Mark admin-created tasks as 'app' source (not 'hubspot')
    });

    // 🔁 HUBSPOT SYNC (NON-BLOCKING): create task in HubSpot when follow-up is created
    (async () => {
      try {
        const subject = description || `Follow-up: ${customerName}`;
        const body = notes || '';

        // Map local priority to HubSpot priority values
        let hsPriority = 'NONE';
        const pr = (priority || followUp.priority || '').toLowerCase();
        if (pr === 'urgent' || pr === 'high') hsPriority = 'HIGH';
        else if (pr === 'medium') hsPriority = 'MEDIUM';
        else if (pr === 'low') hsPriority = 'LOW';

        // Get customer email for contact association
        const populatedCustomer = await FollowUp.findById(followUp._id).populate('customer', 'email');
        const customerEmail = followUp.customerEmail || (populatedCustomer.customer && populatedCustomer.customer.email) || '';

        const hubspotTaskId = await hubspotService.createTaskObjectInHubSpot({
          subject,
          body,
          status: 'NOT_STARTED',
          priority: hsPriority,
          type: 'TODO',
          dueDate: followUp.dueDate,
          contactEmail: customerEmail,
        });

        if (hubspotTaskId) {
          followUp.hubspotTaskId = hubspotTaskId;
          await followUp.save();
          console.log(`✅ Task ${followUp.followUpNumber} synced to HubSpot: ${hubspotTaskId}`);
        } else {
          console.warn(`⚠️ Task ${followUp.followUpNumber} failed to sync to HubSpot - will need manual push`);
        }
      } catch (e) {
        console.error(`❌ HubSpot follow-up task sync error for ${followUp.followUpNumber}:`, e.message);
      }
    })();

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email phone company associatedContactName associatedContactEmail associatedCompanyName lastContact lastEngagement')
      .populate('relatedQuotation', 'quotationNumber total')
      .populate('relatedSample', 'sampleNumber productName');

    res.status(201).json({
      success: true,
      message: 'Follow-up created successfully',
      data: populatedFollowUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating follow-up',
    });
  }
};

// @desc    Update follow-up
// @route   PUT /api/admin/follow-ups/:id
// @access  Private/Admin
const updateFollowUp = async (req, res) => {
  try {
    const {
      status,
      type,
      priority,
      scheduledDate,
      dueDate,
      description,
      notes,
      completedDate,
      startedAt,
      meterPicture,
      meterReading,
    } = req.body;

    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found',
      });
    }

    if (status) {
      followUp.status = status;
      if (status === 'Completed' && !followUp.completedDate) {
        followUp.completedDate = completedDate || new Date();
      }
    }
    if (type) followUp.type = type;
    if (priority) followUp.priority = priority;
    if (scheduledDate) followUp.scheduledDate = scheduledDate;
    if (dueDate) followUp.dueDate = dueDate;
    if (description !== undefined) followUp.description = description;
    if (notes !== undefined) followUp.notes = notes;
    if (startedAt !== undefined) followUp.startedAt = startedAt ? new Date(startedAt) : null;
    if (meterPicture !== undefined) followUp.meterPicture = meterPicture;
    if (meterReading !== undefined) followUp.meterReading = meterReading;

    await followUp.save();

    // Sync to HubSpot if task has hubspotTaskId (imported from HubSpot or already pushed)
    if (followUp.hubspotTaskId && followUp.hubspotTaskId !== '' && followUp.hubspotTaskId !== null) {
      try {
        // Update task status in HubSpot when completed
        if (status === 'Completed') {
          await hubspotService.updateTaskObjectInHubSpot(followUp.hubspotTaskId, {
            subject: followUp.description || `Follow-up: ${followUp.customerName}`,
            body: followUp.notes || '',
            status: 'COMPLETED', // HubSpot status for completed tasks
            priority: followUp.priority || 'NONE',
            type: followUp.hs_task_type || followUp.type || 'TODO',
            dueDate: followUp.dueDate,
          });
          console.log(`✅ Task ${followUp.followUpNumber} marked as completed in HubSpot`);
        } else {
          // Update other status changes
          await hubspotService.updateTaskObjectInHubSpot(followUp.hubspotTaskId, {
            subject: followUp.description || `Follow-up: ${followUp.customerName}`,
            body: followUp.notes || '',
            status: 'NOT_STARTED',
            priority: followUp.priority || 'NONE',
            type: followUp.hs_task_type || followUp.type || 'TODO',
            dueDate: followUp.dueDate,
          });
        }
      } catch (e) {
        console.error('Error syncing task update to HubSpot:', e);
        // Don't fail the request if HubSpot sync fails
      }
    }

    // Sync activities (notes with Email/Call/Meeting) to HubSpot if task is linked
    if (notes && followUp.hubspotTaskId && followUp.hubspotTaskId !== '' && followUp.hubspotTaskId !== null) {
      try {
        // Extract latest activity from notes
        const notesLines = notes.split('\n').filter(line => line.trim());
        if (notesLines.length > 0) {
          const latestNote = notesLines[notesLines.length - 1];
          
          // Check if it's an activity (Email, Call, Meeting, Note)
          if (latestNote.includes('Email:') || latestNote.includes('Call:') || latestNote.includes('Meeting:') || latestNote.includes('Note:')) {
            // Get customer email to find HubSpot contact
            const customerEmail = followUp.customerEmail || 
                                 (followUp.customer && typeof followUp.customer === 'object' ? followUp.customer.email : '') ||
                                 followUp.associatedContactEmail;
            
            if (customerEmail) {
              // Find HubSpot contact ID
              const contactId = await hubspotService.findContactByEmail(customerEmail);
              
              if (contactId) {
                // Determine activity type
                let activityType = 'NOTE';
                if (latestNote.includes('Email:')) activityType = 'EMAIL';
                else if (latestNote.includes('Call:')) activityType = 'CALL';
                else if (latestNote.includes('Meeting:')) activityType = 'MEETING';
                
                // Create timeline event in HubSpot
                if (activityType === 'EMAIL' || activityType === 'CALL') {
                  await hubspotService.createTimelineEvent(
                    contactId,
                    activityType,
                    latestNote.includes('Email:') ? 'Email Sent' : 'Call Made',
                    latestNote,
                    {}
                  );
                  console.log(`✅ ${activityType} activity synced to HubSpot for contact: ${contactId}`);
                } else if (activityType === 'NOTE') {
                  await hubspotService.createNote(contactId, latestNote, 'GENERAL');
                  console.log(`✅ Note synced to HubSpot for contact: ${contactId}`);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error syncing activity to HubSpot:', e);
        // Don't fail the request if HubSpot sync fails
      }
    }

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email phone company associatedContactName associatedContactEmail associatedCompanyName lastContact lastEngagement')
      .populate('relatedQuotation', 'quotationNumber total')
      .populate('relatedSample', 'sampleNumber productName');

    res.status(200).json({
      success: true,
      message: 'Follow-up updated successfully',
      data: populatedFollowUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating follow-up',
    });
  }
};

// @desc    Delete follow-up
// @route   DELETE /api/admin/follow-ups/:id
// @access  Private/Admin
const deleteFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found',
      });
    }

    await FollowUp.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Follow-up deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting follow-up',
    });
  }
};

// @desc    Approve follow-up (salesman created task)
// @route   PUT /api/admin/follow-ups/:id/approve
// @access  Private/Admin
const approveFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found',
      });
    }

    if (followUp.approvalStatus === 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Follow-up is already approved',
      });
    }

    followUp.approvalStatus = 'Approved';
    followUp.approvedBy = req.user._id;
    followUp.approvedAt = new Date();
    await followUp.save();

    // 🔁 HUBSPOT SYNC (NON-BLOCKING): create task in HubSpot when approved
    (async () => {
      try {
        const subject = followUp.description || `Follow-up: ${followUp.customerName}`;
        const body = followUp.notes || '';

        // Map local priority to HubSpot priority values
        let hsPriority = 'NONE';
        const pr = (followUp.priority || '').toLowerCase();
        if (pr === 'urgent' || pr === 'high') hsPriority = 'HIGH';
        else if (pr === 'medium') hsPriority = 'MEDIUM';
        else if (pr === 'low') hsPriority = 'LOW';

        // Get customer email for contact association
        const populatedFollowUpForEmail = await FollowUp.findById(followUp._id).populate('customer', 'email');
        const customerEmail = populatedFollowUpForEmail.customerEmail || (populatedFollowUpForEmail.customer && populatedFollowUpForEmail.customer.email) || '';

        const hubspotTaskId = await hubspotService.createTaskObjectInHubSpot({
          subject,
          body,
          status: 'NOT_STARTED',
          priority: hsPriority,
          type: 'TODO',
          dueDate: followUp.dueDate,
          contactEmail: customerEmail,
        });

        if (hubspotTaskId) {
          followUp.hubspotTaskId = hubspotTaskId;
          await followUp.save();
          console.log(`✅ Salesman task ${followUp.followUpNumber} approved and synced to HubSpot: ${hubspotTaskId}`);
        } else {
          console.warn(`⚠️ Salesman task ${followUp.followUpNumber} approved but HubSpot sync failed - manual push needed`);
        }
      } catch (e) {
        console.error(`❌ HubSpot follow-up task sync error for ${followUp.followUpNumber}:`, e.message);
      }
    })();

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email phone company associatedContactName associatedContactEmail associatedCompanyName lastContact lastEngagement')
      .populate('approvedBy', 'name email')
      .populate('createdBy', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Follow-up approved successfully. Task will be posted to HubSpot.',
      data: populatedFollowUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error approving follow-up',
    });
  }
};

// @desc    Push task to HubSpot manually
// @route   PUT /api/admin/follow-ups/:id/push-to-hubspot
// @access  Private/Admin
const pushToHubSpot = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found',
      });
    }

    // Check if task is admin-created (source: 'app') or HubSpot-imported (source: 'hubspot')
    const isAdminCreated = followUp.source === 'app' || (!followUp.source && followUp.createdBy?.role === 'admin');
    const isHubSpotImported = followUp.source === 'hubspot';
    
    // For admin-created tasks: allow re-push even if hubspotTaskId exists (will update existing task)
    // For HubSpot-imported tasks: prevent duplicate push if task exists
    if (followUp.hubspotTaskId && isHubSpotImported) {
      try {
        const hubspotService = require('../../services/hubspotService');
        const axios = require('axios');
        const config = require('../../config');
        const hubspotOAuthService = require('../../services/hubspotOAuthService');
        
        let token = '';
        if (config.HUBSPOT_AUTH_MODE === 'oauth') {
          token = await hubspotOAuthService.getValidAccessToken();
        } else {
          token = config.HUBSPOT_TOKEN || config.HUBSPOT_ACCESS_TOKEN || config.HUBSPOT_API_KEY;
        }
        
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };
        
        // Try to fetch the task from HubSpot to verify it exists
        try {
          const taskRes = await axios.get(
            `https://api.hubapi.com/crm/v3/objects/tasks/${followUp.hubspotTaskId}`,
            { headers, timeout: 5000 }
          );
          
          // Task exists in HubSpot, prevent duplicate push for imported tasks
          if (taskRes.data && taskRes.data.id) {
            return res.status(400).json({
              success: false,
              message: 'Task is already synced to HubSpot. Cannot push again to prevent duplicates.',
              data: { hubspotTaskId: followUp.hubspotTaskId },
            });
          }
        } catch (verifyError) {
          // Task doesn't exist in HubSpot (404 or other error), allow push
          if (verifyError.response?.status === 404) {
            console.log(`⚠️ Task ${followUp.followUpNumber} has hubspotTaskId ${followUp.hubspotTaskId} but task doesn't exist in HubSpot. Allowing push.`);
            // Clear the invalid hubspotTaskId so we can push
            followUp.hubspotTaskId = null;
            await followUp.save();
          } else {
            // Other error - still allow push (safer)
            console.warn(`⚠️ Could not verify HubSpot task ${followUp.hubspotTaskId}: ${verifyError.message}. Allowing push.`);
            followUp.hubspotTaskId = null;
            await followUp.save();
          }
        }
      } catch (e) {
        // Error verifying - allow push (safer approach)
        console.warn(`⚠️ Error verifying HubSpot task: ${e.message}. Allowing push.`);
        followUp.hubspotTaskId = null;
        await followUp.save();
      }
    }

    // Check if task is approved (only approved tasks can be synced)
    if (followUp.approvalStatus !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Task must be approved before syncing to HubSpot',
      });
    }

    const subject = followUp.description || `Follow-up: ${followUp.customerName}`;
    const body = followUp.notes || '';

    // Map local priority to HubSpot priority values
    let hsPriority = 'NONE';
    const pr = (followUp.priority || '').toLowerCase();
    if (pr === 'urgent' || pr === 'high') hsPriority = 'HIGH';
    else if (pr === 'medium') hsPriority = 'MEDIUM';
    else if (pr === 'low') hsPriority = 'LOW';

    let hubspotTaskId = followUp.hubspotTaskId;
    
    // Get task type from followUp (will be mapped to HubSpot format in hubspotService)
    const taskType = followUp.hs_task_type || followUp.type || 'TODO';
    
    // If task already exists in HubSpot (admin-created task with hubspotTaskId), update it
    if (hubspotTaskId && isAdminCreated) {
      const updated = await hubspotService.updateTaskObjectInHubSpot(hubspotTaskId, {
        subject,
        body,
        status: 'NOT_STARTED',
        priority: hsPriority,
        type: taskType, // Use actual task type (will be mapped to HubSpot format)
        dueDate: followUp.dueDate,
      });
      
      if (updated) {
        console.log(`✅ Task ${followUp.followUpNumber} updated in HubSpot: ${hubspotTaskId}`);
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to update task in HubSpot. Please check HubSpot configuration.',
        });
      }
    } else {
      // Create new task in HubSpot
      hubspotTaskId = await hubspotService.createTaskObjectInHubSpot({
        subject,
        body,
        status: 'NOT_STARTED',
        priority: hsPriority,
        type: taskType, // Use actual task type (will be mapped to HubSpot format)
        dueDate: followUp.dueDate,
      });

      if (!hubspotTaskId) {
        return res.status(500).json({
          success: false,
          message: 'Failed to sync task to HubSpot. Please check HubSpot configuration.',
        });
      }

      // Update hubspotTaskId if not already set
      if (!followUp.hubspotTaskId) {
        followUp.hubspotTaskId = hubspotTaskId;
        await followUp.save();
        console.log(`✅ Task ${followUp.followUpNumber} pushed to HubSpot: ${hubspotTaskId}`);
      }
    }

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email phone company associatedContactName associatedContactEmail associatedCompanyName lastContact lastEngagement');

    res.status(200).json({
      success: true,
      message: 'Task successfully synced to HubSpot',
      data: populatedFollowUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error syncing task to HubSpot',
    });
  }
};

// @desc    Reject follow-up (salesman created task)
// @route   PUT /api/admin/follow-ups/:id/reject
// @access  Private/Admin
const rejectFollowUp = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: 'Follow-up not found',
      });
    }

    if (followUp.approvalStatus === 'Rejected') {
      return res.status(400).json({
        success: false,
        message: 'Follow-up is already rejected',
      });
    }

    followUp.approvalStatus = 'Rejected';
    followUp.approvedBy = req.user._id;
    followUp.approvedAt = new Date();
    if (rejectionReason) {
      followUp.rejectionReason = rejectionReason;
    }
    await followUp.save();

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email phone company associatedContactName associatedContactEmail associatedCompanyName lastContact lastEngagement')
      .populate('approvedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Follow-up rejected successfully',
      data: populatedFollowUp,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting follow-up',
    });
  }
};

// @desc    Get follow-up statistics
// @route   GET /api/admin/follow-ups/stats
// @access  Private/Admin
const getFollowUpStats = async (req, res) => {
  try {
    const totalFollowUps = await FollowUp.countDocuments();
    const overdueFollowUps = await FollowUp.countDocuments({ status: 'Overdue' });
    const todayFollowUps = await FollowUp.countDocuments({ status: 'Today' });
    const upcomingFollowUps = await FollowUp.countDocuments({ status: 'Upcoming' });
    const completedFollowUps = await FollowUp.countDocuments({ status: 'Completed' });
    const pendingApproval = await FollowUp.countDocuments({ approvalStatus: 'Pending' });

    res.status(200).json({
      success: true,
      data: {
        total: totalFollowUps,
        overdue: overdueFollowUps,
        today: todayFollowUps,
        upcoming: upcomingFollowUps,
        completed: completedFollowUps,
        pendingApproval,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching follow-up statistics',
    });
  }
};

module.exports = {
  getFollowUps,
  getFollowUp,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  approveFollowUp,
  rejectFollowUp,
  pushToHubSpot,
  getFollowUpStats,
};
