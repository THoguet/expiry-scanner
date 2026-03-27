import { ref } from "vue";
import type { EditProduct as EditProductType } from "../../bindings/EditProduct";
import { CLIENT_ID } from "../../main";
import type { ProductWithBarcode } from "../../services/backend";
import { removeProduct, saveEditedProduct, useProducts } from "../../services/products";
import { logger } from "../../services/logger";

export function useEditProductForm(
	product: ProductWithBarcode,
	onClose: () => void,
) {
	const isSaving = ref(false);
	const showNameError = ref(false);
	const imageUploadError = ref<string | null>(null);
	const saveError = ref<string | null>(null);

	const selectedImage = ref<File | null>(null);
	const imagePreview = ref<string | null>(null);
	const imageFileInput = ref<HTMLInputElement | null>(null);

	const editedProduct = ref<EditProductType>({
		id: product[0].id,
		barcode: product[0].barcode,
		name: product[0].name,
		image: product[0].image,
		expiration_date: product[0].expiration_date,
		client_id: CLIENT_ID,
	});

	function onNameInput(): void {
		showNameError.value = false;
		if (saveError.value) {
			saveError.value = null;
		}
	}

	function triggerImageInput(): void {
		imageFileInput.value?.click();
	}

	function onImageSelected(event: Event): void {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		const maxSizeBytes = 10 * 1024 * 1024;
		if (file.size > maxSizeBytes) {
			imageUploadError.value = "Image must be smaller than 10MB";
			setTimeout(() => {
				imageUploadError.value = null;
			}, 3000);
			return;
		}

		selectedImage.value = file;
		imageUploadError.value = null;

		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview.value = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	function clearImage(): void {
		selectedImage.value = null;
		imagePreview.value = null;
		if (imageFileInput.value) {
			imageFileInput.value.value = "";
		}
	}

	async function deleteProductById(): Promise<void> {
		if (!confirm("Are you sure you want to delete this product?")) return;

		// Close the edit panel immediately after user confirmation.
		onClose();

		try {
			logger.info("Deleting product from edit form", {
				productId: editedProduct.value.id.toString(),
			});
			await removeProduct({
				id: editedProduct.value.id,
				client_id: editedProduct.value.client_id,
			});
		} catch (error) {
			logger.error("Failed to delete product from edit form", {
				productId: editedProduct.value.id.toString(),
				error,
			});
		}
	}

	async function saveEdit(): Promise<void> {
		if (!editedProduct.value.name || editedProduct.value.name.trim() === "") {
			showNameError.value = true;
			return;
		}

		isSaving.value = true;
		saveError.value = null;

		try {
			logger.info("Saving product from edit form", {
				productId: editedProduct.value.id.toString(),
				barcode: editedProduct.value.barcode,
			});
			await saveEditedProduct(editedProduct.value);

			if (selectedImage.value) {
				try {
					const { uploadImage } = useProducts(CLIENT_ID);
					await uploadImage(editedProduct.value.barcode, selectedImage.value);
				} catch (imgError) {
					logger.warn("Image upload failed from edit form (non-blocking)", {
						productId: editedProduct.value.id.toString(),
						error: imgError,
					});
				}
			}

			onClose();
		} catch (error) {
			logger.error("Failed to save product from edit form", {
				productId: editedProduct.value.id.toString(),
				error,
			});
			saveError.value = "Failed to save product";
		} finally {
			isSaving.value = false;
		}
	}

	return {
		isSaving,
		showNameError,
		imageUploadError,
		saveError,
		imagePreview,
		imageFileInput,
		editedProduct,
		onNameInput,
		triggerImageInput,
		onImageSelected,
		clearImage,
		deleteProductById,
		saveEdit,
	};
}
