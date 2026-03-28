<template>
	<section class="stock-page app-container">
		<StockPageHeader @share="shareGroceryList" />

		<form class="new-stock-form" @submit.prevent="createNewStock">
			<label>
				Name
				<input v-model="newStock.name" type="text" maxlength="80" placeholder="Rice" required />
			</label>
			<label>
				Desired quantity
				<input v-model.number="newStock.desired_quantity" type="number" min="0" placeholder="4" required />
			</label>
			<label>
				Current quantity
				<input v-model.number="newStock.current_quantity" type="number" min="0" placeholder="1" required />
			</label>
			<label>
				Unit
				<input v-model="newStock.unit" type="text" maxlength="4" placeholder="pcs, kg..." />
			</label>
			<label>
				Location
				<input v-model="newStock.location" type="text" maxlength="40" placeholder="pantry" />
			</label>
			<button type="submit" :disabled="creatingStock">{{ creatingStock ? 'Creating...' : 'Add stock line'
			}}</button>
		</form>

		<StockSearchToolbar v-model="searchQuery" :visible="filteredStocks.length" :total="stocks.length" />

		<div v-if="loading" class="status">Loading stocks...</div>
		<div v-else-if="stocks.length === 0" class="status">No stock yet. Add your first stock line above.</div>
		<div v-else-if="filteredStocks.length === 0" class="status">No stock matches your search.</div>

		<div v-else class="stock-grid">
			<StockListItem v-for="stock in filteredStocks" :key="stock.id.toString()" :stock="stock"
				:is-detailed="isLineDetailed(stock.id)" :state-class="getStockStateClass(stock)"
				:state-label="getStockStateLabel(stock)" :quantity-summary="quantitySummary(stock)"
				:save-state="getLineSaveState(stock.id)" @increment="increment(stock)" @decrement="decrement(stock)"
				@save="save(stock)" @remove="remove(stock.id)" @toggle-view="toggleLineView(stock.id)" />
		</div>
	</section>
</template>

<script setup lang="ts">
import { useStockManager } from "../../composables/useStockManager";
import StockListItem from "./StockListItem.vue";
import StockPageHeader from "./StockPageHeader.vue";
import StockSearchToolbar from "./StockSearchToolbar.vue";

const {
	stocks,
	loading,
	creatingStock,
	searchQuery,
	filteredStocks,
	newStock,
	isLineDetailed,
	toggleLineView,
	getLineSaveState,
	getStockStateClass,
	getStockStateLabel,
	quantitySummary,
	createNewStock,
	save,
	increment,
	decrement,
	remove,
	shareGroceryList,
} = useStockManager();
</script>

<style scoped>
.stock-page {
	padding-right: 1rem;
	padding-left: 1rem;
	padding-bottom: 9rem;
	overflow: auto;
	display: flex;
	flex-direction: column;
	gap: 0.9rem;
}

.new-stock-form {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.5rem;
	background: var(--surface);
	padding: 0.75rem;
	border: 1px solid var(--surface-border);
	border-radius: 0.8rem;
}

.new-stock-form label {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	font-size: 0.85rem;
}

.new-stock-form button {
	grid-column: span 2;
	padding: 0.55rem;
	border-radius: 0.55rem;
	border: none;
	background: var(--brand);
	color: var(--surface);
	font-weight: 700;
}

input {
	width: 100%;
	box-sizing: border-box;
	padding: 0.45rem 0.55rem;
	border-radius: 0.55rem;
	border: 1px solid var(--surface-border);
	background: var(--surface-strong);
	color: var(--text-primary);
}

.status {
	margin: 0;
	padding: 0.65rem;
	border-radius: 0.65rem;
	background: var(--surface-strong);
	border: 1px solid var(--surface-border);
}

.stock-grid {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

@media (max-width: 420px) {
	.new-stock-form {
		grid-template-columns: 1fr;
	}

	.new-stock-form button {
		grid-column: span 1;
	}
}
</style>
