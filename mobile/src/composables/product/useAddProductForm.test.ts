import { beforeEach, describe, expect, it, vi } from "vitest";
import { BARCODE_DEBOUNCE_MS, FOCUS_DELAY_MS } from "../../constants";

const {
	mockEmit,
	mockCancel,
	mockCheckPermissions,
	mockRequestPermissions,
	mockScan,
	mockAddProduct,
	mockGetPrefill,
} = vi.hoisted(() => ({
	mockEmit: vi.fn(),
	mockCancel: vi.fn(),
	mockCheckPermissions: vi.fn(),
	mockRequestPermissions: vi.fn(),
	mockScan: vi.fn(),
	mockAddProduct: vi.fn(),
	mockGetPrefill: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({ emit: mockEmit }));
vi.mock("@tauri-apps/plugin-barcode-scanner", () => ({
	cancel: mockCancel,
	checkPermissions: mockCheckPermissions,
	requestPermissions: mockRequestPermissions,
	scan: mockScan,
	Format: {
		EAN13: "EAN_13",
		EAN8: "EAN_8",
		UPC_A: "UPC_A",
		UPC_E: "UPC_E",
	},
}));
vi.mock("/src/main.ts", () => ({ CLIENT_ID: "client-add-form" }));
vi.mock("/src/services/products.ts", () => ({
	addProduct: mockAddProduct,
	useProducts: () => ({ getPrefill: mockGetPrefill }),
}));

let mockFileReaderResult: unknown = "data:image/png;base64,Zm9v";

class MockFileReader {
	public onload: ((e: { target: { result: unknown } }) => void) | null = null;
	public onerror: (() => void) | null = null;
	public result: unknown = null;
	readAsDataURL(_file: File): void {
		this.result = mockFileReaderResult;
		this.onload?.({ target: { result: this.result } });
	}
}
Object.defineProperty(globalThis, "FileReader", { value: MockFileReader, configurable: true });

function makeInput() {
	return {
		value: "",
		maxLength: 2,
		focus: vi.fn(),
		blur: vi.fn(),
		select: vi.fn(),
		click: vi.fn(),
		classList: { add: vi.fn(), remove: vi.fn() },
	};
}

describe("useAddProductForm", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.useFakeTimers();
		mockFileReaderResult = "data:image/png;base64,Zm9v";
		Object.defineProperty(globalThis, "window", {
			value: globalThis,
			configurable: true,
		});
		Object.defineProperty(globalThis, "document", {
			value: {
				createElement: vi.fn(() => ({ relList: { supports: vi.fn(() => false) } })),
				body: { classList: { toggle: vi.fn() } },
			},
			configurable: true,
		});
	});

	it("creates product and resets form", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockAddProduct.mockResolvedValue({});
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();

		form.productBarCodeInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryMonthInput.value = makeInput() as unknown as HTMLInputElement;
		form.productInfo.value.barCode = "123";
		form.productInfo.value.name = "Item";
		form.productInfo.value.expiryDay = "1";
		form.productInfo.value.expiryMonth = "2";
		form.productInfo.value.expiryYear = "30";
		form.onSystemCameraImageSelected({ target: { files: [{ size: 1000 }] } } as unknown as Event);

		await form.createNewProduct();
		expect(mockAddProduct).toHaveBeenCalled();
		expect(mockEmit).toHaveBeenCalledWith("productAdded");
		expect(form.productInfo.value.barCode).toBe("");
	});

	it("shows validation errors and clears on name input", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();

		await form.createNewProduct();
		expect(form.addError.value).toBe("Barcode is required");

		form.productInfo.value.barCode = "123";
		form.productInfo.value.name = "";
		await form.createNewProduct();

		form.productInfo.value.name = "Name";
		form.productInfo.value.expiryDay = null;
		await form.createNewProduct();

		form.productInfo.value.expiryDay = "xx";
		form.productInfo.value.expiryMonth = "1";
		form.productInfo.value.expiryYear = "30";
		await form.createNewProduct();

		form.productInfo.value.expiryDay = "40";
		form.productInfo.value.expiryMonth = "15";
		await form.createNewProduct();

		vi.runAllTimers();
		expect(form.addError.value).toBeNull();

		form.addError.value = "x";
		form.onNameInput();
		expect(form.addError.value).toBeNull();
	});

	it("handles camera image selection limits", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.cameraCaptureInput.value = makeInput() as unknown as HTMLInputElement;
		form.onSystemCameraImageSelected({ target: { files: [] } } as unknown as Event);

		form.onSystemCameraImageSelected({ target: { files: [{ size: 11 * 1024 * 1024 }] } } as unknown as Event);
		expect(form.imageUploadError.value).toBe("Image must be smaller than 10MB");
		vi.runAllTimers();
		expect(form.imageUploadError.value).toBeNull();

		form.onSystemCameraImageSelected({ target: { files: [{ size: 1000 }] } } as unknown as Event);
		expect(form.imagePreview.value).toContain("data:image/png;base64");

		await form.retakeImage();
		form.clearImage();
		expect(form.imagePreview.value).toBeNull();
	});

	it("handles add product failures", async () => {
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockAddProduct.mockRejectedValueOnce(new Error("nope"));
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.productInfo.value.barCode = "123";
		form.productInfo.value.name = "Item";
		form.productInfo.value.expiryDay = "1";
		form.productInfo.value.expiryMonth = "2";
		form.productInfo.value.expiryYear = "30";

		await form.createNewProduct();
		expect(form.addError.value).toBe("Failed to add product");
		errSpy.mockRestore();
	});

	it("handles scanning permission and prefill lookup", async () => {
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		mockCheckPermissions.mockResolvedValueOnce("denied");
		mockRequestPermissions.mockResolvedValueOnce("denied");
		const { useAddProductForm } = await import("./useAddProductForm");
		const formA = useAddProductForm();
		await formA.startScan();
		expect(formA.scanError.value).toBe("Camera permission not granted");

		mockCheckPermissions.mockResolvedValueOnce("granted");
		mockScan.mockResolvedValueOnce({ format: "invalid", content: "x" });
		await formA.startScan();
		expect(formA.scanError.value).toContain("invalid format");

		mockCheckPermissions.mockResolvedValueOnce("granted");
		mockScan.mockResolvedValueOnce({ format: "EAN_13", content: "12345" });
		mockGetPrefill.mockResolvedValueOnce({ barcode: "12345", name: "Prefilled", image: null, source: "barcode_db" });
		await formA.startScan();
		vi.advanceTimersByTime(FOCUS_DELAY_MS + 20);
		expect(formA.productInfo.value.name).toBe("Prefilled");
		expect(formA.getSourceLabel("barcode_db")).toBe("from database");
		expect(formA.getSourceLabel("none")).toBe("no match");
		expect(formA.getSourceLabel("user_product_info")).toBe("saved");
		expect(formA.getSourceLabel("user_product_info_global")).toBe("from others");
		expect(formA.getSourceLabel("other")).toBe("other");

		mockCheckPermissions.mockResolvedValueOnce("granted");
		mockScan.mockResolvedValueOnce({ format: "EAN_8", content: "888" });
		mockGetPrefill.mockRejectedValueOnce(new Error("prefill failed"));
		await formA.startScan();
		vi.advanceTimersByTime(FOCUS_DELAY_MS + 20);
		expect(formA.prefilled.value?.source).toBe("none");

		mockCheckPermissions.mockRejectedValueOnce(new Error("boom"));
		await formA.startScan();
		expect(formA.scanError.value).toBe("Failed to scan barcode");
		errSpy.mockRestore();
	});

	it("supports input navigation and cancellation", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockAddProduct.mockResolvedValue({});
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryMonthInput.value = makeInput() as unknown as HTMLInputElement;

		const day = form.expiryDayInput.value as unknown as { value: string; maxLength: number; focus: ReturnType<typeof vi.fn> };
		day.value = "12";
		form.goToNext({ target: day } as unknown as Event);
		expect((form.expiryMonthInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalled();

		const month = form.expiryMonthInput.value as unknown as { value: string; maxLength: number };
		month.value = "12";
		form.productInfo.value.barCode = "123";
		form.productInfo.value.name = "Item";
		form.productInfo.value.expiryDay = "1";
		form.productInfo.value.expiryMonth = "2";
		form.productInfo.value.expiryYear = "30";
		form.goToNext({ target: month } as unknown as Event, true);

		form.selectInput({ target: makeInput() } as unknown as FocusEvent);
		form.openSystemCamera();
		form.cancelScan();
		expect(mockCancel).toHaveBeenCalled();
	});

	it("auto looks up barcode when typing reaches max supported length", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockGetPrefill.mockResolvedValueOnce({ barcode: "1234567890123", name: "Found", image: null, source: "barcode_db" });
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "1234567890123";
		form.onBarcodeInput();
		await vi.runAllTimersAsync();
		expect(mockGetPrefill).toHaveBeenCalledWith("1234567890123");
	});

	it("triggers barcode lookup when manually requested", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockGetPrefill.mockResolvedValueOnce({ barcode: "1234567890123", name: "Found", image: null, source: "barcode_db" });
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "1234567890123";
		form.triggerBarcodeLookup();
		await vi.runAllTimersAsync();
		expect(mockGetPrefill).toHaveBeenCalledWith("1234567890123");
		expect(form.productInfo.value.name).toBe("Found");
	});

	it("does not lookup when barcode length is unsupported", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "123";
		form.onBarcodeInput();
		form.triggerBarcodeLookup();
		expect(mockGetPrefill).not.toHaveBeenCalled();
		expect(form.canLookupBarcode.value).toBe(false);
	});

	it("debounces auto lookup for supported shorter barcode format", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockGetPrefill.mockResolvedValueOnce({ barcode: "12345678", name: "Short", image: null, source: "barcode_db" });
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "12345678";
		form.onBarcodeInput();
		expect(form.canLookupBarcode.value).toBe(true);
		expect(mockGetPrefill).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(BARCODE_DEBOUNCE_MS);
		await vi.runAllTimersAsync();
		expect(mockGetPrefill).toHaveBeenCalledWith("12345678");
	});

	it("does not move focus after debounce lookup for shorter supported format", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockGetPrefill.mockResolvedValueOnce({ barcode: "12345678", name: "Short", image: null, source: "barcode_db" });
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.productBarCodeInput.value = makeInput() as unknown as HTMLInputElement;
		form.productNameInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "12345678";
		form.onBarcodeInput();
		await vi.advanceTimersByTimeAsync(BARCODE_DEBOUNCE_MS);
		await vi.runAllTimersAsync();

		expect((form.productNameInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
		expect((form.expiryDayInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
	});

	it("restarts debounce when barcode changes before timer fires", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockGetPrefill.mockResolvedValueOnce({ barcode: "87654321", name: "Second", image: null, source: "barcode_db" });
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();

		form.productInfo.value.barCode = "12345678";
		form.onBarcodeInput();
		form.productInfo.value.barCode = "87654321";
		form.onBarcodeInput();

		await vi.advanceTimersByTimeAsync(BARCODE_DEBOUNCE_MS);
		await vi.runAllTimersAsync();
		expect(mockGetPrefill).toHaveBeenCalledTimes(1);
		expect(mockGetPrefill).toHaveBeenCalledWith("87654321");
	});

	it("manual lookup on shorter format loads prefill without moving focus", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockGetPrefill.mockResolvedValueOnce({ barcode: "12345678", name: "Short", image: null, source: "barcode_db" });
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.productNameInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "12345678";
		form.triggerBarcodeLookup();
		await vi.runAllTimersAsync();

		expect(form.productInfo.value.name).toBe("Short");
		expect((form.productNameInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
		expect((form.expiryDayInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
	});

	it("short-format lookup failure keeps focus and sets fallback prefill", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockGetPrefill.mockRejectedValueOnce(new Error("lookup failed"));
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.productNameInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "12345678";
		form.onBarcodeInput();
		await vi.advanceTimersByTimeAsync(BARCODE_DEBOUNCE_MS);
		await vi.runAllTimersAsync();

		expect(form.prefilled.value?.source).toBe("none");
		expect((form.productNameInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
		expect((form.expiryDayInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
	});

	it("clears prefill when barcode changes", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;
		form.prefilled.value = { barcode: "1234567890123", name: "Found", image: null, source: "barcode_db" };
		form.productInfo.value.name = "Found";

		form.productInfo.value.barCode = "1234567890124";
		form.onBarcodeInput();
		expect(form.prefilled.value).toBeNull();
		expect(form.productInfo.value.name).toBe("");
	});

	it("onNameKeydown advances to expiry on Enter with name", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.name = "Test Product";
		const event = { key: "Enter", preventDefault: vi.fn() };
		form.onNameKeydown(event as unknown as KeyboardEvent);
		expect(event.preventDefault).toHaveBeenCalled();
		expect((form.expiryDayInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalled();
	});

	it("onNameKeydown shows error on Enter with empty name", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();

		form.productInfo.value.name = "";
		const event = { key: "Enter", preventDefault: vi.fn() };
		form.onNameKeydown(event as unknown as KeyboardEvent);
		expect(form.showNameError.value).toBe(true);
	});

	it("skips to expiry day when prefill has name", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValueOnce({ format: "EAN_13", content: "1234567890123" });
		mockGetPrefill.mockResolvedValueOnce({ barcode: "1234567890123", name: "Known", image: null, source: "user_product_info" });
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;
		form.productNameInput.value = makeInput() as unknown as HTMLInputElement;

		await form.startScan();
		vi.advanceTimersByTime(FOCUS_DELAY_MS + 20);
		expect(form.productInfo.value.name).toBe("Known");
		expect((form.expiryDayInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalled();
		expect((form.productNameInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
	});

	it("focuses name input when manual lookup has no name", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		mockGetPrefill.mockResolvedValueOnce({ barcode: "9999999999999", name: null, image: null, source: "none" });
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;
		form.productNameInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "9999999999999";
		form.onBarcodeInput();
		form.triggerBarcodeLookup();
		await vi.runAllTimersAsync();
		vi.advanceTimersByTime(FOCUS_DELAY_MS + 20);
		expect((form.productNameInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalled();
		expect((form.expiryDayInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
	});

	it("onNameKeydown ignores non-Enter keys", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.name = "Test";
		const event = { key: "a", preventDefault: vi.fn() };
		form.onNameKeydown(event as unknown as KeyboardEvent);
		expect(event.preventDefault).not.toHaveBeenCalled();
		expect((form.expiryDayInput.value as unknown as { focus: ReturnType<typeof vi.fn> }).focus).not.toHaveBeenCalled();
	});

	it("clears prefill data including image on barcode change", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;
		form.productNameInput.value = makeInput() as unknown as HTMLInputElement;
		form.cameraCaptureInput.value = makeInput() as unknown as HTMLInputElement;
		form.prefilled.value = { barcode: "1234567890123", name: "Found", image: "http://img.test/a.jpg", source: "barcode_db" };
		form.productInfo.value.name = "Found";

		form.productInfo.value.barCode = "1234567890123";
		form.onBarcodeInput();
		// Simulate user-added image
		form.onSystemCameraImageSelected({ target: { files: [{ size: 1000 }] } } as unknown as Event);
		expect(form.imagePreview.value).not.toBeNull();

		// Change barcode — should clear everything
		form.productInfo.value.barCode = "1234567890124";
		form.onBarcodeInput();
		expect(form.prefilled.value).toBeNull();
		expect(form.productInfo.value.name).toBe("");
		expect(form.imagePreview.value).toBeNull();
	});

	it("rejects toBase64Payload when FileReader result is not a string", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.productBarCodeInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryMonthInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "123";
		form.productInfo.value.name = "Item";
		form.productInfo.value.expiryDay = "1";
		form.productInfo.value.expiryMonth = "2";
		form.productInfo.value.expiryYear = "30";
		form.onSystemCameraImageSelected({ target: { files: [{ size: 1000 }] } } as unknown as Event);

		mockFileReaderResult = null;
		await form.createNewProduct();
		expect(form.addError.value).toBe("Failed to add product");
	});

	it("rejects toBase64Payload when base64 data is empty", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.productBarCodeInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryMonthInput.value = makeInput() as unknown as HTMLInputElement;

		form.productInfo.value.barCode = "123";
		form.productInfo.value.name = "Item";
		form.productInfo.value.expiryDay = "1";
		form.productInfo.value.expiryMonth = "2";
		form.productInfo.value.expiryYear = "30";
		form.onSystemCameraImageSelected({ target: { files: [{ size: 1000 }] } } as unknown as Event);

		mockFileReaderResult = "data:,";
		await form.createNewProduct();
		expect(form.addError.value).toBe("Failed to add product");
	});
});
