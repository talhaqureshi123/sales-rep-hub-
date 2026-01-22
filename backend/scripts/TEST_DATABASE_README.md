# Database Direct Test Script

This script tests **ALL** database models and operations **DIRECTLY** without using HTTP API endpoints. It connects to MongoDB and tests models using Mongoose.

## Features

- ✅ Tests all database models directly (User, Customer, Product, FollowUp, SalesTarget, etc.)
- ✅ Tests CRUD operations on all models
- ✅ Tests relationships and population
- ✅ Tests data validation
- ✅ Tests queries and filters
- ✅ Tests aggregations and statistics
- ✅ No HTTP server required - direct database connection
- ✅ Detailed test results with pass/fail counts

## Usage

### Basic Usage

```bash
# From backend directory
node scripts/testDatabaseEndpoints.js

# Or using npm script
npm run test:database
```

### Keep Test Data

By default, the script cleans up test data after running. To keep test data:

```bash
# Windows (PowerShell)
$env:KEEP_TEST_DATA="true"
node scripts/testDatabaseEndpoints.js

# Linux/Mac
export KEEP_TEST_DATA="true"
node scripts/testDatabaseEndpoints.js
```

## Prerequisites

1. **MongoDB must be accessible** - The script connects directly to MongoDB using the configuration from `config.js`
2. **No backend server needed** - This script does NOT require the HTTP server to be running
3. **Database connection** - MongoDB connection string must be valid in `config.js`

## What Gets Tested

### User Model
- Create Admin User
- Create Salesman User
- Find All Users
- Find Users by Role
- Find User by ID
- Find User by Email
- Update User
- Password Comparison
- Email Validation
- Required Field Validation

### Customer Model
- Create Customer
- Find All Customers
- Find Customer by ID
- Find Customer with Creator (populate)
- Find Customers by Status
- Find Customers by Creator
- Update Customer
- Search Customers by Name
- Search Customers by Email
- Count Operations

### Product Model
- Create Product
- Find All Products
- Find Product by ID
- Find Product by Code
- Find Active Products
- Find Products by Category
- Update Product
- Update Product Stock
- Unique Product Code Validation

### Follow-Up (Tasks) Model
- Create Follow-Up
- Find All Follow-Ups
- Find Follow-Up by ID
- Find Follow-Ups by Salesman
- Find Follow-Ups by Status
- Find Follow-Ups by Type
- Find Follow-Ups by Priority
- Find Follow-Ups with Populated Relations
- Update Follow-Up
- Mark Follow-Up as Completed
- Find Overdue Follow-Ups
- Find Today Follow-Ups
- Count Operations

### Sales Target Model
- Create Sales Target
- Find All Sales Targets
- Find Sales Target by ID
- Find Sales Targets by Salesman
- Find Active Sales Targets
- Update Sales Target

### Additional Models
- Quotation (Create, Find by Salesman)
- Sample (Create)
- Visit Target (Create)
- Tracking (Create, Find Active)
- Location (Create, Find Latest)

### Aggregations & Statistics
- Count Customers by Status
- Count Follow-Ups by Status
- Count Follow-Ups by Type
- Count Follow-Ups by Priority
- Calculate Total Product Value
- Calculate Sales Target Progress

## Output

The script provides:
- ✅ **Passed tests** - Green checkmarks
- ❌ **Failed tests** - Red X marks with error details
- ⚠️ **Skipped tests** - Yellow warnings
- 📊 **Summary** - Total counts and pass rate
- 🗑️ **Cleanup** - Automatically deletes test data (unless KEEP_TEST_DATA=true)

## Example Output

```
======================================================================
🗄️  COMPREHENSIVE DATABASE TEST SUITE
======================================================================

ℹ️  Testing database models directly (no HTTP API)
ℹ️  MongoDB URI: mongodb+srv://***:***@cluster0.oaruawd.mongodb.net/...

✅ Database connected successfully

======================================================================
USER MODEL TESTS
======================================================================
  Testing Create Admin User... ✓ PASSED
  Testing Create Salesman User... ✓ PASSED
  Testing Find All Users... ✓ PASSED
  ...

======================================================================
📊 TEST SUMMARY
======================================================================

Total Tests: 75
✅ Passed: 73
❌ Failed: 2
⚠️  Skipped: 0
📈 Pass Rate: 97.33%
```

## Difference from API Test Script

| Feature | Database Test (`testDatabaseEndpoints.js`) | API Test (`testAllEndpoints.js`) |
|---------|-------------------------------------------|----------------------------------|
| **Connection** | Direct MongoDB connection | HTTP API calls |
| **Server Required** | ❌ No | ✅ Yes |
| **Tests** | Database models & operations | HTTP endpoints |
| **Speed** | Faster (direct DB access) | Slower (HTTP overhead) |
| **Use Case** | Model validation, DB testing | API integration testing |

## Troubleshooting

### Database Connection Issues
If database connection fails:
1. Check MongoDB connection string in `config.js`
2. Verify MongoDB is accessible
3. Check network/firewall settings
4. Verify MongoDB Atlas IP whitelist (if using Atlas)

### Validation Failures
If validation tests fail:
1. Check model schema definitions
2. Verify required fields
3. Check enum values
4. Review validation rules

### Test Failures
If tests fail:
1. Check the error message in the summary
2. Verify model schemas are correct
3. Check if required relationships exist
4. Review database indexes

## Notes

- The script creates test data during execution
- Test data is automatically cleaned up unless `KEEP_TEST_DATA=true`
- Some tests depend on previously created data (relationships)
- All operations use Mongoose models directly
- No HTTP server or API layer is involved
- Perfect for testing database schema changes and validations
