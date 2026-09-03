# main.py

import sys
import os
import shutil

# 1. Force the working directory to the folder containing this script
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

# 2. Force UTF-8 immediately so printing warning/status emojis never triggers charmap errors on Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import subprocess
import json
from datetime import datetime

CONFIG_FILE = "config.json"

def bootstrap():
    """Delegates the environment setup and dependency verification to bootstrap.py."""
    bootstrap_script = os.path.join(script_dir, "bootstrap.py")
    if os.path.exists(bootstrap_script):
        print("🥾 Delegating to external bootstrap.py...", flush=True)
        subprocess.check_call([sys.executable, bootstrap_script] + sys.argv[2:])
    else:
        raise FileNotFoundError(f"Missing required bootstrap script: '{bootstrap_script}' not found.")


def load_global_config():
    """Reads execution variables from config.json."""
    if not os.path.exists(CONFIG_FILE):
        raise FileNotFoundError(f"Missing required configuration: '{CONFIG_FILE}' not found.")

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)

    cd_config = config.get("campus_dual", {})
    return {
        "student_id": cd_config.get("student_id"),
        "start_date": cd_config.get("start_date", "2026-04-20"),
        "end_date": cd_config.get("end_date", "2026-07-12")
    }


def main():
    print("--- PYTHON DIAGNOSTIC CHECK ---", flush=True)
    print("Current Working Directory:", os.getcwd(), flush=True)
    print("Script Directory:", script_dir, flush=True)
    print("Python Executable:", sys.executable, flush=True)
    print("sys.path:", sys.path, flush=True)
    print("Files in script directory:", os.listdir(script_dir), flush=True)
    print("-------------------------------", flush=True)

    # Force UTF-8 output encoding for terminal streams on Windows to prevent charmap errors
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')

    # Support mode arguments (e.g., python main.py bootstrap, sync-only, etc.)
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"

    if mode == "bootstrap":
        bootstrap()
        return

    # A) Lazy-load local and third-party modules ONLY when NOT bootstrapping.
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)

    global get_authenticated_session, token_helper, fetcher, processor, uploader
    from auth import get_authenticated_session
    import sap_token as token_helper
    import sync_calendar as fetcher
    import processor
    import uploader

    print("Initializing DHSN-Cal Orchestrator...", flush=True)

    # 1. Load Global Config Variables
    try:
        config = load_global_config()
        print(f"Loaded config for User: {config['student_id']} using browser: firefox", flush=True)
    except Exception as e:
        print(f"❌ Configuration Error: {e}", flush=True)
        return

    # If user only wanted to fetch/sync locally via web app button
    if mode == "sync-only" or mode == "fetch":
        try:
            print("Extracting session cookies and initializing session...", flush=True)
            session = get_authenticated_session(browser_name="firefox")

            print(f"Fetching timetable from {config['start_date']} to {config['end_date']}...", flush=True)
            csrf_token = token_helper.get_csrf_token(session)

            start_dt = datetime.strptime(config["start_date"], "%Y-%m-%d")
            end_dt = datetime.strptime(config["end_date"], "%Y-%m-%d")

            fetcher.fetch_campus_dual_timetable(session, csrf_token, start_dt, end_dt)

            print("Data fetch step reached and dumped successfully.", flush=True)

            print("Running text processor...", flush=True)
            processor.main()
            print("\n✨ Local sync & processing complete!", flush=True)
        except token_helper.AuthRequiredError as e:
            print(f"❌ Sync Error: {e}", flush=True)
            print("AUTH_MISSING", flush=True)
        except Exception as e:
            print(f"❌ Sync Error: {e}", flush=True)
        return

    # 2. Authenticate Session via Browser Cookies (for full run)
    try:
        print("Extracting session cookies and initializing session...", flush=True)
        session = get_authenticated_session(browser_name="firefox")
    except Exception as e:
        print(f"❌ Authentication Error: {e}", flush=True)
        return

    # 3. Fetch Timetable Data
    try:
        print(f"Fetching timetable from {config['start_date']} to {config['end_date']}...", flush=True)

        print("Fetching SAP OData CSRF token...", flush=True)
        csrf_token = token_helper.get_csrf_token(session)

        start_dt = datetime.strptime(config["start_date"], "%Y-%m-%d")
        end_dt = datetime.strptime(config["end_date"], "%Y-%m-%d")

        fetcher.fetch_campus_dual_timetable(session, csrf_token, start_dt, end_dt)

        print("Data fetch step reached and dumped successfully.", flush=True)
    except token_helper.AuthRequiredError as e:
        print(f"❌ Fetch Error: {e}", flush=True)
        print("AUTH_MISSING", flush=True)
        return
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