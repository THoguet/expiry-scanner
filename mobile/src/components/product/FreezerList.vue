<template>
	<div class="freezer app-container">
		<div v-if="loading" class="status-text">Loading frozen products...</div>
		<div v-else-if="error" class="status-text">{{ error }}</div>
		<div v-else class="inner-freezer">
			<div v-for="item in frozenProducts" :key="item.id.toString()" class="frozen-box"
				:style="item.image ? `background-image: url('${item.image}')` : ''">
				<div class="frozen-text-background">
					<p class="frozen-name">{{ item.name }}</p>
					<div class="frozen-date-row">
						<span class="frozen-icon">❄️</span>
						<p class="frozen-date">Frozen {{ formatDate(item.frozen_date) }}</p>
					</div>
					<button class="unfreeze-btn" @click="onUnfreeze(item.id)"
						:disabled="unfreezing === item.id.toString()">
						{{ unfreezing === item.id.toString() ? 'Unfreezing...' : '🔥 Unfreeze' }}
					</button>
				</div>
			</div>
			<div v-if="frozenProducts.length === 0" class="status-text">
				<p>Your freezer is empty! Freeze products from the fridge tab.</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useFreezer } from '../../services/freezer';

const { frozenProducts, loading, error, loadFrozenProducts, unfreeze } = useFreezer();
const unfreezing = ref<string | null>(null);

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString("fr-FR", {
		year: undefined,
		month: "numeric",
		day: "numeric",
	});
}

async function onUnfreeze(frozenProductId: bigint) {
	unfreezing.value = frozenProductId.toString();
	try {
		await unfreeze(frozenProductId);
	} catch (e) {
		// Error handled in service
	} finally {
		unfreezing.value = null;
	}
}

onMounted(loadFrozenProducts);
</script>

<style scoped>
.freezer {
	padding-top: 1rem;
	background: linear-gradient(180deg, #1e3a5f 0%, #0f1b2d 50%, #1a1a2e 100%);
	color: #e0e7ff;
	position: relative;
	padding-bottom: 7.5vh;
	height: calc(100% - 7.5vh - 1rem);
	overflow: hidden;
}

.freezer::before {
	content: "";
	position: absolute;
	inset: 0;
	background:
		radial-gradient(circle at 20% 30%, rgba(147, 197, 253, 0.08) 0%, transparent 50%),
		radial-gradient(circle at 80% 70%, rgba(96, 165, 250, 0.06) 0%, transparent 50%);
	pointer-events: none;
}

.status-text,
.inner-freezer {
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
	color: #cbd5e1;
}

.inner-freezer {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	padding-bottom: 1rem;
}

.frozen-box {
	border: 1px solid rgba(147, 197, 253, 0.3);
	padding: 1rem;
	border-radius: 0.5rem;
	background-color: rgba(30, 58, 95, 0.85);
	min-width: 50px;
	min-height: 50px;
	max-width: calc(40vw - 2rem);
	max-height: calc(40vw - 2rem);
	position: relative;
	user-select: none;
	background-size: contain;
	background-position: center;
	backdrop-filter: blur(4px);
}

.frozen-text-background {
	background: rgba(15, 23, 42, 0.82);
	padding: 0.5rem;
	border-radius: 0.5rem;
}

.frozen-name {
	margin: 0;
	font-size: smaller;
	color: #e0e7ff;
	font-weight: 500;
}

.frozen-date-row {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	margin-top: 0.25rem;
}

.frozen-icon {
	font-size: 0.75rem;
}

.frozen-date {
	margin: 0;
	font-size: 0.75rem;
	color: #93c5fd;
}

.unfreeze-btn {
	margin-top: 0.5rem;
	width: 100%;
	padding: 0.35rem 0.5rem;
	border: 1px solid rgba(251, 146, 60, 0.5);
	border-radius: 6px;
	background: rgba(251, 146, 60, 0.15);
	color: #fdba74;
	font-size: 0.75rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s, border-color 0.2s;
}

.unfreeze-btn:hover:not(:disabled) {
	background: rgba(251, 146, 60, 0.3);
	border-color: rgba(251, 146, 60, 0.7);
}

.unfreeze-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
</style>
