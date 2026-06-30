import fs from "node:fs";
import path from "node:path";

const COMPANY = {
  name: "Bookings Time",
  address: "Office 103, Gallery Mall, 40 Meter Street, Erbil, Kurdistan Region, Iraq",
  email: "info@bookingstime.com",
  phones: "+964 750 986 1000 | +964 750 987 1000 | +964 750 484 4117",
};

const flightNotesKu = [
  "تکایە بەر لە کاتی فڕین بە کەمترین ٢ کاتژمێر لە فڕۆکەخانە ئامادە بن بۆ فڕینی ناوخۆیی.",
  "بۆ فڕینی دەرەوەی وڵات، باشترە ٣ تا ٤ کاتژمێر بەر لە فڕین لە فڕۆکەخانە ئامادە بن.",
  "ناسنامە، پاسپۆرت، ڤیزا یان هەر بەڵگەنامەیەکی پێویست لەگەڵ خۆتان هەڵبگرن.",
  "دڵنیا بن لەوەی ناوەکەتان لەسەر بلیت و بەڵگەنامەکان وەک یەک نووسراوە.",
  "ئاگاداری قەبارە و کێشی باری کابین و باری گەورە بن، چونکە زیادەبار لە فڕۆکەخانە پارەی زیادەی دەوێت.",
  "شتە گرنگەکان وەک پاسپۆرت، پارە، مۆبایل، چارچەر، دەرمان و بەڵگەنامەکان لە باری دەستی/کابین دابنێن.",
  "شتە قەدەغەکراوەکان وەک شتی تیژ، مایعاتی زۆر، سپرەی قەدەغەکراو و ماددەی مەترسیدار لە باری دەستی دانەنێن.",
  "دوای وەرگرتنی boarding pass، ژمارەی gate و کاتی داخستنی gate بە وردی بپشکنن.",
  "لە کاتی گەشتدا هەر کێشەیەک ڕوویدا، پەیوەندی بە Bookings Time بکەن.",
  "هەمیشە وێنەی بلیت و پاسپۆرت لە مۆبایلەکەتان هەڵبگرن.",
];

const hotelNotesKu = [
  "تکایە لە کاتی check-in پاسپۆرت یان ناسنامەی فەرمی لەگەڵ خۆتان هەڵبگرن.",
  "کاتی check-in و check-out بە وردی بپشکنن و پێش کاتی دیاریکراو خۆتان ئامادە بکەن.",
  "هەندێک هۆتێل دەتوانن داوای پارەی زیادە بکەن وەک city tax، deposit، یان خزمەتگوزارییە زیادەکان.",
  "ئەگەر دوای کاتژمێر ٦ی ئێوارە دەگەنە هۆتێل، پێشتر بە هۆتێل یان ئێمە ئاگاداری بدەنەوە.",
  "هۆتێل دەتوانێت لە کاتی دواکردنەوە یان نەگەیشتن، بە پێی یاساکانی خۆی سزا یان no-show fee بسەپێنێت.",
  "تکایە ژمارەی ڕیزەرفەیشن و ناوی میوانەکان لەگەڵ بەڵگەنامەکاندا بپشکنن.",
  "شتە نرخدارەکانتان لە شوێنی پارێزراو دابنێن و ئاگاداری سامانەکەتان بن.",
  "بۆ هەر کێشەیەک لە check-in یان check-out، پەیوەندی بە Bookings Time بکەن.",
];

function escapeHtml(value) {
  return String(value ?? "Not specified")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function logoDataUri() {
  const logoPath = path.resolve(process.cwd(), "public/assets/bookings-time-logo.png");
  try {
    const data = fs.readFileSync(logoPath);
    return `data:image/png;base64,${data.toString("base64")}`;
  } catch {
    return "";
  }
}

function cleanNamePart(value) {
  const cleaned = String(value || "Itinerary")
    .replace(/Not specified/gi, "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 70);
  return cleaned || "Itinerary";
}

export function filenameFor(type, { flight, hotel }) {
  if (type === "flight") {
    return `${cleanNamePart(flight?.passengers?.[0]?.fullName)}_${cleanNamePart(flight?.pnr)}.html`;
  }
  if (type === "hotel") {
    return `${cleanNamePart(hotel?.guests?.[0]?.fullName)}_${cleanNamePart(hotel?.referenceNumber)}.html`;
  }
  return `${cleanNamePart(flight?.passengers?.[0]?.fullName)}_${cleanNamePart(flight?.pnr)}_${cleanNamePart(hotel?.referenceNumber)}.html`;
}

function stylesheet(template) {
  const compact = template === "compact";
  const premium = template === "premium";
  return `
    :root {
      --primary: #B82028;
      --deep: #991B22;
      --white: #FFFFFF;
      --text: #1F2933;
      --muted: #5D6978;
      --light: #F8F8F8;
      --border: #E5E7EB;
    }

    @page {
      size: A4;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #d7dbe0;
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${compact ? "11px" : "12px"};
      line-height: 1.45;
    }

    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: ${compact ? "10mm 11mm" : premium ? "14mm 15mm" : "13mm 14mm"};
      background: var(--white);
      display: flex;
      flex-direction: column;
      page-break-after: always;
      overflow: hidden;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .brand-header {
      direction: ltr;
      position: relative;
      display: grid;
      grid-template-columns: ${premium ? "72mm 1fr" : compact ? "56mm 1fr" : "64mm 1fr"};
      gap: ${compact ? "7mm" : "10mm"};
      align-items: center;
      padding: ${compact ? "4mm 0 5mm" : "5mm 0 7mm"};
      margin-bottom: ${compact ? "5mm" : "7mm"};
      border-bottom: 1px solid var(--border);
    }

    .brand-header::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: ${premium ? "1.2mm" : "0.9mm"};
      border-radius: 99px;
      background: linear-gradient(90deg, var(--deep), var(--primary), rgba(184, 32, 40, 0.18));
    }

    .brand-left {
      display: flex;
      align-items: center;
    }

    .logo {
      width: ${premium ? "68mm" : compact ? "54mm" : "62mm"};
      height: auto;
      max-height: ${premium ? "27mm" : compact ? "20mm" : "24mm"};
      object-fit: contain;
      object-position: left center;
    }

    .company-name {
      margin: 0;
      color: var(--deep);
      font-size: ${premium ? "25px" : compact ? "18px" : "21px"};
      line-height: 1;
      letter-spacing: 0;
      font-weight: 800;
    }

    .contact-block {
      direction: ltr;
      justify-self: end;
      display: grid;
      gap: ${compact ? "1.4mm" : "2mm"};
      color: var(--text);
      font-size: ${compact ? "10.5px" : "11.5px"};
      text-align: left;
      width: 100%;
      max-width: 108mm;
      padding: ${compact ? "2mm 3mm" : "2.6mm 3.5mm"};
      border: 1px solid var(--border);
      border-radius: 7px;
      background: linear-gradient(180deg, #FFFFFF, var(--light));
    }

    .contact-row {
      direction: ltr;
      display: grid;
      grid-template-columns: ${compact ? "17mm" : "20mm"} minmax(0, 1fr);
      gap: 3mm;
      align-items: start;
      text-align: left;
    }

    .contact-label {
      color: var(--primary);
      font-weight: 800;
      text-align: left;
    }

    .title-band {
      ${premium ? "background: linear-gradient(135deg, var(--deep), var(--primary)); color: var(--white);" : "background: linear-gradient(90deg, rgba(184, 32, 40, 0.09), rgba(184, 32, 40, 0.02)); color: var(--primary);"}
      border: 1px solid ${premium ? "var(--deep)" : "rgba(184, 32, 40, 0.18)"};
      border-left: 5px solid var(--primary);
      padding: ${compact ? "3mm 4mm" : "4mm 5mm"};
      margin-bottom: ${compact ? "4mm" : "6mm"};
      border-radius: 7px;
    }

    .title-band h1 {
      margin: 0;
      font-size: ${premium ? "24px" : compact ? "18px" : "21px"};
      line-height: 1.1;
      letter-spacing: 0;
    }

    .reference-grid,
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: ${compact ? "3mm" : "4mm"};
      margin-bottom: ${compact ? "4mm" : "5mm"};
    }

    .field,
    .accent-card {
      background: ${premium ? "#fff7f7" : "linear-gradient(180deg, #FFFFFF, var(--light))"};
      border: 1px solid var(--border);
      border-top: ${premium ? "3px solid var(--primary)" : "1px solid var(--border)"};
      border-radius: 7px;
      padding: ${compact ? "2.2mm 3mm" : "3mm 3.5mm"};
    }

    .label {
      display: block;
      color: var(--primary);
      font-size: ${compact ? "9px" : "10px"};
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }

    .value {
      font-weight: 700;
      color: var(--text);
      overflow-wrap: anywhere;
    }

    h2 {
      color: var(--primary);
      font-size: ${compact ? "15px" : "17px"};
      margin: ${compact ? "4mm 0 2mm" : "6mm 0 3mm"};
      letter-spacing: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: ${compact ? "3mm" : "5mm"};
      table-layout: fixed;
      border: 1px solid var(--border);
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    th {
      background: linear-gradient(135deg, var(--deep), var(--primary));
      color: var(--white);
      font-size: ${compact ? "9.5px" : "10.5px"};
      text-align: left;
      padding: ${compact ? "1.8mm" : "2.3mm"};
      font-weight: 800;
    }

    td {
      border-top: 1px solid var(--border);
      padding: ${compact ? "1.8mm" : "2.3mm"};
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    tr:nth-child(even) td {
      background: var(--light);
    }

    .content {
      flex: 1;
    }

    .footer {
      direction: ltr;
      border-top: 1px solid var(--border);
      padding-top: 3mm;
      margin-top: ${compact ? "4mm" : "6mm"};
      display: flex;
      justify-content: space-between;
      gap: 5mm;
      color: var(--muted);
      font-size: ${compact ? "9.5px" : "10px"};
    }

    .rtl {
      direction: rtl;
      font-family: "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, Arial, sans-serif;
      text-align: right;
      font-size: ${compact ? "12px" : "13px"};
    }

    .rtl .title-band,
    .rtl h2,
    .rtl th,
    .rtl td {
      text-align: right;
    }

    .rtl .title-band {
      border-left: 1px solid var(--border);
      border-right: ${premium ? "0" : "5px solid var(--primary)"};
    }

    .notes {
      margin: 0;
      padding: 0 6mm 0 0;
    }

    .notes li {
      margin-bottom: ${compact ? "1.5mm" : "2.2mm"};
      padding-right: 1mm;
    }

    .two-col {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: ${compact ? "3mm" : "4mm"};
    }

    @media screen {
      .page {
        box-shadow: 0 12px 40px rgba(31, 41, 51, 0.18);
        margin: 10mm auto;
      }
    }

    @media print {
      html,
      body {
        background: var(--white);
      }

      .page {
        margin: 0;
        box-shadow: none;
      }
    }
  `;
}

function header() {
  const logo = logoDataUri();
  return `
    <header class="brand-header">
      <div class="brand-left">
        ${logo ? `<img class="logo" src="${logo}" alt="Bookings Time logo">` : `<h1 class="company-name">${COMPANY.name}</h1>`}
      </div>
      <div class="contact-block">
        <div class="contact-row"><span class="contact-label">Address</span><span dir="ltr">${escapeHtml(COMPANY.address)}</span></div>
        <div class="contact-row"><span class="contact-label">Email</span><span dir="ltr"><a href="mailto:${escapeHtml(COMPANY.email)}">${escapeHtml(COMPANY.email)}</a></span></div>
      </div>
    </header>
  `;
}

function footer() {
  return `
    <footer class="footer">
      <span>Prepared by Bookings Time</span>
      <span><a href="mailto:${escapeHtml(COMPANY.email)}">${escapeHtml(COMPANY.email)}</a> | ${escapeHtml(COMPANY.phones)}</span>
    </footer>
  `;
}

function title(text) {
  return `<section class="title-band"><h1>${escapeHtml(text)}</h1></section>`;
}

function field(label, value) {
  return `
    <div class="field">
      <span class="label">${escapeHtml(label)}</span>
      <span class="value">${escapeHtml(value)}</span>
    </div>
  `;
}

function rows(items, columns) {
  return items.map((item) => `
    <tr>
      ${columns.map((column) => `<td>${escapeHtml(column.value(item))}</td>`).join("")}
    </tr>
  `).join("");
}

function table(columns, items) {
  return `
    <table>
      <thead>
        <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
      </thead>
      <tbody>${rows(items, columns)}</tbody>
    </table>
  `;
}

function notesList(notes) {
  return `<ol class="notes">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ol>`;
}

function flightEnglishPage(flight, template) {
  return `
    <section class="page">
      ${header()}
      <main class="content">
        ${title("Flight Itinerary")}
        <div class="reference-grid">
          ${field("PNR / Booking Reference", flight.pnr)}
          ${field("Prepared For", flight.passengers?.[0]?.fullName)}
        </div>

        <h2>Passenger Details</h2>
        ${table([
          { label: "Passenger Name", value: (p) => p.fullName },
          { label: "Ticket Number", value: (p) => p.ticketNumber },
          { label: "Passenger Type", value: (p) => p.passengerType },
        ], flight.passengers || [])}

        <h2>Flight Details</h2>
        ${table([
          { label: "Airline", value: (s) => s.airline },
          { label: "Flight", value: (s) => s.flightNumber },
          { label: "Class", value: (s) => s.class },
          { label: "Departure", value: (s) => `${s.departureCity} / ${s.departureAirport}` },
          { label: "Date / Time", value: (s) => `${s.departureDate} ${s.departureTime}` },
          { label: "Arrival", value: (s) => `${s.arrivalCity} / ${s.arrivalAirport}` },
          { label: "Date / Time", value: (s) => `${s.arrivalDate} ${s.arrivalTime}` },
          { label: "Duration", value: (s) => s.duration },
        ], flight.segments || [])}

        <h2>Baggage Allowance</h2>
        <div class="summary-grid">
          ${field("Checked Baggage", flight.baggage?.checkedBaggage)}
          ${field("Cabin Baggage", flight.baggage?.cabinBaggage)}
        </div>
      </main>
      ${footer()}
    </section>
  `;
}

function flightKurdishPage(flight, template) {
  return `
    <section class="page rtl" lang="ckb" dir="rtl">
      ${header()}
      <main class="content">
        ${title("وردەکاری گەشت")}
        <div class="reference-grid">
          ${field("PNR", flight.pnr)}
          ${field("ناوی گەشتیار", flight.passengers?.[0]?.fullName)}
        </div>

        <h2>ناوی گەشتیاران</h2>
        ${table([
          { label: "ناو", value: (p) => p.fullName },
          { label: "ژمارەی بلیت", value: (p) => p.ticketNumber },
          { label: "جۆری گەشتیار", value: (p) => p.passengerType },
        ], flight.passengers || [])}

        <h2>پوختەی فڕین</h2>
        ${table([
          { label: "هێڵی ئاسمانی", value: (s) => s.airline },
          { label: "ژمارەی فڕین", value: (s) => s.flightNumber },
          { label: "پۆل", value: (s) => s.class },
          { label: "ڕۆیشتن", value: (s) => `${s.departureCity} / ${s.departureAirport}` },
          { label: "کات", value: (s) => `${s.departureDate} ${s.departureTime}` },
          { label: "گەیشتن", value: (s) => `${s.arrivalCity} / ${s.arrivalAirport}` },
          { label: "کات", value: (s) => `${s.arrivalDate} ${s.arrivalTime}` },
          { label: "ماوە", value: (s) => s.duration },
        ], flight.segments || [])}

        <h2>وردەکاری بار</h2>
        <div class="summary-grid">
          ${field("باری گەورە", flight.baggage?.checkedBaggage)}
          ${field("باری دەستی / کابین", flight.baggage?.cabinBaggage)}
        </div>

        <h2>تێبینی گرنگی فڕۆکەخانە</h2>
        ${notesList(flightNotesKu)}
      </main>
      ${footer()}
    </section>
  `;
}

function hotelEnglishPage(hotel, template) {
  return `
    <section class="page">
      ${header()}
      <main class="content">
        ${title("Hotel Itinerary")}
        <div class="reference-grid">
          ${field("Reservation / Reference Number", hotel.referenceNumber)}
          ${field("Primary Guest", hotel.guests?.[0]?.fullName)}
        </div>

        <h2>Guest Details</h2>
        ${table([{ label: "Guest Name", value: (g) => g.fullName }], hotel.guests || [])}

        <h2>Hotel Details</h2>
        <div class="summary-grid">
          ${field("Hotel Name", hotel.hotelName)}
          ${field("Hotel Phone", hotel.hotelPhone)}
          ${field("Hotel Address", hotel.hotelAddress)}
          ${field("GPS / Location", hotel.gps)}
        </div>

        <h2>Stay Details</h2>
        <div class="summary-grid">
          ${field("Check-in", `${hotel.checkInDate} ${hotel.checkInTime}`)}
          ${field("Check-out", `${hotel.checkOutDate} ${hotel.checkOutTime}`)}
          ${field("Room Type", hotel.roomType)}
          ${field("Bedding", hotel.bedding)}
          ${field("Number of Guests / Adults", hotel.numberOfGuests)}
          ${field("Meal Type", hotel.mealType)}
        </div>
      </main>
      ${footer()}
    </section>
  `;
}

function hotelKurdishPage(hotel, template) {
  return `
    <section class="page rtl" lang="ckb" dir="rtl">
      ${header()}
      <main class="content">
        ${title("وردەکاری هۆتێل")}
        <div class="reference-grid">
          ${field("ژمارەی ڕیزەرفەیشن / Reference", hotel.referenceNumber)}
          ${field("ناوی میوان", hotel.guests?.[0]?.fullName)}
        </div>

        <h2>ناوی میوانەکان</h2>
        ${table([{ label: "ناوی میوان", value: (g) => g.fullName }], hotel.guests || [])}

        <h2>ناوی هۆتێل و ناونیشان</h2>
        <div class="summary-grid">
          ${field("ناوی هۆتێل", hotel.hotelName)}
          ${field("تەلەفۆنی هۆتێل", hotel.hotelPhone)}
          ${field("ناونیشان", hotel.hotelAddress)}
          ${field("شوێن / GPS", hotel.gps)}
        </div>

        <h2>کاتی check-in و check-out</h2>
        <div class="summary-grid">
          ${field("Check-in", `${hotel.checkInDate} ${hotel.checkInTime}`)}
          ${field("Check-out", `${hotel.checkOutDate} ${hotel.checkOutTime}`)}
        </div>

        <h2>جۆری ژوور</h2>
        <div class="summary-grid">
          ${field("جۆری ژوور", hotel.roomType)}
          ${field("جۆری نووستن", hotel.bedding)}
          ${field("ژمارەی میوان", hotel.numberOfGuests)}
          ${field("جۆری خواردن ئەگەر هەبێت", hotel.mealType)}
        </div>

        <h2>تێبینی گرنگ</h2>
        ${notesList(hotelNotesKu)}
      </main>
      ${footer()}
    </section>
  `;
}

export function generateItineraryHtml({ type, flight, hotel, template = "classic" }) {
  const safeTemplate = ["classic", "premium", "compact"].includes(template) ? template : "classic";
  let pages = "";
  if (type === "flight") {
    pages = flightEnglishPage(flight, safeTemplate) + flightKurdishPage(flight, safeTemplate);
  } else if (type === "hotel") {
    pages = hotelEnglishPage(hotel, safeTemplate) + hotelKurdishPage(hotel, safeTemplate);
  } else {
    pages = [
      flightEnglishPage(flight, safeTemplate),
      hotelEnglishPage(hotel, safeTemplate),
      flightKurdishPage(flight, safeTemplate),
      hotelKurdishPage(hotel, safeTemplate),
    ].join("");
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(COMPANY.name)} Itinerary</title>
    <style>${stylesheet(safeTemplate)}</style>
  </head>
  <body>
    ${pages}
  </body>
</html>`;
}
