# Email Troubleshooting Guide

## Gmail Authentication Error: "535-5.7.8 Username and Password not accepted"

### Common Causes:
1. **Using regular password instead of App Password**
2. **2-Step Verification not enabled**
3. **App Password has spaces (should be removed)**
4. **App Password expired or revoked**

### Step-by-Step Fix:

#### Step 1: Enable 2-Step Verification
1. Go to: https://myaccount.google.com/security
2. Find "2-Step Verification"
3. Click "Get Started" and follow the steps
4. Complete the setup

#### Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" from the dropdown
3. Select "Other (Custom name)"
4. Enter name: "Sales Rap Hub"
5. Click "Generate"
6. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)

#### Step 3: Update .env File
1. Open `backend/.env` file
2. Find `EMAIL_PASS` line
3. **Remove ALL spaces** from the App Password
4. Example:
   ```
   EMAIL_PASS=abcdefghijklmnop
   ```
   NOT:
   ```
   EMAIL_PASS=abcd efgh ijkl mnop
   ```

#### Step 4: Restart Backend Server
1. Stop the backend server (Ctrl+C)
2. Start again: `npm run dev` or `node server.js`

#### Step 5: Test Email
1. Create a new salesman
2. Check backend console for email status
3. Check the salesman's email inbox (and spam folder)

### Alternative: Use Different Email Provider

If Gmail continues to have issues, you can use:

#### Outlook/Hotmail:
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

#### Yahoo:
```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_USER=your-email@yahoo.com
EMAIL_PASS=your-app-password
```

### Still Not Working?

1. **Check .env file location**: Should be in `backend/.env` (not `backend/enviornment/.env`)
2. **Verify no extra spaces**: App Password should have NO spaces
3. **Check email format**: `EMAIL_USER` should be full email address
4. **Restart server**: After changing .env, always restart backend
5. **Check backend console**: Look for detailed error messages

### Quick Test:
Run this in backend folder to test email config:
```bash
node -e "require('dotenv').config(); console.log('EMAIL_USER:', process.env.EMAIL_USER); console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET (' + process.env.EMAIL_PASS.length + ' chars)' : 'NOT SET');"
```
