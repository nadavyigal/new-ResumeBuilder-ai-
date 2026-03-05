# PowerShell Script to Commit and Push UI Improvements
# Run this script to commit all changes and push to GitHub

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Committing and Pushing Changes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project directory
$projectPath = "c:\Users\nadav\OneDrive\מסמכים\AI\cursor\cursor playground\ResumeBuilder AI"
Set-Location $projectPath

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""

# Check current branch
Write-Host "=== Current Branch ===" -ForegroundColor Cyan
git branch --show-current
Write-Host ""

# Check status before
Write-Host "=== Status Before ===" -ForegroundColor Cyan
git status --short
Write-Host ""

# Stage all modified files
Write-Host "=== Staging Files ===" -ForegroundColor Cyan
git add resume-builder-ai/src/app/dashboard/optimizations/\[id\]/page.tsx
git add resume-builder-ai/src/app/dashboard/page.tsx
git add resume-builder-ai/src/app/dashboard/resume/page.tsx
git add resume-builder-ai/src/components/landing/hero-section.tsx

Write-Host "Files staged successfully" -ForegroundColor Green
Write-Host ""

# Verify staged files
Write-Host "=== Staged Files ===" -ForegroundColor Cyan
git status --short
Write-Host ""

# Create commit
Write-Host "=== Creating Commit ===" -ForegroundColor Cyan
$commitMessage = @"
fix: UI improvements and URL validation fixes

- Darken Get Started buttons on dashboard and hero section
- Fix Optimization History text overflow with truncate
- Remove duplicate Get Started Free button from hero section
- Reorganize action buttons for mobile responsiveness
- Improve AI assistant chatbot icon visibility and positioning
- Fix URL input validation to allow flexible URL entry
- Add automatic URL protocol normalization
"@

git commit -m $commitMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "Commit created successfully!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Commit failed!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Show latest commit
Write-Host "=== Latest Commit ===" -ForegroundColor Cyan
git log --oneline -1
Write-Host ""

# Get commit hash
Write-Host "=== Commit Hash ===" -ForegroundColor Cyan
$commitHash = git rev-parse --short HEAD
Write-Host "Commit Hash: $commitHash" -ForegroundColor Yellow
Write-Host ""

# Push to GitHub
Write-Host "=== Pushing to GitHub ===" -ForegroundColor Cyan
git push github mobile-first-redesign

if ($LASTEXITCODE -eq 0) {
    Write-Host "Push completed successfully!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Push failed!" -ForegroundColor Red
    Write-Host "Please check your GitHub credentials and try again." -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Final status check
Write-Host "=== Final Status ===" -ForegroundColor Cyan
git status
Write-Host ""

# Verify no unpushed commits
Write-Host "=== Verifying Push ===" -ForegroundColor Cyan
git fetch github mobile-first-redesign
$unpushed = git log github/mobile-first-redesign..HEAD --oneline

if ([string]::IsNullOrWhiteSpace($unpushed)) {
    Write-Host "✓ All commits are pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "⚠ Warning: There are unpushed commits:" -ForegroundColor Yellow
    Write-Host $unpushed
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Script completed!" -ForegroundColor Green
Write-Host "Latest commit: $commitHash" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan







