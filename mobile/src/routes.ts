import { createMemoryHistory, createRouter } from 'vue-router'

import ProductList from './components/ProductList.vue'
import AddProduct from './components/AddProduct.vue'

const routes = [
	{ path: '/', component: ProductList },
	{ path: '/AddProduct', component: AddProduct },
]

export const router = createRouter({
	history: createMemoryHistory(),
	routes,
})