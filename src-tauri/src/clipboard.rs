use base64::Engine;

/// Read only on an explicit composer paste, off the webview/UI thread.
#[tauri::command]
pub async fn read_clipboard_image() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
        let image = match clipboard.get_image() {
            Ok(image) => image,
            Err(arboard::Error::ContentNotAvailable) => return Ok(None),
            Err(error) => return Err(error.to_string()),
        };
        encode_image(image.width, image.height, &image.bytes).map(Some)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn encode_image(width: usize, height: usize, rgba: &[u8]) -> Result<String, String> {
    let bytes = width.checked_mul(height).and_then(|n| n.checked_mul(4));
    if width == 0 || height == 0 || bytes != Some(rgba.len()) || rgba.len() > 80 * 1024 * 1024 {
        return Err("Clipboard image is invalid or exceeds 80 MiB of decoded pixels".into());
    }
    let mut output = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut output, width as u32, height as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(rgba).map_err(|e| e.to_string())?;
    }
    if output.len() > 20 * 1024 * 1024 {
        return Err("Clipboard PNG exceeds the 20 MiB attachment limit".into());
    }
    Ok(base64::engine::general_purpose::STANDARD.encode(output))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn encodes_png_and_rejects_invalid_dimensions() {
        let encoded = encode_image(1, 1, &[255, 0, 0, 255]).unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap();
        assert_eq!(&bytes[..8], b"\x89PNG\r\n\x1a\n");
        assert!(encode_image(0, 1, &[]).is_err());
        assert!(encode_image(2, 1, &[0; 4]).is_err());
        assert!(encode_image(usize::MAX, 2, &[]).is_err());
    }
}
