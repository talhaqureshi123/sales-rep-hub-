const axios = require('axios');
const config = require('../config');
const HubSpotOAuthToken = require('../database/models/HubSpotOAuthToken');

const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

const toFormUrlEncoded = (obj) =>
  new URLSearchParams(
    Object.entries(obj).reduce((acc, [k, v]) => {
      if (v === undefined || v === null) return acc;
      acc[k] = String(v);
      return acc;
    }, {})
  ).toString();

const requireOAuthConfig = () => {
  if (!config.HUBSPOT_OAUTH_CLIENT_ID || !config.HUBSPOT_OAUTH_CLIENT_SECRET) {
    throw new Error(
      'HubSpot OAuth not configured. Set HUBSPOT_OAUTH_CLIENT_ID and HUBSPOT_OAUTH_CLIENT_SECRET in .env'
    );
  }
  if (!config.HUBSPOT_OAUTH_REDIRECT_URI) {
    throw new Error('HubSpot OAuth not configured. Set HUBSPOT_OAUTH_REDIRECT_URI in .env');
  }
};

const exchangeCodeForTokens = async (code) => {
  requireOAuthConfig();
  const body = toFormUrlEncoded({
    grant_type: 'authorization_code',
    client_id: config.HUBSPOT_OAUTH_CLIENT_ID,
    client_secret: config.HUBSPOT_OAUTH_CLIENT_SECRET,
    redirect_uri: config.HUBSPOT_OAUTH_REDIRECT_URI,
    code,
  });

  const res = await axios.post(HUBSPOT_TOKEN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  // HubSpot returns: access_token, refresh_token, expires_in (seconds)
  const expiresInSeconds = Number(res.data.expires_in || 0);
  const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;

  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresAt,
    raw: res.data,
  };
};

const refreshAccessToken = async (refreshToken) => {
  requireOAuthConfig();
  const body = toFormUrlEncoded({
    grant_type: 'refresh_token',
    client_id: config.HUBSPOT_OAUTH_CLIENT_ID,
    client_secret: config.HUBSPOT_OAUTH_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await axios.post(HUBSPOT_TOKEN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const expiresInSeconds = Number(res.data.expires_in || 0);
  const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;

  return {
    accessToken: res.data.access_token,
    // refresh_token may or may not be returned on refresh; keep existing if not provided
    refreshToken: res.data.refresh_token || refreshToken,
    expiresAt,
    raw: res.data,
  };
};

const saveTokens = async ({ accessToken, refreshToken, expiresAt }) => {
  const doc = await HubSpotOAuthToken.getSingleton();
  doc.accessToken = accessToken || doc.accessToken;
  doc.refreshToken = refreshToken || doc.refreshToken;
  doc.expiresAt = expiresAt || doc.expiresAt;
  await doc.save();
  return doc;
};

const getTokenDoc = async () => {
  return await HubSpotOAuthToken.getSingleton();
};

const hasValidAccessToken = (doc) => {
  if (!doc?.accessToken) return false;
  if (!doc.expiresAt) return true; // if unknown, assume valid and let API call decide
  // refresh 60 seconds early
  return doc.expiresAt.getTime() - Date.now() > 60 * 1000;
};

const getValidAccessToken = async () => {
  const doc = await getTokenDoc();

  if (hasValidAccessToken(doc)) {
    return doc.accessToken;
  }

  if (!doc.refreshToken) {
    throw new Error('HubSpot OAuth not connected yet. Missing refresh token. Complete OAuth once.');
  }

  const refreshed = await refreshAccessToken(doc.refreshToken);
  await saveTokens(refreshed);
  return refreshed.accessToken;
};

const getConnectionStatus = async () => {
  const doc = await getTokenDoc();
  return {
    connected: !!doc.refreshToken,
    hasAccessToken: !!doc.accessToken,
    expiresAt: doc.expiresAt,
  };
};

module.exports = {
  exchangeCodeForTokens,
  refreshAccessToken,
  saveTokens,
  getValidAccessToken,
  getConnectionStatus,
};

