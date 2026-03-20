const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
let Resend;
try {
  Resend = require('resend').Resend;
} catch (_) {
  Resend = null;
}

// When config has placeholder (e.g. from shell env), read .env file directly so scripts work
function getPassFromEnvFile(key) {
  const tryPath = (envPath) => {
    try {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1); // strip BOM
      content = content.replace(/\r\n/g, '\n');
      const re = new RegExp(`^\\s*${key}\\s*=\\s*(.+)`, 'm');
      const m = content.match(re);
      if (m) return m[1].split('#')[0].replace(/^["']|["']$/g, '').trim().replace(/\s/g, '');
      return '';
    } catch (_) {
      return '';
    }
  };
  const cwd = process.cwd();
  const base = path.resolve(__dirname, '..');
  // Try cwd first (when running "node scripts/..." from backend), then utils parent, then cwd/backend
  return tryPath(path.join(cwd, '.env')) || tryPath(path.join(base, '.env')) || tryPath(path.join(cwd, 'backend', '.env'));
}

// Praco-only mail: never use personal Gmail (e.g. talhaabid400@gmail.com) for sending
const PRACO_ORDER_TO = 'accounts@praco.co.uk';
const PRACO_ORDER_FROM = 'info@praco.co.uk';
const isPersonalGmail = (e) => /talhaabid|talhaabid400|talhaabid00321@gmail\.com/i.test((e || '').trim());

// Create reusable transporter object using SMTP transport
// Never use personal Gmail (talhaabid400 etc.) — use Praco (INFO_PROCO) if configured
const createTransporter = () => {
  let user = (config.EMAIL_USER || '').trim();
  let cleanPassword = getPassFromEnvFile('EMAIL_PASS');
  if (!cleanPassword) cleanPassword = (config.EMAIL_PASS || '').replace(/\s/g, '');
  if (isPersonalGmail(user)) {
    user = (config.INFO_PROCO_EMAIL || '').trim() || PRACO_ORDER_FROM;
    const p = getPassFromEnvFile('INFO_PROCO_PASS') || (config.INFO_PROCO_PASS || '').replace(/\s/g, '');
    if (p) cleanPassword = p;
  }
  const secure = config.EMAIL_SECURE ?? (config.EMAIL_PORT === 465);
  return nodemailer.createTransport({
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure, // true for 465 (GoDaddy), false for 587
    auth: { user: user || config.EMAIL_USER, pass: cleanPassword },
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development',
  });
};

// Send password setup email to salesman
const sendPasswordSetupEmail = async (email, name, token) => {
  try {
    const fromUser = isPersonalGmail(config.EMAIL_USER) ? PRACO_ORDER_FROM : ((config.INFO_PROCO_EMAIL || config.EMAIL_USER || '').trim() || PRACO_ORDER_FROM);
    if (!fromUser || (!config.EMAIL_PASS && !config.INFO_PROCO_PASS)) {
      console.warn('⚠️ Email not configured. Skipping email send.');
      console.warn('📧 EMAIL_USER / INFO_PROCO_EMAIL:', fromUser || 'NOT SET');
      console.log('🔗 Password setup link:', `${config.FRONTEND_URL}/setup-password?token=${token}`);
      return { success: false, message: 'Email not configured. Please set EMAIL_USER and EMAIL_PASS in .env file', link: `${config.FRONTEND_URL}/setup-password?token=${token}` };
    }

    const transporter = createTransporter();

    const setupUrl = `${config.FRONTEND_URL}/setup-password?token=${token}`;

    const mailOptions = {
      from: `"Praco Supplies" <${fromUser}>`,
      to: email,
      subject: 'Welcome to Praco Supplies - Set Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #e9931c;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #e9931c;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .button:hover {
              background-color: #d8820a;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Praco Supplies!</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>Your account has been created by the administrator. To get started, please set your password by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${setupUrl}" class="button">Set Your Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666;">${setupUrl}</p>
              
              <p><strong>Note:</strong> This link will expire in 24 hours for security reasons.</p>
              
              <p>If you did not expect this email, please ignore it.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Praco Supplies. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Praco Supplies!
        
        Hello ${name},
        
        Your account has been created by the administrator. To get started, please set your password by visiting:
        
        ${setupUrl}
        
        Note: This link will expire in 24 hours for security reasons.
        
        If you did not expect this email, please ignore it.
        
        © ${new Date().getFullYear()} Praco Supplies. All rights reserved.
      `,
    };

    // Verify transporter before sending
    await transporter.verify();
    console.log('✅ Email transporter verified successfully');

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password setup email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Sent to:', email);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    console.error('📧 Email details:', { to: email, from: config.EMAIL_USER });
    if (error.code === 'EAUTH') {
      console.error('🔐 Authentication failed. Check your EMAIL_USER and EMAIL_PASS in .env file');
      console.error('💡 For Gmail: Make sure you are using App Password, not regular password');
    }
    return { success: false, error: error.message };
  }
};

// Send OTP email for password setup verification
const sendOTPEmail = async (email, name, otp) => {
  try {
    const fromUser = isPersonalGmail(config.EMAIL_USER) ? PRACO_ORDER_FROM : ((config.INFO_PROCO_EMAIL || config.EMAIL_USER || '').trim() || PRACO_ORDER_FROM);
    if (!fromUser || (!config.EMAIL_PASS && !config.INFO_PROCO_PASS)) {
      console.warn('Email not configured. Skipping OTP email send.');
      console.log('OTP for', email, ':', otp);
      return { success: true, message: 'Email not configured, but OTP generated' };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: `"Praco Supplies" <${fromUser}>`,
      to: email,
      subject: 'Praco Supplies - Password Setup OTP',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #e9931c;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .otp-box {
              background-color: #f0f0f0;
              border: 2px dashed #e9931c;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              border-radius: 5px;
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              color: #e9931c;
              letter-spacing: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Setup Verification</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>You are setting up your password for Praco Supplies. Please use the OTP below to verify your email:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #666; font-size: 14px;">Your OTP Code</p>
                <div class="otp-code">${otp}</div>
              </div>
              
              <p><strong>Note:</strong> This OTP will expire in 10 minutes for security reasons.</p>
              
              <p>If you did not request this OTP, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Praco Supplies. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Setup Verification
        
        Hello ${name},
        
        You are setting up your password for Praco Supplies. Please use the OTP below to verify your email:
        
        OTP: ${otp}
        
        Note: This OTP will expire in 10 minutes for security reasons.
        
        If you did not request this OTP, please ignore this email.
        
        © ${new Date().getFullYear()} Praco Supplies. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
};

// Create transporter for order approval emails (Admin login option)
// Never use personal Gmail (talhaabid400 etc.) — use Praco (INFO_PROCO) if configured
const createApprovalEmailTransporter = () => {
  let user = (config.EMAIL_USER || '').trim();
  let cleanPass = (config.EMAIL_PASS || process.env.EMAIL_PASS || '').trim();
  cleanPass = String(cleanPass || '').replace(/\s/g, '').trim().replace(/^["']|["']$/g, '');
  if (isPersonalGmail(user)) {
    user = (config.INFO_PROCO_EMAIL || '').trim() || PRACO_ORDER_FROM;
    if (isPersonalGmail(user)) user = PRACO_ORDER_FROM;
    const p = (config.INFO_PROCO_PASS || process.env.INFO_PROCO_PASS || '').trim().replace(/\s/g, '');
    if (p) cleanPass = p;
  }
  if (!cleanPass || /^\*?\s*secret\s*\*?$/i.test(cleanPass)) {
    cleanPass = getPassFromEnvFile('EMAIL_PASS') || '';
  }
  if (!cleanPass || /^\*?\s*secret\s*\*?$/i.test(cleanPass)) cleanPass = '';
  if (isPersonalGmail(user)) user = PRACO_ORDER_FROM;
  const isGmail = (user || '').toLowerCase().includes('@gmail.com');
  const host = isGmail ? 'smtp.gmail.com' : (config.EMAIL_HOST || 'smtp.gmail.com');
  const port = isGmail ? 587 : (Number(config.EMAIL_PORT) || 587);
  const secure = config.EMAIL_SECURE ?? (port === 465);
  const opts = {
    host,
    port,
    secure,
    auth: { user: user || config.EMAIL_USER, pass: cleanPass },
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development',
  };
  if (port === 587 && !secure) {
    opts.requireTLS = true;
    opts.tls = { rejectUnauthorized: true };
  }
  return nodemailer.createTransport(opts);
};

// When sending from INFO_PROCO / SALES_ORDER_FROM_EMAIL, use INFO_PROCO_* (set in .env or deployment env vars)
// Deployment: kabhi bhi personal Gmail (talhaabid400) se send mat karo — hamesha Praco use karo
const getOrderEmailTransporter = (fromEmailOverride) => {
  let from = (fromEmailOverride || '').trim().toLowerCase();
  if (isPersonalGmail(from)) from = PRACO_ORDER_FROM.toLowerCase();
  const infoEmail = (config.SALES_ORDER_FROM_EMAIL || config.INFO_PROCO_EMAIL || '').trim().toLowerCase();
  const usePracoBlock = (from === infoEmail || from === PRACO_ORDER_FROM.toLowerCase() || isPersonalGmail(infoEmail));
  if (usePracoBlock && (config.INFO_PROCO_EMAIL || config.INFO_PROCO_PASS || config.EMAIL_USER || config.EMAIL_PASS)) {
    let cleanPass = (config.INFO_PROCO_PASS || process.env.INFO_PROCO_PASS || '').trim();
    cleanPass = String(cleanPass || '').replace(/\s/g, '').trim().replace(/^["']|["']$/g, '');
    if (!cleanPass || /^\*?\s*secret\s*\*?$/i.test(cleanPass)) {
      cleanPass = getPassFromEnvFile('INFO_PROCO_PASS');
    }
    if (!cleanPass || /^\*?\s*secret\s*\*?$/i.test(cleanPass)) {
      cleanPass = (config.EMAIL_PASS || process.env.EMAIL_PASS || '').replace(/\s/g, '').trim().replace(/^["']|["']$/g, '');
    }
    if (!cleanPass || /^\*?\s*secret\s*\*?$/i.test(cleanPass)) {
      cleanPass = getPassFromEnvFile('EMAIL_PASS') || '';
    }
    if (!cleanPass || /^\*?\s*secret\s*\*?$/i.test(cleanPass)) {
      console.error('❌ Order email: INFO_PROCO_PASS / EMAIL_PASS missing. Set in backend/.env (local) or in deployment Environment Variables.');
      cleanPass = cleanPass || '';
    }
    let user = (config.INFO_PROCO_EMAIL || '').trim().toLowerCase();
    if (isPersonalGmail(user)) user = PRACO_ORDER_FROM;
    let host = (config.INFO_PROCO_HOST || config.EMAIL_HOST || 'smtp.office365.com').trim();
    if (user === PRACO_ORDER_FROM && host.includes('gmail.com')) host = 'smtpout.secureserver.net';
    const port = config.INFO_PROCO_PORT ? Number(config.INFO_PROCO_PORT) : (config.EMAIL_PORT || 587);
    const isOutlook = host.includes('office365.com');
    const secure = port === 465;
    const transportOptions = {
      host,
      port,
      secure,
      auth: { user, pass: cleanPass },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
    };
    if (port === 587) {
      transportOptions.requireTLS = true;
      transportOptions.tls = { rejectUnauthorized: true };
    }
    if (port === 465) transportOptions.secure = true;
    console.log('📧 Order/quotation transporter:', isOutlook ? 'Outlook' : host, { host, port });
    return nodemailer.createTransport(transportOptions);
  }
  return createApprovalEmailTransporter();
};

// Send order approval notification to admin
// fromEmailOverride: optional; prefer Praco address (SALES_ORDER_FROM_EMAIL / INFO_PROCO_EMAIL) so From is always info@praco.co.uk
const sendOrderApprovalEmail = async (adminEmail, adminName, orderDetails, fromEmailOverride) => {
  let toEmail = (adminEmail || '').trim();
  if (!toEmail) toEmail = (process.env.ORDER_NOTIFY_EMAIL || '').trim();
  if (!toEmail) toEmail = PRACO_ORDER_TO;
  if (isPersonalGmail(toEmail)) toEmail = PRACO_ORDER_TO;
  let pracoFrom = (config.SALES_ORDER_FROM_EMAIL || config.INFO_PROCO_EMAIL || config.EMAIL_USER || process.env.INFO_PROCO_EMAIL || process.env.EMAIL_USER || '').trim();
  if (isPersonalGmail(pracoFrom)) pracoFrom = PRACO_ORDER_FROM;
  const fromEmail = pracoFrom || (fromEmailOverride && fromEmailOverride.trim()) || (config.EMAIL_USER || '');
  let fromEmailSafe = isPersonalGmail(fromEmail) ? PRACO_ORDER_FROM : (fromEmail || '').trim();
  if (!fromEmailSafe) fromEmailSafe = PRACO_ORDER_FROM;
  let mailOptions = null;
  console.log('📤 Sending order email → To:', toEmail, '| From:', fromEmailSafe);
  if (!fromEmailSafe) {
    console.error('❌ Order email skipped: SALES_ORDER_FROM_EMAIL / INFO_PROCO_EMAIL / EMAIL_USER not set.');
    return { success: false, error: 'No sender email configured' };
  }

  const {
    soNumber,
      orderDate,
      orderStatus,
      poNumber,
      customerName,
      contactPerson,
      emailAddress,
      phoneNumber,
      billingAddress,
      deliveryAddress,
      salesPerson,
      invoiceNumber,
      items = [],
      subtotal = 0,
      discount = 0,
      deliveryCharges = 0,
      vat = 0,
      vatRate = 20,
      grandTotal = 0,
      paymentMethod,
      amountPaid = 0,
      balanceRemaining = 0,
  } = orderDetails;
  const orderDateStr = orderDate
      ? new Date(orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const reportDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const shipToAddress = deliveryAddress && String(deliveryAddress).trim() ? deliveryAddress : billingAddress;

    const itemsRows = (Array.isArray(items) ? items : []).map(
      (item) => {
        const desc = [item.productName, item.spec].filter(Boolean).join(' | ') || '-';
        const vatLabel = `${vatRate || 20}.0% S`;
        return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px">${item.productCode || '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px">${desc}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center">${vatLabel}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center">${item.quantity || 0}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right">${Number(item.unitPrice || 0).toFixed(2)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right">${Number(item.lineTotal || 0).toFixed(2)}</td>
        </tr>`;
      }
    ).join('');

    // Company letterhead (Estimate-style: Praco Packaging Supplies Ltd.)
    const companyName = 'Praco Packaging Supplies Ltd.';
    const companyAddress = '15 Parker Drive\nLeicester\nLeicestershire\nLE4 0JP';
    const companyEmail = (config.ORDER_NOTIFY_EMAIL && config.ORDER_NOTIFY_EMAIL.trim()) ? config.ORDER_NOTIFY_EMAIL.trim() : 'accounts@praco.co.uk';
    const companyReg = 'Company Registration No. 15112621';

    mailOptions = {
      from: `"Praco Sales" <${fromEmailSafe}>`,
      to: toEmail,
      subject: `Praco Sales — Order ${soNumber} - ${customerName || 'Order'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 24px; background: #f9fafb; }
            .doc { max-width: 720px; margin: 0 auto; background: #fff; padding: 32px; }
            .head-row { width: 100%; margin-bottom: 16px; }
            .head-left { font-size: 13px; color: #374151; line-height: 1.6; }
            .head-left .company { font-weight: bold; font-size: 15px; color: #111; margin-bottom: 8px; }
            .head-mid { text-align: center; }
            .head-mid .order-label { font-size: 12px; color: #6b7280; margin-bottom: 2px; }
            .head-mid .order-num { font-size: 28px; font-weight: bold; color: #e85d04; }
            .head-right { text-align: right; }
            .head-right .logo { font-size: 26px; font-weight: bold; color: #e85d04; letter-spacing: 0.5px; }
            .head-right .tagline { font-size: 11px; color: #e85d04; margin-top: 2px; letter-spacing: 0.5px; text-transform: uppercase; }
            .divider { height: 1px; background: #d1d5db; margin: 16px 0 20px; }
            .col-addr { font-size: 13px; vertical-align: top; padding-right: 16px; }
            .col-addr .title { font-weight: bold; font-size: 11px; color: #374151; margin-bottom: 6px; letter-spacing: 0.5px; }
            .col-addr .lines { color: #374151; white-space: pre-line; }
            .box-date { display: inline-block; background: #ffedd5; color: #9a3412; padding: 12px 20px; border-radius: 4px; text-align: center; margin-bottom: 16px; }
            .box-date .label { font-size: 10px; letter-spacing: 0.5px; }
            .box-date .val { font-size: 14px; font-weight: bold; }
            .box-total { display: inline-block; background: #ea580c; color: #fff; padding: 14px 24px; border-radius: 4px; text-align: center; margin-top: 4px; }
            .box-total .label { font-size: 10px; letter-spacing: 0.5px; opacity: 0.95; }
            .box-total .val { font-size: 20px; font-weight: bold; }
            .box-date-total-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 16px; }
            .tbl { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
            .tbl th { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151; font-size: 12px; }
            .tbl th:nth-child(3), .tbl th:nth-child(4) { text-align: center; }
            .tbl th:nth-child(5), .tbl th:nth-child(6) { text-align: right; }
            .tbl td { border-bottom: 1px solid #e5e7eb; }
            .totals-wrap { text-align: right; margin-top: 24px; margin-bottom: 28px; }
            .totals-wrap .row { padding: 4px 0; font-size: 14px; }
            .totals-wrap .total-row { border-top: 2px solid #ea580c; margin-top: 10px; padding-top: 12px; }
            .totals-wrap .total-row .label { font-weight: bold; color: #ea580c; font-size: 16px; }
            .totals-wrap .total-row .val { font-weight: bold; color: #ea580c; font-size: 20px; }
            .thanks { font-size: 14px; font-weight: bold; color: #374151; margin-top: 12px; }
            .footer-row { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; }
            .footer-row .under { border-bottom: 1px solid #333; display: inline-block; min-width: 140px; padding-bottom: 2px; margin-left: 4px; }
          </style>
        </head>
        <body>
          <div class="doc">
            <table class="head-row" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="38%" class="head-left" style="vertical-align:top">
                <div class="company">${companyName}</div>
                <div style="white-space:pre-line">${companyAddress}</div>
                <div style="margin-top:6px">${companyEmail}</div>
                <div style="margin-top:4px;font-size:12px;color:#6b7280">${companyReg}</div>
              </td>
              <td width="24%" style="vertical-align:top" class="head-mid">
                <div class="order-label">Order</div>
                <div class="order-num">${soNumber || 'N/A'}</div>
              </td>
              <td width="38%" style="vertical-align:top" class="head-right">
                <div class="logo">PRACO</div>
                <div class="tagline">Packaging Supplies</div>
              </td>
            </tr></table>
            <div class="divider"></div>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>
              <td width="30%" class="col-addr">
                <div class="title">ADDRESS</div>
                <div class="lines">${customerName || ''}\n${(billingAddress || 'N/A').replace(/\n/g, '\n')}</div>
              </td>
              <td width="30%" class="col-addr">
                <div class="title">SHIP TO</div>
                <div class="lines">${customerName || ''}\n${(shipToAddress || 'Same as address').replace(/\n/g, '\n')}</div>
              </td>
              <td width="40%" style="vertical-align:top;text-align:right">
                <div class="box-date-total-wrap">
                  <span class="box-date"><div class="label">DATE</div><div class="val">${orderDateStr}</div></span>
                  <div style="height:12px;"></div>
                  <span class="box-total"><div class="label">TOTAL</div><div class="val">£${Number(grandTotal).toFixed(2)}</div></span>
                </div>
              </td>
            </tr></table>

            <table class="tbl">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>DESCRIPTION</th>
                  <th>VAT</th>
                  <th>QTY</th>
                  <th>RATE</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>${itemsRows || '<tr><td colspan="6" style="text-align:center;padding:24px">No items</td></tr>'}</tbody>
            </table>

            <div class="totals-wrap">
              <div class="row">SUBTOTAL &nbsp; ${Number(subtotal).toFixed(2)}</div>
              ${discount ? `<div class="row">Discount &nbsp; -${Number(discount).toFixed(2)}</div>` : ''}
              ${deliveryCharges ? `<div class="row">Delivery &nbsp; ${Number(deliveryCharges).toFixed(2)}</div>` : ''}
              <div class="row">VAT TOTAL &nbsp; ${Number(vat).toFixed(2)}</div>
              <div class="total-row">
                <span class="label">TOTAL</span> <span class="val">£${Number(grandTotal).toFixed(2)}</span>
              </div>
              <div class="thanks">THANK YOU.</div>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" class="footer-row"><tr>
              <td width="50%">Accepted By <span class="under">&nbsp;</span></td>
              <td width="50%" style="text-align:right">Accepted Date <span class="under">&nbsp;</span></td>
            </tr></table>
          </div>
        </body>
        </html>
      `,
      text: `
${companyName} — Order ${soNumber || 'N/A'}

Order Information
SO Number: ${soNumber || 'N/A'}
Order Date: ${orderDateStr}
Order Status: ${orderStatus || 'N/A'}
PO Number: ${poNumber || 'Not Provided'}
${invoiceNumber ? `Invoice Number: ${invoiceNumber}\n` : ''}

Sales Representative
Name: ${salesPerson?.name || 'N/A'}
Email: ${salesPerson?.email || 'N/A'}

Customer Information
Company/Name: ${customerName || 'N/A'}
Contact: ${contactPerson || 'N/A'}
Email: ${emailAddress || 'N/A'}
Phone: ${phoneNumber || 'N/A'}
Address: ${billingAddress || 'N/A'}

Line Items: (see HTML report for table)
Financial Summary
Subtotal: £${Number(subtotal).toFixed(2)}
VAT TOTAL: £${Number(vat).toFixed(2)}
TOTAL: £${Number(grandTotal).toFixed(2)}

Payment
Method: ${paymentMethod || 'N/A'}
Amount Paid: £${Number(amountPaid).toFixed(2)}
Balance: £${Number(balanceRemaining).toFixed(2)}

THANK YOU.

—
${companyName}
© ${new Date().getFullYear()} ${companyName}. All rights reserved.
      `,
  };

  // Resend se bhejo — SMTP/GoDaddy/2FA ki zaroorat nahi, sirf API key
  if (config.RESEND_API_KEY && Resend) {
    try {
      const resend = new Resend(config.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      });
      if (error) {
        console.error('❌ Resend error:', error.message);
        return { success: false, error: error.message };
      }
      console.log('✅ Order email sent via Resend → To:', toEmail, '| Id:', data?.id);
      return { success: true, messageId: data?.id };
    } catch (err) {
      console.error('❌ Resend failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  try {
    const transporter = getOrderEmailTransporter(fromEmailSafe);
    await transporter.verify();
    console.log('✅ Order email: SMTP verified');
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Order email received by server → To: ${toEmail}, MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const canFallback = config.EMAIL_USER && config.EMAIL_PASS && fromEmailSafe && mailOptions;
    if (canFallback && (error.code === 'EAUTH' || error.code === 'ESOCKET' || String(error.message || '').includes('535'))) {
      console.warn('⚠️ Order email SMTP failed:', error.message, '— Retrying with EMAIL_USER/EMAIL_PASS...');
      try {
        const fallbackTransporter = createApprovalEmailTransporter();
        let fallbackFrom = (config.EMAIL_USER || '').trim();
        if (isPersonalGmail(fallbackFrom)) fallbackFrom = PRACO_ORDER_FROM;
        const fallbackOptions = { ...mailOptions, from: `"Praco Sales" <${fallbackFrom}>` };
        const info = await fallbackTransporter.sendMail(fallbackOptions);
        console.log(`✅ Order email sent via fallback → To: ${toEmail}, From: ${fallbackFrom}`);
        return { success: true, messageId: info.messageId };
      } catch (fallbackErr) {
        console.error('❌ Fallback also failed:', fallbackErr.message);
        return { success: false, error: fallbackErr.message };
      }
    }
    console.error('❌ Order approval email failed:', error.message);
    console.error('   To:', toEmail, '| From:', fromEmailSafe);
    if (error.code === 'EAUTH') {
      console.error('   Fix: Set INFO_PROCO_EMAIL + INFO_PROCO_PASS (or EMAIL_USER + EMAIL_PASS) in backend/.env; for GoDaddy use correct password.');
    }
    return { success: false, error: error.message };
  }
};

// Quotation mail options builder — Resend aur SMTP dono use karte hain
function buildQuotationMailOptions(fromEmail, toEmail, quotationDetails) {
  const {
    quotationNumber = '',
    customerName = '',
    billingAddress = '',
    deliveryAddress = '',
    total = 0,
    subtotal = 0,
    tax = 0,
    validUntil = '',
    items = [],
    notes = '',
  } = quotationDetails;
  const validUntilStr = validUntil
    ? new Date(validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'N/A';
  const companyName = 'Praco Packaging Supplies Ltd.';
  const companyAddress = '15 Parker Drive\nLeicester\nLeicestershire\nLE4 0JP';
  const companyEmail = (config.ORDER_NOTIFY_EMAIL && config.ORDER_NOTIFY_EMAIL.trim()) ? config.ORDER_NOTIFY_EMAIL.trim() : 'accounts@praco.co.uk';
  const companyReg = 'Company Registration No. 15112621';
  const shipToAddr = (deliveryAddress && String(deliveryAddress).trim()) ? deliveryAddress : billingAddress;
  const itemsRows = (Array.isArray(items) ? items : []).map(
    (item) => {
      const desc = item.productName || item.productCode || '-';
      return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px">${item.productCode || '-'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px">${desc}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center">20.0% S</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center">${item.quantity || 0}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right">${Number(item.price || 0).toFixed(2)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right">${Number(item.total || 0).toFixed(2)}</td>
      </tr>`;
    }
  ).join('');
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 24px; background: #f9fafb; }
        .doc { max-width: 720px; margin: 0 auto; background: #fff; padding: 32px; }
        .head-row { width: 100%; margin-bottom: 16px; }
        .head-left { font-size: 13px; color: #374151; line-height: 1.6; }
        .head-left .company { font-weight: bold; font-size: 15px; color: #111; margin-bottom: 8px; }
        .head-mid { text-align: center; }
        .head-mid .order-label { font-size: 12px; color: #6b7280; margin-bottom: 2px; }
        .head-mid .order-num { font-size: 28px; font-weight: bold; color: #e85d04; }
        .head-right { text-align: right; }
        .head-right .logo { font-size: 26px; font-weight: bold; color: #e85d04; letter-spacing: 0.5px; }
        .head-right .tagline { font-size: 11px; color: #e85d04; margin-top: 2px; letter-spacing: 0.5px; text-transform: uppercase; }
        .divider { height: 1px; background: #d1d5db; margin: 16px 0 20px; }
        .col-addr { font-size: 13px; vertical-align: top; padding-right: 16px; }
        .col-addr .title { font-weight: bold; font-size: 11px; color: #374151; margin-bottom: 6px; letter-spacing: 0.5px; }
        .col-addr .lines { color: #374151; white-space: pre-line; }
        .box-date { display: inline-block; background: #ffedd5; color: #9a3412; padding: 12px 20px; border-radius: 4px; text-align: center; margin-bottom: 16px; }
        .box-date .label { font-size: 10px; letter-spacing: 0.5px; }
        .box-date .val { font-size: 14px; font-weight: bold; }
        .box-total { display: inline-block; background: #ea580c; color: #fff; padding: 14px 24px; border-radius: 4px; text-align: center; margin-top: 4px; }
        .box-total .label { font-size: 10px; letter-spacing: 0.5px; opacity: 0.95; }
        .box-total .val { font-size: 20px; font-weight: bold; }
        .box-date-total-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 16px; }
        .tbl { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
        .tbl th { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151; font-size: 12px; }
        .tbl th:nth-child(3), .tbl th:nth-child(4) { text-align: center; }
        .tbl th:nth-child(5), .tbl th:nth-child(6) { text-align: right; }
        .tbl td { border-bottom: 1px solid #e5e7eb; }
        .totals-wrap { text-align: right; margin-top: 24px; margin-bottom: 28px; }
        .totals-wrap .row { padding: 4px 0; font-size: 14px; }
        .totals-wrap .total-row { border-top: 2px solid #ea580c; margin-top: 10px; padding-top: 12px; }
        .totals-wrap .total-row .label { font-weight: bold; color: #ea580c; font-size: 16px; }
        .totals-wrap .total-row .val { font-weight: bold; color: #ea580c; font-size: 20px; }
        .thanks { font-size: 14px; font-weight: bold; color: #374151; margin-top: 12px; }
        .footer-row { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; }
        .footer-row .under { border-bottom: 1px solid #333; display: inline-block; min-width: 140px; padding-bottom: 2px; margin-left: 4px; }
      </style>
    </head>
    <body>
      <div class="doc">
        <table class="head-row" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="38%" class="head-left" style="vertical-align:top">
            <div class="company">${companyName}</div>
            <div style="white-space:pre-line">${companyAddress}</div>
            <div style="margin-top:6px">${companyEmail}</div>
            <div style="margin-top:4px;font-size:12px;color:#6b7280">${companyReg}</div>
          </td>
          <td width="24%" style="vertical-align:top" class="head-mid">
            <div class="order-label">Quotation</div>
            <div class="order-num">${quotationNumber || 'N/A'}</div>
          </td>
          <td width="38%" style="vertical-align:top" class="head-right">
            <div class="logo">PRACO</div>
            <div class="tagline">Packaging Supplies</div>
          </td>
        </tr></table>
        <div class="divider"></div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>
          <td width="30%" class="col-addr">
            <div class="title">ADDRESS</div>
            <div class="lines">${customerName || ''}\n${(billingAddress || '—').replace(/\n/g, '\n')}</div>
          </td>
          <td width="30%" class="col-addr">
            <div class="title">SHIP TO</div>
            <div class="lines">${customerName || ''}\n${(shipToAddr || '—').replace(/\n/g, '\n')}</div>
          </td>
          <td width="40%" style="vertical-align:top;text-align:right">
            <div class="box-date-total-wrap">
              <span class="box-date"><div class="label">VALID UNTIL</div><div class="val">${validUntilStr}</div></span>
              <div style="height:12px;"></div>
              <span class="box-total"><div class="label">TOTAL</div><div class="val">£${Number(total).toFixed(2)}</div></span>
            </div>
          </td>
        </tr></table>

        <table class="tbl">
          <thead>
            <tr>
              <th>SKU</th>
              <th>DESCRIPTION</th>
              <th>VAT</th>
              <th>QTY</th>
              <th>RATE</th>
              <th>AMOUNT</th>
            </tr>
          </thead>
          <tbody>${itemsRows || '<tr><td colspan="6" style="text-align:center;padding:24px">No items</td></tr>'}</tbody>
        </table>

        <div class="totals-wrap">
          <div class="row">SUBTOTAL &nbsp; ${Number(subtotal || total).toFixed(2)}</div>
          ${Number(tax || 0) > 0 ? `<div class="row">VAT TOTAL &nbsp; ${Number(tax).toFixed(2)}</div>` : ''}
          <div class="total-row">
            <span class="label">TOTAL</span> <span class="val">£${Number(total).toFixed(2)}</span>
          </div>
          ${notes ? `<p style="text-align:left;margin-top:12px;font-size:13px;color:#6b7280"><strong>Notes:</strong> ${notes}</p>` : ''}
          <div class="thanks">THANK YOU.</div>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" class="footer-row"><tr>
          <td width="50%">Accepted By <span class="under">&nbsp;</span></td>
          <td width="50%" style="text-align:right">Accepted Date <span class="under">&nbsp;</span></td>
        </tr></table>
      </div>
    </body>
    </html>`;
  return {
    from: `"Praco Sales" <${fromEmail}>`,
    to: toEmail,
    subject: `Praco Sales — Quotation ${quotationNumber} – ${customerName || 'Quote'}`,
    html,
  };
}

// Send quotation — same mail path as sales order: same From, same getOrderEmailTransporter (so if order works, quotation works).
// Deployment: kabhi bhi talhaabid400 se mat bhejo — hamesha info@praco.co.uk
const sendQuotationEmail = async (toEmail, quotationDetails, fromEmail = null, fromName = '') => {
  let pracoFrom = (config.SALES_ORDER_FROM_EMAIL || config.INFO_PROCO_EMAIL || config.EMAIL_USER || process.env.SALES_ORDER_FROM_EMAIL || process.env.INFO_PROCO_EMAIL || process.env.EMAIL_USER || '').trim();
  if (isPersonalGmail(pracoFrom) || !pracoFrom) pracoFrom = PRACO_ORDER_FROM;
  if (!pracoFrom) {
    console.warn('Quotation email: Set SALES_ORDER_FROM_EMAIL or INFO_PROCO_EMAIL or EMAIL_USER in .env');
    return { success: false, message: 'Email not configured. Set same as sales order (SALES_ORDER_FROM_EMAIL / INFO_PROCO_EMAIL).' };
  }
  console.log('📤 Sending quotation email → To:', toEmail, '| From:', pracoFrom, '(same as sales order)');

  const mailOpts = buildQuotationMailOptions(pracoFrom, toEmail, quotationDetails);

  // Resend se bhejo — SMTP/2FA ki zaroorat nahi
  if (config.RESEND_API_KEY && Resend) {
    try {
      const resend = new Resend(config.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: mailOpts.from,
        to: mailOpts.to,
        subject: mailOpts.subject,
        html: mailOpts.html,
      });
      if (error) {
        console.error('❌ Resend quotation error:', error.message);
        return { success: false, error: error.message };
      }
      console.log('✅ Quotation email sent via Resend → To:', toEmail, '| Id:', data?.id);
      return { success: true, messageId: data?.id };
    } catch (err) {
      console.error('❌ Resend quotation failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  try {
    const transporter = getOrderEmailTransporter(pracoFrom);
    try {
      await transporter.verify();
      console.log('✅ Quotation email: SMTP verified');
    } catch (verifyErr) {
      console.warn('⚠️ Quotation SMTP verify failed:', verifyErr.message);
    }
    const result = await sendQuotationEmailWithTransporter(transporter, pracoFrom, toEmail, quotationDetails);
    return result;
  } catch (error) {
    const isAuthError = error.code === 'EAUTH' || (error.message && String(error.message).includes('535'));
    if (isAuthError && config.EMAIL_USER && config.EMAIL_PASS) {
      console.warn('⚠️ Praco SMTP login failed (535). Retrying with EMAIL_USER/EMAIL_PASS...');
      try {
        const fallbackTransporter = createApprovalEmailTransporter();
        let fallbackFrom = (config.EMAIL_USER || '').trim();
        if (isPersonalGmail(fallbackFrom)) fallbackFrom = PRACO_ORDER_FROM;
        const result = await sendQuotationEmailWithTransporter(fallbackTransporter, fallbackFrom, toEmail, quotationDetails);
        console.log('✅ Quotation email sent via fallback → To:', toEmail, '| From:', fallbackFrom);
        return result;
      } catch (fallbackErr) {
        console.error('❌ Quotation fallback also failed:', fallbackErr.message);
        return { success: false, error: fallbackErr.message };
      }
    }
    console.error('Error sending quotation email:', error.message);
    return { success: false, error: error.message };
  }
};

function sendQuotationEmailWithTransporter(transporter, fromEmail, toEmail, quotationDetails) {
  const mailOptions = buildQuotationMailOptions(fromEmail, toEmail, quotationDetails);
  return transporter.sendMail(mailOptions).then((info) => ({ success: true, messageId: info.messageId }));
}

module.exports = {
  sendPasswordSetupEmail,
  sendOTPEmail,
  sendOrderApprovalEmail,
  sendQuotationEmail,
};

