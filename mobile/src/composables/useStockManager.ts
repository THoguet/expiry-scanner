import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isTauri } from "@tauri-apps/api/core";
import { shareText } from "@buildyourwebapp/tauri-plugin-sharesheet";
import type { Stock } from "../bindings/Stock";
import { useStocks } from "../services/stocks";
import { useToast } from "../services/toast";
import { logger } from "../services/logger";

type SaveState = "idle" | "saving" | "saved" | "error";

export function useStockManager() {
	const { stocks, loading, error, loadStocks, addStock, updateStock, removeStockById } = useStocks();
	const toast = useToast();

	const creatingStock = ref(false);
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
		logger.info("Stock manager mounted, loading stocks");
		await loadStocks();
		resetDisplayOrder();
		logger.debug("Stock manager ready", { count: stocks.value.length });
	});

	watch(error, (nextError, prevError) => {
		if (nextError && nextError !== prevError) {
			toast.error(nextError);
		}
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
			const savingToastId = toast.show("Saving stock changes...", "success");
			try {
				logger.debug("Debounced stock save started", {
					stockId: stock.id.toString(),
					name: stock.name,
				});
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
				toast.success("Stock line saved");
			} catch (saveError) {
				logger.error("Debounced stock save failed", {
					stockId: stock.id.toString(),
					error: saveError,
				});
				setLineSaveState(stock.id, "error");
				clearSaveFeedbackLater(stock.id, 2200);
				toast.error("Oops, failed to save stock changes");
			} finally {
				toast.dismiss(savingToastId);
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

	async function createNewStock(): Promise<void> {
		creatingStock.value = true;

		try {
			const name = normalizeRequiredText(newStock.value.name);
			if (!name) {
				logger.warn("Create stock rejected because name is empty");
				toast.error("Name is required");
				return;
			}

			logger.info("Creating new stock from manager", { name });
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
			toast.success("Nice! Stock line added");
		} catch (saveError) {
			logger.error("Failed to create stock from manager", { error: saveError });
			toast.error("Oops, failed to add stock line");
		} finally {
			creatingStock.value = false;
		}
	}

	async function save(stock: Stock): Promise<void> {
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
				logger.warn("Manual stock save rejected because name is empty", {
					stockId: stock.id.toString(),
				});
				toast.error("Name is required");
				setLineSaveState(stock.id, "error");
				clearSaveFeedbackLater(stock.id, 2200);
				return;
			}

			logger.debug("Manual stock save started", {
				stockId: stock.id.toString(),
				name,
			});
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
			toast.success("Sweet! Stock line saved");
		} catch (saveError) {
			logger.error("Manual stock save failed", {
				stockId: stock.id.toString(),
				error: saveError,
			});
			setLineSaveState(stock.id, "error");
			clearSaveFeedbackLater(stock.id, 2200);
			toast.error("Oops, failed to save stock line");
		}
	}

	async function increment(stock: Stock): Promise<void> {
		try {
			stock.current_quantity = normalizeQuantity(stock.current_quantity + 1);
			logger.trace("Incremented stock locally", {
				stockId: stock.id.toString(),
				currentQuantity: stock.current_quantity,
			});
			queueDebouncedSave(stock);
		} catch (adjustError) {
			logger.error("Failed to increment stock", {
				stockId: stock.id.toString(),
				error: adjustError,
			});
			toast.error("Oops, failed to increase stock");
		}
	}

	async function decrement(stock: Stock): Promise<void> {
		try {
			stock.current_quantity = normalizeQuantity(stock.current_quantity - 1);
			logger.trace("Decremented stock locally", {
				stockId: stock.id.toString(),
				currentQuantity: stock.current_quantity,
			});
			queueDebouncedSave(stock);
		} catch (adjustError) {
			logger.error("Failed to decrement stock", {
				stockId: stock.id.toString(),
				error: adjustError,
			});
			toast.error("Oops, failed to decrease stock");
		}
	}

	async function remove(stockId: Stock["id"]): Promise<void> {
		try {
			logger.info("Removing stock from manager", { stockId: stockId.toString() });
			await removeStockById(stockId);
			const key = getStockKey(stockId);
			const nextDetailedView = { ...detailedLineView.value };
			delete nextDetailedView[key];
			detailedLineView.value = nextDetailedView;

			const nextSaveStates = { ...lineSaveStates.value };
			delete nextSaveStates[key];
			lineSaveStates.value = nextSaveStates;

			resetDisplayOrder();
			toast.success("Done! Stock line deleted");
		} catch (deleteError) {
			logger.error("Failed to delete stock from manager", {
				stockId: stockId.toString(),
				error: deleteError,
			});
			toast.error("Oops, failed to delete stock line");
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

	function shouldAttemptNativeSharePlugin(): boolean {
		if (!isTauri()) return false;

		const userAgent = window.navigator.userAgent.toLowerCase();
		const looksMobileUserAgent = userAgent.includes("android") || userAgent.includes("iphone") || userAgent.includes("ipad");
		const hasWebShare = typeof navigator.share === "function";

		// Some Android webviews hide mobile markers or Web Share; keep plugin path available.
		return looksMobileUserAgent || !hasWebShare;
	}

	async function shareWithNativeMobileSheet(text: string): Promise<boolean> {
		if (!shouldAttemptNativeSharePlugin()) return false;

		try {
			logger.debug("Sharing grocery list with native mobile share sheet", {
				length: text.length,
			});
			await shareText(text);
			return true;
		} catch (shareError) {
			logger.warn("Native share plugin failed, falling back", { error: shareError });
			return false;
		}
	}

	async function shareGroceryList(): Promise<void> {
		const text = buildGroceryText();
		logger.info("Sharing grocery list", {
			lines: text.split("\n").length,
			length: text.length,
		});
		try {
			if (await shareWithNativeMobileSheet(text)) {
				toast.success("Nice! Grocery list shared");
				return;
			}

			if (navigator.share) {
				await navigator.share({
					title: "Grocery list",
					text,
				});
				toast.success("Nice! Grocery list shared");
				return;
			}

			await navigator.clipboard.writeText(text);
			toast.success("Nice! Grocery list copied to clipboard");
		} catch (shareError) {
			logger.error("Failed to share grocery list", { error: shareError });
			toast.error("Oops, failed to share grocery list");
		}
	}

	return {
		stocks,
		loading,
		error,
		creatingStock,
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
