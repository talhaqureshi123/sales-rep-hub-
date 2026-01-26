# PowerShell script to push all changes to Git
# Run this script to commit and push all changes

Write-Host "=== Git Push All Changes ===" -ForegroundColor Cyan

# Step 1: Remove lock file if exists
if (Test-Path ".git/index.lock") {
    Remove-Item ".git/index.lock" -Force
    Write-Host "✓ Removed lock file" -ForegroundColor Yellow
}

# Step 2: Add all modified files (excluding .env files)
Write-Host "`nStep 1: Adding modified files..." -ForegroundColor Yellow
git add frontend/src/adminDashboard/pages/CustomerAllotment.jsx
git add frontend/src/adminDashboard/pages/CustomerManagement.jsx
git add frontend/src/salemanDsahboard/components/Notifications.jsx
git add frontend/src/salemanDsahboard/hooks/useNotificationCount.js
git add frontend/src/universalcomponents/SalesTracking.jsx

Write-Host "✓ Files staged" -ForegroundColor Green

# Step 3: Check if there are changes to commit
$status = git status --porcelain
if ($status) {
    Write-Host "`nStep 2: Committing changes..." -ForegroundColor Yellow
    git commit -m "Fix notifications filters/search, customer allotment display, map view, and visit categorization

- Fixed notification filters (Tasks/Visits/Samples) to work properly
- Enhanced search functionality with taskType and dueDate search
- Fixed customer allotment to hide '0 assigned' text
- Implemented map view in Customer Management
- Fixed visit categorization (completed visits in separate section)
- Fixed previous visits showing in notifications"
    Write-Host "✓ Changes committed" -ForegroundColor Green
} else {
    Write-Host "`n⚠ No changes to commit" -ForegroundColor Yellow
}

# Step 4: Push to remote
Write-Host "`nStep 3: Pushing to remote..." -ForegroundColor Yellow
try {
    git push origin main
    Write-Host "`n✓ Successfully pushed to GitHub!" -ForegroundColor Green
} catch {
    Write-Host "`n⚠ Push failed. You may need to:" -ForegroundColor Yellow
    Write-Host "  1. Check your internet connection" -ForegroundColor Yellow
    Write-Host "  2. Verify GitHub credentials" -ForegroundColor Yellow
    Write-Host "  3. Run: git push origin main" -ForegroundColor Yellow
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
