import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative, extname, isAbsolute } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 8080);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(root, `.${path === "/" ? "/index.html" : path}`);
    const local = relative(root, file);
    if (local.startsWith("..") || isAbsolute(local) || local.split(/[\\/]/).some(p => p.startsWith("."))) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": `${types[extname(file)] || "text/plain"}; charset=utf-8`, "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Tree Life: http://127.0.0.1:${port}`));
