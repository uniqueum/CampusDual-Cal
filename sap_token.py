import requests


class AuthRequiredError(Exception):
    """Raised when Campus Dual doesn't recognize the session as authenticated,
    i.e. the Firefox session cookie is missing, expired, or never existed."""
    pass


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

    # An unauthenticated/expired session typically surfaces as a 401/403 here.
    if response.status_code in (401, 403):
        raise AuthRequiredError(
            f"Campus Dual rejected the request (HTTP {response.status_code}). "
            "Your session cookie is missing or expired - please log in to Campus Dual in Firefox."
        )

    response.raise_for_status()

    token = response.headers.get("x-csrf-token")
    if not token or token.lower() == "fetch":
        # No exception was raised (often a 200), but no real CSRF token came back either -
        # this happens when the request gets silently redirected to the SSO login page
        # because the session cookie is missing or expired.
        raise AuthRequiredError(
            "Campus Dual did not return a CSRF token, which usually means the request was "
            "redirected to the login page. Your session cookie is missing or expired - "
            "please log in to Campus Dual in Firefox."
        )

    return token
