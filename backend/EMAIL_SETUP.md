# Email Configuration Guide (Nodemailer)

## Setup Instructions

### 1. Install Nodemailer
```bash
cd backend
npm install nodemailer
```

### 2. Create .env File
Create a `.env` file in the `backend` directory with the following configuration:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 3. Gmail Setup (Recommended)

#### Option A: Using Gmail with App Password (Recommended for Production)

1. **Enable 2-Step Verification:**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

2. **Generate App Password:**
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Other (Custom name)"
   - Enter "Sales Rap Hub" as the name
   - Click "Generate"
   - Copy the 16-character password (no spaces)

3. **Update .env file:**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=abcd efgh ijkl mnop  # Use the generated app password
   ```

#### Option B: Using Other Email Providers

**Outlook/Hotmail:**
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

**Yahoo:**
```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_USER=your-email@yahoo.com
EMAIL_PASS=your-app-password
```

**Custom SMTP Server:**
```env
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASS=your-password
```

### 4. Test Email Configuration

The email service will automatically check if email is configured. If `EMAIL_USER` or `EMAIL_PASS` is empty, it will:
- Log a warning: "Email not configured. Skipping email send."
- Still generate the password setup token
- Log the setup link to console

### 5. Email Features

Currently, the system sends:
- **Password Setup Email**: When admin creates a new salesman account, an email is sent with a password setup link.

### 6. Troubleshooting

**Error: "Invalid login"**
- Make sure you're using App Password for Gmail, not your regular password
- Check if 2-Step Verification is enabled

**Error: "Connection timeout"**
- Check your firewall settings
- Verify EMAIL_HOST and EMAIL_PORT are correct
- Try using port 465 with `secure: true` (requires code change)

**Error: "Authentication failed"**
- Verify EMAIL_USER and EMAIL_PASS in .env file
- For Gmail, ensure App Password is correct
- Check if "Less secure app access" is enabled (if not using App Password)

### 7. Security Notes

- Never commit `.env` file to git
- Use App Passwords instead of regular passwords
- Rotate passwords regularly
- For production, consider using email services like SendGrid, Mailgun, or AWS SES

### 8. Production Recommendations

For production environments, consider:
- Using dedicated email services (SendGrid, Mailgun, AWS SES)
- Setting up SPF, DKIM, and DMARC records
- Using environment-specific email templates
- Implementing email queue system for better reliability
