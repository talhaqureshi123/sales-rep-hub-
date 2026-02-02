# Shift Photos – Visited Area Images in Deployment

If **Shift Photos** shows only **Start** and **End** photos and **Visited Area** is empty:

1. **Visit completion must send visited area images**  
   When a salesman completes a visit, the app must call the visit update API with:
   - `visitedAreaImage` (single image URL/base64), or  
   - `visitedAreaImages` (array of image URLs/base64).

   Backend: `PATCH /api/salesman/visit-targets/:id` (or equivalent) with body including `visitedAreaImage` or `visitedAreaImages`.  
   See `backend/salesman/controller/visitTargetController.js` (updateVisitTarget).

2. **Visit must be linked to the shift (optional but recommended)**  
   If the visit has `trackingId` set to the current shift’s Tracking id, it is included by tracking id.  
   Otherwise, admin “Get all tracking” still includes visits by **same salesman + same date**, so visited area images can still appear if they are saved on the VisitTarget.

3. **Check data in production**  
   In your DB, inspect VisitTarget documents for the relevant date/salesman and confirm:
   - `visitedAreaImage` or `visitedAreaImages` is set after visit completion.  
   If these fields are empty in production, the salesman app is not sending them on visit complete.

4. **Sync from tracking (if using ShiftPhoto collection)**  
   If you use the ShiftPhoto collection and a sync job, ensure it runs and that it copies `visitedAreaImage` / `visitedAreaImages` from VisitTarget (see `backend/admin/controllers/shiftPhotoController.js` – syncPhotosFromTracking).
