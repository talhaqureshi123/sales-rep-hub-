# HubSpot Tasks Import/Export Guide

## 📋 Overview
Yeh guide batata hai ki kaise tasks (Follow-ups) ko HubSpot se import aur HubSpot mein export kiya jata hai, aur unhein dashboard mein kaise dekha jata hai.

---

## 🔄 Import Flow (HubSpot → App)

### Step 1: HubSpot Connect Page
1. **Admin Dashboard** mein jao
2. **"HubSpot Connect"** page kholo
3. **"Test Connection"** button click karo (connection verify karne ke liye)

### Step 2: Import Tasks
1. **"Import Tasks"** button click karo
2. System HubSpot se saare tasks fetch karega
3. Tasks automatically **Follow-Ups** mein convert ho jayenge
4. Success message dikhega:
   - Fetched: Kitne tasks HubSpot se aaye
   - Created: Kitne naye tasks create hue
   - Updated: Kitne existing tasks update hue
   - Skipped: Kitne tasks skip hue (invalid data)

### Step 3: View Imported Tasks
1. **"Follow-Up Manager"** ya **"Tasks"** page kholo
2. Imported tasks wahan dikhenge
3. Tasks mein **hubspotTaskId** field hoga (duplicate prevention ke liye)

---

## 📤 Export Flow (App → HubSpot)

### Method 1: Auto-Sync (Automatic)
- Jab admin **new task create** karta hai → automatically HubSpot mein sync hota hai
- Jab admin **task approve** karta hai → automatically HubSpot mein sync hota hai
- Task mein **hubspotTaskId** save hota hai

### Method 2: Manual Push (Bulk)
1. **HubSpot Connect** page par jao
2. **"Push Tasks"** button click karo
3. System saare **approved tasks** ko HubSpot mein push karega
4. Success message dikhega:
   - Attempted: Kitne tasks process kiye
   - Synced: Kitne successfully sync hue
   - Skipped: Kitne already synced the
   - Failed: Kitne fail hue

### Method 3: Individual Task Push
1. **Tasks** page par jao
2. Kisi task par click karo (detail modal open hoga)
3. **"Push to HubSpot"** button click karo
4. Task individually HubSpot mein sync ho jayega

---

## 🎯 Dashboard Views

### 1. Tasks Page (`/admin/tasks`)
- **All Tasks**: Saare tasks (imported + created)
- **Pending Approval**: Tasks jo approve hone baki hain
- **Overdue**: Tasks jo due date se pehle complete nahi hue
- **Due Today**: Aaj due hone wale tasks
- **Upcoming**: Future mein due hone wale tasks
- **Completed**: Complete ho chuke tasks

**Features:**
- Search by customer name, description
- Filter by type, priority, salesman
- Sort by due date, priority, status
- View task details (HubSpot ID visible)
- Edit, Delete, Approve, Reject tasks
- Push individual task to HubSpot

### 2. HubSpot Connect Page (`/admin/hubspot-connect`)
- Connection status check
- Import/Export buttons
- Sync statistics

---

## 🔧 Backend APIs

### Import Tasks
```
POST /api/admin/hubspot/import-tasks
```
- HubSpot se tasks fetch karta hai
- FollowUps collection mein save karta hai
- Duplicate prevention: `hubspotTaskId` check karta hai

### Export Tasks (Bulk)
```
POST /api/admin/hubspot/push-tasks
Body: { force?: boolean, limit?: number }
```
- Approved tasks ko HubSpot mein push karta hai
- Sirf un tasks ko push karta hai jo already synced nahi hain (unless `force: true`)

### Export Single Task
```
PUT /api/admin/follow-ups/:id/push-to-hubspot
```
- Individual task ko HubSpot mein push karta hai

---

## 📊 Data Mapping

### HubSpot → App (Import)
| HubSpot Field | App Field | Notes |
|--------------|-----------|-------|
| `hs_task_subject` | `description` | Task title |
| `hs_task_body` | `notes` | Task details |
| `hs_task_status` | `status` | COMPLETED → Completed |
| `hs_task_priority` | `priority` | HIGH → High, MEDIUM → Medium, LOW → Low |
| `hs_task_type` | `type` | EMAIL → Email, TODO → Call |
| `hs_timestamp` | `dueDate` | Due date/time |
| `id` | `hubspotTaskId` | HubSpot task ID (duplicate prevention) |

### App → HubSpot (Export)
| App Field | HubSpot Field | Notes |
|-----------|--------------|-------|
| `description` | `hs_task_subject` | Task title |
| `notes` | `hs_task_body` | Task details |
| `status` | `hs_task_status` | Always "NOT_STARTED" on export |
| `priority` | `hs_task_priority` | High/Urgent → HIGH, Medium → MEDIUM, Low → LOW |
| `type` | `hs_task_type` | Always "TODO" on export |
| `dueDate` | `hs_timestamp` | Due date/time (epoch milliseconds) |

---

## ✅ Best Practices

1. **Import First**: Pehle HubSpot se tasks import karo, phir app mein create karo
2. **Check Connection**: Import/Export se pehle connection test karo
3. **Approve Before Export**: Sirf approved tasks export hote hain
4. **Avoid Duplicates**: System automatically duplicate prevention karta hai via `hubspotTaskId`
5. **Bulk Operations**: Zyada tasks ke liye bulk push use karo (individual se fast)

---

## 🐛 Troubleshooting

### Tasks Import Nahin Ho Rahe
- Check HubSpot connection status
- Verify HubSpot token/credentials
- Check backend logs for errors

### Tasks Export Nahin Ho Rahe
- Ensure tasks are **approved** (approvalStatus: 'Approved')
- Check if task already has `hubspotTaskId` (already synced)
- Use `force: true` option to re-sync existing tasks

### Duplicate Tasks
- System automatically prevents duplicates via `hubspotTaskId`
- If duplicates appear, check database for missing `hubspotTaskId` field

---

## 📝 Notes

- **Auto-Approval**: HubSpot se imported tasks automatically **Approved** status mein aate hain
- **Customer Linking**: Imported tasks automatically customer se link hote hain (email match se)
- **Status Sync**: HubSpot mein completed tasks app mein bhi completed dikhte hain
- **Real-time Sync**: New tasks automatically HubSpot mein sync hote hain (non-blocking)

---

## 🎯 Quick Reference

| Action | Location | Button |
|--------|----------|--------|
| Import Tasks | HubSpot Connect | "Import Tasks" |
| Export Tasks (Bulk) | HubSpot Connect | "Push Tasks" |
| Export Single Task | Tasks Page | "Push to HubSpot" (in task detail) |
| View Tasks | Tasks Page | All tabs (All, Pending, Overdue, etc.) |
| Test Connection | HubSpot Connect | "Test Connection" |

---

**Last Updated**: Current Date
**Version**: 1.0
