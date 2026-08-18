import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = 4179;
const route = "/__forum-beta-activation-check";
const mobileRoute = "/__forum-beta-activation-mobile";
const server = await createServer({
  root,
  appType: "custom",
  server: { host: "127.0.0.1", port, strictPort: true },
});

server.middlewares.use(async (request, response, next) => {
  const pathname = request.url?.split("?")[0];
  if (pathname === mobileRoute) {
    const search = request.url?.includes("?") ? request.url.slice(request.url.indexOf("?")) : "";
    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#777}iframe{display:block;width:360px;height:800px;border:0;background:white}</style></head><body><iframe title="360 pixel forum beta preview" src="${route}${search}"></iframe></body></html>`);
    return;
  }
  if (pathname !== route) return next();
  const html = await server.transformIndexHtml(request.url, `<!doctype html>
    <html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body><div id="root"></div><script type="module" src="/src/forum/ForumBetaActivationBrowserFixture.jsx"></script></body></html>`);
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(html);
});

await server.listen();
console.log(`Forum beta activation preview: http://127.0.0.1:${port}${route}`);
await new Promise(() => {});
