# Sales Order Status Workflow - Complete Guide

## 📋 Status Flow Diagram

```
Draft → Pending → Confirmed → Processing → Dispatched → Delivered
  ↓
Cancelled (can happen at any stage)
```

## 🎯 Status Definitions

### 1. **Draft** (Initial Status)
- **Meaning**: Order is being created, not yet submitted
- **What happens**:
  - Order can be edited freely
  - No invoice number generated
  - No tracking number
  - Internal flags: All set to `false`
- **When to use**: When creating a new order, before finalizing

### 2. **Pending** 
- **Meaning**: Order submitted, waiting for confirmation
- **What happens**:
  - Invoice number auto-generated (if not Draft)
  - `sendToAdmin` = `true`
  - `creditLimitCheck` = `true`
  - Waiting for admin/manager approval
- **When to use**: After order is created and needs review

### 3. **Confirmed**
- **Meaning**: Order approved and confirmed
- **What happens**:
  - Invoice number exists
  - `sendToWarehouse` = `true`
  - `creditLimitCheck` = `true`
  - Ready for processing
- **When to use**: After order is approved by admin

### 4. **Processing**
- **Meaning**: Order is being prepared/processed
- **What happens**:
  - `stockDeducted` = `true` (stock removed from inventory)
  - `sendToWarehouse` = `true`
  - Items being packed/prepared
- **When to use**: When warehouse starts preparing the order

### 5. **Dispatched**
- **Meaning**: Order has been shipped/dispatched
- **What happens**:
  - `trackingNumber` auto-generated
  - `actualDispatchDate` should be set
  - `stockDeducted` = `true`
  - Order is on the way
- **When to use**: When order is shipped to customer

### 6. **Delivered**
- **Meaning**: Order successfully delivered to customer
- **What happens**:
  - `actualDispatchDate` set
  - `amountPaid` usually equals `grandTotal`
  - `paymentReceived` = `true`
  - Order complete
- **When to use**: When customer receives the order

### 7. **Cancelled**
- **Meaning**: Order has been cancelled
- **What happens**:
  - Can happen at any stage
  - No further processing
  - May need refund if payment was made
- **When to use**: When order needs to be cancelled

## 🔄 Status Transition Rules

### Automatic Actions Based on Status:

1. **When status changes from Draft to any other status:**
   - Invoice number auto-generated (if doesn't exist)
   - `sendToAdmin` = `true`
   - `creditLimitCheck` = `true`

2. **When status = Confirmed or higher:**
   - `sendToWarehouse` = `true`

3. **When status = Processing or higher:**
   - `stockDeducted` = `true`

4. **When status = Dispatched or Delivered:**
   - `trackingNumber` should be set
   - `actualDispatchDate` should be set

5. **When status = Delivered:**
   - Payment usually complete (`amountPaid` = `grandTotal`)

## 📊 How to Identify Order Status

### In Sales Orders List:
- **Color-coded badges** show current status
- **Filter by status** to see orders in specific stage
- **Search** to find specific orders

### Status Colors:
- 🟦 **Draft**: Gray badge
- 🟨 **Pending**: Yellow badge  
- 🔵 **Confirmed**: Blue badge
- 🟣 **Processing**: Purple badge
- 🟪 **Dispatched**: Indigo badge
- 🟢 **Delivered**: Green badge
- 🔴 **Cancelled**: Red badge

## 🔍 How to Check if Dispatch is Complete

### Method 1: Check Status
- Look for status = **"Dispatched"** or **"Delivered"**
- Dispatched = Order shipped
- Delivered = Order received by customer

### Method 2: Check Fields
- **`trackingNumber`** exists → Order dispatched
- **`actualDispatchDate`** set → Dispatch date recorded
- **`orderStatus`** = "Dispatched" or "Delivered" → Dispatch complete

### Method 3: Check Internal Flags
- **`stockDeducted`** = `true` → Stock removed (processing/dispatch done)
- **`sendToWarehouse`** = `true` → Sent to warehouse

## 🎯 Best Practices

1. **Always update status in sequence:**
   - Don't skip from "Draft" to "Dispatched"
   - Follow: Draft → Pending → Confirmed → Processing → Dispatched → Delivered

2. **Set dates properly:**
   - `expectedDispatchDate` when status = Confirmed/Processing
   - `actualDispatchDate` when status = Dispatched/Delivered

3. **Update tracking:**
   - Add `trackingNumber` when status = Dispatched

4. **Payment tracking:**
   - Update `amountPaid` as payments received
   - `balanceRemaining` auto-calculated

5. **Cancellation:**
   - Can cancel at any stage
   - Check if refund needed if payment was made

## 📝 Example Workflow

```
1. Create Order → Status: "Draft"
   - Fill all sections A-G
   - Add customer signature
   - Save as Draft

2. Submit for Review → Status: "Pending"
   - Invoice number auto-generated
   - Admin reviews order

3. Approve Order → Status: "Confirmed"
   - Order confirmed
   - Sent to warehouse

4. Prepare Order → Status: "Processing"
   - Stock deducted
   - Items being packed

5. Ship Order → Status: "Dispatched"
   - Tracking number added
   - Actual dispatch date set
   - Order shipped

6. Customer Receives → Status: "Delivered"
   - Order delivered
   - Payment complete
   - Order closed
```

## ⚠️ Important Notes

- **Invoice Number**: Auto-generated when status changes from Draft
- **Tracking Number**: Should be added when status = Dispatched
- **Dates**: 
  - `expectedDispatchDate` = When you expect to dispatch
  - `actualDispatchDate` = When you actually dispatched
- **Payment**: Update `amountPaid` as customer pays
- **Cancellation**: Can happen at any stage, but check payment status
