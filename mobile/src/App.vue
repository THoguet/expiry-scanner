<template>
	<main class="container">
		<RouterView />
		<Footer />
	</main>
</template>

<script setup lang="ts">
import Footer from "./components/Footer.vue";

</script>

<style scoped>
.container {
	display: flex;
	height: 100vh;
	width: 100vw;
	flex-direction: column;
	justify-content: space-between;
	background: var(--bg-page);
	color: var(--text-primary);
}
</style>
<style>
:root {
	color-scheme: light;
	--bg-page: #f8fafc;
	--text-primary: #0f172a;
	--text-secondary: #334155;
	--surface: #ffffff;
	--surface-strong: #f1f5f9;
	--surface-border: #d4d4d8;
	--surface-overlay: rgba(255, 255, 255, 0.86);
	--brand: #22c55e;
	--brand-strong: #166534;
	--brand-soft: #a7f3d0;
	--error-soft: #fecaca;
	--error-strong: #991b1b;
	--focus-ring: rgba(34, 197, 94, 0.2);
}

@media (prefers-color-scheme: dark) {
	:root {
		color-scheme: dark;
		--bg-page: #020617;
		--text-primary: #e2e8f0;
		--text-secondary: #94a3b8;
		--surface: #111827;
		--surface-strong: #1f2937;
		--surface-border: #334155;
		--surface-overlay: rgba(15, 23, 42, 0.86);
		--brand: #34d399;
		--brand-strong: #a7f3d0;
		--brand-soft: #064e3b;
		--error-soft: #7f1d1d;
		--error-strong: #fecaca;
		--focus-ring: rgba(52, 211, 153, 0.22);
	}
}

body {
	margin: 0;
	background-color: var(--bg-page);
	color: var(--text-primary);
}

.app-container {
	padding-top: calc(env(safe-area-inset-top) + 1rem);
}
</style>
