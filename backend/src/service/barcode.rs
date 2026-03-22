use std::error::Error;

use csv::{ReaderBuilder, StringRecord};
use sqlx::PgPool;
use tokio::{fs::File, io::BufReader};
use tracing::debug;

use crate::{controller::barcode::Pagination, models::Barcode};

pub async fn import_from_csv(file_path: &str, pool: &PgPool) -> Result<u64, Box<dyn Error>> {
    debug!(file_path = %file_path, "import_from_csv started");
    let headers = load_tsv_headers(file_path)?;
    let total_columns = headers.len();
    if total_columns == 0 {
        debug!("import_from_csv failed due to empty headers");
        return Err("The input file has no header columns".into());
    }

    let code_index = get_required_header_index(&headers, "code")?;

    let mut conn = pool.acquire().await?;

    sqlx::query("DROP TABLE IF EXISTS barcode_staging;")
        .execute(&mut *conn)
        .await?;

    sqlx::query(
        "CREATE TEMP TABLE barcode_staging (id BIGINT GENERATED ALWAYS AS IDENTITY, line TEXT)",
    )
    .execute(&mut *conn)
    .await?;

    let file_csv = File::open(file_path).await?;
    let reader = BufReader::new(file_csv);

    let mut copy = conn
        .copy_in_raw(
            "COPY barcode_staging(line) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\x1F', QUOTE E'\\x01', ESCAPE E'\\x01')",
        )
        .await?;

    copy.read_from(reader).await?;
    copy.finish().await?;

    let sql = build_insert_from_staging_sql(&headers, code_index);
    let result = sqlx::query(&sql).execute(&mut *conn).await?;

    sqlx::query("DROP TABLE IF EXISTS barcode_staging;")
        .execute(&mut *conn)
        .await?;

    debug!(
        rows_affected = result.rows_affected(),
        "import_from_csv completed"
    );
    Ok(result.rows_affected())
}

fn load_tsv_headers(file_path: &str) -> Result<StringRecord, Box<dyn Error>> {
    debug!(file_path = %file_path, "loading TSV headers");
    let file = std::fs::File::open(file_path)?;
    let mut reader = ReaderBuilder::new()
        .delimiter(b'\t')
        .has_headers(true)
        .flexible(true)
        .from_reader(file);
    Ok(reader.headers()?.clone())
}

fn get_required_header_index(headers: &StringRecord, name: &str) -> Result<usize, Box<dyn Error>> {
    debug!(required_header = %name, "resolving required header index");
    headers
        .iter()
        .position(|header| header == name)
        .ok_or_else(|| {
            format!(
                "Required header '{}' was not found in the import file",
                name
            )
            .into()
        })
}

fn get_optional_header_index(headers: &StringRecord, name: &str) -> Option<usize> {
    debug!(optional_header = %name, "resolving optional header index");
    headers.iter().position(|header| header == name)
}

fn text_expr(header_idx: Option<usize>) -> String {
    match header_idx {
        Some(index) => format!("NULLIF(TRIM(split_part(line, E'\\t', {})), '')", index + 1),
        None => "NULL".to_string(),
    }
}

fn i64_expr(header_idx: Option<usize>) -> String {
    let text = text_expr(header_idx);
    format!("CASE WHEN {text} ~ '^-?\\\\d+$' THEN {text}::bigint ELSE NULL END")
}

fn i32_expr(header_idx: Option<usize>) -> String {
    let text = text_expr(header_idx);
    format!("CASE WHEN {text} ~ '^-?\\\\d+$' THEN {text}::integer ELSE NULL END")
}

fn timestamptz_expr(header_idx: Option<usize>) -> String {
    let text = text_expr(header_idx);
    format!("{text}::timestamptz")
}

fn build_insert_from_staging_sql(headers: &StringRecord, code_index: usize) -> String {
    debug!(code_index, "building insert SQL from staging");
    let code_col = format!("TRIM(split_part(line, E'\\t', {}))", code_index + 1);

    let url = text_expr(get_optional_header_index(headers, "url"));
    let creator = text_expr(get_optional_header_index(headers, "creator"));
    let created_t = i64_expr(get_optional_header_index(headers, "created_t"));
    let created_datetime = timestamptz_expr(get_optional_header_index(headers, "created_datetime"));
    let last_modified_t = i64_expr(get_optional_header_index(headers, "last_modified_t"));
    let last_modified_datetime =
        timestamptz_expr(get_optional_header_index(headers, "last_modified_datetime"));
    let last_modified_by = text_expr(get_optional_header_index(headers, "last_modified_by"));
    let last_updated_t = i64_expr(get_optional_header_index(headers, "last_updated_t"));
    let last_updated_datetime =
        timestamptz_expr(get_optional_header_index(headers, "last_updated_datetime"));
    let product_name = text_expr(get_optional_header_index(headers, "product_name"));
    let abbreviated_product_name = text_expr(get_optional_header_index(
        headers,
        "abbreviated_product_name",
    ));
    let generic_name = text_expr(get_optional_header_index(headers, "generic_name"));
    let quantity = text_expr(get_optional_header_index(headers, "quantity"));
    let packaging = text_expr(get_optional_header_index(headers, "packaging"));
    let brands = text_expr(get_optional_header_index(headers, "brands"));
    let categories = text_expr(get_optional_header_index(headers, "categories"));
    let countries = text_expr(get_optional_header_index(headers, "countries"));
    let countries_en = text_expr(get_optional_header_index(headers, "countries_en"));
    let ingredients_text = text_expr(get_optional_header_index(headers, "ingredients_text"));
    let nutriscore_score = i32_expr(get_optional_header_index(headers, "nutriscore_score"));
    let nutriscore_grade = text_expr(get_optional_header_index(headers, "nutriscore_grade"));
    let nova_group = i32_expr(get_optional_header_index(headers, "nova_group"));
    let image_url = text_expr(get_optional_header_index(headers, "image_url"));
    let image_small_url = text_expr(get_optional_header_index(headers, "image_small_url"));
    let last_image_t = i64_expr(get_optional_header_index(headers, "last_image_t"));
    let last_image_datetime =
        timestamptz_expr(get_optional_header_index(headers, "last_image_datetime"));
    let main_category = text_expr(get_optional_header_index(headers, "main_category"));
    let main_category_en = text_expr(get_optional_header_index(headers, "main_category_en"));

    format!(
        r#"
        INSERT INTO barcode_database (
            code,
            url,
            creator,
            created_t,
            created_datetime,
            last_modified_t,
            last_modified_datetime,
            last_modified_by,
            last_updated_t,
            last_updated_datetime,
            product_name,
            abbreviated_product_name,
            generic_name,
            quantity,
            packaging,
            brands,
            categories,
            countries,
            countries_en,
            ingredients_text,
            nutriscore_score,
            nutriscore_grade,
            nova_group,
            image_url,
            image_small_url,
            last_image_t,
            last_image_datetime,
            main_category,
            main_category_en
        )
        SELECT
            {code_col},
            {url},
            {creator},
            {created_t},
            {created_datetime},
            {last_modified_t},
            {last_modified_datetime},
            {last_modified_by},
            {last_updated_t},
            {last_updated_datetime},
            {product_name},
            {abbreviated_product_name},
            {generic_name},
            {quantity},
            {packaging},
            {brands},
            {categories},
            {countries},
            {countries_en},
            {ingredients_text},
            {nutriscore_score},
            {nutriscore_grade},
            {nova_group},
            {image_url},
            {image_small_url},
            {last_image_t},
            {last_image_datetime},
            {main_category},
            {main_category_en}
        FROM barcode_staging
                WHERE id > 1
                    AND NULLIF(TRIM(split_part(line, E'\t', {code_filter_col})), '') IS NOT NULL;
        "#,
        code_filter_col = code_index + 1,
    )
}

pub async fn get_barcode(barcode: &str, pool: &PgPool) -> Result<Barcode, Box<dyn Error>> {
    debug!(barcode = %barcode, "service get_barcode called");
    let query = "select id, code, url, creator, created_t, created_datetime, last_modified_t, last_modified_datetime, last_modified_by, last_updated_t, last_updated_datetime, product_name, abbreviated_product_name, generic_name, quantity, packaging, brands, categories, countries, countries_en, ingredients_text, nutriscore_score, nutriscore_grade, nova_group, image_url, image_small_url, last_image_t, last_image_datetime, main_category, main_category_en from barcode_database where code = $1 limit 1";

    let barcode = sqlx::query_as::<_, Barcode>(query)
        .bind(barcode)
        .fetch_one(pool)
        .await?;

    debug!("service get_barcode completed");
    Ok(barcode)
}

pub async fn list_barcodes(
    pool: &PgPool,
    pagination: Pagination,
) -> Result<Vec<Barcode>, Box<dyn Error>> {
    debug!(page = ?pagination.page, per_page = ?pagination.per_page, "service list_barcodes called");
    let limit_value = pagination.per_page.unwrap_or(50);
    let offset_value = pagination.page.unwrap_or(0) * limit_value;
    let query = "select id, code, url, creator, created_t, created_datetime, last_modified_t, last_modified_datetime, last_modified_by, last_updated_t, last_updated_datetime, product_name, abbreviated_product_name, generic_name, quantity, packaging, brands, categories, countries, countries_en, ingredients_text, nutriscore_score, nutriscore_grade, nova_group, image_url, image_small_url, last_image_t, last_image_datetime, main_category, main_category_en from barcode_database order by id asc limit $1 offset $2";

    let barcodes = sqlx::query_as::<_, Barcode>(query)
        .bind(limit_value)
        .bind(offset_value)
        .fetch_all(pool)
        .await?;

    debug!(count = barcodes.len(), "service list_barcodes completed");
    Ok(barcodes)
}
