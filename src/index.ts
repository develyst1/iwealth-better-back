import { app } from "./app";

const port = Number(process.env.PORT ?? 3010);

console.log(`iwealth-better-back listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
