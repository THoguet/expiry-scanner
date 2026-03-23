<template>
	<header class="stock-header">
		<div class="stock-title-wrap">
			<h2>
				<FontAwesomeIcon :icon="faBoxesStacked" />
				<span>Stock</span>
			</h2>
			<p>Track shortages and restock quickly</p>
		</div>
		<div class="header-actions">
			<button type="button" class="share-btn" :disabled="shareLoading" @click="emit('share')">
				{{ shareLoading ? 'Sharing...' : 'Share grocery list' }}
			</button>
		</div>
	</header>
</template>

<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faBoxesStacked } from "@fortawesome/free-solid-svg-icons";

defineProps<{
	shareLoading: boolean;
}>();

const emit = defineEmits<{
	share: [];
}>();
</script>

<style scoped>
.stock-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 0.75rem;
}

.stock-title-wrap h2 {
	margin: 0;
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 1.25rem;
}

.stock-title-wrap p {
	margin: 0.25rem 0 0;
	font-size: 0.82rem;
	color: var(--text-secondary);
}

.header-actions {
	display: flex;
	gap: 0.45rem;
}

.share-btn {
	background: var(--surface-strong);
	border: 1px solid var(--surface-border);
	color: var(--text-primary);
	padding: 0.5rem 0.75rem;
	border-radius: 0.6rem;
}

@media (max-width: 420px) {
	.stock-header {
		flex-direction: column;
		align-items: stretch;
	}

	.header-actions {
		justify-content: space-between;
	}
}
</style>
