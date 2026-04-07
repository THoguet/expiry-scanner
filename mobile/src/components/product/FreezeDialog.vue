<template>
	<div class="freeze-overlay" @click.self="close">
		<div class="freeze-dialog">
			<h3>❄️ Freeze "{{ productName }}"</h3>

			<div class="form-group">
				<label for="totalPortions">Split into portions</label>
				<input id="totalPortions" type="number" v-model.number="totalPortions" min="1" max="20" />
			</div>

			<div class="form-group" v-if="totalPortions > 1">
				<label for="keepInFridge">Keep in fridge</label>
				<input id="keepInFridge" type="number" v-model.number="keepInFridge" min="0"
					:max="totalPortions - 1" />
			</div>

			<div class="freeze-summary">
				<p>🧊 <strong>{{ portionsToFreeze }}</strong> portion{{ portionsToFreeze > 1 ? 's' : '' }} → Freezer</p>
				<p v-if="keepInFridge > 0">🧊 <strong>{{ keepInFridge }}</strong> portion{{ keepInFridge > 1 ? 's' : ''
					}} stays in Fridge</p>
				<p v-else>📦 Original removed from Fridge</p>
			</div>

			<div class="form-actions">
				<button type="button" class="freeze-btn" @click="confirm" :disabled="isFreezing">
					{{ isFreezing ? 'Freezing...' : '❄️ Freeze' }}
				</button>
				<button type="button" class="cancel-btn" @click="close" :disabled="isFreezing">
					Cancel
				</button>
			</div>

			<span v-if="errorMessage" class="field-error error-full">{{ errorMessage }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
	productId: bigint;
	productName: string;
}>();

const emit = defineEmits<{
	close: [];
	freeze: [productId: bigint, totalPortions: number, keepInFridge: number];
}>();

const totalPortions = ref(1);
const keepInFridge = ref(0);
const isFreezing = ref(false);
const errorMessage = ref('');

const portionsToFreeze = computed(() => totalPortions.value - keepInFridge.value);

function close() {
	emit('close');
}

async function confirm() {
	if (totalPortions.value < 1) {
		errorMessage.value = 'Must have at least 1 portion';
		return;
	}
	if (keepInFridge.value >= totalPortions.value) {
		errorMessage.value = 'Must freeze at least 1 portion';
		return;
	}

	isFreezing.value = true;
	errorMessage.value = '';

	try {
		emit('freeze', props.productId, totalPortions.value, keepInFridge.value);
	} catch (e) {
		errorMessage.value = 'Failed to freeze product';
	} finally {
		isFreezing.value = false;
	}
}
</script>

<style scoped>
.freeze-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1001;
}

.freeze-dialog {
	background: var(--surface);
	border-radius: 12px;
	padding: 1.5rem;
	width: 90%;
	max-width: 380px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	border: 1px solid var(--surface-border);
}

.freeze-dialog h3 {
	margin: 0 0 1rem 0;
	font-size: 1.1rem;
	color: var(--text-primary);
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
	margin-bottom: 0.75rem;
}

.form-group label {
	font-weight: 600;
	font-size: 0.9rem;
	color: var(--text-secondary);
}

.form-group input {
	width: 100%;
	padding: 0.5rem;
	border: 1px solid var(--surface-border);
	border-radius: 6px;
	background: var(--surface-strong);
	color: var(--text-primary);
	font-size: 0.95rem;
	box-sizing: border-box;
}

.form-group input:focus {
	outline: none;
	border-color: #60a5fa;
	box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
}

.freeze-summary {
	background: var(--surface-strong);
	border-radius: 8px;
	padding: 0.75rem;
	margin-bottom: 1rem;
}

.freeze-summary p {
	margin: 0.25rem 0;
	font-size: 0.9rem;
	color: var(--text-primary);
}

.form-actions {
	display: flex;
	gap: 0.5rem;
}

.freeze-btn {
	flex: 1;
	padding: 0.6rem;
	border: none;
	border-radius: 8px;
	background: #3b82f6;
	color: white;
	font-weight: 600;
	font-size: 0.95rem;
	cursor: pointer;
	transition: background 0.2s;
}

.freeze-btn:hover:not(:disabled) {
	background: #2563eb;
}

.freeze-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.cancel-btn {
	flex: 1;
	padding: 0.6rem;
	border: 1px solid var(--surface-border);
	border-radius: 8px;
	background: var(--surface);
	color: var(--text-primary);
	font-weight: 600;
	font-size: 0.95rem;
	cursor: pointer;
	transition: background 0.2s;
}

.cancel-btn:hover:not(:disabled) {
	background: var(--surface-strong);
}

.field-error {
	font-size: 0.8rem;
	color: var(--error-strong);
	display: block;
	margin-top: 0.5rem;
}

.error-full {
	padding: 0.75rem;
	background: var(--error-soft);
	border-radius: 6px;
}
</style>
