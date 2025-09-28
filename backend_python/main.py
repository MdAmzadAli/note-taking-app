import os
import asyncio
import json
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
import aiofiles
import uvicorn
import requests
import aiohttp
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import mimetypes
from dotenv import load_dotenv
import time
from datetime import datetime

# Load environment variables from the backend_python directory FIRST
import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / '.env'
print(f"🔧 ENV: Loading environment variables from: {env_path}")
print(f"🔧 ENV: .env file exists: {env_path.exists()}")

load_dotenv(dotenv_path=env_path)
print(f"🔧 ENV: Environment variables loaded successfully")

# Log critical environment variables status (secure - no values)
print("🔧 ENV: Critical environment variables status:")
print(f"   QDRANT_URL: {'✅ Set' if os.getenv('QDRANT_URL') else '❌ Not set'}")
print(f"   QDRANT_API_KEY: {'✅ Set' if os.getenv('QDRANT_API_KEY') else '❌ Not set'}")
print(f"   GEMINI_EMBEDDING_API_KEY: {'✅ Set' if os.getenv('GEMINI_EMBEDDING_API_KEY') else '❌ Not set'}")
print(f"   GEMINI_CHAT_API_KEY: {'✅ Set' if os.getenv('GEMINI_CHAT_API_KEY') else '❌ Not set'}")

# Import services with logging AFTER environment variables are loaded
print("🔧 Starting Python backend imports...")

try:
    import socketio
    print("✅ Socket.IO imported successfully")
except ImportError as e:
    print(f"❌ Failed to import Socket.IO: {e}")

try:
    from services.csv_service import CSVService
    print("✅ CSVService imported successfully")
except ImportError as e:
    print(f"❌ Failed to import CSVService: {e}")

try:
    from services.file_service import FileService
    print("✅ FileService imported successfully")
except ImportError as e:
    print(f"❌ Failed to import FileService: {e}")

try:
    from services.rag_service import RAGService
    print("✅ RAGService imported successfully")
except ImportError as e:
    print(f"❌ Failed to import RAGService: {e}")

try:
    from component.url_download_service import URLDownloadService
    print("✅ URLDownloadService imported successfully")
except ImportError as e:
    print(f"❌ Failed to import URLDownloadService: {e}")

try:
    from component.webpage_text_extractor_service import WebpageTextExtractorService
    print("✅ WebpageTextExtractorService imported successfully")
except ImportError as e:
    print(f"❌ Failed to import WebpageTextExtractorService: {e}")

print("🔧 All imports completed")

# Database imports for beta user functionality
try:
    from sql_db.db_schema.base import get_db_session, create_all_tables
    from sql_db.db_methods.beta_user_repository import BetaUserRepository
    from sql_db.db_methods.usage_repository import UsageRepository
    print("✅ Database components imported successfully")
except ImportError as e:
    print(f"❌ Failed to import database components: {e}")

print("🔧 All imports including database completed")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup code (before yield)
    print("🚀 FastAPI application starting up...")
    
    # Create database tables
    try:
        print("🔧 Creating database tables...")
        create_all_tables()
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")
    
    # Ensure RAG service is initialized if not already done or if startup is called again
    if 'rag_service' in globals() and rag_service and not rag_service.is_initialized:
        print("🔄 Initializing RAG service on startup...")
        try:
            await rag_service.initialize()
            if rag_service.is_initialized:
                print("✅ RAG service initialized successfully on startup.")
            else:
                print("⚠️ RAG service initialization might have issues.")
        except Exception as e:
            print(f"❌ Error during RAG service initialization on startup: {e}")
    else:
        print("🔧 RAG service already initialized or not available.")
    
    yield
    
    # Shutdown code (after yield)
    print("🛑 FastAPI application shutting down...")

app = FastAPI(title="Document Management API", lifespan=lifespan)

# Configuration - Use port 8000 for backend to avoid conflicts
PORT = int(os.getenv("PORT", 8000))
UPLOADS_DIR = Path("uploads")
PREVIEWS_DIR = Path("previews")
METADATA_DIR = Path("metadata") # Added for metadata storage

# Ensure directories exist
UPLOADS_DIR.mkdir(exist_ok=True)
PREVIEWS_DIR.mkdir(exist_ok=True)
METADATA_DIR.mkdir(exist_ok=True) # Ensure metadata directory exists

# CORS configuration
def get_cors_origins():
    print(f"🌐 CORS check for origin")

    allowed_origins = []

    # Allow any replit.dev subdomain
    allowed_origins.append("*replit.dev*")

    # Allow localhost for development
    allowed_origins.extend(["http://localhost:*", "http://127.0.0.1:*"])

    # Allow custom origins from environment variable
    custom_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
    allowed_origins.extend([origin.strip() for origin in custom_origins if origin.strip()])

    # Allow all for development
    return ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Access-Control-Allow-Origin"],
)

# Initialize services with logging
print("🔧 Initializing backend services...")

# Initialize with fallback to None if import fails
csv_service = None
file_service = None
rag_service = None
url_download_service = None
webpage_text_extractor_service = None

try:
    csv_service = CSVService()
    print("✅ CSVService initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize CSVService: {e}")

try:
    file_service = FileService()
    print("✅ FileService initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize FileService: {e}")

try:
    rag_service = RAGService()
    print("✅ RAGService created successfully")

    # Initialize RAG service immediately
    print("🔄 Initializing RAG service...")
    # Note: Directly calling asyncio.run() inside a FastAPI app can cause issues.
    # It's better to rely on the event loop managed by Uvicorn.
    # For initialization that needs to run once, it's often handled within a startup event.
    # However, for simplicity in this example, we'll keep the direct call, but be aware of potential issues.
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
             # If loop is already running (e.g., in test environment), create a new task
             loop.create_task(rag_service.initialize())
        else:
            loop.run_until_complete(rag_service.initialize())
        print("✅ RAGService initialization task scheduled/completed")
    except RuntimeError:
        # Fallback if no event loop is set yet or it's closed
        print("🔄 Creating new event loop for RAG service initialization...")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(rag_service.initialize())
        loop.close()
        print("✅ RAGService initialized successfully (new loop)")

except Exception as e:
    print(f"❌ Failed to initialize RAGService: {e}")

print("🔧 All services initialization completed")

# Socket.IO setup with proper CORS configuration
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    cors_credentials=True,
    logger=True,
    engineio_logger=True,
    allow_upgrades=True,
    transports=['websocket', 'polling']
)

# Mount Socket.IO app with proper path
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
print("🔌 Socket.IO ASGI app created successfully")
print("🔌 Socket.IO will handle routes: /socket.io/*")

@sio.event
async def connect(sid, environ):
    print(f"🔌 Socket.IO client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"🔌 Socket.IO client disconnected: {sid}")

async def send_summary(file_id: str, summary: str):
    """Send summary to all connected Socket.IO clients"""
    message = {
        "type": "summary",
        "fileId": file_id,
        "summary": summary,
        "timestamp": datetime.now().isoformat()
    }
    try:
        await sio.emit('summary_notification', message)
        print(f"📨 Summary sent via Socket.IO for file: {file_id}")
    except Exception as e:
        print(f"❌ Failed to send summary via Socket.IO: {e}")

async def generate_file_summary_background(file_id: str, file_name: str, workspace_id: Optional[str] = None):
    """
    Generate file summary in background without blocking other operations
    """
    try:
        print(f"🔄 Starting background summary generation for file: {file_id}")

        # Generate a summary query
        summary_query = f"Provide a comprehensive summary of the document '{file_name}'. Include key topics, main points, and important information."

        print(f"🔍 Running summary search for: {file_id}")

        # Use RAG service to generate summary
        if not rag_service:
            print(f"❌ RAG service not available for summary generation")
            return
        summary_result = await rag_service.generate_answer(
            query=summary_query,
            file_ids=[file_id],
            workspace_id=workspace_id
        )

        if summary_result and summary_result.get('answer'):
            summary_text = summary_result['answer']
            print(f"✅ Summary generated for file {file_id} ({len(summary_text)} characters)")

            # Send summary via Socket.IO
            await send_summary(file_id, summary_text)
        else:
            print(f"⚠️ No summary generated for file: {file_id}")

    except Exception as error:
        print(f"❌ Background summary generation failed for {file_id}: {error}")
        # Send error notification via Socket.IO
        await send_summary(file_id, f"Failed to generate summary: {str(error)}")

try:
    url_download_service = URLDownloadService()
    print("✅ URLDownloadService initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize URLDownloadService: {e}")

try:
    webpage_text_extractor_service = WebpageTextExtractorService()
    print("✅ WebpageTextExtractorService initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize WebpageTextExtractorService: {e}")

# Request models
class WorkspaceUploadRequest(BaseModel):
    workspaceId: str
    urls: Optional[List[Dict]] = []

class RAGIndexRequest(BaseModel):
    workspaceId: Optional[str] = None

class RAGQueryRequest(BaseModel):
    query: str
    fileIds: Optional[List[str]] = None
    workspaceId: Optional[str] = None

class FeedbackRequest(BaseModel):
    feedbackType: str  # 'Bug', 'Feature Request', 'General Feedback', 'Other'
    feedback: str  # Description
    platformType: str  # 'Android' or 'IOS'
    userName: Optional[str] = None
    email: Optional[str] = None

class BetaUserSignupRequest(BaseModel):
    email: Optional[str] = None
    user_uuid: str

class BetaUserUpdateRequest(BaseModel):
    user_id: str
    email: str

class BetaUserResponse(BaseModel):
    success: bool
    user_id: Optional[str] = None
    email: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None

class TranscriptionResponse(BaseModel):
    success: bool
    transcript: Optional[str] = None
    error: Optional[str] = None

class TranscriptionJobResponse(BaseModel):
    success: bool
    job_id: Optional[str] = None
    error: Optional[str] = None

class TranscriptionJobStatus(BaseModel):
    job_id: str
    status: str  # 'queued', 'uploading', 'processing', 'completed', 'error', 'timeout'
    transcript: Optional[str] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

# Job tracking for async transcription
transcription_jobs: Dict[str, Dict[str, Any]] = {}
job_lock = asyncio.Lock()

async def update_user_transcription_usage_background(user_uuid: str, duration_seconds: int, job_id: str):
    """
    SECOND CHECKPOINT: Background task to update user transcription usage after completion
    """
    try:
        print(f"📊 [Checkpoint 2] Processing usage update for user {user_uuid}, duration: {duration_seconds} minutes")
        
        session = next(get_db_session())
        usage_repo = UsageRepository(session)
        
        try:
            # Check if user has existing usage data
            usage_data = usage_repo.get_transcription_usage(user_uuid)
            
            if not usage_data:
                # User doesn't have usage table, initialize with current transcription duration
                print(f"🆕 [Checkpoint 2] Initializing usage table for user {user_uuid} with {duration_seconds} minutes")
                result = usage_repo.initialize_usage_if_not_exists(user_uuid, duration_seconds)
                print(f"✅ [Checkpoint 2] Usage table initialized for user {user_uuid}")
                
                # Send initial usage data to frontend via Socket.IO
                if sio:
                    await sio.emit('transcription_usage_updated', {
                        'user_uuid': user_uuid,
                        'current_usage': result['transcription_used'],
                        'limit': result['transcription_limit'],
                        'percentage': round((result['transcription_used'] / result['transcription_limit']) * 100, 1)
                    })
                    print(f"📊 [Checkpoint 2] Initial usage data sent to frontend for user {user_uuid}: {result['transcription_used']}/{result['transcription_limit']} ({round((result['transcription_used'] / result['transcription_limit']) * 100, 1)}%)")
                
            else:
                # User has existing usage table, check if adding current duration exceeds limit
                current_used = usage_data['transcription_used']
                limit = usage_data['transcription_limit']
                new_total = current_used + duration_seconds
                
                print(f"📊 [Checkpoint 2] Current usage: {current_used}, Adding: {duration_seconds}, New total: {new_total}, Limit: {limit}")
                
                # Update usage regardless of whether limit is exceeded
                result = usage_repo.update_transcription_used(user_uuid, duration_seconds)
                print(f"✅ [Checkpoint 2] Usage updated for user {user_uuid}: {result['transcription_used']}/{result['transcription_limit']}")
                
                # Send current usage data to frontend via Socket.IO
                if sio:
                    await sio.emit('transcription_usage_updated', {
                        'user_uuid': user_uuid,
                        'current_usage': result['transcription_used'],
                        'limit': result['transcription_limit'],
                        'percentage': round((result['transcription_used'] / result['transcription_limit']) * 100, 1)
                    })
                    print(f"📊 [Checkpoint 2] Usage data sent to frontend for user {user_uuid}: {result['transcription_used']}/{result['transcription_limit']} ({round((result['transcription_used'] / result['transcription_limit']) * 100, 1)}%)")
                
                # Check if limit is exceeded after the update and send flag if needed
                if new_total >= limit:
                    print(f"⚠️ [Checkpoint 2] User {user_uuid} has exceeded limit after this transcription")
                    # Send flag to frontend via Socket.IO
                    if sio:
                        await sio.emit('transcription_limit_exceeded', {
                            'job_id': job_id,
                            'user_uuid': user_uuid,
                            'current_usage': new_total,
                            'limit': limit,
                            'message': 'Transcription limit exceeded. Further transcriptions may be restricted.'
                        })
                        print(f"🚨 [Checkpoint 2] Limit exceeded notification sent to frontend for user {user_uuid}")
                
        except Exception as usage_update_error:
            print(f"❌ [Checkpoint 2] Error updating usage for user {user_uuid}: {usage_update_error}")
            
        finally:
            session.close()
            
    except Exception as background_error:
        print(f"❌ [Checkpoint 2] Background usage update failed for user {user_uuid}: {background_error}")

# Middleware for logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request.url.path != "/health":
        print(f"🌐 {request.method} {request.url.path} - Content-Type: {request.headers.get('Content-Type')} - Origin: {request.headers.get('Origin')}")

    response = await call_next(request)
    return response

# Health check endpoint
@app.get("/health")
async def health_check():
    print('💗 Health check requested')

    # Check RAG service health
    rag_health = {'status': 'unknown', 'initialized': False}
    detailed_status = {}

    if rag_service:
        try:
            rag_health = await rag_service.health_check()
            detailed_status = rag_service.get_detailed_status()
            print(f'🔍 RAG detailed status in health check: {detailed_status}')
        except Exception as e:
            rag_health = {'status': 'error', 'error': str(e), 'initialized': False}
            print(f'❌ Error getting RAG health status: {e}')

    return {
        "status": "healthy",
        "rag": rag_health,
        "rag_detailed": detailed_status,
        "timestamp": datetime.now().isoformat()
    }

# Async transcription background processing
async def process_transcription_job(job_id: str, audio_file_path: Path, user_uuid: str, duration_seconds: int):
    """
    Process transcription in background with real-time progress updates
    """
    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    
    async with job_lock:
        transcription_jobs[job_id]['status'] = 'uploading'
        transcription_jobs[job_id]['updated_at'] = datetime.now().isoformat()
    
    try:
        # Stage 1: Uploading (0-33%)
        print(f"📤 [Job {job_id}] Starting upload process...")
        
        # Step 1.1: File received by backend (5%)
        if sio:
            await sio.emit('transcription_progress', {
                'job_id': job_id,
                'stage': 'uploading',
                'progress': 5,
                'message': 'File received by backend...'
            })
        
        await asyncio.sleep(0.3)  # Brief delay to show stage
        
        # Step 1.2: Preparing for AssemblyAI upload (15%)
        if sio:
            await sio.emit('transcription_progress', {
                'job_id': job_id,
                'stage': 'uploading',
                'progress': 15,
                'message': 'Preparing audio for transcription service...'
            })
        
        # Use aiohttp for non-blocking HTTP requests
        async with aiohttp.ClientSession() as session:
            print(f"📤 [Job {job_id}] Uploading to AssemblyAI...")
            
            # Step 1.3: Uploading to AssemblyAI (25%)
            if sio:
                await sio.emit('transcription_progress', {
                    'job_id': job_id,
                    'stage': 'uploading',
                    'progress': 25,
                    'message': 'Transferring to AssemblyAI...'
                })
            
            # Read audio file asynchronously
            async with aiofiles.open(audio_file_path, 'rb') as f:
                audio_data = await f.read()
            
            # Upload to AssemblyAI
            async with session.post(
                'https://api.assemblyai.com/v2/upload',
                data=audio_data,
                headers={
                    'authorization': api_key,
                    'content-type': 'application/octet-stream'
                },
                timeout=aiohttp.ClientTimeout(total=60)
            ) as upload_response:
                if upload_response.status != 200:
                    error_text = await upload_response.text()
                    raise Exception(f"Upload failed: {upload_response.status} - {error_text}")
                
                upload_result = await upload_response.json()
                upload_url = upload_result['upload_url']
                print(f"✅ [Job {job_id}] Audio uploaded successfully")
            
            # Step 1.4: Upload complete (33%) - STAGE COMPLETION
            if sio:
                await sio.emit('transcription_progress', {
                    'job_id': job_id,
                    'stage': 'uploading',
                    'progress': 33,
                    'message': 'Upload complete!',
                    'stage_complete': True  # Mark uploading stage as complete
                })
            
            # Update job status
            async with job_lock:
                transcription_jobs[job_id]['status'] = 'processing'
                transcription_jobs[job_id]['updated_at'] = datetime.now().isoformat()
            
            # Transition delay to show upload completion
            await asyncio.sleep(0.5)
            
            # Stage 2: Transcribing (33-90%)
            print(f"🎧 [Job {job_id}] Starting transcription...")
            
            # Step 2.1: Begin transcription stage (35%)
            if sio:
                await sio.emit('transcription_progress', {
                    'job_id': job_id,
                    'stage': 'transcribing',
                    'progress': 35,
                    'message': 'Initializing AI transcription...'
                })
            
            # Request transcription
            transcript_request = {
                'audio_url': upload_url,
                'language_code': 'en',
                'punctuate': True,
                'format_text': True
            }
            
            async with session.post(
                'https://api.assemblyai.com/v2/transcript',
                json=transcript_request,
                headers={'authorization': api_key},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as transcript_response:
                if transcript_response.status != 200:
                    error_text = await transcript_response.text()
                    raise Exception(f"Transcription request failed: {transcript_response.status} - {error_text}")
                
                transcript_result = await transcript_response.json()
                transcript_id = transcript_result['id']
                print(f"🔄 [Job {job_id}] Transcription started, ID: {transcript_id}")
            
            # Step 2.2: Transcription request sent (40%)
            if sio:
                await sio.emit('transcription_progress', {
                    'job_id': job_id,
                    'stage': 'transcribing',
                    'progress': 40,
                    'message': 'AI processing your audio...'
                })
            
            # Poll for completion asynchronously (non-blocking with sleep)
            max_polls = 60
            poll_count = 0
            
            while poll_count < max_polls:
                await asyncio.sleep(5)  # Non-blocking sleep
                poll_count += 1
                print(f"📊 [Job {job_id}] Polling attempt {poll_count}/{max_polls}")
                
                # Update progress during transcription (40-85%)
                current_progress = min(40 + (poll_count * 1.2), 85)
                if sio:
                    await sio.emit('transcription_progress', {
                        'job_id': job_id,
                        'stage': 'transcribing',
                        'progress': int(current_progress),
                        'message': f'Converting speech to text... ({int(current_progress)}%)'
                    })
                
                async with session.get(
                    f'https://api.assemblyai.com/v2/transcript/{transcript_id}',
                    headers={'authorization': api_key},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as status_response:
                    if status_response.status != 200:
                        continue
                    
                    status_result = await status_response.json()
                    status = status_result.get('status')
                    
                    if status == 'completed':
                        transcript_text = status_result.get('text', '')
                        print(f"✅ [Job {job_id}] Transcription completed: {len(transcript_text)} characters")
                        
                        # Step 2.3: Transcription received (85%) - STAGE COMPLETION
                        if sio:
                            await sio.emit('transcription_progress', {
                                'job_id': job_id,
                                'stage': 'transcribing',
                                'progress': 85,
                                'message': 'Audio transcription complete!',
                                'stage_complete': True  # Mark transcribing stage as complete
                            })
                        
                        # Transition delay to show transcription completion
                        await asyncio.sleep(0.7)
                        
                        # Stage 3: Cleaning (85-100%)
                        print(f"✨ [Job {job_id}] Starting text cleaning...")
                        
                        # Step 3.1: Begin cleaning stage (88%)
                        if sio:
                            await sio.emit('transcription_progress', {
                                'job_id': job_id,
                                'stage': 'cleaning',
                                'progress': 88,
                                'message': 'Starting text cleanup...'
                            })
                        
                        await asyncio.sleep(0.5)
                        
                        # Step 3.2: Text formatting (92%)
                        if sio:
                            await sio.emit('transcription_progress', {
                                'job_id': job_id,
                                'stage': 'cleaning',
                                'progress': 92,
                                'message': 'Formatting and cleaning text...'
                            })
                        
                        # Simulate text cleaning process
                        await asyncio.sleep(0.8)
                        
                        # Step 3.3: Finalization (96%)
                        if sio:
                            await sio.emit('transcription_progress', {
                                'job_id': job_id,
                                'stage': 'cleaning',
                                'progress': 96,
                                'message': 'Finalizing transcript...'
                            })
                        
                        await asyncio.sleep(0.4)
                        
                        # Step 3.4: Complete (100%) - STAGE COMPLETION
                        if sio:
                            await sio.emit('transcription_progress', {
                                'job_id': job_id,
                                'stage': 'cleaning',
                                'progress': 100,
                                'message': 'Transcription complete!',
                                'stage_complete': True  # Mark cleaning stage as complete
                            })
                        
                        # Brief pause to show completion
                        await asyncio.sleep(0.3)
                        
                        # Update job with success
                        async with job_lock:
                            transcription_jobs[job_id]['status'] = 'completed'
                            transcription_jobs[job_id]['transcript'] = transcript_text
                            transcription_jobs[job_id]['updated_at'] = datetime.now().isoformat()
                        
                        # SECOND CHECKPOINT: Background usage update after transcription completion
                        print(f"🔍 [Checkpoint 2] Starting background usage update for user: {user_uuid}")
                        asyncio.create_task(update_user_transcription_usage_background(user_uuid, duration_seconds, job_id))
                        
                        # Final completion event with transcript
                        if sio:
                            await sio.emit('transcription_completed', {
                                'job_id': job_id,
                                'transcript': transcript_text
                            })
                        
                        return
                        
                    elif status == 'error':
                        error_msg = status_result.get('error', 'Unknown transcription error')
                        raise Exception(f"AssemblyAI transcription error: {error_msg}")
            
            # Timeout
            raise Exception("Transcription timeout - took longer than expected")
            
    except Exception as e:
        error_msg = str(e)
        print(f"❌ [Job {job_id}] Transcription failed: {error_msg}")
        
        # Update job with error
        async with job_lock:
            transcription_jobs[job_id]['status'] = 'error'
            transcription_jobs[job_id]['error'] = error_msg
            transcription_jobs[job_id]['updated_at'] = datetime.now().isoformat()
        
        # Emit Socket.IO error event if available
        if sio:
            await sio.emit('transcription_error', {
                'job_id': job_id,
                'error': error_msg
            })
    
    finally:
        # Clean up temp file
        try:
            if audio_file_path.exists():
                audio_file_path.unlink()
                print(f"🗑️ [Job {job_id}] Temporary audio file deleted")
        except Exception as e:
            print(f"⚠️ [Job {job_id}] Failed to delete temp file: {e}")

# New async transcription endpoints
@app.post("/transcribe/async")
async def transcribe_audio_async(
    audio_file: UploadFile = File(...),
    user_uuid: str = Form(...),
    audio_duration: str = Form(...)
) -> TranscriptionJobResponse:
    """
    Non-blocking transcription endpoint that returns job ID immediately
    """
    print(f"🎤 [Async] Transcription request received: {audio_file.filename} from user: {user_uuid}, duration: {audio_duration}s")
    
    try:
        # Parse audio duration
        try:
            duration_seconds = int(audio_duration)
            # duration_seconds = duration_seconds // 60  # Convert to minutes for usage tracking
        except ValueError:
            # duration_seconds = 0
            duration_seconds = 0
            print(f"⚠️ [Job] Invalid audio duration format: {audio_duration}, defaulting to 0")
        
        # FIRST CHECKPOINT: Check user transcription usage before starting transcription
        print(f"🔍 [Checkpoint 1] Checking transcription usage for user: {user_uuid}")
        session = next(get_db_session())
        usage_repo = UsageRepository(session)
        
        try:
            # Fetch user's current transcription usage data
            usage_data = usage_repo.get_transcription_usage(user_uuid)
            
            if usage_data:
                # User has usage table, check if current usage exceeds limit
                current_used = usage_data['transcription_used']
                limit = usage_data['transcription_limit']
                
                print(f"📊 [Checkpoint 1] User usage: {current_used}/{limit} minutes")
                
                if current_used >= limit:
                    # Usage limit already exceeded, return immediately
                    print(f"❌ [Checkpoint 1] User {user_uuid} has exceeded transcription limit ({current_used}/{limit} minutes)")
                    session.close()
                    return TranscriptionJobResponse(
                        success=False,
                        error="Transcription limit exceeded. Please upgrade your plan or wait for limit reset."
                    )
                else:
                    # Usage within limit, allow transcription to proceed
                    print(f"✅ [Checkpoint 1] User {user_uuid} within limit, proceeding with transcription")
            else:
                # No usage table found, let transcription proceed
                print(f"ℹ️ [Checkpoint 1] No usage data found for user {user_uuid}, allowing transcription to proceed")
                
        except Exception as usage_check_error:
            print(f"⚠️ [Checkpoint 1] Error checking usage for user {user_uuid}: {usage_check_error}")
            # Allow transcription to proceed on usage check error
            
        finally:
            session.close()
        
        # Get AssemblyAI API key from server environment
        api_key = os.getenv("ASSEMBLYAI_API_KEY")
        if not api_key:
            print("❌ AssemblyAI API key not configured on server")
            return TranscriptionJobResponse(
                success=False,
                error="Transcription service not configured. Contact administrator."
            )
        
        # Create job ID
        job_id = f"transcribe_{int(time.time() * 1000)}_{str(uuid.uuid4())[:8]}"
        
        # Save uploaded audio file temporarily
        audio_id = f"audio_{int(time.time() * 1000)}_{str(uuid.uuid4())[:8]}"
        temp_audio_path = UPLOADS_DIR / f"{audio_id}_{audio_file.filename or 'recording.m4a'}"
        
        print(f"💾 [Job {job_id}] Saving audio file: {temp_audio_path}")
        async with aiofiles.open(temp_audio_path, 'wb') as f:
            content = await audio_file.read()
            await f.write(content)
        
        # Create job entry
        job_entry = {
            'job_id': job_id,
            'status': 'queued',
            'transcript': None,
            'error': None,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        async with job_lock:
            transcription_jobs[job_id] = job_entry
        
        # Start background processing (non-blocking) with user data for usage tracking
        asyncio.create_task(process_transcription_job(job_id, temp_audio_path, user_uuid, duration_seconds))
        
        print(f"🚀 [Job {job_id}] Transcription job queued for background processing")
        
        return TranscriptionJobResponse(
            success=True,
            job_id=job_id
        )
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ [Async] Failed to queue transcription job: {error_msg}")
        return TranscriptionJobResponse(
            success=False,
            error=f"Failed to queue transcription: {error_msg}"
        )

@app.get("/transcribe/{job_id}")
async def get_transcription_status(job_id: str) -> TranscriptionJobStatus:
    """
    Get the status of a transcription job
    """
    async with job_lock:
        job = transcription_jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return TranscriptionJobStatus(**job)

# Main transcription endpoint (now async and non-blocking)
@app.post("/transcribe")
async def transcribe_audio(audio_file: UploadFile = File(...)) -> TranscriptionJobResponse:
    """
    Non-blocking transcription endpoint that returns job ID immediately.
    This prevents blocking the main thread and allows concurrent processing.
    """
    print(f"🎤 Transcription request received: {audio_file.filename}")
    
    try:
        # Get AssemblyAI API key from server environment
        api_key = os.getenv("ASSEMBLYAI_API_KEY")
        if not api_key:
            print("❌ AssemblyAI API key not configured on server")
            return TranscriptionResponse(
                success=False,
                error="Transcription service not configured. Contact administrator."
            )
        
        # Save uploaded audio file temporarily
        audio_id = f"audio_{int(time.time() * 1000)}_{str(uuid.uuid4())[:8]}"
        temp_audio_path = UPLOADS_DIR / f"{audio_id}_{audio_file.filename}"
        
        print(f"💾 Saving audio file: {temp_audio_path}")
        async with aiofiles.open(temp_audio_path, 'wb') as f:
            content = await audio_file.read()
            await f.write(content)
        
        print(f"📤 Uploading to AssemblyAI...")
        
        # Upload audio to AssemblyAI using raw binary uploadsuidhshdh
        with open(temp_audio_path, 'rb') as f:
            file_content = f.read()
            upload_response = requests.post(
                'https://api.assemblyai.com/v2/upload',
                data=file_content,
                headers={
                    'authorization': api_key,
                    'content-type': 'application/octet-stream'
                },
                # timeout=60
            )
        
        if upload_response.status_code != 200:
            print(f"❌ Upload failed: {upload_response.status_code}")
            return TranscriptionResponse(
                success=False,
                error=f"Audio upload failed with status {upload_response.status_code}"
            )
        
        upload_url = upload_response.json()['upload_url']
        print(f"✅ Audio uploaded successfully")
        
        # Request transcription
        transcript_request = {
            'audio_url': upload_url,
            'language_code': 'en',
            'punctuate': True,
            'format_text': True
        }
        
        transcript_response = requests.post(
            'https://api.assemblyai.com/v2/transcript',
            json=transcript_request,
            headers={'authorization': api_key},
            timeout=30
        )
        
        if transcript_response.status_code != 200:
            print(f"❌ Transcription request failed: {transcript_response.status_code}")
            return TranscriptionResponse(
                success=False,
                error=f"Transcription request failed with status {transcript_response.status_code}"
            )
        
        transcript_id = transcript_response.json()['id']
        print(f"🔄 Transcription started, ID: {transcript_id}")
        
        # Poll for completion with proper timeout
        max_attempts = 60  # 5 minutes max (5 seconds * 60)
        attempt = 0
        
        while attempt < max_attempts:
            print(f"📊 Polling attempt {attempt + 1}/{max_attempts}")
            
            status_response = requests.get(
                f'https://api.assemblyai.com/v2/transcript/{transcript_id}',
                headers={'authorization': api_key},
                timeout=30
            )
            
            if status_response.status_code != 200:
                print(f"❌ Status check failed: {status_response.status_code}")
                break
            
            result = status_response.json()
            status = result['status']
            
            if status == 'completed':
                transcript_text = result.get('text', '')
                print(f"✅ Transcription completed: {len(transcript_text)} characters")
                
                # Clean up temporary file
                try:
                    temp_audio_path.unlink()
                    print(f"🗑️ Temporary audio file deleted")
                except Exception as cleanup_error:
                    print(f"⚠️ Failed to cleanup temp file: {cleanup_error}")
                
                return TranscriptionResponse(
                    success=True,
                    transcript=transcript_text
                )
            
            elif status == 'error':
                error_msg = result.get('error', 'Unknown transcription error')
                print(f"❌ Transcription failed: {error_msg}")
                return TranscriptionResponse(
                    success=False,
                    error=f"Transcription failed: {error_msg}"
                )
            
            # Wait before next poll (with backoff)
            wait_time = min(5 + (attempt * 0.5), 10)  # Increase wait time gradually, max 10s
            await asyncio.sleep(wait_time)
            attempt += 1
        
        # Timeout reached
        print(f"⏰ Transcription timeout after {max_attempts} attempts")
        return TranscriptionResponse(
            success=False,
            error="Transcription timeout - please try with shorter audio"
        )
        
    except Exception as error:
        print(f"❌ Transcription error: {error}")
        return TranscriptionResponse(
            success=False,
            error=f"Transcription failed: {str(error)}"
        )
    finally:
        # Ensure cleanup on any exit
        try:
            if 'temp_audio_path' in locals() and temp_audio_path.exists():
                temp_audio_path.unlink()
                print(f"🗑️ Cleanup: Temporary audio file deleted")
        except Exception as cleanup_error:
            print(f"⚠️ Final cleanup failed: {cleanup_error}")

# List all files

# Delete file
@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    print(f'🌐 DELETE /file/{file_id} - Content-Type: application/json - Origin: None')
    print(f'🗑️ Deleting file: {file_id}')

    try:
        print(f'🗑️ Starting complete file deletion for: {file_id}')

        # Remove from vector database/RAG index first, then delete local files
        try:
            if rag_service:
                # Get detailed status 
                detailed_status = rag_service.get_detailed_status()
                print(f'🔍 RAG Service detailed status for deletion: {detailed_status}')

                if rag_service.is_ready_for_deletion():
                    print(f'🗑️ Removing from vector database: {file_id}')
                    await rag_service.vector_database_service.remove_document(file_id)
                    print(f'✅ Removed from vector database: {file_id}')
                else:
                    print(f'⚠️ RAG service not ready for deletion. Status: {detailed_status}')
            else:
                print(f'⚠️ RAG service not available for document {file_id}')
        except Exception as vector_error:
            print(f'⚠️ Vector database removal failed: {vector_error} for document {file_id}')

        # Now delete only the local file and metadata (without vector DB deletion)
        # await file_service.delete_local_file_only(file_id)
        # print(f"✅ Local file and metadata deleted successfully: {file_id}")

        return {"success": True, "message": "File deleted successfully"}
    except HTTPException as http_exc:
        # Re-raise HTTP exceptions to be handled by FastAPI's exception handler
        raise http_exc
    except Exception as error:
        print(f"❌ Failed to delete file: {error}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(error)}")

# Delete workspace and all its files
@app.delete("/workspace/{workspace_id}")
async def delete_workspace(workspace_id: str, request: Request):
    workspace = await request.json()
    print(f"🗑️ Deleting workspace: {workspace_id}")
    print(f"🗑️ Workspace data: {workspace}")
    
    try:
        # First attempt: Use vector database workspace deletion (efficient bulk deletion)
        try:
            if rag_service and rag_service.is_ready_for_deletion():
                print(f"🗑️ Attempting bulk workspace deletion via vector database for: {workspace_id}")
                await rag_service.vector_database_service.remove_workspace_metadata(workspace_id)
                print(f"✅ Bulk workspace deletion successful for: {workspace_id}")
                return {"success": True, "message": "Workspace deleted successfully via bulk deletion"}
            else:
                print(f"⚠️ RAG service not ready for deletion, falling back to individual file deletion")
                raise Exception("RAG service not ready for bulk deletion")
        
        except Exception as bulk_error:
            print(f"⚠️ Bulk workspace deletion failed: {bulk_error}")
            print(f"🔄 Falling back to individual file deletion for workspace: {workspace_id}")
            
            # Fallback: Delete files one by one
            deleted_files = []
            failed_files = []
            
            for file in workspace.get("files", []):
                try:
                    file_id = str(file["id"])
                    print(f"🗑️ Deleting individual file: {file_id}")
                    await delete_file(file_id)
                    deleted_files.append(file_id)
                    print(f"✅ Successfully deleted file: {file_id}")
                except Exception as file_error:
                    print(f"❌ Failed to delete file {file_id}: {file_error}")
                    failed_files.append({"id": file_id, "error": str(file_error)})
            
            if failed_files:
                print(f"⚠️ Workspace deletion completed with some failures: {len(failed_files)} files failed")
                return {
                    "success": True, 
                    "message": f"Workspace partially deleted: {len(deleted_files)} files deleted, {len(failed_files)} files failed",
                    "deleted_files": deleted_files,
                    "failed_files": failed_files
                }
            else:
                print(f"✅ All files deleted successfully via individual deletion for workspace: {workspace_id}")
                return {"success": True, "message": "Workspace deleted successfully via individual file deletion"}
    
    except Exception as error:
        print(f"❌ Complete workspace deletion failed for {workspace_id}: {error}")
        raise HTTPException(status_code=500, detail=f"Failed to delete workspace: {str(error)}")

# Workspace mixed file and URL upload endpoint
@app.post("/upload/workspace")
async def upload_workspace(
    workspaceId: Optional[str] = Form(None),
    urls: Optional[str] = Form(None),
    files: List[UploadFile] = File(default= [])
):
    try:
        # Generate a default workspace ID if none provided (single file mode)
        effective_workspace_id = workspaceId or f"single_{int(time.time() * 1000)}"
        mode = "workspace" if workspaceId else "single"

        print(f"📤 Mixed upload request received - Mode: {mode}")
        print(f"🏢 Workspace ID: {effective_workspace_id}")
        print(f"📄 Number of device files: {len(files)}")

        # Parse URLs from FormData
        parsed_urls = []
        if urls:
            try:
                parsed_urls = json.loads(urls)
                print(f"🌐 Number of URLs received: {len(parsed_urls)}")
                for i, url_info in enumerate(parsed_urls):
                    print(f"🌐 URL {i + 1}: {url_info.get('url')} ({url_info.get('type')})")
            except json.JSONDecodeError as parse_error:
                print(f"❌ Failed to parse URLs: {parse_error}")

        uploaded_files_metadata = [] # Store metadata for indexing
        errors = []

        # Process uploaded files
        for i, file in enumerate(files):
            try:
                print(f"📤 Processing device file {i + 1}/{len(files)}: {file.filename}")

                file_id = f"{int(time.time() * 1000)}{str(uuid.uuid4()).replace('-', '')[:9]}" # Use time.time() for more precise IDs
                file_path_on_disk = UPLOADS_DIR / f"{file_id}_{file.filename}"

                # Save uploaded file
                async with aiofiles.open(file_path_on_disk, 'wb') as f:
                    content = await file.read()
                    await f.write(content)

                file_info = {
                    "id": file_id,
                    "originalName": file.filename,
                    "mimetype": file.content_type,
                    "size": len(content),
                    "path": str(file_path_on_disk),
                    "uploadDate": datetime.now().isoformat(),
                    "workspaceId": effective_workspace_id,
                }

                print(f"💾 Saving metadata for device file {i + 1}: {file_info['id']}")
                await file_service.save_file_metadata(file_info)

                print(f"🔄 Processing upload for device file {i + 1}...")
                processed_file_details = await file_service.process_file_upload(file_info)

                print(f"🖼️ Generating preview for device file {i + 1}...")
                try:
                    await file_service.generate_preview(file_info)
                    print(f"✅ Preview generated for device file {i + 1}")
                except Exception as preview_error:
                    print(f"❌ Preview generation failed for device file {i + 1}: {preview_error}")

                # Prepare metadata for RAG indexing
                rag_file_metadata = {
                    "id": file_id,
                    "originalName": file.filename,
                    "mimetype": file.content_type,
                    "size": len(content),
                    "path": str(file_path_on_disk),
                    "uploadDate": datetime.now().isoformat(),
                    "workspaceId": effective_workspace_id,
                    "sourceUrl": None,
                    "sourceType": "upload",
                    "isProcessed": True,
                    "cloudinary": processed_file_details.get("cloudinary") # Include Cloudinary data if available
                }
                uploaded_files_metadata.append(rag_file_metadata)

                print(f"✅ Successfully processed device file {i + 1}: {file.filename}")

            except Exception as file_error:
                print(f"❌ Failed to process device file {i + 1} ({file.filename}): {file_error}")
                errors.append({
                    "filename": file.filename,
                    "error": str(file_error),
                    "type": "device"
                })

        # Process URLs
        for i, url_info in enumerate(parsed_urls):
            url = url_info.get("url")
            file_id = f"{int(time.time() * 1000)}{str(uuid.uuid4()).replace('-', '')[:9]}" # Use time.time() for more precise IDs

            try:
                print(f"🌐 Processing URL {i + 1}/{len(parsed_urls)}: {url} ({url_info.get('type')})")

                original_name = None
                mimetype = None
                file_path_on_disk = None # Path to the saved file
                processed_file_details = None # Details from file_service.process_file_upload

                if url_info.get("type") in ["from_url", "url"]:
                    # Download PDF from URL
                    print(f"📥 Downloading PDF from URL: {url}")
                    download_result = await url_download_service.download_pdf(url, file_id)

                    if not download_result.get("success"):
                        raise Exception(f"Failed to download PDF: {download_result.get('error', 'Unknown error')}")

                    # Read the downloaded file content
                    async with aiofiles.open(download_result["filePath"], 'rb') as f:
                        file_content = await f.read()

                    original_name = download_result["fileName"]
                    mimetype = download_result["mimetype"]
                    file_path_on_disk = UPLOADS_DIR / f"{file_id}_{original_name}"

                    # Save the downloaded file
                    async with aiofiles.open(file_path_on_disk, 'wb') as f:
                        await f.write(file_content)
                    print(f"✅ Saved downloaded content to: {file_path_on_disk}")

                    # Clean up the temporary download file
                    os.unlink(download_result["filePath"])
                    print(f"🧹 Cleaned up temporary download file: {download_result['filePath']}")

                    # Process the saved file (e.g., for Cloudinary upload)
                    file_metadata_for_processing = {
                        "id": file_id,
                        "originalName": original_name,
                        "mimetype": mimetype,
                        "size": len(file_content),
                        "path": str(file_path_on_disk),
                        "uploadDate": datetime.now().isoformat(),
                        "workspaceId": effective_workspace_id,
                    }
                    processed_file_details = await file_service.process_file_upload(file_metadata_for_processing)

                elif url_info.get("type") == "webpage":
                    print(f'🌐 Processing webpage URL directly with crawler: {url}')
                    # Skip file storage for webpages - pass URL directly to processing
                    original_name = f'webpage_{file_id}' # Placeholder, actual name might come from crawler
                    mimetype = 'text/plain'
                    file_path_on_disk = None # No local file path for webpages
                    processed_file_details = None # No Cloudinary processing for webpages

                    # The `rag_service.index_document` will handle crawling and text extraction
                    # by receiving the URL directly.

                else:
                    raise Exception(f"Unsupported URL type: {url_info.get('type')}")

                # Save file metadata (skip for webpages as they don't need local storage)
                rag_file_metadata = {
                    'id': file_id,
                    'originalName': original_name,
                    'mimetype': mimetype,
                    'size': processed_file_details.get("size") if processed_file_details else (len(file_content) if 'file_content' in locals() else 0),
                    'path': str(file_path_on_disk) if file_path_on_disk else None,
                    'uploadDate': datetime.now().isoformat(),
                    'workspaceId': effective_workspace_id,
                    'sourceUrl': url,
                    'sourceType': url_info['type'],
                    'isProcessed': True if processed_file_details or url_info.get("type") == "webpage" else False,
                    'cloudinary': processed_file_details.get("cloudinary") if processed_file_details else None
                }

                if url_info['type'] != 'webpage':
                    print(f"💾 Saving metadata for URL {i + 1}: {rag_file_metadata['id']}")
                    await file_service.save_file_metadata(rag_file_metadata)
                else:
                    print('🌐 Skipping metadata creation for webpage')

                uploaded_files_metadata.append(rag_file_metadata)

                print(f"✅ Successfully processed URL {i + 1}: {url}")

            except Exception as url_error:
                print(f"❌ Failed to process URL {i + 1} ({url}): {url_error}")
                errors.append({
                    "filename": url,
                    "error": str(url_error),
                    "type": url_info.get("type")
                })

        # Process documents with RAG service for indexing
        print(f'\n📚 Starting document processing and indexing for {len(uploaded_files_metadata)} items...')
        indexed_count = 0
        for item_metadata in uploaded_files_metadata:
            try:
                print(f"📚 Indexing item: ID={item_metadata['id']}, Name={item_metadata['originalName']}, Type={item_metadata['sourceType']}")
                if not rag_service.is_ready_for_indexing():
                    print(f"⚠️ RAG service not ready for indexing item {item_metadata['id']}, skipping.")
                    print(f"🔧 RAG status: initialized={rag_service.is_initialized}, ready_for_indexing={rag_service.is_ready_for_indexing()}")
                    continue

                if item_metadata['sourceType'] == 'webpage':
                    # For webpages, pass the URL directly to the RAG service for crawling and indexing
                    print(f"🌐 Processing webpage directly for RAG: {item_metadata['sourceUrl']}")
                    index_result = await rag_service.index_document(
                        item_metadata['id'],
                        item_metadata['sourceUrl'],  # Pass URL directly
                        item_metadata
                    )
                else:
                    # For other file types, use the file path
                    if not item_metadata.get('path'):
                        print(f"❌ Skipping RAG indexing for item {item_metadata['id']}: No file path available.")
                        continue
                    index_result = await rag_service.index_document(
                        item_metadata['id'],
                        item_metadata['path'],
                        item_metadata
                    )

                print(f"✅ RAG indexing completed for item {item_metadata['id']}: {index_result.get('chunksCount', 0)} chunks")
                indexed_count += 1

                # Only delete local files for non-webpage items (webpages don't have local files)
                if item_metadata['sourceType'] != 'webpage':
                    print(f"🧹 Deleting local file for {item_metadata['sourceType']} item: {item_metadata['id']}")
                    await file_service.delete_local_file_only(item_metadataa['id'])
                else:
                    print(f"🌐 Skipping local file deletion for webpage item: {item_metadata['id']} (no local file to delete)")

                # Start background summary generation (non-blocking)
                asyncio.create_task(generate_file_summary_background(
                    item_metadata['id'],
                    item_metadata['originalName'],
                    effective_workspace_id
                ))
            except Exception as rag_index_error:
                print(f"❌ RAG indexing failed for item {item_metadata['id']}: {rag_index_error}")
                # Add to errors if needed, or handle gracefully
                errors.append({
                    "id": item_metadata['id'],
                    "filename": item_metadata.get('originalName', item_metadata.get('sourceUrl')),
                    "error": f"RAG indexing failed: {str(rag_index_error)}",
                    "type": item_metadata['sourceType']
                })

        if not uploaded_files_metadata:
            raise HTTPException(status_code=400, detail="No files or URLs were provided for upload")

        # Include file details for frontend to match WebSocket notifications
        file_details = []
        for item in uploaded_files_metadata:
            file_details.append({
                "id": item['id'],
                "originalName": item['originalName'],
                "mimetype": item.get('mimetype', 'application/pdf'),
                "size": item.get('size', 0),
                "uploadDate": item.get('uploadDate', datetime.now().isoformat())
            })

        response = {
            "success": True,
            "mode": mode,
            "workspaceId": effective_workspace_id,
            "filesProcessed": len(uploaded_files_metadata),
            "filesIndexed": indexed_count,
            "totalItems": len(files) + len(parsed_urls),
            "files": file_details,  # Include actual file IDs for WebSocket matching
            "errors": errors if errors else None
        }

        print(f"📤 Mixed upload completed ({mode} mode): {len(uploaded_files_metadata)} items processed, {indexed_count} indexed.")
        return response

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions to be handled by FastAPI's exception handler
        raise http_exc
    except Exception as error:
        print(f"❌ Workspace mixed upload error: {error}")
        raise HTTPException(status_code=500, detail=f"Workspace mixed upload failed: {str(error)}")

# File upload endpoint
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    workspaceId: Optional[str] = Form(None)
):
    try:
        print("📤 File upload request received")
        print(f"📄 File info: {file.filename}, {file.content_type}, {file.size}")

        if workspaceId:
            print(f"🏢 File uploaded for workspace: {workspaceId}")

        file_id = f"{int(time.time() * 1000)}{str(uuid.uuid4()).replace('-', '')[:9]}"
        file_path_on_disk = UPLOADS_DIR / f"{file_id}_{file.filename}"

        # Save uploaded file
        async with aiofiles.open(file_path_on_disk, 'wb') as f:
            content = await file.read()
            await f.write(content)

        # Generate effective workspace ID for consistency
        effective_workspace_id = workspaceId or f"single_{int(time.time() * 1000)}"

        file_info = {
            "id": file_id,
            "originalName": file.filename,
            "mimetype": file.content_type,
            "size": len(content),
            "path": str(file_path_on_disk),
            "uploadDate": datetime.now().isoformat(),
            "workspaceId": effective_workspace_id,
        }

        print(f"🏷️ Generated file info: {file_info}")

        print("💾 Saving file metadata...")
        await file_service.save_file_metadata(file_info)
        print("✅ File metadata saved")

        print("🔄 Processing file upload...")
        try:
            processed_file = await file_service.process_file_upload(file_info)
            print("✅ File processing completed")
        except Exception as process_error:
            print(f"❌ File processing failed: {process_error}")
            processed_file = {
                "id": file_info["id"],
                "originalName": file_info["originalName"],
                "mimetype": file_info["mimetype"],
                "size": file_info["size"],
                "uploadDate": file_info["uploadDate"],
                "cloudinary": None
            }

        print("🖼️ Generating preview...")
        try:
            await file_service.generate_preview(file_info)
            print("✅ Preview generated successfully")
        except Exception as preview_error:
            print(f"❌ Preview generation failed: {preview_error}")

        # Start background summary generation (non-blocking) for single file upload
        print(f"📋 Starting background summary generation for single file: {file_id}")
        asyncio.create_task(generate_file_summary_background(
            file_id,
            file_info['originalName'],
            effective_workspace_id
        ))

        response = {
            "success": True,
            "file": processed_file
        }

        print(f"📤 Sending success response: {response}")
        return response

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions to be handled by FastAPI's exception handler
        raise http_exc
    except Exception as error:
        print(f"❌ Upload error: {error}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(error)}")

# Get file preview
@app.get("/preview/{file_id}")
async def get_preview(file_id: str):
    try:
        print(f"🔍 Getting preview for file ID: {file_id}")

        try:
            file_urls = await file_service.get_file_urls(file_id)

            if file_urls and file_urls.get("urls") and file_urls["urls"].get("thumbnailUrl"):
                print(f"✅ Redirecting to Cloudinary thumbnail: {file_urls['urls']['thumbnailUrl']}")
                return RedirectResponse(url=file_urls['urls']['thumbnailUrl'])
        except Exception as url_error:
            print(f"⚠️ Cloudinary URLs not available for file: {file_id}, trying local preview")

        # Fallback to local preview if Cloudinary not available
        file_info = await file_service.get_file_metadata(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        preview_path = PREVIEWS_DIR / f"{file_id}.jpg"

        # Check if local preview exists
        if preview_path.exists():
            print(f"✅ Serving local preview: {preview_path}")
            return FileResponse(
                preview_path,
                media_type="image/jpeg",
                headers={"Cache-Control": "public, max-age=3600"}
            )
        else:
            print(f"❌ No preview available for file: {file_id}")
            raise HTTPException(status_code=404, detail="Preview not found")

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions to be handled by FastAPI's exception handler
        raise http_exc
    except Exception as error:
        print(f"❌ Preview error: {error}")
        raise HTTPException(status_code=500, detail="Failed to serve preview")

# Get full file
@app.get("/file/{file_id}")
async def get_file(file_id: str):
    try:
        print(f"🔍 Getting file: {file_id}")

        try:
            file_urls = await file_service.get_file_urls(file_id)

            if file_urls and file_urls.get("urls"):
                # Determine which URL to use based on file type
                redirect_url = None
                if file_urls["mimetype"] == "application/pdf" and file_urls["urls"].get("fullPdfUrl"):
                    redirect_url = file_urls["urls"]["fullPdfUrl"]
                elif file_urls["urls"].get("fullUrl"):
                    redirect_url = file_urls["urls"]["fullUrl"]
                else:
                    redirect_url = file_urls["urls"].get("secureUrl")

                if redirect_url:
                    print(f"✅ Redirecting to Cloudinary URL: {redirect_url}")
                    return RedirectResponse(url=redirect_url)
        except Exception as url_error:
            print(f"⚠️ Cloudinary URLs not available for file: {file_id}, serving local file")

        # Fallback to local file if Cloudinary not available
        file_info = await file_service.get_file_metadata(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        print(f"✅ Serving local file: {file_info['path']}")
        return FileResponse(
            file_info["path"],
            media_type=file_info["mimetype"],
            filename=file_info["originalName"]
        )

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions to be handled by FastAPI's exception handler
        raise http_exc
    except Exception as error:
        print(f"❌ File serving error: {error}")
        raise HTTPException(status_code=500, detail="Failed to serve file")

# Download endpoint for uncommon file types
@app.get("/download/{file_id}")
async def download_file(file_id: str):
    try:
        file_info = await file_service.get_file_metadata(file_id)

        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        return FileResponse(
            file_info["path"],
            media_type="application/octet-stream",
            filename=file_info["originalName"]
        )
    except HTTPException as http_exc:
        # Re-raise HTTP exceptions to be handled by FastAPI's exception handler
        raise http_exc
    except Exception as error:
        print(f"❌ Download error: {error}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(error)}")



# RAG endpoints
@app.post("/rag/index/{file_id}")
async def rag_index(file_id: str, request: RAGIndexRequest):
    print(f"🔄 RAG: Received indexing request")
    print(f"📄 File ID: {file_id}")
    print(f"🏢 Request body: {request}")

    start_time = time.time() # Use time.time() for more accurate duration measurement
    try:
        print(f"🔍 Looking for file metadata: {file_id}")

        # Get file metadata from fileService
        file_info = await file_service.get_file_metadata(file_id)

        if not file_info:
            print(f"❌ File metadata not found for ID: {file_id}")
            raise HTTPException(status_code=404, detail="File not found")

        print(f"📊 File metadata: {file_info}")

        file_path = file_info.get("path") # Use .get for safety
        print(f"📁 File path from metadata: {file_path}")
        if file_path:
            print(f"📁 File exists: {Path(file_path).exists()}")
            if not Path(file_path).exists():
                print(f"❌ File not found on disk: {file_path}")
                raise HTTPException(status_code=404, detail="File not found on disk")
        else:
            # Handle cases where path might be missing (e.g., for URLs handled differently)
            print(f"⚠️ No file path found for item {file_id}. Indexing might rely on direct URL processing.")

        print(f"🔄 Starting RAG indexing process...")
        print(f"📄 Indexing parameters: fileId={file_id}, filePath={file_path}, fileName={file_info['originalName']}, workspaceId={request.workspaceId}")

        # Detect content type from file info
        content_type = 'pdf' if file_info.get('mimetype') == 'application/pdf' else 'text'

        # Index the document using RAG service with content type
        result = await rag_service.index_document(
            file_id,
            file_path, # This might be a URL if the source was a webpage
            file_info["originalName"],
            request.workspaceId,
            file_info.get("cloudinary"),
            content_type
        )

        processing_time = (time.time() - start_time) * 1000
        print(f"✅ RAG indexing completed successfully in {processing_time:.2f}ms")
        print(f"📊 Indexing result: {result}")

        return {
            "success": True,
            "message": "Document indexed successfully",
            "chunksCount": result.get("chunksCount"),
            "processingTime": processing_time
        }

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions to be handled by FastAPI's exception handler
        raise http_exc
    except Exception as error:
        processing_time = (time.time() - start_time) * 1000
        print(f"❌ RAG indexing error after {processing_time:.2f}ms")
        print(f"❌ Error type: {type(error).__name__}")
        print(f"❌ Error message: {error}")

        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to index document",
                "details": str(error),
                "processingTime": processing_time
            }
        )


@app.post("/rag/query")
async def rag_query(request: RAGQueryRequest):
    start_time = time.time()
    print(f"🔍 RAG: Received query request")
    print(f"❓ Query: {request.query}")
    print(f"📄 File IDs: {request.fileIds}")
    print(f"🏢 Workspace ID: {request.workspaceId}")

    try:
        if not request.query or not request.query.strip():
            print("❌ RAG query error: Query is required")
            raise HTTPException(status_code=400, detail="Query is required")

        print(f"🔄 Starting RAG query process...")
        result = await rag_service.generate_answer(request.query, request.fileIds, request.workspaceId)

        processing_time = (time.time() - start_time) * 1000
        print(f"✅ RAG query completed successfully in {processing_time:.2f}ms")
        print(f"💡 Answer: {result.get('answer')}")
        print(f"📚 Sources: {result.get('sources')}")
        print(f"✅ Confidence: {result.get('confidence')}")

        return {
            "success": True,
            "answer": result.get("answer"),
            "sources": result.get("sources"),
            "confidence": result.get("confidence"),
            "follow_up_questions": result.get("follow_up_questions", []),
            "processingTime": processing_time
        }

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions to be handled by FastAPI's exception handler
        raise http_exc
    except Exception as error:
        processing_time = (time.time() - start_time) * 1000
        print(f"❌ RAG query error after {processing_time:.2f}ms")
        print(f"❌ Error type: {type(error).__name__}")
        print(f"❌ Error message: {error}")

        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to process query",
                "details": str(error),
                "processingTime": processing_time
            }
        )

@app.post("/rag/summary/{file_id}")
async def generate_summary(file_id: str, request: RAGIndexRequest):
    """
    Generate summary for a specific file (manual trigger)
    """
    try:
        print(f"🔄 Manual summary generation requested for file: {file_id}")

        # Get file metadata
        file_info = await file_service.get_file_metadata(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        # Start background summary generation
        asyncio.create_task(generate_file_summary_background(
            file_id,
            file_info['originalName'],
            request.workspaceId
        ))

        return {
            "success": True,
            "message": "Summary generation started",
            "fileId": file_id
        }

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions to be handled by FastAPI's exception handler
        raise http_exc
    except Exception as error:
        print(f"❌ Manual summary generation failed: {error}")
        raise HTTPException(status_code=500, detail=f"Failed to start summary generation: {str(error)}")

@app.get("/rag/health")
async def rag_health_check():
    """Check RAG service health"""
    try:
        print("🏥 RAG: Starting health check")
        health_status = await rag_service.health_check()

        # Add readiness checks
        health_status['ready_for_indexing'] = rag_service.is_ready_for_indexing()
        health_status['ready_for_search'] = rag_service.is_ready_for_search()

        # Add component status
        health_status['components'] = {
            'embedding_service': rag_service.embedding_service is not None,
            'vector_database_service': rag_service.vector_database_service is not None,
            'document_indexing_service': rag_service.document_indexing_service is not None,
            'search_service': rag_service.search_service is not None,
            'answer_generation_service': rag_service.answer_generation_service is not None,
            'chunking_service': rag_service.chunking_service is not None
        }

        print(f"🏥 RAG: Health check completed - Status: {health_status.get('status')}")
        print(f"🏥 RAG: Ready for indexing: {health_status['ready_for_indexing']}")
        print(f"🏥 RAG: Ready for search: {health_status['ready_for_search']}")
        return health_status
    except Exception as e:
        print(f"❌ RAG: Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "qdrant": False,
            "genaiEmbedding": False,
            "genaiChat": False,
            "initialized": False,
            "ready_for_indexing": False,
            "ready_for_search": False,
            "components": {
                'embedding_service': False,
                'vector_database_service': False,
                'document_indexing_service': False,
                'search_service': False,
                'answer_generation_service': False,
                'chunking_service': False
            }
        }

# 404 handler
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    print(f"❌ 404 Not Found for: {request.method} {request.url.path}")
    return JSONResponse(status_code=404, content={"error": "Endpoint not found"})

# Socket.IO is handled by the socket_app wrapper

# Error handling
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    print(f"❌ Unhandled error occurred for: {request.method} {request.url.path}")
    print(f"❌ Error type: {type(exc).__name__}")
    print(f"❌ Error message: {exc}")

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "details": str(exc) if os.getenv("NODE_ENV") == "development" else "An unexpected error occurred."
        }
    )

# Startup/shutdown events now handled by the lifespan function above

# Server startup logic
async def start_server():
    print(f"📁 Uploads directory: {UPLOADS_DIR}")
    print(f"🖼️ Previews directory: {PREVIEWS_DIR}")
    print(f"🗂️ Metadata directory: {METADATA_DIR}")

    # Log environment variables status with actual values (masked for security)
    print("🔧 Environment Variables Check:")

    # Basic server config
    port_val = os.getenv('PORT', '5000')
    node_env_val = os.getenv('NODE_ENV', 'development')
    print(f"   PORT: {port_val}")
    print(f"   NODE_ENV: {node_env_val}")

    # CORS origins
    allowed_origins = os.getenv('ALLOWED_ORIGINS', '')
    print(f"   ALLOWED_ORIGINS: {'✅ Set' if allowed_origins else '❌ Not set'} (length: {len(allowed_origins)})")

    # File upload config
    max_file_size = os.getenv('MAX_FILE_SIZE', '')
    upload_dir_env = os.getenv('UPLOAD_DIR', '')
    preview_dir_env = os.getenv('PREVIEW_DIR', '')
    print(f"   MAX_FILE_SIZE: {'✅ Set' if max_file_size else '❌ Not set'} ({max_file_size})")
    print(f"   UPLOAD_DIR: {'✅ Set' if upload_dir_env else '❌ Not set'} ({upload_dir_env})")
    print(f"   PREVIEW_DIR: {'✅ Set' if preview_dir_env else '❌ Not set'} ({preview_dir_env})")

    # RAG/Vector DB config
    qdrant_url = os.getenv('QDRANT_URL', '')
    qdrant_key = os.getenv('QDRANT_API_KEY', '')
    print(f"   QDRANT_URL: {'✅ Set' if qdrant_url else '❌ Not set'} ({qdrant_url})")
    print(f"   QDRANT_API_KEY: {'✅ Set' if qdrant_key else '❌ Not set'} ({'*' * min(len(qdrant_key), 8) if qdrant_key else 'None'})")

    # Gemini API keys
    gemini_embedding_key = os.getenv('GEMINI_EMBEDDING_API_KEY', '')
    gemini_chat_key = os.getenv('GEMINI_CHAT_API_KEY', '')
    print(f"   GEMINI_EMBEDDING_API_KEY: {'✅ Set' if gemini_embedding_key else '❌ Not set'} ({'*' * min(len(gemini_embedding_key), 8) if gemini_embedding_key else 'None'})")
    print(f"   GEMINI_CHAT_API_KEY: {'✅ Set' if gemini_chat_key else '❌ Not set'} ({'*' * min(len(gemini_chat_key), 8) if gemini_chat_key else 'None'})")

    # Cloudinary config
    cloudinary_cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME', '')
    cloudinary_api_key = os.getenv('CLOUDINARY_API_KEY', '')
    cloudinary_api_secret = os.getenv('CLOUDINARY_API_SECRET', '')
    cloudinary_upload_preset = os.getenv('CLOUDINARY_UPLOAD_PRESET', '')
    print(f"   CLOUDINARY_CLOUD_NAME: {'✅ Set' if cloudinary_cloud_name else '❌ Not set'} ({cloudinary_cloud_name})")
    print(f"   CLOUDINARY_API_KEY: {'✅ Set' if cloudinary_api_key else '❌ Not set'} ({'*' * min(len(cloudinary_api_key), 8) if cloudinary_api_key else 'None'})")
    print(f"   CLOUDINARY_API_SECRET: {'✅ Set' if cloudinary_api_secret else '❌ Not set'} ({'*' * min(len(cloudinary_api_secret), 8) if cloudinary_api_secret else 'None'})")
    print(f"   CLOUDINARY_UPLOAD_PRESET: {'✅ Set' if cloudinary_upload_preset else '❌ Not set'} ({cloudinary_upload_preset})")

    # Performance config
    preview_cache_ttl = os.getenv('PREVIEW_CACHE_TTL', '')
    rate_limit_window = os.getenv('RATE_LIMIT_WINDOW', '')
    rate_limit_max = os.getenv('RATE_LIMIT_MAX', '')
    print(f"   PREVIEW_CACHE_TTL: {'✅ Set' if preview_cache_ttl else '❌ Not set'} ({preview_cache_ttl})")
    print(f"   RATE_LIMIT_WINDOW: {'✅ Set' if rate_limit_window else '❌ Not set'} ({rate_limit_window})")
    print(f"   RATE_LIMIT_MAX: {'✅ Set' if rate_limit_max else '❌ Not set'} ({rate_limit_max})")

    # Optional AWS config
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID', '')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY', '')
    aws_bucket = os.getenv('AWS_BUCKET_NAME', '')
    aws_region = os.getenv('AWS_REGION', '')
    print(f"   AWS_ACCESS_KEY_ID: {'✅ Set' if aws_access_key else '❌ Not set'} ({'*' * min(len(aws_access_key), 8) if aws_access_key else 'None'})")
    print(f"   AWS_SECRET_ACCESS_KEY: {'✅ Set' if aws_secret_key else '❌ Not set'} ({'*' * min(len(aws_secret_key), 8) if aws_secret_key else 'None'})")
    print(f"   AWS_BUCKET_NAME: {'✅ Set' if aws_bucket else '❌ Not set'} ({aws_bucket})")
    print(f"   AWS_REGION: {'✅ Set' if aws_region else '❌ Not set'} ({aws_region})")

    # Optional Redis config
    redis_url = os.getenv('REDIS_URL', '')
    print(f"   REDIS_URL: {'✅ Set' if redis_url else '❌ Not set'} ({redis_url})")

    # Debug: Show all environment variables that start with common prefixes
    print("🔧 ENV: All environment variables with common prefixes:")
    for key, value in os.environ.items():
        if any(key.startswith(prefix) for prefix in ['QDRANT_', 'GEMINI_', 'CLOUDINARY_', 'AWS_', 'REDIS_', 'PORT', 'NODE_ENV', 'ALLOWED_', 'MAX_', 'UPLOAD_', 'PREVIEW_', 'RATE_', 'METADATA_DIR']):
            masked_value = '*' * min(len(value), 8) if any(sensitive in key.lower() for sensitive in ['key', 'secret', 'password', 'token']) else value
            print(f"     {key}: {masked_value}")

    print(f"🚀 Server running on port {PORT}")
    print(f"🌐 Server accessible at http://0.0.0.0:{PORT}")
    # Check for Replit domain and provide external URL if available
    replit_domain = os.getenv('REPLIT_DEV_DOMAIN')
    if replit_domain:
        print(f"🌐 Replit external URL: https://{replit_domain}:{PORT}")
    print(f"🛡️ Environment: {os.getenv('NODE_ENV', 'development')}")
    print(f"🔧 RAG Service initialized: {'Yes' if 'rag_service' in globals() and rag_service and rag_service.is_initialized else 'No'}")
    print("🎯 All APIs and services status logged above")


# Feedback submission endpoint
@app.post("/feedback")
async def submit_feedback(request: FeedbackRequest):
    """Submit feedback to Airtable"""
    try:
        print(f"📝 Feedback submission received: {request.feedbackType} from {request.platformType}")
        
        # Get Airtable configuration from environment variables
        airtable_base_id = os.getenv('AIRTABLE_BASE_ID')
        airtable_table_name = os.getenv('AIRTABLE_TABLE_NAME', 'Feedback')  # Default table name
        airtable_api_key = os.getenv('AIRTABLE_API_KEY')
        
        if not airtable_base_id or not airtable_api_key:
            print("❌ Airtable configuration missing")
            raise HTTPException(
                status_code=500,
                detail="Airtable configuration not available"
            )
        
        # Prepare Airtable record
        airtable_record = {
            "fields": {
                "Beta Version": "0.0",
                "Feedback Type": request.feedbackType,
                "Status": "New",
                "Feedback": request.feedback,
                "Platform Type": request.platformType
            }
        }
        
        # Add optional fields if available
        if request.userName:
            airtable_record["fields"]["User Name"] = request.userName
        if request.email:
            airtable_record["fields"]["Email"] = request.email
        
        # Send to Airtable (non-blocking)
        airtable_url = f"https://api.airtable.com/v0/{airtable_base_id}/{airtable_table_name}"
        headers = {
            "Authorization": f"Bearer {airtable_api_key}",
            "Content-Type": "application/json"
        }
        
        # Use asyncio to make non-blocking request
        async with aiohttp.ClientSession() as session:
            async with session.post(
                airtable_url,
                json=airtable_record,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    response_data = await response.json()
                    record_id = response_data.get('id')
                    print(f"✅ Feedback submitted successfully to Airtable: {record_id}")
                    
                    return {
                        "success": True,
                        "message": "Feedback submitted successfully",
                        "recordId": record_id
                    }
                else:
                    error_text = await response.text()
                    print(f"❌ Airtable API error: {response.status} - {error_text}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to submit feedback to Airtable: {error_text}"
                    )
                    
    except HTTPException as http_exc:
        raise http_exc
    except Exception as error:
        print(f"❌ Feedback submission error: {error}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit feedback: {str(error)}"
        )


# Beta User endpoints
@app.post("/beta-user/signup")
async def beta_user_signup(request: BetaUserSignupRequest):
    """Sign up a beta user with UUID and optional email"""
    try:
        print(f"📧 Beta user signup request received - UUID: {request.user_uuid}, Email: {request.email}")
        
        # Validate UUID is provided
        if not request.user_uuid or not request.user_uuid.strip():
            raise HTTPException(
                status_code=400,
                detail="User UUID is required"
            )
        
        # Validate email format if provided
        email = None
        if request.email:
            email = request.email.strip().lower()
            if '@' not in email:
                raise HTTPException(
                    status_code=400,
                    detail="Valid email address is required when email is provided"
                )
        
        # Get database session
        session = next(get_db_session())
        beta_user_repo = BetaUserRepository(session)
        
        try:
            # Check if user with this UUID already exists
            existing_user = beta_user_repo.get_beta_user_by_id(request.user_uuid)
            if existing_user:
                # User exists, update email if provided and different
                if email and existing_user.email != email:
                    # Check if email is already used by another user
                    if beta_user_repo.email_exists(email):
                        print(f"⚠️ Email already exists for different user: {email}")
                        return BetaUserResponse(
                            success=False,
                            error="Email already registered by another user"
                        )
                    
                    # Update email
                    updated_user = beta_user_repo.update_beta_user_email(request.user_uuid, email)
                    print(f"✅ Beta user email updated: {updated_user.id}")
                    
                    return BetaUserResponse(
                        success=True,
                        user_id=updated_user.id,
                        email=updated_user.email,
                        message="Email updated successfully"
                    )
                else:
                    # User exists, no email change needed
                    print(f"✅ Beta user already exists: {existing_user.id}")
                    return BetaUserResponse(
                        success=True,
                        user_id=existing_user.id,
                        email=existing_user.email,
                        message="User profile already exists"
                    )
            
            # Check if email already exists (for new user creation)
            if email and beta_user_repo.email_exists(email):
                print(f"⚠️ Email already exists: {email}")
                return BetaUserResponse(
                    success=False,
                    error="Email already registered for beta access"
                )
            
            # Create new beta user with UUID and optional email
            beta_user = beta_user_repo.create_beta_user_with_uuid(request.user_uuid, email)
            print(f"✅ Beta user created successfully: {beta_user.id}")
            
            return BetaUserResponse(
                success=True,
                user_id=beta_user.id,
                email=beta_user.email,
                message="Successfully created user profile"
            )
            
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
            
    except HTTPException as http_exc:
        raise http_exc
    except Exception as error:
        print(f"❌ Beta user signup error: {error}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sign up beta user: {str(error)}"
        )


@app.get("/beta-user/{email}")
async def get_beta_user_by_email(email: str):
    """Get beta user by email"""
    try:
        print(f"📧 Get beta user request: {email}")
        
        # Get database session
        session = next(get_db_session())
        beta_user_repo = BetaUserRepository(session)
        
        try:
            beta_user = beta_user_repo.get_beta_user_by_email(email)
            
            if not beta_user:
                return BetaUserResponse(
                    success=False,
                    error="Beta user not found"
                )
            
            return BetaUserResponse(
                success=True,
                user_id=beta_user.id,
                email=beta_user.email,
                message="Beta user found"
            )
            
        finally:
            session.close()
            
    except Exception as error:
        print(f"❌ Get beta user error: {error}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get beta user: {str(error)}"
        )


@app.put("/beta-user/update")
async def update_beta_user_email(request: BetaUserUpdateRequest):
    """Update beta user email"""
    try:
        print(f"📧 Update beta user email request: {request.user_id} -> {request.email}")
        
        # Validate email format
        email = request.email.strip().lower()
        if not email or '@' not in email:
            raise HTTPException(
                status_code=400,
                detail="Valid email address is required"
            )
        
        # Get database session
        session = next(get_db_session())
        beta_user_repo = BetaUserRepository(session)
        
        try:
            # Check if new email already exists (for different user)
            existing_user = beta_user_repo.get_beta_user_by_email(email)
            if existing_user and existing_user.id != request.user_id:
                return BetaUserResponse(
                    success=False,
                    error="Email already registered by another user"
                )
            
            # Update email
            updated_user = beta_user_repo.update_beta_user_email(request.user_id, email)
            
            if not updated_user:
                return BetaUserResponse(
                    success=False,
                    error="Beta user not found"
                )
            
            print(f"✅ Beta user email updated successfully: {updated_user.id}")
            
            return BetaUserResponse(
                success=True,
                user_id=updated_user.id,
                email=updated_user.email,
                message="Email updated successfully"
            )
            
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
            
    except HTTPException as http_exc:
        raise http_exc
    except Exception as error:
        print(f"❌ Update beta user error: {error}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update beta user: {str(error)}"
        )


if __name__ == "__main__":
    # Running Uvicorn directly with Socket.IO integration
    print("🚀 Starting Python backend server with Socket.IO on port 8000...")
    print("🔌 Socket.IO endpoints will be available at /socket.io/")
    uvicorn.run(socket_app, host="0.0.0.0", port=PORT)