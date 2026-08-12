fn proxy_candidate(raw: &str) -> &str {
    if !raw.contains('=') {
        return raw;
    }

    let entries: Vec<(&str, &str)> = raw
        .split(';')
        .filter_map(|entry| entry.split_once('='))
        .map(|(kind, value)| (kind.trim(), value.trim()))
        .collect();
    entries
        .iter()
        .find(|(kind, _)| kind.eq_ignore_ascii_case("https"))
        .or_else(|| entries.iter().find(|(kind, _)| kind.eq_ignore_ascii_case("http")))
        .map(|(_, value)| *value)
        .unwrap_or("")
}

fn normalize_proxy(raw: &str) -> Option<String> {
    let candidate = proxy_candidate(raw.trim()).trim();
    if candidate.is_empty() {
        return None;
    }
    let candidate = if candidate.contains("://") {
        candidate.to_string()
    } else {
        format!("http://{candidate}")
    };
    let url = reqwest::Url::parse(&candidate).ok()?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.host_str().is_none()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    Some(url.to_string())
}

fn environment_proxy() -> Option<String> {
    ["HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy", "HTTP_PROXY", "http_proxy"]
        .iter()
        .filter_map(|name| std::env::var(name).ok())
        .find_map(|value| normalize_proxy(&value))
}

#[cfg(target_os = "windows")]
fn registry_proxy() -> Option<String> {
    use std::{ffi::c_void, ptr};
    use windows_sys::Win32::System::Registry::{
        RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD, RRF_RT_REG_SZ,
    };

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe fn read_dword(subkey: &[u16], name: &[u16]) -> Option<u32> {
        let mut value = 0_u32;
        let mut size = std::mem::size_of::<u32>() as u32;
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                subkey.as_ptr(),
                name.as_ptr(),
                RRF_RT_REG_DWORD,
                ptr::null_mut(),
                &mut value as *mut u32 as *mut c_void,
                &mut size,
            )
        };
        (status == 0).then_some(value)
    }

    unsafe fn read_string(subkey: &[u16], name: &[u16]) -> Option<String> {
        let mut size = 0_u32;
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                subkey.as_ptr(),
                name.as_ptr(),
                RRF_RT_REG_SZ,
                ptr::null_mut(),
                ptr::null_mut(),
                &mut size,
            )
        };
        if status != 0 || size < 2 {
            return None;
        }
        let mut buffer = vec![0_u16; (size as usize + 1) / 2];
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                subkey.as_ptr(),
                name.as_ptr(),
                RRF_RT_REG_SZ,
                ptr::null_mut(),
                buffer.as_mut_ptr() as *mut c_void,
                &mut size,
            )
        };
        if status != 0 {
            return None;
        }
        let length = buffer.iter().position(|value| *value == 0).unwrap_or(buffer.len());
        String::from_utf16(&buffer[..length]).ok()
    }

    let subkey = wide("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings");
    let enabled_name = wide("ProxyEnable");
    let server_name = wide("ProxyServer");
    let enabled = unsafe { read_dword(&subkey, &enabled_name) }?;
    if enabled == 0 {
        return None;
    }
    let server = unsafe { read_string(&subkey, &server_name) }?;
    normalize_proxy(&server)
}

#[cfg(not(target_os = "windows"))]
fn registry_proxy() -> Option<String> {
    None
}

#[tauri::command]
pub fn get_system_proxy() -> Option<String> {
    environment_proxy().or_else(registry_proxy)
}

#[cfg(test)]
mod tests {
    use super::normalize_proxy;

    #[test]
    fn proxy_normalization_supports_windows_formats() {
        assert_eq!(normalize_proxy("127.0.0.1:7897").as_deref(), Some("http://127.0.0.1:7897/"));
        assert_eq!(
            normalize_proxy("http=proxy.example.com:8080;https=secure-proxy.example.com:8443").as_deref(),
            Some("http://secure-proxy.example.com:8443/"),
        );
        assert_eq!(normalize_proxy("https://proxy.example.com:8443").as_deref(), Some("https://proxy.example.com:8443/"));
    }

    #[test]
    fn proxy_normalization_rejects_credentials_and_unsafe_urls() {
        assert!(normalize_proxy("https://secret@proxy.example.com").is_none());
        assert!(normalize_proxy("file:///tmp/proxy").is_none());
        assert!(normalize_proxy("https://proxy.example.com/path").is_none());
        assert!(normalize_proxy("").is_none());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn system_proxy_discovery_returns_only_a_normalized_url() {
        if let Some(proxy) = super::get_system_proxy() {
            assert_eq!(normalize_proxy(&proxy).as_deref(), Some(proxy.as_str()));
        }
    }
}
