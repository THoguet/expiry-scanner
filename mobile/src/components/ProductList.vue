<template>
	<div style="background-image: url('/empty_fridge.jpg');" class="fridge app-container">
		<div v-if="loading" class="status-text">Loading products...</div>
		<div v-else-if="error" class="status-text">{{ error }}</div>
		<div v-else class="inner-fridge">
			<ProductBox v-for="product in products" :key="product.id.toString()" :product="product"
				@productDeleted="loadProducts" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Product } from '../bindings/Product';
import { getProducts } from '../services/backend';
import ProductBox from './ProductBox.vue';
import { CLIENT_ID } from '../main';

const products = ref<Product[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function loadProducts() {
	loading.value = true;
	error.value = null;

	try {
		products.value = await getProducts(CLIENT_ID);
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
	height: 100%;
	background-size: cover;
	background-position: center;
	color: var(--text-primary);
	position: relative;
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