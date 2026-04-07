use std::error::Error;

use sqlx::types::Json;
use sqlx::PgPool;
use tracing::debug;

use crate::models::{
    Barcode, BarcodePrefill, CreateProduct, CreateStock, CreateUserProductInfo, DeleteProduct,
    DeleteStock, EditProduct, EditStock, FrozenProduct, Product, Stock, UserProductInfo,
};

#[derive(sqlx::FromRow)]
struct ProductWithOptionalBarcodeRow {
    #[sqlx(flatten)]
    product: Product,
    barcode_payload: Option<Json<Barcode>>,
}

impl ProductWithOptionalBarcodeRow {
    fn into_tuple(self) -> (Product, Option<Barcode>) {
        (self.product, self.barcode_payload.map(|barcode| barcode.0))
    }
}

pub async fn insert_product(
    new_product: &CreateProduct,
    pool: &PgPool,
) -> Result<Product, Box<dyn Error>> {
    debug!(barcode = %new_product.barcode, client_id = %new_product.client_id, "query insert_product called");
    let query =
        "insert into products (barcode, name, image, expiration_date, client_id) values ($1, $2, $3, $4, $5) returning *";

    let product = sqlx::query_as::<_, Product>(query)
        .bind(&new_product.barcode)
        .bind(&new_product.name)
        .bind(&new_product.image)
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
    debug!(product_id = delete_product.id, client_id = %delete_product.client_id, "query delete_product called");
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
    debug!(client_id = %client_id, "query list_products_with_client_id called");
    let query = "select * from products where client_id=$1 order by expiration_date asc";

    let products = sqlx::query_as::<_, Product>(query)
        .bind(&client_id)
        .fetch_all(pool)
        .await?;

    debug!(
        count = products.len(),
        "query list_products_with_client_id completed"
    );
    Ok(products)
}

pub async fn list_join_product_barcode_barcode_code(
    pool: &PgPool,
    client_id: uuid::Uuid,
) -> Result<Vec<(Product, Option<crate::models::Barcode>)>, Box<dyn Error>> {
    debug!(client_id = %client_id, "query list_join_product_barcode_barcode_code called");
    let query = "select p.*, to_jsonb(b) as barcode_payload from products p left join barcode_database b on p.barcode = b.code where p.client_id=$1 order by p.expiration_date asc";

    let rows = sqlx::query_as::<_, ProductWithOptionalBarcodeRow>(query)
        .bind(&client_id)
        .fetch_all(pool)
        .await?;

    let products_with_barcodes = rows.into_iter().map(|row| row.into_tuple()).collect();

    debug!("query list_join_product_barcode_barcode_code completed");
    Ok(products_with_barcodes)
}

pub async fn get_product_by_id_with_barcode(
    pool: &PgPool,
    product_id: i64,
    client_id: uuid::Uuid,
) -> Result<(Product, Option<crate::models::Barcode>), Box<dyn Error>> {
    debug!(product_id, client_id = %client_id, "query get_product_by_id_with_barcode called");
    let query = "select p.*, to_jsonb(b) as barcode_payload from products p left join barcode_database b on p.barcode = b.code where p.id=$1 and p.client_id=$2";

    let row = sqlx::query_as::<_, ProductWithOptionalBarcodeRow>(query)
        .bind(&product_id)
        .bind(&client_id)
        .fetch_one(pool)
        .await?;

    Ok(row.into_tuple())
}

pub async fn get_barcode_prefill(
    pool: &PgPool,
    barcode: &str,
) -> Result<Option<BarcodePrefill>, Box<dyn Error>> {
    debug!(barcode = %barcode, "query get_barcode_prefill called");
    let query = "select code as barcode, product_name as name, coalesce(image_url, image_small_url) as image from barcode_database where code=$1 limit 1";

    let prefill = sqlx::query_as::<_, BarcodePrefill>(query)
        .bind(barcode)
        .fetch_optional(pool)
        .await?;

    Ok(prefill)
}

pub async fn barcode_exists_in_database(
    pool: &PgPool,
    barcode: &str,
) -> Result<bool, Box<dyn Error>> {
    debug!(barcode = %barcode, "query barcode_exists_in_database called");
    let query = "select exists(select 1 from barcode_database where code=$1)";

    let exists = sqlx::query_scalar::<_, bool>(query)
        .bind(barcode)
        .fetch_one(pool)
        .await?;

    Ok(exists)
}

pub async fn get_user_product_info_by_client(
    pool: &PgPool,
    barcode: &str,
    client_id: uuid::Uuid,
) -> Result<Option<UserProductInfo>, Box<dyn Error>> {
    debug!(barcode = %barcode, client_id = %client_id, "query get_user_product_info_by_client called");
    let query = "select * from user_product_info where barcode=$1 and client_id=$2 order by updated_at desc limit 1";

    let info = sqlx::query_as::<_, UserProductInfo>(query)
        .bind(barcode)
        .bind(client_id)
        .fetch_optional(pool)
        .await?;

    Ok(info)
}

pub async fn get_user_product_info_global(
    pool: &PgPool,
    barcode: &str,
) -> Result<Option<UserProductInfo>, Box<dyn Error>> {
    debug!(barcode = %barcode, "query get_user_product_info_global called");
    let query = "select * from user_product_info where barcode=$1 order by updated_at desc limit 1";

    let info = sqlx::query_as::<_, UserProductInfo>(query)
        .bind(barcode)
        .fetch_optional(pool)
        .await?;

    Ok(info)
}

pub async fn upsert_user_product_info(
    new_info: &CreateUserProductInfo,
    pool: &PgPool,
) -> Result<UserProductInfo, Box<dyn Error>> {
    debug!(barcode = %new_info.barcode, client_id = %new_info.client_id, "query upsert_user_product_info called");
    let query = "insert into user_product_info (barcode, name, image, client_id) values ($1, $2, $3, $4) on conflict (barcode, client_id) do update set name=excluded.name, image=excluded.image, updated_at=now() returning *";

    let info = sqlx::query_as::<_, UserProductInfo>(query)
        .bind(&new_info.barcode)
        .bind(&new_info.name)
        .bind(&new_info.image)
        .bind(&new_info.client_id)
        .fetch_one(pool)
        .await?;

    Ok(info)
}

pub async fn edit_product(
    edit_product: &EditProduct,
    pool: &PgPool,
) -> Result<Product, Box<dyn Error>> {
    debug!(product_id = edit_product.id, client_id = %edit_product.client_id, "query edit_product called");
    let query = "update products set expiration_date=$1, barcode=$2, name=$3, image=$4 where id=$5 and client_id=$6 returning *";

    let product = sqlx::query_as::<_, Product>(query)
        .bind(&edit_product.expiration_date)
        .bind(&edit_product.barcode)
        .bind(&edit_product.name)
        .bind(&edit_product.image)
        .bind(&edit_product.id)
        .bind(&edit_product.client_id)
        .fetch_one(pool)
        .await?;

    Ok(product)
}

pub async fn set_product_image(
    pool: &PgPool,
    product_id: i64,
    client_id: uuid::Uuid,
    image: Option<String>,
) -> Result<Product, Box<dyn Error>> {
    debug!(product_id, client_id = %client_id, "query set_product_image called");
    let query = "update products set image=$1 where id=$2 and client_id=$3 returning *";

    let product = sqlx::query_as::<_, Product>(query)
        .bind(image)
        .bind(product_id)
        .bind(client_id)
        .fetch_one(pool)
        .await?;

    Ok(product)
}

pub async fn insert_stock(new_stock: &CreateStock, pool: &PgPool) -> Result<Stock, Box<dyn Error>> {
    debug!(client_id = %new_stock.client_id, "query insert_stock called");
    let query = "insert into stock (name, desired_quantity, current_quantity, unit, location, client_id) values ($1, $2, $3, $4, $5, $6) returning *";

    let stock = sqlx::query_as::<_, Stock>(query)
        .bind(&new_stock.name)
        .bind(new_stock.desired_quantity)
        .bind(new_stock.current_quantity)
        .bind(&new_stock.unit)
        .bind(&new_stock.location)
        .bind(new_stock.client_id)
        .fetch_one(pool)
        .await?;

    Ok(stock)
}

pub async fn list_stock_with_client_id(
    pool: &PgPool,
    client_id: uuid::Uuid,
) -> Result<Vec<Stock>, Box<dyn Error>> {
    debug!(client_id = %client_id, "query list_stock_with_client_id called");
    let query = "select * from stock where client_id=$1 order by updated_at desc";

    let stock = sqlx::query_as::<_, Stock>(query)
        .bind(client_id)
        .fetch_all(pool)
        .await?;

    Ok(stock)
}

pub async fn edit_stock(edit_stock: &EditStock, pool: &PgPool) -> Result<Stock, Box<dyn Error>> {
    debug!(stock_id = edit_stock.id, client_id = %edit_stock.client_id, "query edit_stock called");
    let query = "update stock set name=$1, desired_quantity=$2, current_quantity=$3, unit=$4, location=$5, updated_at=now() where id=$6 and client_id=$7 returning *";

    let stock = sqlx::query_as::<_, Stock>(query)
        .bind(&edit_stock.name)
        .bind(edit_stock.desired_quantity)
        .bind(edit_stock.current_quantity)
        .bind(&edit_stock.unit)
        .bind(&edit_stock.location)
        .bind(edit_stock.id)
        .bind(edit_stock.client_id)
        .fetch_one(pool)
        .await?;

    Ok(stock)
}

pub async fn delete_stock(delete_stock: &DeleteStock, pool: &PgPool) -> Result<(), Box<dyn Error>> {
    debug!(stock_id = delete_stock.id, client_id = %delete_stock.client_id, "query delete_stock called");
    let query = "delete from stock where id=$1 and client_id=$2";

    sqlx::query(query)
        .bind(delete_stock.id)
        .bind(delete_stock.client_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn adjust_stock_delta(
    pool: &PgPool,
    stock_id: i64,
    client_id: uuid::Uuid,
    delta: i32,
) -> Result<Option<Stock>, Box<dyn Error>> {
    debug!(stock_id, client_id = %client_id, delta, "query adjust_stock_delta called");
    let query = "update stock set current_quantity = current_quantity + $1, updated_at=now() where id=$2 and client_id=$3 and current_quantity + $1 >= 0 returning *";

    let stock = sqlx::query_as::<_, Stock>(query)
        .bind(delta)
        .bind(stock_id)
        .bind(client_id)
        .fetch_optional(pool)
        .await?;

    Ok(stock)
}

pub async fn refresh_user_product_info_last_linked_at(
    pool: &PgPool,
) -> Result<u64, Box<dyn Error>> {
    debug!("query refresh_user_product_info_last_linked_at called");
    let query = "update user_product_info upi set last_linked_at=now() where exists (select 1 from products p where p.barcode=upi.barcode)";

    let result = sqlx::query(query).execute(pool).await?;

    Ok(result.rows_affected())
}

pub async fn delete_stale_stock(pool: &PgPool) -> Result<u64, Box<dyn Error>> {
    debug!("query delete_stale_stock called");
    let query = "delete from stock where updated_at < now() - interval '6 months'";

    let result = sqlx::query(query).execute(pool).await?;

    Ok(result.rows_affected())
}

pub async fn delete_outlier_products(pool: &PgPool) -> Result<u64, Box<dyn Error>> {
    debug!("query delete_outlier_products called");
    let query = "delete from products where expiration_date < (current_date - interval '90 days')::date or expiration_date > (current_date + interval '10 years')::date";

    let result = sqlx::query(query).execute(pool).await?;

    Ok(result.rows_affected())
}

pub async fn delete_orphan_user_product_info(pool: &PgPool) -> Result<u64, Box<dyn Error>> {
    debug!("query delete_orphan_user_product_info called");
    let query = "delete from user_product_info upi where not exists (select 1 from products p where p.barcode=upi.barcode) and upi.last_linked_at < now() - interval '1 year'";

    let result = sqlx::query(query).execute(pool).await?;

    Ok(result.rows_affected())
}

pub async fn get_product_by_id(
    pool: &PgPool,
    product_id: i64,
    client_id: uuid::Uuid,
) -> Result<Product, Box<dyn Error>> {
    debug!(product_id, client_id = %client_id, "query get_product_by_id called");
    let query = "select * from products where id=$1 and client_id=$2";

    let product = sqlx::query_as::<_, Product>(query)
        .bind(product_id)
        .bind(client_id)
        .fetch_one(pool)
        .await?;

    Ok(product)
}

pub async fn insert_frozen_product(
    pool: &PgPool,
    barcode: &str,
    name: &str,
    image: Option<&str>,
    frozen_date: chrono::NaiveDate,
    client_id: uuid::Uuid,
) -> Result<FrozenProduct, Box<dyn Error>> {
    debug!(barcode = %barcode, client_id = %client_id, "query insert_frozen_product called");
    let query = "insert into frozen_products (barcode, name, image, frozen_date, client_id) values ($1, $2, $3, $4, $5) returning *";

    let frozen = sqlx::query_as::<_, FrozenProduct>(query)
        .bind(barcode)
        .bind(name)
        .bind(image)
        .bind(frozen_date)
        .bind(client_id)
        .fetch_one(pool)
        .await?;

    Ok(frozen)
}

pub async fn list_frozen_products(
    pool: &PgPool,
    client_id: uuid::Uuid,
) -> Result<Vec<FrozenProduct>, Box<dyn Error>> {
    debug!(client_id = %client_id, "query list_frozen_products called");
    let query = "select * from frozen_products where client_id=$1 order by frozen_date desc";

    let products = sqlx::query_as::<_, FrozenProduct>(query)
        .bind(client_id)
        .fetch_all(pool)
        .await?;

    Ok(products)
}

pub async fn get_frozen_product_by_id(
    pool: &PgPool,
    frozen_product_id: i64,
    client_id: uuid::Uuid,
) -> Result<FrozenProduct, Box<dyn Error>> {
    debug!(frozen_product_id, client_id = %client_id, "query get_frozen_product_by_id called");
    let query = "select * from frozen_products where id=$1 and client_id=$2";

    let product = sqlx::query_as::<_, FrozenProduct>(query)
        .bind(frozen_product_id)
        .bind(client_id)
        .fetch_one(pool)
        .await?;

    Ok(product)
}

pub async fn delete_frozen_product(
    pool: &PgPool,
    frozen_product_id: i64,
    client_id: uuid::Uuid,
) -> Result<(), Box<dyn Error>> {
    debug!(frozen_product_id, client_id = %client_id, "query delete_frozen_product called");
    let query = "delete from frozen_products where id=$1 and client_id=$2";

    sqlx::query(query)
        .bind(frozen_product_id)
        .bind(client_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn insert_product_unfrozen(
    pool: &PgPool,
    barcode: &str,
    name: &str,
    image: Option<&str>,
    expiration_date: chrono::NaiveDate,
    client_id: uuid::Uuid,
) -> Result<Product, Box<dyn Error>> {
    debug!(barcode = %barcode, client_id = %client_id, "query insert_product_unfrozen called");
    let query = "insert into products (barcode, name, image, expiration_date, was_previously_frozen, client_id) values ($1, $2, $3, $4, true, $5) returning *";

    let product = sqlx::query_as::<_, Product>(query)
        .bind(barcode)
        .bind(name)
        .bind(image)
        .bind(expiration_date)
        .bind(client_id)
        .fetch_one(pool)
        .await?;

    Ok(product)
}
