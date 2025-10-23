@echo off
echo Debug: Starting ResumeBuilder AI...
echo Current directory: %CD%
echo.
echo Checking if resume-builder-ai directory exists...
if exist "resume-builder-ai" (
    echo Directory exists!
    cd resume-builder-ai
    echo Changed to: %CD%
    echo.
    echo Checking if package.json exists...
    if exist "package.json" (
        echo package.json found!
        echo.
        echo Checking if node_modules exists...
        if exist "node_modules" (
            echo node_modules found!
            echo.
            echo Running npm run dev...
            npm run dev
        ) else (
            echo node_modules not found! Running npm install first...
            npm install
            echo.
            echo Now running npm run dev...
            npm run dev
        )
    ) else (
        echo package.json not found!
    )
) else (
    echo resume-builder-ai directory not found!
    dir
)
echo.
pause
