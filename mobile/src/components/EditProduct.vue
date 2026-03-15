<template>
	<form @submit.prevent="saveEdit()" class="edit-product-form">
		<div class="form-group">
			<label for="name">Name</label>
			<input id="name" type="text" disabled :value="product[1]?.product_name ?? 'Unknown Product'" />
		</div>
		<div class="form-group">
			<label for="barcode">Barcode</label>
			<input id="barcode" type="text" v-model="product[0].barcode" />
		</div>
		<div class="form-group">
			<label for="expiration_date">Expiration Date</label>
			<input id="expiration_date" type="date" v-model="product[0].expiration_date" required />
		</div>
		<div class="form-actions">
			<button type="submit">Save</button>
			<button type="button" @click="closePanel">Cancel</button>
			<button type="button" @click="deletePro()">Delete</button>
		</div>
	</form>
</template>

<script setup lang="ts">
import { ProductWithBarcode } from '../services/backend';
import { removeProduct, saveEditedProduct } from '../services/products';

const emit = defineEmits<{ closeEditProductPanel: [] }>();
const props = defineProps<{
	product: ProductWithBarcode;
}>();

function deletePro() {
	removeProduct({ id: props.product[0].id, client_id: props.product[0].client_id }).catch((error) => {
		console.error("Failed to delete product:", error);
	});
	emit('closeEditProductPanel');
}

function closePanel() {
	emit('closeEditProductPanel');
}

function saveEdit() {
	saveEditedProduct(props.product[0]).catch((error) => {
		console.error("Failed to edit product:", error);
	});
	emit('closeEditProductPanel');
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
	max-width: 400px;
	z-index: 1000;
}

.form-group {
	margin-bottom: 1rem;
}

.form-group label {
	display: block;
	margin-bottom: 0.5rem;
	font-weight: bold;
}

.form-group input {
	width: calc(100% - 1rem);
	padding: 0.5rem;
	border: 1px solid #ccc;
	border-radius: 4px;
}

.form-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
}

.form-actions button {
	padding: 0.5rem 1rem;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.form-actions button[type="submit"] {
	background-color: #4CAF50;
	color: white;
}

.form-actions button[type="button"] {
	background-color: #f44336;
	color: white;
}
</style>