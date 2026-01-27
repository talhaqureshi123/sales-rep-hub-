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
      from: `"Sales Rap Hub" <${config.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Sales Rap Hub - Set Your Password',
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
              <h1>Welcome to Sales Rap Hub!</h1>
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
              <p>© ${new Date().getFullYear()} Sales Rap Hub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Sales Rap Hub!
        
        Hello ${name},
        
        Your account has been created by the administrator. To get started, please set your password by visiting:
        
        ${setupUrl}
        
        Note: This link will expire in 24 hours for security reasons.
        
        If you did not expect this email, please ignore it.
        
        © ${new Date().getFullYear()} Sales Rap Hub. All rights reserved.
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
      from: `"Sales Rap Hub" <${config.EMAIL_USER}>`,
      to: email,
      subject: 'Sales Rap Hub - Password Setup OTP',
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
              <p>You are setting up your password for Sales Rap Hub. Please use the OTP below to verify your email:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #666; font-size: 14px;">Your OTP Code</p>
                <div class="otp-code">${otp}</div>
              </div>
              
              <p><strong>Note:</strong> This OTP will expire in 10 minutes for security reasons.</p>
              
              <p>If you did not request this OTP, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Sales Rap Hub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Setup Verification
        
        Hello ${name},
        
        You are setting up your password for Sales Rap Hub. Please use the OTP below to verify your email:
        
        OTP: ${otp}
        
        Note: This OTP will expire in 10 minutes for security reasons.
        
        If you did not request this OTP, please ignore this email.
        
        © ${new Date().getFullYear()} Sales Rap Hub. All rights reserved.
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

// Send order approval notification to admin
const sendOrderApprovalEmail = async (adminEmail, adminName, orderDetails) => {
  try {
    // Only send email if email is configured
    if (!config.EMAIL_USER || !config.EMAIL_PASS) {
      console.warn('⚠️ Email not configured. Skipping order approval email.');
      return { success: false, message: 'Email not configured' };
    }

    const transporter = createTransporter();
    const { soNumber, customerName, grandTotal, salesPerson, invoiceNumber } = orderDetails;

    const mailOptions = {
      from: `"Sales Rap Hub" <${config.EMAIL_USER}>`,
      to: adminEmail,
      subject: `Sales Order Approved: ${soNumber}`,
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
            .order-details {
              background-color: #f0f0f0;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #ddd;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: bold;
              color: #666;
            }
            .detail-value {
              color: #333;
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
              <h1>Sales Order Approved</h1>
            </div>
            <div class="content">
              <p>Hello ${adminName},</p>
              <p>A sales order has been approved and confirmed:</p>
              
              <div class="order-details">
                <div class="detail-row">
                  <span class="detail-label">Order Number:</span>
                  <span class="detail-value">${soNumber || 'N/A'}</span>
                </div>
                ${invoiceNumber ? `
                <div class="detail-row">
                  <span class="detail-label">Invoice Number:</span>
                  <span class="detail-value">${invoiceNumber}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Customer:</span>
                  <span class="detail-value">${customerName || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Sales Person:</span>
                  <span class="detail-value">${salesPerson?.name || salesPerson?.email || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Total Amount:</span>
                  <span class="detail-value">£${(grandTotal || 0).toFixed(2)}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Approved Date:</span>
                  <span class="detail-value">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
              
              <p>The order has been added to the salesman's monthly sales targets.</p>
              
              <p>You can view the order details in the admin dashboard.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Sales Rap Hub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Sales Order Approved
        
        Hello ${adminName},
        
        A sales order has been approved and confirmed:
        
        Order Number: ${soNumber || 'N/A'}
        ${invoiceNumber ? `Invoice Number: ${invoiceNumber}\n` : ''}Customer: ${customerName || 'N/A'}
        Sales Person: ${salesPerson?.name || salesPerson?.email || 'N/A'}
        Total Amount: £${(grandTotal || 0).toFixed(2)}
        Approved Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        
        The order has been added to the salesman's monthly sales targets.
        
        You can view the order details in the admin dashboard.
        
        © ${new Date().getFullYear()} Sales Rap Hub. All rights reserved.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Order approval email sent to admin: ${adminEmail}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending order approval email:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPasswordSetupEmail,
  sendOTPEmail,
  sendOrderApprovalEmail,
};

