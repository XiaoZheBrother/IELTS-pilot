use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const CREDENTIAL_FILE: &str = "ai-credential.bin";

pub fn validate_api_key(api_key: &str) -> Result<(), String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() || trimmed.len() > 512 {
        return Err("AI API key is missing or too long.".to_string());
    }
    Ok(())
}

fn credential_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(CREDENTIAL_FILE))
        .map_err(|_| "Could not resolve the secure application data directory.".to_string())
}

#[cfg(target_os = "windows")]
fn protect(value: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
    };

    let input = CRYPT_INTEGER_BLOB { cbData: value.len() as u32, pbData: value.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let success = unsafe {
        CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if success == 0 {
        return Err("Windows could not protect the AI credential.".to_string());
    }
    let encrypted = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData as *mut core::ffi::c_void) };
    Ok(encrypted)
}

#[cfg(target_os = "windows")]
fn unprotect(value: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
    };

    let input = CRYPT_INTEGER_BLOB { cbData: value.len() as u32, pbData: value.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let success = unsafe {
        CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if success == 0 {
        return Err("Windows could not unlock the AI credential for this user.".to_string());
    }
    let decrypted = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData as *mut core::ffi::c_void) };
    Ok(decrypted)
}

#[cfg(not(target_os = "windows"))]
fn protect(_value: &[u8]) -> Result<Vec<u8>, String> {
    Err("Secure AI credential storage is currently available only on Windows.".to_string())
}

#[cfg(not(target_os = "windows"))]
fn unprotect(_value: &[u8]) -> Result<Vec<u8>, String> {
    Err("Secure AI credential storage is currently available only on Windows.".to_string())
}

#[cfg(all(test, target_os = "windows"))]
pub(crate) fn protected_roundtrip_for_test(value: &[u8]) -> Result<(Vec<u8>, Vec<u8>), String> {
    let encrypted = protect(value)?;
    let decrypted = unprotect(&encrypted)?;
    Ok((encrypted, decrypted))
}

fn write_credential(path: &Path, api_key: &str) -> Result<(), String> {
    validate_api_key(api_key)?;
    let encrypted = protect(api_key.trim().as_bytes())?;
    let directory = path.parent().ok_or_else(|| "AI credential path is invalid.".to_string())?;
    fs::create_dir_all(directory).map_err(|_| "Could not create the secure credential directory.".to_string())?;
    fs::write(path, encrypted).map_err(|_| "Could not save the protected AI credential.".to_string())
}

fn read_credential(path: &Path) -> Result<String, String> {
    let encrypted = fs::read(path).map_err(|_| "AI API key is not configured.".to_string())?;
    let decrypted = unprotect(&encrypted)?;
    let api_key = String::from_utf8(decrypted).map_err(|_| "Stored AI credential is invalid.".to_string())?;
    validate_api_key(&api_key)?;
    Ok(api_key)
}

pub fn credential_for_app(app: &AppHandle) -> Result<String, String> {
    read_credential(&credential_path(app)?)
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettingsStatus {
    has_key: bool,
}

#[tauri::command]
pub fn get_ai_settings_status(app: AppHandle) -> Result<AiSettingsStatus, String> {
    let path = credential_path(&app)?;
    Ok(AiSettingsStatus { has_key: path.is_file() && read_credential(&path).is_ok() })
}

#[tauri::command]
pub fn save_ai_credential(app: AppHandle, api_key: String) -> Result<(), String> {
    write_credential(&credential_path(&app)?, &api_key)
}

#[tauri::command]
pub fn clear_ai_credential(app: AppHandle) -> Result<(), String> {
    let path = credential_path(&app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|_| "Could not remove the protected AI credential.".to_string())?;
    }
    Ok(())
}
