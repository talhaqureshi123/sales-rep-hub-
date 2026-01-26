# Final Push Script - After allowing secret on GitHub
# Run this AFTER you allow the secret on GitHub URL

Write-Host "========================================" -ForegroundColor Green
Write-Host "Final Push to GitHub" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "IMPORTANT: First allow the secret on GitHub:" -ForegroundColor Yellow
Write-Host "https://github.com/talhaqureshi123/sales-rep-hub-/security/secret-scanning/unblock-secret/38o3PWfenODnL4RVTegPf3ww5Wn" -ForegroundColor Cyan
Write-Host "`nPress Enter after allowing the secret..." -ForegroundColor Yellow
Read-Host

Write-Host "`nPushing to GitHub..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Successfully pushed all changes to GitHub!" -ForegroundColor Green
    Write-Host "Frontend and Backend - sab kuch push ho gaya!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Push failed. Try again or use force push:" -ForegroundColor Red
    Write-Host "git push origin main --force" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Green
