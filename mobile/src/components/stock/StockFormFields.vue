<template>
	<label class="stock-form-field">
		Name
		<input v-model="model.name" type="text" maxlength="80" :placeholder="namePlaceholder" required />
	</label>
	<label class="stock-form-field">
		Desired quantity
		<input v-model.number="model.desired_quantity" type="number" min="0" :required="requireQuantities" />
	</label>
	<label class="stock-form-field">
		Current quantity
		<input v-model.number="model.current_quantity" type="number" min="0" :required="requireQuantities" />
	</label>
	<label class="stock-form-field">
		Unit
		<input autocapitalize="off" v-model="model.unit" type="text" maxlength="4" placeholder="pcs, kg..." />
	</label>
	<label class="stock-form-field">
		Location
		<input v-model="model.location" type="text" maxlength="40" :placeholder="locationPlaceholder" />
	</label>
</template>

<script setup lang="ts">
type StockFormModel = {
	name: string;
	desired_quantity: number;
	current_quantity: number;
	unit: string | null;
	location: string | null;
};

withDefaults(
	defineProps<{
		model: StockFormModel;
		namePlaceholder?: string;
		locationPlaceholder?: string;
		requireQuantities?: boolean;
	}>(),
	{
		namePlaceholder: "Item name",
		locationPlaceholder: "fridge, pantry",
		requireQuantities: false,
	},
);
</script>

<style scoped>
.stock-form-field {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	font-size: 0.85rem;
}

.stock-form-field input {
	width: 100%;
	box-sizing: border-box;
	padding: 0.45rem 0.55rem;
	border-radius: 0.55rem;
	border: 1px solid var(--surface-border);
	background: var(--surface-strong);
	color: var(--text-primary);
}
</style>
