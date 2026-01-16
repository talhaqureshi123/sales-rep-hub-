# HubSpot Integration Setup Guide

## 📋 Overview

Yeh application HubSpot ke saath integrate hai. Jab salesman customer create karega, quotation banayega, visit target complete karega, ya notes add karega - ye sab automatically HubSpot mein sync ho jayega.

## 🔧 Setup Steps

### 1. HubSpot Private App Create Karein

1. HubSpot account mein login karein
2. **Settings** → **Integrations** → **Private Apps** par jayein
3. **Create a private app** button click karein
4. App ka naam dein (e.g., "Sales Rap Hub Integration")
5. **Scopes** select karein:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
   - `crm.objects.orders.read` (optional, for Orders API)
   - `crm.objects.orders.write` (optional, for Orders API)
   - `engagements.read`
   - `engagements.write`
6. **Create app** click karein
7. **Access Token** copy karein (yeh sirf ek baar dikhega!)

### 2. Backend Configuration

`.env` file mein add karein:

```env
HUBSPOT_ACCESS_TOKEN=your-access-token-here
HUBSPOT_ENABLED=true
```

Ya agar API key use kar rahe hain:

```env
HUBSPOT_API_KEY=your-api-key-here
HUBSPOT_ENABLED=true
```

### 3. Backend Restart Karein

```bash
cd backend
npm run dev
```

## 🔄 Data Sync Flow

### 1. **Customer Creation** (Salesman/Admin)
- Customer create hote hi HubSpot mein **Contact** create/update hoga
- Fields sync: Name, Email, Phone, Address, Company, Status, Notes

### 2. **Quotation Creation** (Salesman)
- Quotation create hote hi HubSpot mein:
  - **Deal** create hoga (quotation amount ke saath)
  - Deal **Contact** se associate hoga
  - **Note** add hoga quotation details ke saath

### 3. **Visit Target Completion** (Salesman)
- Visit target complete hote hi:
  - Related customer ke contact par **Note** add hoga
  - Achievement property update hogi

### 4. **Notes** (Salesman)
- Notes automatically HubSpot contact timeline mein add honge

## 📊 HubSpot Mein Kya Dikhega

### Contacts
- Customer name, email, phone
- Address, city, state, pincode
- Company name
- Status (Active/Inactive)
- Notes

### Deals
- Quotation number
- Amount (quotation total)
- Status (Draft/Approved/Rejected)
- Associated contact
- Description (notes)

### Timeline/Notes
- Visit target completion notes
- Quotation creation notes
- Achievement updates
- General notes

## 🛠️ API Endpoints Used

### Contacts
- `POST /crm/v3/objects/contacts` - Create contact
- `PATCH /crm/v3/objects/contacts/{id}` - Update contact
- `POST /crm/v3/objects/contacts/search` - Search contact
- `GET /crm/v3/objects/contacts` - Fetch all contacts

### Orders/Deals
- `POST /crm/v3/objects/orders` - Create order (with fallback to deals)
- `GET /crm/v3/objects/orders` - Fetch all orders (with fallback to deals)
- `POST /crm/v3/objects/deals` - Create deal (fallback)
- `PUT /crm/v3/objects/orders/{id}/associations/contacts/{id}` - Associate order with contact
- `PUT /crm/v3/objects/deals/{id}/associations/contacts/{id}` - Associate deal (fallback)

### Engagements
- `POST /engagements/v1/engagements` - Create note/engagement/task

## ⚠️ Important Notes

1. **Non-blocking**: HubSpot sync async hai - agar sync fail ho, to application kaam karta rahega
2. **Error Handling**: Errors console mein log honge, lekin user ko error nahi dikhega
3. **API Limits**: HubSpot API ki rate limits check karein
4. **Testing**: Pehle test environment mein check karein

## 🐛 Troubleshooting

### Sync nahi ho raha?
1. Check karein `.env` file mein `HUBSPOT_ACCESS_TOKEN` set hai
2. Check karein `HUBSPOT_ENABLED=true` hai
3. Backend console mein errors check karein
4. HubSpot Private App ke scopes verify karein

### Contact duplicate ho rahe hain?
- Service automatically email se existing contact find karta hai
- Agar email match nahi karta, to naya contact create hoga

## 🆕 New API Endpoints

### Create Customer + Order Together
```
POST /api/admin/hubspot/create-order
Body: {
  customer: { firstname, lastname, email, phone, company, address, city, state, zip },
  order: { name, amount, status, description }
}
```

### Fetch Customers from HubSpot
```
GET /api/admin/hubspot/customers
```

### Fetch Orders from HubSpot
```
GET /api/admin/hubspot/orders
```

### Sync HubSpot Data
```
POST /api/admin/hubspot/sync
```

### Create Task in HubSpot
```
POST /api/admin/hubspot/tasks
Body: { subject, contactId (optional) }
```

## 📝 Next Steps

1. HubSpot Private App create karein
2. Access token `.env` file mein add karein
3. Backend restart karein
4. Test karein:
   - Customer create karein → HubSpot check karein
   - Quotation create karein → HubSpot check karein
   - Visit target complete karein → HubSpot check karein
   - New API endpoints test karein

---

**Note**: API key/access token end mein provide karein, main integration ready hai! 🚀

