#!/usr/bin/env pwsh
# EC Project Sync Status Dashboard
# Run this anytime: .\sync-status.ps1

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "   EC PROJECT SYNC STATUS CHECK      " -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Local Status
Write-Host "📁 Local Working Directory:" -ForegroundColor Yellow
$status = git status --short
if ($status) {
    Write-Host $status
    Write-Host "⚠️  You have uncommitted changes" -ForegroundColor Red
} else {
    Write-Host "✅ Clean (no uncommitted files)" -ForegroundColor Green
}

# Current Branch
Write-Host "`n🌿 Current Branch:" -ForegroundColor Yellow
$branch = git branch --show-current
Write-Host "   $branch" -ForegroundColor White

# Commits Ahead
Write-Host "`n⬆️  Commits Ahead of Remote:" -ForegroundColor Yellow
$ahead = (git log origin/main..HEAD --oneline 2>$null).Count
if ($ahead -gt 0) {
    Write-Host "   $ahead commits (need to push)" -ForegroundColor Red
    git log origin/main..HEAD --oneline | Select-Object -First 5 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
} else {
    Write-Host "   0 commits (up to date)" -ForegroundColor Green
}

# Commits Behind
Write-Host "`n⬇️  Commits Behind Remote:" -ForegroundColor Yellow
git fetch origin --quiet 2>$null
$behind = (git log HEAD..origin/main --oneline 2>$null).Count
if ($behind -gt 0) {
    Write-Host "   $behind commits (need to pull)" -ForegroundColor Red
    git log HEAD..origin/main --oneline | Select-Object -First 5 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
} else {
    Write-Host "   0 commits (up to date)" -ForegroundColor Green
}

# Last Local Commit
Write-Host "`n📝 Last Local Commit:" -ForegroundColor Yellow
$lastCommit = git log -1 --oneline
Write-Host "   $lastCommit" -ForegroundColor White

# Database Status
Write-Host "`n🗄️  Database Schema Status:" -ForegroundColor Yellow
Push-Location apps\api
$dbCheck = npx prisma db push --skip-generate --accept-data-loss 2>&1
if ($dbCheck -match "already in sync") {
    Write-Host "   ✅ Schema in sync with database" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Schema needs sync (run: npx prisma db push)" -ForegroundColor Red
}
Pop-Location

# Build Status
Write-Host "`n🔨 Build Status:" -ForegroundColor Yellow
if (Test-Path "apps\api\.next") {
    Write-Host "   ✅ Build artifacts exist" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  No build found (run: npm run build)" -ForegroundColor Red
}

# Backup Status
Write-Host "`n💾 Backup Branches:" -ForegroundColor Yellow
$backups = git branch | Select-String "backup/"
if ($backups) {
    $backups | ForEach-Object {
        Write-Host "   $_" -ForegroundColor Gray
    }
} else {
    Write-Host "   ⚠️  No backup branches found" -ForegroundColor Red
    Write-Host "   Create one: git branch backup/$(Get-Date -Format 'yyyy-MM-dd')" -ForegroundColor Gray
}

# Summary
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "           SYNC SCORE                " -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$score = 0
$total = 5

if (!$status) { $score++ }
if ($ahead -eq 0) { $score++ }
if ($behind -eq 0) { $score++ }
if ($dbCheck -match "already in sync") { $score++ }
if (Test-Path "apps\api\.next") { $score++ }

$percent = [math]::Round(($score / $total) * 100)
$color = if ($percent -ge 80) { "Green" } elseif ($percent -ge 50) { "Yellow" } else { "Red" }

Write-Host "   Sync Score: $score/$total ($percent%)" -ForegroundColor $color

if ($percent -eq 100) {
    Write-Host "`n   🎉 Perfect sync! You're good to go." -ForegroundColor Green
} elseif ($percent -ge 80) {
    Write-Host "`n   ✅ Good sync. Minor issues to address." -ForegroundColor Yellow
} else {
    Write-Host "`n   ⚠️  Sync issues detected. Review above." -ForegroundColor Red
}

Write-Host "`n======================================`n" -ForegroundColor Cyan
