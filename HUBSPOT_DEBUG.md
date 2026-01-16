# HubSpot Debugging Guide

## 🔍 Data Nahi Aa Raha? Ye Steps Follow Karein:

### Step 1: Test Connection
```bash
# Browser ya Postman se:
GET http://localhost:5000/api/admin/hubspot/test
Headers: Authorization: Bearer YOUR_ADMIN_TOKEN
```

### Step 2: Check .env File
`.env` file mein yeh hona chahiye:
```env
HUBSPOT_ACCESS_TOKEN=your-token-here
# ya
HUBSPOT_API_KEY=your-token-here
```

### Step 3: Check Backend Console
Backend console mein yeh messages dikhne chahiye:
- `Fetching customers from HubSpot...`
- `Successfully fetched X customers from HubSpot`
- Ya error messages with details

### Step 4: Common Issues

#### Issue 1: Token Not Set
**Error:** `HubSpot access token not configured`
**Solution:** `.env` file mein token add karein

#### Issue 2: Invalid Token
**Error:** `401 Unauthorized` ya `403 Forbidden`
**Solution:** 
- HubSpot mein Private App check karein
- Token regenerate karein
- Scopes verify karein

#### Issue 3: Missing Scopes
**Error:** `403 Forbidden` ya `Insufficient permissions`
**Solution:** HubSpot Private App mein yeh scopes add karein:
- `crm.objects.contacts.read`
- `crm.objects.contacts.write`
- `crm.objects.deals.read`
- `crm.objects.deals.write`

#### Issue 4: No Data in HubSpot
**Error:** `Successfully fetched 0 customers`
**Solution:** 
- HubSpot account mein check karein ki contacts/deals hain
- Agar nahi hain, to pehle manually create karein ya API se create karein

### Step 5: Test API Directly

#### Test Customers Fetch:
```bash
curl -X GET "https://api.hubapi.com/crm/v3/objects/contacts?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

#### Test Orders/Deals Fetch:
```bash
curl -X GET "https://api.hubapi.com/crm/v3/objects/deals?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Step 6: Check Response Format

Agar data aa raha hai but empty array:
- HubSpot account mein data check karein
- API response check karein (console logs)
- Properties parameter verify karein

### Step 7: Enable Detailed Logging

Backend console mein detailed logs dikhenge:
- API request details
- Response status
- Error messages with full details
- Sample data (first record)

## 🛠️ Quick Fixes

1. **Backend Restart:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Token Verify:**
   - HubSpot → Settings → Integrations → Private Apps
   - Token copy karein
   - `.env` file mein paste karein

3. **Scopes Check:**
   - Private App → Scopes tab
   - Required scopes enable karein

4. **Test Endpoint:**
   - `/api/admin/hubspot/test` call karein
   - Detailed error messages dekhein

## 📞 Support

Agar issue persist kare:
1. Backend console logs share karein
2. Test endpoint response share karein
3. HubSpot Private App settings verify karein
