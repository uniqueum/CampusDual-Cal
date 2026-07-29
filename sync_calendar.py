import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from datetime import datetime, timedelta

def fetch_campus_dual_timetable(session: requests.Session = None, csrf_token: str = None, start_dt: datetime = None, end_dt: datetime = None):
    """
    Fetches the timetable HTML from the BA Dresden PlanServlet endpoint iteratively
    week-by-week to ensure the entire semester range is captured, then aggregates them.
    """
    url = "https://stundenplan.ba-dresden.de/stundenplan/PlanServlet"
    active_session = session if session is not None else requests.Session()

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }

    # Default bounds if not provided
    current_start = start_dt if start_dt else datetime.now()
    final_end = end_dt if end_dt else (current_start + timedelta(days=90))

    aggregated_html_blocks = []

    # Step through in intervals (e.g., chunks of 4 weeks per request to cover the window safely)
    delta_step = timedelta(days=28)

    while current_start < final_end:
        query_parameters = {
            "akttyp": "1",
            "aktwert": "3mi25-1",
            "legendefach": "on",
            "Datum": current_start.strftime("%d.%m.%Y")
        }

        print(f"Fetching timetable block starting from: {current_start.strftime('%Y-%m-%d')}...")

        response = active_session.get(url, params=query_parameters, headers=headers, verify=False)
        response.raise_for_status()

        aggregated_html_blocks.append(response.text)
        current_start += delta_step

    # Combine tables from all fetched chunks into a single unified HTML document for the processor
    combined_soup_content = "\n".join(aggregated_html_blocks)

    output_filename = "campus_dual_dump.html"
    with open(output_filename, "w", encoding="utf-8") as f:
        f.write(combined_soup_content)

    print(f"SUCCESS! '{output_filename}' written successfully with full range coverage.")

if __name__ == "__main__":
    fetch_campus_dual_timetable()