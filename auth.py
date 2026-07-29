import browser_cookie3
import requests

def get_authenticated_session(browser_name: str, domain_name: str = "campus-dual.de") -> requests.Session:
    """
    Initializes a requests.Session and populates it with cookies
    extracted from the user's specified browser.
    """
    session = requests.Session()

    # Map string inputs to the correct browser_cookie3 loader function
    loaders = {
        "chrome": browser_cookie3.chrome,
        "firefox": browser_cookie3.firefox,
        "edge": browser_cookie3.edge,
        "opera": browser_cookie3.opera,
        "safari": browser_cookie3.safari,
    }

    selected_loader = loaders.get(browser_name.lower())
    if not selected_loader:
        raise ValueError(f"Unsupported browser: '{browser_name}'. Choose from {list(loaders.keys())}")

    try:
        # Load cookies filtered by the target domain name
        cj = selected_loader(domain_name=domain_name)
        session.cookies.update(cj)
    except Exception as e:
        raise RuntimeError(f"Failed to extract cookies from {browser_name}: {e}")

    return session