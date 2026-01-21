# ImageMagick for HEIC Support

This folder should contain ImageMagick binaries for HEIC conversion.

## Quick Setup (requires 7-Zip)

1. Install 7-Zip from https://www.7-zip.org/
2. Run: `powershell -ExecutionPolicy Bypass -File download-imagemagick.ps1`

## Manual Setup

1. Go to: https://imagemagick.org/script/download.php#windows
2. Download: `ImageMagick-7.x.x-portable-Q16-HDRI-x64.7z`
3. Extract with 7-Zip
4. Copy these files to this folder:
   - `magick.exe`
   - All `*.dll` files

## Alternative: Use Installer

1. Download: `ImageMagick-7.x.x-Q16-HDRI-x64-dll.exe`
2. Install to default location
3. Copy from `C:\Program Files\ImageMagick-7.x.x-Q16-HDRI\`:
   - `magick.exe`
   - All `*.dll` files
