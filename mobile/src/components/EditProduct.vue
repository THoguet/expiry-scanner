<template>
	<form @submit.prevent="saveEdit()" class="edit-product-form">
		<!-- Name Field (now editable) -->
		<div class="form-group">
			<label for="name">Name *</label>
			<input id="name" type="text" v-model="editedProduct.name" placeholder="Product name" @input="onNameInput" />
			<span v-if="showNameError" class="field-error">Product name is required</span>
		</div>

		<!-- Barcode Field (read-only) -->
		<div class="form-group">
			<label for="barcode">Barcode</label>
			<input id="barcode" type="text" :value="editedProduct.barcode" disabled />
		</div>

		<!-- Current Image Display -->
		<div v-if="editedProduct.image" class="form-group">
			<label>Current Image</label>
			<div class="image-display">
				<img :src="editedProduct.image" :alt="editedProduct.name" />
			</div>
		</div>

		<!-- Image Upload -->
		<div class="form-group">
			<label>Product Image (optional)</label>
			<div class="image-upload-area">
				<div v-if="imagePreview" class="image-preview">
					<img :src="imagePreview" :alt="editedProduct.name" />
					<button type="button" class="remove-image-btn" @click="clearImage" title="Remove new image">
						×
					</button>
				</div>
				<div v-else class="image-placeholder">
					<input type="file" id="imageInput" ref="imageFileInput" accept="image/*" @change="onImageSelected"
						style="display: none" />
					<button type="button" class="upload-btn" @click="triggerImageInput">
						Upload Image
					</button>
					<p class="upload-hint">JPG, PNG, or WebP</p>
				</div>
			</div>
			<span v-if="imageUploadError" class="field-error">{{ imageUploadError }}</span>
		</div>

		<!-- Expiration Date -->
		<div class="form-group">
			<label for="expiration_date">Expiration Date</label>
			<input id="expiration_date" type="date" v-model="editedProduct.expiration_date" required />
		</div>

		<!-- Form Actions -->
		<div class="form-actions">
			<button type="submit" :disabled="isSaving">
				{{ isSaving ? 'Saving...' : 'Save' }}
			</button>
			<button type="button" @click="closePanel" :disabled="isSaving">Cancel</button>
			<button type="button" @click="deletePro()" :disabled="isSaving" class="delete-btn">Delete</button>
		</div>

		<!-- Error Message -->
		<span v-if="saveError" class="field-error error-full">{{ saveError }}</span>
	</form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ProductWithBarcode } from '../services/backend';
import { removeProduct, saveEditedProduct, useProducts } from '../services/products';
import { CLIENT_ID } from '../main';
import type { EditProduct as EditProductType } from '../bindings/EditProduct';

const emit = defineEmits<{ closeEditProductPanel: [] }>();
const props = defineProps<{
	product: ProductWithBarcode;
}>();

const isSaving = ref(false);
const showNameError = ref(false);
const imageUploadError = ref<string | null>(null);
const saveError = ref<string | null>(null);

const selectedImage = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const imageFileInput = ref<HTMLInputElement | null>(null);

// Create editable copy of product
const editedProduct = ref<EditProductType>({
	id: props.product[0].id,
	barcode: props.product[0].barcode,
	name: props.product[0].name,
	image: props.product[0].image,
	expiration_date: props.product[0].expiration_date,
	client_id: CLIENT_ID,
});

function onNameInput() {
	showNameError.value = false;
	if (saveError.value) {
		saveError.value = null;
	}
}

function triggerImageInput() {
	imageFileInput.value?.click();
}

function onImageSelected(event: Event) {
	const target = event.target as HTMLInputElement;
	const file = target.files?.[0];

	if (!file) return;

	// Validate file size (max 10MB)
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

	// Create preview
	const reader = new FileReader();
	reader.onload = (e) => {
		imagePreview.value = e.target?.result as string;
	};
	reader.readAsDataURL(file);
}

function clearImage() {
	selectedImage.value = null;
	imagePreview.value = null;
	if (imageFileInput.value) {
		imageFileInput.value.value = '';
	}
}

async function deletePro() {
	if (confirm('Are you sure you want to delete this product?')) {
		try {
			await removeProduct({
				id: editedProduct.value.id,
				client_id: editedProduct.value.client_id,
			});
			emit('closeEditProductPanel');
		} catch (error) {
			console.error("Failed to delete product:", error);
			saveError.value = "Failed to delete product";
		}
	}
}

function closePanel() {
	emit('closeEditProductPanel');
}

async function saveEdit() {
	// Validate name
	if (!editedProduct.value.name || editedProduct.value.name.trim() === '') {
		showNameError.value = true;
		return;
	}

	isSaving.value = true;
	saveError.value = null;

	try {
		// Save product changes
		await saveEditedProduct(editedProduct.value);

		// Optional: upload image if selected
		if (selectedImage.value) {
			try {
				const { uploadImage } = useProducts(CLIENT_ID);
				await uploadImage(editedProduct.value.barcode, selectedImage.value);
			} catch (imgError) {
				console.warn("Image upload failed (non-blocking):", imgError);
				// Don't fail the entire edit if image upload fails
			}
		}

		emit('closeEditProductPanel');
	} catch (error) {
		console.error("Failed to save product:", error);
		saveError.value = "Failed to save product";
	} finally {
		isSaving.value = false;
	}
}

</script>

<style scoped>
.edit-product-form {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	padding: 1rem;
	background-color: var(--surface);
	border-radius: 8px;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 90%;
	max-width: 450px;
	z-index: 1000;
	border: 1px solid var(--surface-border);
	max-height: 85vh;
	overflow-y: auto;
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	margin-bottom: 0.5rem;
}

.form-group label {
	font-weight: 600;
	font-size: 0.95rem;
	color: var(--text-secondary);
}

.form-group input {
	width: 100%;
	padding: 0.6rem;
	border: 1px solid var(--surface-border);
	border-radius: 6px;
	background: var(--surface-strong);
	color: var(--text-primary);
	font-size: 0.95rem;
	box-sizing: border-box;
}

.form-group input:focus {
	outline: none;
	border-color: var(--brand);
	box-shadow: 0 0 0 3px var(--focus-ring);
}

.form-group input:disabled {
	opacity: 0.6;
	background: var(--surface);
	cursor: not-allowed;
}

.field-error {
	font-size: 0.8rem;
	color: var(--error-strong);
	margin-top: -0.2rem;
}

.error-full {
	padding: 0.75rem;
	background: var(--error-soft);
	border-radius: 6px;
	margin-top: 0.5rem;
}

.image-display {
	width: 100%;
	height: 150px;
	border-radius: 6px;
	overflow: hidden;
	background: var(--surface-strong);
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px solid var(--surface-border);
}

.image-display img {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
}

.image-upload-area {
	display: flex;
	gap: 1rem;
	align-items: center;
}

.image-preview {
	position: relative;
	width: 80px;
	height: 80px;
	border-radius: 6px;
	overflow: hidden;
	background: var(--surface-strong);
	border: 1px solid var(--surface-border);
}

.image-preview img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.remove-image-btn {
	position: absolute;
	top: -8px;
	right: -8px;
	width: 28px;
	height: 28px;
	background: var(--error);
	color: white;
	border: none;
	border-radius: 50%;
	font-size: 1.2rem;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: filter 0.2s ease;
}

.remove-image-btn:hover {
	filter: brightness(0.9);
}

.image-placeholder {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.4rem;
	flex: 1;
	padding: 0.8rem;
	border: 2px dashed var(--surface-border);
	border-radius: 6px;
	background: var(--surface-strong);
}

.upload-btn {
	height: 36px;
	padding: 0 0.8rem;
	background: var(--brand-soft);
	color: var(--brand-strong);
	border: none;
	border-radius: 6px;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition: filter 0.2s ease;
}

.upload-btn:hover {
	filter: brightness(0.95);
}

.upload-hint {
	margin: 0;
	font-size: 0.75rem;
	color: var(--text-secondary);
}

.form-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
	padding-top: 0.5rem;
	border-top: 1px solid var(--surface-border);
}

.form-actions button {
	padding: 0.6rem 1rem;
	border: none;
	border-radius: 6px;
	cursor: pointer;
	font-size: 0.9rem;
	font-weight: 600;
	transition: filter 0.2s ease, transform 0.05s ease;
}

.form-actions button[type="submit"] {
	background-color: var(--brand);
	color: white;
}

.form-actions button[type="button"] {
	background-color: var(--surface-strong);
	color: var(--text-primary);
	border: 1px solid var(--surface-border);
}

.form-actions button.delete-btn {
	background-color: var(--error-soft);
	color: var(--error-strong);
}

.form-actions button:hover:not(:disabled) {
	filter: brightness(0.95);
}

.form-actions button:active:not(:disabled) {
	transform: translateY(1px);
}

.form-actions button:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
</style>
