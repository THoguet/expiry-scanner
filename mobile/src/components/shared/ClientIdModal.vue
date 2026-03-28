<template>
	<div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
		<div class="modal-content">
			<div class="modal-header">
				<h2>Client ID</h2>
				<button type="button" class="close-btn" @click="closeModal" title="Close">
					×
				</button>
			</div>

			<div class="modal-body">
				<!-- Current Client ID Display -->
				<div class="client-id-section">
					<label>Your Client ID</label>
					<div class="client-id-display">
						<input type="text" :value="localClientId" readonly class="client-id-input" />
						<button type="button" class="copy-btn" @click="copyToClipboard" title="Copy to clipboard">
							Copy
						</button>
					</div>
					<p class="info-text">This ID links all your devices together</p>
				</div>

				<!-- Custom Client ID Input -->
				<div class="custom-id-section">
					<label for="customInput">Set Custom ID (optional)</label>
					<input id="customInput" type="text" v-model="customInput"
						placeholder="Enter a custom ID or leave blank" class="custom-input" />

					<div class="button-group">
						<button type="button" class="btn-apply" @click="applyCustomId" :disabled="!customInput.trim()">
							Apply Custom ID
						</button>
						<button type="button" class="btn-cancel" @click="clearCustomInput">
							Clear Input
						</button>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="action-buttons">
					<button type="button" class="btn-share" @click="shareCurrentId">
						Share ID
					</button>
					<button type="button" class="btn-reset" @click="resetToNewId">
						Generate New ID
					</button>
				</div>

			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { setClientId, generateNewClientId, shareClientId } from '../../services/ClientId';
import { useToast } from '../../services/toast';
import { logger } from '../../services/logger';

const emit = defineEmits<{ close: [] }>();

const props = defineProps<{
	isOpen: boolean;
	currentClientId: string;
}>();

const localClientId = ref(props.currentClientId);
const customInput = ref('');
const toast = useToast();

watch(() => props.currentClientId, (newId) => {
	localClientId.value = newId;
});

watch(() => props.isOpen, (isOpen) => {
	if (!isOpen) {
		resetForm();
	}
});

function closeModal() {
	emit('close');
}

function resetForm() {
	customInput.value = '';
}

function clearCustomInput() {
	customInput.value = '';
}

function copyToClipboard() {
	navigator.clipboard.writeText(localClientId.value)
		.then(() => {
			toast.success('Copied!');
		})
		.catch(() => {
			toast.error('Failed to copy');
		});
}

function applyCustomId() {
	const trimmedInput = customInput.value.trim();

	if (!trimmedInput) {
		toast.error('ID cannot be empty');
		return;
	}

	if (trimmedInput.length < 5) {
		toast.error('ID must be at least 5 characters');
		return;
	}

	if (trimmedInput.length > 100) {
		toast.error('ID must be less than 100 characters');
		return;
	}

	// Check for valid characters
	if (!trimmedInput.match(/^[a-zA-Z0-9\-_]+$/)) {
		toast.error('ID can only contain letters, numbers, hyphens, and underscores');
		return;
	}

	setClientId(trimmedInput);
	localClientId.value = trimmedInput;
	toast.success('Client ID updated successfully');
	customInput.value = '';

	// Emit event to trigger page reload or state update
	window.location.reload();
}

async function shareCurrentId() {
	try {
		logger.info('Sharing client ID from modal', { clientId: localClientId.value });
		await shareClientId(localClientId.value);
		toast.success('ID shared successfully');
	} catch (error) {
		logger.error('Share client ID failed from modal', { error });
		toast.error('Failed to share ID');
	}
}

function resetToNewId() {
	if (confirm('Generate a new Client ID? Your current ID will be replaced.')) {
		const newId = generateNewClientId();
		localClientId.value = newId;
		toast.success('New Client ID generated');

		setTimeout(() => {
			window.location.reload();
		}, 1500);
	}
}

</script>

<style scoped>
.modal-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2000;
	padding: 1rem;
}

.modal-content {
	background: var(--surface);
	border-radius: 12px;
	box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	max-width: 500px;
	width: 100%;
	max-height: 90vh;
	overflow-y: auto;
	border: 1px solid var(--surface-border);
}

.modal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 1.5rem;
	border-bottom: 1px solid var(--surface-border);
}

.modal-header h2 {
	margin: 0;
	font-size: 1.3rem;
	color: var(--text-primary);
}

.close-btn {
	background: none;
	border: none;
	font-size: 1.5rem;
	color: var(--text-secondary);
	cursor: pointer;
	padding: 0;
	width: 32px;
	height: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 6px;
	transition: background-color 0.2s;
}

.close-btn:hover {
	background-color: var(--surface-strong);
}

.modal-body {
	padding: 1.5rem;
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.client-id-section {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.client-id-section label {
	font-size: 0.95rem;
	font-weight: 600;
	color: var(--text-secondary);
}

.client-id-display {
	display: flex;
	gap: 0.75rem;
	align-items: center;
}

.client-id-input {
	flex: 1;
	padding: 0.75rem;
	border: 1px solid var(--surface-border);
	background: var(--surface-strong);
	color: var(--text-primary);
	border-radius: 8px;
	font-family: 'Courier New', monospace;
	font-size: 0.85rem;
	word-break: break-all;
}

.client-id-input:focus {
	outline: none;
	border-color: var(--brand);
}

.copy-btn {
	padding: 0.75rem 1rem;
	background: var(--brand-soft);
	color: var(--brand-strong);
	border: none;
	border-radius: 8px;
	font-weight: 600;
	cursor: pointer;
	white-space: nowrap;
	transition: filter 0.2s;
}

.copy-btn:hover {
	filter: brightness(0.95);
}

.info-text {
	margin: 0;
	font-size: 0.8rem;
	color: var(--text-secondary);
}

.custom-id-section {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding: 1rem;
	background: var(--surface-strong);
	border-radius: 8px;
	border: 1px solid var(--surface-border);
}

.custom-id-section label {
	font-size: 0.95rem;
	font-weight: 600;
	color: var(--text-secondary);
}

.custom-input {
	padding: 0.75rem;
	border: 1px solid var(--surface-border);
	background: var(--surface);
	color: var(--text-primary);
	border-radius: 6px;
	font-size: 0.95rem;
}

.custom-input:focus {
	outline: none;
	border-color: var(--brand);
	box-shadow: 0 0 0 3px var(--focus-ring);
}

.button-group {
	display: flex;
	gap: 0.5rem;
}

.btn-apply,
.btn-cancel {
	flex: 1;
	padding: 0.6rem;
	border: none;
	border-radius: 6px;
	font-weight: 600;
	cursor: pointer;
	transition: filter 0.2s;
}

.btn-apply {
	background: var(--brand);
	color: white;
}

.btn-apply:hover:not(:disabled) {
	filter: brightness(0.95);
}

.btn-apply:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-cancel {
	background: var(--surface-strong);
	color: var(--text-primary);
	border: 1px solid var(--surface-border);
}

.btn-cancel:hover {
	filter: brightness(0.95);
}

.action-buttons {
	display: flex;
	gap: 0.75rem;
	flex-direction: column;
}

.btn-share,
.btn-reset {
	padding: 0.75rem;
	border: none;
	border-radius: 8px;
	font-weight: 600;
	cursor: pointer;
	transition: filter 0.2s;
	font-size: 0.95rem;
}

.btn-share {
	background: var(--brand-soft);
	color: var(--brand-strong);
}

.btn-share:hover {
	filter: brightness(0.95);
}

.btn-reset {
	background: var(--error-soft);
	color: var(--error-strong);
}

.btn-reset:hover {
	filter: brightness(0.9);
}
</style>
