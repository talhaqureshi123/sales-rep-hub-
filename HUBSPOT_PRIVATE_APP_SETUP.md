# HubSpot Private App Setup - Step by Step Guide

## 🎯 Problem
Current token expired/invalid hai. Private App Access Token generate karna padega.

## ✅ Solution: Private App Access Token Generate Karein

### Step 1: HubSpot Login
1. https://app.hubspot.com/login pe jayein
2. Apne account mein login karein

### Step 2: Private App Create Karein
1. **Settings** → **Integrations** → **Private Apps** pe jayein
2. **"Create a private app"** button click karein
3. **App name** dein: `Sales Rap Hub Integration` (ya koi bhi naam)
4. **"Create app"** click karein

### Step 3: Scopes Select Karein
**Scopes** tab mein yeh scopes enable karein (required):

**CRM Scopes:**
- ✅ `crm.objects.contacts.read`
- ✅ `crm.objects.contacts.write`
- ✅ `crm.objects.deals.read`
- ✅ `crm.objects.deals.write`
- ✅ `crm.objects.companies.read` (optional)
- ✅ `crm.objects.companies.write` (optional)

**Engagements Scopes:**
- ✅ `engagements.read`
- ✅ `engagements.write`

**Optional (Orders ke liye):**
- `crm.objects.orders.read`
- `crm.objects.orders.write`

### Step 4: App Create Karein
1. Scopes select karne ke baad **"Create app"** click karein
2. Confirmation screen pe **"Continue creating"** click karein

### Step 5: Access Token Copy Karein
1. App create hone ke baad, **"Token"** tab mein jayein
2. **"Show token"** ya **"Copy token"** button click karein
3. **Token copy karein** - yeh token `pat-` se start hoga (US region) ya `eu1-` se start hoga (EU region)
4. ⚠️ **Important:** Token sirf ek baar dikhega! Copy kar lena zaroori hai.

### Step 6: Token .env File Mein Add Karein

Backend folder mein `.env` file mein add karein:

```env
HUBSPOT_API_KEY=pat-YOUR-TOKEN-HERE
# ya
HUBSPOT_ACCESS_TOKEN=pat-YOUR-TOKEN-HERE

HUBSPOT_ENABLED=true
```

**Important:**
- Token ke aage-piche spaces nahi hone chahiye
- Token ke aage-piche quotes nahi hone chahiye
- Complete token copy karein

### Step 7: Backend Restart Karein

```bash
cd backend
npm run dev
```

### Step 8: Test Karein

Frontend mein:
1. **HubSpot Connect** page pe jayein
2. **"Test Connection"** button click karein
3. Agar "Successfully Connected" dikhe, to sab theek hai! ✅

## 🔍 Token Format Examples

**US Region:**
```
pat-na1-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**EU Region:**
```
pat-eu1-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## ❌ Common Issues

### Issue 1: Token Expired
**Solution:** Naya token generate karein

### Issue 2: Missing Scopes
**Solution:** Private App mein required scopes enable karein

### Issue 3: Token Format Wrong
**Solution:** Token ke aage-piche spaces/quotes check karein

### Issue 4: Token Not Copied Properly
**Solution:** Token properly copy karein (complete token)

## 📝 Quick Checklist

- [ ] HubSpot account mein login karein
- [ ] Private App create karein
- [ ] Required scopes enable karein
- [ ] Token copy karein
- [ ] `.env` file mein token add karein
- [ ] Backend restart karein
- [ ] Test connection karein

## 🆘 Still Not Working?

Agar abhi bhi issue hai:
1. Token format verify karein
2. Scopes check karein
3. Backend console logs check karein
4. Test script run karein: `node scripts/testHubSpot.js`
