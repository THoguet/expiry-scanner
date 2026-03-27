import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { nextTick } from "vue";
import type { Stock } from "../bindings/Stock";

vi.mock("vue", async () => {
	const actual = await vi.importActual<typeof import("vue")>("vue");
	return {
		...actual,
		onMounted: (cb: () => void) => cb(),
		onBeforeUnmount: (cb: () => void) => cb(),
	};
});

const mockLoadStocks = vi.fn().mockResolvedValue(undefined);
const mockAddStock = vi.fn();
const mockUpdateStock = vi.fn();
const mockRemoveStockById = vi.fn();

const mockIsTauri = vi.fn(() => false);
const mockShareText = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastShow = vi.fn().mockReturnValue(1);
const mockToastDismiss = vi.fn();

const stocksRef = ref<Stock[]>([]);
const loadingRef = ref(false);
const errorRef = ref<string | null>(null);

vi.mock("/src/services/stocks.ts", () => ({
	useStocks: () => ({
		stocks: stocksRef,
		loading: loadingRef,
		error: errorRef,
		loadStocks: mockLoadStocks,
		addStock: mockAddStock,
		updateStock: mockUpdateStock,
		removeStockById: mockRemoveStockById,
	}),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: mockIsTauri }));
vi.mock("@buildyourwebapp/tauri-plugin-sharesheet", () => ({ shareText: mockShareText }));
vi.mock("/src/services/toast.ts", () => ({
	useToast: () => ({
		success: mockToastSuccess,
		error: mockToastError,
		show: mockToastShow,
		dismiss: mockToastDismiss,
		toasts: ref([]),
	}),
}));

function makeStock(id: bigint, name: string, desired: number, current: number): Stock {
	return {
		id,
		name,
		desired_quantity: desired,
		current_quantity: current,
		unit: "kg",
		location: "pantry",
		created_at: "2026-03-01T00:00:00Z",
		updated_at: "2026-03-01T00:00:00Z",
	};
}

describe("useStockManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		Object.defineProperty(globalThis, "window", {
			value: globalThis,
			configurable: true,
		});
		stocksRef.value = [makeStock(1n, "Rice", 5, 1), makeStock(2n, "Tea", 1, 1)];
		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "Mozilla", clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("creates stock with validation and success reset", async () => {
		mockAddStock.mockResolvedValueOnce(makeStock(3n, "Beans", 4, 1));
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();

		mgr.newStock.value.name = "";
		await mgr.createNewStock();
		expect(mockToastError).toHaveBeenCalledWith("Name is required");

		mgr.newStock.value = { name: "Beans", desired_quantity: 4, current_quantity: 1, unit: "can", location: "shelf" };
		await mgr.createNewStock();
		expect(mockAddStock).toHaveBeenCalled();
		expect(mockToastSuccess).toHaveBeenCalledWith("Nice! Stock line added");
		expect(mgr.newStock.value.name).toBe("");

		mockAddStock.mockRejectedValueOnce(new Error("create fail"));
		mgr.newStock.value = { name: "Fail", desired_quantity: 1, current_quantity: 0, unit: "", location: "" };
		await mgr.createNewStock();
		expect(mockToastError).toHaveBeenCalledWith("Oops, failed to add stock line");
	});

	it("saves, increments and decrements stock", async () => {
		mockUpdateStock.mockResolvedValue(makeStock(1n, "Rice", 5, 2));
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		const stock = stocksRef.value[0];

		stock.name = "";
		await mgr.save(stock);
		expect(mockToastError).toHaveBeenCalledWith("Name is required");

		stock.name = "Rice";
		await mgr.save(stock);
		expect(mockUpdateStock).toHaveBeenCalled();
		expect(mockToastSuccess).toHaveBeenCalledWith("Sweet! Stock line saved");

		await mgr.increment(stock);
		await mgr.decrement(stock);
		vi.runAllTimers();
		expect(mockUpdateStock).toHaveBeenCalled();

		mockUpdateStock.mockRejectedValueOnce(new Error("queued fail"));
		await mgr.increment(stock);
		vi.runAllTimers();
		expect(mockUpdateStock).toHaveBeenCalled();

		mockUpdateStock.mockRejectedValueOnce(new Error("save fail"));
		await mgr.save(stock);
		expect(mockToastError).toHaveBeenCalledWith("Oops, failed to save stock line");
	});

	it("removes stock and handles delete errors", async () => {
		mockRemoveStockById.mockResolvedValueOnce(undefined);
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		await mgr.remove(1n);
		expect(mockRemoveStockById).toHaveBeenCalledWith(1n);
		expect(mockToastSuccess).toHaveBeenCalledWith("Done! Stock line deleted");

		mockRemoveStockById.mockRejectedValueOnce(new Error("delete fail"));
		await mgr.remove(2n);
		expect(mockToastError).toHaveBeenCalledWith("Oops, failed to delete stock line");
	});

	it("shows toast when stocks load error changes", async () => {
		const { useStockManager } = await import("./useStockManager");
		useStockManager();
		errorRef.value = "Failed to load stocks";
		await nextTick();
		expect(mockToastError).toHaveBeenCalledWith("Failed to load stocks");
	});

	it("filters and labels stock states", async () => {
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		mgr.searchQuery.value = "tea";
		expect(mgr.filteredStocks.value.length).toBe(1);
		expect(mgr.getStockStateClass(makeStock(10n, "A", 8, 1))).toBe("critical");
		expect(mgr.getStockStateClass(makeStock(10n, "A", 3, 2))).toBe("warning");
		expect(mgr.getStockStateClass(makeStock(10n, "A", 1, 1))).toBe("ok");
		expect(mgr.getStockStateLabel(makeStock(10n, "A", 1, 1))).toBe("Stocked");
		expect(mgr.getStockStateLabel(makeStock(10n, "A", 5, 1))).toContain("Missing");
		expect(mgr.quantitySummary(makeStock(10n, "A", 2, 1))).toContain("1/2");
		expect(mgr.quantitySummary({ ...makeStock(10n, "A", 2, 1), unit: null, location: null })).toBe("1/2");
		mgr.searchQuery.value = "";
		expect(mgr.filteredStocks.value.length).toBeGreaterThan(0);
	});

	it("toggles line detail and save state reflection", async () => {
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		expect(mgr.isLineDetailed(1n)).toBe(false);
		mgr.toggleLineView(1n);
		expect(mgr.isLineDetailed(1n)).toBe(true);
		expect(mgr.getLineSaveState(1n)).toBe("idle");
	});

	it("shares grocery list through clipboard, navigator share and native mobile", async () => {
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		const writeText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>);

		await mgr.shareGroceryList();
		expect(writeText).toHaveBeenCalled();

		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "Mozilla", share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText: vi.fn() } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
		await mgr.shareGroceryList();
		expect((navigator.share as ReturnType<typeof vi.fn>)).toHaveBeenCalled();

		mockIsTauri.mockReturnValueOnce(true);
		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "android", clipboard: { writeText: vi.fn() } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
		mockShareText.mockResolvedValueOnce(undefined);
		await mgr.shareGroceryList();
		expect(mockShareText).toHaveBeenCalled();

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		mockIsTauri.mockReturnValueOnce(true);
		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "ipad", share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText: vi.fn() } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
		mockShareText.mockRejectedValueOnce(new Error("native share fail"));
		await mgr.shareGroceryList();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();

		const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "Mozilla", share: vi.fn().mockRejectedValue(new Error("share fail")), clipboard: { writeText: vi.fn() } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});
		await mgr.shareGroceryList();
		expect(errSpy).toHaveBeenCalled();
		errSpy.mockRestore();
	});

	it("handles increment and decrement runtime errors", async () => {
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();

		const badStock = { ...stocksRef.value[0] } as Stock;
		Object.defineProperty(badStock, "current_quantity", {
			get() {
				throw new Error("bad quantity getter");
			},
			set() {
				// no-op
			},
			configurable: true,
		});

		await mgr.increment(badStock);
		expect(mockToastError).toHaveBeenCalledWith("Oops, failed to increase stock");

		await mgr.decrement(badStock);
		expect(mockToastError).toHaveBeenCalledWith("Oops, failed to decrease stock");
		errSpy.mockRestore();
	});

	it("clears pending debounced save when manual save is triggered", async () => {
		mockUpdateStock.mockResolvedValue(makeStock(1n, "Rice", 5, 2));
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();
		const stock = stocksRef.value[0];

		await mgr.increment(stock);
		expect(mockToastShow).not.toHaveBeenCalled();

		await mgr.save(stock);
		expect(mockUpdateStock).toHaveBeenCalled();
		expect(mockToastShow).not.toHaveBeenCalled();
		const successCountBeforeDebouncedSave = mockToastSuccess.mock.calls.length;

		await mgr.increment(stock);
		vi.runAllTimers();
		await Promise.resolve();
		expect(mockToastShow).toHaveBeenCalledWith("Saving stock changes...", "success");
		expect(mockToastDismiss).toHaveBeenCalledWith(1);
		expect(mockToastSuccess.mock.calls.length).toBe(successCountBeforeDebouncedSave + 1);
	});

	it("builds grocery list fallback sections and unnamed/no-unit lines", async () => {
		const { useStockManager } = await import("./useStockManager");
		const mgr = useStockManager();

		const clipboardWrite = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(globalThis, "navigator", {
			value: { userAgent: "Mozilla", clipboard: { writeText: clipboardWrite } },
			configurable: true,
		});
		Object.defineProperty(window, "navigator", {
			value: navigator,
			configurable: true,
		});

		stocksRef.value = [{
			...makeStock(20n, "   ", 1, 2),
			unit: null,
			location: null,
		}] as Stock[];
		await mgr.shareGroceryList();
		const stockedOnlyText = clipboardWrite.mock.calls[clipboardWrite.mock.calls.length - 1]?.[0] as string;
		expect(stockedOnlyText).toContain("- Nothing needed right now.");
		expect(stockedOnlyText).toContain("- Unnamed: 2/1");

		stocksRef.value = [{
			...makeStock(21n, "Milk", 4, 1),
			unit: null,
			location: null,
		}] as Stock[];
		await mgr.shareGroceryList();
		const missingOnlyText = clipboardWrite.mock.calls[clipboardWrite.mock.calls.length - 1]?.[0] as string;
		expect(missingOnlyText).toContain("- No fully stocked items yet.");
		expect(missingOnlyText).toContain("- Milk: 1/4 (need 3)");
	});
});
