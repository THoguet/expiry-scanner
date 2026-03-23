<template>
	<section class="stock-toolbar" aria-label="Stock filters">
		<label class="search-label">
			<span>Search</span>
			<input :model-value="modelValue" @input="onInput" type="search"
				placeholder="Search by name, unit or location" autocomplete="off" />
		</label>
		<p class="toolbar-summary">
			{{ visible }} visible / {{ total }} total
		</p>
	</section>
</template>

<script setup lang="ts">
defineProps<{
	modelValue: string;
	visible: number;
	total: number;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
}>();

function onInput(event: Event): void {
	emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<style scoped>
.stock-toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: end;
	justify-content: space-between;
	gap: 0.5rem;
	background: var(--surface);
	border: 1px solid var(--surface-border);
	border-radius: 0.8rem;
	padding: 0.65rem 0.75rem;
}

.search-label {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	font-size: 0.85rem;
	flex: 1;
	min-width: 220px;
}

.search-label input {
	width: 100%;
	box-sizing: border-box;
	padding: 0.45rem 0.55rem;
	border-radius: 0.55rem;
	border: 1px solid var(--surface-border);
	background: var(--surface-strong);
	color: var(--text-primary);
}

.toolbar-summary {
	margin: 0;
	font-size: 0.8rem;
	color: var(--text-secondary);
}
</style>
