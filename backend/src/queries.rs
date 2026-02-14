use std::error::Error;

use sqlx::PgPool;

use crate::models::{CreateProduct, DeleteProduct};

pub async fn insert_product(
    new_product: &CreateProduct,
    pool: &PgPool,
) -> Result<(), Box<dyn Error>> {
    let query = "insert into products (barcode, expiration_date, client_id) values ($1, $2, $3)";

    sqlx::query(query)
        .bind(&new_product.barcode)
        .bind(&new_product.expiration_date)
        .bind(&new_product.client_id)
        .execute(pool)
        .await?;

    Ok(())
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
