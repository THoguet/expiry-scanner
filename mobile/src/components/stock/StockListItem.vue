<template>
	<article class="stock-card" :class="stateClass" @click="onCardClick">
		<div v-if="!isDetailed" class="compact-controls">
			<div class="compact-main">
				<p class="stock-name">{{ stock.name }}</p>
				<p class="stock-missing" :class="stateClass">{{ stateLabel }}</p>
				<div class="quick-quantity">
					<button type="button" @click="emit('decrement')">-1</button>
					<span>{{ normalizeQuantity(stock.current_quantity) }}{{ stock.unit ? ` ${stock.unit}` : '' }}</span>
					<button type="button" @click="emit('increment')">+1</button>
				</div>
			</div>
		</div>

		<template v-else>
			<div class="stock-card-header">
				<p class="stock-name">{{ stock.name }}</p>
				<p class="stock-missing" :class="stateClass">{{ stateLabel }}</p>
			</div>
			<p class="stock-meta">{{ quantitySummary }}</p>

			<div class="stock-fields">
				<StockFormFields :model="stock" />
			</div>

			<div class="actions-row">
				<button type="button" @click="emit('decrement')">-1</button>
				<button type="button" @click="emit('increment')">+1</button>
				<button type="button" class="save-btn" @click="emit('save')">Save</button>
				<button type="button" class="danger" @click="emit('remove')">Delete</button>
			</div>
		</template>
	</article>
</template>

<script setup lang="ts">
import type { Stock } from "../../bindings/Stock";
import StockFormFields from "./StockFormFields.vue";

type SaveState = "idle" | "saving" | "saved" | "error";

const emit = defineEmits<{
	increment: [];
	decrement: [];
	save: [];
	remove: [];
	toggleView: [];
}>();

defineProps<{
	stock: Stock;
	isDetailed: boolean;
	stateClass: "critical" | "warning" | "ok";
	stateLabel: string;
	quantitySummary: string;
	saveState: SaveState;
}>();

function normalizeQuantity(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.trunc(value));
}

function onCardClick(event: MouseEvent): void {
	const target = event.target as HTMLElement;
	if (
		target.closest("button") ||
		target.closest("input") ||
		target.closest("label") ||
		target.closest("textarea") ||
		target.closest("select")
	) {
		return;
	}

	emit("toggleView");
}
</script>

<style scoped>
.stock-card {
	background: var(--surface);
	border: 1px solid var(--surface-border);
	border-radius: 0.8rem;
	padding: 0.75rem;
	display: flex;
	flex-direction: column;
	gap: 0.55rem;
	cursor: pointer;
}

.stock-card.critical {
	border-color: #ef4444;
	background: color-mix(in oklab, var(--surface) 88%, #ef4444 12%);
}

.stock-card.warning {
	border-color: #f59e0b;
	background: color-mix(in oklab, var(--surface) 90%, #f59e0b 10%);
}

.stock-card.ok {
	border-color: #22c55e;
	background: color-mix(in oklab, var(--surface) 92%, #22c55e 8%);
}

.stock-name {
	margin: 0;
	font-weight: 700;
	min-width: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.stock-missing {
	margin: 0;
	font-size: 0.8rem;
	padding: 0.2rem 0.5rem;
	border-radius: 999px;
	border: 1px solid transparent;
	text-align: center;
	width: fit-content;
	max-width: 100%;
	flex-shrink: 0;
}

.stock-missing.critical {
	color: #991b1b;
	background: #fee2e2;
	border-color: #fecaca;
}

.stock-missing.warning {
	color: #92400e;
	background: #fef3c7;
	border-color: #fde68a;
}

.stock-missing.ok {
	color: #166534;
	background: #dcfce7;
	border-color: #bbf7d0;
}

.compact-controls {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
}

.compact-main {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto auto;
	align-items: center;
	gap: 0.45rem;
}

.quick-quantity {
	display: inline-grid;
	grid-template-columns: auto auto auto;
	align-items: center;
	gap: 0.35rem;
	background: var(--surface-strong);
	border: 1px solid var(--surface-border);
	padding: 0.3rem;
	border-radius: 0.55rem;
}

.quick-quantity button {
	height: 2rem;
	min-width: 2rem;
	border-radius: 0.45rem;
	border: 1px solid var(--surface-border);
	background: var(--surface);
	color: var(--text-primary);
	font-weight: 700;
}

.quick-quantity span {
	min-width: 2.25rem;
	text-align: center;
	font-weight: 700;
}

.stock-card-header {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: 0.45rem;
}

.stock-meta {
	margin: 0;
	font-size: 0.82rem;
	color: var(--text-secondary);
}

.stock-fields {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.5rem;
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

.actions-row .save-btn {
	background: var(--brand-soft);
	color: var(--brand-strong);
	border-color: color-mix(in oklab, var(--brand) 35%, var(--surface-border) 65%);
}

.actions-row .danger {
	background: var(--error-soft);
	color: var(--error-strong);
}

@media (max-width: 420px) {
	.stock-fields {
		grid-template-columns: 1fr;
	}
}
</style>
