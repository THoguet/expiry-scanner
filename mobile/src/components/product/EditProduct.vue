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
import type { ProductWithBarcode } from '../../services/backend';
import { useEditProductForm } from '../../composables/product/useEditProductForm';

const emit = defineEmits<{ closeEditProductPanel: [] }>();
const props = defineProps<{
	product: ProductWithBarcode;
}>();

function closePanel() {
	emit('closeEditProductPanel');
}

const {
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
} = useEditProductForm(props.product, closePanel);

void imageFileInput;

async function deletePro() {
	await deleteProductById();
}

</script>

<style scoped src="./styles/edit-product.css"></style>
