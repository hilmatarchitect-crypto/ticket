import crypto from "node:crypto";

const COOKIE_NAME = "bt_session";
const SESSION_HOURS = 12;
const sessions = new Map();

function configuredUsers() {
  return [
    {
      role: "admin",
      username: process.env.ADMIN_USERNAME || "admin",
      password: process.env.ADMIN_PASSWORD || "bookings-admin",
    },
    {
      role: "staff",
      username: process.env.STAFF_USERNAME || "staff",
      password: process.env.STAFF_PASSWORD || "bookings-staff",
    },
  ];
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        if (index === -1) return [item, ""];
        return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function cookieOptions() {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_HOURS * 60 * 60};${secure}`;
}

function publicUser(session) {
  return session ? { username: session.username, role: session.role } : null;
}

function findSession(req) {
  const token = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function attachUser(req, _res, next) {
  req.user = publicUser(findSession(req));
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Please login to continue." });
    return;
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Please login to continue." });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Only admin can do this action." });
    return;
  }
  next();
}

export function registerAuthRoutes(app, { onAdminLogin } = {}) {
  app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.user || null });
  });

  app.post("/api/auth/login", async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const match = configuredUsers().find((user) => (
      user.username === username && user.password === password
    ));

    if (!match) {
      res.status(401).json({ error: "The username or password is incorrect." });
      return;
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const session = {
      username: match.username,
      role: match.role,
      expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
    };
    sessions.set(token, session);
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieOptions()}`);

    if (match.role === "admin" && typeof onAdminLogin === "function") {
      await onAdminLogin();
    }

    res.json({ user: publicUser(session) });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    res.json({ ok: true });
  });
}
