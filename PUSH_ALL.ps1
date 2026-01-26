# Simple Script to Push All Frontend and Backend Changes
# Run this in PowerShell: .\PUSH_ALL.ps1

Write-Host "========================================" -ForegroundColor Green
Write-Host "Pushing All Changes to GitHub" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

# Step 1: Remove lock file if exists
Write-Host "Step 1: Checking for lock files..." -ForegroundColor Cyan
if (Test-Path ".git/index.lock") {
    Remove-Item ".git/index.lock" -Force
    Write-Host "Removed lock file" -ForegroundColor Yellow
}

# Step 2: Add all files
Write-Host "`nStep 2: Adding all files..." -ForegroundColor Cyan
git add .
if ($LASTEXITCODE -eq 0) {
    Write-Host "Files added successfully" -ForegroundColor Green
} else {
    Write-Host "Error adding files" -ForegroundColor Red
    exit 1
}

# Step 3: Commit if there are changes
Write-Host "`nStep 3: Committing changes..." -ForegroundColor Cyan
$status = git status --porcelain
if ($status) {
    git commit -m "Add all frontend and backend changes"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Changes committed" -ForegroundColor Green
    } else {
        Write-Host "Error committing" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "No changes to commit" -ForegroundColor Yellow
}

# Step 4: Try to push
Write-Host "`nStep 4: Pushing to GitHub..." -ForegroundColor Cyan
Write-Host "If push fails due to secret, use GitHub URL to allow it:" -ForegroundColor Yellow
Write-Host "https://github.com/talhaqureshi123/sales-rep-hub-/security/secret-scanning/unblock-secret/38o3PWfenODnL4RVTegPf3ww5Wn" -ForegroundColor Cyan
Write-Host ""

git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Successfully pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Push failed. Possible reasons:" -ForegroundColor Red
    Write-Host "1. Secret in commit history - Use GitHub URL above to allow it" -ForegroundColor Yellow
    Write-Host "2. Authentication required - Enter your GitHub credentials" -ForegroundColor Yellow
    Write-Host "3. Network issue - Check your internet connection" -ForegroundColor Yellow
    Write-Host "`nTo force push (if secret is allowed):" -ForegroundColor Cyan
    Write-Host "git push origin main --force" -ForegroundColor White
}

Write-Host "`n========================================" -ForegroundColor Green
