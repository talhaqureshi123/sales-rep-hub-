/**
 * Migrate existing shift photos from DB (base64) to backend shift-photos folder.
 * Updates Tracking and VisitTarget documents with file paths so sab photos folder mein aa jayein.
 *
 * Usage (from project root): node backend/scripts/migrateShiftPhotosToFolder.js
 */

const connectDB = require("../database/connection");
const Tracking = require("../database/models/Tracking");
const VisitTarget = require("../database/models/VisitTarget");
const { saveShiftPhotoToFolder } = require("../utils/shiftPhotoStorage");

function isBase64(img) {
  return typeof img === "string" && img.trim() !== "" && !img.startsWith("http") && !img.startsWith("/");
}

async function migrate() {
  try {
    await connectDB();
    console.log("\n📸 Migrating shift photos from DB to folder...\n");

    let trackingCount = 0;
    let visitCount = 0;

    // ----- Tracking -----
    const trackings = await Tracking.find({
      $or: [
        { speedometerImage: { $exists: true, $ne: null, $ne: "" } },
        { endingMeterImage: { $exists: true, $ne: null, $ne: "" } },
        { visitedAreaImage: { $exists: true, $ne: null, $ne: "" } },
      ],
    }).lean();

    for (const t of trackings) {
      const tid = String(t._id);
      let updated = false;
      const updates = {};

      if (t.speedometerImage && isBase64(t.speedometerImage)) {
        const path = saveShiftPhotoToFolder(t.speedometerImage, tid, "start");
        if (path) {
          updates.speedometerImage = path;
          updated = true;
        }
      }
      if (t.endingMeterImage && isBase64(t.endingMeterImage)) {
        const path = saveShiftPhotoToFolder(t.endingMeterImage, tid, "end");
        if (path) {
          updates.endingMeterImage = path;
          updated = true;
        }
      }
      if (t.visitedAreaImage && isBase64(t.visitedAreaImage)) {
        const path = saveShiftPhotoToFolder(t.visitedAreaImage, tid, "visited", 0);
        if (path) {
          updates.visitedAreaImage = path;
          updated = true;
        }
      }

      if (updated) {
        await Tracking.updateOne({ _id: t._id }, { $set: updates });
        trackingCount++;
        console.log("  Tracking:", tid, "→ folder");
      }
    }

    // ----- VisitTarget (visited area images) -----
    const visits = await VisitTarget.find({
      $or: [
        { visitedAreaImage: { $exists: true, $nin: [null, ""] } },
        { visitedAreaImages: { $exists: true, $type: "array", $ne: [] } },
      ],
    }).lean();

    for (const v of visits) {
      const visitId = "visit-" + String(v._id);
      const images = Array.isArray(v.visitedAreaImages) && v.visitedAreaImages.length > 0
        ? v.visitedAreaImages
        : v.visitedAreaImage
          ? [v.visitedAreaImage]
          : [];

      const paths = [];
      let changed = false;
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img && isBase64(img)) {
          const path = saveShiftPhotoToFolder(img, visitId, "visited", i);
          if (path) {
            paths.push(path);
            changed = true;
          } else {
            paths.push(img);
          }
        } else if (img) {
          paths.push(img);
        }
      }

      if (changed && paths.length > 0) {
        await VisitTarget.updateOne(
          { _id: v._id },
          { $set: { visitedAreaImages: paths, visitedAreaImage: paths[0] } }
        );
        visitCount++;
        console.log("  VisitTarget:", v._id, "→ folder");
      }
    }

    console.log("\n✅ Done. Trackings updated:", trackingCount, "| VisitTargets updated:", visitCount, "\n");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

migrate();
