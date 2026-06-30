import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const appRoot = process.cwd();

function databasePathFromUrl(databaseUrl) {
  const value = databaseUrl || "file:./bookings_time_itinerary.db";
  if (value.startsWith("file:")) {
    return path.resolve(appRoot, value.slice(5));
  }
  return path.resolve(appRoot, value);
}

export const db = new Database(databasePathFromUrl(process.env.DATABASE_URL));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flight_itineraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pnr TEXT NOT NULL DEFAULT 'Not specified',
      baggage_checked TEXT NOT NULL DEFAULT 'Not specified',
      baggage_cabin TEXT NOT NULL DEFAULT 'Not specified',
      template TEXT NOT NULL DEFAULT 'classic',
      source_file TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flight_passengers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_itinerary_id INTEGER NOT NULL,
      full_name TEXT NOT NULL DEFAULT 'Not specified',
      ticket_number TEXT NOT NULL DEFAULT 'Not specified',
      passenger_type TEXT NOT NULL DEFAULT 'Not specified',
      FOREIGN KEY (flight_itinerary_id) REFERENCES flight_itineraries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS flight_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_itinerary_id INTEGER NOT NULL,
      airline TEXT NOT NULL DEFAULT 'Not specified',
      flight_number TEXT NOT NULL DEFAULT 'Not specified',
      cabin_class TEXT NOT NULL DEFAULT 'Not specified',
      departure_airport TEXT NOT NULL DEFAULT 'Not specified',
      departure_city TEXT NOT NULL DEFAULT 'Not specified',
      departure_date TEXT NOT NULL DEFAULT 'Not specified',
      departure_time TEXT NOT NULL DEFAULT 'Not specified',
      arrival_airport TEXT NOT NULL DEFAULT 'Not specified',
      arrival_city TEXT NOT NULL DEFAULT 'Not specified',
      arrival_date TEXT NOT NULL DEFAULT 'Not specified',
      arrival_time TEXT NOT NULL DEFAULT 'Not specified',
      duration TEXT NOT NULL DEFAULT 'Not specified',
      FOREIGN KEY (flight_itinerary_id) REFERENCES flight_itineraries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hotel_itineraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_number TEXT NOT NULL DEFAULT 'Not specified',
      hotel_name TEXT NOT NULL DEFAULT 'Not specified',
      hotel_address TEXT NOT NULL DEFAULT 'Not specified',
      hotel_phone TEXT NOT NULL DEFAULT 'Not specified',
      check_in_date TEXT NOT NULL DEFAULT 'Not specified',
      check_in_time TEXT NOT NULL DEFAULT 'Not specified',
      check_out_date TEXT NOT NULL DEFAULT 'Not specified',
      check_out_time TEXT NOT NULL DEFAULT 'Not specified',
      room_type TEXT NOT NULL DEFAULT 'Not specified',
      bedding TEXT NOT NULL DEFAULT 'Not specified',
      number_of_guests TEXT NOT NULL DEFAULT 'Not specified',
      meal_type TEXT NOT NULL DEFAULT 'Not specified',
      gps TEXT NOT NULL DEFAULT 'Not specified',
      template TEXT NOT NULL DEFAULT 'classic',
      source_file TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hotel_guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_itinerary_id INTEGER NOT NULL,
      full_name TEXT NOT NULL DEFAULT 'Not specified',
      FOREIGN KEY (hotel_itinerary_id) REFERENCES hotel_itineraries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS generated_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      flight_itinerary_id INTEGER,
      hotel_itinerary_id INTEGER,
      template TEXT NOT NULL DEFAULT 'classic',
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      html_content TEXT,
      pdf_filename TEXT,
      pdf_path TEXT,
      pdf_base64 TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flight_itinerary_id) REFERENCES flight_itineraries(id) ON DELETE SET NULL,
      FOREIGN KEY (hotel_itinerary_id) REFERENCES hotel_itineraries(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value)
    VALUES ('logo_path', 'public/assets/bookings-time-logo.png')
  `).run();

  ensureColumn("generated_files", "html_content", "TEXT");
  ensureColumn("generated_files", "pdf_filename", "TEXT");
  ensureColumn("generated_files", "pdf_path", "TEXT");
  ensureColumn("generated_files", "pdf_base64", "TEXT");
  db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('auto_delete_days', '7')
  `).run();
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function text(value, fallback = "Not specified") {
  if (value === null || value === undefined) return fallback;
  const trimmed = String(value).replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

function list(value, fallbackItem) {
  if (!Array.isArray(value) || value.length === 0) return [fallbackItem];
  return value;
}

export function normalizeFlightData(input = {}) {
  const passengers = list(input.passengers, {}).map((passenger) => ({
    fullName: text(passenger.fullName),
    ticketNumber: text(passenger.ticketNumber),
    passengerType: text(passenger.passengerType),
  }));

  const segments = list(input.segments, {}).map((segment) => ({
    airline: text(segment.airline),
    flightNumber: text(segment.flightNumber),
    class: text(segment.class),
    departureAirport: text(segment.departureAirport),
    departureCity: text(segment.departureCity),
    departureDate: text(segment.departureDate),
    departureTime: text(segment.departureTime),
    arrivalAirport: text(segment.arrivalAirport),
    arrivalCity: text(segment.arrivalCity),
    arrivalDate: text(segment.arrivalDate),
    arrivalTime: text(segment.arrivalTime),
    duration: text(segment.duration),
  }));

  return {
    type: "flight",
    pnr: text(input.pnr),
    passengers,
    segments,
    baggage: {
      checkedBaggage: text(input.baggage?.checkedBaggage),
      cabinBaggage: text(input.baggage?.cabinBaggage),
    },
  };
}

export function normalizeHotelData(input = {}) {
  const guests = list(input.guests, {}).map((guest) => ({
    fullName: text(guest.fullName),
  }));

  return {
    type: "hotel",
    referenceNumber: text(input.referenceNumber),
    hotelName: text(input.hotelName),
    hotelAddress: text(input.hotelAddress),
    hotelPhone: text(input.hotelPhone),
    checkInDate: text(input.checkInDate),
    checkInTime: text(input.checkInTime),
    checkOutDate: text(input.checkOutDate),
    checkOutTime: text(input.checkOutTime),
    roomType: text(input.roomType),
    bedding: text(input.bedding),
    guests,
    numberOfGuests: text(input.numberOfGuests),
    mealType: text(input.mealType),
    gps: text(input.gps),
  };
}

export const saveFlightItinerary = db.transaction((payload) => {
  const data = normalizeFlightData(payload.data || payload);
  const template = text(payload.template, "classic");
  const sourceFile = payload.sourceFile ? text(payload.sourceFile, "") : null;

  const result = db.prepare(`
    INSERT INTO flight_itineraries
      (pnr, baggage_checked, baggage_cabin, template, source_file)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.pnr,
    data.baggage.checkedBaggage,
    data.baggage.cabinBaggage,
    template,
    sourceFile
  );

  const passengerInsert = db.prepare(`
    INSERT INTO flight_passengers
      (flight_itinerary_id, full_name, ticket_number, passenger_type)
    VALUES (?, ?, ?, ?)
  `);
  data.passengers.forEach((passenger) => {
    passengerInsert.run(result.lastInsertRowid, passenger.fullName, passenger.ticketNumber, passenger.passengerType);
  });

  const segmentInsert = db.prepare(`
    INSERT INTO flight_segments
      (flight_itinerary_id, airline, flight_number, cabin_class, departure_airport, departure_city,
       departure_date, departure_time, arrival_airport, arrival_city, arrival_date, arrival_time, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  data.segments.forEach((segment) => {
    segmentInsert.run(
      result.lastInsertRowid,
      segment.airline,
      segment.flightNumber,
      segment.class,
      segment.departureAirport,
      segment.departureCity,
      segment.departureDate,
      segment.departureTime,
      segment.arrivalAirport,
      segment.arrivalCity,
      segment.arrivalDate,
      segment.arrivalTime,
      segment.duration
    );
  });

  return getFlightItinerary(result.lastInsertRowid);
});

export const saveHotelItinerary = db.transaction((payload) => {
  const data = normalizeHotelData(payload.data || payload);
  const template = text(payload.template, "classic");
  const sourceFile = payload.sourceFile ? text(payload.sourceFile, "") : null;

  const result = db.prepare(`
    INSERT INTO hotel_itineraries
      (reference_number, hotel_name, hotel_address, hotel_phone, check_in_date, check_in_time,
       check_out_date, check_out_time, room_type, bedding, number_of_guests, meal_type, gps,
       template, source_file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.referenceNumber,
    data.hotelName,
    data.hotelAddress,
    data.hotelPhone,
    data.checkInDate,
    data.checkInTime,
    data.checkOutDate,
    data.checkOutTime,
    data.roomType,
    data.bedding,
    data.numberOfGuests,
    data.mealType,
    data.gps,
    template,
    sourceFile
  );

  const guestInsert = db.prepare(`
    INSERT INTO hotel_guests (hotel_itinerary_id, full_name)
    VALUES (?, ?)
  `);
  data.guests.forEach((guest) => guestInsert.run(result.lastInsertRowid, guest.fullName));

  return getHotelItinerary(result.lastInsertRowid);
});

export function getFlightItinerary(id) {
  const itinerary = db.prepare("SELECT * FROM flight_itineraries WHERE id = ?").get(id);
  if (!itinerary) return null;
  const passengers = db.prepare("SELECT * FROM flight_passengers WHERE flight_itinerary_id = ? ORDER BY id").all(id);
  const segments = db.prepare("SELECT * FROM flight_segments WHERE flight_itinerary_id = ? ORDER BY id").all(id);

  return {
    id: itinerary.id,
    type: "flight",
    pnr: itinerary.pnr,
    passengers: passengers.map((passenger) => ({
      fullName: passenger.full_name,
      ticketNumber: passenger.ticket_number,
      passengerType: passenger.passenger_type,
    })),
    segments: segments.map((segment) => ({
      airline: segment.airline,
      flightNumber: segment.flight_number,
      class: segment.cabin_class,
      departureAirport: segment.departure_airport,
      departureCity: segment.departure_city,
      departureDate: segment.departure_date,
      departureTime: segment.departure_time,
      arrivalAirport: segment.arrival_airport,
      arrivalCity: segment.arrival_city,
      arrivalDate: segment.arrival_date,
      arrivalTime: segment.arrival_time,
      duration: segment.duration,
    })),
    baggage: {
      checkedBaggage: itinerary.baggage_checked,
      cabinBaggage: itinerary.baggage_cabin,
    },
    template: itinerary.template,
    sourceFile: itinerary.source_file,
    createdAt: itinerary.created_at,
  };
}

export function getHotelItinerary(id) {
  const itinerary = db.prepare("SELECT * FROM hotel_itineraries WHERE id = ?").get(id);
  if (!itinerary) return null;
  const guests = db.prepare("SELECT * FROM hotel_guests WHERE hotel_itinerary_id = ? ORDER BY id").all(id);

  return {
    id: itinerary.id,
    type: "hotel",
    referenceNumber: itinerary.reference_number,
    hotelName: itinerary.hotel_name,
    hotelAddress: itinerary.hotel_address,
    hotelPhone: itinerary.hotel_phone,
    checkInDate: itinerary.check_in_date,
    checkInTime: itinerary.check_in_time,
    checkOutDate: itinerary.check_out_date,
    checkOutTime: itinerary.check_out_time,
    roomType: itinerary.room_type,
    bedding: itinerary.bedding,
    guests: guests.map((guest) => ({ fullName: guest.full_name })),
    numberOfGuests: itinerary.number_of_guests,
    mealType: itinerary.meal_type,
    gps: itinerary.gps,
    template: itinerary.template,
    sourceFile: itinerary.source_file,
    createdAt: itinerary.created_at,
  };
}

export function insertGeneratedFile({
  type,
  flightId = null,
  hotelId = null,
  template,
  filename,
  filePath,
  htmlContent = null,
  pdfFilename = null,
  pdfPath = null,
  pdfBase64 = null,
}) {
  const result = db.prepare(`
    INSERT INTO generated_files
      (type, flight_itinerary_id, hotel_itinerary_id, template, filename, file_path,
       html_content, pdf_filename, pdf_path, pdf_base64)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type, flightId, hotelId, template, filename, filePath, htmlContent, pdfFilename, pdfPath, pdfBase64);

  return {
    id: result.lastInsertRowid,
    type,
    flightId,
    hotelId,
    template,
    filename,
    filePath,
    htmlContent,
    pdfFilename,
    pdfPath,
    pdfBase64,
  };
}

export function searchGeneratedFiles(query = "") {
  const q = `%${query.trim().toLowerCase()}%`;
  return db.prepare(`
    SELECT
      gf.id,
      gf.type,
      gf.template,
      gf.filename,
      gf.file_path AS filePath,
      gf.pdf_filename AS pdfFilename,
      gf.pdf_path AS pdfPath,
      gf.created_at AS createdAt,
      f.pnr,
      h.reference_number AS referenceNumber,
      h.hotel_name AS hotelName,
      COALESCE(fp.names, '') AS passengerNames,
      COALESCE(hg.names, '') AS guestNames
    FROM generated_files gf
    LEFT JOIN flight_itineraries f ON f.id = gf.flight_itinerary_id
    LEFT JOIN hotel_itineraries h ON h.id = gf.hotel_itinerary_id
    LEFT JOIN (
      SELECT flight_itinerary_id, GROUP_CONCAT(full_name, ', ') AS names
      FROM flight_passengers
      GROUP BY flight_itinerary_id
    ) fp ON fp.flight_itinerary_id = f.id
    LEFT JOIN (
      SELECT hotel_itinerary_id, GROUP_CONCAT(full_name, ', ') AS names
      FROM hotel_guests
      GROUP BY hotel_itinerary_id
    ) hg ON hg.hotel_itinerary_id = h.id
    WHERE
      ? = '%%'
      OR LOWER(gf.filename) LIKE ?
      OR LOWER(COALESCE(f.pnr, '')) LIKE ?
      OR LOWER(COALESCE(h.reference_number, '')) LIKE ?
      OR LOWER(COALESCE(h.hotel_name, '')) LIKE ?
      OR LOWER(COALESCE(fp.names, '')) LIKE ?
      OR LOWER(COALESCE(hg.names, '')) LIKE ?
      OR LOWER(gf.created_at) LIKE ?
    ORDER BY gf.created_at DESC, gf.id DESC
    LIMIT 100
  `).all(q, q, q, q, q, q, q, q);
}

export function getGeneratedFileByFilename(filename, kind = "html") {
  const column = kind === "pdf" ? "pdf_filename" : "filename";
  return db.prepare(`
    SELECT
      id,
      type,
      template,
      filename,
      file_path AS filePath,
      html_content AS htmlContent,
      pdf_filename AS pdfFilename,
      pdf_path AS pdfPath,
      pdf_base64 AS pdfBase64,
      created_at AS createdAt
    FROM generated_files
    WHERE ${column} = ?
  `).get(filename);
}

export function updateGeneratedPdf(id, { pdfFilename, pdfPath, pdfBase64 }) {
  db.prepare(`
    UPDATE generated_files
    SET pdf_filename = ?, pdf_path = ?, pdf_base64 = ?
    WHERE id = ?
  `).run(pdfFilename, pdfPath, pdfBase64, id);

  return db.prepare(`
    SELECT
      id,
      type,
      template,
      filename,
      file_path AS filePath,
      html_content AS htmlContent,
      pdf_filename AS pdfFilename,
      pdf_path AS pdfPath,
      pdf_base64 AS pdfBase64,
      created_at AS createdAt
    FROM generated_files
    WHERE id = ?
  `).get(id);
}

export function deleteGeneratedFile(id) {
  const record = db.prepare("SELECT * FROM generated_files WHERE id = ?").get(id);
  if (!record) return null;
  db.prepare("DELETE FROM generated_files WHERE id = ?").run(id);
  unlinkIfExists(record.file_path);
  unlinkIfExists(record.pdf_path);
  return record;
}

export function getSetting(key, fallback = null) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  return row?.value ?? fallback;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
  return { key, value: String(value) };
}

export function cleanupOldRecords(days = 7) {
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 7;
  const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const files = [];

  db.prepare(`
    SELECT file_path AS filePath, pdf_path AS pdfPath
    FROM generated_files
    WHERE datetime(created_at) < datetime(?)
  `).all(cutoff).forEach((row) => {
    files.push(row.filePath, row.pdfPath);
  });

  db.prepare(`
    SELECT source_file AS sourceFile
    FROM flight_itineraries
    WHERE datetime(created_at) < datetime(?)
  `).all(cutoff).forEach((row) => files.push(row.sourceFile));

  db.prepare(`
    SELECT source_file AS sourceFile
    FROM hotel_itineraries
    WHERE datetime(created_at) < datetime(?)
  `).all(cutoff).forEach((row) => files.push(row.sourceFile));

  const generated = db.prepare(`
    DELETE FROM generated_files
    WHERE datetime(created_at) < datetime(?)
  `).run(cutoff).changes;
  const flights = db.prepare(`
    DELETE FROM flight_itineraries
    WHERE datetime(created_at) < datetime(?)
  `).run(cutoff).changes;
  const hotels = db.prepare(`
    DELETE FROM hotel_itineraries
    WHERE datetime(created_at) < datetime(?)
  `).run(cutoff).changes;

  files.forEach(unlinkIfExists);
  setSetting("cleanup_last_run", new Date().toISOString());

  return {
    cutoff,
    deleted: {
      generatedFiles: generated,
      flightItineraries: flights,
      hotelItineraries: hotels,
    },
  };
}

function unlinkIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Cleanup is best-effort; database records are already removed.
  }
}
