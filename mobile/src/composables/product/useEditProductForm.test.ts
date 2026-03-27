import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductWithBarcode } from "../../services/backend";

const mockRemoveProduct = vi.fn();
const mockSaveEditedProduct = vi.fn();
const mockUploadImage = vi.fn();

vi.mock("/src/main.ts", () => ({ CLIENT_ID: "client-edit" }));
vi.mock("/src/services/products.ts", () => ({
	removeProduct: mockRemoveProduct,
	saveEditedProduct: mockSaveEditedProduct,
	useProducts: () => ({ uploadImage: mockUploadImage }),
}));

class MockFileReader {
	public onload: ((e: { target: { result: string } }) => void) | null = null;
	readAsDataURL(_file: File): void {
		this.onload?.({ target: { result: "data:image/png;base64,Zm9v" } });
	}
}

Object.defineProperty(globalThis, "FileReader", {
	value: MockFileReader,
	configurable: true,
});

function makeProduct(): ProductWithBarcode {
	return [{
		id: 1n,
		barcode: "123",
		name: "Milk",
		image: null,
		expiration_date: "2026-04-01",
		created_at: "2026-03-01T00:00:00Z",
	}, null] as unknown as ProductWithBarcode;
}

describe("useEditProductForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	it("validates name and resets errors on input", async () => {
		const onClose = vi.fn();
		const { useEditProductForm } = await import("./useEditProductForm");
		const form = useEditProductForm(makeProduct(), onClose);

		form.editedProduct.value.name = "";
		await form.saveEdit();
		expect(form.showNameError.value).toBe(true);

		form.saveError.value = "x";
		form.onNameInput();
		expect(form.showNameError.value).toBe(false);
		expect(form.saveError.value).toBeNull();

		form.onNameInput();
		expect(form.saveError.value).toBeNull();
	});

	it("handles image selection limits and preview", async () => {
		const onClose = vi.fn();
		const { useEditProductForm } = await import("./useEditProductForm");
		const form = useEditProductForm(makeProduct(), onClose);
		form.imageFileInput.value = { click: vi.fn(), value: "" } as unknown as HTMLInputElement;
		form.triggerImageInput();
		expect((form.imageFileInput.value as unknown as { click: ReturnType<typeof vi.fn> }).click).toHaveBeenCalled();

		form.onImageSelected({ target: { files: [] } } as unknown as Event);

		form.onImageSelected({ target: { files: [{ size: 11 * 1024 * 1024 }] } } as unknown as Event);
		expect(form.imageUploadError.value).toBe("Image must be smaller than 10MB");
		vi.runAllTimers();
		expect(form.imageUploadError.value).toBeNull();

		form.onImageSelected({ target: { files: [{ size: 1000 }] } } as unknown as Event);
		expect(form.imagePreview.value).toContain("data:image/png;base64");

		form.clearImage();
		expect(form.imagePreview.value).toBeNull();
	});

	it("saves product and closes even when image upload fails", async () => {
		const onClose = vi.fn();
		mockSaveEditedProduct.mockResolvedValue({});
		mockUploadImage.mockRejectedValueOnce(new Error("upload fail"));
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { useEditProductForm } = await import("./useEditProductForm");
		const form = useEditProductForm(makeProduct(), onClose);

		form.onImageSelected({ target: { files: [{ size: 1000 }] } } as unknown as Event);
		await form.saveEdit();
		expect(mockSaveEditedProduct).toHaveBeenCalled();
		expect(mockUploadImage).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
		expect(form.isSaving.value).toBe(false);
		warnSpy.mockRestore();
	});

	it("saves product without selected image upload", async () => {
		const onClose = vi.fn();
		mockSaveEditedProduct.mockResolvedValue({});
		const { useEditProductForm } = await import("./useEditProductForm");
		const form = useEditProductForm(makeProduct(), onClose);

		await form.saveEdit();
		expect(mockSaveEditedProduct).toHaveBeenCalled();
		expect(mockUploadImage).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});

	it("handles save failure", async () => {
		const onClose = vi.fn();
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		mockSaveEditedProduct.mockRejectedValueOnce(new Error("save fail"));
		const { useEditProductForm } = await import("./useEditProductForm");
		const form = useEditProductForm(makeProduct(), onClose);

		await form.saveEdit();
		expect(form.saveError.value).toBe("Failed to save product");
		expect(form.isSaving.value).toBe(false);
		errSpy.mockRestore();
	});

	it("deletes product only when confirmed", async () => {
		const onClose = vi.fn();
		Object.defineProperty(globalThis, "confirm", { value: vi.fn(() => false), configurable: true });
		const { useEditProductForm } = await import("./useEditProductForm");
		const form = useEditProductForm(makeProduct(), onClose);
		await form.deleteProductById();
		expect(mockRemoveProduct).not.toHaveBeenCalled();

		Object.defineProperty(globalThis, "confirm", { value: vi.fn(() => true), configurable: true });
		await form.deleteProductById();
		expect(onClose).toHaveBeenCalled();
		expect(mockRemoveProduct).toHaveBeenCalled();
	});

	it("handles delete failure after confirmation", async () => {
		const onClose = vi.fn();
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		Object.defineProperty(globalThis, "confirm", { value: vi.fn(() => true), configurable: true });
		mockRemoveProduct.mockRejectedValueOnce(new Error("delete fail"));
		const { useEditProductForm } = await import("./useEditProductForm");
		const form = useEditProductForm(makeProduct(), onClose);

		await form.deleteProductById();
		expect(onClose).toHaveBeenCalled();
		expect(errSpy).toHaveBeenCalled();
		errSpy.mockRestore();
	});

	it("clears image even without file input ref", async () => {
		const { useEditProductForm } = await import("./useEditProductForm");
		const form = useEditProductForm(makeProduct(), vi.fn());
		form.clearImage();
		expect(form.imagePreview.value).toBeNull();
	});
});
