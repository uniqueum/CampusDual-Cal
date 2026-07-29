// app.js

let isChromiumWarningActive = false;
let isVenvMissing = false;

document.addEventListener('DOMContentLoaded', () => {
  checkVenvStatus();
  checkBrowserCompatibility();
  loadConfigurationIntoForm();
  setupFormListeners();
  setupSidebarEngineControls();
});

async function checkVenvStatus() {
  const statusOutput = document.getElementById('statusOutput');

  try {
    const res = await fetch('/api/check-venv');
    const data = await res.json();

    if (!data.venvExists) {
      isVenvMissing = true;
      if (statusOutput) {
        statusOutput.className = 'status-box error';
        statusOutput.innerHTML = `
          <strong>DEPENDENCIES MISSING!</strong><br>
          <span style="font-size: 0.9em; display: block; margin: 4px 0;">Python virtual environment not initialized.</span>
          <button id="btnStrapBoots" class="btn-submit" style="margin-top: 8px; width: 100%; padding: 6px 12px; font-size: 0.9em; background: #ff4757; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Strap the boots!
          </button>
        `;

        const bootsBtn = document.getElementById('btnStrapBoots');
        if (bootsBtn) {
          bootsBtn.onclick = runBootstrapPipeline;
        }
      }
    } else {
      isVenvMissing = false;
    }
  } catch (err) {
    console.error("Failed to check venv status:", err);
  }
}

async function checkBrowserCompatibility() {
  if (isVenvMissing) return;

  const ua = navigator.userAgent;
  const isFirefox = ua.includes("Firefox");

  if (isFirefox) return;

  const statusOutput = document.getElementById('statusOutput');
  if (!statusOutput) return;

  try {
    const res = await fetch('/api/check-firefox');
    const data = await res.json();

    isChromiumWarningActive = true;
    statusOutput.className = 'status-box error';

    if (data.firefoxInstalled) {
      statusOutput.innerHTML = `
        <strong>CHROMIUM BROWSER DETECTED!</strong><br>
        <span style="font-size: 0.9em; display: block; margin: 4px 0;">Chromium locks its database, breaking sync.</span>
        <button id="btnLaunchFirefox" class="btn-submit" style="margin-top: 8px; width: 100%; padding: 6px 12px; font-size: 0.9em; background: #ff4757; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Launch Local Firefox
        </button>
      `;

      const launchBtn = document.getElementById('btnLaunchFirefox');
      if (launchBtn) {
        launchBtn.onclick = async () => {
          try {
            await fetch('/api/launch-firefox', { method: 'POST' });
            isChromiumWarningActive = false;
            statusOutput.className = 'status-box success';
            statusOutput.innerHTML = `<div style="text-align: center;">We are Firefox.<br>All your browser is belong to us!</div>`;
          } catch (err) {
            console.error("Failed to launch Firefox:", err);
          }
        };
      }
    } else {
      statusOutput.innerHTML = `
        <strong>CHROMIUM BROWSER DETECTED!</strong><br>
        <span style="font-size: 0.9em; display: block; margin: 4px 0;">Firefox is required for cookie sync, but wasn't found.</span>
        <a href="https://www.mozilla.org/firefox/" target="_blank" id="btnDownloadFirefox" class="btn-submit" style="display: inline-block; margin-top: 8px; width: 100%; padding: 6px 12px; font-size: 0.9em; background: #ff4757; color: white; text-align: center; text-decoration: none; border-radius: 4px; box-sizing: border-box;">
          Download Mozilla Firefox
        </a>
      `;

      const downloadBtn = document.getElementById('btnDownloadFirefox');
      if (downloadBtn) {
        downloadBtn.onclick = () => {
          setTimeout(() => {
            isChromiumWarningActive = false;
            statusOutput.className = 'status-box success';
            statusOutput.innerHTML = `<strong>We are Firefox, all your browser is belong to us! 🚀</strong>`;
          }, 1500);
        };
      }
    }
  } catch (err) {
    console.error("Failed to check local Firefox installation:", err);
  }
}

function setupSidebarEngineControls() {
  const syncBtn = document.getElementById('btnRunSync');
  const uploadBtn = document.getElementById('btnRunUpload');

  if (syncBtn) syncBtn.onclick = runExecutionPipeline;
  if (uploadBtn) uploadBtn.onclick = runGoogleUploadPipeline;
}

async function loadConfigurationIntoForm() {
  if (isVenvMissing) return;

  try {
    const res = await fetch('/api/config');
    const config = await res.json();

    let hasCoreData = false;

    if (config.campus_dual) {
      const studentIdEl = document.getElementById('studentId');
      const startEl = document.getElementById('startDate');
      const endEl = document.getElementById('endDate');

      if (config.campus_dual.student_id) {
        studentIdEl.value = config.campus_dual.student_id;
      } else {
        studentIdEl.value = '';
      }

      if (startEl) {
        if (config.campus_dual.start_date && config.campus_dual.start_date !== "yyyy-mm-dd") {
          startEl.value = config.campus_dual.start_date;
        } else {
          startEl.value = '';
        }
      }

      if (endEl) {
        if (config.campus_dual.end_date && config.campus_dual.end_date !== "yyyy-mm-dd") {
          endEl.value = config.campus_dual.end_date;
        } else {
          endEl.value = '';
        }
      }

      if (studentIdEl.value && startEl.value && endEl.value) {
        hasCoreData = true;
      }
    }

    if (config.google_calendar && config.google_calendar.calendar_id) {
      document.getElementById('calendarId').value = config.google_calendar.calendar_id;
    } else {
      document.getElementById('calendarId').value = '';
    }

    const statusOutput = document.getElementById('statusOutput');
    if (hasCoreData && statusOutput && !isChromiumWarningActive && !isVenvMissing) {
      statusOutput.className = 'status-box success';
      statusOutput.innerHTML = `<strong>CONFIG READY!</strong><br>Core parameters loaded.`;
    }

  } catch (err) {
    console.error("Error loading configuration:", err);
  }
}

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
    if (isVenvMissing) return;
    const calId = document.getElementById('calendarId').value.trim();

    const payload = {
      campus_dual: {
        student_id: document.getElementById('studentId').value.trim(),
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
            if (!isChromiumWarningActive && !isVenvMissing && statusOutput) {
              statusOutput.className = 'status-box success';
              statusOutput.innerHTML = `<strong>SUCCESS!</strong><br>Configuration saved.`;
            }
            renderDashboardView();
            setTimeout(() => {
              initializeLocalCalendarView();
            }, 50);
          } else {
            throw new Error(data.error || "Unknown server error");
          }
        })
        .catch(err => {
          const statusOutput = document.getElementById('statusOutput');
          if (!isChromiumWarningActive && !isVenvMissing && statusOutput) {
            statusOutput.className = 'status-box error';
            statusOutput.textContent = `Error: ${err.message}`;
          }
        });
  });
}

function renderDashboardView() {
  const mainWorkspace = document.getElementById('mainWorkspace');
  const template = document.getElementById('authenticatedDashboard');
  if (!mainWorkspace || !template) return;

  mainWorkspace.innerHTML = '';
  const dash = document.createElement('div');
  dash.id = 'dashboardView';
  dash.appendChild(template.content.cloneNode(true));
  mainWorkspace.appendChild(dash);
}

async function runExecutionPipeline() {
  if (isVenvMissing) return;
  const statusOutput = document.getElementById('statusOutput');
  const terminalConsole = document.getElementById('terminalConsole');
  const terminalLines = document.getElementById('terminalLines');

  if (terminalConsole) terminalConsole.style.display = 'block';
  if (terminalLines) terminalLines.textContent = '';
  if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
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

    if (
        accumulatedLogs.includes('401') ||
        accumulatedLogs.includes('Unauthorized') ||
        accumulatedLogs.includes('Failed to extract cookies') ||
        accumulatedLogs.includes('AUTH_MISSING') ||
        accumulatedLogs.includes('Configuration Error') ||
        accumulatedLogs.includes('Error:') ||
        accumulatedLogs.includes('Traceback')
    ) {
      if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
        statusOutput.className = 'status-box error';

        if (
            accumulatedLogs.includes('401') ||
            accumulatedLogs.includes('Unauthorized') ||
            accumulatedLogs.includes('Failed to extract cookies') ||
            accumulatedLogs.includes('AUTH_MISSING')
        ) {
          statusOutput.innerHTML = `
            <strong>NOT LOGGED IN!</strong><br>
            <span style="font-size: 0.9em; display: block; margin: 4px 0;">You don't have cookies currently, please log into campus dual.</span>
            <a href="https://selfservice.campus-dual.de/portal?sap-client=100&sap-language=DE#Shell-home" target="_blank" class="btn-submit" style="display: inline-block; margin-top: 8px; width: 100%; padding: 6px 12px; font-size: 0.9em; background: #ff4757; color: white; text-align: center; text-decoration: none; border-radius: 4px; box-sizing: border-box;">
              🔑 Log in to Campus-Dual
            </a>
          `;
        } else {
          statusOutput.innerHTML = `<strong>SYNC FAILED:</strong> Check terminal output for details.`;
        }
      }
    } else {
      if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
        statusOutput.className = 'status-box success';
        statusOutput.innerHTML = `<strong>SYNC COMPLETE!</strong>`;
      }
      if (activeCalendar) {
        activeCalendar.refetchEvents();
      }
    }
  } catch (err) {
    if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
      statusOutput.className = 'status-box error';
      statusOutput.innerHTML = `<strong>SYNC FAILED:</strong> ${err.message}`;
    }
  }
}

async function runGoogleUploadPipeline() {
  if (isVenvMissing) return;
  const statusOutput = document.getElementById('statusOutput');
  const check = await fetch('/api/check-google-ready').then(r => r.json());

  if (!check.ready) {
    if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
      statusOutput.className = 'status-box error';
      statusOutput.innerHTML = `<strong>ERROR:</strong><br>${check.error}`;
    }
    return;
  }

  const terminalConsole = document.getElementById('terminalConsole');
  const terminalLines = document.getElementById('terminalLines');
  if (terminalConsole) terminalConsole.style.display = 'block';
  if (terminalLines) terminalLines.textContent = '';
  if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
    statusOutput.className = 'status-box';
    statusOutput.innerHTML = `<strong>UPLOADING...</strong>`;
  }

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
    if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
      statusOutput.innerHTML = `<strong>UPLOAD COMPLETE!</strong>`;
    }
  } catch (err) {
    if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
      statusOutput.innerHTML = `<strong>UPLOAD FAILED:</strong> ${err.message}`;
    }
  }
}

async function runBootstrapPipeline() {
  const statusOutput = document.getElementById('statusOutput');
  const terminalConsole = document.getElementById('terminalConsole');
  const terminalLines = document.getElementById('terminalLines');

  if (terminalConsole) terminalConsole.style.display = 'block';
  if (terminalLines) terminalLines.textContent = '';
  if (statusOutput) {
    statusOutput.className = 'status-box';
    statusOutput.innerHTML = `<strong>BOOTSTRAPPING DEPENDENCIES...</strong>`;
  }

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

    isVenvMissing = false;

    if (statusOutput) {
      statusOutput.className = 'status-box success';
      statusOutput.innerHTML = `<strong>BOOTSTRAP COMPLETE!</strong><br>Reloading environment...`;
    }

    setTimeout(() => {
      location.reload();
    }, 1500);

  } catch (err) {
    if (statusOutput) {
      statusOutput.className = 'status-box error';
      statusOutput.innerHTML = `<strong>BOOTSTRAP FAILED:</strong> ${err.message}`;
    }
  }
}

let activeCalendar = null;

async function initializeLocalCalendarView() {
  if (isVenvMissing) return;
  const statusOutput = document.getElementById('statusOutput');
  const canvas = document.getElementById('calendarCanvas');
  const frame = document.getElementById('calendarDisplayFrame');

  if (!canvas) {
    console.error("Calendar canvas element not found in DOM.");
    return;
  }

  if (frame) {
    frame.classList.remove('hidden');
    frame.style.display = 'block';
  }
  if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
    statusOutput.innerHTML = `<strong>LOADING CALENDAR...</strong>`;
  }

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
        if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
          statusOutput.className = 'status-box success';
          statusOutput.innerHTML = `<strong>SUCCESS!</strong><br>Loaded ${eventCount} entries.`;
        }
        if (frame) frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    eventSourceFailure: function() {
      if (statusOutput && !isChromiumWarningActive && !isVenvMissing) {
        statusOutput.className = 'status-box error';
        statusOutput.innerHTML = `
          <strong>NOT LOGGED IN!</strong><br>
          <span style="font-size: 0.9em; display: block; margin: 4px 0;">You don't have cookies currently, please log into campus dual.</span>
          <a href="https://selfservice.campus-dual.de/portal?sap-client=100&sap-language=DE#Shell-home" target="_blank" class="btn-submit" style="display: inline-block; margin-top: 8px; width: 100%; padding: 6px 12px; font-size: 0.9em; background: #ff4757; color: white; text-align: center; text-decoration: none; border-radius: 4px; box-sizing: border-box;">
            🔑 Log in to Campus-Dual
          </a>
        `;
      }
    }
  });

  activeCalendar.render();

  setTimeout(() => {
    const eventCount = activeCalendar.getEvents().length;
    if (eventCount > 0 && statusOutput && !isChromiumWarningActive && !isVenvMissing && statusOutput.innerHTML.includes("LOADING")) {
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