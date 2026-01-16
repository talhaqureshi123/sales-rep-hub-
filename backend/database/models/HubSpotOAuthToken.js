const mongoose = require('mongoose');

/**
 * Stores HubSpot OAuth tokens for a single connected HubSpot account.
 * Note: This is sensitive data. Keep DB access restricted.
 */
const hubSpotOAuthTokenSchema = new mongoose.Schema(
  {
    accessToken: { type: String, default: '' },
    refreshToken: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

hubSpotOAuthTokenSchema.statics.getSingleton = async function () {
  const existing = await this.findOne();
  if (existing) return existing;
  return await this.create({});
};

module.exports = mongoose.model('HubSpotOAuthToken', hubSpotOAuthTokenSchema);

