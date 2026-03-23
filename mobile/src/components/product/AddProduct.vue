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
import { useAddProductForm } from '../../composables/product/useAddProductForm';

const {
	scanning,
	prefilling,
	isSubmitting,
	productInfo,
	prefilled,
	scanError,
	addError,
	imageUploadError,
	showNameError,
	imagePreview,
	productBarCodeInput,
	productNameInput,
	expiryDayInput,
	expiryMonthInput,
	expiryYearInput,
	cameraCaptureInput,
	goToNext,
	createNewProduct,
	onNameInput,
	selectInput,
	clearImage,
	retakeImage,
	openSystemCamera,
	onSystemCameraImageSelected,
	startScan,
	cancelScan,
	getSourceLabel,
} = useAddProductForm();

void [
	productBarCodeInput,
	productNameInput,
	expiryDayInput,
	expiryMonthInput,
	expiryYearInput,
	cameraCaptureInput,
];

</script>

<style scoped src="./styles/add-product.css"></style>
