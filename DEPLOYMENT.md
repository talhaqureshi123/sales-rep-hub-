# Deployment Checklist — Sales RAP HUB

Is file ko deployment se pehle check karo. Sab env vars aur files yahan list hain.

---

## 1. Deployment se related files (kahan kya hai)

| File | Purpose |
|------|---------|
| **backend/.env** | Backend env (local) — **git push mat karo**, sirf deployment dashboard mein set karo |
| **backend/.env.example** | Backend env vars ki list — copy karke deployment Environment Variables mein daalo |
| **backend/config.js** | Config load karta hai (process.env) — deployment par env vars yahan se aate hain |
| **frontend/.env** | Frontend env (Vite) — build time par use hota hai |
| **frontend/vite.config.js** | Build config — API proxy / env prefix (VITE_*) |

---

## 2. Backend — Environment Variables (deployment par set karo)

Hosting (Vercel / Render / Heroku / VM) ke **Backend** project → **Environment Variables** / **Config Vars** mein ye add karo:

### Zaroori (app + DB + auth)

| Variable | Example | Notes |
|----------|---------|-------|
| `PORT` | `4000` | Server port |
| `NODE_ENV` | `production` | |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` | Atlas / MongoDB connection |
| `JWT_SECRET` | (strong random string) | |
| `JWT_EXPIRE` | `7d` | |

### Order / Quotation email (info@praco — talhaabid400 mat use karo)

| Variable | Value | Notes |
|----------|--------|-------|
| `ORDER_NOTIFY_EMAIL` | `accounts@praco.co.uk` | Jahan order email jayegi |
| `SALES_ORDER_FROM_EMAIL` | `info@praco.co.uk` | Order/Quotation **From** |
| `INFO_PROCO_EMAIL` | `info@praco.co.uk` | Same sender |
| `INFO_PROCO_PASS` | (GoDaddy password) | info@praco.co.uk ka password |
| `INFO_PROCO_HOST` | `smtpout.secureserver.net` | GoDaddy SMTP |
| `INFO_PROCO_PORT` | `587` | |
| `EMAIL_USER` | `info@praco.co.uk` | Fallback sender |
| `EMAIL_PASS` | (same GoDaddy password) | |
| `EMAIL_HOST` | `smtpout.secureserver.net` | |
| `EMAIL_PORT` | `587` | |

### Optional

| Variable | Example |
|----------|---------|
| `FRONTEND_URL` | `https://salesrephub.iotfiysolutions.com` |
| `RESEND_API_KEY` | (agar Resend use karna ho) |

---

## 3. Frontend — Environment Variables (build se pehle set karo)

Frontend **build** ke waqt in vars ka use hota hai (Vite). Deployment par **Build** settings mein env set karo ya `frontend/.env.production` banao.

| Variable | Example | Notes |
|----------|---------|-------|
| `VITE_API_BASE_URL` | `https://salesrephub.iotfiysolutions.com/api/` | Backend API URL (deployment) |
| `VITE_ADMIN_EMAIL` | (optional) | UI display |
| `VITE_ORDER_NOTIFY_EMAIL` | `accounts@praco.co.uk` | UI display |
| `VITE_SALES_ORDER_FROM_EMAIL` | `info@praco.co.uk` | UI display |

---

## 4. Build / Start commands

### Backend

```bash
cd backend
npm install
# Env vars deployment dashboard mein set karo (ya .env local ke liye)
npm start
# ya: node server.js
```

### Frontend

```bash
cd frontend
npm install
# Production build ke liye VITE_API_BASE_URL = deployment backend URL set karo
npm run build
# Output: frontend/dist — isko host karo (Nginx, Vercel, etc.)
```

---

## 5. Deployment par email (order / quotation) check

- **From** hamesha **info@praco.co.uk** hona chahiye (code mein talhaabid400 force-off hai).
- Agar ab bhi **talhaabid400@gmail.com** dikhe to:
  1. Backend env mein `SALES_ORDER_FROM_EMAIL`, `INFO_PROCO_EMAIL`, `EMAIL_USER` sab **info@praco.co.uk** set karo.
  2. Redeploy karo (latest code + env).
- Server start par log: `Order email: To=..., From=...` — isse confirm ho jata hai ke kya set hai.

---

## 6. Quick reference — backend/.env.example

Detail ke liye **backend/.env.example** kholo — wahi variables deployment dashboard mein daalne hain (values apni, secrets mat commit karo).
