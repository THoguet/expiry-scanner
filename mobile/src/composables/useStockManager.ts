import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import { join, tempDir } from "@tauri-apps/api/path";
import { BaseDirectory, writeTextFile } from "@tauri-apps/plugin-fs";
import { shareFile } from "tauri-plugin-share";
import type { Stock } from "../bindings/Stock";
import { useStocks } from "../services/stocks";

type SaveState = "idle" | "saving" | "saved" | "error";

export function useStockManager() {
	const { stocks, loading, error, loadStocks, addStock, updateStock, removeStockById } = useStocks();

	const creatingStock = ref(false);
	const shareLoading = ref(false);
	const errorMessage = ref<string | null>(null);
	const statusMessage = ref<string | null>(null);
	const searchQuery = ref("");
	const displayOrder = ref<Stock["id"][]>([]);
	const detailedLineView = ref<Record<string, boolean>>({});
	const lineSaveStates = ref<Record<string, SaveState>>({});

	const saveDebounceMs = 650;
	const pendingSaves = new Map<string, number>();
	const clearSaveFeedbackTimers = new Map<string, number>();

	const newStock = ref({
		name: "",
		desired_quantity: 1,
		current_quantity: 0,
		unit: "",
		location: "",
	});

	onMounted(async () => {
		await loadStocks();
		resetDisplayOrder();
	});

	onBeforeUnmount(() => {
		for (const timeoutId of pendingSaves.values()) {
			window.clearTimeout(timeoutId);
		}
		for (const timeoutId of clearSaveFeedbackTimers.values()) {
			window.clearTimeout(timeoutId);
		}
		pendingSaves.clear();
		clearSaveFeedbackTimers.clear();
	});

	const filteredStocks = computed(() => {
		const term = searchQuery.value.trim().toLowerCase();
		const orderIndex = new Map(displayOrder.value.map((id, index) => [id.toString(), index]));

		const orderedStocks = [...stocks.value].sort((left, right) => {
			const leftIndex = orderIndex.get(left.id.toString()) ?? Number.MAX_SAFE_INTEGER;
			const rightIndex = orderIndex.get(right.id.toString()) ?? Number.MAX_SAFE_INTEGER;
			return leftIndex - rightIndex;
		});

		if (!term) return orderedStocks;

		return orderedStocks.filter((stock) => {
			const haystack = [stock.name, stock.unit, stock.location]
				.filter((value): value is string => Boolean(value))
				.map((value) => value.toLowerCase());

			return haystack.some((value) => value.includes(term));
		});
	});

	function normalizeQuantity(value: number): number {
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.trunc(value));
	}

	function normalizeOptionalText(value: string | null): string | null {
		if (!value) return null;
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	function normalizeRequiredText(value: string): string {
		return value.trim();
	}

	function getStockKey(stockId: Stock["id"]): string {
		return stockId.toString();
	}

	function isLineDetailed(stockId: Stock["id"]): boolean {
		return detailedLineView.value[getStockKey(stockId)] ?? false;
	}

	function toggleLineView(stockId: Stock["id"]): void {
		const key = getStockKey(stockId);
		detailedLineView.value = {
			...detailedLineView.value,
			[key]: !isLineDetailed(stockId),
		};
	}

	function getLineSaveState(stockId: Stock["id"]): SaveState {
		return lineSaveStates.value[getStockKey(stockId)] ?? "idle";
	}

	function setLineSaveState(stockId: Stock["id"], saveState: SaveState): void {
		lineSaveStates.value = {
			...lineSaveStates.value,
			[getStockKey(stockId)]: saveState,
		};
	}

	function clearSaveFeedbackLater(stockId: Stock["id"], delayMs: number = 1200): void {
		const key = getStockKey(stockId);
		const existingTimeout = clearSaveFeedbackTimers.get(key);
		if (existingTimeout !== undefined) {
			window.clearTimeout(existingTimeout);
		}

		const timeoutId = window.setTimeout(() => {
			clearSaveFeedbackTimers.delete(key);
			setLineSaveState(stockId, "idle");
		}, delayMs);

		clearSaveFeedbackTimers.set(key, timeoutId);
	}

	function resetDisplayOrder(): void {
		displayOrder.value = [...stocks.value]
			.sort((left, right) => {
				const missingRight = getMissingQuantity(right);
				const missingLeft = getMissingQuantity(left);
				if (missingRight !== missingLeft) {
					return missingRight - missingLeft;
				}

				return left.name.localeCompare(right.name);
			})
			.map((stock) => stock.id);
	}

	function queueDebouncedSave(stock: Stock): void {
		const key = stock.id.toString();
		const previousTimeout = pendingSaves.get(key);
		if (previousTimeout !== undefined) {
			window.clearTimeout(previousTimeout);
		}
		setLineSaveState(stock.id, "saving");

		const timeoutId = window.setTimeout(async () => {
			pendingSaves.delete(key);
			try {
				await updateStock(
					stock.id,
					{
						name: normalizeRequiredText(stock.name),
						desired_quantity: normalizeQuantity(stock.desired_quantity),
						current_quantity: normalizeQuantity(stock.current_quantity),
						unit: normalizeOptionalText(stock.unit),
						location: normalizeOptionalText(stock.location),
					},
					{ refresh: false },
				);
				setLineSaveState(stock.id, "saved");
				clearSaveFeedbackLater(stock.id);
			} catch (saveError) {
				console.error(saveError);
				setLineSaveState(stock.id, "error");
				clearSaveFeedbackLater(stock.id, 2200);
				setTimedMessage("Oops, failed to save stock changes", true);
			}
		}, saveDebounceMs);

		pendingSaves.set(key, timeoutId);
	}

	function getMissingQuantity(stock: Stock): number {
		const desired = normalizeQuantity(stock.desired_quantity);
		const current = normalizeQuantity(stock.current_quantity);
		return Math.max(0, desired - current);
	}

	function quantitySummary(stock: Stock): string {
		const current = normalizeQuantity(stock.current_quantity);
		const desired = normalizeQuantity(stock.desired_quantity);
		const unit = normalizeOptionalText(stock.unit);
		const location = normalizeOptionalText(stock.location);
		const base = unit ? `${current}/${desired} ${unit}` : `${current}/${desired}`;

		return location ? `${base} in ${location}` : base;
	}

	function getStockStateClass(stock: Stock): "critical" | "warning" | "ok" {
		const missing = getMissingQuantity(stock);
		if (missing >= 3) return "critical";
		if (missing > 0) return "warning";
		return "ok";
	}

	function getStockStateLabel(stock: Stock): string {
		const missing = getMissingQuantity(stock);
		if (missing === 0) return "Stocked";

		const unit = normalizeOptionalText(stock.unit);
		const amount = unit ? `${missing} ${unit}` : `${missing}`;
		return `Missing ${amount}`;
	}

	function clearMessages(): void {
		errorMessage.value = null;
		statusMessage.value = null;
	}

	function setTimedMessage(message: string, isError: boolean = false): void {
		if (isError) {
			errorMessage.value = message;
			statusMessage.value = null;
		} else {
			statusMessage.value = message;
			errorMessage.value = null;
		}

		setTimeout(() => {
			errorMessage.value = null;
			statusMessage.value = null;
		}, 2500);
	}

	async function createNewStock(): Promise<void> {
		clearMessages();
		creatingStock.value = true;

		try {
			const name = normalizeRequiredText(newStock.value.name);
			if (!name) {
				setTimedMessage("Name is required", true);
				return;
			}

			await addStock({
				name,
				desired_quantity: normalizeQuantity(newStock.value.desired_quantity),
				current_quantity: normalizeQuantity(newStock.value.current_quantity),
				unit: normalizeOptionalText(newStock.value.unit),
				location: normalizeOptionalText(newStock.value.location),
			});

			newStock.value = {
				name: "",
				desired_quantity: 1,
				current_quantity: 0,
				unit: "",
				location: "",
			};
			resetDisplayOrder();
			setTimedMessage("Nice! Stock line added");
		} catch (saveError) {
			console.error(saveError);
			setTimedMessage("Oops, failed to add stock line", true);
		} finally {
			creatingStock.value = false;
		}
	}

	async function save(stock: Stock): Promise<void> {
		clearMessages();
		const key = getStockKey(stock.id);
		const pendingSave = pendingSaves.get(key);
		if (pendingSave !== undefined) {
			window.clearTimeout(pendingSave);
			pendingSaves.delete(key);
		}
		setLineSaveState(stock.id, "saving");
		try {
			const name = normalizeRequiredText(stock.name);
			if (!name) {
				setTimedMessage("Name is required", true);
				setLineSaveState(stock.id, "error");
				clearSaveFeedbackLater(stock.id, 2200);
				return;
			}

			await updateStock(
				stock.id,
				{
					name,
					desired_quantity: normalizeQuantity(stock.desired_quantity),
					current_quantity: normalizeQuantity(stock.current_quantity),
					unit: normalizeOptionalText(stock.unit),
					location: normalizeOptionalText(stock.location),
				},
				{ refresh: false },
			);
			setLineSaveState(stock.id, "saved");
			clearSaveFeedbackLater(stock.id);
			setTimedMessage("Sweet! Stock line saved");
		} catch (saveError) {
			console.error(saveError);
			setLineSaveState(stock.id, "error");
			clearSaveFeedbackLater(stock.id, 2200);
			setTimedMessage("Oops, failed to save stock line", true);
		}
	}

	async function increment(stock: Stock): Promise<void> {
		clearMessages();
		try {
			stock.current_quantity = normalizeQuantity(stock.current_quantity + 1);
			queueDebouncedSave(stock);
		} catch (adjustError) {
			console.error(adjustError);
			setTimedMessage("Oops, failed to increase stock", true);
		}
	}

	async function decrement(stock: Stock): Promise<void> {
		clearMessages();
		try {
			stock.current_quantity = normalizeQuantity(stock.current_quantity - 1);
			queueDebouncedSave(stock);
		} catch (adjustError) {
			console.error(adjustError);
			setTimedMessage("Oops, failed to decrease stock", true);
		}
	}

	async function remove(stockId: Stock["id"]): Promise<void> {
		clearMessages();
		try {
			await removeStockById(stockId);
			const key = getStockKey(stockId);
			const nextDetailedView = { ...detailedLineView.value };
			delete nextDetailedView[key];
			detailedLineView.value = nextDetailedView;

			const nextSaveStates = { ...lineSaveStates.value };
			delete nextSaveStates[key];
			lineSaveStates.value = nextSaveStates;

			resetDisplayOrder();
			setTimedMessage("Done! Stock line deleted");
		} catch (deleteError) {
			console.error(deleteError);
			setTimedMessage("Oops, failed to delete stock line", true);
		}
	}

	function buildGroceryText(): string {
		const shouldBuy = stocks.value
			.map((stock) => {
				const desired = normalizeQuantity(stock.desired_quantity);
				const current = normalizeQuantity(stock.current_quantity);
				const missing = getMissingQuantity(stock);
				if (missing === 0) return null;

				const name = normalizeRequiredText(stock.name) || "Unnamed";
				const unit = normalizeOptionalText(stock.unit);
				const location = normalizeOptionalText(stock.location);
				const totalText = unit ? `${current}/${desired} ${unit}` : `${current}/${desired}`;
				const missingText = unit ? `${missing} ${unit}` : `${missing}`;
				const locationText = location ? ` (${location})` : "";

				return `- ${name}: ${totalText} (need ${missingText})${locationText}`;
			})
			.filter((line): line is string => line !== null);

		const stocked = stocks.value
			.map((stock) => {
				const desired = normalizeQuantity(stock.desired_quantity);
				const current = normalizeQuantity(stock.current_quantity);
				if (current < desired) return null;

				const name = normalizeRequiredText(stock.name) || "Unnamed";
				const unit = normalizeOptionalText(stock.unit);
				const location = normalizeOptionalText(stock.location);
				const quantityText = unit ? `${current}/${desired} ${unit}` : `${current}/${desired}`;
				const locationText = location ? ` (${location})` : "";

				return `- ${name}: ${quantityText}${locationText}`;
			})
			.filter((line): line is string => line !== null);

		const shouldBuyLines = shouldBuy.length > 0
			? shouldBuy
			: ["- Nothing needed right now."];

		const stockedLines = stocked.length > 0
			? stocked
			: ["- No fully stocked items yet."];

		return [
			"Grocery list",
			"",
			`Need to buy (${shouldBuy.length})`,
			...shouldBuyLines,
			"",
			`Already stocked (${stocked.length})`,
			...stockedLines,
		].join("\n");
	}

	function isTauriMobile(): boolean {
		if (!isTauri()) return false;
		const userAgent = window.navigator.userAgent.toLowerCase();
		return userAgent.includes("android") || userAgent.includes("iphone") || userAgent.includes("ipad");
	}

	async function shareWithNativeMobileSheet(text: string): Promise<boolean> {
		if (!isTauriMobile()) return false;

		try {
			const fileName = `grocery-list-${Date.now()}.txt`;
			await writeTextFile(fileName, text, {
				baseDir: BaseDirectory.Temp,
			});
			const tempPath = await join(await tempDir(), fileName);
			await shareFile(tempPath, "text/plain");
			return true;
		} catch (shareError) {
			console.warn("Native share plugin failed, falling back", shareError);
			return false;
		}
	}

	async function shareGroceryList(): Promise<void> {
		clearMessages();
		shareLoading.value = true;

		const text = buildGroceryText();
		try {
			if (await shareWithNativeMobileSheet(text)) {
				setTimedMessage("Nice! Grocery list shared");
				return;
			}

			if (navigator.share) {
				await navigator.share({
					title: "Grocery list",
					text,
				});
				setTimedMessage("Nice! Grocery list shared");
				return;
			}

			await navigator.clipboard.writeText(text);
			setTimedMessage("Nice! Grocery list copied to clipboard");
		} catch (shareError) {
			console.error(shareError);
			setTimedMessage("Oops, failed to share grocery list", true);
		} finally {
			shareLoading.value = false;
		}
	}

	return {
		stocks,
		loading,
		error,
		creatingStock,
		shareLoading,
		errorMessage,
		statusMessage,
		searchQuery,
		filteredStocks,
		newStock,
		isLineDetailed,
		toggleLineView,
		getLineSaveState,
		getStockStateClass,
		getStockStateLabel,
		quantitySummary,
		createNewStock,
		save,
		increment,
		decrement,
		remove,
		shareGroceryList,
	};
}
