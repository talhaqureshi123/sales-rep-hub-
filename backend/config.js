const path = require("path");
const fs = require("fs");

// Load .env from backend root.
const envPath = path.join(__dirname, ".env");
require("dotenv").config({
  path: envPath,
});

const normalizeSecret = (value) => {
  if (!value) return "";
  // Remove surrounding quotes, trim whitespace, and strip accidental newlines
  return String(value)
    .trim()
    .replace(/^[\"']|[\"']$/g, "")
    .replace(/[\r\n]+/g, "");
};

module.exports = {
  PORT: process.env.PORT || 4000,
  // Use local MongoDB when USE_LOCAL_MONGO=1 (e.g. when Atlas is unreachable)
  MONGODB_URI:
    process.env.USE_LOCAL_MONGO === "1" || process.env.USE_LOCAL_MONGO === "true"
      ? (process.env.MONGODB_URI_LOCAL || "mongodb://localhost:27017/salesraphub")
      : (process.env.MONGODB_URI ||
          "mongodb+srv://talhaabid400:1234567890@cluster0.oaruawd.mongodb.net/salesraphub"),
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
  NODE_ENV: process.env.NODE_ENV || "development",
  // Email Configuration (e.g. GoDaddy: smtpout.secureserver.net, port 465 or 587)
  EMAIL_HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
  EMAIL_PORT: Number(process.env.EMAIL_PORT) || 587,
  EMAIL_SECURE: process.env.EMAIL_SECURE === "true" || process.env.EMAIL_SECURE === "1",
  EMAIL_USER: process.env.EMAIL_USER || "",
  EMAIL_PASS: process.env.EMAIL_PASS || "",
  // Sender for order/quotation — set in .env (e.g. INFO_PROCO_EMAIL, INFO_PROCO_PASS, INFO_PROCO_HOST, INFO_PROCO_PORT)
  INFO_PROCO_EMAIL: normalizeSecret(process.env.INFO_PROCO_EMAIL) || "",
  INFO_PROCO_PASS: normalizeSecret(process.env.INFO_PROCO_PASS) || "",
  INFO_PROCO_HOST: (process.env.INFO_PROCO_HOST || "").trim(),
  INFO_PROCO_PORT: (process.env.INFO_PROCO_PORT || "").trim(),
  // Order notification receiver — set ORDER_NOTIFY_EMAIL in .env
  ORDER_NOTIFY_EMAIL: normalizeSecret(process.env.ORDER_NOTIFY_EMAIL) || "",
  // Order/quotation "From" address — set SALES_ORDER_FROM_EMAIL in .env (uses INFO_PROCO_* for SMTP)
  SALES_ORDER_FROM_EMAIL: normalizeSecret(process.env.SALES_ORDER_FROM_EMAIL) || normalizeSecret(process.env.INFO_PROCO_EMAIL) || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "https://salesrephub.iotfiysolutions.com",
  // HubSpot Configuration
  // Prefer HUBSPOT_TOKEN (custom name), then HUBSPOT_ACCESS_TOKEN, then HUBSPOT_API_KEY (legacy)
  HUBSPOT_TOKEN: normalizeSecret(process.env.HUBSPOT_TOKEN),
  HUBSPOT_API_KEY: normalizeSecret(
    process.env.HUBSPOT_API_KEY ||
      process.env.HUBSPOT_TOKEN ||
      process.env.HUBSPOT_ACCESS_TOKEN
  ),
  HUBSPOT_ACCESS_TOKEN: normalizeSecret(
    process.env.HUBSPOT_ACCESS_TOKEN ||
      process.env.HUBSPOT_TOKEN ||
      process.env.HUBSPOT_API_KEY
  ),
  // Auth mode: 'token' (default) or 'oauth'
  HUBSPOT_AUTH_MODE: (process.env.HUBSPOT_AUTH_MODE || "token").toLowerCase(),
  // OAuth config (required if HUBSPOT_AUTH_MODE='oauth')
  HUBSPOT_OAUTH_CLIENT_ID: normalizeSecret(process.env.HUBSPOT_OAUTH_CLIENT_ID),
  HUBSPOT_OAUTH_CLIENT_SECRET: normalizeSecret(
    process.env.HUBSPOT_OAUTH_CLIENT_SECRET
  ),
  HUBSPOT_OAUTH_REDIRECT_URI:
    normalizeSecret(process.env.HUBSPOT_OAUTH_REDIRECT_URI) ||
    "http://localhost:4000/api/hubspot/callback",
  HUBSPOT_OAUTH_SCOPES: normalizeSecret(process.env.HUBSPOT_OAUTH_SCOPES),
  HUBSPOT_ENABLED: process.env.HUBSPOT_ENABLED === "true" || false,
};

