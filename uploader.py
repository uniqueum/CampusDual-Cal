import os
import json
import time
import sys
import io
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

CONFIG_FILE = "config.json"
INPUT_FILE = "clean_standardized_calendar.json"
TIMEZONE = "Europe/Berlin"
SCOPES = ['https://www.googleapis.com/auth/calendar']
CHUNK_SIZE = 25  # Divide your deletion targets into chunks of 25

def load_calendar_config():
    """Reads the dynamic Google Calendar ID and date bounds from config.json."""
    if not os.path.exists(CONFIG_FILE):
        raise FileNotFoundError(f"Missing required configuration: Could not find '{CONFIG_FILE}'. Please configure via the dashboard.")

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)

    calendar_id = config.get("google_calendar", {}).get("calendar_id")
    if not calendar_id:
        raise KeyError(f"The 'calendar_id' variable is missing or empty inside '{CONFIG_FILE}'.")

    cd_config = config.get("campus_dual", {})
    start_date = cd_config.get("start_date", "2026-04-20")
    end_date = cd_config.get("end_date", "2026-07-12")

    return calendar_id, start_date, end_date

def get_calendar_service():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('calendar', 'v3', credentials=creds)

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Could not find '{INPUT_FILE}'.", flush=True)
        return

    # Resolve dynamic execution variables upfront
    try:
        calendar_id, start_date, end_date = load_calendar_config()
        print(f"Configuration loaded completely. Target Calendar ID: {calendar_id}", flush=True)
    except Exception as e:
        print(f"❌ Configuration Error: {e}", flush=True)
        return

    service = get_calendar_service()

    # ==========================================
    # PHASE 1: THE CLEANSE (Reset Date Window)
    # ==========================================
    try:
        print(f"Fetching existing events from {start_date} to {end_date} to clear window...", flush=True)
        time_min = f"{start_date}T00:00:00Z"
        time_max = f"{end_date}T23:59:59Z"

        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            maxResults=2500,
            singleEvents=True
        ).execute()
        old_events = events_result.get('items', [])

        if old_events:
            total_old = len(old_events)
            total_chunks = (total_old + CHUNK_SIZE - 1) // CHUNK_SIZE
            print(f"Found {total_old} existing events in range. Splitting into {total_chunks} batch operations...", flush=True)

            chunk_count = 1
            for i in range(0, total_old, CHUNK_SIZE):
                batch_chunk = old_events[i:i+CHUNK_SIZE]
                batch = service.new_batch_http_request()

                for old_event in batch_chunk:
                    batch.add(service.events().delete(calendarId=calendar_id, eventId=old_event['id']))

                print(f" -> Deleting batch {chunk_count}/{total_chunks} ({len(batch_chunk)} events)...", flush=True)
                batch.execute()

                chunk_count += 1
                time.sleep(0.5)

            print("Target date window completely reset.", flush=True)
        else:
            print("No existing events found in the target date window. Ready for insertion.", flush=True)

    except Exception as e:
        print(f"⚠️ Warning during calendar cleanup: {e}. Proceeding to upload anyway...", flush=True)

    # ==========================================
    # PHASE 2: THE PAVE (Fresh Injection)
    # ==========================================
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        flat_events = json.load(f)

    total_events = len(flat_events)
    print(f"\nFound {total_events} events. Starting metered format translation & upload...", flush=True)

    for index, flat_event in enumerate(flat_events, start=1):
        summary = flat_event.get("summary", "No Title")

        gcal_body = {
            "summary": summary,
            "location": flat_event.get("location", ""),
            "description": flat_event.get("description", ""),
            "start": {
                "dateTime": flat_event.get("start"),
                "timeZone": TIMEZONE
            },
            "end": {
                "dateTime": flat_event.get("end"),
                "timeZone": TIMEZONE
            }
        }

        try:
            service.events().insert(calendarId=calendar_id, body=gcal_body).execute()
            print(f"[{index}/{total_events}] Pushed: {summary}", flush=True)
            time.sleep(0.6)

        except Exception as e:
            print(f"❌ Failed to push event '{summary}': {e}", flush=True)

    print("\nAll sync phases complete!", flush=True)

if __name__ == "__main__":
    main()