import os
import asyncio
import json
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
import aiofiles
import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
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

if env_path.exists():
    with open(env_path, 'r') as f:
        env_content = f.read()
        print(f"🔧 ENV: .env file content preview (first 200 chars):")
        print(f"🔧 ENV: {env_content[:200]}...")
        print(f"🔧 ENV: Total .env file length: {len(env_content)} characters")

load_dotenv(dotenv_path=env_path)
print(f"🔧 ENV: load_dotenv() called with path: {env_path}")

# Log critical environment variables after loading
print("🔧 ENV: Critical environment variables status:")
print(f"   QDRANT_URL: {'✅ Set' if os.getenv('QDRANT_URL') else '❌ Not set'} ({os.getenv('QDRANT_URL', 'None')})")
print(f"   QDRANT_API_KEY: {'✅ Set' if os.getenv('QDRANT_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('QDRANT_API_KEY', '')), 8) if os.getenv('QDRANT_API_KEY') else 'None'})")
print(f"   GEMINI_EMBEDDING_API_KEY: {'✅ Set' if os.getenv('GEMINI_EMBEDDING_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('GEMINI_EMBEDDING_API_KEY', '')), 8) if os.getenv('GEMINI_EMBEDDING_API_KEY') else 'None'})")
print(f"   GEMINI_CHAT_API_KEY: {'✅ Set' if os.getenv('GEMINI_CHAT_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('GEMINI_CHAT_API_KEY', '')), 8) if os.getenv('GEMINI_CHAT_API_KEY') else 'None'})")

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

app = FastAPI(title="Document Management API")

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

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

socket_app = socketio.ASGIApp(sio, app)

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
    print("💗 Health check requested")
    # A more realistic health check would involve checking service dependencies
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "rag_initialized": rag_service.is_initialized if rag_service else False
    }

# List all files
@app.get("/files")
async def list_files():
    try:
        print("📋 Listing all files...")
        if not file_service:
            raise HTTPException(status_code=500, detail="File service not available")
        files = await file_service.list_files()

        response = {
            "success": True,
            "files": files,
            "count": len(files)
        }

        print(f"✅ Found {len(files)} files")
        return response
    except Exception as error:
        print(f"❌ Failed to list files: {error}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(error)}")

# Delete file
@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    try:
        print(f"🗑️ Deleting file: {file_id}")

        await file_service.delete_file(file_id)

        print(f"✅ File deleted successfully: {file_id}")
        return {"success": True, "message": "File deleted successfully"}
    except Exception as error:
        print(f"❌ Failed to delete file: {error}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(error)}")

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
    except Exception as error:
        print(f"❌ Download error: {error}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(error)}")

# CSV pagination endpoint
@app.get("/csv/{file_id}/page/{page_number}")
async def get_csv_page(file_id: str, page_number: int, limit: int = 20):
    try:
        if page_number < 1:
            raise HTTPException(status_code=400, detail="Invalid page number")

        file_info = await file_service.get_file_metadata(file_id)
        if not file_info or not csv_service.is_csv_type(file_info["mimetype"]):
            raise HTTPException(status_code=404, detail="CSV file not found")

        csv_data = await csv_service.get_paginated_data(file_info["path"], page_number, limit)

        return {
            "data": csv_data["rows"],
            "pagination": {
                "page": page_number,
                "limit": limit,
                "totalRows": csv_data["totalRows"],
                "totalPages": (csv_data["totalRows"] + limit - 1) // limit,
                "hasNext": page_number * limit < csv_data["totalRows"],
                "hasPrev": page_number > 1
            }
        }
    except Exception as error:
        print(f"❌ CSV pagination error: {error}")
        raise HTTPException(status_code=500, detail=f"CSV pagination failed: {str(error)}")

# File metadata endpoint
@app.get("/metadata/{file_id}")
async def get_metadata(file_id: str):
    try:
        file_info = await file_service.get_file_metadata(file_id)

        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        # Don't expose internal paths
        public_metadata = {k: v for k, v in file_info.items() if k != "path"}
        return public_metadata
    except Exception as error:
        print(f"❌ Metadata error: {error}")
        raise HTTPException(status_code=500, detail=f"Metadata retrieval failed: {str(error)}")

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

@app.delete("/rag/index/{file_id}")
async def rag_remove(file_id: str):
    try:
        print(f"🗑️ RAG: Removing document from index: {file_id}")
        await rag_service.remove_document(file_id)

        print(f"✅ RAG: Document removed from index: {file_id}")
        return {
            "success": True,
            "message": "Document removed from index"
        }

    except Exception as error:
        print(f"❌ RAG removal error: {error}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to remove document from index",
                "details": str(error)
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
            "processingTime": processing_time
        }

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

# Startup event to ensure RAG is initialized
@app.on_event("startup")
async def startup_event():
    print("🚀 FastAPI application starting up...")
    # Ensure RAG service is initialized if not already done or if startup is called again
    if 'rag_service' in globals() and not rag_service.is_initialized:
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
        print(" RAG service already initialized or not available.")

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
    print(f"🔧 RAG Service initialized: {'Yes' if 'rag_service' in globals() and rag_service.is_initialized else 'No'}")
    print("🎯 All APIs and services status logged above")


if __name__ == "__main__":
    # Running Uvicorn directly. For more complex deployments, consider using an entrypoint script.
    print("🚀 Starting Python backend server with Socket.IO on port 8000...")
    uvicorn.run(socket_app, host="0.0.0.0", port=PORT)