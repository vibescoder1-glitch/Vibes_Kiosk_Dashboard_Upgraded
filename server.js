import { createServer } from "node:http";
import next from "next";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.APP_HOST ?? "0.0.0.0";
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

createServer((request, response) => {
  handle(request, response);
}).listen(port, hostname, () => {
  console.log(`Factory Kiosk Operations is running on port ${port}`);
});
