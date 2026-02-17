<template>
	<div>
		<div v-if="loading">Loading products...</div>
		<div v-else-if="error">{{ error }}</div>
		<ul v-else>
			<li v-for="product in products" :key="product.id.toString()">
				{{ product.barcode }} - {{ product.expiration_date }}
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Product } from '../bindings/Product';
import { getProducts } from '../services/backend';

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

<style scoped></style>