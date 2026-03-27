use chrono::{NaiveDate, Utc};
use log::{debug, info, trace, warn};
use tauri_plugin_log::{Target, TargetKind};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    info!("Handling greet command for name={}", name);
    format!("Hello, {}! You've been greeted from Rust!!!", name)
}

#[tauri::command]
fn calculate_days_left(expiry_date: String, format: String) -> Result<i64, String> {
    trace!(
        "calculate_days_left called with expiry_date={} format={}",
        expiry_date,
        format
    );

    let parsed_date = match chrono::NaiveDate::parse_from_str(&expiry_date, &format) {
        Ok(parsed) => parsed,
        Err(error) => {
            warn!(
                "Failed to parse expiry_date={} format={} error={}",
                expiry_date, format, error
            );
            return Err(error.to_string());
        }
    };
    let now_date: NaiveDate = Utc::now().date_naive();
    let days_left = (parsed_date - now_date).num_days();

    debug!(
        "Calculated days_left={} for expiry_date={} compared_to={}",
        days_left, expiry_date, now_date
    );

    Ok(days_left)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    info!("Initializing Tauri application runtime");
    let builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .level(tauri_plugin_log::log::LevelFilter::Trace)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_share::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, calculate_days_left]);

    #[cfg(any(target_os = "android", target_os = "ios"))]
    let builder = builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_barcode_scanner::init())
        .plugin(tauri_plugin_haptics::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// remember to call `.manage(MyState::default())`
