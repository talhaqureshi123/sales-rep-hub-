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
  PORT: process.env.PORT || 5000,
  MONGODB_URI:
    process.env.MONGODB_URI ||
    "mongodb+srv://talhaabid400:1234567890@cluster0.oaruawd.mongodb.net/salesraphub",
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
  NODE_ENV: process.env.NODE_ENV || "development",
  // Email Configuration
  EMAIL_HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
  EMAIL_PORT: process.env.EMAIL_PORT || 587,
  EMAIL_USER: process.env.EMAIL_USER || "",
  EMAIL_PASS: process.env.EMAIL_PASS || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
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
    "http://localhost:5000/api/hubspot/callback",
  HUBSPOT_OAUTH_SCOPES: normalizeSecret(process.env.HUBSPOT_OAUTH_SCOPES),
  HUBSPOT_ENABLED: process.env.HUBSPOT_ENABLED === "true" || false,
};

