import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

export async function generatePdfFromHtml({ htmlPath, pdfPath }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return generateWithChrome({ htmlPath, pdfPath });
  }

  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close();
  }

  return pdfPath;
}

async function generateWithChrome({ htmlPath, pdfPath }) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error("PDF engine is not installed yet. Please install the app dependencies, then try again.");
  }

  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookings-time-chrome-"));
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(chromePath, [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        `--user-data-dir=${userDataDir}`,
        "--print-to-pdf-no-header",
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ], { stdio: "ignore" });

      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("PDF generation timed out. HTML is still available."));
      }, 60000);

      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        if (code === 0 && fs.existsSync(pdfPath)) resolve();
        else reject(new Error("PDF generation failed. Please try again."));
      });
    });
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  return pdfPath;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}
