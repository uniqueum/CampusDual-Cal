// server.js

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

const PYTHON_PATH = process.platform === "win32"
    ? path.join(__dirname, ".venv", "Scripts", "python.exe")
    : path.join(__dirname, ".venv", "bin", "python");

const CONFIG_PATH = path.join(__dirname, "config.json");
const TEMPLATE_CONFIG_PATH = path.join(__dirname, ".config.json");

if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(TEMPLATE_CONFIG_PATH)) {
  try {
    fs.copyFileSync(TEMPLATE_CONFIG_PATH, CONFIG_PATH);
    console.log("📦 Initialized 'config.json' from repository template '.config.json'.");
  } catch (err) {
    console.error("Failed to initialize config.json from template:", err);
  }
}

app.get("/api/config", (req, res) => {
  let config = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (e) {
      config = {};
    }
  }

  if (!config.campus_dual) config.campus_dual = {};
  res.json(config);
});

app.get("/api/check-venv", (req, res) => {
  let config = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (e) {}
  }

  const installedFlag = config.local_dependencies &&
      config.local_dependencies.dependencies_installed === "TRUE";

  res.json({ venvExists: installedFlag });
});

app.get("/api/check-firefox", (req, res) => {
  let isInstalled = false;
  if (process.platform === "win32") {
    const winPaths = [
      path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Mozilla Firefox", "firefox.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Mozilla Firefox", "firefox.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Mozilla Firefox", "firefox.exe")
    ];
    isInstalled = winPaths.some(p => fs.existsSync(p));
  } else if (process.platform === "darwin") {
    isInstalled = fs.existsSync("/Applications/Firefox.app");
  } else {
    const linuxPaths = ["/usr/bin/firefox", "/usr/local/bin/firefox", "/snap/bin/firefox"];
    isInstalled = linuxPaths.some(p => fs.existsSync(p));
  }

  const ua = req.headers['user-agent'] || '';
  const isFirefoxUser = ua.includes('Firefox');

  return res.json({ isFirefox: isFirefoxUser, firefoxInstalled: isInstalled });
});

app.post("/api/save-config", (req, res) => {
  const { campus_dual, google_calendar } = req.body;
  if (!campus_dual || !campus_dual.student_id || !campus_dual.start_date || !campus_dual.end_date) {
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

  const activePython = getActivePython();

  const proc = spawn(
      activePython,
      ["-u", "main.py", "sync-only"],
      {
        cwd: __dirname,
        shell: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      },
  );

  let outputBuffer = "";

  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  proc.stdout.on("data", (data) => {
    outputBuffer += data;
    res.write(data);
  });
  proc.stderr.on("data", (data) => {
    outputBuffer += data;
    res.write(data);
  });

  proc.on("error", (err) => {
    res.write(`\n[NODE SPAWN ERROR]: ${err.message}\n`);
    res.end();
  });

  proc.on("close", (code) => {
    if (outputBuffer.includes("401") || outputBuffer.includes("Unauthorized") || outputBuffer.includes("Failed to extract cookies")) {
      res.write(`\n[AUTH_MISSING]\n`);
    }
    res.write(`\n[NODE] Process exited with code ${code}\n`);
    res.end();
  });
});

app.post("/api/run-upload", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  const activePython = getActivePython();

  const proc = spawn(
      activePython,
      ["-u", "uploader.py"],
      {
        cwd: __dirname,
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

app.post("/api/run-bootstrap", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  const activePython = getActivePython();

  const proc = spawn(
      activePython,
      ["-u", "main.py", "bootstrap"],
      {
        cwd: __dirname,
        shell: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      },
  );

  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  proc.stdout.on("data", (data) => res.write(data));
  proc.stderr.on("data", (data) => res.write(data));

  proc.on("close", (code) => {
    if (code === 0) {
      try {
        let existingConfig = {};
        if (fs.existsSync(CONFIG_PATH)) {
          existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
        }
        existingConfig.local_dependencies = { dependencies_installed: "TRUE" };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(existingConfig, null, 4), "utf8");
        res.write(`\n[NODE] Successfully updated config dependencies_installed to TRUE.\n`);
      } catch (err) {
        res.write(`\n[NODE ERROR] Failed to update config file: ${err.message}\n`);
      }
    }
    res.end();
  });
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
      return res.status(500).json({ error: "JSON error." });
    }
  });
});

app.post("/api/launch-firefox", (req, res) => {
  const portalUrl = "http://localhost:3000/";
  let spawnCommand, spawnArgs;

  if (process.platform === "win32") {
    const winPaths = [
      path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Mozilla Firefox", "firefox.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Mozilla Firefox", "firefox.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Mozilla Firefox", "firefox.exe")
    ];
    const ffPath = winPaths.find(p => fs.existsSync(p)) || "firefox.exe";
    spawnCommand = ffPath;
    spawnArgs = [portalUrl];
  } else if (process.platform === "darwin") {
    spawnCommand = "open";
    spawnArgs = ["-a", "Firefox", portalUrl];
  } else {
    const linuxPaths = ["/usr/bin/firefox", "/usr/local/bin/firefox", "/snap/bin/firefox"];
    const ffPath = linuxPaths.find(p => fs.existsSync(p)) || "firefox";
    spawnCommand = ffPath;
    spawnArgs = [portalUrl];
  }

  try {
    const child = spawn(spawnCommand, spawnArgs, { detached: true, stdio: 'ignore' });
    child.unref();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: `Could not launch Firefox: ${err.message}` });
  }
});

app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}`),
);

function getActivePython() {
  if (fs.existsSync(PYTHON_PATH)) {
    return PYTHON_PATH;
  }
  return "python";
}