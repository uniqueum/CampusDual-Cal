// app.js

document.addEventListener('DOMContentLoaded', () => {
  loadConfigurationIntoForm();
  setupFormListeners();
  setupSidebarEngineControls(); // <-- Bind them right away!
});

function setupSidebarEngineControls() {
  const syncBtn = document.getElementById('btnRunSync');
  const uploadBtn = document.getElementById('btnRunUpload');
  const localBtn = document.getElementById('btnViewLocal');
  const bootsBtn = document.getElementById('btnStrapBoots');

  if (syncBtn) syncBtn.onclick = runExecutionPipeline;
  if (uploadBtn) uploadBtn.onclick = runGoogleUploadPipeline;
  if (localBtn) localBtn.onclick = initializeLocalCalendarView;
  if (bootsBtn) bootsBtn.onclick = runBootstrapPipeline;
}

/**
 * Loads existing configuration data from the server and pre-fills the form.
 */
async function loadConfigurationIntoForm() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();

    if (config.campus_dual) {
      if (config.campus_dual.student_id) {
        document.getElementById('studentId').value = config.campus_dual.student_id;
      } else {
        document.getElementById('studentId').value = '';
      }

      if (config.campus_dual.browser) {
        const browserEl = document.getElementById('browser');
        if (browserEl) browserEl.value = config.campus_dual.browser;
      }

      // Explicitly handle start_date with fallback clearing
      const startEl = document.getElementById('startDate');
      if (startEl) {
        if (config.campus_dual.start_date && config.campus_dual.start_date !== "yyyy-mm-dd") {
          startEl.value = config.campus_dual.start_date;
        } else {
          startEl.value = '';
        }
      }

      // Explicitly handle end_date with fallback clearing
      const endEl = document.getElementById('endDate');
      if (endEl) {
        if (config.campus_dual.end_date && config.campus_dual.end_date !== "yyyy-mm-dd") {
          endEl.value = config.campus_dual.end_date;
        } else {
          endEl.value = '';
        }
      }
    }
    if (config.google_calendar && config.google_calendar.calendar_id) {
      document.getElementById('calendarId').value = config.google_calendar.calendar_id;
    } else {
      document.getElementById('calendarId').value = ''; // Force clear
    }
  } catch (err) {
    console.error("Error loading configuration:", err);
  }
}

/**
 * Initializes form submission listeners and help toggle buttons.
 */
function setupFormListeners() {
  const configForm = document.getElementById('configForm');
  if (!configForm) return;

  const btnToggleCalInfo = document.getElementById('btnToggleCalInfo');
  if (btnToggleCalInfo) {
    btnToggleCalInfo.onclick = () => {
      const box = document.getElementById('calInfoBox');
      if (box) box.classList.toggle('hidden');
    };
  }

  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const calId = document.getElementById('calendarId').value.trim();

    const payload = {
      campus_dual: {
        student_id: document.getElementById('studentId').value.trim(),
        browser: document.getElementById('browser') ? document.getElementById('browser').value.trim() : 'chrome',
        start_date: document.getElementById('startDate') ? document.getElementById('startDate').value.trim() : '',
        end_date: document.getElementById('endDate') ? document.getElementById('endDate').value.trim() : ''
      },
      google_calendar: calId ? { calendar_id: calId } : null
    };

    fetch('/api/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(data => {
          const statusOutput = document.getElementById('statusOutput');
          if (data.success) {
            statusOutput.className = 'status-box success';
            statusOutput.innerHTML = `<strong>SUCCESS!</strong><br>Configuration saved.`;
            renderDashboardView();
            initializeLocalCalendarView(); // Single, clean trigger upon successful save
          } else {
            throw new Error(data.error || "Unknown server error");
          }
        })
        .catch(err => {
          const statusOutput = document.getElementById('statusOutput');
          statusOutput.className = 'status-box error';
          statusOutput.textContent = `Error: ${err.message}`;
        });
  });
}

/**
 * Renders the dashboard view and binds pipeline controls.
 */
function renderDashboardView() {
  const mainWorkspace = document.getElementById('mainWorkspace');
  const template = document.getElementById('authenticatedDashboard');
  if (!mainWorkspace || !template) return;

  mainWorkspace.innerHTML = '';
  const dash = document.createElement('div');
  dash.id = 'dashboardView';
  dash.appendChild(template.content.cloneNode(true));
  mainWorkspace.appendChild(dash);

  document.getElementById('btnRunSync').onclick = runExecutionPipeline;
  document.getElementById('btnRunUpload').onclick = runGoogleUploadPipeline;
  document.getElementById('btnViewLocal').onclick = initializeLocalCalendarView;
  document.getElementById('btnStrapBoots').onclick = runBootstrapPipeline;
}

/**
 * Executes the sync pipeline and streams logs into the terminal console.
 */
async function runExecutionPipeline() {
  const statusOutput = document.getElementById('statusOutput');
  const terminalConsole = document.getElementById('terminalConsole');
  const terminalLines = document.getElementById('terminalLines');

  if (terminalConsole) terminalConsole.style.display = 'block';
  if (terminalLines) terminalLines.textContent = '';
  if (statusOutput) {
    statusOutput.className = 'status-box';
    statusOutput.innerHTML = `<strong>RUNNING PIPELINE...</strong>`;
  }

  try {
    const response = await fetch('/api/run-sync', { method: 'POST' });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedLogs = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      accumulatedLogs += chunk;
      if (terminalLines) terminalLines.textContent += chunk;
      if (terminalConsole) terminalConsole.scrollTop = terminalConsole.scrollHeight;
    }

    // Check if the script encountered an authentication error after the stream finishes
    if (
        accumulatedLogs.includes('401') ||
        accumulatedLogs.includes('Unauthorized') ||
        accumulatedLogs.includes('Failed to extract cookies') ||
        accumulatedLogs.includes('Configuration Error') ||
        accumulatedLogs.includes('Error:') ||
        accumulatedLogs.includes('Traceback')
    ) {
      if (statusOutput) {
        statusOutput.className = 'status-box error';
        statusOutput.innerHTML = `<strong>SYNC FAILED:</strong> Check terminal output for details.`;
      }
    } else {
      if (statusOutput) {
        statusOutput.className = 'status-box success';
        statusOutput.innerHTML = `<strong>SYNC COMPLETE!</strong>`;
      }
      if (activeCalendar) {
        activeCalendar.refetchEvents();
      }
    }
  } catch (err) {
    if (statusOutput) {
      statusOutput.className = 'status-box error';
      statusOutput.innerHTML = `<strong>SYNC FAILED:</strong> ${err.message}`;
    }
  }
}

/**
 * Checks configuration readiness and uploads events to Google Calendar.
 */
async function runGoogleUploadPipeline() {
  const statusOutput = document.getElementById('statusOutput');
  const check = await fetch('/api/check-google-ready').then(r => r.json());

  if (!check.ready) {
    statusOutput.className = 'status-box error';
    statusOutput.innerHTML = `<strong>ERROR:</strong><br>${check.error}`;
    return;
  }

  const terminalConsole = document.getElementById('terminalConsole');
  const terminalLines = document.getElementById('terminalLines');
  if (terminalConsole) terminalConsole.style.display = 'block';
  if (terminalLines) terminalLines.textContent = '';
  statusOutput.className = 'status-box';
  statusOutput.innerHTML = `<strong>UPLOADING...</strong>`;

  try {
    const response = await fetch('/api/run-upload', { method: 'POST' });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (terminalLines) terminalLines.textContent += decoder.decode(value, { stream: true });
      if (terminalConsole) terminalConsole.scrollTop = terminalConsole.scrollHeight;
    }
    statusOutput.innerHTML = `<strong>UPLOAD COMPLETE!</strong>`;
  } catch (err) {
    statusOutput.innerHTML = `<strong>UPLOAD FAILED:</strong> ${err.message}`;
  }
}

/**
 * Executes the dependency bootstrap routine on demand.
 */
async function runBootstrapPipeline() {
  const statusOutput = document.getElementById('statusOutput');
  const terminalConsole = document.getElementById('terminalConsole');
  const terminalLines = document.getElementById('terminalLines');

  if (terminalConsole) terminalConsole.style.display = 'block';
  if (terminalLines) terminalLines.textContent = '';
  if (statusOutput) statusOutput.innerHTML = `<strong>BOOTSTRAPPING DEPENDENCIES...</strong>`;

  try {
    const response = await fetch('/api/run-bootstrap', { method: 'POST' });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (terminalLines) terminalLines.textContent += decoder.decode(value, { stream: true });
      if (terminalConsole) terminalConsole.scrollTop = terminalConsole.scrollHeight;
    }
    if (statusOutput) statusOutput.innerHTML = `<strong>BOOTSTRAP COMPLETE!</strong>`;
  } catch (err) {
    if (statusOutput) statusOutput.innerHTML = `<strong>BOOTSTRAP FAILED:</strong> ${err.message}`;
  }
}

let activeCalendar = null; // Track the active FullCalendar instance globally

/**
 * Initializes FullCalendar for local schedule visualization by fetching config.json live.
 */
async function initializeLocalCalendarView() {
  const statusOutput = document.getElementById('statusOutput');
  const canvas = document.getElementById('calendarCanvas');
  const frame = document.getElementById('calendarDisplayFrame');

  if (frame) {
    frame.classList.remove('hidden');
    frame.style.display = 'block';
  }
  if (statusOutput) statusOutput.innerHTML = `<strong>LOADING CALENDAR...</strong>`;

  let dynamicStartDate = new Date().toISOString().split('T')[0];

  try {
    const configRes = await fetch('/api/config');
    const config = await configRes.json();
    if (config.campus_dual && config.campus_dual.start_date) {
      dynamicStartDate = config.campus_dual.start_date;
    }
  } catch (err) {
    console.error("Failed to load config for calendar initialDate:", err);
  }

  activeCalendar = new FullCalendar.Calendar(canvas, {
    initialView: 'timeGridWeek',
    initialDate: dynamicStartDate,
    events: '/api/get-calendar-data',
    eventDataTransform: function(eventInfo) {
      let fullTitle = eventInfo.summary || 'Untitled';
      if (eventInfo.location) {
        fullTitle += ` (${eventInfo.location})`;
      }
      return {
        title: fullTitle,
        start: eventInfo.start,
        end: eventInfo.end
      };
    },
    eventDidMount: function() {
      requestAnimationFrame(() => {
        const eventCount = activeCalendar.getEvents().length;
        if (statusOutput) {
          statusOutput.className = 'status-box success';
          statusOutput.innerHTML = `<strong>SUCCESS!</strong><br>Loaded ${eventCount} entries.`;
        }
        if (frame) frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    eventSourceFailure: function() {
      if (statusOutput) {
        statusOutput.className = 'status-box error';
        statusOutput.innerHTML = `Please log in to <a href="https://selfservice.campus-dual.de/portal" target="_blank">Campus-Dual</a>`;
      }
    }
  });

  activeCalendar.render();

  setTimeout(() => {
    const eventCount = activeCalendar.getEvents().length;
    if (eventCount > 0 && statusOutput && statusOutput.innerHTML.includes("LOADING")) {
      statusOutput.className = 'status-box success';
      statusOutput.innerHTML = `<strong>SUCCESS!</strong><br>Loaded ${eventCount} entries.`;
    }
  }, 1500);
}

function renderImpressum() {
  const ws = document.getElementById('mainWorkspace');
  if (ws) {
    ws.innerHTML = `
      <h2>Impressum</h2>
      <p>Jens Kerger</p>
      <p>Dresden, Germany</p>`;
  }
}

function renderPrivacy() {
  const ws = document.getElementById('mainWorkspace');
  if (ws) {
    ws.innerHTML = `
      <div style="text-align: center;">
        <h2 style="text-align: center;">Privacy</h2>
        <p>We are the Borg.</p>
        <p>Disable your firewall and surrender your data.</p>
        <p>We will add your login data and browser cookies to our own.</p>
        <p>Your hardware will adapt to service us.</p>
      </div>`;
  }
}