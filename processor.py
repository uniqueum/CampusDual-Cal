import json
import re
import os
import uuid
from datetime import datetime
from bs4 import BeautifulSoup

INPUT_FILE = "campus_dual_dump.html"
OUTPUT_JSON = "clean_standardized_calendar.json"
OUTPUT_ICS = "campus_dual_schedule.ics"

def parse_title_times(title):
    """Extracts custom timeframe from edge-case titles."""
    range_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?', title)
    if range_match:
        sh = int(range_match.group(1))
        sm = int(range_match.group(2)) if range_match.group(2) else 0
        eh = int(range_match.group(3))
        em = int(range_match.group(4)) if range_match.group(4) else 0
        return sh, sm, eh, em

    single_match = re.search(r'(\d{1,2}):(\d{2})', title)
    if single_match:
        sh = int(single_match.group(1))
        sm = int(single_match.group(2))
        eh = sh + 1
        em = sm + 30
        if em >= 60:
            eh += 1
            em -= 60
        return sh, sm, eh, em
    return None

def format_ics_datetime(dt):
    """Formats a datetime object to UTC string as required by iCalendar specs."""
    return dt.strftime('%Y%m%dT%H%M%S')

def escape_ics_text(text):
    """Escapes special characters reserved in RFC 5545."""
    if not text:
        return ""
    return text.replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\n', '\\n')

def generate_ics_content(events_list):
    """Generates valid RFC 5545 iCalendar standard string from event entries."""
    now_stamp = datetime.now().strftime('%Y%m%dT%H%M%SZ')

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//DHSN-Cal Script//CampusDual Exporter//DE",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH"
    ]

    for ev in events_list:
        # Generate unique UID based on event identity to ensure predictable updates
        start_dt = datetime.fromisoformat(ev['start'])
        end_dt = datetime.fromisoformat(ev['end'])

        uid = f"{format_ics_datetime(start_dt)}-{hash(ev['summary'])}@dhsn-cal.local"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now_stamp}",
            f"DTSTART:{format_ics_datetime(start_dt)}",
            f"DTEND:{format_ics_datetime(end_dt)}",
            f"SUMMARY:{escape_ics_text(ev['summary'])}",
            f"LOCATION:{escape_ics_text(ev['location'])}",
            f"DESCRIPTION:{escape_ics_text(ev['description'])}",
            "END:VEVENT"
        ])

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Could not find '{INPUT_FILE}'.")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'html.parser')
    tables = soup.find_all('table', class_='Plan')

    time_slots = {
        1: ("07:45", "09:15"),
        2: ("09:45", "11:15"),
        3: ("11:45", "13:15"),
        4: ("13:45", "15:15"),
        5: ("15:30", "17:00"),
        6: ("17:15", "18:45"),
        7: ("19:00", "20:15")
    }

    events = []

    for table in tables:
        caption = table.find('caption')
        if not caption:
            continue

        caption_text = caption.get_text()
        header_row = table.find('tr')
        if not header_row:
            continue

        th_cols = header_row.find_all('th')
        col_dates = {}
        for idx, th in enumerate(th_cols):
            tooltip = th.get('data-tooltip')
            if tooltip:
                year_match = re.search(r'(\d{4})', caption_text)
                year = year_match.group(1) if year_match else str(datetime.now().year)

                try:
                    parsed_date = datetime.strptime(f"{tooltip}.{year}", "%d.%b.%Y")
                    col_dates[idx] = parsed_date.strftime('%Y-%m-%d')
                except ValueError:
                    try:
                        col_dates[idx] = datetime.strptime(f"{tooltip}.{year}", "%d.%B.%Y").strftime('%Y-%m-%d')
                    except Exception:
                        pass

        rows = table.find_all('tr')[1:]
        row_spans = {}

        for row_idx, row in enumerate(rows):
            th_time = row.find('th', class_='zeit')
            if not th_time:
                continue

            slot_match = re.search(r'^(\d+)\.', th_time.get_text())
            if not slot_match:
                continue

            slot_num = int(slot_match.group(1))
            default_start_str, default_end_str = time_slots.get(slot_num, ("00:00", "00:00"))

            day_cells = row.find_all('td')
            cell_pointer = 0
            col_cursor = 1
            max_day_cols = 5

            while col_cursor <= max_day_cols:
                if row_spans.get(col_cursor, 0) > 0:
                    row_spans[col_cursor] -= 1
                    col_cursor += 1
                    continue

                if cell_pointer >= len(day_cells):
                    break

                cell = day_cells[cell_pointer]
                cell_pointer += 1

                date_str = col_dates.get(col_cursor)
                fach_spans = cell.find_all('span', class_='fach')

                if fach_spans and date_str:
                    dozent_spans = cell.find_all('span', class_='dozent')
                    ort_spans = cell.find_all('span', class_='ort')
                    bemerkung_spans = cell.find_all('span', class_='bemerkung')

                    rowspan = int(cell.get('rowspan', 1))
                    end_slot_num = slot_num + rowspan - 1
                    _, active_end_str = time_slots.get(end_slot_num, (default_end_str, default_end_str))

                    if rowspan > 1:
                        for span_i in range(1, rowspan):
                            row_spans[col_cursor + span_i - 1] = row_spans.get(col_cursor + span_i - 1, 0) + 1

                    for idx_sub, fach_span in enumerate(fach_spans):
                        title = fach_span.get_text().strip()
                        instructor = dozent_spans[idx_sub].get_text().strip() if idx_sub < len(dozent_spans) else "Ohne"
                        room_field = ort_spans[idx_sub].get_text().strip() if idx_sub < len(ort_spans) else "Ohne"

                        if idx_sub < len(bemerkung_spans) and bemerkung_spans[idx_sub].get_text().strip():
                            title += f" ({bemerkung_spans[idx_sub].get_text().strip()})"

                        final_start = datetime.strptime(f"{date_str} {default_start_str}", "%Y-%m-%d %H:%M")
                        final_end = datetime.strptime(f"{date_str} {active_end_str}", "%Y-%m-%d %H:%M")

                        events.append({
                            "title": title,
                            "room": room_field,
                            "instructor": instructor,
                            "start": final_start,
                            "end": final_end
                        })
                else:
                    rowspan = int(cell.get('rowspan', 1))
                    if rowspan > 1:
                        for span_i in range(1, rowspan):
                            row_spans[col_cursor + span_i - 1] = row_spans.get(col_cursor + span_i - 1, 0) + 1

                col_cursor += 1

    master_event_log = {}
    print(f"Processing {len(events)} clean events into standard state-machine...")

    for ev in events:
        title = ev.get('title', 'Unbekanntes Event')
        room_field = ev.get('room', 'Ohne')
        instructor = ev.get('instructor', 'Ohne')
        final_start = ev.get('start')
        final_end = ev.get('end')
        date_str = final_start.strftime('%Y-%m-%d')

        title_lower = title.lower()
        has_instructor = instructor.strip().lower() not in ["", "ohne", "keine person"]

        if "prüfung" in title_lower or "klau" in title_lower:
            time_data = parse_title_times(title)
            if time_data:
                sh, sm, eh, em = time_data
                final_start = datetime.strptime(f"{date_str} {sh:02d}:{sm:02d}", "%Y-%m-%d %H:%M")
                final_end = datetime.strptime(f"{date_str} {eh:02d}:{em:02d}", "%Y-%m-%d %H:%M")

            room_match = re.search(r'\d\.\d{3}', title)
            room = room_match.group(0) if room_match else room_field

            type_prefix = "WH-Klausur" if "klau" in title_lower else "Prüfung"
            subject = re.sub(r'\s*mit\s*AM\b|\bWH-Klau\b|\bWH\s+Klau\b|\bPrüfung\b|\bPR\b|\d{1,2}\s*(?:-\s*\d{1,2}|:\d{2})|\d\.\d{3}', '', title, flags=re.IGNORECASE)
            clean_subject = re.sub(r'\s+', ' ', subject).strip()
            summary = f"{type_prefix}: {clean_subject} ({room})"

            location = "ACHTUNG: Bitte Campus Dual prüfen!"
            description = "DHSN-Cal übernimmt keine Garantie für die Richtigkeit der Angaben. Speziell für Prüfungen empfehle ich Ort und Zeit in Campus Dual zu überprüfen."
            if has_instructor:
                description += f"\n\nInstructor: {instructor}"

        elif "sonst" in title_lower:
            time_data = parse_title_times(title)
            if time_data:
                sh, sm, eh, em = time_data
                final_start = datetime.strptime(f"{date_str} {sh:02d}:{sm:02d}", "%Y-%m-%d %H:%M")
                final_end = datetime.strptime(f"{date_str} {eh:02d}:{em:02d}", "%Y-%m-%d %H:%M")

            room_match = re.search(r'\d\.\d{3}', title) or re.search(r'\b\d{4}\b', title)
            if room_match:
                raw_room = room_match.group(0)
                room = f"{raw_room[0]}.{raw_room[1:]}" if "." not in raw_room else raw_room
            else:
                room = room_field

            subject = re.sub(r'\bSonst\b\.?|\d\.\d{3}|\b\d{4}\b|\d{1,2}\s*(?:-\s*\d{1,2}|:\d{2})', '', title, flags=re.IGNORECASE)
            clean_subject = re.sub(r'\s+', ' ', subject).strip()
            summary = f"Sonstiges: {clean_subject} ({room})"

            location = f"Dozent: {instructor}" if has_instructor else "Externer Dozent / Sondertermin"
            description = f"Instructor: {instructor}"

        else:
            summary = f"{title} ({room_field})"
            location = f"Dozent: {instructor}"
            description = f"Instructor: {instructor}"

        event_key = f"{date_str}_{final_start.strftime('%H:%M:%S')}_{summary}"
        if event_key not in master_event_log:
            master_event_log[event_key] = {
                "summary": summary,
                "location": location,
                "description": description,
                "start": final_start.isoformat(),
                "end": final_end.isoformat()
            }

    sorted_output = sorted(master_event_log.values(), key=lambda x: x['start'])

    # 1. Output JSON File
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(sorted_output, f, ensure_ascii=False, indent=4)

    # 2. Output ICS File
    ics_data = generate_ics_content(sorted_output)
    with open(OUTPUT_ICS, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(ics_data)

    print(f"Success! Exported {len(sorted_output)} events to '{OUTPUT_JSON}' and '{OUTPUT_ICS}'.")

if __name__ == "__main__":
    main()