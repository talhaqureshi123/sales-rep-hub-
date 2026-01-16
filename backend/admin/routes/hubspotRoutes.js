const express = require('express');
const router = express.Router();
const {
  createCustomerAndOrder,
  getHubSpotCustomers,
  getHubSpotOrders,
  syncHubSpotData,
  createHubSpotTask,
  testHubSpotConnection,
  importHubSpotCustomersToDb,
  importHubSpotTasksToDb,
  getHubSpotOrdersRequiredFields,
  pushSalesOrdersToHubSpot,
  pushCustomersToHubSpot,
  repairOrderAssociations,
} = require('../controllers/hubspotController');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Log middleware
router.use((req, res, next) => {
  console.log(`[HUBSPOT ROUTE] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Test HubSpot connection
router.get('/test', (req, res, next) => {
  console.log('[HUBSPOT] Test endpoint hit!');
  testHubSpotConnection(req, res).catch(next);
});

// Create customer + order together
router.post('/create-order', createCustomerAndOrder);

// Fetch customers from HubSpot
router.get('/customers', (req, res, next) => {
  console.log('[HUBSPOT] Customers endpoint hit!');
  getHubSpotCustomers(req, res).catch(next);
});

// Fetch orders from HubSpot
router.get('/orders', (req, res, next) => {
  console.log('[HUBSPOT] Orders endpoint hit!');
  getHubSpotOrders(req, res).catch(next);
});

// Sync HubSpot data (customers and orders)
router.post('/sync', syncHubSpotData);

// Import HubSpot contacts into local Customers DB
router.post('/import-customers', importHubSpotCustomersToDb);

// Import HubSpot tasks into local Follow-Ups DB
router.post('/import-tasks', importHubSpotTasksToDb);

// Debug: required fields for Orders object
router.get('/orders-required', getHubSpotOrdersRequiredFields);

// Push existing SalesOrders from website DB to HubSpot Orders
router.post('/push-orders', pushSalesOrdersToHubSpot);

// Push existing Customers from website DB to HubSpot Contacts
router.post('/push-customers', pushCustomersToHubSpot);

// Repair order->contact associations for already-synced orders
router.post('/repair-order-associations', repairOrderAssociations);

// Create task in HubSpot
router.post('/tasks', createHubSpotTask);

module.exports = router;
