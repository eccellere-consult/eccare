# 100% Sync Workflow for EC Project

## ⚡ Quick Daily Sync (Use This Every Day)

### Morning Routine (Before Coding)
```powershell
cd D:\Cowork\EC
git fetch origin
git status
git log HEAD..origin/main --oneline
# If commits exist remotely, review them before proceeding
```

### Evening Routine (After Coding)
```powershell
cd D:\Cowork\EC

# 1. Check what changed locally
git status

# 2. Stage and commit
git add -A
git commit -m "feat: <what you built today>"

# 3. Fetch remote changes
git fetch origin

# 4. If remote has updates, rebase (keeps history clean)
git rebase origin/main

# 5. Push your work
git push origin <your-branch>
```

### Before Deploy Checklist
- [ ] All files committed: `git status` shows clean
- [ ] Database in sync: `npx prisma db push` runs clean
- [ ] Build passes: `npm run build` succeeds
- [ ] Server running: `npm run dev` works locally
- [ ] Remote updated: `git push origin <branch>` completes
- [ ] GitHub shows your latest commit

## 🛡️ Conflict Prevention Rules

### Rule 1: Never Force Push
```powershell
# NEVER do this on shared branches:
git push --force  # ❌ FORBIDDEN

# Instead, use:
git pull --rebase origin main
git push origin <branch>
```

### Rule 2: Always Pull Before Starting
```powershell
# Every time you open VS Code:
git pull origin main
npm install  # In case dependencies changed
npx prisma generate  # In case schema changed
```

### Rule 3: Commit Often, Push Frequently
```powershell
# After each feature/fix (even if incomplete):
git add -A
git commit -m "wip: <what you're working on>"
git push origin <your-branch>

# WIP = Work In Progress (tells others it's not done)
```

### Rule 4: Use Feature Branches
```powershell
# Never work directly on main:
git checkout -b feat/your-feature-name
# Do your work
git push origin feat/your-feature-name
# Then create PR on GitHub to merge to main
```

## 🔄 Database Sync Workflow

### After Schema Changes
```powershell
cd D:\Cowork\EC\apps\api

# 1. Update schema
# Edit prisma/schema.prisma

# 2. Push to database
npx prisma db push

# 3. Regenerate client
npx prisma generate

# 4. Commit schema file
git add prisma/schema.prisma
git commit -m "db: <what you changed in schema>"
git push origin <branch>
```

### When Pulling Schema Changes
```powershell
git pull origin main

# Re-sync database
cd apps/api
npx prisma db push
npx prisma generate

# Restart dev server
# Press Ctrl+C in terminal running npm run dev
npm run dev
```

## 🚨 Emergency: "I Have Conflicts"

### Scenario 1: Merge Conflict After Pull
```powershell
git pull origin main
# Shows: CONFLICT in <file>

# Option A: Fix manually
# 1. Open conflicted files in VS Code
# 2. Choose which changes to keep
# 3. Remove conflict markers (<<<<, ====, >>>>)
# 4. Save files
git add -A
git commit -m "fix: resolve merge conflicts"

# Option B: Abort and try rebase
git merge --abort
git rebase origin/main
# Fix conflicts one commit at a time
git add <fixed-files>
git rebase --continue
```

### Scenario 2: "Diverged Histories"
```powershell
# Message: "Your branch and 'origin/main' have diverged"

# See what's different
git log HEAD..origin/main --oneline  # Remote commits
git log origin/main..HEAD --oneline  # Local commits

# Option A: Merge
git merge origin/main

# Option B: Rebase (cleaner)
git rebase origin/main

# Option C: Backup and reset (nuclear option)
git branch backup-$(date +%Y%m%d)
git reset --hard origin/main
git cherry-pick <commits-you-want-to-keep>
```

### Scenario 3: "Force Push Detected"
```powershell
# Message: "Updates were rejected because the remote contains work..."

# ⚠️ DO NOT FORCE PUSH TO FIX THIS

# Step 1: Backup your work
git branch backup-emergency-$(date +%Y%m%d)

# Step 2: Fetch and inspect
git fetch origin
git log origin/main --oneline -10

# Step 3: Create plan
# - If remote is newer/correct: reset to it
# - If local is critical: talk to team before proceeding

# Step 4: Merge or reset (choose based on step 3)
git reset --hard origin/main  # If remote is source of truth
# OR
git merge origin/main  # If both have valuable work
```

## 📁 File Sync Checklist

### Files That MUST Be Synced
- [x] `apps/api/prisma/schema.prisma` - Database schema
- [x] `apps/api/app/**/*.ts(x)` - API routes & pages
- [x] `apps/api/components/**/*.tsx` - UI components
- [x] `apps/api/lib/**/*.ts` - Utility functions
- [x] `package.json` - Dependencies
- [x] `.env.example` - Environment variable template
- [x] `.github/workflows/*.yml` - CI/CD config

### Files to NEVER Commit
- [ ] `.env` - Contains secrets
- [ ] `node_modules/` - Dependencies (auto-installed)
- [ ] `.next/` - Build output
- [ ] `uploads/` - User-uploaded files
- [ ] `*.log` - Log files
- [ ] `.DS_Store` - Mac system files

## 🎯 Perfect Sync State

You have 100% sync when:
1. ✅ `git status` shows "nothing to commit, working tree clean"
2. ✅ `git log HEAD..origin/main` shows no commits (you're up to date)
3. ✅ `git log origin/main..HEAD` shows your pushed commits only
4. ✅ `npm run build` completes without errors
5. ✅ `npx prisma db push` says "already in sync"
6. ✅ GitHub shows your latest commit on your branch
7. ✅ Local dev server runs without errors

## 🔧 Recovery Commands

### "I Messed Up, Reset Everything"
```powershell
# ⚠️ THIS DELETES UNCOMMITTED WORK
git stash  # Saves uncommitted work temporarily
git fetch origin
git reset --hard origin/main
git clean -fd  # Deletes untracked files

# To restore stashed work:
git stash pop
```

### "I Need to Start Fresh"
```powershell
# Backup current state
cd D:\Cowork\
git bundle create EC-backup-$(date +%Y%m%d).bundle --all

# Clone fresh copy
cd ..
git clone https://github.com/eccellere-consult/ec.git EC-fresh
cd EC-fresh
npm install
cd apps/api
npx prisma generate
npx prisma db push
npm run dev
```

### "I Want to See What Remote Has"
```powershell
# Checkout remote branch without affecting local work
git fetch origin
git checkout -b review/remote-main origin/main

# Review files, then go back
git checkout <your-original-branch>
```

## 📊 Sync Status Dashboard

Run this command anytime to check sync status:
```powershell
Write-Host "`n=== EC PROJECT SYNC STATUS ===" -ForegroundColor Cyan
Write-Host "`nLocal Status:" -ForegroundColor Yellow
git status --short

Write-Host "`nLocal Branch:" -ForegroundColor Yellow
git branch --show-current

Write-Host "`nCommits ahead of remote:" -ForegroundColor Yellow
git log origin/main..HEAD --oneline | Measure-Object | Select-Object -ExpandProperty Count

Write-Host "`nCommits behind remote:" -ForegroundColor Yellow
git log HEAD..origin/main --oneline | Measure-Object | Select-Object -ExpandProperty Count

Write-Host "`nLast commit:" -ForegroundColor Yellow
git log -1 --oneline

Write-Host "`nRemote status:" -ForegroundColor Yellow
git fetch origin --quiet
git remote -v

Write-Host "`n================================`n" -ForegroundColor Cyan
```

Save this as `sync-status.ps1` and run: `.\sync-status.ps1`
