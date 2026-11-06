// Render each named component standalone (default props, size="fill") at
// several widths via render.html on the running dev server.
//   node shoot-components.mjs <baseUrl> <outDir> <tag> Comp1,Comp2 [widths] [dark]
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const [, , base, out, tag, names, widths = "360,720,1200", dark] = process.argv;
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"], userDataDir: process.env.PPT_PROFILE,
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
for (const name of names.split(",")) {
  for (const w of widths.split(",").map(Number)) {
    const h = w < 500 ? 360 : w < 900 ? 380 : 420;
    const cfg = { component: name, width: w, pad: 12, boxHeight: h, bg: dark ? "#141414" : "#f4f5f7",
      props: { size: "fill", theme: dark ? "dark" : "light" } };
    await page.setViewport({ width: w + 24, height: h + 24, deviceScaleFactor: 2 });
    const hash = Buffer.from(JSON.stringify(cfg)).toString("base64");
    await page.goto(`${base}/render.html?n=${name}-${w}#${hash}`, { waitUntil: "networkidle0" });
    if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
    await new Promise((r) => setTimeout(r, 1400));
    await (await page.$("#root")).screenshot({ path: `${out}/${name}-${w}-${tag}.png` });
  }
}
await browser.close();
console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "done, no page errors");
