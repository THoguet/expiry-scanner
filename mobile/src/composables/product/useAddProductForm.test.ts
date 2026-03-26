import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEmit = vi.fn();
const mockCancel = vi.fn();
const mockCheckPermissions = vi.fn();
const mockRequestPermissions = vi.fn();
const mockScan = vi.fn();
const mockAddProduct = vi.fn();
const mockGetPrefill = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({ emit: mockEmit }));
vi.mock("@tauri-apps/plugin-barcode-scanner", () => ({
	cancel: mockCancel,
	checkPermissions: mockCheckPermissions,
	requestPermissions: mockRequestPermissions,
	scan: mockScan,
	Format: { EAN13: "ean13", EAN8: "ean8" },
}));
vi.mock("/src/main.ts", () => ({ CLIENT_ID: "client-add-form" }));
vi.mock("/src/services/products.ts", () => ({
	addProduct: mockAddProduct,
	useProducts: () => ({ getPrefill: mockGetPrefill }),
}));

class MockFileReader {
	public onload: ((e: { target: { result: string } }) => void) | null = null;
	public onerror: (() => void) | null = null;
	public result: string | null = null;
	readAsDataURL(_file: File): void {
		this.result = "data:image/png;base64,Zm9v";
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
		vi.clearAllMocks();
		vi.useFakeTimers();
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
		mockScan.mockResolvedValueOnce({ format: "ean13", content: "12345" });
		mockGetPrefill.mockResolvedValueOnce({ barcode: "12345", name: "Prefilled", image: null, source: "barcode_db" });
		await formA.startScan();
		vi.advanceTimersByTime(120);
		expect(formA.productInfo.value.name).toBe("Prefilled");
		expect(formA.getSourceLabel("barcode_db")).toBe("from database");
		expect(formA.getSourceLabel("none")).toBe("no match");
		expect(formA.getSourceLabel("user_product_info")).toBe("saved");
		expect(formA.getSourceLabel("user_product_info_global")).toBe("from others");
		expect(formA.getSourceLabel("other")).toBe("other");

		mockCheckPermissions.mockResolvedValueOnce("granted");
		mockScan.mockResolvedValueOnce({ format: "ean8", content: "888" });
		mockGetPrefill.mockRejectedValueOnce(new Error("prefill failed"));
		await formA.startScan();
		vi.advanceTimersByTime(120);
		expect(formA.prefilled.value?.source).toBe("none");

		mockCheckPermissions.mockRejectedValueOnce(new Error("boom"));
		await formA.startScan();
		expect(formA.scanError.value).toBe("Failed to scan barcode");
		errSpy.mockRestore();
	});

	it("supports input navigation and cancellation", async () => {
		mockCheckPermissions.mockResolvedValue("granted");
		mockScan.mockResolvedValue(null);
		const { useAddProductForm } = await import("./useAddProductForm");
		const form = useAddProductForm();
		form.productBarCodeInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryDayInput.value = makeInput() as unknown as HTMLInputElement;
		form.expiryMonthInput.value = makeInput() as unknown as HTMLInputElement;

		const first = form.productBarCodeInput.value as unknown as { value: string; maxLength: number };
		first.value = "12";
		form.goToNext({ target: first } as unknown as Event);

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
});
