# Sales Order Email Test

## 1. Email password .env mein set karo

**File:** `backend/.env`

Add ya update karo:
```
EMAIL_USER=<your-sender-email e.g. info@praco.co.uk>
EMAIL_PASS=your-smtp-password
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
- Admin ko email bhejegi: `ORDER_NOTIFY_EMAIL` from .env (e.g. accounts@praco.co.uk)
- Subject: `Sales Order Approved: SOxxxxxx`

---

## 3. Result

- **Success:** Console mein "Email sent successfully!" + inbox check karo
- **Fail (EAUTH):** .env mein EMAIL_PASS sahi set karo (App Password, normal password nahi)

---

## 4. Deployment (Vercel / Render / Heroku) par email

**Local par email jati hai, deployment par nahi?** Deployment par `.env` file nahi hoti — env vars **hosting dashboard** mein set karne padte hain.

Backend ke **Environment Variables** mein ye **zaroor** add karo (values apni same rakho, secret mat commit karo):

| Variable | Example | Purpose |
|----------|---------|---------|
| `ORDER_NOTIFY_EMAIL` | accounts@praco.co.uk | Jahan order email jayegi (receiver) |
| `SALES_ORDER_FROM_EMAIL` | info@praco.co.uk | Order email kis address se jayegi |
| `INFO_PROCO_EMAIL` | info@praco.co.uk | Same as above (sender) |
| `INFO_PROCO_PASS` | (GoDaddy password) | Sender account password |
| `INFO_PROCO_HOST` | smtpout.secureserver.net | SMTP host (GoDaddy) |
| `INFO_PROCO_PORT` | 587 | SMTP port |
| `EMAIL_USER` | info@praco.co.uk | Fallback sender |
| `EMAIL_PASS` | (same password) | Fallback password |
| `EMAIL_HOST` | smtpout.secureserver.net | Fallback SMTP host |
| `EMAIL_PORT` | 587 | Fallback port |

Deploy ke baad logs mein dekho: agar `ORDER_NOTIFY_EMAIL not set` ya `INFO_PROCO_PASS missing` aaye to woh variable dashboard mein add karo.
