# PowerShell script to start the Next.js development server
$projectPath = "C:\Users\nadav\OneDrive\מסמכים\AI\cursor\cursor playground\ResumeBuilder AI\resume-builder-ai"

Write-Host "Changing to project directory: $projectPath"
Set-Location $projectPath

Write-Host "Starting Next.js development server..."
npm run dev
