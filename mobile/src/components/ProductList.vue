<template>
	<div style="background-image: url('/empty_fridge.jpg');" class="fridge">
		<div v-if="loading">Loading products...</div>
		<div v-else-if="error">{{ error }}</div>
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

const CLIENT_ID = "mobile-client";

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
}

.inner-fridge {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
}
</style>