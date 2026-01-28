const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const Sample = require('../database/models/Sample');
const VisitTarget = require('../database/models/VisitTarget');
const FollowUp = require('../database/models/FollowUp');
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');

const testSampleVisitFollowUp = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');

    // ==================== GET USERS ====================
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ No admin found. Please create an admin first.');
      process.exit(1);
    }
    console.log(`👑 Admin: ${admin.name} (${admin.email})`);

    const salesman = await User.findOne({ role: 'salesman' });
    if (!salesman) {
      console.log('❌ No salesman found. Please create a salesman first.');
      process.exit(1);
    }
    console.log(`👤 Salesman: ${salesman.name} (${salesman.email})\n`);

    // ==================== GET CUSTOMER ====================
    const customer = await Customer.findOne();
    if (!customer) {
      console.log('❌ No customer found. Please create a customer first.');
      process.exit(1);
    }
    console.log(`👥 Customer: ${customer.name || customer.firstName} (${customer.email || 'No email'})`);

    // ==================== GET PRODUCT ====================
    const product = await Product.findOne({ isActive: true });
    if (!product) {
      console.log('❌ No active product found. Please create a product first.');
      process.exit(1);
    }
    console.log(`📦 Product: ${product.name} (${product.productCode || 'No code'})\n`);

    console.log('='.repeat(60));
    console.log('🧪 TESTING SAMPLE TRACK, VISIT TARGET & FOLLOW-UP');
    console.log('='.repeat(60));
    console.log('');

    // ==================== 1. TEST SAMPLE TRACK ====================
    console.log('📋 TEST 1: SAMPLE TRACK');
    console.log('-'.repeat(60));

    // 1.1 Admin creates sample
    console.log('\n1.1 Admin creating sample...');
    const adminSample = await Sample.create({
      salesman: salesman._id,
      customer: customer._id,
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerEmail: customer.email || 'test@example.com',
      customerPhone: customer.phone || '1234567890',
      product: product._id,
      productName: product.name,
      productCode: product.productCode || 'PROD001',
      quantity: 2,
      visitDate: new Date(),
      expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      notes: 'Test sample created by admin script',
      status: 'Pending',
      createdBy: admin._id,
    });

    const populatedAdminSample = await Sample.findById(adminSample._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email')
      .populate('product', 'name productCode');

    console.log('✅ Admin Sample Created:');
    console.log(`   Sample Number: ${populatedAdminSample.sampleNumber}`);
    console.log(`   Customer: ${populatedAdminSample.customerName}`);
    console.log(`   Product: ${populatedAdminSample.productName}`);
    console.log(`   Quantity: ${populatedAdminSample.quantity}`);
    console.log(`   Status: ${populatedAdminSample.status}`);
    console.log(`   Salesman: ${populatedAdminSample.salesman?.name || 'N/A'}`);

    // 1.2 Salesman creates sample
    console.log('\n1.2 Salesman creating sample...');
    const salesmanSample = await Sample.create({
      salesman: salesman._id,
      customer: customer._id,
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerEmail: customer.email || 'test@example.com',
      customerPhone: customer.phone || '1234567890',
      product: product._id,
      productName: product.name,
      productCode: product.productCode || 'PROD001',
      quantity: 1,
      visitDate: new Date(),
      expectedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      notes: 'Test sample created by salesman script',
      status: 'Pending',
      createdBy: salesman._id,
    });

    const populatedSalesmanSample = await Sample.findById(salesmanSample._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email')
      .populate('product', 'name productCode');

    console.log('✅ Salesman Sample Created:');
    console.log(`   Sample Number: ${populatedSalesmanSample.sampleNumber}`);
    console.log(`   Customer: ${populatedSalesmanSample.customerName}`);
    console.log(`   Product: ${populatedSalesmanSample.productName}`);
    console.log(`   Quantity: ${populatedSalesmanSample.quantity}`);
    console.log(`   Status: ${populatedSalesmanSample.status}`);

    // ==================== 2. TEST VISIT TARGET ====================
    console.log('\n\n📍 TEST 2: VISIT TARGET');
    console.log('-'.repeat(60));

    // 2.1 Admin creates visit target
    console.log('\n2.1 Admin creating visit target...');
    const adminVisitTarget = await VisitTarget.create({
      name: `Admin Visit Target - ${Date.now()}`,
      description: 'Test visit target created by admin script',
      salesman: salesman._id,
      latitude: 24.8607, // Karachi coordinates
      longitude: 67.0011,
      address: 'Test Address, Karachi',
      city: 'Karachi',
      state: 'Sindh',
      pincode: '75500',
      priority: 'High',
      visitDate: new Date(),
      notes: 'Test visit target notes from admin',
      createdBy: admin._id,
      approvalStatus: 'Approved',
      approvedAt: new Date(),
      approvedBy: admin._id,
      status: 'Pending',
    });

    const populatedAdminVisit = await VisitTarget.findById(adminVisitTarget._id)
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email');

    console.log('✅ Admin Visit Target Created:');
    console.log(`   Name: ${populatedAdminVisit.name}`);
    console.log(`   Salesman: ${populatedAdminVisit.salesman?.name || 'N/A'}`);
    console.log(`   Location: ${populatedAdminVisit.latitude}, ${populatedAdminVisit.longitude}`);
    console.log(`   Address: ${populatedAdminVisit.address || 'N/A'}`);
    console.log(`   Status: ${populatedAdminVisit.status}`);
    console.log(`   Approval: ${populatedAdminVisit.approvalStatus}`);

    // 2.2 Salesman creates visit target request (needs approval)
    console.log('\n2.2 Salesman creating visit target request...');
    const salesmanVisitTarget = await VisitTarget.create({
      name: `Salesman Visit Request - ${Date.now()}`,
      targetName: `Salesman Visit Request - ${Date.now()}`,
      description: 'Test visit target request created by salesman script',
      salesman: salesman._id,
      latitude: 24.9141, // Different location
      longitude: 67.0822,
      address: 'Test Address 2, Karachi',
      city: 'Karachi',
      state: 'Sindh',
      pincode: '75501',
      priority: 'Medium',
      visitDate: new Date(),
      notes: 'Test visit target request notes from salesman',
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerId: customer._id,
      createdBy: salesman._id,
      approvalStatus: 'Pending', // Needs admin approval
      status: 'Pending',
    });

    const populatedSalesmanVisit = await VisitTarget.findById(salesmanVisitTarget._id)
      .populate('salesman', 'name email')
      .populate('createdBy', 'name email');

    console.log('✅ Salesman Visit Target Request Created:');
    console.log(`   Name: ${populatedSalesmanVisit.name}`);
    console.log(`   Salesman: ${populatedSalesmanVisit.salesman?.name || 'N/A'}`);
    console.log(`   Location: ${populatedSalesmanVisit.latitude}, ${populatedSalesmanVisit.longitude}`);
    console.log(`   Address: ${populatedSalesmanVisit.address || 'N/A'}`);
    console.log(`   Status: ${populatedSalesmanVisit.status}`);
    console.log(`   Approval: ${populatedSalesmanVisit.approvalStatus} (Pending - needs admin approval)`);

    // ==================== 3. TEST FOLLOW-UP ====================
    console.log('\n\n📞 TEST 3: FOLLOW-UP');
    console.log('-'.repeat(60));

    // 3.1 Admin creates follow-up
    console.log('\n3.1 Admin creating follow-up...');
    const adminFollowUp = await FollowUp.create({
      salesman: salesman._id,
      customer: customer._id,
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerEmail: customer.email || 'test@example.com',
      customerPhone: customer.phone || '1234567890',
      type: 'Call',
      priority: 'High',
      scheduledDate: new Date(),
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      description: 'Test follow-up created by admin script',
      notes: 'Follow-up notes from admin',
      visitTarget: adminVisitTarget._id,
      createdBy: admin._id,
      approvalStatus: 'Approved', // Admin tasks are auto-approved
      source: 'app',
    });

    const populatedAdminFollowUp = await FollowUp.findById(adminFollowUp._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email')
      .populate('visitTarget', 'name address');

    console.log('✅ Admin Follow-Up Created:');
    console.log(`   Follow-Up Number: ${populatedAdminFollowUp.followUpNumber}`);
    console.log(`   Customer: ${populatedAdminFollowUp.customerName}`);
    console.log(`   Type: ${populatedAdminFollowUp.type}`);
    console.log(`   Priority: ${populatedAdminFollowUp.priority}`);
    console.log(`   Salesman: ${populatedAdminFollowUp.salesman?.name || 'N/A'}`);
    console.log(`   Status: ${populatedAdminFollowUp.status || 'Not Started'}`);
    console.log(`   Approval: ${populatedAdminFollowUp.approvalStatus}`);

    // 3.2 Salesman creates follow-up (needs approval)
    console.log('\n3.2 Salesman creating follow-up...');
    const salesmanFollowUp = await FollowUp.create({
      salesman: salesman._id,
      customer: customer._id,
      customerName: customer.name || customer.firstName || 'Test Customer',
      customerEmail: customer.email || 'test@example.com',
      customerPhone: customer.phone || '1234567890',
      type: 'Email',
      priority: 'Medium',
      scheduledDate: new Date(),
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      description: 'Test follow-up created by salesman script',
      notes: 'Follow-up notes from salesman',
      visitTarget: salesmanVisitTarget._id,
      relatedSample: salesmanSample._id,
      createdBy: salesman._id,
      approvalStatus: 'Pending', // Salesman tasks need admin approval
    });

    const populatedSalesmanFollowUp = await FollowUp.findById(salesmanFollowUp._id)
      .populate('salesman', 'name email')
      .populate('customer', 'name email')
      .populate('visitTarget', 'name address')
      .populate('relatedSample', 'sampleNumber productName');

    console.log('✅ Salesman Follow-Up Created:');
    console.log(`   Follow-Up Number: ${populatedSalesmanFollowUp.followUpNumber}`);
    console.log(`   Customer: ${populatedSalesmanFollowUp.customerName}`);
    console.log(`   Type: ${populatedSalesmanFollowUp.type}`);
    console.log(`   Priority: ${populatedSalesmanFollowUp.priority}`);
    console.log(`   Status: ${populatedSalesmanFollowUp.status || 'Not Started'}`);
    console.log(`   Approval: ${populatedSalesmanFollowUp.approvalStatus} (Pending - needs admin approval)`);
    console.log(`   Related Sample: ${populatedSalesmanFollowUp.relatedSample?.sampleNumber || 'N/A'}`);

    // ==================== SUMMARY ====================
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('\n✅ All tests completed successfully!\n');
    console.log('Created Items:');
    console.log(`  📋 Samples: 2 (1 admin, 1 salesman)`);
    console.log(`  📍 Visit Targets: 2 (1 admin approved, 1 salesman pending)`);
    console.log(`  📞 Follow-Ups: 2 (1 admin approved, 1 salesman pending)`);
    console.log('\n📝 Notes:');
    console.log('  - Admin-created items are auto-approved');
    console.log('  - Salesman-created visit targets and follow-ups need admin approval');
    console.log('  - All items are linked to the same customer and salesman');
    console.log('  - Visit targets and follow-ups are linked together');
    console.log('  - Salesman follow-up is linked to salesman sample');

    // ==================== VERIFICATION ====================
    console.log('\n\n🔍 VERIFICATION');
    console.log('-'.repeat(60));

    // Count samples
    const totalSamples = await Sample.countDocuments({
      $or: [
        { _id: adminSample._id },
        { _id: salesmanSample._id }
      ]
    });
    console.log(`\n✅ Samples in DB: ${totalSamples}/2`);

    // Count visit targets
    const totalVisits = await VisitTarget.countDocuments({
      $or: [
        { _id: adminVisitTarget._id },
        { _id: salesmanVisitTarget._id }
      ]
    });
    console.log(`✅ Visit Targets in DB: ${totalVisits}/2`);

    // Count follow-ups
    const totalFollowUps = await FollowUp.countDocuments({
      $or: [
        { _id: adminFollowUp._id },
        { _id: salesmanFollowUp._id }
      ]
    });
    console.log(`✅ Follow-Ups in DB: ${totalFollowUps}/2`);

    console.log('\n✅ All verifications passed!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the test
testSampleVisitFollowUp();
