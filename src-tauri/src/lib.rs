mod image_processor;

use image_processor::ImageProcessor;
use image::{GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use rayon::prelude::*;
use std::sync::Arc;

#[derive(Serialize, Deserialize)]
struct ImageMetadata {
    width: u32,
    height: u32,
    format: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct ConversionSettings {
    target_format: String,
    quality: u8,
    preserve_metadata: bool,
}

#[derive(Clone, Serialize)]
struct ConversionProgress {
    file_id: String,
    progress: u8,
}

#[derive(Serialize, Deserialize)]
struct BatchConversionItem {
    file_id: String,
    path: String,
    output_path: String,
}

#[derive(Serialize)]
struct BatchConversionResult {
    file_id: String,
    success: bool,
    output_path: Option<String>,
    error: Option<String>,
}

#[tauri::command]
async fn analyze_image(path: String) -> Result<ImageMetadata, String> {
    let img = ImageProcessor::load_image(&path)
        .map_err(|e| e.to_string())?;

    let (width, height) = img.dimensions();
    let format = ImageProcessor::get_format(&path)
        .map_err(|e| e.to_string())?;

    Ok(ImageMetadata { width, height, format })
}

#[tauri::command]
async fn get_file_size(path: String) -> Result<u64, String> {
    std::fs::metadata(&path)
        .map(|m| m.len())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn estimate_output_size(
    path: String,
    settings: ConversionSettings,
) -> Result<u64, String> {
    let img = ImageProcessor::load_image(&path)
        .map_err(|e| e.to_string())?;

    let (width, height) = img.dimensions();

    let estimated_bytes = ImageProcessor::estimate_size(
        width,
        height,
        &settings.target_format,
        settings.quality,
    );

    Ok(estimated_bytes)
}

#[tauri::command]
async fn save_temp_file(file_name: String, data: Vec<u8>) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let temp_file_name = format!("{}_{}", timestamp, file_name);
    let temp_path = temp_dir.join(temp_file_name);

    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    std::io::Write::write_all(&mut file, &data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    temp_path.to_str()
        .ok_or_else(|| "Invalid path".to_string())
        .map(|s| s.to_string())
}

/// Generate a preview image for formats that browser can't display (like HEIC)
/// Returns path to a temporary JPEG file (smaller and faster than PNG)
/// Uses embedded thumbnail when available for maximum speed
#[tauri::command]
async fn generate_preview(path: String) -> Result<String, String> {
    let format = ImageProcessor::get_format(&path)
        .map_err(|e| e.to_string())?;

    // Only generate preview for HEIC/HEIF
    if format != "heic" && format != "heif" {
        return Err("Preview generation only needed for HEIC/HEIF files".to_string());
    }

    // Use thumbnail extraction (much faster than full decode)
    let preview_img = ImageProcessor::load_heic_thumbnail(&path, 800)
        .map_err(|e| e.to_string())?;

    // Create temp preview file
    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let preview_path = temp_dir.join(format!("preview_{}.jpg", timestamp));

    // Save as JPEG with turbojpeg
    ImageProcessor::save_image(&preview_img, preview_path.to_str().unwrap(), ImageFormat::Jpeg, 75)
        .map_err(|e| format!("Failed to save preview: {}", e))?;

    preview_path.to_str()
        .ok_or_else(|| "Invalid path".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
async fn convert_image(
    file_id: String,
    path: String,
    output_path: String,
    settings: ConversionSettings,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Load image
    let img = ImageProcessor::load_image(&path)
        .map_err(|e| e.to_string())?;

    // Emit progress
    app_handle.emit("conversion_progress", ConversionProgress {
        file_id: file_id.clone(),
        progress: 50,
    }).ok();

    // Determine output format
    let format = match settings.target_format.as_str() {
        "jpeg" => ImageFormat::Jpeg,
        "png" => ImageFormat::Png,
        _ => return Err("Unsupported format".to_string()),
    };

    // Save image
    ImageProcessor::save_image(&img, &output_path, format, settings.quality)
        .map_err(|e| e.to_string())?;

    // Emit completion
    app_handle.emit("conversion_progress", ConversionProgress {
        file_id,
        progress: 100,
    }).ok();

    Ok(output_path)
}

/// Batch convert multiple images in parallel
#[tauri::command]
async fn convert_images_batch(
    items: Vec<BatchConversionItem>,
    settings: ConversionSettings,
    app_handle: tauri::AppHandle,
) -> Result<Vec<BatchConversionResult>, String> {
    let format = match settings.target_format.as_str() {
        "jpeg" => ImageFormat::Jpeg,
        "png" => ImageFormat::Png,
        _ => return Err("Unsupported format".to_string()),
    };

    let app_handle = Arc::new(app_handle);
    let quality = settings.quality;

    // Process images in parallel using rayon
    let results: Vec<BatchConversionResult> = items
        .par_iter()
        .map(|item| {
            let result = (|| -> Result<String, String> {
                // Load image
                let img = ImageProcessor::load_image(&item.path)
                    .map_err(|e| e.to_string())?;

                // Emit progress (50%)
                app_handle.emit("conversion_progress", ConversionProgress {
                    file_id: item.file_id.clone(),
                    progress: 50,
                }).ok();

                // Save image
                ImageProcessor::save_image(&img, &item.output_path, format, quality)
                    .map_err(|e| e.to_string())?;

                // Emit completion (100%)
                app_handle.emit("conversion_progress", ConversionProgress {
                    file_id: item.file_id.clone(),
                    progress: 100,
                }).ok();

                Ok(item.output_path.clone())
            })();

            match result {
                Ok(output_path) => BatchConversionResult {
                    file_id: item.file_id.clone(),
                    success: true,
                    output_path: Some(output_path),
                    error: None,
                },
                Err(e) => BatchConversionResult {
                    file_id: item.file_id.clone(),
                    success: false,
                    output_path: None,
                    error: Some(e),
                },
            }
        })
        .collect();

    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            analyze_image,
            get_file_size,
            estimate_output_size,
            convert_image,
            convert_images_batch,
            save_temp_file,
            generate_preview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
