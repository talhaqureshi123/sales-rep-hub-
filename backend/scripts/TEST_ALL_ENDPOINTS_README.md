# Comprehensive API Endpoint Test Script

This script tests **ALL** Admin and Salesman API endpoints using the database.

## Features

- ✅ Tests all Admin endpoints (Users, Products, Customers, Visit Targets, Quotations, Samples, Follow-ups, Sales Orders, Sales Targets, Sales Submissions, Shift Photos, Tracking, Locations, HubSpot)
- ✅ Tests all Salesman endpoints (Products, Customers, Quotations, Visit Targets, Achievements, Dashboard, Location, Tracking, Samples, Follow-ups, Sales Targets, Sales Submissions)
- ✅ Database connection verification
- ✅ Authentication testing (Admin & Salesman login)
- ✅ CRUD operations testing
- ✅ Filtering and search testing
- ✅ Detailed test results with pass/fail/skip counts
- ✅ Error reporting with specific endpoint details

## Usage

### Basic Usage

```bash
# From backend directory
node scripts/testAllEndpoints.js

# Or using npm script
npm run test:endpoints
```

### With Custom Credentials

You can provide custom credentials via environment variables:

```bash
# Windows (PowerShell)
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="admin123"
$env:SALESMAN_EMAIL="salesman@example.com"
$env:SALESMAN_PASSWORD="salesman123"
$env:PORT="4000"
node scripts/testAllEndpoints.js

# Linux/Mac
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="admin123"
export SALESMAN_EMAIL="salesman@example.com"
export SALESMAN_PASSWORD="salesman123"
export PORT="4000"
node scripts/testAllEndpoints.js
```

## Prerequisites

1. **Backend server must be running**
   ```bash
   cd backend
   npm start
   # Or in development mode
   npm run dev
   ```

2. **Database connection** - The script will connect to MongoDB using the configuration from `config.js`

3. **Valid test credentials** - Default credentials are:
   - Admin: `talhaabid400@gmail.com` / `Admin@123`
   - Salesman: `usman.abid00321@gmail.com` / `salesman123`

## What Gets Tested

### Authentication
- Admin login
- Salesman login
- Get profile (me) endpoints

### Admin Endpoints

#### Users
- GET `/api/admin/users` - Get all users
- POST `/api/admin/users` - Create user
- GET `/api/admin/users/:id` - Get user by ID
- PUT `/api/admin/users/:id` - Update user
- POST `/api/admin/users/:id/generate-password-link` - Generate password link

#### Products
- GET `/api/admin/products` - Get all products
- POST `/api/admin/products` - Create product
- GET `/api/admin/products/:id` - Get product by ID
- PUT `/api/admin/products/:id` - Update product
- GET `/api/admin/products/:id/qr-code` - Download QR code
- GET `/api/admin/products/:id/barcode` - Download barcode

#### Customers
- GET `/api/admin/customers` - Get all customers
- POST `/api/admin/customers` - Create customer
- GET `/api/admin/customers/:id` - Get customer by ID
- GET `/api/admin/customers/:id/details` - Get customer details
- PUT `/api/admin/customers/:id` - Update customer
- GET `/api/admin/customers/salesman/:salesmanId` - Get customers by salesman

#### Visit Targets
- GET `/api/admin/visit-targets` - Get all visit targets
- POST `/api/admin/visit-targets` - Create visit target
- GET `/api/admin/visit-targets/:id` - Get visit target by ID
- PUT `/api/admin/visit-targets/:id` - Update visit target
- GET `/api/admin/visit-targets/salesman/:salesmanId` - Get visit targets by salesman
- GET `/api/admin/visit-targets/salesman/:salesmanId/stats` - Get salesman target stats

#### Quotations
- GET `/api/admin/quotations/stats` - Get quotation stats
- GET `/api/admin/quotations` - Get all quotations
- POST `/api/admin/quotations` - Create quotation
- GET `/api/admin/quotations/:id` - Get quotation by ID

#### Samples
- GET `/api/admin/samples/stats` - Get sample stats
- GET `/api/admin/samples` - Get all samples
- POST `/api/admin/samples` - Create sample
- GET `/api/admin/samples/:id` - Get sample by ID

#### Follow-ups (Tasks)
- GET `/api/admin/follow-ups/stats` - Get follow-up stats
- GET `/api/admin/follow-ups` - Get all follow-ups
- GET `/api/admin/follow-ups?status=Pending` - Get follow-ups with filters
- POST `/api/admin/follow-ups` - Create follow-up
- GET `/api/admin/follow-ups/:id` - Get follow-up by ID
- PUT `/api/admin/follow-ups/:id` - Update follow-up
- PUT `/api/admin/follow-ups/:id/approve` - Approve follow-up
- PUT `/api/admin/follow-ups/:id/push-to-hubspot` - Push to HubSpot

#### Product Videos
- GET `/api/admin/product-videos` - Get all product videos

#### Sales Orders
- GET `/api/admin/sales-orders` - Get all sales orders
- POST `/api/admin/sales-orders` - Create sales order
- GET `/api/admin/sales-orders/:id` - Get sales order by ID
- PUT `/api/admin/sales-orders/:id` - Update sales order

#### Sales Targets
- GET `/api/admin/sales-targets` - Get all sales targets
- POST `/api/admin/sales-targets` - Create sales target
- GET `/api/admin/sales-targets/:id` - Get sales target by ID
- PUT `/api/admin/sales-targets/:id` - Update sales target

#### Sales Submissions
- GET `/api/admin/sales-submissions/stats` - Get sales submission stats
- GET `/api/admin/sales-submissions` - Get all sales submissions
- PUT `/api/admin/sales-submissions/:id/approve` - Approve sales submission
- PUT `/api/admin/sales-submissions/:id/reject` - Reject sales submission

#### Shift Photos
- GET `/api/admin/shift-photos` - Get all shift photos

#### Tracking
- GET `/api/admin/tracking/active` - Get active tracking sessions
- GET `/api/admin/tracking` - Get all tracking data
- GET `/api/admin/tracking/:id` - Get tracking by ID

#### Locations
- GET `/api/admin/locations/latest` - Get latest salesmen locations
- GET `/api/admin/locations` - Get all locations

#### HubSpot Integration
- GET `/api/admin/hubspot/test` - Test HubSpot connection
- GET `/api/admin/hubspot/customers` - Get HubSpot customers
- GET `/api/admin/hubspot/orders` - Get HubSpot orders
- GET `/api/admin/hubspot/orders-required` - Get HubSpot orders required fields
- POST `/api/admin/hubspot/import-customers` - Import HubSpot customers
- POST `/api/admin/hubspot/import-tasks` - Import HubSpot tasks
- POST `/api/admin/hubspot/push-customers` - Push customers to HubSpot
- POST `/api/admin/hubspot/push-tasks` - Push tasks to HubSpot
- POST `/api/admin/hubspot/push-orders` - Push orders to HubSpot
- POST `/api/admin/hubspot/tasks` - Create HubSpot task

### Salesman Endpoints

#### Products
- GET `/api/salesman/products` - Get all products
- GET `/api/salesman/products/code/:code` - Get product by code
- GET `/api/salesman/products/:id` - Get product by ID

#### Customers
- GET `/api/salesman/customers` - Get my customers
- POST `/api/salesman/customers` - Create customer
- GET `/api/salesman/customers/:id` - Get customer by ID

#### Quotations
- GET `/api/salesman/quotations` - Get my quotations
- POST `/api/salesman/quotations` - Create quotation
- GET `/api/salesman/quotations/:id` - Get quotation by ID

#### Visit Targets
- GET `/api/salesman/visit-targets` - Get my visit targets
- POST `/api/salesman/visit-targets` - Create visit target
- GET `/api/salesman/visit-targets/:id` - Get visit target by ID
- POST `/api/salesman/visit-targets/:id/check-proximity` - Check proximity

#### Achievements
- GET `/api/salesman/achievements` - Get my achievements

#### Dashboard
- GET `/api/salesman/dashboard` - Get dashboard stats

#### Location
- GET `/api/salesman/location/latest` - Get latest location
- POST `/api/salesman/location` - Create location

#### Tracking
- POST `/api/salesman/tracking/start` - Start tracking
- GET `/api/salesman/tracking/active` - Get active tracking
- GET `/api/salesman/tracking` - Get all tracking
- PUT `/api/salesman/tracking/stop/:id` - Stop tracking

#### Samples
- GET `/api/salesman/samples` - Get my samples
- POST `/api/salesman/samples` - Create sample
- GET `/api/salesman/samples/:id` - Get sample by ID

#### Follow-ups (Tasks)
- GET `/api/salesman/follow-ups` - Get my follow-ups
- POST `/api/salesman/follow-ups` - Create follow-up
- GET `/api/salesman/follow-ups/:id` - Get follow-up by ID
- PUT `/api/salesman/follow-ups/:id` - Update follow-up

#### Sales Targets
- GET `/api/salesman/sales-targets` - Get my sales targets
- GET `/api/salesman/sales-targets/stats` - Get my sales target stats

#### Sales Submissions
- GET `/api/salesman/sales-submissions` - Get my sales submissions
- GET `/api/salesman/sales-submissions/stats` - Get my sales submission stats

## Output

The script provides:
- ✅ **Passed tests** - Green checkmarks
- ❌ **Failed tests** - Red X marks with error details
- ⚠️ **Skipped tests** - Yellow warnings (usually due to authentication issues)
- 📊 **Summary** - Total counts and pass rate
- 📋 **Error details** - List of all failed tests with specific error messages

## Example Output

```
======================================================================
🚀 COMPREHENSIVE API ENDPOINT TEST SUITE
======================================================================

ℹ️  API Base URL: http://127.0.0.1:4000/api
ℹ️  Port: 4000
ℹ️  Admin Email: talhaabid400@gmail.com
ℹ️  Salesman Email: usman.abid00321@gmail.com

✅ Database connected successfully
✅ Backend server is running

======================================================================
AUTHENTICATION TESTS
======================================================================
✅ Admin login successful - User ID: 507f1f77bcf86cd799439011
✅ Salesman login successful - User ID: 507f191e810c19729de860ea
  Testing Get Admin Profile... ✓ PASSED
  Testing Get Salesman Profile... ✓ PASSED

======================================================================
ADMIN ENDPOINTS TESTS
======================================================================
...

======================================================================
📊 TEST SUMMARY
======================================================================

Total Tests: 150
✅ Passed: 142
❌ Failed: 5
⚠️  Skipped: 3
📈 Pass Rate: 94.67%
```

## Troubleshooting

### Server Not Running
If you see `ECONNREFUSED` error:
1. Make sure the backend server is running
2. Check if the port matches (default: 4000)
3. Verify the server is accessible at `http://127.0.0.1:4000`

### Authentication Failures
If login fails:
1. Verify credentials are correct
2. Check if users exist in the database
3. Ensure passwords are correct

### Database Connection Issues
If database connection fails:
1. Check MongoDB connection string in `config.js`
2. Verify MongoDB is accessible
3. Check network/firewall settings

### Test Failures
If tests fail:
1. Check the error message in the summary
2. Verify the endpoint exists and is properly configured
3. Check if required data exists in the database
4. Review server logs for detailed error messages

## Notes

- The script creates test data during execution (customers, products, etc.)
- Some tests depend on previously created data (e.g., getting a customer by ID after creating it)
- HubSpot tests may fail if HubSpot is not configured or connected
- Some endpoints may be skipped if authentication fails
- The script cleans up by closing database connections after completion
