<template>
	<div style="background-image: url('/empty_fridge.jpg');" class="fridge app-container">
		<div v-if="loading" class="status-text">Loading products...</div>
		<div v-else-if="error" class="status-text">{{ error }}</div>
		<div v-else class="inner-fridge">
			<ProductBox v-for="product in products" :key="product[0].id.toString()" :product="product"
				@deleteProductRequested="onDeleteProductRequested" @editProduct="openEditPanel(product)"
				@freezeRequested="onFreezeRequested" />
			<div v-if="products.length === 0" class="status-text">
				<p>Your fridge is empty! Add some products to get started.</p>
			</div>
			<EditProduct v-if="productToEdit" :product="productToEdit" @closeEditProductPanel="closeEditProductPanel" />
			<FreezeDialog v-if="productToFreeze" :productId="productToFreeze.id" :productName="productToFreeze.name"
				@close="productToFreeze = null" @freeze="onFreezeConfirmed" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ProductWithBarcode } from '../../services/backend';
import { removeProduct, useProducts } from '../../services/products';
import { useFreezer } from '../../services/freezer';
import { CLIENT_ID } from '../../main';
import ProductBox from './ProductBox.vue';
import EditProduct from './EditProduct.vue';
import FreezeDialog from './FreezeDialog.vue';
import type { Product } from '../../bindings/Product';

const { products, loading, error, loadProducts, refreshProducts } = useProducts();
const { freeze } = useFreezer();

const productToEdit = ref<ProductWithBarcode | null>(null);
const productToFreeze = ref<Product | null>(null);

function openEditPanel(product: ProductWithBarcode) {
	productToEdit.value = product;
}

function onFreezeRequested(product: Product) {
	productToFreeze.value = product;
}

async function onFreezeConfirmed(productId: bigint, totalPortions: number, keepInFridge: number) {
	try {
		await freeze(productId, totalPortions, keepInFridge);
		productToFreeze.value = null;
	} catch (e) {
		// Error is handled in the service layer
	}
}

async function onDeleteProductRequested(product: ProductWithBarcode[0]) {
	if (productToEdit.value && productToEdit.value[0].id === product.id) {
		productToEdit.value = null;
	}

	await removeProduct({ id: product.id, client_id: CLIENT_ID });
}

async function closeEditProductPanel() {
	productToEdit.value = null;
	await refreshProducts();
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