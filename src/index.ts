import { router } from "./handler";
import { updateB2Conf } from "./utils";

addEventListener("fetch", (event) => {
    event.respondWith(router.handle(event.request));
});

addEventListener("scheduled", (event) => {
    event.waitUntil(updateB2Conf());
});
