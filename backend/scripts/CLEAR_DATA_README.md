# Data Clear Scripts – Admin & Salesman

Ye scripts se **admin** aur **salesman** dono ka data sahi tarah khali kar sakte ho. **Users (login)** delete nahi honge – sirf business data (tasks, samples, customers, orders, etc.).

---

## 1. Dono clear (Admin + Salesman) – ek hi script

**Command (backend folder se run karo):**

```bash
cd backend
node scripts/clearAllTestData.js --confirm
```

**Optional:**

- Sirf **salesman** data clear: `node scripts/clearAllTestData.js --confirm --salesman`
- Sirf **admin** data clear: `node scripts/clearAllTestData.js --confirm --admin`

---

## 2. Sirf Admin data clear

```bash
cd backend
node scripts/clearAdminData.js --confirm
```

**Delete hoga:** Customer, SalesOrder, SalesTarget, VisitTarget, FollowUp (Tasks), Sample, Quotation, Tracking, ShiftPhoto, HubSpotOAuthToken, Location, Milestone, Product, ProductVideo.

---

## 3. Sirf Salesman data clear

```bash
cd backend
node scripts/clearSalesmanData.js --confirm
```

**Delete hoga:** FollowUp (Tasks), VisitTarget, Sample, SalesTarget, Tracking, ShiftPhoto, Quotation.

---

## Safety

- **Bina `--confirm` ke** koi delete nahi hoga – script sirf usage dikhayegi.
- **Users** kabhi delete nahi hote – admin/salesman login kar sakte hain clear ke baad bhi.

---

## Windows – ek click (optional)

Backend folder mein jaake double-click karo:

```
backend\scripts\run-clear-all-data.bat
```

Ye **dono (admin + salesman)** data clear karega. Pehle confirm message aayega.
