<template>
	<TransitionGroup name="toast" tag="div" class="toast-host" aria-live="polite" aria-atomic="true">
		<p v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.kind">
			{{ toast.message }}
		</p>
	</TransitionGroup>
</template>

<script setup lang="ts">
import { useToast } from "../../services/toast";

const { toasts } = useToast();
</script>

<style scoped>
.toast-host {
	position: fixed;
	left: 0;
	right: 0;
	bottom: calc(env(safe-area-inset-bottom) + 4.5rem);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	padding: 0 0.9rem;
	pointer-events: none;
	z-index: 1200;
}

.toast {
	margin: 0;
	padding: 0.65rem 0.8rem;
	width: min(32rem, 100%);
	border-radius: 0.65rem;
	border: 1px solid var(--surface-border);
	background: var(--surface-overlay);
	color: var(--text-primary);
	font-weight: 600;
	text-align: center;
}

.toast-enter-active,
.toast-leave-active {
	transition:
		opacity 180ms ease,
		transform 180ms ease;
}

.toast-enter-from,
.toast-leave-to {
	opacity: 0;
	transform: translateY(8px) scale(0.98);
}

.toast-move {
	transition: transform 180ms ease;
}

.toast.success {
	background: var(--brand-soft);
	color: var(--brand-strong);
}

.toast.error {
	background: var(--error-soft);
	color: var(--error-strong);
}
</style>
