import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { normalizeFlightData, normalizeHotelData } from "./db.js";

const TEXT_PDF_MIN_CHARS = 500;
const TEXT_LIMIT = 14000;
const GEMINI_TIMEOUT_MS = 45000;

const schemas = {
  flight: `{
  "type": "flight",
  "pnr": "",
  "passengers": [
    {
      "fullName": "",
      "ticketNumber": "",
      "passengerType": ""
    }
  ],
  "segments": [
    {
      "airline": "",
      "flightNumber": "",
      "class": "",
      "departureAirport": "",
      "departureCity": "",
      "departureDate": "",
      "departureTime": "",
      "arrivalAirport": "",
      "arrivalCity": "",
      "arrivalDate": "",
      "arrivalTime": "",
      "duration": ""
    }
  ],
  "baggage": {
    "checkedBaggage": "",
    "cabinBaggage": ""
  }
}`,
  hotel: `{
  "type": "hotel",
  "referenceNumber": "",
  "hotelName": "",
  "hotelAddress": "",
  "hotelPhone": "",
  "checkInDate": "",
  "checkInTime": "",
  "checkOutDate": "",
  "checkOutTime": "",
  "roomType": "",
  "bedding": "",
  "guests": [
    {
      "fullName": ""
    }
  ],
  "numberOfGuests": "",
  "mealType": "",
  "gps": ""
}`,
};

function extractionPrompt(type, documentText = "") {
  return `
You are extracting ${type === "flight" ? "flight ticket" : "hotel voucher"} data for Bookings Time.

Rules:
- Extract only information found in the uploaded document.
- Do not invent missing details.
- If a field is missing, return "Not specified".
- Do not extract or return prices, payment amounts, fare, total, commission, taxes, deposits, or any financial details.
- Do not extract English important notes into the final itinerary.
- Return valid JSON only. No markdown, no comments, no explanation.
- Keep date and time exactly as shown in the document when possible.
- Use this exact JSON shape:

${schemas[type]}

${documentText ? `Document text:\n${documentText}` : ""}
`.trim();
}

function stripJson(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return cleaned.slice(first, last + 1);
  }
  return cleaned;
}

async function extractTextFromPdf(filePath) {
  let parser;
  try {
    const buffer = await fs.readFile(filePath);
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return String(result.text || "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}

async function callGemini({ type, filePath, mimeType }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Add GEMINI_API_KEY to .env and restart the app.");
  }

  const extractedText = mimeType === "application/pdf" ? await extractTextFromPdf(filePath) : "";
  const useText = extractedText.length >= TEXT_PDF_MIN_CHARS;
  const prompt = extractionPrompt(type, useText ? extractedText.slice(0, TEXT_LIMIT) : "");
  const parts = [{ text: prompt }];

  if (!useText) {
    const fileBuffer = await fs.readFile(filePath);
    parts.push({
      inlineData: {
        mimeType,
        data: fileBuffer.toString("base64"),
      },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini extraction failed (${response.status}). ${errorText.slice(0, 240)}`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      throw new Error("Gemini did not return extractable JSON.");
    }

    return JSON.parse(stripJson(text));
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractWithGemini({ type, filePath, mimeType }) {
  const startedAt = Date.now();
  let raw;

  try {
    raw = await callGemini({ type, filePath, mimeType });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Extraction timed out. Please try again with a clearer or smaller file.");
    }
    if (error instanceof SyntaxError) {
      throw new Error("Gemini returned unreadable data. Please try again or enter the details manually.");
    }
    throw error;
  }

  const data = type === "flight" ? normalizeFlightData(raw) : normalizeHotelData(raw);
  const extractionSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
  return { data, extractionSeconds };
}
