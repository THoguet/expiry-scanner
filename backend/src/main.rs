mod models;
mod queries;

use std::net::SocketAddr;

use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use dotenvy::dotenv;
use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::models::{CreateProduct, DeleteProduct, Product};

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
        .route(
            "/products",
            get(list_products).post(new_product).delete(delete_product),
        )
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

async fn list_products(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Product>>, (StatusCode, String)> {
    sqlx::query_as!(
        Product,
        "select * from products order by expiration_date asc"
    )
    .fetch_all(&pool)
    .await
    .map(|value| Json::from(value))
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn new_product(
    State(pool): State<PgPool>,
    Json(new_product): Json<CreateProduct>,
) -> Result<StatusCode, (StatusCode, String)> {
    queries::insert_product(&new_product, &pool)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn delete_product(
    State(pool): State<PgPool>,
    Json(delete_product): Json<DeleteProduct>,
) -> Result<StatusCode, (StatusCode, String)> {
    queries::delete_product(&delete_product, &pool)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
