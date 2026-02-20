# Shift photos on VM – not showing

## 1. Frontend and API on different origin

If the app (frontend) and API run on different domains (e.g. `https://app.example.com` and `https://api.example.com`), set this when **building** the frontend:

```env
VITE_API_BASE_URL=https://your-api-domain.com
```

Example: in `frontend/.env.production`:

```
VITE_API_BASE_URL=https://api.yourvm.com
```

Then rebuild: `npm run build`. Shift photo image URLs will use this base URL so they load from the API server.

## 2. Image files missing on VM

Shift photos are stored as **files** in `backend/shift-photos/`. That folder is **not** in git (only `.gitkeep` is). So:

- **New uploads on VM**  
  When users upload from the app on VM, photos are saved in `backend/shift-photos` on the VM. Ensure that folder exists and the Node process has **write** permission.

- **Photos that were migrated on your PC**  
  If you ran `node backend/scripts/migrateShiftPhotosToFolder.js` only on your **local** machine, the image files exist only there. The DB has paths like `/api/shift-photos/files/TRACKING_ID/start.jpg`, but on the VM that path points to a file that doesn’t exist yet.

  **Fix:** Copy the **contents** of `backend/shift-photos` from your local machine to the VM (same path: `backend/shift-photos/`), keeping the same subfolder structure (e.g. `697d0bc7.../start.jpg`, `visit-xxx/visited_0.jpg`). Use rsync, scp, or your deploy script.

## 3. Backend serving the folder

The backend serves `backend/shift-photos` at:

- `GET /api/shift-photos/files/:trackingId/start.jpg`
- `GET /api/shift-photos/files/:trackingId/end.jpg`
- etc.

On the VM, ensure your reverse proxy (e.g. nginx) forwards `/api` to the Node app so these URLs hit the same server that has the `shift-photos` folder.
