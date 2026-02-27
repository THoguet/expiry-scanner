<template>
	<div style="background-image: url('/empty_fridge.jpg');" class="fridge app-container">
		<div v-if="loading" class="status-text">Loading products...</div>
		<div v-else-if="error" class="status-text">{{ error }}</div>
		<div v-else class="inner-fridge">
			<ProductBox v-for="product in products" :product="product" @productDeleted="loadProducts" />
			<div v-if="products.length === 0" class="status-text">
				<p>Your fridge is empty! Add some products to get started.</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getProductsWithBarcode, ProductWithBarcode } from '../services/backend';
import ProductBox from './ProductBox.vue';
import { CLIENT_ID } from '../main';

const products = ref<ProductWithBarcode[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function loadProducts() {
	loading.value = true;
	error.value = null;

	try {
		products.value = await getProductsWithBarcode(CLIENT_ID);
	} catch (backendError) {
		console.error(backendError);
		error.value = "Failed to load products";
	} finally {
		loading.value = false;
	}
}

onMounted(loadProducts);

</script>

<style scoped>
.fridge {
	padding-top: 1rem;
	background-size: cover;
	background-position: center;
	color: var(--text-primary);
	position: relative;
	padding-bottom: 7.5vh;
	height: calc(100% - 7.5vh - 1rem);
	overflow: hidden;
}

.fridge::before {
	content: "";
	position: absolute;
	inset: 0;
	background: var(--surface-overlay);
	pointer-events: none;
}

.status-text,
.inner-fridge {
	position: relative;
	z-index: 1;
	height: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	flex-direction: row;
	overflow: scroll;
	gap: 1rem;
}

.status-text {
	padding: 1rem;
	text-align: center;
	color: var(--text-primary);
}

.inner-fridge {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	padding-bottom: 1rem;
}
</style>