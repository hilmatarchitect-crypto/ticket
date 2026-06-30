import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const templates = [
  { id: "classic", name: "Classic", detail: "Clean formal layout" },
  { id: "premium", name: "Premium", detail: "Modern travel layout" },
  { id: "compact", name: "Compact", detail: "Space-saving A4 layout" },
];

const emptyFlight = () => ({
  type: "flight",
  pnr: "",
  passengers: [{ fullName: "", ticketNumber: "", passengerType: "" }],
  segments: [{
    airline: "",
    flightNumber: "",
    class: "",
    departureAirport: "",
    departureCity: "",
    departureDate: "",
    departureTime: "",
    arrivalAirport: "",
    arrivalCity: "",
    arrivalDate: "",
    arrivalTime: "",
    duration: "",
  }],
  baggage: { checkedBaggage: "", cabinBaggage: "" },
});

const emptyHotel = () => ({
  type: "hotel",
  referenceNumber: "",
  hotelName: "",
  hotelAddress: "",
  hotelPhone: "",
  checkInDate: "",
  checkInTime: "",
  checkOutDate: "",
  checkOutTime: "",
  roomType: "",
  bedding: "",
  guests: [{ fullName: "" }],
  numberOfGuests: "",
  mealType: "",
  gps: "",
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
  return payload;
}

function Status({ state, text, seconds }) {
  if (!text) return null;
  return (
    <div className={`status ${state || "idle"}`}>
      <span>{text}</span>
      {seconds ? <strong>{seconds}s</strong> : null}
    </div>
  );
}

function DesignChooser({ value, onChange }) {
  return (
    <div className="template-grid">
      {templates.map((template) => (
        <label className={`template-choice ${value === template.id ? "selected" : ""}`} key={template.id}>
          <input
            type="radio"
            name="template"
            value={template.id}
            checked={value === template.id}
            onChange={() => onChange(template.id)}
          />
          <span>{template.name}</span>
          <small>{template.detail}</small>
        </label>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, wide }) {
  return (
    <label className={`form-field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <input value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FilePicker({ label, file, onFile }) {
  return (
    <div className="upload-box">
      <label>
        <span>{label}</span>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          onChange={(event) => onFile(event.target.files?.[0] || null)}
        />
      </label>
      <div className="file-name">{file ? file.name : "PDF, JPG, JPEG, PNG, WebP, or screenshot"}</div>
    </div>
  );
}

function GeneratedActions({ file }) {
  if (!file) return null;
  return (
    <div className="generated-actions">
      <a href={file.url} target="_blank" rel="noreferrer">Open HTML</a>
      <a href={file.url} download={file.filename}>Download HTML</a>
      {file.pdfUrl ? <a href={file.pdfUrl} target="_blank" rel="noreferrer">Open PDF</a> : null}
      {file.pdfUrl ? <a href={file.pdfUrl} download={file.pdfFilename}>Download PDF</a> : null}
      {!file.pdfUrl && file.pdfPending ? <span className="pdf-pending">PDF preparing...</span> : null}
    </div>
  );
}

function pdfUrl(filename) {
  return `/generated-pdf/${encodeURIComponent(filename)}`;
}

function generatedStatus(file, label = "Itinerary") {
  if (file.pdfPending) return `${label} HTML is ready. PDF is preparing in the background.`;
  if (file.pdfError) return `${label} HTML is ready. ${file.pdfError}`;
  return `${label} HTML and PDF are ready.`;
}

async function pollGeneratedPdf(file, setGenerated) {
  if (!file?.id || !file?.filename || file.pdfUrl) return;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const result = await api(`/api/records?q=${encodeURIComponent(file.filename)}`);
      const record = result.records.find((item) => item.id === file.id || item.filename === file.filename);
      if (record?.pdfFilename) {
        setGenerated((current) => (
          current?.id === file.id
            ? { ...current, pdfFilename: record.pdfFilename, pdfUrl: pdfUrl(record.pdfFilename), pdfPending: false }
            : current
        ));
        window.dispatchEvent(new Event("records:refresh"));
        return;
      }
    } catch {
      return;
    }
  }
}

function FlightForm({ data, onChange }) {
  const update = (patch) => onChange({ ...data, ...patch });
  const updatePassenger = (index, key, value) => {
    const passengers = data.passengers.map((passenger, current) => (
      current === index ? { ...passenger, [key]: value } : passenger
    ));
    update({ passengers });
  };
  const updateSegment = (index, key, value) => {
    const segments = data.segments.map((segment, current) => (
      current === index ? { ...segment, [key]: value } : segment
    ));
    update({ segments });
  };

  return (
    <div className="review-form">
      <div className="section-title">
        <h3>Extracted Flight Data</h3>
        <p>Review and edit before saving.</p>
      </div>
      <div className="form-grid">
        <Field label="PNR / Booking Reference" value={data.pnr} onChange={(value) => update({ pnr: value })} />
        <Field label="Checked Baggage" value={data.baggage.checkedBaggage} onChange={(value) => update({ baggage: { ...data.baggage, checkedBaggage: value } })} />
        <Field label="Cabin Baggage" value={data.baggage.cabinBaggage} onChange={(value) => update({ baggage: { ...data.baggage, cabinBaggage: value } })} />
      </div>

      <div className="subhead">
        <h4>Passengers</h4>
        <button type="button" onClick={() => update({ passengers: [...data.passengers, { fullName: "", ticketNumber: "", passengerType: "" }] })}>Add passenger</button>
      </div>
      {data.passengers.map((passenger, index) => (
        <div className="repeat-row" key={`passenger-${index}`}>
          <Field label="Full Name" value={passenger.fullName} onChange={(value) => updatePassenger(index, "fullName", value)} />
          <Field label="Ticket Number" value={passenger.ticketNumber} onChange={(value) => updatePassenger(index, "ticketNumber", value)} />
          <Field label="Passenger Type" value={passenger.passengerType} onChange={(value) => updatePassenger(index, "passengerType", value)} />
          {data.passengers.length > 1 ? (
            <button type="button" className="remove" onClick={() => update({ passengers: data.passengers.filter((_, current) => current !== index) })}>Remove</button>
          ) : null}
        </div>
      ))}

      <div className="subhead">
        <h4>Flight Segments</h4>
        <button type="button" onClick={() => update({ segments: [...data.segments, emptyFlight().segments[0]] })}>Add segment</button>
      </div>
      {data.segments.map((segment, index) => (
        <div className="segment-box" key={`segment-${index}`}>
          <div className="form-grid">
            <Field label="Airline" value={segment.airline} onChange={(value) => updateSegment(index, "airline", value)} />
            <Field label="Flight Number" value={segment.flightNumber} onChange={(value) => updateSegment(index, "flightNumber", value)} />
            <Field label="Cabin / Class" value={segment.class} onChange={(value) => updateSegment(index, "class", value)} />
            <Field label="Departure Airport" value={segment.departureAirport} onChange={(value) => updateSegment(index, "departureAirport", value)} />
            <Field label="Departure City" value={segment.departureCity} onChange={(value) => updateSegment(index, "departureCity", value)} />
            <Field label="Departure Date" value={segment.departureDate} onChange={(value) => updateSegment(index, "departureDate", value)} />
            <Field label="Departure Time" value={segment.departureTime} onChange={(value) => updateSegment(index, "departureTime", value)} />
            <Field label="Arrival Airport" value={segment.arrivalAirport} onChange={(value) => updateSegment(index, "arrivalAirport", value)} />
            <Field label="Arrival City" value={segment.arrivalCity} onChange={(value) => updateSegment(index, "arrivalCity", value)} />
            <Field label="Arrival Date" value={segment.arrivalDate} onChange={(value) => updateSegment(index, "arrivalDate", value)} />
            <Field label="Arrival Time" value={segment.arrivalTime} onChange={(value) => updateSegment(index, "arrivalTime", value)} />
            <Field label="Duration" value={segment.duration} onChange={(value) => updateSegment(index, "duration", value)} />
          </div>
          {data.segments.length > 1 ? (
            <button type="button" className="remove inline" onClick={() => update({ segments: data.segments.filter((_, current) => current !== index) })}>Remove segment</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function HotelForm({ data, onChange }) {
  const update = (patch) => onChange({ ...data, ...patch });
  const updateGuest = (index, value) => {
    update({
      guests: data.guests.map((guest, current) => (
        current === index ? { ...guest, fullName: value } : guest
      )),
    });
  };

  return (
    <div className="review-form">
      <div className="section-title">
        <h3>Extracted Hotel Data</h3>
        <p>Review and edit before saving.</p>
      </div>
      <div className="form-grid">
        <Field label="Reservation / Reference Number" value={data.referenceNumber} onChange={(value) => update({ referenceNumber: value })} />
        <Field label="Hotel Name" value={data.hotelName} onChange={(value) => update({ hotelName: value })} />
        <Field label="Hotel Phone" value={data.hotelPhone} onChange={(value) => update({ hotelPhone: value })} />
        <Field label="Hotel Address" value={data.hotelAddress} onChange={(value) => update({ hotelAddress: value })} wide />
        <Field label="Check-in Date" value={data.checkInDate} onChange={(value) => update({ checkInDate: value })} />
        <Field label="Check-in Time" value={data.checkInTime} onChange={(value) => update({ checkInTime: value })} />
        <Field label="Check-out Date" value={data.checkOutDate} onChange={(value) => update({ checkOutDate: value })} />
        <Field label="Check-out Time" value={data.checkOutTime} onChange={(value) => update({ checkOutTime: value })} />
        <Field label="Room Type" value={data.roomType} onChange={(value) => update({ roomType: value })} />
        <Field label="Bedding" value={data.bedding} onChange={(value) => update({ bedding: value })} />
        <Field label="Number of Guests / Adults" value={data.numberOfGuests} onChange={(value) => update({ numberOfGuests: value })} />
        <Field label="Meal Type" value={data.mealType} onChange={(value) => update({ mealType: value })} />
        <Field label="GPS / Location" value={data.gps} onChange={(value) => update({ gps: value })} wide />
      </div>

      <div className="subhead">
        <h4>Guests</h4>
        <button type="button" onClick={() => update({ guests: [...data.guests, { fullName: "" }] })}>Add guest</button>
      </div>
      {data.guests.map((guest, index) => (
        <div className="repeat-row compact-row" key={`guest-${index}`}>
          <Field label="Guest Name" value={guest.fullName} onChange={(value) => updateGuest(index, value)} />
          {data.guests.length > 1 ? (
            <button type="button" className="remove" onClick={() => update({ guests: data.guests.filter((_, current) => current !== index) })}>Remove</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function useSingleFlow(type) {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(type === "flight" ? emptyFlight() : emptyHotel());
  const [sourceFile, setSourceFile] = useState("");
  const [status, setStatus] = useState({ state: "", text: "" });
  const [saved, setSaved] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [template, setTemplate] = useState("classic");

  const process = async () => {
    if (!file) {
      setStatus({ state: "error", text: "Please choose a document first." });
      return;
    }
    setStatus({ state: "loading", text: "Processing with Gemini..." });
    setGenerated(null);
    setSaved(null);
    const formData = new FormData();
    formData.append("document", file);
    try {
      const result = await api(`/api/extract/${type}`, { method: "POST", body: formData });
      setData(result.data);
      setSourceFile(result.upload.path);
      setStatus({ state: "success", text: "Extraction complete.", seconds: result.extractionSeconds });
    } catch (error) {
      setStatus({ state: "error", text: error.message });
    }
  };

  const save = async () => {
    setStatus({ state: "loading", text: "Saving to the database..." });
    try {
      const endpoint = type === "flight" ? "/api/flight-itineraries" : "/api/hotel-itineraries";
      const result = await api(endpoint, {
        method: "POST",
        body: JSON.stringify({ data, template, sourceFile }),
      });
      setSaved(result.itinerary);
      setStatus({ state: "success", text: "Saved to the database." });
      return result.itinerary;
    } catch (error) {
      setStatus({ state: "error", text: error.message });
      return null;
    }
  };

  const generate = async () => {
    const record = saved || await save();
    if (!record) return;
    setStatus({ state: "loading", text: "Generating branded HTML and PDF..." });
    try {
      const result = await api(`/api/generate/${type}`, {
        method: "POST",
        body: JSON.stringify({ id: record.id, template }),
      });
      setGenerated(result.file);
      setStatus({ state: "success", text: generatedStatus(result.file, "Itinerary") });
      pollGeneratedPdf(result.file, setGenerated);
      window.dispatchEvent(new Event("records:refresh"));
    } catch (error) {
      setStatus({ state: "error", text: error.message });
    }
  };

  return { file, setFile, data, setData, status, saved, generated, template, setTemplate, process, save, generate };
}

function SingleSection({ type }) {
  const flow = useSingleFlow(type);
  const title = type === "flight" ? "Flight Ticket" : "Hotel Voucher";
  const Form = type === "flight" ? FlightForm : HotelForm;
  const busy = flow.status.state === "loading";

  return (
    <section className="workspace">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>Upload, extract, review, and generate</h2>
        </div>
      </div>

      <div className="action-panel">
        <FilePicker label="Upload PDF or image" file={flow.file} onFile={flow.setFile} />
        <button type="button" className="primary" onClick={flow.process} disabled={busy}>Process with Gemini</button>
        <Status {...flow.status} />
      </div>

      <Form data={flow.data} onChange={flow.setData} />

      <div className="generate-panel">
        <div>
          <h3>Choose itinerary design</h3>
          <DesignChooser value={flow.template} onChange={flow.setTemplate} />
        </div>
        <div className="button-stack">
          <button type="button" onClick={flow.save} disabled={busy}>Save to database</button>
          <button type="button" className="primary" onClick={flow.generate} disabled={busy}>Generate HTML + PDF itinerary</button>
          <GeneratedActions file={flow.generated} />
        </div>
      </div>
    </section>
  );
}

function CombinedSection() {
  const [flightFile, setFlightFile] = useState(null);
  const [hotelFile, setHotelFile] = useState(null);
  const [flight, setFlight] = useState(emptyFlight());
  const [hotel, setHotel] = useState(emptyHotel());
  const [flightSourceFile, setFlightSourceFile] = useState("");
  const [hotelSourceFile, setHotelSourceFile] = useState("");
  const [status, setStatus] = useState({ state: "", text: "" });
  const [saved, setSaved] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [template, setTemplate] = useState("classic");
  const busy = status.state === "loading";

  const processBoth = async () => {
    if (!flightFile || !hotelFile) {
      setStatus({ state: "error", text: "Please choose both the flight ticket and hotel voucher." });
      return;
    }
    setStatus({ state: "loading", text: "Processing both documents with Gemini..." });
    setSaved(null);
    setGenerated(null);
    try {
      const flightForm = new FormData();
      flightForm.append("document", flightFile);
      const hotelForm = new FormData();
      hotelForm.append("document", hotelFile);
      const [flightResult, hotelResult] = await Promise.all([
        api("/api/extract/flight", { method: "POST", body: flightForm }),
        api("/api/extract/hotel", { method: "POST", body: hotelForm }),
      ]);
      setFlight(flightResult.data);
      setHotel(hotelResult.data);
      setFlightSourceFile(flightResult.upload.path);
      setHotelSourceFile(hotelResult.upload.path);
      const seconds = Math.max(flightResult.extractionSeconds, hotelResult.extractionSeconds);
      setStatus({ state: "success", text: "Combined extraction complete.", seconds });
    } catch (error) {
      setStatus({ state: "error", text: error.message });
    }
  };

  const save = async () => {
    setStatus({ state: "loading", text: "Saving combined records to the database..." });
    try {
      const result = await api("/api/combined-itineraries", {
        method: "POST",
        body: JSON.stringify({ flight, hotel, template, flightSourceFile, hotelSourceFile }),
      });
      setSaved(result);
      setStatus({ state: "success", text: "Combined records saved." });
      return result;
    } catch (error) {
      setStatus({ state: "error", text: error.message });
      return null;
    }
  };

  const generate = async () => {
    const record = saved || await save();
    if (!record) return;
    setStatus({ state: "loading", text: "Generating combined branded HTML and PDF..." });
    try {
      const result = await api("/api/generate/combined", {
        method: "POST",
        body: JSON.stringify({ flightId: record.flight.id, hotelId: record.hotel.id, template }),
      });
      setGenerated(result.file);
      setStatus({ state: "success", text: generatedStatus(result.file, "Combined itinerary") });
      pollGeneratedPdf(result.file, setGenerated);
      window.dispatchEvent(new Event("records:refresh"));
    } catch (error) {
      setStatus({ state: "error", text: error.message });
    }
  };

  return (
    <section className="workspace">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Combined Flight + Hotel Itinerary</p>
          <h2>Upload both documents and generate one complete itinerary</h2>
        </div>
      </div>

      <div className="action-panel two">
        <FilePicker label="Upload flight ticket" file={flightFile} onFile={setFlightFile} />
        <FilePicker label="Upload hotel voucher" file={hotelFile} onFile={setHotelFile} />
        <button type="button" className="primary" onClick={processBoth} disabled={busy}>Process with Gemini</button>
        <Status {...status} />
      </div>

      <FlightForm data={flight} onChange={setFlight} />
      <HotelForm data={hotel} onChange={setHotel} />

      <div className="generate-panel">
        <div>
          <h3>Choose itinerary design</h3>
          <DesignChooser value={template} onChange={setTemplate} />
        </div>
        <div className="button-stack">
          <button type="button" onClick={save} disabled={busy}>Save to database</button>
          <button type="button" className="primary" onClick={generate} disabled={busy}>Generate HTML + PDF itinerary</button>
          <GeneratedActions file={generated} />
        </div>
      </div>
    </section>
  );
}

function AdminCleanup() {
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const result = await api("/api/admin/settings");
      setSettings(result);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cleanNow = async () => {
    setMessage("Cleaning records older than 7 days...");
    try {
      const result = await api("/api/admin/cleanup", { method: "POST" });
      setMessage(`Cleanup complete. Removed ${result.deleted.generatedFiles} generated file record(s), ${result.deleted.flightItineraries} flight record(s), and ${result.deleted.hotelItineraries} hotel record(s).`);
      window.dispatchEvent(new Event("records:refresh"));
      load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="admin-cleanup">
      <div>
        <strong>Auto-delete records after 7 days: Enabled</strong>
        <span>{settings?.cleanupLastRun ? `Last cleanup: ${settings.cleanupLastRun}` : "Old records are checked automatically."}</span>
      </div>
      <button type="button" onClick={cleanNow}>Clean old records now</button>
      {message ? <p>{message}</p> : null}
    </div>
  );
}

function RecordsPanel({ user }) {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState("");
  const isAdmin = user?.role === "admin";

  const loadRecords = async (search = query) => {
    try {
      const result = await api(`/api/records?q=${encodeURIComponent(search)}`);
      setRecords(result.records);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    loadRecords("");
    const refresh = () => loadRecords("");
    window.addEventListener("records:refresh", refresh);
    return () => window.removeEventListener("records:refresh", refresh);
  }, []);

  const deleteRecord = async (id) => {
    if (!window.confirm("Delete this generated itinerary?")) return;
    try {
      await api(`/api/records/${id}`, { method: "DELETE" });
      loadRecords();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <section className="records-panel">
      <div className="records-head">
        <div>
          <p className="eyebrow">Previous generated itineraries</p>
          <h2>Search and open saved itineraries</h2>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); loadRecords(); }}>
          <input
            placeholder="Search name, PNR, reference, hotel, or date"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </div>
      {isAdmin ? <AdminCleanup /> : null}
      {message ? <Status state="error" text={message} /> : null}
      <div className="record-list">
        {records.length === 0 ? (
          <div className="empty">No generated itineraries yet.</div>
        ) : records.map((record) => (
          <div className="record" key={record.id}>
            <div>
              <strong>{record.filename}</strong>
              <span>{record.type} | {record.passengerNames || record.guestNames || record.hotelName || "Bookings Time"} | {record.createdAt}</span>
            </div>
            <div className="record-actions">
              <a href={`/generated/${encodeURIComponent(record.filename)}`} target="_blank" rel="noreferrer">Open HTML</a>
              <a href={`/generated/${encodeURIComponent(record.filename)}`} download={record.filename}>Download HTML</a>
              {record.pdfFilename ? <a href={`/generated-pdf/${encodeURIComponent(record.pdfFilename)}`} target="_blank" rel="noreferrer">Open PDF</a> : null}
              {record.pdfFilename ? <a href={`/generated-pdf/${encodeURIComponent(record.pdfFilename)}`} download={record.pdfFilename}>Download PDF</a> : null}
              {isAdmin ? <button type="button" onClick={() => deleteRecord(record.id)}>Delete</button> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ state: "", text: "" });

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ state: "loading", text: "Signing in..." });
    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setStatus({ state: "success", text: "Login successful." });
      onLogin(result.user);
    } catch (error) {
      setStatus({ state: "error", text: error.message });
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand login-brand">
          <img src="/assets/bookings-time-logo.png" alt="Bookings Time logo" />
          <div>
            <h1>Bookings Time</h1>
            <p>Staff itinerary login</p>
          </div>
        </div>
        <form onSubmit={submit} className="login-form">
          <Field label="Username" value={username} onChange={setUsername} />
          <label className="form-field">
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" className="primary">Login</button>
          <Status {...status} />
        </form>
      </section>
    </main>
  );
}

function ItineraryApp({ user, onLogout }) {
  const [active, setActive] = useState("flight");
  const activeSection = useMemo(() => {
    if (active === "hotel") return <SingleSection key="hotel" type="hotel" />;
    if (active === "combined") return <CombinedSection key="combined" />;
    return <SingleSection key="flight" type="flight" />;
  }, [active]);

  const cards = [
    { id: "flight", title: "Flight Ticket", text: "Create English and Kurdish A4 flight itineraries." },
    { id: "hotel", title: "Hotel Voucher", text: "Create English and Kurdish A4 hotel itineraries." },
    { id: "combined", title: "Combined Flight + Hotel Itinerary", text: "Create one complete four-page itinerary." },
  ];

  return (
    <main>
      <header className="app-header">
        <div className="brand">
          <img src="/assets/bookings-time-logo.png" alt="Bookings Time logo" />
          <div>
            <h1>Bookings Time</h1>
            <p>Staff itinerary builder</p>
          </div>
        </div>
        <div className="contact">
          <span>Office 103, Gallery Mall, 40 Meter Street, Erbil, Kurdistan Region, Iraq</span>
          <span>info@bookingstime.com</span>
          <span>+964 750 986 1000 | +964 750 987 1000 | +964 750 484 4117</span>
          <span className="session-line">{user.role === "admin" ? "Admin" : "Staff"}: {user.username} <button type="button" onClick={onLogout}>Logout</button></span>
        </div>
      </header>

      <section className="cards">
        {cards.map((card) => (
          <button className={`home-card ${active === card.id ? "active" : ""}`} key={card.id} onClick={() => setActive(card.id)}>
            <span>{card.title}</span>
            <small>{card.text}</small>
          </button>
        ))}
      </section>

      {activeSection}
      <RecordsPanel user={user} />
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    setUser(null);
  };

  if (loading) {
    return (
      <main className="login-page">
        <section className="login-card">
          <Status state="loading" text="Opening Bookings Time..." />
        </section>
      </main>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;
  return <ItineraryApp user={user} onLogout={logout} />;
}

createRoot(document.getElementById("root")).render(<App />);
