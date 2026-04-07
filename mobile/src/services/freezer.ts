import { ref } from "vue";
import { CLIENT_ID } from "../main";
import type { FrozenProduct } from "../bindings/FrozenProduct";
import type { FreezeProduct } from "../bindings/FreezeProduct";
import type { Product } from "../bindings/Product";
import {
	freezeProduct,
	getFrozenProducts,
	unfreezeProduct,
} from "./backend";
import { invalidateProductsCache, useProducts } from "./products";
import { updateNotifications } from "./notifications";
import { logger } from "./logger";

const frozenProducts = ref<FrozenProduct[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

export function useFreezer(clientId: string = CLIENT_ID) {
	async function loadFrozenProducts(): Promise<void> {
		loading.value = true;
		error.value = null;

		try {
			frozenProducts.value = await getFrozenProducts(clientId);
			logger.debug("Frozen products loaded", {
				clientId,
				count: frozenProducts.value.length,
			});
		} catch (backendError) {
			logger.error("Failed to load frozen products", {
				clientId,
				error: backendError,
			});
			error.value = "Failed to load frozen products";
		} finally {
			loading.value = false;
		}
	}

	async function refreshFrozenProducts(): Promise<void> {
		await loadFrozenProducts();
	}

	async function freeze(
		productId: bigint,
		totalPortions: number,
		keepInFridge: number,
	): Promise<FrozenProduct[]> {
		logger.info("Freezing product", {
			productId: productId.toString(),
			totalPortions,
			keepInFridge,
			clientId,
		});

		const payload: FreezeProduct = {
			product_id: productId,
			client_id: clientId,
			total_portions: totalPortions,
			keep_in_fridge: keepInFridge,
		};

		const frozen = await freezeProduct(payload);
		await refreshFrozenProducts();

		invalidateProductsCache(clientId);
		await useProducts(clientId).loadProducts(true);
		updateNotifications(useProducts(clientId).products.value);

		logger.info("Product frozen successfully", {
			frozenCount: frozen.length,
			productId: productId.toString(),
		});

		return frozen;
	}

	async function unfreeze(frozenProductId: bigint): Promise<Product> {
		logger.info("Unfreezing product", {
			frozenProductId: frozenProductId.toString(),
			clientId,
		});

		const product = await unfreezeProduct({
			frozen_product_id: frozenProductId,
			client_id: clientId,
		});

		await refreshFrozenProducts();

		invalidateProductsCache(clientId);
		await useProducts(clientId).loadProducts(true);
		updateNotifications(useProducts(clientId).products.value);

		logger.info("Product unfrozen successfully", {
			newProductId: product.id.toString(),
			expiryDate: product.expiration_date,
		});

		return product;
	}

	return {
		frozenProducts,
		loading,
		error,
		loadFrozenProducts,
		refreshFrozenProducts,
		freeze,
		unfreeze,
	};
}
