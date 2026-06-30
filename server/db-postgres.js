let pool;

async function getPool() {
  if (!pool) {
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function query(text, params = []) {
  const activePool = await getPool();
  return activePool.query(text, params);
}

export async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS flight_itineraries (
      id SERIAL PRIMARY KEY,
      pnr TEXT NOT NULL DEFAULT 'Not specified',
      baggage_checked TEXT NOT NULL DEFAULT 'Not specified',
      baggage_cabin TEXT NOT NULL DEFAULT 'Not specified',
      template TEXT NOT NULL DEFAULT 'classic',
      source_file TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS flight_passengers (
      id SERIAL PRIMARY KEY,
      flight_itinerary_id INTEGER NOT NULL REFERENCES flight_itineraries(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL DEFAULT 'Not specified',
      ticket_number TEXT NOT NULL DEFAULT 'Not specified',
      passenger_type TEXT NOT NULL DEFAULT 'Not specified'
    );

    CREATE TABLE IF NOT EXISTS flight_segments (
      id SERIAL PRIMARY KEY,
      flight_itinerary_id INTEGER NOT NULL REFERENCES flight_itineraries(id) ON DELETE CASCADE,
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
      duration TEXT NOT NULL DEFAULT 'Not specified'
    );

    CREATE TABLE IF NOT EXISTS hotel_itineraries (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS hotel_guests (
      id SERIAL PRIMARY KEY,
      hotel_itinerary_id INTEGER NOT NULL REFERENCES hotel_itineraries(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL DEFAULT 'Not specified'
    );

    CREATE TABLE IF NOT EXISTS generated_files (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      flight_itinerary_id INTEGER REFERENCES flight_itineraries(id) ON DELETE SET NULL,
      hotel_itinerary_id INTEGER REFERENCES hotel_itineraries(id) ON DELETE SET NULL,
      template TEXT NOT NULL DEFAULT 'classic',
      filename TEXT NOT NULL,
      file_path TEXT,
      html_content TEXT,
      pdf_filename TEXT,
      pdf_path TEXT,
      pdf_base64 TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await query(`
    INSERT INTO app_settings (key, value)
    VALUES ('logo_path', 'public/assets/bookings-time-logo.png')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
  await query(`
    INSERT INTO app_settings (key, value)
    VALUES ('auto_delete_days', '7')
    ON CONFLICT (key) DO NOTHING
  `);
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

function camelDate(value) {
  return value instanceof Date ? value.toISOString() : value;
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

export async function saveFlightItinerary(payload) {
  const activePool = await getPool();
  const client = await activePool.connect();
  try {
    await client.query("BEGIN");
    const data = normalizeFlightData(payload.data || payload);
    const template = text(payload.template, "classic");
    const sourceFile = payload.sourceFile ? text(payload.sourceFile, "") : null;
    const result = await client.query(`
      INSERT INTO flight_itineraries
        (pnr, baggage_checked, baggage_cabin, template, source_file)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [data.pnr, data.baggage.checkedBaggage, data.baggage.cabinBaggage, template, sourceFile]);
    const id = result.rows[0].id;

    for (const passenger of data.passengers) {
      await client.query(`
        INSERT INTO flight_passengers
          (flight_itinerary_id, full_name, ticket_number, passenger_type)
        VALUES ($1, $2, $3, $4)
      `, [id, passenger.fullName, passenger.ticketNumber, passenger.passengerType]);
    }

    for (const segment of data.segments) {
      await client.query(`
        INSERT INTO flight_segments
          (flight_itinerary_id, airline, flight_number, cabin_class, departure_airport, departure_city,
           departure_date, departure_time, arrival_airport, arrival_city, arrival_date, arrival_time, duration)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        id,
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
        segment.duration,
      ]);
    }

    await client.query("COMMIT");
    return getFlightItinerary(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveHotelItinerary(payload) {
  const activePool = await getPool();
  const client = await activePool.connect();
  try {
    await client.query("BEGIN");
    const data = normalizeHotelData(payload.data || payload);
    const template = text(payload.template, "classic");
    const sourceFile = payload.sourceFile ? text(payload.sourceFile, "") : null;
    const result = await client.query(`
      INSERT INTO hotel_itineraries
        (reference_number, hotel_name, hotel_address, hotel_phone, check_in_date, check_in_time,
         check_out_date, check_out_time, room_type, bedding, number_of_guests, meal_type, gps,
         template, source_file)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [
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
      sourceFile,
    ]);
    const id = result.rows[0].id;

    for (const guest of data.guests) {
      await client.query(`
        INSERT INTO hotel_guests (hotel_itinerary_id, full_name)
        VALUES ($1, $2)
      `, [id, guest.fullName]);
    }

    await client.query("COMMIT");
    return getHotelItinerary(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getFlightItinerary(id) {
  const itinerary = (await query("SELECT * FROM flight_itineraries WHERE id = $1", [id])).rows[0];
  if (!itinerary) return null;
  const passengers = (await query("SELECT * FROM flight_passengers WHERE flight_itinerary_id = $1 ORDER BY id", [id])).rows;
  const segments = (await query("SELECT * FROM flight_segments WHERE flight_itinerary_id = $1 ORDER BY id", [id])).rows;

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
    createdAt: camelDate(itinerary.created_at),
  };
}

export async function getHotelItinerary(id) {
  const itinerary = (await query("SELECT * FROM hotel_itineraries WHERE id = $1", [id])).rows[0];
  if (!itinerary) return null;
  const guests = (await query("SELECT * FROM hotel_guests WHERE hotel_itinerary_id = $1 ORDER BY id", [id])).rows;

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
    createdAt: camelDate(itinerary.created_at),
  };
}

export async function insertGeneratedFile({
  type,
  flightId = null,
  hotelId = null,
  template,
  filename,
  filePath = null,
  htmlContent = null,
  pdfFilename = null,
  pdfPath = null,
  pdfBase64 = null,
}) {
  const result = await query(`
    INSERT INTO generated_files
      (type, flight_itinerary_id, hotel_itinerary_id, template, filename, file_path,
       html_content, pdf_filename, pdf_path, pdf_base64)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `, [type, flightId, hotelId, template, filename, filePath, htmlContent, pdfFilename, pdfPath, pdfBase64]);

  return {
    id: result.rows[0].id,
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

export async function searchGeneratedFiles(queryValue = "") {
  const q = `%${queryValue.trim().toLowerCase()}%`;
  const result = await query(`
    SELECT
      gf.id,
      gf.type,
      gf.template,
      gf.filename,
      gf.file_path AS "filePath",
      gf.pdf_filename AS "pdfFilename",
      gf.pdf_path AS "pdfPath",
      gf.created_at AS "createdAt",
      f.pnr,
      h.reference_number AS "referenceNumber",
      h.hotel_name AS "hotelName",
      COALESCE(fp.names, '') AS "passengerNames",
      COALESCE(hg.names, '') AS "guestNames"
    FROM generated_files gf
    LEFT JOIN flight_itineraries f ON f.id = gf.flight_itinerary_id
    LEFT JOIN hotel_itineraries h ON h.id = gf.hotel_itinerary_id
    LEFT JOIN (
      SELECT flight_itinerary_id, STRING_AGG(full_name, ', ' ORDER BY id) AS names
      FROM flight_passengers
      GROUP BY flight_itinerary_id
    ) fp ON fp.flight_itinerary_id = f.id
    LEFT JOIN (
      SELECT hotel_itinerary_id, STRING_AGG(full_name, ', ' ORDER BY id) AS names
      FROM hotel_guests
      GROUP BY hotel_itinerary_id
    ) hg ON hg.hotel_itinerary_id = h.id
    WHERE
      $1 = '%%'
      OR LOWER(gf.filename) LIKE $1
      OR LOWER(COALESCE(f.pnr, '')) LIKE $1
      OR LOWER(COALESCE(h.reference_number, '')) LIKE $1
      OR LOWER(COALESCE(h.hotel_name, '')) LIKE $1
      OR LOWER(COALESCE(fp.names, '')) LIKE $1
      OR LOWER(COALESCE(hg.names, '')) LIKE $1
      OR LOWER(gf.created_at::text) LIKE $1
    ORDER BY gf.created_at DESC, gf.id DESC
    LIMIT 100
  `, [q]);

  return result.rows.map((record) => ({
    ...record,
    createdAt: camelDate(record.createdAt),
  }));
}

export async function getGeneratedFileByFilename(filename, kind = "html") {
  const column = kind === "pdf" ? "pdf_filename" : "filename";
  const result = await query(`
    SELECT
      id,
      type,
      template,
      filename,
      file_path AS "filePath",
      html_content AS "htmlContent",
      pdf_filename AS "pdfFilename",
      pdf_path AS "pdfPath",
      pdf_base64 AS "pdfBase64",
      created_at AS "createdAt"
    FROM generated_files
    WHERE ${column} = $1
  `, [filename]);
  const record = result.rows[0];
  return record ? { ...record, createdAt: camelDate(record.createdAt) } : null;
}

export async function updateGeneratedPdf(id, { pdfFilename, pdfPath, pdfBase64 }) {
  const result = await query(`
    UPDATE generated_files
    SET pdf_filename = $1, pdf_path = $2, pdf_base64 = $3
    WHERE id = $4
    RETURNING
      id,
      type,
      template,
      filename,
      file_path AS "filePath",
      html_content AS "htmlContent",
      pdf_filename AS "pdfFilename",
      pdf_path AS "pdfPath",
      pdf_base64 AS "pdfBase64",
      created_at AS "createdAt"
  `, [pdfFilename, pdfPath, pdfBase64, id]);
  const record = result.rows[0];
  return record ? { ...record, createdAt: camelDate(record.createdAt) } : null;
}

export async function deleteGeneratedFile(id) {
  const result = await query("DELETE FROM generated_files WHERE id = $1 RETURNING *", [id]);
  return result.rows[0] || null;
}

export async function getSetting(key, fallback = null) {
  const result = await query("SELECT value FROM app_settings WHERE key = $1", [key]);
  return result.rows[0]?.value ?? fallback;
}

export async function setSetting(key, value) {
  await query(`
    INSERT INTO app_settings (key, value)
    VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [key, String(value)]);
  return { key, value: String(value) };
}

export async function cleanupOldRecords(days = 7) {
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 7;
  const result = await query(`
    WITH deleted_generated AS (
      DELETE FROM generated_files
      WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')
      RETURNING id
    ),
    deleted_flights AS (
      DELETE FROM flight_itineraries
      WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')
      RETURNING id
    ),
    deleted_hotels AS (
      DELETE FROM hotel_itineraries
      WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) FROM deleted_generated) AS generated_files,
      (SELECT COUNT(*) FROM deleted_flights) AS flight_itineraries,
      (SELECT COUNT(*) FROM deleted_hotels) AS hotel_itineraries
  `, [safeDays]);

  await setSetting("cleanup_last_run", new Date().toISOString());
  return {
    cutoff: new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString(),
    deleted: {
      generatedFiles: Number(result.rows[0]?.generated_files || 0),
      flightItineraries: Number(result.rows[0]?.flight_itineraries || 0),
      hotelItineraries: Number(result.rows[0]?.hotel_itineraries || 0),
    },
  };
}
