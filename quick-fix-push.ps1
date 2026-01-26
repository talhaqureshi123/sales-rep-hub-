# Quick Fix Script - Remove .env from commit history and push
# Run: .\quick-fix-push.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quick Fix: Remove .env and Push to GitHub" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check current status
Write-Host "Current Status:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Option 1: Try to use BFG Repo-Cleaner approach (simpler)
Write-Host "Option 1: Using git filter-repo (if available) or filter-branch..." -ForegroundColor Cyan

# Check if git filter-repo is available
$hasFilterRepo = git filter-repo --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Using git filter-repo..." -ForegroundColor Green
    git filter-repo --path backend/.env --path frontend/.env --invert-paths --force
} else {
    Write-Host "git filter-repo not available, using alternative method..." -ForegroundColor Yellow
    
    # Alternative: Create a new commit that removes the file, then use interactive rebase
    Write-Host "`nCreating backup branch..." -ForegroundColor Yellow
    git branch backup-main-$(Get-Date -Format "yyyyMMdd-HHmmss")
    
    Write-Host "`nTo fix manually:" -ForegroundColor Yellow
    Write-Host "1. Visit GitHub secret scanning URL to allow the secret (if safe):" -ForegroundColor White
    Write-Host "   https://github.com/talhaqureshi123/sales-rep-hub-/security/secret-scanning/unblock-secret/38o3PWfenODnL4RVTegPf3ww5Wn" -ForegroundColor Cyan
    Write-Host "`n2. OR use git filter-branch manually:" -ForegroundColor White
    Write-Host "   git filter-branch --force --index-filter `"git rm --cached --ignore-unmatch backend/.env frontend/.env`" --prune-empty --tag-name-filter cat -- --all" -ForegroundColor Cyan
    Write-Host "   git push origin main --force" -ForegroundColor Cyan
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "IMPORTANT: After fixing, you need to:" -ForegroundColor Red
Write-Host "1. Force push: git push origin main --force" -ForegroundColor Yellow
Write-Host "2. Inform team members (history will be rewritten)" -ForegroundColor Yellow
Write-Host "3. Rotate the exposed HubSpot key if it was a production key" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan
