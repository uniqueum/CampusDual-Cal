# main.py

import subprocess
import sys

# Force UTF-8 immediately so printing warning/status emojis never triggers charmap errors on Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import subprocess

def auto_bootstrap():
    # Map import names to their actual PyPI package names
    package_mapping = {
        "requests": "requests",
        "bs4": "beautifulsoup4",
        "googleapiclient": "google-api-python-client",
        "google_auth_oauthlib": "google-auth-oauthlib",
        "urllib3": "urllib3"
    }

    try:
        import importlib.metadata
        missing = []
        for mod_name, pkg_name in package_mapping.items():
            try:
                importlib.metadata.version(pkg_name)
            except importlib.metadata.PackageNotFoundError:
                missing.append(pkg_name)

        if missing:
            print(f"📦 Auto-installing missing dependencies: {missing}...", flush=True)
            subprocess.check_call([sys.executable, "-m", "pip", "install", *missing], stdout=sys.stdout, stderr=sys.stderr)
        else:
            print("✅ All dependencies verified.", flush=True)
    except Exception as e:
        print(f"⚠️ Warning: Could not verify packages automatically: {e}", flush=True)


import os
import json
import sys
from datetime import datetime
from auth import get_authenticated_session
import sap_token as token_helper
import sync_calendar as fetcher
import processor
import uploader

CONFIG_FILE = "config.json"

def load_global_config():
    """Reads execution variables from config.json."""
    if not os.path.exists(CONFIG_FILE):
        raise FileNotFoundError(f"Missing required configuration: '{CONFIG_FILE}' not found.")

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)

    cd_config = config.get("campus_dual", {})
    return {
        "student_id": cd_config.get("student_id"),
        "browser": cd_config.get("browser", "chrome"),
        "start_date": cd_config.get("start_date", "2026-04-20"),
        "end_date": cd_config.get("end_date", "2026-07-12")
    }

def main():
    # Force UTF-8 output encoding for terminal streams on Windows to prevent charmap errors
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')

    # Support mode arguments (e.g., python main.py fetch or python main.py upload)
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"

    if mode == "bootstrap":
        print("🥾 Starting dependency bootstrap routine...", flush=True)
        auto_bootstrap()
        print("\n✨ Bootstrap check complete!", flush=True)
        return

    print("Initializing DHSN-Cal Orchestrator...", flush=True)

    print("Initializing DHSN-Cal Orchestrator...", flush=True)

    # 1. Load Global Config Variables
    try:
        config = load_global_config()
        print(f"Loaded config for User: {config['student_id']} using browser: {config['browser']}", flush=True)
    except Exception as e:
        print(f"❌ Configuration Error: {e}", flush=True)
        return

    # If user only wanted to fetch/sync locally via web app button
    if mode == "sync-only" or mode == "fetch":
        try:
            print("Extracting session cookies and initializing session...", flush=True)
            session = get_authenticated_session(browser_name=config["browser"])

            print(f"Fetching timetable from {config['start_date']} to {config['end_date']}...", flush=True)
            csrf_token = token_helper.get_csrf_token(session)

            start_dt = datetime.strptime(config["start_date"], "%Y-%m-%d")
            end_dt = datetime.strptime(config["end_date"], "%Y-%m-%d")

            # Call fetcher to write campus_dual_dump.html directly (no JSON dump)
            fetcher.fetch_campus_dual_timetable(session, csrf_token, start_dt, end_dt)

            print("Data fetch step reached and dumped successfully.", flush=True)

            print("Running text processor...", flush=True)
            processor.main()
            print("\n✨ Local sync & processing complete!", flush=True)
        except Exception as e:
            print(f"❌ Sync Error: {e}", flush=True)
        return

    # 2. Authenticate Session via Browser Cookies (for full run)
    try:
        print("Extracting session cookies and initializing session...", flush=True)
        session = get_authenticated_session(browser_name=config["browser"])
    except Exception as e:
        print(f"❌ Authentication Error: {e}", flush=True)
        return

    # 3. Fetch Timetable Data (Passing session, token, and dynamic dates)
    try:
        print(f"Fetching timetable from {config['start_date']} to {config['end_date']}...", flush=True)

        print("Fetching SAP OData CSRF token...", flush=True)
        csrf_token = token_helper.get_csrf_token(session)

        start_dt = datetime.strptime(config["start_date"], "%Y-%m-%d")
        end_dt = datetime.strptime(config["end_date"], "%Y-%m-%d")

        # Invoke the fetcher correctly so it generates campus_dual_dump.html
        fetcher.fetch_campus_dual_timetable(session, csrf_token, start_dt, end_dt)

        print("Data fetch step reached and dumped successfully.", flush=True)
    except Exception as e:
        print(f"❌ Fetch Error: {e}", flush=True)
        return

    # 4. Process Raw Data into Clean Standardized Format
    try:
        print("Running text processor...", flush=True)
        processor.main()
    except Exception as e:
        print(f"❌ Processor Error: {e}", flush=True)
        return

    # 5. Sync to Google Calendar
    try:
        print("Pushing updates to Google Calendar...", flush=True)
        uploader.main()
    except Exception as e:
        print(f"❌ Uploader Error: {e}", flush=True)
        return

    print("\n✨ Pipeline execution complete!", flush=True)

if __name__ == "__main__":
    main()