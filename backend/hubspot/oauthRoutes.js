const express = require('express');
const router = express.Router();
const config = require('../config');
const hubspotOAuthService = require('../services/hubspotOAuthService');

// GET /api/hubspot/authorize
// Redirects user to HubSpot authorize URL (OAuth)
router.get('/authorize', (req, res) => {
  const scopes =
    config.HUBSPOT_OAUTH_SCOPES ||
    [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      // Needed for deal line items (products on deals/quotes)
      'crm.objects.line_items.read',
      'crm.objects.line_items.write',
      // Keep defaults limited to scopes that exist in most OAuth apps.
      // If you need more, set HUBSPOT_OAUTH_SCOPES in .env to exactly what your app shows.
      // Optional (orders): crm.objects.orders.read crm.objects.orders.write
    ].join(' ');

  if (!config.HUBSPOT_OAUTH_CLIENT_ID) {
    return res.status(400).json({
      success: false,
      message: 'Missing HUBSPOT_OAUTH_CLIENT_ID in .env',
    });
  }

  const authorizeUrl = new URL('https://app-eu1.hubspot.com/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', config.HUBSPOT_OAUTH_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', config.HUBSPOT_OAUTH_REDIRECT_URI);
  authorizeUrl.searchParams.set('scope', scopes);

  return res.redirect(authorizeUrl.toString());
});

// GET /api/hubspot/callback?code=...
router.get('/callback', async (req, res) => {
  try {
    const { code, error, error_description } = req.query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: String(error_description || error),
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Missing OAuth code in callback',
      });
    }

    const tokens = await hubspotOAuthService.exchangeCodeForTokens(String(code));
    await hubspotOAuthService.saveTokens(tokens);

    // Optional: redirect back to frontend
    const redirectTo = `${config.FRONTEND_URL}/?hubspot=connected`;
    return res.redirect(redirectTo);
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message || 'OAuth callback failed',
    });
  }
});

// GET /api/hubspot/status
router.get('/status', async (req, res) => {
  try {
    const status = await hubspotOAuthService.getConnectionStatus();
    res.status(200).json({
      success: true,
      authMode: config.HUBSPOT_AUTH_MODE,
      data: status,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;

