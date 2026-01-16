# HubSpot Token Fix Guide

## ❌ Current Issue
Token mil raha hai lekin HubSpot API 401 error de raha hai:
```
Authentication credentials not found
```

## ✅ Solution Steps

### Step 1: HubSpot Mein Token Verify Karein

1. **HubSpot Login:**
   - https://app.hubspot.com/login
   - Apne account mein login karein

2. **Private App Check:**
   - Settings → Integrations → Private Apps
   - Apni Private App open karein (jisme se token liya hai)

3. **Token Verify:**
   - Token copy karein
   - Verify karein ki token `eu1-5e75-4aee-46f0-9522-f2679e8f89d3` se match karta hai

### Step 2: Scopes Check Karein

Private App mein **Scopes** tab mein yeh scopes enable hone chahiye:

**Required Scopes:**
- ✅ `crm.objects.contacts.read`
- ✅ `crm.objects.contacts.write`
- ✅ `crm.objects.deals.read`
- ✅ `crm.objects.deals.write`
- ✅ `engagements.read`
- ✅ `engagements.write`

**Optional (Orders ke liye):**
- `crm.objects.orders.read`
- `crm.objects.orders.write`

### Step 3: Token Regenerate Karein (Agar Scopes Missing Hain)

1. Private App mein jayein
2. **Scopes** tab mein required scopes enable karein
3. **Save** karein
4. **Token** tab mein jayein
5. **Regenerate token** button click karein
6. **Naya token copy karein** (yeh sirf ek baar dikhega!)

### Step 4: .env File Update Karein

Backend folder mein `.env` file mein update karein:

```env
HUBSPOT_API_KEY=eu1-YOUR-NEW-TOKEN-HERE
# ya
HUBSPOT_ACCESS_TOKEN=eu1-YOUR-NEW-TOKEN-HERE

HUBSPOT_ENABLED=true
```

**Important:**
- Token ke aage-piche koi spaces nahi hone chahiye
- Token ke aage-piche quotes nahi hone chahiye
- Token directly paste karein

### Step 5: Backend Restart Karein

```bash
cd backend
npm run dev
```

### Step 6: Test Karein

```bash
cd backend
node scripts/testHubSpot.js
```

Agar abhi bhi error aaye, to:

1. **Token format check:**
   - Token `eu1-` se start hona chahiye (EU region)
   - Ya `pat-` se start hona chahiye (US region)
   - Token length approximately 36 characters honi chahiye

2. **HubSpot Account Check:**
   - Account active hai ya nahi
   - Account mein contacts/deals hain ya nahi

3. **API Region Check:**
   - Agar token `eu1-` se start hai, to API URL `https://api.hubapi.com` sahi hai
   - EU region ke liye bhi same API URL use hota hai

## 🔍 Common Issues

### Issue 1: Token Expired
**Solution:** HubSpot mein naya token generate karein

### Issue 2: Missing Scopes
**Solution:** Private App mein required scopes enable karein

### Issue 3: Wrong Token Format
**Solution:** Token ke aage-piche spaces/quotes check karein

### Issue 4: Token for Different Account
**Solution:** Sahi HubSpot account ka token use karein

## 📝 Quick Checklist

- [ ] HubSpot account mein login karein
- [ ] Private App open karein
- [ ] Scopes verify karein (required scopes enable hain)
- [ ] Token regenerate karein (agar scopes missing hain)
- [ ] `.env` file mein naya token add karein
- [ ] Backend restart karein
- [ ] Test script run karein

## 🆘 Still Not Working?

Agar abhi bhi issue hai, to:

1. HubSpot Private App ka screenshot share karein (Scopes tab)
2. Test script ka full output share karein
3. Backend console logs share karein
