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
		} catch (backendError) {
			console.error(backendError);
			error.value = "Failed to load stocks";
		} finally {
			loading.value = false;
		}
	}

	async function refreshStocks(): Promise<void> {
		await loadStocks();
	}

	async function addStock(payload: Omit<CreateStock, "client_id">): Promise<Stock> {
		const createdStock = await createStock({
			...payload,
			client_id: clientId,
		});
		await refreshStocks();
		return createdStock;
	}

	async function updateStock(
		stockId: Stock["id"],
		payload: Omit<EditStock, "id" | "client_id">,
		options: { refresh?: boolean } = {},
	): Promise<Stock> {
		const { refresh = true } = options;
		const updatedStock = await editStock({
			id: stockId,
			...payload,
			client_id: clientId,
		});

		if (refresh) {
			await refreshStocks();
		} else {
			upsertLocalStock(updatedStock);
		}

		return updatedStock;
	}

	async function removeStockById(stockId: Stock["id"]): Promise<void> {
		await deleteStock({
			id: stockId,
			client_id: clientId,
		});
		await refreshStocks();
	}

	async function adjustStockQuantity(stockId: Stock["id"], delta: number): Promise<Stock> {
		const updatedStock = await adjustStockByDelta(stockId, {
			client_id: clientId,
			delta,
		});
		await refreshStocks();
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
