import { mount } from "svelte";
import App from "./App.svelte";
import { initTelegram } from "$lib/telegram";
import "./styles/global.css";

initTelegram();

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
