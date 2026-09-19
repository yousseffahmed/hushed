import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = process.cwd();
const bundle = await build({
  entryPoints: ["tests/wedding-sheet/fixture.tsx"], bundle: true, write: false, outdir: "/tmp/wedding-sheet-test",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
  alias: { "@/lib/weddingTimelineService": resolve(root, "tests/wedding-sheet/service.ts"),
    "next/image": resolve(root, "tests/wedding-sheet/image.tsx") }
});
const globalCss = await postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), { from: resolve(root, "src/app/globals.css") });
const outputs = new Map(bundle.outputFiles.map((file) => [file.path.endsWith(".css") ? "/fixture.css" : "/fixture.js", file.contents]));
const server = createServer(async (req, res) => {
  const url = req.url?.split("?")[0];
  if (url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${globalCss.css}</style><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  } else if (outputs.has(url)) {
    res.setHeader("Content-Type", url.endsWith(".css") ? "text/css" : "text/javascript"); res.end(outputs.get(url));
  } else if (["/images/wedding-ribbon.png", "/apple-touch-icon.png"].includes(url)) {
    res.setHeader("Content-Type", "image/png"); res.end(await readFile(resolve(root, `public${url}`)));
  } else { res.statusCode = 404; res.end(); }
});
server.listen(3107, "127.0.0.1", () => console.log("Wedding layout fixture: http://127.0.0.1:3107"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
