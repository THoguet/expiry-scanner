<template>
	<section class="add-product app-container" :class="{ 'scan-active': scanning }">
		<form class="form-card" :class="{ 'scan-active': scanning }" @submit.prevent="createNewProduct">
			<h2 class="title">Add Product</h2>

			<!-- Barcode Input -->
			<div class="field-group">
				<label for="productBarCode">Product Barcode</label>
				<div class="barcode-row">
					<input @input="goToNext" type="text" id="productBarCode" name="productBarCode"
						v-model="productInfo.barCode" placeholder="Enter barcode" ref="productBarCodeInput"
						maxlength="13" />
					<button v-if="!scanning" type="button" :class="scanError ? 'scan-btn error-btn' : 'scan-btn'"
						@click="startScan()">{{ scanError ?? 'Scan Product' }}</button>
					<button v-else type="button" class="scan-btn cancel-btn" @click="cancelScan()">Cancel Scan</button>
				</div>
			</div>

			<!-- Prefill Section (shown after barcode is scanned) -->
			<div v-if="prefilled" class="prefill-section">
				<div class="prefill-header">
					<h3>Product Information</h3>
					<span class="prefill-source" :title="`Source: ${prefilled.source}`">
						{{ getSourceLabel(prefilled.source) }}
					</span>
				</div>

				<!-- Prefilled Image Preview -->
				<div v-if="prefilled.image" class="prefill-image-preview">
					<img :src="prefilled.image" :alt="prefilled.name || 'Product image'" />
				</div>

				<!-- Name Input (pre-populated from prefill) -->
				<div class="field-group">
					<label for="productName">Product Name *</label>
					<input type="text" id="productName" v-model="productInfo.name" placeholder="Product name"
						ref="productNameInput" @input="onNameInput" />
					<span v-if="showNameError" class="field-error">Product name is required</span>
				</div>
			</div>

			<!-- Name Input (if no prefill) -->
			<div v-else-if="productInfo.barCode && !prefilling" class="field-group">
				<label for="productName">Product Name *</label>
				<input type="text" id="productName" v-model="productInfo.name" placeholder="Enter product name"
					ref="productNameInput" @input="onNameInput" />
				<span v-if="showNameError" class="field-error">Product name is required</span>
			</div>

			<!-- Loading indicator for prefill -->
			<div v-if="prefilling" class="loading-indicator">
				<p>Looking up product information...</p>
			</div>

			<!-- Image Upload Section -->
			<div v-if="productInfo.barCode && productInfo.name" class="field-group">
				<label>Product Image (optional)</label>
				<div class="camera-capture-area">
					<div v-if="imagePreview" class="image-preview">
						<img :src="imagePreview" :alt="productInfo.name" />
						<div class="image-preview-actions">
							<button type="button" class="upload-btn" @click="clearImage">Remove</button>
							<button type="button" class="upload-btn" @click="retakeImage">Retake</button>
						</div>
					</div>
					<div v-else>
						<div class="image-placeholder">
							<p class="upload-hint">Open your device camera to take a picture</p>
						</div>
						<div class="camera-controls">
							<button type="button" class="scan-btn" @click="openSystemCamera">
								Use Device Camera
							</button>
						</div>
						<input ref="cameraCaptureInput" type="file" accept="image/*" capture="environment"
							class="hidden-capture-input" @change="onSystemCameraImageSelected" />
					</div>
				</div>
				<span v-if="imageUploadError" class="field-error">{{ imageUploadError }}</span>
			</div>

			<!-- Expiry Date -->
			<div v-if="productInfo.name" class="field-group">
				<label for="expiryDay">Expiry Date <h6 style="display: inline-flex; align-items: center; gap: 0.25rem;">
						<FontAwesomeIcon :icon="faQuestionCircle" />
						If you want to modify the year do it first
					</h6></label>
				<div class="date-row">
					<input @focus="selectInput" @input="goToNext" type="text" pattern="\d{2}" inputmode="numeric"
						id="expiryDay" name="expiryDay" ref="expiryDayInput" v-model="productInfo.expiryDay"
						placeholder="Day" maxlength="2" />
					<input @focus="selectInput" @input="goToNext" type="text" pattern="\d{2}" inputmode="numeric"
						id="expiryMonth" name="expiryMonth" ref="expiryMonthInput" v-model="productInfo.expiryMonth"
						placeholder="Month" maxlength="2" />
					<input @focus="selectInput" @input="goToNext" type="text" pattern="\d{2}" inputmode="numeric"
						id="expiryYear" name="expiryYear" ref="expiryYearInput" v-model="productInfo.expiryYear"
						placeholder="Year" maxlength="2" />
				</div>
			</div>

			<!-- Submit Button -->
			<button type="submit" :class="{ 'submit-btn': true, 'error-btn': !!addError, 'loading': isSubmitting }"
				:disabled="isSubmitting">
				{{ isSubmitting ? 'Creating...' : (addError ?? 'Add Product') }}
			</button>
		</form>
	</section>
</template>

<script setup lang="ts">
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { emit } from '@tauri-apps/api/event';
import { checkPermissions, scan, requestPermissions, Format, cancel } from '@tauri-apps/plugin-barcode-scanner';
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { addProduct, useProducts } from '../services/products';
import { CLIENT_ID } from '../main';
import type { ProductPrefill } from '../bindings/ProductPrefill';

let scanning = ref(false);
let prefilling = ref(false);
let isSubmitting = ref(false);

interface ProductInfo {
	barCode: string;
	name: string;
	expiryDay: string | null;
	expiryMonth: string | null;
	expiryYear: string | null;
}

let productInfo = ref<ProductInfo>({
	barCode: '',
	name: '',
	expiryDay: null,
	expiryMonth: null,
	expiryYear: String(new Date().getFullYear() % 100),
});

let prefilled = ref<ProductPrefill | null>(null);
let scanError = ref<string | null>(null);
let addError = ref<string | null>(null);
let imageUploadError = ref<string | null>(null);
let showNameError = ref(false);

let selectedImage = ref<File | null>(null);
let imagePreview = ref<string | null>(null);

const productBarCodeInput = ref<HTMLInputElement | null>(null);
const productNameInput = ref<HTMLInputElement | null>(null);
const expiryDayInput = ref<HTMLInputElement | null>(null);
const expiryMonthInput = ref<HTMLInputElement | null>(null);
const expiryYearInput = ref<HTMLInputElement | null>(null);
const cameraCaptureInput = ref<HTMLInputElement | null>(null);

const inputOrder = [productBarCodeInput, expiryDayInput, expiryMonthInput];

watch(scanning, (isScanning) => {
	document.body.classList.toggle('scan-active', isScanning);
});

watch(productInfo, () => {
	if (addError.value) {
		addError.value = null;
	}
	if (productInfo.value.expiryDay && !isDayValid(productInfo.value.expiryDay)) {
		expiryDayInput.value?.classList.add('input-error');
	} else {
		expiryDayInput.value?.classList.remove('input-error');
	}
	if (productInfo.value.expiryMonth && !isMonthValid(productInfo.value.expiryMonth)) {
		expiryMonthInput.value?.classList.add('input-error');
	} else {
		expiryMonthInput.value?.classList.remove('input-error');
	}
	if (productInfo.value.expiryYear && !isYearValid(productInfo.value.expiryYear)) {
		expiryYearInput.value?.classList.add('input-error');
	} else {
		expiryYearInput.value?.classList.remove('input-error');
	}
}, { deep: true });

watchEffect(() => {
	if (scanning.value) { blurAllInputs(); }
});

onMounted(() => {
	startScan();
});

onBeforeUnmount(() => {
	cancelScan();
	document.body.classList.toggle('scan-active', false);
});

function isDayValid(day: string | null): boolean {
	if (!day) return false;
	const dayNum = parseInt(day);
	return dayNum >= 1 && dayNum <= 31;
}

function isMonthValid(month: string | null): boolean {
	if (!month) return false;
	const monthNum = parseInt(month);
	return monthNum >= 1 && monthNum <= 12;
}

function isYearValid(year: string | null): boolean {
	if (!year) return false;
	const yearNum = parseInt(year);
	const currentYear = new Date().getFullYear() % 100;
	return yearNum >= currentYear && yearNum <= currentYear + 20;
}

function blurAllInputs() {
	productBarCodeInput.value?.blur();
	productNameInput.value?.blur();
	expiryDayInput.value?.blur();
	expiryMonthInput.value?.blur();
	expiryYearInput.value?.blur();
}

function goToNext(event: Event, forceNext = false) {
	const target = event.target as HTMLInputElement;
	const value = target.value;
	const maxLength = target.maxLength > 0 ? target.maxLength : 2;

	if (value.length >= maxLength || forceNext) {
		const currentIndex = inputOrder.findIndex((input) => input.value === target);
		if (currentIndex !== -1 && currentIndex < inputOrder.length - 1) {
			inputOrder[currentIndex + 1].value?.focus();
		} else if (currentIndex === inputOrder.length - 1) {
			createNewProduct();
			blurAllInputs();
		}
	}
}

async function createNewProduct() {
	const verificationResult = verifyProductInfo();
	if (verificationResult !== true) {
		console.warn("Product info is not valid:", verificationResult);
		setAddError(verificationResult as string);
		return;
	}

	isSubmitting.value = true;
	try {
		const imageBase64 = selectedImage.value
			? await toBase64Payload(selectedImage.value)
			: null;

		await addProduct({
			barcode: productInfo.value.barCode,
			name: productInfo.value.name,
			image: null,
			image_base64: imageBase64,
			expiration_date: `${'20' + productInfo.value.expiryYear}-${String(productInfo.value.expiryMonth).padStart(2, '0')}-${String(productInfo.value.expiryDay).padStart(2, '0')}`,
			client_id: CLIENT_ID,
		});

		emit("productAdded");
		resetForm();
		inputOrder[0].value?.focus();
	} catch (error) {
		console.error("Error creating product:", error);
		setAddError("Failed to add product");
	} finally {
		isSubmitting.value = false;
	}
}

function resetForm() {
	productInfo.value = {
		barCode: '',
		name: '',
		expiryDay: null,
		expiryMonth: null,
		expiryYear: String(new Date().getFullYear() % 100),
	};
	prefilled.value = null;
	selectedImage.value = null;
	imagePreview.value = null;
	showNameError.value = false;
	imageUploadError.value = null;
}

function setAddError(message: string) {
	addError.value = message;
	setTimeout(() => {
		addError.value = null;
	}, 3000);
}

function verifyProductInfo(): string | boolean {
	if (!productInfo.value.barCode) {
		return "Barcode is required";
	}
	if (!productInfo.value.name || productInfo.value.name.trim() === '') {
		return "Product name is required";
	}
	if (!productInfo.value.expiryDay || !productInfo.value.expiryMonth || !productInfo.value.expiryYear) {
		return "All expiry fields are required";
	}
	const day = parseInt(productInfo.value.expiryDay);
	const month = parseInt(productInfo.value.expiryMonth);
	const year = parseInt('20' + productInfo.value.expiryYear);
	if (isNaN(day) || isNaN(month) || isNaN(year)) {
		return "Invalid expiry date";
	}
	if (day < 1 || day > 31 || month < 1 || month > 12) {
		return "Invalid expiry date";
	}
	return true;
}

function onNameInput() {
	showNameError.value = false;
	if (addError.value) {
		addError.value = null;
	}
}

function selectInput(inputRef: FocusEvent) {
	(inputRef.target as HTMLInputElement).select();
}


function setImagePreview(file: File) {
	const reader = new FileReader();
	reader.onload = (e) => {
		imagePreview.value = e.target?.result as string;
	};
	reader.readAsDataURL(file);
}

function toBase64Payload(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== 'string') {
				reject(new Error('Failed to read image'));
				return;
			}

			const base64 = result.includes(',') ? result.split(',')[1] : result;
			if (!base64) {
				reject(new Error('Failed to encode image'));
				return;
			}

			resolve(base64);
		};
		reader.onerror = () => reject(new Error('Failed to encode image'));
		reader.readAsDataURL(file);
	});
}

function openSystemCamera() {
	imageUploadError.value = null;
	cameraCaptureInput.value?.click();
}

function onSystemCameraImageSelected(event: Event) {
	const target = event.target as HTMLInputElement;
	const file = target.files?.[0];

	if (!file) return;

	const maxSizeBytes = 10 * 1024 * 1024;
	if (file.size > maxSizeBytes) {
		imageUploadError.value = 'Image must be smaller than 10MB';
		setTimeout(() => {
			imageUploadError.value = null;
		}, 3000);
		return;
	}

	selectedImage.value = file;
	setImagePreview(file);

	if (cameraCaptureInput.value) {
		cameraCaptureInput.value.value = '';
	}
}

async function retakeImage() {
	clearImage();
	openSystemCamera();
}

function clearImage() {
	selectedImage.value = null;
	imagePreview.value = null;
}

function cancelScan() {
	cancel();
	scanning.value = false;
}

async function startScan() {
	scanError.value = null;
	try {
		let permissionState = await checkPermissions();

		if (permissionState !== 'granted') {
			permissionState = await requestPermissions();
		}

		if (permissionState !== 'granted') {
			console.log('Camera permission not granted.');
			scanError.value = 'Camera permission not granted';
			return;
		}

		console.log('Permissions granted, starting scan...');
		scanning.value = true;
		const result = await scan({ windowed: true, formats: [Format.EAN13, Format.EAN8] });
		scanning.value = false;

		if (result) {
			console.log('Scanned code:', result);
			if (result.format !== Format.EAN13 && result.format !== Format.EAN8) {
				console.warn('Scanned code is not in EAN-13 or EAN-8 format');
				scanError.value = 'Scanned code is in invalid format (' + result.format + ')';
				return;
			}

			productInfo.value.barCode = result.content;
			await loadPrefill(result.content);
			return;
		}

		console.log('No code scanned');
	} catch (error) {
		console.error('Error checking permissions or scanning:', error);
		scanError.value = 'Failed to scan barcode';
	}
}

async function loadPrefill(barcode: string) {
	prefilling.value = true;
	try {
		const { getPrefill } = useProducts(CLIENT_ID);
		const prefillData = await getPrefill(barcode);
		prefilled.value = prefillData;

		// Auto-populate name if available
		if (prefillData.name) {
			productInfo.value.name = prefillData.name;
		}

		// Focus name input for confirmation/editing
		setTimeout(() => {
			productNameInput.value?.focus();
		}, 100);
	} catch (error) {
		console.error('Prefill lookup failed:', error);
		// Still allow user to enter name manually
		prefilled.value = {
			barcode,
			name: null,
			image: null,
			source: 'none',
		};
		setTimeout(() => {
			productNameInput.value?.focus();
		}, 100);
	} finally {
		prefilling.value = false;
	}
}

function getSourceLabel(source: string): string {
	switch (source) {
		case 'barcode_db':
			return 'from database';
		case 'user_product_info':
			return 'saved';
		case 'user_product_info_global':
			return 'from others';
		case 'none':
			return 'no match';
		default:
			return source;
	}
}

</script>

<style scoped>
.add-product {
	display: flex;
	justify-content: center;
	padding-left: 1rem;
	padding-right: 1rem;
}

.add-product.scan-active {
	background: transparent;
}

.form-card {
	width: min(560px, 100%);
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
	padding: 1.5rem;
	border: 1px solid var(--surface-border);
	border-radius: 12px;
	background: var(--surface);
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
	margin-bottom: 8vh;
}

.form-card.scan-active {
	background: rgba(2, 6, 23, 0.2);
	border-color: rgba(255, 255, 255, 0.35);
	box-shadow: none;
	backdrop-filter: blur(1px);
}

.title {
	margin: 0;
	font-size: 1.35rem;
	font-weight: 700;
	color: var(--text-primary);
}

.field-group {
	display: flex;
	flex-direction: column;
	gap: 0.45rem;
}

label {
	font-size: 0.95rem;
	font-weight: 600;
	color: var(--text-secondary);
}

input {
	width: 100%;
	height: 42px;
	padding: 0 0.75rem;
	font-size: 0.95rem;
	border: 1px solid var(--surface-border);
	background: var(--surface-strong);
	color: var(--text-primary);
	border-radius: 8px;
	box-sizing: border-box;
}

input:focus {
	outline: none;
	border-color: var(--brand);
	box-shadow: 0 0 0 3px var(--focus-ring);
}

input:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.barcode-row {
	display: flex;
	align-items: center;
}

.scan-btn,
.submit-btn {
	height: 42px;
	margin-top: 1rem;
	padding: 0 1rem;
	font-size: 0.95rem;
	font-weight: 600;
	border: none;
	border-radius: 8px;
	cursor: pointer;
	transition: filter 0.2s ease, transform 0.05s ease;
}

.scan-btn {
	white-space: nowrap;
	background: var(--brand-soft);
	color: var(--brand-strong);
}

button.error-btn {
	background: var(--error-soft);
	color: var(--error-strong);
}

.submit-btn {
	background: var(--brand);
	color: var(--surface);
}

.submit-btn:disabled {
	opacity: 0.7;
	cursor: not-allowed;
}

.scan-btn:hover,
.submit-btn:hover {
	filter: brightness(0.95);
}

.scan-btn:active,
.submit-btn:active {
	transform: translateY(1px);
}

@media (max-width: 540px) {
	.barcode-row {
		flex-direction: column;
		align-items: stretch;
	}
}

:global(body.scan-active) {
	background: transparent !important;
}

:global(body.scan-active #app) {
	background: transparent !important;
}

:global(body.scan-active .container) {
	background: transparent !important;
}

.date-row {
	display: flex;
	gap: 0.75rem;
}

input.input-error {
	border-color: var(--error-strong);
}

.prefill-section {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	padding: 1rem;
	background: var(--surface-strong);
	border: 1px solid var(--surface-border);
	border-radius: 8px;
}

.prefill-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 1rem;
}

.prefill-header h3 {
	margin: 0;
	font-size: 1rem;
	color: var(--text-primary);
}

.prefill-source {
	display: inline-block;
	padding: 0.25rem 0.75rem;
	background: var(--brand-soft);
	color: var(--brand-strong);
	border-radius: 4px;
	font-size: 0.8rem;
	font-weight: 600;
}

.prefill-image-preview {
	width: 100%;
	height: 150px;
	border-radius: 8px;
	overflow: hidden;
	background: var(--surface);
	display: flex;
	align-items: center;
	justify-content: center;
}

.prefill-image-preview img {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
}

.camera-capture-area {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.image-preview {
	position: relative;
	width: 100%;
	max-width: 280px;
	height: 180px;
	border-radius: 8px;
	overflow: hidden;
	background: var(--surface-strong);
	border: 1px solid var(--surface-border);
}

.image-preview img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.image-preview-actions {
	display: flex;
	gap: 0.5rem;
	padding: 0.5rem;
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	background: linear-gradient(to top, rgba(2, 6, 23, 0.7), transparent);
}

.camera-controls {
	display: flex;
	gap: 0.5rem;
	flex-wrap: wrap;
}

.camera-controls .scan-btn {
	width: 100%;
}

.hidden-capture-input {
	display: none;
}

.image-placeholder {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	flex: 1;
	padding: 1rem;
	border: 2px dashed var(--surface-border);
	border-radius: 8px;
	background: var(--surface-strong);
}

.upload-btn {
	height: 40px;
	padding: 0 1rem;
	background: var(--brand-soft);
	color: var(--brand-strong);
	border: none;
	border-radius: 6px;
	font-size: 0.9rem;
	font-weight: 600;
	cursor: pointer;
	transition: filter 0.2s ease;
}

.upload-btn:hover {
	filter: brightness(0.95);
}

.upload-hint {
	margin: 0;
	font-size: 0.8rem;
	color: var(--text-secondary);
}

.field-error {
	font-size: 0.8rem;
	color: var(--error-strong);
	margin-top: -0.25rem;
}

.loading-indicator {
	padding: 1rem;
	text-align: center;
	color: var(--text-secondary);
	font-size: 0.9rem;
}

.cancel-btn {
	background: var(--error-soft);
	color: var(--error-strong);
}
</style>
