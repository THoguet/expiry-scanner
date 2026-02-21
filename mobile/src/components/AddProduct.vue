<template>
	<section class="add-product app-container" :class="{ 'scan-active': scanning }">
		<form class="form-card" :class="{ 'scan-active': scanning }" @submit.prevent="createNewProduct">
			<h2 class="title">Add Product</h2>

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

			<div class="field-group">
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

			<button type="submit" :class="addError ? 'submit-btn error-btn' : 'submit-btn'">{{ addError ?? 'Add Product'
			}}</button>
		</form>
	</section>
</template>

<script setup lang="ts">
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { emit } from '@tauri-apps/api/event';
import { checkPermissions, scan, requestPermissions, Format, cancel } from '@tauri-apps/plugin-barcode-scanner';
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { createProduct } from '../services/backend';
import { CLIENT_ID } from '../main';

let scanning = ref(false);

interface ProductInfo {
	barCode: string;
	expiryDay: string | null;
	expiryMonth: string | null;
	expiryYear: string | null;
}

let productInfo = ref<ProductInfo>({
	barCode: '',
	expiryDay: null,
	expiryMonth: null,
	expiryYear: String(new Date().getFullYear() % 100),
});

let scanError = ref<string | null>(null);
let addError = ref<string | null>(null);

const productBarCodeInput = ref<HTMLInputElement | null>(null);

const expiryDayInput = ref<HTMLInputElement | null>(null);
const expiryMonthInput = ref<HTMLInputElement | null>(null);
const expiryYearInput = ref<HTMLInputElement | null>(null);

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

function createNewProduct() {
	const verificationResult = verifyProductInfo();
	if (verificationResult !== true) {
		console.warn("Product info is not valid:", verificationResult);
		setAddError(verificationResult as string);
		return;
	}
	createProduct({
		barcode: productInfo.value.barCode,
		expiration_date: `${'20' + productInfo.value.expiryYear}-${String(productInfo.value.expiryMonth).padStart(2, '0')}-${String(productInfo.value.expiryDay).padStart(2, '0')}`,
		client_id: CLIENT_ID,
	}).then(() => {
		emit("productAdded");
		productInfo.value = {
			barCode: '',
			expiryDay: null,
			expiryMonth: null,
			expiryYear: String(new Date().getFullYear() % 100),
		};
		inputOrder[0].value?.focus();
	}).catch((error) => {
		console.error("Error creating product:", error);
		setAddError("Failed to add product");
	});
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

function selectInput(inputRef: FocusEvent) {
	(inputRef.target as HTMLInputElement).select();
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
			expiryDayInput.value?.focus();
			return;
		}

		console.log('No code scanned');
	} catch (error) {
		console.error('Error checking permissions or scanning:', error);
		scanError.value = 'Failed to scan barcode';
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

.barcode-row {
	display: flex;
	gap: 0.75rem;
	align-items: center;
}

.scan-btn,
.submit-btn {
	height: 42px;
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
</style>