/**
 * Save shift photo (base64) to backend folder "shift-photos" and return URL path for DB.
 * All uploaded shift images go to backend/shift-photos/ so they persist on disk.
 */

const fs = require("fs");
const path = require("path");

const SHIFT_PHOTOS_DIR = path.join(__dirname, "..", "shift-photos");
const PUBLIC_PATH_PREFIX = "/api/shift-photos/files";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Extract raw base64 from data URL or return as-is if already base64.
 * @param {string} data - "data:image/jpeg;base64,XXX" or "XXX"
 * @returns {string|null} raw base64 or null
 */
function getBase64(data) {
  if (!data || typeof data !== "string") return null;
  const s = data.trim();
  if (s.startsWith("data:")) {
    const i = s.indexOf(",");
    return i >= 0 ? s.slice(i + 1).trim() : null;
  }
  return s;
}

/**
 * Save a base64 image to shift-photos folder.
 * @param {string} base64OrDataUrl - base64 string or data URL
 * @param {string} trackingId - Tracking _id (or "visit-" + visitTargetId)
 * @param {string} type - "start" | "end" | "visited"
 * @param {number} [index] - optional index for multiple images (e.g. visited_0, visited_1)
 * @returns {string|null} URL path to use in DB, e.g. /api/shift-photos/files/trackingId/start_123.jpg
 */
function saveShiftPhotoToFolder(base64OrDataUrl, trackingId, type, index = 0) {
  const base64 = getBase64(base64OrDataUrl);
  if (!base64) return null;

  ensureDir(SHIFT_PHOTOS_DIR);
  const subDir = path.join(SHIFT_PHOTOS_DIR, String(trackingId));
  ensureDir(subDir);

  const ext = "jpg";
  const name = index > 0 ? `${type}_${index}.${ext}` : `${type}.${ext}`;
  const filePath = path.join(subDir, name);

  try {
    const buf = Buffer.from(base64, "base64");
    fs.writeFileSync(filePath, buf);
    return `${PUBLIC_PATH_PREFIX}/${trackingId}/${name}`;
  } catch (err) {
    console.error("shiftPhotoStorage save error:", err.message);
    return null;
  }
}

module.exports = {
  saveShiftPhotoToFolder,
  getBase64,
  SHIFT_PHOTOS_DIR,
  PUBLIC_PATH_PREFIX,
};
