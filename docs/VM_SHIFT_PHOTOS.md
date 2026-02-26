# Shift photos – folder only (upload & fetch)

- **Save:** Shift complete hone par saari images **sirf** `backend/shift-photos/` folder mein save hoti hain (DB mein sirf path).
- **Fetch:** Admin Shift Photos page images **sirf** isi folder se load karta hai (`/api/shift-photos/files/...`).

## 404 on VM (salesrephub.iotfiysolutions.com)

VM par yeh URLs 404 isliye de rahe hain kyunki **VM par `backend/shift-photos` mein woh image files hain hi nahi**.  
Code sahi hai – problem sirf yeh hai ke production server par yeh folder (aur andar wali files) copy nahi ki gayi.

### Fix: VM par shift-photos folder copy karo

1. **Local** pe tumhare paas `backend/shift-photos` mein sab images hain (e.g. `697d0bc7.../start.jpg`, `visit-6980bad9.../visited.jpg`).
2. **Poora folder** VM pe same path pe copy karo: jahan pe Node app run hoti hai, wahan `backend/shift-photos` (aur andar ke saare subfolders) hona chahiye.

**Copy kaise karein (example):**

- **SCP (PowerShell / Git Bash):**
  ```bash
  scp -r "C:\Users\Pc\OneDrive\Desktop\SALES RAP HUB\backend\shift-photos" user@salesrephub.iotfiysolutions.com:/path/to/your/app/backend/
  ```
  Replace `user` and `/path/to/your/app/backend/` with your VM user and actual backend path.

- **Hostinger File Manager:**  
  `backend/shift-photos` ka poora folder (saari subfolders ke saath) zip karke upload karo, phir VM pe unzip karke `backend/` ke andar rakh do taake final path ho: `backend/shift-photos/TRACKING_ID/start.jpg` etc.

3. **Nginx (agar use ho):**  
  Ensure `/api` requests VM pe Node app ko ja rahe hain (proxy pass), taake `GET /api/shift-photos/files/...` backend tak pahunche.

Iske baad same URLs (e.g. `https://salesrephub.iotfiysolutions.com/api/shift-photos/files/6980e19930e51d903cb10d37/start.jpg`) VM se images serve karenge.

## New uploads on VM

Jab salesmen **VM wali site** se shift complete karke photo upload karenge, tab images VM ke `backend/shift-photos` mein hi save hongi aur wahi se fetch bhi hongi – koi extra step nahi.

## Frontend base URL

Production build ke liye frontend ko pata hona chahiye API domain (image URLs ke liye):

```env
# frontend/.env.production (or .env)
VITE_API_BASE_URL=https://salesrephub.iotfiysolutions.com
```

Phir `npm run build`. Image URL banega: `https://salesrephub.iotfiysolutions.com` + `/api/shift-photos/files/...`
