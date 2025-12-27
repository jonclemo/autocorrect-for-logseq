# Plugin Verification Script
# Checks if plugin structure is correct

Write-Host "=== Logseq Plugin Verification ===" -ForegroundColor Cyan
Write-Host ""

$errors = 0

# Check required files exist
Write-Host "Checking required files..." -ForegroundColor Yellow
$required = @("logseq.json", "index.js")
foreach ($file in $required) {
    $path = "dist\$file"
    if (Test-Path $path) {
        Write-Host "  [OK] $file exists" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] $file MISSING" -ForegroundColor Red
        $errors++
    }
}

# Check logseq.json structure
Write-Host "`nChecking logseq.json..." -ForegroundColor Yellow
if (Test-Path "dist\logseq.json") {
    try {
        $logseq = Get-Content "dist\logseq.json" -Raw | ConvertFrom-Json
        
        $requiredFields = @("id", "name", "version", "main")
        foreach ($field in $requiredFields) {
            if ($logseq.PSObject.Properties.Name -contains $field) {
                $value = $logseq.$field
                Write-Host "  [OK] $field = $value" -ForegroundColor Green
            } else {
                Write-Host "  [ERROR] $field MISSING" -ForegroundColor Red
                $errors++
            }
        }
        
        # Check main file exists
        if (Test-Path "dist\$($logseq.main)") {
            Write-Host "  [OK] Main file exists: $($logseq.main)" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] Main file MISSING: $($logseq.main)" -ForegroundColor Red
            $errors++
        }
    } catch {
        Write-Host "  [ERROR] logseq.json is invalid JSON: $_" -ForegroundColor Red
        $errors++
    }
}

# Check index.js
Write-Host "`nChecking index.js..." -ForegroundColor Yellow
if (Test-Path "dist\index.js") {
    $index = Get-Content "dist\index.js" -Raw
    
    if ($index -match '@logseq/libs') {
        Write-Host "  [OK] @logseq/libs imported" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] @logseq/libs NOT imported" -ForegroundColor Red
        $errors++
    }
    
    if ($index -match 'logseq\.ready') {
        Write-Host "  [OK] logseq.ready() called" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] logseq.ready() NOT called" -ForegroundColor Red
        $errors++
    }
    
    # Check for require() statements
    $pattern = 'require\(["'']([^"'']+)["'']\)'
    $requires = [regex]::Matches($index, $pattern)
    Write-Host "`n  Checking require() statements:" -ForegroundColor Yellow
    foreach ($match in $requires) {
        $module = $match.Groups[1].Value
        if ($module -eq '@logseq/libs') {
            continue
        }
        $modulePath = $module -replace '^\./', ''
        $modulePath = $modulePath -replace '\.js$', ''
        $fullPath = "dist\$modulePath.js"
        if (Test-Path $fullPath) {
            Write-Host "    [OK] $module -> $fullPath" -ForegroundColor Green
        } else {
            Write-Host "    [ERROR] $module -> $fullPath MISSING" -ForegroundColor Red
            $errors++
        }
    }
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($errors -eq 0) {
    Write-Host "[SUCCESS] Plugin structure looks correct!" -ForegroundColor Green
    Write-Host "  Try loading it in Logseq now." -ForegroundColor Green
} else {
    Write-Host "[FAILED] Found $errors error(s)" -ForegroundColor Red
    Write-Host "  Fix the errors above before loading in Logseq." -ForegroundColor Yellow
}

Write-Host ""

