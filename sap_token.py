import requests

def get_csrf_token(session: requests.Session) -> str:
    """
    Sends a HEAD request to the SAP OData service root to fetch and return the x-csrf-token.
    """
    url = "https://fep.campus-dual.de/sap/opu/odata/sap/ZCM_EM_STUDENT_TIMETABLE_SRV/"
    headers = {
        "x-csrf-token": "fetch",
        "Accept": "application/json"
    }

    response = session.head(url, headers=headers, verify=False)
    response.raise_for_status()

    token = response.headers.get("x-csrf-token")
    if not token or token.lower() == "fetch":
        raise ValueError("Failed to retrieve a valid x-csrf-token from the SAP OData service.")

    return token