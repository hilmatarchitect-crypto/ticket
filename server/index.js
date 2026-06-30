import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import {
  cleanupOldRecords,
  deleteGeneratedFile,
  getFlightItinerary,
  getGeneratedFileByFilename,
  getHotelItinerary,
  getSetting,
  initDatabase,
  insertGeneratedFile,
  saveFlightItinerary,
  saveHotelItinerary,
  searchGeneratedFiles,
  updateGeneratedPdf,
} from "./db.js";
import { attachUser, registerAuthRoutes, requireAdmin, requireAuth } from "./auth.js";
import { extractWithGemini } from "./gemini.js";
import { generatePdfFromHtml } from "./pdf.js";
import { filenameFor, generateItineraryHtml } from "./templates.js";

const appRoot = process.cwd();
const uploadDir = path.join(appRoot, "uploads/originals");
const htmlDir = path.join(appRoot, "outputs/html");
const pdfDir = path.join(appRoot, "outputs/pdf");
const publicDir = path.join(appRoot, "public");
const distDir = path.join(appRoot, "dist");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(htmlDir, { recursive: true });
fs.mkdirSync(pdfDir, { recursive: true });
fs.mkdirSync(path.join(publicDir, "assets"), { recursive: true });
await initDatabase();

if (process.argv.includes("--init-only")) {
  console.log("Bookings Time database initialized.");
  process.exit(0);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeBase = path
      .basename(file.originalname || "document", ext)
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "document";
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (allowedMimeTypes.has(file.mimetype) && allowedExtensions.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error("Please upload a PDF, JPG, JPEG, PNG, or WebP file."));
  },
});

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(attachUser);
app.use("/assets", express.static(path.join(publicDir, "assets")));

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function uploadSingle(req, res) {
  return new Promise((resolve, reject) => {
    upload.single("document")(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function encodedGeneratedUrl(filename) {
  return `/generated/${encodeURIComponent(filename)}`;
}

function encodedPdfUrl(filename) {
  return `/generated-pdf/${encodeURIComponent(filename)}`;
}

function uniqueHtmlPath(filename) {
  const parsed = path.parse(filename);
  let candidate = filename;
  let counter = 2;
  while (fs.existsSync(path.join(htmlDir, candidate))) {
    candidate = `${parsed.name}_${counter}${parsed.ext}`;
    counter += 1;
  }
  return {
    filename: candidate,
    filePath: path.join(htmlDir, candidate),
  };
}

function uniquePdfPath(htmlFilename) {
  const pdfName = `${path.parse(htmlFilename).name}.pdf`;
  const parsed = path.parse(pdfName);
  let candidate = pdfName;
  let counter = 2;
  while (fs.existsSync(path.join(pdfDir, candidate))) {
    candidate = `${parsed.name}_${counter}${parsed.ext}`;
    counter += 1;
  }
  return {
    pdfFilename: candidate,
    pdfPath: path.join(pdfDir, candidate),
  };
}

async function writeGenerated({ type, flight, hotel, template }) {
  const requestedFilename = filenameFor(type, { flight, hotel });
  const { filename, filePath } = uniqueHtmlPath(requestedFilename);
  const { pdfFilename, pdfPath } = uniquePdfPath(filename);
  const html = generateItineraryHtml({ type, flight, hotel, template });
  fs.writeFileSync(filePath, html, "utf8");
  console.log(`Generated HTML itinerary: ${filename}`);

  const record = await insertGeneratedFile({
    type,
    flightId: flight?.id || null,
    hotelId: hotel?.id || null,
    template,
    filename,
    filePath,
    htmlContent: html,
  });

  generatePdfInBackground({ id: record.id, filePath, pdfFilename, pdfPath });

  return {
    id: record.id,
    type: record.type,
    flightId: record.flightId,
    hotelId: record.hotelId,
    template: record.template,
    filename,
    pdfFilename: "",
    url: encodedGeneratedUrl(filename),
    pdfUrl: "",
    pdfPending: true,
  };
}

function generatePdfInBackground({ id, filePath, pdfFilename, pdfPath }) {
  setTimeout(async () => {
    try {
      await generatePdfFromHtml({ htmlPath: filePath, pdfPath });
      const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
      await updateGeneratedPdf(id, { pdfFilename, pdfPath, pdfBase64 });
      console.log(`Generated PDF itinerary: ${pdfFilename}`);
    } catch (error) {
      console.error(`PDF background generation failed for file ${id}: ${error.message}`);
    }
  }, 0);
}

async function cleanOldRecordsIfDue() {
  const days = Number(await getSetting("auto_delete_days", process.env.AUTO_DELETE_DAYS || "7")) || 7;
  const lastRun = await getSetting("cleanup_last_run", "");
  const shouldRun = !lastRun || Date.now() - new Date(lastRun).getTime() > 24 * 60 * 60 * 1000;
  if (!shouldRun) return null;
  return cleanupOldRecords(days);
}

await cleanOldRecordsIfDue();
setInterval(() => {
  cleanOldRecordsIfDue().catch((error) => {
    console.error(`Automatic cleanup failed: ${error.message}`);
  });
}, 24 * 60 * 60 * 1000);

registerAuthRoutes(app, {
  onAdminLogin: cleanOldRecordsIfDue,
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "Bookings Time Itinerary Builder" });
});

app.get("/generated/:filename", requireAuth, asyncHandler(async (req, res) => {
  const record = await getGeneratedFileByFilename(req.params.filename, "html");
  if (!record) return res.status(404).send("Generated itinerary not found.");
  if (record.filePath && fs.existsSync(record.filePath)) {
    res.type("html").sendFile(record.filePath);
    return;
  }
  if (record.htmlContent) {
    res.type("html").send(record.htmlContent);
    return;
  }
  res.status(404).send("Generated itinerary file is no longer available.");
}));

app.get("/generated-pdf/:filename", requireAuth, asyncHandler(async (req, res) => {
  const record = await getGeneratedFileByFilename(req.params.filename, "pdf");
  if (!record) return res.status(404).send("Generated PDF not found.");
  if (record.pdfPath && fs.existsSync(record.pdfPath)) {
    res.type("application/pdf").sendFile(record.pdfPath);
    return;
  }
  if (record.pdfBase64) {
    res.type("application/pdf").send(Buffer.from(record.pdfBase64, "base64"));
    return;
  }
  res.status(404).send("Generated PDF file is no longer available.");
}));

app.post("/api/extract/:type", requireAuth, asyncHandler(async (req, res) => {
  await uploadSingle(req, res);
  const type = req.params.type;
  if (!["flight", "hotel"].includes(type)) {
    return res.status(400).json({ error: "Unsupported itinerary type." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Please choose a document to upload." });
  }

  const result = await extractWithGemini({
    type,
    filePath: req.file.path,
    mimeType: req.file.mimetype,
  });

  res.json({
    ...result,
    upload: {
      originalName: req.file.originalname,
      storedName: req.file.filename,
      path: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });
}));

app.post("/api/flight-itineraries", requireAuth, asyncHandler(async (req, res) => {
  const saved = await saveFlightItinerary({
    data: req.body.data,
    template: req.body.template,
    sourceFile: req.body.sourceFile,
  });
  res.json({ itinerary: saved });
}));

app.post("/api/hotel-itineraries", requireAuth, asyncHandler(async (req, res) => {
  const saved = await saveHotelItinerary({
    data: req.body.data,
    template: req.body.template,
    sourceFile: req.body.sourceFile,
  });
  res.json({ itinerary: saved });
}));

app.post("/api/combined-itineraries", requireAuth, asyncHandler(async (req, res) => {
  const flight = await saveFlightItinerary({
    data: req.body.flight,
    template: req.body.template,
    sourceFile: req.body.flightSourceFile,
  });
  const hotel = await saveHotelItinerary({
    data: req.body.hotel,
    template: req.body.template,
    sourceFile: req.body.hotelSourceFile,
  });
  res.json({ flight, hotel });
}));

app.post("/api/generate/flight", requireAuth, asyncHandler(async (req, res) => {
  const template = req.body.template || "classic";
  const flight = await getFlightItinerary(req.body.id);
  if (!flight) return res.status(404).json({ error: "Flight itinerary not found." });
  res.json({ file: await writeGenerated({ type: "flight", flight, template }) });
}));

app.post("/api/generate/hotel", requireAuth, asyncHandler(async (req, res) => {
  const template = req.body.template || "classic";
  const hotel = await getHotelItinerary(req.body.id);
  if (!hotel) return res.status(404).json({ error: "Hotel itinerary not found." });
  res.json({ file: await writeGenerated({ type: "hotel", hotel, template }) });
}));

app.post("/api/generate/combined", requireAuth, asyncHandler(async (req, res) => {
  const template = req.body.template || "classic";
  const flight = await getFlightItinerary(req.body.flightId);
  const hotel = await getHotelItinerary(req.body.hotelId);
  if (!flight || !hotel) return res.status(404).json({ error: "Combined itinerary records not found." });
  res.json({ file: await writeGenerated({ type: "combined", flight, hotel, template }) });
}));

app.get("/api/records", requireAuth, asyncHandler(async (req, res) => {
  res.json({ records: await searchGeneratedFiles(String(req.query.q || "")) });
}));

app.delete("/api/records/:id", requireAdmin, asyncHandler(async (req, res) => {
  const deleted = await deleteGeneratedFile(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Generated itinerary not found." });
  res.json({ ok: true });
}));

app.get("/api/admin/settings", requireAdmin, asyncHandler(async (_req, res) => {
  res.json({
    autoDeleteDays: Number(await getSetting("auto_delete_days", "7")),
    autoDeleteEnabled: true,
    cleanupLastRun: await getSetting("cleanup_last_run", ""),
  });
}));

app.post("/api/admin/cleanup", requireAdmin, asyncHandler(async (_req, res) => {
  const days = Number(await getSetting("auto_delete_days", "7")) || 7;
  res.json(await cleanupOldRecords(days));
}));

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/generated")) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.send(`
      <h1>Bookings Time Itinerary Builder</h1>
      <p>The local server is running. Start the React interface with <code>pnpm dev</code>, or run <code>pnpm build</code> then <code>pnpm start</code>.</p>
    `);
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  const message = error?.message || "Something went wrong. Please try again.";
  res.status(400).json({ error: message });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Bookings Time local app is running at http://localhost:${PORT}`);
});

server.on("error", (error) => {
  console.error(`Could not start the local app server: ${error.message}`);
  process.exit(1);
});
