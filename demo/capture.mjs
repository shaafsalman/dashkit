// Capture one dashkit chart to PNG.
//   node capture.mjs <spec.json> <out.png>
// Uses puppeteer-core with the system Chrome — plain `chrome --screenshot` hangs
// on this page because React + ECharts never leave it idle, so the virtual-time
// budget never settles. Puppeteer lets us wait for a real signal instead.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DIST = path.resolve("dist-render");
const [, , specPath, outPath] = process.argv;
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

const types = { ".html": "text/html", ".js": "text/javascript",
                ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(req.url.split("#")[0].split("?")[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--force-device-scale-factor=2"],
});
const page = await browser.newPage();
await page.setViewport({
  width: (spec.width || 900) + 2 * (spec.pad ?? 24),
  height: spec.height || 520,
  deviceScaleFactor: 2,          // retina, so Medium's 700px column stays sharp
});
const payload = Buffer.from(JSON.stringify(spec)).toString("base64");
await page.goto(`http://127.0.0.1:${port}/render.html#${payload}`, { waitUntil: "load" });
// render.jsx flips the title once the component has mounted and settled
await page.waitForFunction(() => document.title === "READY", { timeout: 20000 })
  .catch(() => console.error("  (no READY signal; capturing anyway)"));
await new Promise(r => setTimeout(r, 600));

const el = await page.$("#root");
await el.screenshot({ path: path.resolve(outPath) });
await browser.close();
server.close();
console.log("wrote " + outPath);
