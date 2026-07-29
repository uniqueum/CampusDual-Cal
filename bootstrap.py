import subprocess
import sys
import os

# Define the definitive local .venv paths
VENV_DIR = os.path.abspath(".venv")
VENV_PYTHON = os.path.join(VENV_DIR, "Scripts", "python.exe") if os.name == "nt" else os.path.join(VENV_DIR, "bin", "python")

# 1. Ensure .venv exists immediately
if not os.path.exists(VENV_PYTHON):
    print("🥾 Creating local Python virtual environment (.venv)...", flush=True)
    subprocess.check_call([sys.executable, "-m", "venv", VENV_DIR])

# 2. Force re-spawn if we aren't already running inside the .venv interpreter
if os.path.abspath(sys.executable) != os.path.abspath(VENV_PYTHON):
    print("🔄 Switching to local virtual environment interpreter...", flush=True)
    subprocess.check_call([VENV_PYTHON, __file__] + sys.argv[1:])
    sys.exit(0)

# --- Now strictly running inside .venv ---
import ast
import importlib.metadata

PACKAGE_MAP = {
    "google": "google-api-python-client",
    "google_auth_oauthlib": "google-auth-oauthlib",
    "googleapiclient": "google-api-python-client",
    "bs4": "beautifulsoup4",
    "requests": "requests",
    "urllib3": "urllib3",
    "browser_cookie3": "browser-cookie3"
}

def get_required_modules():
    modules = set()
    for file in os.listdir("."):
        if file.endswith(".py") and file != "bootstrap.py":
            try:
                with open(file, "r", encoding="utf-8") as f:
                    tree = ast.parse(f.read(), filename=file)
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            top_mod = alias.name.split(".")[0]
                            if top_mod in PACKAGE_MAP:
                                modules.add(PACKAGE_MAP[top_mod])
                    elif isinstance(node, ast.ImportFrom):
                        if node.module:
                            top_mod = node.module.split(".")[0]
                            if top_mod in PACKAGE_MAP:
                                modules.add(PACKAGE_MAP[top_mod])
            except Exception as e:
                print(f"⚠️ Warning: Could not parse {file}: {e}")
    return modules

def ensure_dependencies():
    required = get_required_modules()
    print(f"🔍 Discovered required packages from codebase: {required}")

    missing = []
    for pkg in required:
        try:
            importlib.metadata.version(pkg)
        except importlib.metadata.PackageNotFoundError:
            missing.append(pkg)

    if missing:
        print(f"📦 Missing packages detected: {missing}. Installing into .venv...")
        # Explicitly use VENV_PYTHON to guarantee it goes into .venv, never global
        subprocess.check_call([VENV_PYTHON, "-m", "pip", "install", "--no-cache-dir", *missing])
        print("✨ All dependencies successfully installed.")
    else:
        print("✅ All Python dependencies are already satisfied inside .venv.")

if __name__ == "__main__":
    ensure_dependencies()