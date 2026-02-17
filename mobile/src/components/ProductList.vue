<template>
	<div>
		list
	</div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import { ref } from 'vue';


let products = invoke('get_products');



</script>

<style scoped></style>