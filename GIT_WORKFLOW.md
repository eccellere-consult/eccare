# EC Git Workflow Quick Reference

## ⚠️ EC (eccare.in) ONLY - NOT Eccellere

This workflow is for the **EC platform** (eccare.in) ONLY.  
**Do NOT use for Eccellere (eccellere.in)** - that's a completely separate project.

---

## Daily Workflow

### Starting New Work

```bash
# 1. Switch to dev and update
git checkout dev
git pull origin dev

# 2. Create feature branch
git checkout -b feat/your-feature-name
# Examples: feat/prescription-ui, fix/login-bug, docs/api-guide

# 3. Make your changes in VS Code/Copilot
# ... code, test, build ...

# 4. Commit your work
git add -A
git commit -m "feat: clear description of what you built"

# 5. Push feature branch
git push -u origin feat/your-feature-name
```

### Creating Pull Request

1. **Go to GitHub**: https://github.com/eccellere-consult/eccare
2. **Create PR**: `feat/your-feature-name` → `dev` (NOT main!)
3. **Review & test** in dev environment
4. **Merge to dev** when approved

### Deploying to Production

```bash
# After testing in dev:
# Create PR: dev → main on GitHub
# Merge triggers production deployment
```

---

## Branch Hierarchy

```
main (production)
  ↑
  PR from dev
  ↑
dev (staging/testing)
  ↑
  PR from feature branches
  ↑
feat/*, fix/*, docs/* (your work)
```

---

## ✅ DO

- ✅ Always start from `dev` branch
- ✅ Create feature branches for all changes
- ✅ Push feature branches early and often
- ✅ Create PRs to `dev`, not `main`
- ✅ Test thoroughly in `dev` before merging to `main`
- ✅ Use clear commit messages: `feat:`, `fix:`, `docs:`

## ❌ DON'T

- ❌ Never commit directly to `dev` or `main`
- ❌ Never create PRs directly to `main` (go through `dev` first)
- ❌ Never force push to shared branches
- ❌ Don't mix EC (eccare.in) with Eccellere (eccellere.in) workflows

---

## Quick Commands

### Check current status
```bash
git status
git branch -vv  # See which branch you're on
```

### Switch branches
```bash
git checkout dev           # Switch to dev
git checkout -b feat/name  # Create and switch to new branch
```

### Sync with remote
```bash
git fetch origin           # Get latest from remote
git pull origin dev        # Update current branch
```

### Clean up old branches
```bash
git branch -d feat/old-feature  # Delete local branch (after merged)
```

---

## Emergency Recovery

### "I committed to dev by accident"
```bash
# Move commits to new branch
git checkout dev
git checkout -b feat/accidental-work
git push -u origin feat/accidental-work

# Reset dev to match remote
git checkout dev
git reset --hard origin/dev
```

### "I need to switch branches but have uncommitted work"
```bash
# Save work temporarily
git stash

# Switch branches
git checkout other-branch

# Restore work later
git stash pop
```

---

## Branch Naming Conventions

- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/what-changed` - Documentation updates
- `refactor/what-improved` - Code improvements
- `test/what-tested` - Test additions

Examples:
- `feat/prescription-upload`
- `fix/login-validation`
- `docs/api-endpoints`
- `refactor/database-queries`

---

**Remember**: This is for EC (eccare.in) only. Different project = different workflow!
