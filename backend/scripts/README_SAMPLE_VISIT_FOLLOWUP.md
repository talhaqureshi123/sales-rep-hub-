# Sample Track, Visit Target & Follow-Up Test Script

## How to run

**Option 1 – Double-click (easiest):**  
Run `run-test-sample-visit-followup.bat` from the `backend/scripts` folder. It will run the test and pause at the end.

**Option 2 – from `backend` folder:**
```powershell
cd backend
node scripts/testSampleVisitFollowUp.js
```

**Option 3 – from `backend/scripts` folder:**
```powershell
node testSampleVisitFollowUp.js
```
(Do **not** use `node scripts/testSampleVisitFollowUp.js` here – that looks for `scripts/scripts/...` and fails.)

## What it does

- Creates **Sample Track** (admin + salesman)
- Creates **Visit Target** (admin + salesman)
- Creates **Follow-Up** (admin + salesman)
- Verifies all items in the database

Requires: admin user, salesman user, at least one customer, and one active product in the database.
