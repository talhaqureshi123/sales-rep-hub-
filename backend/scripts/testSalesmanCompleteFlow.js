/**
 * Complete Salesman Test Script
 * Tests: Visits, Sales Tracking, Quotations, Uploads, Kilometer Tracking
 * Usage: node backend/scripts/testSalesmanCompleteFlow.js
 * 
 * This script tests:
 * 1. Create visits for today in Karachi
 * 2. Start/End kilometer tracking for each visit
 * 3. Create quotations
 * 4. Create sales submissions (uploads)
 * 5. Test all features together
 */

const mongoose = require('mongoose');
const connectDB = require('../database/connection');
const VisitTarget = require('../database/models/VisitTarget');
const Tracking = require('../database/models/Tracking');
const Quotation = require('../database/models/Quotation');
// SalesSubmission removed - using SalesOrder instead
const User = require('../database/models/User');
const Customer = require('../database/models/Customer');
const Product = require('../database/models/Product');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message, error = null) {
  log(`❌ ${message}`, 'red');
  if (error) {
    log(`   Error: ${error.message}`, 'red');
    if (error.stack) {
      log(`   Stack: ${error.stack.split('\n')[1]}`, 'red');
    }
  }
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logStep(message) {
  log(`\n${'='.repeat(70)}`, 'blue');
  log(`📋 ${message}`, 'magenta');
  log('='.repeat(70), 'blue');
}

// Karachi locations for visits
const karachiLocations = [
  {
    name: 'Clifton Office Visit',
    address: 'Block 9, Clifton, Karachi',
    city: 'Karachi',
    state: 'Sindh',
    pincode: '75600',
    latitude: 24.8138,
    longitude: 67.0720,
    priority: 'High',
    description: 'Clifton area office visit for sales presentation'
  },
  {
    name: 'DHA Branch Visit',
    address: 'DHA Phase 5, Karachi',
    city: 'Karachi',
    state: 'Sindh',
    pincode: '75500',
    latitude: 24.8607,
    longitude: 67.0011,
    priority: 'High',
    description: 'DHA branch visit for product demonstration'
  },
  {
    name: 'Gulshan Office Visit',
    address: 'Gulshan-e-Iqbal, Block 5, Karachi',
    city: 'Karachi',
    state: 'Sindh',
    pincode: '75300',
    latitude: 24.9207,
    longitude: 67.0656,
    priority: 'Medium',
    description: 'Gulshan office visit for quotation discussion'
  },
  {
    name: 'PECHS Showroom Visit',
    address: 'PECHS Block 6, Karachi',
    city: 'Karachi',
    state: 'Sindh',
    pincode: '75400',
    latitude: 24.9056,
    longitude: 67.0822,
    priority: 'Medium',
    description: 'PECHS showroom visit for order placement'
  }
];

// Generate a simple base64 image placeholder
function generateBase64Image() {
  // Simple 1x1 pixel PNG in base64
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

// Main function
async function main() {
  log('\n' + '='.repeat(70), 'blue');
  log('🚀 Complete Salesman Test Script - Karachi', 'magenta');
  log('='.repeat(70), 'blue');
  log('Testing: Visits, Sales Tracking, Quotations, Uploads, Kilometer Tracking\n', 'cyan');

  try {
    // Connect to database
    logStep('Connecting to Database');
    await connectDB();
    logSuccess('Database connected successfully\n');

    // Find salesman user
    logStep('Finding Salesman User');
    const salesmanUser = await User.findOne({ 
      email: 'usman.abid00321@gmail.com',
      role: 'salesman'
    });

    if (!salesmanUser) {
      logError('Salesman user not found. Please create the user first.');
      logInfo('Expected email: usman.abid00321@gmail.com');
      process.exit(1);
    }
    logSuccess(`Salesman found: ${salesmanUser.name} (${salesmanUser.email})\n`);

    // Find or create admin user
    let adminUser = await User.findOne({ 
      email: 'talhaabid400@gmail.com',
      role: 'admin'
    });

    if (!adminUser) {
      logWarning('Admin user not found, using salesman as creator...');
      adminUser = salesmanUser;
    } else {
      logSuccess(`Admin found: ${adminUser.name} (${adminUser.email})\n`);
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create a test customer
    logStep('Setting Up Test Customer');
    let testCustomer = await Customer.findOne({
      email: 'test.customer@example.com'
    });

    if (!testCustomer) {
      testCustomer = await Customer.create({
        firstName: 'Test',
        name: 'Test Customer',
        email: 'test.customer@example.com',
        phone: '+92-300-1234567',
        address: 'Test Address, Karachi',
        city: 'Karachi',
        state: 'Sindh',
        pincode: '75500',
        status: 'Active',
        createdBy: adminUser._id,
        view: 'admin_salesman'
      });
      logSuccess(`Created test customer: ${testCustomer.firstName}`);
    } else {
      logSuccess(`Using existing test customer: ${testCustomer.firstName}`);
    }
    log('');

    // Get or create a test product
    logStep('Setting Up Test Product');
    let testProduct = await Product.findOne({
      productCode: 'TEST-001'
    });

    if (!testProduct) {
      testProduct = await Product.create({
        name: 'Test Product',
        productCode: 'TEST-001',
        price: 5000,
        category: 'Test',
        description: 'Test product for testing',
        createdBy: adminUser._id
      });
      logSuccess(`Created test product: ${testProduct.name}`);
    } else {
      logSuccess(`Using existing test product: ${testProduct.name}`);
    }
    log('');

    // Step 1: Create visits for today
    logStep('Step 1: Creating Visits for Today (Karachi)');
    const createdVisits = [];

    for (const visitData of karachiLocations) {
      // Check if visit already exists for today
      const existingVisit = await VisitTarget.findOne({
        name: visitData.name,
        salesman: salesmanUser._id,
        visitDate: today
      });

      if (existingVisit) {
        logWarning(`Visit already exists: ${visitData.name}`);
        createdVisits.push(existingVisit);
      } else {
        const visit = await VisitTarget.create({
          ...visitData,
          salesman: salesmanUser._id,
          createdBy: adminUser._id,
          visitDate: today,
          approvalStatus: 'Approved',
          approvedAt: new Date(),
          approvedBy: adminUser._id,
          status: 'Pending',
          notes: `Test visit created for complete flow testing - ${visitData.description}`
        });
        createdVisits.push(visit);
        logSuccess(`Created: ${visitData.name}`);
      }
    }

    logSuccess(`Total visits: ${createdVisits.length}\n`);

    // Step 2: Test Kilometer Tracking for each visit
    logStep('Step 2: Testing Kilometer Tracking (Start/End for Each Visit)');
    const trackingSessions = [];
    let startingKm = 1000; // Starting kilometer reading

    for (let i = 0; i < createdVisits.length; i++) {
      const visit = createdVisits[i];
      logInfo(`\nProcessing visit ${i + 1}/${createdVisits.length}: ${visit.name}`);

      // Start tracking
      const startKm = startingKm + (i * 10); // Increment by 10km for each visit
      const tracking = await Tracking.create({
        salesman: salesmanUser._id,
        startingKilometers: startKm,
        speedometerImage: generateBase64Image(),
        startLocation: {
          latitude: visit.latitude,
          longitude: visit.longitude
        },
        visitTarget: visit._id,
        status: 'active',
        startedAt: new Date()
      });

      logSuccess(`  Started tracking: ${startKm} km`);
      logInfo(`  Location: ${visit.latitude}, ${visit.longitude}`);

      // Simulate some time passing (for realistic testing)
      await new Promise(resolve => setTimeout(resolve, 500));

      // End tracking
      const endKm = startKm + 15 + Math.floor(Math.random() * 10); // Random distance 15-25 km
      tracking.endingKilometers = endKm;
      tracking.endingMeterImage = generateBase64Image();
      tracking.visitedAreaImage = generateBase64Image();
      tracking.endLocation = {
        latitude: visit.latitude + 0.001, // Slight movement
        longitude: visit.longitude + 0.001
      };
      tracking.status = 'stopped';
      tracking.stoppedAt = new Date();
      tracking.totalDistance = endKm - startKm;

      await tracking.save();
      trackingSessions.push(tracking);

      logSuccess(`  Ended tracking: ${endKm} km`);
      logSuccess(`  Total distance: ${tracking.totalDistance} km`);
      startingKm = endKm; // Update for next visit
    }

    logSuccess(`\nTotal tracking sessions: ${trackingSessions.length}\n`);

    // Step 3: Create Quotations
    logStep('Step 3: Creating Quotations');
    const createdQuotations = [];

    for (let i = 0; i < createdVisits.length; i++) {
      const visit = createdVisits[i];
      const quotationNumber = `QT-${Date.now()}-${i + 1}`;
      const quantity = i + 1;
      const itemTotal = testProduct.price * quantity;
      
      const quotation = await Quotation.create({
        quotationNumber,
        salesman: salesmanUser._id,
        customerName: testCustomer.firstName || testCustomer.name,
        customerEmail: testCustomer.email,
        customerPhone: testCustomer.phone,
        customerAddress: testCustomer.address,
        items: [
          {
            product: testProduct._id,
            productCode: testProduct.productCode,
            productName: testProduct.name,
            quantity: quantity,
            price: testProduct.price,
            discount: 0,
            total: itemTotal
          }
        ],
        subtotal: itemTotal,
        tax: 0,
        discount: 0,
        total: itemTotal,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'Sent',
        notes: `Quotation created for visit: ${visit.name}`
      });

      createdQuotations.push(quotation);
      logSuccess(`Created quotation: ${quotationNumber} (Total: £${quotation.total})`);
    }

    logSuccess(`\nTotal quotations: ${createdQuotations.length}\n`);

    // Step 4: Create Sales Submissions (Uploads)
    logStep('Step 4: Creating Sales Submissions (Uploads)');
    // Sales submission removed - using sales orders instead
    const createdSubmissions = [];

    // Commented out - Sales submission functionality removed
    /*
    for (let i = 0; i < createdVisits.length; i++) {
      const visit = createdVisits[i];
      const salesAmount = testProduct.price * (i + 1) * 1.1; // 10% more than quotation
      
      const submission = await SalesSubmission.create({
        salesman: salesmanUser._id,
        customer: testCustomer._id,
        customerName: testCustomer.firstName || testCustomer.name,
        customerEmail: testCustomer.email,
        customerPhone: testCustomer.phone,
        salesDate: today,
        salesAmount: salesAmount,
        salesDescription: `Sales submission for visit: ${visit.name}`,
        documents: [
          {
            fileName: `sales_document_${i + 1}.png`,
            fileUrl: generateBase64Image(),
            fileType: 'image',
            uploadedAt: new Date()
          }
        ],
        approvalStatus: 'Pending',
        createdBy: salesmanUser._id
      });

      createdSubmissions.push(submission);
      logSuccess(`Created submission: ${submission.submissionNumber} (Amount: £${submission.salesAmount})`);
    }
    */

    logSuccess(`\nTotal sales submissions: ${createdSubmissions.length} (REMOVED - using Sales Orders)\n`);

    // Final Summary
    logStep('Test Summary');
    logSuccess(`✅ Visits created: ${createdVisits.length}`);
    logSuccess(`✅ Tracking sessions: ${trackingSessions.length}`);
    logSuccess(`✅ Quotations created: ${createdQuotations.length}`);
    logSuccess(`✅ Sales submissions: ${createdSubmissions.length} (REMOVED - using Sales Orders)`);
    
    const totalDistance = trackingSessions.reduce((sum, t) => sum + (t.totalDistance || 0), 0);
    const totalSales = 0; // createdSubmissions.reduce((sum, s) => sum + (s.salesAmount || 0), 0); // REMOVED
    
    logInfo(`\nTotal distance traveled: ${totalDistance.toFixed(2)} km`);
    logInfo(`Total sales amount: £${totalSales.toFixed(2)} (Use Sales Orders instead)`);
    logInfo(`Visit date: ${today.toLocaleDateString()}`);
    logInfo(`All visits are in Karachi, Sindh`);

    log('\n' + '='.repeat(70), 'green');
    logSuccess('✅ All tests completed successfully!');
    log('='.repeat(70) + '\n', 'green');
    logInfo('You can now check the salesman dashboard to see:');
    logInfo('  - Visits for today in Karachi');
    logInfo('  - Kilometer tracking sessions (started and ended)');
    logInfo('  - Quotations created');
    logInfo('  - Sales Orders (replaces Sales Submissions)');
    log('');

    process.exit(0);
  } catch (error) {
    logError('Script failed', error);
    process.exit(1);
  }
}

// Run the script
main();
