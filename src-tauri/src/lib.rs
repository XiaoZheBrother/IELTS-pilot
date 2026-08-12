mod ai_writing;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![ai_writing::evaluate_writing])
        .run(tauri::generate_context!())
        .expect("error while running IELTS Pilot");
}
