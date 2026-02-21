import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./routes";
import { getClientId } from "./services/ClientId";

export const CLIENT_ID = getClientId();

createApp(App).use(router).mount("#app");
