
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
    
    # Check for .env file before starting
    env_file = os.path.join(script_dir, '.env')
    print(f"🔧 ENV: Checking for .env file at: {env_file}")
    print(f"🔧 ENV: .env file exists: {os.path.exists(env_file)}")
    
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            content = f.read()
            print(f"🔧 ENV: .env file size: {len(content)} bytes")
            print(f"🔧 ENV: .env file first line: {content.split('\n')[0] if content else 'Empty file'}")
    else:
        print("🔧 ENV: .env file not found, will use .env.example or environment variables")
        example_env = os.path.join(script_dir, '.env.example')
        print(f"🔧 ENV: .env.example exists: {os.path.exists(example_env)}")
    
    # Install requirements and start server
    install_requirements()
    start_server()
