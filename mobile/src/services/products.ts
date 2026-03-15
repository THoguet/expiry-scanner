import { ref } from "vue";
import {
	createProduct,
	deleteProduct,
	editProduct,
	getProductsWithBarcode,
	ProductWithBarcode,
} from "./backend";
import { CLIENT_ID } from "../main";
import type { CreateProduct } from "../bindings/CreateProduct";
import type { DeleteProduct } from "../bindings/DeleteProduct";
import type { Product } from "../bindings/Product";
import { EditProduct } from "../bindings/EditProduct";
import { cancelNotificationsForProduct, updateNotifications } from "./notifications";

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
			return cached.products;
		}

		const inFlightRequest = inFlightRequestsByClientId.get(clientId);
		if (inFlightRequest) {
			return inFlightRequest;
		}
	}

	const request = getProductsWithBarcode(clientId)
		.then((products) => {
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
		cacheByClientId.delete(clientId);
		inFlightRequestsByClientId.delete(clientId);
		return;
	}

	cacheByClientId.clear();
	inFlightRequestsByClientId.clear();
}

export async function addProduct(payload: CreateProduct): Promise<Product> {
	const createdProduct = await createProduct(payload);
	await useProducts().refreshProducts();
	updateNotifications(useProducts().products.value);
	return createdProduct;
}

export async function removeProduct(payload: DeleteProduct): Promise<void> {
	const productToRemove = useProducts().products.value.find(
		([product]) => product.id === payload.id && product.client_id === payload.client_id,
	)?.[0];

	if (productToRemove) {
		await cancelNotificationsForProduct(productToRemove);
	}

	await deleteProduct(payload);
	await useProducts().refreshProducts();
	updateNotifications(useProducts().products.value);
}

export async function saveEditedProduct(
	payload: EditProduct,
): Promise<Product> {
	const updatedProduct = await editProduct(payload);
	await useProducts().refreshProducts();
	updateNotifications(useProducts().products.value);
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
		} catch (backendError) {
			console.error(backendError);
			error.value = "Failed to load products";
		} finally {
			loading.value = false;
		}
	}

	async function refreshProducts(): Promise<void> {
		invalidateProductsCache(clientId);
		await loadProducts(true);
	}

	return {
		products,
		loading,
		error,
		loadProducts,
		refreshProducts,
	};
}
