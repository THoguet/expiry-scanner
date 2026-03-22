import type { CreateProduct } from "../bindings/CreateProduct";
import type { DeleteProduct } from "../bindings/DeleteProduct";
import type { Product } from "../bindings/Product";
import type { Barcode } from "../bindings/Barcode";
import { EditProduct } from "../bindings/EditProduct";
import type { ProductPrefill } from "../bindings/ProductPrefill";
import type { UploadProductImageResponse } from "../bindings/UploadProductImageResponse";

const DEFAULT_BACKEND_URL = "http://192.168.1.22:3000";

function getBaseUrl(): string {
	const configuredUrl = null;
	// if (!configuredUrl) {
	return DEFAULT_BACKEND_URL;
	// }

	// return configuredUrl.replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T | undefined> {
	const response = await fetch(`${getBaseUrl()}${path}`, {
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
		...init,
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Backend request failed (${response.status}): ${body}`);
	}

	if (response.status === 204) {
		return undefined;
	}

	return response.json() as Promise<T>;
}


export async function getProducts(clientId: string): Promise<Product[]> {
	const products = await request<Product[]>(`/products?client_id=${encodeURIComponent(clientId)}`);
	if (!products) return [];
	return products;
}

export async function createProduct(payload: CreateProduct): Promise<Product> {
	const created = await request<Product>("/products", {
		method: "POST",
		body: JSON.stringify(payload),
	});

	if (!created) {
		throw new Error("Failed to create product");
	}

	return created;
}

export async function deleteProduct(payload: DeleteProduct): Promise<void> {
	await request<void>("/products", {
		method: "DELETE",
		body: JSON.stringify(payload),
	});
}

export async function editProduct(payload: EditProduct): Promise<Product> {
	const updated = await request<Product>("/products", {
		method: "PUT",
		body: JSON.stringify(payload),
	});

	if (!updated) {
		throw new Error("Failed to edit product");
	}

	return updated;
}

export type ProductWithBarcode = [Product, Barcode | null];

export async function getProductsWithBarcode(clientId: string): Promise<ProductWithBarcode[]> {
	const products = await request<ProductWithBarcode[]>(`/products/with-barcode?client_id=${encodeURIComponent(clientId)}`);
	if (!products) return [];
	return products;
}

export async function getProductPrefill(
	barcode: string,
	clientId: string,
): Promise<ProductPrefill> {
	const prefill = await request<ProductPrefill>(
		`/products/prefill/${encodeURIComponent(barcode)}?client_id=${encodeURIComponent(clientId)}`,
	);

	if (!prefill) {
		throw new Error("Failed to get product prefill");
	}

	return prefill;
}

export async function uploadProductImage(
	barcode: string,
	clientId: string,
	imageFile: File,
): Promise<UploadProductImageResponse> {
	const formData = new FormData();
	formData.append("image", imageFile);

	const baseUrl = import.meta.env.VITE_BACKEND_URL?.trim() || "https://expiry.nessar.fr";
	const response = await fetch(
		`${baseUrl.replace(/\/$/, "")}/products/image/${encodeURIComponent(barcode)}?client_id=${encodeURIComponent(clientId)}`,
		{
			method: "POST",
			body: formData,
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Image upload failed (${response.status}): ${body}`);
	}

	const result = (await response.json()) as UploadProductImageResponse;
	return result;
}