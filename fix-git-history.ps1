# Script to remove .env files from git history
# Run this script in PowerShell: .\fix-git-history.ps1

Write-Host "Removing .env files from git history..." -ForegroundColor Yellow

# Step 1: Make sure .env is in .gitignore
Write-Host "`nStep 1: Checking .gitignore..." -ForegroundColor Cyan
if (-not (Get-Content .gitignore | Select-String -Pattern "backend/.env")) {
    Add-Content .gitignore "`nbackend/.env"
    Add-Content .gitignore "frontend/.env"
    Write-Host "Added .env to .gitignore" -ForegroundColor Green
}

# Step 2: Remove .env from all commits using git filter-branch
Write-Host "`nStep 2: Removing .env from git history (this may take a while)..." -ForegroundColor Cyan

# Backup refs
Write-Host "Creating backup..." -ForegroundColor Yellow
git update-ref refs/original/refs/heads/main refs/heads/main

# Remove .env files from all commits
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch backend/.env frontend/.env" --prune-empty --tag-name-filter cat -- --all

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccessfully removed .env from git history!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "1. Verify the changes: git log --all --full-history -- backend/.env" -ForegroundColor White
    Write-Host "2. Force push to GitHub: git push origin main --force" -ForegroundColor White
    Write-Host "`nWARNING: Force push will rewrite history on GitHub!" -ForegroundColor Red
    Write-Host "Make sure all team members are aware before force pushing." -ForegroundColor Red
} else {
    Write-Host "`nError: Could not remove .env from history" -ForegroundColor Red
    Write-Host "You may need to use BFG Repo-Cleaner or manual rebase" -ForegroundColor Yellow
}
