# Download ImageMagick portable for HEIC support
# Run this script once to download the required files

$ErrorActionPreference = "Stop"

Write-Host "Downloading ImageMagick portable..." -ForegroundColor Cyan

# Try zip first, then 7z
$version = "7.1.2-13"
$urls = @(
    "https://imagemagick.org/archive/binaries/ImageMagick-$version-portable-Q16-HDRI-x64.zip",
    "https://download.imagemagick.org/ImageMagick/download/binaries/ImageMagick-$version-portable-Q16-HDRI-x64.zip",
    "https://imagemagick.org/archive/binaries/ImageMagick-$version-portable-Q16-HDRI-x64.7z"
)

$downloaded = $false

foreach ($url in $urls) {
    try {
        $ext = if ($url.EndsWith(".7z")) { ".7z" } else { ".zip" }
        $archiveFile = "imagemagick$ext"

        Write-Host "Trying: $url"
        Invoke-WebRequest -Uri $url -OutFile $archiveFile -UseBasicParsing -ErrorAction Stop
        $downloaded = $true
        Write-Host "Downloaded successfully!" -ForegroundColor Green
        break
    }
    catch {
        Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if (-not $downloaded) {
    Write-Host ""
    Write-Host "Automatic download failed. Please download manually:" -ForegroundColor Red
    Write-Host "1. Go to: https://imagemagick.org/script/download.php#windows" -ForegroundColor Yellow
    Write-Host "2. Download the portable Q16-HDRI x64 version (zip or 7z)" -ForegroundColor Yellow
    Write-Host "3. Extract magick.exe and all .dll files to this folder:" -ForegroundColor Yellow
    Write-Host "   $PSScriptRoot" -ForegroundColor Cyan
    exit 1
}

$tempDir = "temp_imagemagick"

try {
    # Extract based on file type
    if (Test-Path "imagemagick.7z") {
        Write-Host "Extracting 7z archive..."
        # Try using 7z if available
        $7zPath = "C:\Program Files\7-Zip\7z.exe"
        if (Test-Path $7zPath) {
            & $7zPath x "imagemagick.7z" -o"$tempDir" -y
        } else {
            Write-Host "7-Zip not found. Please install 7-Zip or download the .zip version manually." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Extracting zip archive..."
        Expand-Archive -Path "imagemagick.zip" -DestinationPath $tempDir -Force
    }

    # Find the extracted folder
    $extractedFolder = Get-ChildItem -Path $tempDir -Directory | Select-Object -First 1

    if (-not $extractedFolder) {
        # Files might be directly in temp dir
        $extractedFolder = Get-Item $tempDir
    }

    # Copy required files
    Write-Host "Copying files..."
    $sourceDir = if (Test-Path "$($extractedFolder.FullName)\magick.exe") {
        $extractedFolder.FullName
    } else {
        $tempDir
    }

    Copy-Item "$sourceDir\magick.exe" . -Force -ErrorAction SilentlyContinue
    Copy-Item "$sourceDir\*.dll" . -Force -ErrorAction SilentlyContinue

    # Cleanup
    Write-Host "Cleaning up..."
    Remove-Item "imagemagick.*" -Force -ErrorAction SilentlyContinue
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

    # Verify
    if (Test-Path "magick.exe") {
        Write-Host ""
        Write-Host "Done! ImageMagick is ready." -ForegroundColor Green
        Write-Host ""
        Write-Host "Files copied:" -ForegroundColor Yellow
        Get-ChildItem -Filter "*.exe" | ForEach-Object { Write-Host "  - $($_.Name)" }
        $dllCount = (Get-ChildItem -Filter "*.dll").Count
        Write-Host "  - $dllCount DLL files"
    } else {
        Write-Host "Error: magick.exe not found after extraction" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red

    # Cleanup on error
    Remove-Item "imagemagick.*" -Force -ErrorAction SilentlyContinue
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue }

    exit 1
}
