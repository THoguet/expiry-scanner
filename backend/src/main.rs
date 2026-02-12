mod models;

use std::net::SocketAddr;

use axum::{extract::State, routing::get, Router};
use dotenvy::dotenv;
use sqlx::{postgres::PgPoolOptions, PgPool};

#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to create pool");

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/db_check", get(db_check))
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "OK"
}

async fn db_check(State(pool): State<PgPool>) -> &'static str {
    let response = sqlx::query("SELECT 1").execute(&pool).await;

    match response {
        Ok(_) => "DB OK",
        Err(_) => "DB FAIL",
    }
}
