<template>
	<section class="stock-page app-container">
		<header class="stock-header">
			<h2>
				<FontAwesomeIcon :icon="faBoxesStacked" />
				<span>Stock Manager</span>
			</h2>
			<button type="button" class="share-btn" :disabled="shareLoading" @click="shareGroceryList">
				{{ shareLoading ? 'Sharing...' : 'Share grocery list' }}
			</button>
		</header>

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
				<input v-model="newStock.unit" type="text" maxlength="20" placeholder="pcs, kg..." />
			</label>
			<label>
				Location
				<input v-model="newStock.location" type="text" maxlength="40" placeholder="pantry" />
			</label>
			<button type="submit" :disabled="creatingStock">{{ creatingStock ? 'Creating...' : 'Add stock line'
			}}</button>
		</form>

		<p v-if="statusMessage" class="status success">{{ statusMessage }}</p>
		<p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
		<p v-if="error" class="status error">{{ error }}</p>

		<div v-if="loading" class="status">Loading stocks...</div>
		<div v-else-if="stocks.length === 0" class="status">No stock yet. Add your first stock line above.</div>

		<div v-else class="stock-grid">
			<article v-for="stock in stocks" :key="stock.id.toString()" class="stock-card">
				<p class="stock-id">Stock #{{ stock.id.toString() }}</p>
				<label>
					Name
					<input v-model="stock.name" type="text" maxlength="80" placeholder="Item name" required />
				</label>
				<label>
					Desired quantity
					<input v-model.number="stock.desired_quantity" type="number" min="0" />
				</label>
				<label>
					Current quantity
					<input v-model.number="stock.current_quantity" type="number" min="0" />
				</label>
				<label>
					Unit
					<input v-model="stock.unit" type="text" maxlength="20" placeholder="pcs, kg..." />
				</label>
				<label>
					Location
					<input v-model="stock.location" type="text" maxlength="40" placeholder="fridge, pantry..." />
				</label>

				<div class="actions-row">
					<button type="button" @click="decrement(stock)">-1</button>
					<button type="button" @click="increment(stock)">+1</button>
					<button type="button" @click="save(stock)">Save</button>
					<button type="button" class="danger" @click="remove(stock.id)">Delete</button>
				</div>
			</article>
		</div>
	</section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faBoxesStacked } from "@fortawesome/free-solid-svg-icons";
import type { Stock } from "../bindings/Stock";
import { useStocks } from "../services/stocks";

const { stocks, loading, error, loadStocks, addStock, updateStock, removeStockById, adjustStockQuantity } = useStocks();

const creatingStock = ref(false);
const shareLoading = ref(false);
const errorMessage = ref<string | null>(null);
const statusMessage = ref<string | null>(null);

const newStock = ref({
	name: "",
	desired_quantity: 1,
	current_quantity: 0,
	unit: "",
	location: "",
});

onMounted(loadStocks);

function normalizeQuantity(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.trunc(value));
}

function normalizeOptionalText(value: string | null): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(value: string): string {
	return value.trim();
}

function clearMessages(): void {
	errorMessage.value = null;
	statusMessage.value = null;
}

function setTimedMessage(message: string, isError: boolean = false): void {
	if (isError) {
		errorMessage.value = message;
		statusMessage.value = null;
	} else {
		statusMessage.value = message;
		errorMessage.value = null;
	}

	setTimeout(() => {
		errorMessage.value = null;
		statusMessage.value = null;
	}, 2500);
}

async function createNewStock(): Promise<void> {
	clearMessages();
	creatingStock.value = true;

	try {
		const name = normalizeRequiredText(newStock.value.name);
		if (!name) {
			setTimedMessage("Name is required", true);
			return;
		}

		await addStock({
			name,
			desired_quantity: normalizeQuantity(newStock.value.desired_quantity),
			current_quantity: normalizeQuantity(newStock.value.current_quantity),
			unit: normalizeOptionalText(newStock.value.unit),
			location: normalizeOptionalText(newStock.value.location),
		});

		newStock.value = {
			name: "",
			desired_quantity: 1,
			current_quantity: 0,
			unit: "",
			location: "",
		};
		setTimedMessage("Nice! Stock line added");
	} catch (saveError) {
		console.error(saveError);
		setTimedMessage("Oops, failed to add stock line", true);
	} finally {
		creatingStock.value = false;
	}
}

async function save(stock: Stock): Promise<void> {
	clearMessages();
	try {
		const name = normalizeRequiredText(stock.name);
		if (!name) {
			setTimedMessage("Name is required", true);
			return;
		}

		await updateStock(stock.id, {
			name,
			desired_quantity: normalizeQuantity(stock.desired_quantity),
			current_quantity: normalizeQuantity(stock.current_quantity),
			unit: normalizeOptionalText(stock.unit),
			location: normalizeOptionalText(stock.location),
		});
		setTimedMessage("Sweet! Stock line saved");
	} catch (saveError) {
		console.error(saveError);
		setTimedMessage("Oops, failed to save stock line", true);
	}
}

async function increment(stock: Stock): Promise<void> {
	clearMessages();
	try {
		await adjustStockQuantity(stock.id, 1);
		setTimedMessage("Nice, stock increased");
	} catch (adjustError) {
		console.error(adjustError);
		setTimedMessage("Oops, failed to increase stock", true);
	}
}

async function decrement(stock: Stock): Promise<void> {
	clearMessages();
	try {
		await adjustStockQuantity(stock.id, -1);
		setTimedMessage("Nice, stock decreased");
	} catch (adjustError) {
		console.error(adjustError);
		setTimedMessage("Oops, failed to decrease stock", true);
	}
}

async function remove(stockId: Stock["id"]): Promise<void> {
	clearMessages();
	try {
		await removeStockById(stockId);
		setTimedMessage("Done! Stock line deleted");
	} catch (deleteError) {
		console.error(deleteError);
		setTimedMessage("Oops, failed to delete stock line", true);
	}
}

function buildGroceryText(): string {
	const shouldBuy = stocks.value
		.map((stock) => {
			const desired = normalizeQuantity(stock.desired_quantity);
			const current = normalizeQuantity(stock.current_quantity);
			const missing = Math.max(0, desired - current);
			if (missing === 0) return null;

			const name = normalizeRequiredText(stock.name) || "Unnamed";
			const unit = normalizeOptionalText(stock.unit);
			const location = normalizeOptionalText(stock.location);
			const totalText = unit ? `${current}/${desired} ${unit}` : `${current}/${desired}`;
			const missingText = unit ? `${missing} ${unit}` : `${missing}`;
			const locationText = location ? ` (${location})` : "";

			return `- ${name}: ${totalText} (need ${missingText})${locationText}`;
		})
		.filter((line): line is string => line !== null);

	const stocked = stocks.value
		.map((stock) => {
			const desired = normalizeQuantity(stock.desired_quantity);
			const current = normalizeQuantity(stock.current_quantity);
			if (current < desired) return null;

			const name = normalizeRequiredText(stock.name) || "Unnamed";
			const unit = normalizeOptionalText(stock.unit);
			const location = normalizeOptionalText(stock.location);
			const quantityText = unit ? `${current}/${desired} ${unit}` : `${current}/${desired}`;
			const locationText = location ? ` (${location})` : "";

			return `- ${name}: ${quantityText}${locationText}`;
		})
		.filter((line): line is string => line !== null);

	const shouldBuyLines = shouldBuy.length > 0
		? shouldBuy
		: ["- Nothing needed right now."];

	const stockedLines = stocked.length > 0
		? stocked
		: ["- No fully stocked items yet."];

	return [
		"Grocery list",
		"",
		`Need to buy (${shouldBuy.length})`,
		...shouldBuyLines,
		"",
		`Already stocked (${stocked.length})`,
		...stockedLines,
	].join("\n");
}

async function shareGroceryList(): Promise<void> {
	clearMessages();
	shareLoading.value = true;

	const text = buildGroceryText();
	try {
		if (navigator.share) {
			await navigator.share({
				title: "Grocery list",
				text,
			});
			setTimedMessage("Nice! Grocery list shared");
			return;
		}

		await navigator.clipboard.writeText(text);
		setTimedMessage("Nice! Grocery list copied to clipboard");
	} catch (shareError) {
		console.error(shareError);
		setTimedMessage("Oops, failed to share grocery list", true);
	} finally {
		shareLoading.value = false;
	}
}
</script>

<style scoped>
.stock-page {
	padding: 1rem;
	padding-bottom: 9rem;
	overflow: auto;
	display: flex;
	flex-direction: column;
	gap: 0.85rem;
}

.stock-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.5rem;
}

.stock-header h2 {
	margin: 0;
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 1.2rem;
}

.share-btn {
	background: var(--surface-strong);
	border: 1px solid var(--surface-border);
	color: var(--text-primary);
	padding: 0.5rem 0.75rem;
	border-radius: 0.6rem;
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

.status.success {
	background: var(--brand-soft);
}

.status.error {
	background: var(--error-soft);
	color: var(--error-strong);
}

.stock-grid {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.stock-card {
	background: var(--surface);
	border: 1px solid var(--surface-border);
	border-radius: 0.8rem;
	padding: 0.75rem;
	display: flex;
	flex-direction: column;
	gap: 0.55rem;
}

.stock-id {
	margin: 0;
	font-size: 0.8rem;
	opacity: 0.75;
}

.stock-card label {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	font-size: 0.85rem;
}

.actions-row {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 0.4rem;
}

.actions-row button {
	padding: 0.5rem;
	border: 1px solid var(--surface-border);
	border-radius: 0.5rem;
	background: var(--surface-strong);
	color: var(--text-primary);
}

.actions-row button.danger {
	background: var(--error-soft);
	color: var(--error-strong);
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
