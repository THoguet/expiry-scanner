import { ref } from "vue";
import { CLIENT_ID } from "../main";
import type { Stock } from "../bindings/Stock";
import type { CreateStock } from "../bindings/CreateStock";
import type { EditStock } from "../bindings/EditStock";
import {
	adjustStockByDelta,
	createStock,
	deleteStock,
	editStock,
	getStocks,
} from "./backend";
import { logger } from "./logger";

const stocks = ref<Stock[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

export function useStocks(clientId: string = CLIENT_ID) {
	function upsertLocalStock(updatedStock: Stock): void {
		const index = stocks.value.findIndex((stock) => stock.id === updatedStock.id);
		if (index === -1) {
			stocks.value.push(updatedStock);
			return;
		}

		stocks.value[index] = updatedStock;
	}

	async function loadStocks(): Promise<void> {
		loading.value = true;
		error.value = null;

		try {
			stocks.value = await getStocks(clientId);
			logger.debug("Stocks loaded into state", { clientId, count: stocks.value.length });
		} catch (backendError) {
			logger.error("Failed to load stocks", backendError);
			error.value = "Failed to load stocks";
		} finally {
			loading.value = false;
		}
	}

	async function refreshStocks(): Promise<void> {
		await loadStocks();
	}

	async function addStock(payload: Omit<CreateStock, "client_id">): Promise<Stock> {
		logger.info("Adding stock", {
			name: payload.name,
			clientId,
		});
		const createdStock = await createStock({
			...payload,
			client_id: clientId,
		});
		await refreshStocks();
		logger.info("Stock created", { stockId: createdStock.id.toString(), clientId });
		return createdStock;
	}

	async function updateStock(
		stockId: Stock["id"],
		payload: Omit<EditStock, "id" | "client_id">,
		options: { refresh?: boolean } = {},
	): Promise<Stock> {
		const { refresh = true } = options;
		logger.debug("Updating stock", {
			stockId: stockId.toString(),
			clientId,
			refresh,
		});
		const updatedStock = await editStock({
			id: stockId,
			...payload,
			client_id: clientId,
		});

		if (refresh) {
			await refreshStocks();
			const refreshedStock = stocks.value.find((stock) => stock.id === stockId);
			if (refreshedStock) {
				return refreshedStock;
			}

			if (updatedStock) {
				return updatedStock;
			}

			throw new Error("Failed to update stock");
		} else {
			if (updatedStock) {
				upsertLocalStock(updatedStock);
			}

			const currentStock = stocks.value.find((stock) => stock.id === stockId);
			if (currentStock) {
				return currentStock;
			}

			if (updatedStock) {
				return updatedStock;
			}

			throw new Error("Failed to update stock");
		}
	}

	async function removeStockById(stockId: Stock["id"]): Promise<void> {
		logger.info("Removing stock", { stockId: stockId.toString(), clientId });
		await deleteStock({
			id: stockId,
			client_id: clientId,
		});
		await refreshStocks();
		logger.info("Stock removed", { stockId: stockId.toString(), clientId });
	}

	async function adjustStockQuantity(stockId: Stock["id"], delta: number): Promise<Stock> {
		logger.debug("Adjusting stock quantity", {
			stockId: stockId.toString(),
			delta,
			clientId,
		});
		const updatedStock = await adjustStockByDelta(stockId, {
			client_id: clientId,
			delta,
		});
		await refreshStocks();
		logger.debug("Stock quantity adjusted", {
			stockId: updatedStock.id.toString(),
			currentQuantity: updatedStock.current_quantity,
		});
		return updatedStock;
	}

	return {
		stocks,
		loading,
		error,
		loadStocks,
		refreshStocks,
		addStock,
		updateStock,
		removeStockById,
		adjustStockQuantity,
	};
}
