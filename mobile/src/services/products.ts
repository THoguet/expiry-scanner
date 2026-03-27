import { ref } from "vue";
import {
	createProduct,
	deleteProduct,
	editProduct,
	getProductsWithBarcode,
	getProductPrefill,
	uploadProductImage,
	ProductWithBarcode,
} from "./backend";
import { CLIENT_ID } from "../main";
import type { CreateProduct } from "../bindings/CreateProduct";
import type { DeleteProduct } from "../bindings/DeleteProduct";
import type { Product } from "../bindings/Product";
import { EditProduct } from "../bindings/EditProduct";
import type { ProductPrefill } from "../bindings/ProductPrefill";
import type { UploadProductImageResponse } from "../bindings/UploadProductImageResponse";
import { cancelNotificationsForProduct, updateNotifications } from "./notifications";
import { logger } from "./logger";

const CACHE_TTL_MS = 60_000;

type ProductsCacheEntry = {
	products: ProductWithBarcode[];
	cachedAt: number;
};

const cacheByClientId = new Map<string, ProductsCacheEntry>();
const inFlightRequestsByClientId = new Map<
	string,
	Promise<ProductWithBarcode[]>
>();

const products = ref<ProductWithBarcode[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

function isCacheFresh(cacheEntry: ProductsCacheEntry): boolean {
	return Date.now() - cacheEntry.cachedAt < CACHE_TTL_MS;
}

async function getProductsWithBarcodeCached(
	clientId: string,
	forceRefresh: boolean = false,
): Promise<ProductWithBarcode[]> {
	if (!forceRefresh) {
		const cached = cacheByClientId.get(clientId);
		if (cached && isCacheFresh(cached)) {
			logger.trace("Using fresh products cache", {
				clientId,
				count: cached.products.length,
			});
			return cached.products;
		}

		const inFlightRequest = inFlightRequestsByClientId.get(clientId);
		if (inFlightRequest) {
			logger.trace("Reusing in-flight products request", { clientId });
			return inFlightRequest;
		}
	}

	logger.debug("Fetching products with barcode from backend", { clientId, forceRefresh });
	const request = getProductsWithBarcode(clientId)
		.then((products) => {
			logger.debug("Products fetched from backend", {
				clientId,
				count: products.length,
			});
			cacheByClientId.set(clientId, {
				products,
				cachedAt: Date.now(),
			});
			return products;
		})
		.finally(() => {
			inFlightRequestsByClientId.delete(clientId);
		});

	inFlightRequestsByClientId.set(clientId, request);
	return request;
}

export function invalidateProductsCache(clientId?: string): void {
	if (clientId) {
		logger.debug("Invalidating products cache for client", { clientId });
		cacheByClientId.delete(clientId);
		inFlightRequestsByClientId.delete(clientId);
		return;
	}

	logger.debug("Invalidating products cache for all clients");
	cacheByClientId.clear();
	inFlightRequestsByClientId.clear();
}

export async function addProduct(payload: CreateProduct): Promise<Product> {
	logger.info("Adding product", { barcode: payload.barcode, clientId: payload.client_id });
	const createdProduct = await createProduct(payload);
	await useProducts().refreshProducts();
	updateNotifications(useProducts().products.value);
	logger.info("Product added and notifications refreshed", {
		productId: createdProduct.id.toString(),
	});
	return createdProduct;
}

export async function removeProduct(payload: DeleteProduct): Promise<void> {
	const productToRemove = useProducts().products.value.find(
		([product]) => product.id === payload.id,
	)?.[0];

	if (productToRemove) {
		try {
			await cancelNotificationsForProduct(productToRemove);
		} catch (notificationError) {
			// Deletion should proceed even if notification cancellation fails.
			logger.warn("Failed to cancel notifications for product", {
				productId: productToRemove.id.toString(),
				error: notificationError,
			});
		}
	}

	logger.info("Removing product", {
		productId: payload.id.toString(),
		clientId: payload.client_id,
	});
	await deleteProduct(payload);
	await useProducts().refreshProducts();
	updateNotifications(useProducts().products.value);
	logger.info("Product removed and notifications refreshed", {
		productId: payload.id.toString(),
	});
}

export async function saveEditedProduct(
	payload: EditProduct,
): Promise<Product> {
	logger.info("Saving edited product", {
		productId: payload.id.toString(),
		clientId: payload.client_id,
	});
	const updatedProduct = await editProduct(payload);
	await useProducts().refreshProducts();
	updateNotifications(useProducts().products.value);
	logger.info("Edited product saved and notifications refreshed", {
		productId: updatedProduct.id.toString(),
	});
	return updatedProduct;
}

export function useProducts(clientId: string = CLIENT_ID) {
	async function loadProducts(forceRefresh: boolean = false): Promise<void> {
		loading.value = true;
		error.value = null;

		try {
			products.value = await getProductsWithBarcodeCached(
				clientId,
				forceRefresh,
			);
			logger.debug("Products loaded into state", {
				clientId,
				count: products.value.length,
				forceRefresh,
			});
		} catch (backendError) {
			logger.error("Failed to load products", {
				clientId,
				error: backendError,
			});
			error.value = "Failed to load products";
		} finally {
			loading.value = false;
		}
	}

	async function refreshProducts(): Promise<void> {
		logger.debug("Refreshing products", { clientId });
		invalidateProductsCache(clientId);
		await loadProducts(true);
	}

	async function getPrefill(barcode: string): Promise<ProductPrefill> {
		return await getProductPrefill(barcode, clientId);
	}

	async function uploadImage(
		barcode: string,
		imageFile: File,
	): Promise<UploadProductImageResponse> {
		return await uploadProductImage(barcode, clientId, imageFile);
	}

	return {
		products,
		loading,
		error,
		loadProducts,
		refreshProducts,
		getPrefill,
		uploadImage,
	};
}
