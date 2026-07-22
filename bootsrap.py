import subprocess
import sys
import pkg_resources
import os

# Map of custom module names to their actual PyPI package names
PACKAGE_MAP = {
    "google": "google-api-python-client",
    "google_auth_oauthlib": "google-auth-oauthlib",
    "googleapiclient": "google-api-python-client",
    "bs4": "beautifulsoup4",
    "requests": "requests",
    "urllib3": "urllib3"
}

def get_required_modules():
    modules = set()
    # Scan all .py files in the directory for imports
    for file in os.listdir("."):
        if file.endswith(".py") and file != "bootstrap.py":
            with open(file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("import ") or line.startswith("from "):
                        parts = line.replace("import ", "").replace("from ", "").split()
                        if parts:
                            mod = parts[0].split(".")[0]
                            if mod in PACKAGE_MAP:
                                modules.add(PACKAGE_MAP[mod])
    return modules

def ensure_dependencies():
    required = get_required_modules()
    installed = {pkg.key for pkg in pkg_resources.working_set}

    missing = [pkg for pkg in required if pkg.lower() not in installed]

    if missing:
        print(f"📦 Missing packages detected: {missing}. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", *missing])
        print("✨ All dependencies successfully installed.")
    else:
        print("✅ All Python dependencies are already satisfied.")

if __name__ == "__main__":
    ensure_dependencies()