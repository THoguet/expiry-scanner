mod controller;
mod models;
mod queries;
mod service;

use std::{env, error::Error, net::SocketAddr};

use axum::http::Method;
use clap::Parser;
use dotenvy::dotenv;
use sqlx::{migrate::Migrator, postgres::PgPoolOptions};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

#[derive(Parser)]
#[command(
    name = "Expiry Scanner CLI",
    version,
    about = "A CLI for managing the Expiry Scanner backend"
)]
pub struct Args {
    // Import barcode database from a CSV file
    #[arg(short, long, value_name = "FILE")]
    import_barcode_csv: Option<String>,
}

static MIGRATOR: Migrator = sqlx::migrate!(); // <-- This macro embeds the folder!

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received");
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let cli = Args::parse();
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let app_env = env::var("APP_ENV").unwrap_or_else(|_| "production".to_string());

    let cors = if app_env == "development" {
        println!("🔓 CORS: Permissive (Dev Mode)");
        CorsLayer::permissive()
    } else {
        println!("🔒 CORS: Strict (Prod Mode)");
        CorsLayer::new()
            .allow_methods([Method::GET, Method::POST, Method::DELETE])
            .allow_origin([
                // "https://my-production-app.com".parse().unwrap(), // if web
                "tauri://localhost".parse().unwrap(), // iOS/macOS
                "http://tauri.localhost".parse().unwrap(), // Android
            ])
            .allow_headers(Any)
    };

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    tracing::info!("Running database migrations...");
    MIGRATOR.run(&pool).await?;
    tracing::info!("Migrations successful!");

    if let Some(file_path) = cli.import_barcode_csv.as_deref() {
        service::barcode::import_from_csv(file_path, &pool).await?;
        tracing::info!("CSV import completed. Exiting without starting API server.");
        return Ok(());
    }

    let app = controller::router(pool)
        .nest_service("/images", ServeDir::new("images"))
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| Box::new(e) as Box<dyn Error>)
}
