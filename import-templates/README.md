# Import Templates (Excel/CSV)

Use these CSV files to **import Tasks** and **Customers** in Sales Rap Hub.

## Important: Use CSV format
- App accepts **CSV** only. In Excel: **File → Save As → CSV (Comma delimited) (*.csv)**.
- Open the template in Excel, edit rows, then save as CSV before importing.

---

## 1. Tasks Import (`tasks-import-template.csv`)

**Database se salesman check / template update:**
- Salesmen list: backend folder se run karein: `node scripts/listSalesmen.js` — DB ke saare salesman (email, name) dikhenge.
- Template ko DB ke first salesman se generate karein: `node scripts/generateTasksImportFromDb.js` — `tasks-import-template.csv` automatically sahi salesman email ke saath ban jayega (saare task types ke rows ke saath).

**Required columns:**
| Column         | Required | Description |
|----------------|----------|-------------|
| customerName   | Yes      | Customer name |
| salesmanEmail  | Yes      | Salesman's login email (DB mein jo salesman hai wohi use karein) |
| dueDate        | Yes      | Due date, e.g. 2025-02-25 or 25/02/2025 |

**Optional columns:**
| Column        | Description |
|---------------|-------------|
| type          | Call, Visit, Email, Meeting, WhatsApp, Other, Quote Follow-up, Sample Feedback, Order Check |
| priority      | Low, Medium, High, Urgent |
| description   | Task description |
| customerEmail | Customer email |
| customerPhone | Customer phone |
| notes         | Notes |

**Before import:** Use `node scripts/generateTasksImportFromDb.js` (backend se) so template uses a real DB salesman; ya `salesman@example.com` ko apne DB ke kisi salesman email se replace karein.

**Har salesman ke liye alag CSV (test sab):**
- Run: `node scripts/generateTasksImportPerSalesman.js` (backend folder se).
- Har DB salesman ke liye ek file banta hai: `tasks-import-1-Afhaam.csv`, `tasks-import-2-Babar-Hussain.csv`, …  
- Har file mein usi salesman ke liye 9 tasks (saare types) hote hain. Admin → Tasks → Import Excel se ek-ek file import karke har salesman ko test karein.

---

## 2. Customers Import (`customers-import-template.csv`)

**Required:** At least **First Name** (or **Name**).

**Optional columns:** Contact Person, Company, Email, Phone, Address, City, State, Pincode, Status, Notes, Order Potential, Monthly Spend, Competitor Info.

**Status values:** Active, Inactive, Not Visited, Visited, Follow-up Needed, Qualified Lead, Not Interested.

---

## How to test import

1. **Customers:** Admin Dashboard → Customer Management → **Import from Excel** → choose `customers-import-template.csv` (edit if needed, save as CSV) → Import. Check that 3 sample customers appear.
2. **Tasks (ek template):** Admin Dashboard → Tasks → **Import Excel** → choose `tasks-import-template.csv` → Import.
3. **Tasks (har salesman test):** Use `tasks-import-1-Afhaam.csv`, `tasks-import-2-Babar-Hussain.csv`, … — har file ek salesman ke liye; Import Excel se ek-ek import karke sab salesmen test karein.
