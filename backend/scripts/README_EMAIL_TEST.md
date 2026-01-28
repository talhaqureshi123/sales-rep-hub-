# Sales Order Email Test

## 1. Email password .env mein set karo

**File:** `backend/.env`

Add ya update karo:
```
EMAIL_USER=talhaabid400@gmail.com
EMAIL_PASS=your-16-char-gmail-app-password
```

Gmail App Password kaise banaye:
1. https://myaccount.google.com/security
2. 2-Step Verification ON karo
3. App passwords → Generate new app password (Mail)
4. 16-character password copy karke .env mein `EMAIL_PASS=` ke baad paste karo

---

## 2. Test script run karo

```bash
cd backend/scripts
node testSalesOrderEmail.js
```

**Yeh script:**
- Database connect karegi
- Ek test sales order create karegi (Approved + Confirmed)
- Admin ko email bhejegi: `talhaabid400@gmail.com`
- Subject: `Sales Order Approved: SOxxxxxx`

---

## 3. Result

- **Success:** Console mein "Email sent successfully!" + inbox check karo
- **Fail (EAUTH):** .env mein EMAIL_PASS sahi set karo (App Password, normal password nahi)
