use image::{DynamicImage, ImageFormat, RgbaImage};
use std::path::Path;
use anyhow::{Context, Result};
use libheif_rs::{ColorSpace, HeifContext, LibHeif, RgbChroma};

pub struct ImageProcessor;

impl ImageProcessor {
    pub fn load_image(path: &str) -> Result<DynamicImage> {
        let extension = Path::new(path)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        // Check if HEIC/HEIF format
        let mut img = if extension == "heic" || extension == "heif" {
            Self::load_heic(path)?
        } else {
            image::open(path).context("Failed to open image")?
        };

        // Apply EXIF orientation (for non-HEIC, HEIC orientation is handled during decode)
        if extension != "heic" && extension != "heif" {
            img = Self::apply_exif_orientation(path, img)?;
        }

        Ok(img)
    }

    /// Load HEIC thumbnail for fast preview (doesn't decode full image)
    pub fn load_heic_thumbnail(path: &str, max_size: u32) -> Result<DynamicImage> {
        let lib_heif = LibHeif::new();
        let ctx = HeifContext::read_from_file(path)
            .context("Failed to read HEIC file")?;

        let handle = ctx.primary_image_handle()
            .context("Failed to get primary image handle")?;

        // Try to get embedded thumbnail first (much faster)
        let thumb_count = handle.number_of_thumbnails();
        if thumb_count > 0 {
            let mut thumb_ids = vec![0u32; thumb_count];
            let actual_count = handle.thumbnail_ids(&mut thumb_ids);
            if actual_count > 0 {
                if let Ok(thumb_handle) = handle.thumbnail(thumb_ids[0]) {
                    if let Ok(thumb_image) = lib_heif.decode(&thumb_handle, ColorSpace::Rgb(RgbChroma::Rgba), None) {
                        let planes = thumb_image.planes();
                        if let Some(interleaved) = planes.interleaved {
                            let width = thumb_image.width();
                            let height = thumb_image.height();
                            let stride = interleaved.stride;
                            let data = interleaved.data;

                            let mut rgba_data = Vec::with_capacity((width * height * 4) as usize);
                            for y in 0..height {
                                let row_start = (y as usize) * stride;
                                let row_end = row_start + (width as usize * 4);
                                if row_end <= data.len() {
                                    rgba_data.extend_from_slice(&data[row_start..row_end]);
                                }
                            }

                            if let Some(rgba_image) = RgbaImage::from_raw(width, height, rgba_data) {
                                return Ok(DynamicImage::ImageRgba8(rgba_image));
                            }
                        }
                    }
                }
            }
        }

        // Fallback: decode full image and resize
        let img = Self::load_heic(path)?;
        let (width, height) = (img.width(), img.height());

        if width > max_size || height > max_size {
            let ratio = max_size as f32 / width.max(height) as f32;
            let new_width = (width as f32 * ratio) as u32;
            let new_height = (height as f32 * ratio) as u32;
            Ok(img.resize(new_width, new_height, image::imageops::FilterType::Triangle))
        } else {
            Ok(img)
        }
    }

    fn load_heic(path: &str) -> Result<DynamicImage> {
        let lib_heif = LibHeif::new();
        let ctx = HeifContext::read_from_file(path)
            .context("Failed to read HEIC file")?;

        let handle = ctx.primary_image_handle()
            .context("Failed to get primary image handle")?;

        // Decode to RGBA
        let image = lib_heif.decode(&handle, ColorSpace::Rgb(RgbChroma::Rgba), None)
            .context("Failed to decode HEIC image")?;

        let planes = image.planes();
        let interleaved = planes.interleaved
            .context("Failed to get interleaved plane")?;

        let width = image.width();
        let height = image.height();
        let stride = interleaved.stride;
        let data = interleaved.data;

        // Convert to DynamicImage
        // libheif returns data with stride, we need to remove padding
        let mut rgba_data = Vec::with_capacity((width * height * 4) as usize);
        for y in 0..height {
            let row_start = (y as usize) * stride;
            let row_end = row_start + (width as usize * 4);
            rgba_data.extend_from_slice(&data[row_start..row_end]);
        }

        let rgba_image = RgbaImage::from_raw(width, height, rgba_data)
            .context("Failed to create RGBA image from HEIC data")?;

        Ok(DynamicImage::ImageRgba8(rgba_image))
    }

    fn apply_exif_orientation(path: &str, img: DynamicImage) -> Result<DynamicImage> {
        // Try to read EXIF data
        let file = std::fs::File::open(path)?;
        let mut bufreader = std::io::BufReader::new(&file);

        let exifreader = exif::Reader::new();
        let exif_data = match exifreader.read_from_container(&mut bufreader) {
            Ok(data) => data,
            Err(_) => return Ok(img), // No EXIF data, return original
        };

        // Get orientation tag
        let orientation = match exif_data.get_field(exif::Tag::Orientation, exif::In::PRIMARY) {
            Some(field) => match field.value.get_uint(0) {
                Some(v) => v,
                None => return Ok(img),
            },
            None => return Ok(img), // No orientation tag
        };

        // Apply transformation based on orientation
        let transformed = match orientation {
            1 => img, // Normal
            2 => img.fliph(), // Flip horizontal
            3 => img.rotate180(), // Rotate 180
            4 => img.flipv(), // Flip vertical
            5 => img.rotate90().fliph(), // Rotate 90 CW and flip horizontal
            6 => img.rotate90(), // Rotate 90 CW
            7 => img.rotate270().fliph(), // Rotate 270 CW and flip horizontal
            8 => img.rotate270(), // Rotate 270 CW
            _ => img, // Unknown orientation
        };

        Ok(transformed)
    }

    pub fn get_format(path: &str) -> Result<String> {
        let path_obj = Path::new(path);
        let extension = path_obj
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        Ok(extension.to_lowercase())
    }

    pub fn save_image(
        img: &DynamicImage,
        output_path: &str,
        format: ImageFormat,
        quality: u8,
    ) -> Result<()> {
        match format {
            ImageFormat::Jpeg => {
                Self::save_jpeg_turbo(img, output_path, quality)?;
            }
            ImageFormat::Png => {
                img.save_with_format(output_path, ImageFormat::Png)
                    .context("Failed to save PNG")?;
            }
            _ => anyhow::bail!("Unsupported output format"),
        }
        Ok(())
    }

    /// Save JPEG using turbojpeg (2-3x faster than standard encoder)
    fn save_jpeg_turbo(img: &DynamicImage, output_path: &str, quality: u8) -> Result<()> {
        let rgb_image = img.to_rgb8();

        let jpeg_data = turbojpeg::compress_image(&rgb_image, quality as i32, turbojpeg::Subsamp::Sub2x2)
            .context("Failed to compress JPEG with turbojpeg")?;

        std::fs::write(output_path, jpeg_data.as_ref())
            .context("Failed to write JPEG file")?;

        Ok(())
    }

    pub fn estimate_size(
        width: u32,
        height: u32,
        target_format: &str,
        quality: u8,
    ) -> u64 {
        let pixel_count = (width * height) as f64;

        match target_format {
            "jpeg" => {
                let quality_factor = quality as f64 / 100.0;
                let bytes_per_pixel = 0.5 + (quality_factor * 2.5);
                (pixel_count * bytes_per_pixel) as u64
            }
            "png" => {
                (pixel_count * 3.5) as u64
            }
            _ => 0,
        }
    }
}
