use std::time::SystemTime;

use chrono::{ParseError, Utc};
use serde::de::value::Error;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!!!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_barcode_scanner::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// remember to call `.manage(MyState::default())`
#[tauri::command]
async fn calculate_days_left(expiry_date: String, format: String) -> Result<String, ParseError> {
    let parsed_date = chrono::NaiveDate::parse_from_str(&expiry_date, &format)?;

    let nowDate = Utc::now();

    ""
}
