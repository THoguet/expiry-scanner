import { createMemoryHistory, createRouter } from 'vue-router'

import ProductList from './components/ProductList.vue'
import Scanner from './components/Scanner.vue'

const routes = [
	{ path: '/', component: ProductList },
	{ path: '/scanner', component: Scanner },
]

export const router = createRouter({
	history: createMemoryHistory(),
	routes,
})