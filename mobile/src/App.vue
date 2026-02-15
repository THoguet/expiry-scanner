<template>
	<main class="container">
		<Header />
		<RouterView />
		<Footer />
	</main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner";
import Footer from "./components/Footer.vue";
import Header from "./components/Header.vue";

const greetMsg = ref("");
const name = ref("");

let permissions: PermissionState | undefined = undefined;

async function askPermission() {
	if (permissions === undefined)
		permissions = await requestPermissions()
}

async function startScanner() {
	await askPermission();
	scan({ windowed: true })
}

async function greet() {
	// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
	greetMsg.value = await invoke("greet", { name: name.value });
}
</script>

<style scoped>
.container {
	display: flex;
	height: 100vh;
	width: 100vw;
	flex-direction: column;
	justify-content: space-between;
}
</style>
<style>
body {
	margin: 0;
}
</style>
