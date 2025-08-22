
#!/usr/bin/env python3
"""
Startup script for Python backend
Ensures all dependencies are installed and starts the server
"""

import subprocess
import sys
import os

def install_requirements():
    """Install Python requirements if needed"""
    try:
        print("📦 Checking Python dependencies...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Python dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        sys.exit(1)

def start_server():
    """Start the FastAPI server"""
    try:
        print("🚀 Starting Python backend server...")
        os.execv(sys.executable, [sys.executable, "main.py"])
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Change to the backend_python directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Install requirements and start server
    install_requirements()
    start_server()
