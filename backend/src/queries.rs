use std::error::Error;

use sqlx::PgPool;

use crate::models::{CreateProduct, DeleteProduct, Product};

pub async fn insert_product(
    new_product: &CreateProduct,
    pool: &PgPool,
) -> Result<Product, Box<dyn Error>> {
    let query = "insert into products (barcode, expiration_date, client_id) values ($1, $2, $3) returning *";

    let product = sqlx::query_as::<_, Product>(query)
        .bind(&new_product.barcode)
        .bind(&new_product.expiration_date)
        .bind(&new_product.client_id)
        .fetch_one(pool)
        .await?;

    Ok(product)
}

pub async fn delete_product(
    delete_product: &DeleteProduct,
    pool: &PgPool,
) -> Result<(), Box<dyn Error>> {
    let query = "delete from products where id=$1 and client_id=$2";

    sqlx::query(query)
        .bind(&delete_product.id)
        .bind(&delete_product.client_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn list_products_with_client_id(
    pool: &PgPool,
    client_id: uuid::Uuid,
) -> Result<Vec<Product>, Box<dyn Error>> {
    let query = "select * from products where client_id=$1 order by expiration_date asc";

    let products = sqlx::query_as::<_, Product>(query)
        .bind(&client_id)
        .fetch_all(pool)
        .await?;

    Ok(products)
}
