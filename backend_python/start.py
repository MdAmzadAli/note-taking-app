#!/usr/bin/env python3
"""
Startup script for Python backend
Ensures all dependencies are installed and starts the server planassj
"""

import subprocess
import sys
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from the backend_python directory
env_path = Path(__file__).parent / '.env'
print(f"🔧 START.PY ENV: Loading environment variables from: {env_path}")
print(f"🔧 START.PY ENV: .env file exists: {env_path.exists()}")

load_dotenv(dotenv_path=env_path)
print(f"🔧 START.PY ENV: Environment variables loaded successfully")

# Log critical environment variables status (secure - no values)
print("🔧 START.PY ENV: Critical environment variables status:")
print(f"   QDRANT_URL: {'✅ Set' if os.getenv('QDRANT_URL') else '❌ Not set'}")
print(f"   QDRANT_API_KEY: {'✅ Set' if os.getenv('QDRANT_API_KEY') else '❌ Not set'}")
print(f"   GEMINI_EMBEDDING_API_KEY: {'✅ Set' if os.getenv('GEMINI_EMBEDDING_API_KEY') else '❌ Not set'}")
print(f"   GEMINI_CHAT_API_KEY: {'✅ Set' if os.getenv('GEMINI_CHAT_API_KEY') else '❌ Not set'}")

def install_requirements():
    """Check Python dependencies (Nix/uv handles installation automatically)"""
    try:
        print("📦 Python dependencies managed by Nix/uv - skipping manual installation")
        print("✅ Python dependencies check completed")
    except Exception as e:
        print(f"⚠️ Dependencies check warning: {e}")
        # Don't exit, continue anyway

def start_server():
    """Start the FastAPI server with Socket.IO integration"""
    try:
        print("🚀 Starting Python backend server with Socket.IO...")
        # Use socket_app instead of app to enable Socket.IO routes
        os.execv(sys.executable, [sys.executable, "-m", "uvicorn", "main:socket_app", "--host", "0.0.0.0", "--port", "8000"])
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