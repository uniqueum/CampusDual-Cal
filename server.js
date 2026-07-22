import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const app = express();
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const CONFIG_PATH = path.join(__dirname, "config.json");

/**
 * Schnüffelt den Browser aus dem User-Agent Header heraus.
 *
 * @param {string} userAgent
 * @returns {string} Der erkannte Browser-Name (chrome, firefox, edge, opera, safari)
 */
function detectBrowser(userAgent) {
  if (!userAgent) return "chrome";
  if (userAgent.includes("Firefox")) return "firefox";
  if (userAgent.includes("Edg/")) return "edge";
  if (userAgent.includes("OPR/") || userAgent.includes("Opera")) return "opera";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "safari";
  return "chrome";
}

// --- ALL REQUIRED ENDPOINTS ---

app.get("/api/config", (req, res) => {
  let config = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (e) {
      config = {};
    }
  }

  // Fallback, falls der Browser noch nicht gespeichert wurde
  if (!config.campus_dual) config.campus_dual = {};
  if (!config.campus_dual.browser) {
    config.campus_dual.browser = detectBrowser(req.headers["user-agent"]);
  }

  res.json(config);
});

app.post("/api/save-config", (req, res) => {
  const { campus_dual, google_calendar } = req.body;
  if (!campus_dual || !campus_dual.student_id || !campus_dual.browser || !campus_dual.start_date || !campus_dual.end_date) {
    return res.status(400).json({ error: "Missing required parameters." });
  }

  let existingConfig = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (e) {}
  }

  const newConfig = {
    ...existingConfig,
    campus_dual: {
      student_id: campus_dual.student_id.trim(),
      browser: campus_dual.browser.trim(),
      start_date: campus_dual.start_date.trim(),
      end_date: campus_dual.end_date.trim(),
    },
    google_calendar:
        google_calendar &&
        google_calendar.calendar_id &&
        google_calendar.calendar_id.trim() !== ""
            ? { calendar_id: google_calendar.calendar_id.trim() }
            : null,
  };

  fs.writeFile(
      CONFIG_PATH,
      JSON.stringify(newConfig, null, 4),
      "utf8",
      (err) => {
        if (err) return res.status(500).json({ error: "Internal Server Error." });
        return res.json({ success: true });
      },
  );
});

app.post("/api/run-sync", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  const proc = spawn(
      process.platform === "win32" ? "py" : "python",
      ["-u", "main.py", "sync-only"],
      {
        shell: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      },
  );

  // Set encoding directly on the process streams to handle multi-byte characters correctly
  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  proc.stdout.on("data", (data) => res.write(data));
  proc.stderr.on("data", (data) => res.write(data));
  proc.on("close", () => res.end());
});

app.post("/api/run-upload", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  const proc = spawn(
      process.platform === "win32" ? "py" : "python",
      ["-u", "uploader.py"],
      {
        shell: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      },
  );

  // Set encoding here as well for clean upload logs
  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  proc.stdout.on("data", (data) => res.write(data));
  proc.stderr.on("data", (data) => res.write(data));
  proc.on("close", () => res.end());
});

app.post("/api/run-bootstrap", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  const proc = spawn(
      process.platform === "win32" ? "py" : "python",
      ["-u", "main.py", "bootstrap"],
      {
        shell: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      },
  );

  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  proc.stdout.on("data", (data) => res.write(data));
  proc.stderr.on("data", (data) => res.write(data));
  proc.on("close", () => res.end());
});

app.get("/api/check-google-ready", (req, res) => {
  if (!fs.existsSync(CONFIG_PATH))
    return res.json({ ready: false, error: "Config missing!" });
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const hasCreds = fs.existsSync(path.join(__dirname, "credentials.json"));
  const hasCalId =
      config.google_calendar &&
      config.google_calendar.calendar_id &&
      config.google_calendar.calendar_id.trim() !== "";
  if (!hasCreds)
    return res.json({ ready: false, error: "Missing credentials.json!" });
  if (!hasCalId) return res.json({ ready: false, error: "No Calendar ID!" });
  res.json({ ready: true });
});

app.get("/api/get-calendar-data", (req, res) => {
  const DATA_PATH = path.join(__dirname, "clean_standardized_calendar.json");
  if (!fs.existsSync(DATA_PATH))
    return res.status(404).json({ error: "Not found." });
  fs.readFile(DATA_PATH, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Read error." });
    try {
      return res.json(JSON.parse(data));
    } catch (e) {
      console.error("JSON parsing error:", e);
      return res.status(500).json({ error: "JSON error." });
    }
  });
});

app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`),
);