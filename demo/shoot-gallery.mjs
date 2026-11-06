// Screenshot every gallery card (Charts + Dashboard Cards pages) of the
// running dev server, one PNG per card.  node shoot-gallery.mjs <url> <outDir> [tag] [width]
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const [, , url, out, tag = "x", width = "1440"] = process.argv;
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"], userDataDir: process.env.PPT_PROFILE,
});
const page = await browser.newPage();
await page.setViewport({ width: +width, height: 4000, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle0" });
for (const nav of ["Charts", "Dashboard Cards"]) {
  await page.evaluate((label) => {
    [...document.querySelectorAll("nav button")].find((b) => b.textContent.trim() === label).click();
  }, nav);
  await new Promise((r) => setTimeout(r, 2500));
  const cells = await page.$$("main .grid > div");
  for (const cell of cells) {
    const name = await cell.evaluate((n) => n.querySelector("span").textContent.trim());
    
    await new Promise((r) => setTimeout(r, 50));
    await cell.screenshot({ path: `${out}/${name}-${tag}.png` });
  }
}
await browser.close();
console.log("done");
