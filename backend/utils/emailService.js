const nodemailer = require('nodemailer');
const config = require('../config');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // For Gmail, you need to use an App Password instead of regular password
  // Enable 2FA and generate App Password from Google Account settings
  
  // Remove spaces from App Password (Gmail App Passwords sometimes have spaces)
  const cleanPassword = config.EMAIL_PASS ? config.EMAIL_PASS.replace(/\s/g, '') : '';
  
  return nodemailer.createTransport({
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: config.EMAIL_USER,
      pass: cleanPassword,
    },
    // Add debug option for troubleshooting
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development',
  });
};

// Send password setup email to salesman
const sendPasswordSetupEmail = async (email, name, token) => {
  try {
    // Only send email if email is configured
    if (!config.EMAIL_USER || !config.EMAIL_PASS) {
      console.warn('⚠️ Email not configured. Skipping email send.');
      console.warn('📧 EMAIL_USER:', config.EMAIL_USER || 'NOT SET');
      console.warn('🔑 EMAIL_PASS:', config.EMAIL_PASS ? 'SET' : 'NOT SET');
      console.log('🔗 Password setup link:', `${config.FRONTEND_URL}/setup-password?token=${token}`);
      return { success: false, message: 'Email not configured. Please set EMAIL_USER and EMAIL_PASS in .env file', link: `${config.FRONTEND_URL}/setup-password?token=${token}` };
    }

    const transporter = createTransporter();

    const setupUrl = `${config.FRONTEND_URL}/setup-password?token=${token}`;

    const mailOptions = {
      from: `"Sales Rep Hub" <${config.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Sales Rep Hub - Set Your Password',
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
              <h1>Welcome to Sales Rep Hub!</h1>
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
              <p>© ${new Date().getFullYear()} Sales Rep Hub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Sales Rep Hub!
        
        Hello ${name},
        
        Your account has been created by the administrator. To get started, please set your password by visiting:
        
        ${setupUrl}
        
        Note: This link will expire in 24 hours for security reasons.
        
        If you did not expect this email, please ignore it.
        
        © ${new Date().getFullYear()} Sales Rep Hub. All rights reserved.
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
    // Only send email if email is configured
    if (!config.EMAIL_USER || !config.EMAIL_PASS) {
      console.warn('Email not configured. Skipping OTP email send.');
      console.log('OTP for', email, ':', otp);
      return { success: true, message: 'Email not configured, but OTP generated' };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: `"Sales Rep Hub" <${config.EMAIL_USER}>`,
      to: email,
      subject: 'Sales Rep Hub - Password Setup OTP',
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
              <p>You are setting up your password for Sales Rep Hub. Please use the OTP below to verify your email:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #666; font-size: 14px;">Your OTP Code</p>
                <div class="otp-code">${otp}</div>
              </div>
              
              <p><strong>Note:</strong> This OTP will expire in 10 minutes for security reasons.</p>
              
              <p>If you did not request this OTP, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Sales Rep Hub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Setup Verification
        
        Hello ${name},
        
        You are setting up your password for Sales Rep Hub. Please use the OTP below to verify your email:
        
        OTP: ${otp}
        
        Note: This OTP will expire in 10 minutes for security reasons.
        
        If you did not request this OTP, please ignore this email.
        
        © ${new Date().getFullYear()} Sales Rep Hub. All rights reserved.
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

// Create transporter for order approval emails - uses .env (EMAIL_USER, EMAIL_PASS) if set, else fallback
const createApprovalEmailTransporter = () => {
  // Use .env first (user can set EMAIL_USER and EMAIL_PASS in backend/.env)
  const APPROVAL_EMAIL_USER = config.EMAIL_USER || 'talhaabid400@gmail.com';
  const APPROVAL_EMAIL_PASS = config.EMAIL_PASS || 'your-app-password-here';
  const cleanPass = (APPROVAL_EMAIL_PASS || '').replace(/\s/g, '');
  
  return nodemailer.createTransport({
    host: config.EMAIL_HOST || 'smtp.gmail.com',
    port: config.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: APPROVAL_EMAIL_USER,
      pass: cleanPass,
    },
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development',
  });
};

// Send order approval notification to admin
const sendOrderApprovalEmail = async (adminEmail, adminName, orderDetails) => {
  try {
    const transporter = createApprovalEmailTransporter();
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
    const fromEmail = config.EMAIL_USER || 'talhaabid400@gmail.com';

    const orderDateStr = orderDate
      ? new Date(orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const reportDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const itemsRows = (Array.isArray(items) ? items : []).map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd">${item.productCode || '-'}</td>
          <td style="padding:8px;border:1px solid #ddd">${item.productName || '-'}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.quantity || 0}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">£${Number(item.unitPrice || 0).toFixed(2)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">£${Number(item.lineTotal || 0).toFixed(2)}</td>
        </tr>`
    ).join('');

    const mailOptions = {
      from: `"Sales Rep Hub" <${fromEmail}>`,
      to: adminEmail,
      subject: `Sales Order Report: ${soNumber} - ${customerName || 'Order'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 680px; margin: 0 auto; background: #fff; }
            .brand-header {
              background: linear-gradient(135deg, #e9931c 0%, #d8820a 100%);
              color: white;
              padding: 24px;
              text-align: center;
              font-size: 22px;
              font-weight: bold;
              letter-spacing: 0.5px;
            }
            .report-title { font-size: 18px; color: #333; margin: 24px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e9931c; }
            .section { margin: 20px 0; }
            .section table { width: 100%; border-collapse: collapse; font-size: 14px; }
            .section th { background: #f5f5f5; padding: 10px; text-align: left; border: 1px solid #ddd; }
            .section td { padding: 8px; border: 1px solid #ddd; }
            .section .label { font-weight: bold; color: #555; width: 140px; }
            .totals { margin-top: 16px; text-align: right; }
            .totals .row { padding: 6px 0; }
            .totals .grand { font-size: 16px; font-weight: bold; color: #e9931c; margin-top: 8px; padding-top: 8px; border-top: 2px solid #ddd; }
            .signature {
              margin-top: 32px;
              padding-top: 24px;
              border-top: 1px solid #eee;
              font-size: 13px;
              color: #555;
            }
            .signature .company { font-weight: bold; color: #e9931c; font-size: 15px; margin-bottom: 4px; }
            .footer { text-align: center; margin-top: 24px; padding: 16px; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="brand-header">SALES REP HUB</div>
            <div style="padding: 24px;">
              <div class="report-title">Sales Order Report</div>
              <p style="margin:0 0 20px; color:#666;">Formal sales order notification. Report date: ${reportDateStr}.</p>

              <div class="section">
                <div class="report-title" style="font-size:16px; margin-top:20px;">Order Information</div>
                <table class="section">
                  <tr><td class="label">SO Number</td><td>${soNumber || 'N/A'}</td></tr>
                  <tr><td class="label">Order Date</td><td>${orderDateStr}</td></tr>
                  <tr><td class="label">Order Status</td><td>${orderStatus || 'N/A'}</td></tr>
                  <tr><td class="label">PO Number</td><td>${poNumber || 'Not Provided'}</td></tr>
                  ${invoiceNumber ? `<tr><td class="label">Invoice Number</td><td>${invoiceNumber}</td></tr>` : ''}
                </table>
              </div>

              <div class="section">
                <div class="report-title" style="font-size:16px;">Sales Representative</div>
                <table class="section">
                  <tr><td class="label">Name</td><td>${salesPerson?.name || 'N/A'}</td></tr>
                  <tr><td class="label">Email</td><td>${salesPerson?.email || 'N/A'}</td></tr>
                </table>
              </div>

              <div class="section">
                <div class="report-title" style="font-size:16px;">Customer Information</div>
                <table class="section">
                  <tr><td class="label">Company / Name</td><td>${customerName || 'N/A'}</td></tr>
                  <tr><td class="label">Contact Person</td><td>${contactPerson || 'N/A'}</td></tr>
                  <tr><td class="label">Email</td><td>${emailAddress || 'N/A'}</td></tr>
                  <tr><td class="label">Phone</td><td>${phoneNumber || 'N/A'}</td></tr>
                  <tr><td class="label">Address</td><td>${billingAddress || 'N/A'}</td></tr>
                </table>
              </div>

              <div class="section">
                <div class="report-title" style="font-size:16px;">Line Items</div>
                <table class="section">
                  <thead>
                    <tr>
                      <th style="text-align:left">Product Code</th>
                      <th style="text-align:left">Product Name</th>
                      <th style="text-align:center">Quantity</th>
                      <th style="text-align:right">Unit Price</th>
                      <th style="text-align:right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>${itemsRows || '<tr><td colspan="5" style="text-align:center;padding:16px">No items</td></tr>'}</tbody>
                </table>
              </div>

              <div class="section">
                <div class="report-title" style="font-size:16px;">Financial Summary</div>
                <div class="totals">
                  <div class="row">Subtotal: £${Number(subtotal).toFixed(2)}</div>
                  ${discount ? `<div class="row">Discount: -£${Number(discount).toFixed(2)}</div>` : ''}
                  ${deliveryCharges ? `<div class="row">Delivery: £${Number(deliveryCharges).toFixed(2)}</div>` : ''}
                  <div class="row">VAT (${vatRate}%): £${Number(vat).toFixed(2)}</div>
                  <div class="row grand">Total: £${Number(grandTotal).toFixed(2)}</div>
                </div>
              </div>

              <div class="section">
                <div class="report-title" style="font-size:16px;">Payment Details</div>
                <table class="section">
                  <tr><td class="label">Payment Method</td><td>${paymentMethod || 'N/A'}</td></tr>
                  <tr><td class="label">Amount Paid</td><td>£${Number(amountPaid).toFixed(2)}</td></tr>
                  <tr><td class="label">Balance Remaining</td><td>£${Number(balanceRemaining).toFixed(2)}</td></tr>
                </table>
              </div>

              <div class="signature">
                <div class="company">Sales Rep Hub</div>
                <div>This is an automated sales order report. For support, please use the admin dashboard.</div>
                <div style="margin-top:8px;">© ${new Date().getFullYear()} Sales Rep Hub. All rights reserved.</div>
              </div>
            </div>
            <div class="footer">Sales Order Report — Sales Rep Hub</div>
          </div>
        </body>
        </html>
      `,
      text: `
Sales Rep Hub — Sales Order Report

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
VAT: £${Number(vat).toFixed(2)}
Total: £${Number(grandTotal).toFixed(2)}

Payment
Method: ${paymentMethod || 'N/A'}
Amount Paid: £${Number(amountPaid).toFixed(2)}
Balance: £${Number(balanceRemaining).toFixed(2)}

—
Sales Rep Hub
© ${new Date().getFullYear()} Sales Rep Hub. All rights reserved.
      `,
    };

    // Verify transporter before sending
    try {
      await transporter.verify();
      console.log('✅ Approval email transporter verified successfully');
    } catch (verifyError) {
      console.error('❌ Email transporter verification failed:', verifyError.message);
      if (verifyError.code === 'EAUTH') {
        console.error('🔐 Authentication failed. Please update APPROVAL_EMAIL_PASS in emailService.js with correct Gmail App Password');
      }
      throw verifyError;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Order approval email sent to admin: ${adminEmail}`);
    console.log('📧 Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending order approval email:', error.message);
    if (error.code === 'EAUTH') {
      console.error('🔐 Authentication failed. Please update APPROVAL_EMAIL_PASS in emailService.js');
      console.error('💡 For Gmail: Enable 2FA and generate App Password from Google Account settings');
    }
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordSetupEmail,
  sendOTPEmail,
  sendOrderApprovalEmail,
};

