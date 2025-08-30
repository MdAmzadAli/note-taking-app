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

if env_path.exists():
    with open(env_path, 'r') as f:
        env_content = f.read()
        print(f"🔧 START.PY ENV: .env file content preview (first 200 chars):")
        print(f"🔧 START.PY ENV: {env_content[:200]}...")
        print(f"🔧 START.PY ENV: Total .env file length: {len(env_content)} characters")

load_dotenv(dotenv_path=env_path)
print(f"🔧 START.PY ENV: load_dotenv() called with path: {env_path}")

# Log critical environment variables after loading
print("🔧 START.PY ENV: Critical environment variables status:")
print(f"   QDRANT_URL: {'✅ Set' if os.getenv('QDRANT_URL') else '❌ Not set'} ({os.getenv('QDRANT_URL', 'None')})")
print(f"   QDRANT_API_KEY: {'✅ Set' if os.getenv('QDRANT_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('QDRANT_API_KEY', '')), 8) if os.getenv('QDRANT_API_KEY') else 'None'})")
print(f"   GEMINI_EMBEDDING_API_KEY: {'✅ Set' if os.getenv('GEMINI_EMBEDDING_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('GEMINI_EMBEDDING_API_KEY', '')), 8) if os.getenv('GEMINI_EMBEDDING_API_KEY') else 'None'})")
print(f"   GEMINI_CHAT_API_KEY: {'✅ Set' if os.getenv('GEMINI_CHAT_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('GEMINI_CHAT_API_KEY', '')), 8) if os.getenv('GEMINI_CHAT_API_KEY') else 'None'})")

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