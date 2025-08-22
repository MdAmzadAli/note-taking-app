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

# Load environment variables from the backend_python directory
import os
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent / '.env')

# Import services
from services.csv_service import CSVService
from services.file_service import FileService
from services.rag_service import RAGService
from component.url_download_service import URLDownloadService
from component.webpage_text_extractor_service import WebpageTextExtractorService

app = FastAPI(title="Document Management API")

# Configuration
PORT = int(os.getenv("PORT", 5000))
UPLOADS_DIR = Path("uploads")
PREVIEWS_DIR = Path("previews")

# Ensure directories exist
UPLOADS_DIR.mkdir(exist_ok=True)
PREVIEWS_DIR.mkdir(exist_ok=True)

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

# Initialize services
csv_service = CSVService()
file_service = FileService()
rag_service = RAGService()
url_download_service = URLDownloadService()
webpage_text_extractor_service = WebpageTextExtractorService()

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
    return {
        "status": "healthy", 
        "timestamp": "2024-01-01T00:00:00Z", 
        "uptime": 0
    }

# List all files
@app.get("/files")
async def list_files():
    try:
        print("📋 Listing all files...")
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
    workspaceId: str = Form(...),
    urls: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[])
):
    try:
        print("📤 Workspace mixed upload request received")
        print(f"🏢 Workspace ID: {workspaceId}")
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

        uploaded_files = []
        errors = []

        # Process device files first
        if files:
            for i, file in enumerate(files):
                try:
                    print(f"📤 Processing device file {i + 1}/{len(files)}: {file.filename}")

                    file_id = f"{int(asyncio.get_event_loop().time() * 1000)}{str(uuid.uuid4()).replace('-', '')[:9]}"
                    file_path = UPLOADS_DIR / f"{file_id}_{file.filename}"

                    # Save uploaded file
                    async with aiofiles.open(file_path, 'wb') as f:
                        content = await file.read()
                        await f.write(content)

                    file_info = {
                        "id": file_id,
                        "originalName": file.filename,
                        "mimetype": file.content_type,
                        "size": len(content),
                        "path": str(file_path),
                        "uploadDate": "2024-01-01T00:00:00Z",
                        "workspaceId": workspaceId,
                    }

                    print(f"💾 Saving metadata for device file {i + 1}: {file_info['id']}")
                    await file_service.save_file_metadata(file_info)

                    print(f"🔄 Processing upload for device file {i + 1}...")
                    processed_file = await file_service.process_file_upload(file_info)

                    print(f"🖼️ Generating preview for device file {i + 1}...")
                    try:
                        await file_service.generate_preview(file_info)
                        print(f"✅ Preview generated for device file {i + 1}")
                    except Exception as preview_error:
                        print(f"❌ Preview generation failed for device file {i + 1}: {preview_error}")

                    # Auto-index PDF files for RAG with workspace ID
                    if file_info["mimetype"] == "application/pdf":
                        print(f"🔄 Starting RAG indexing for device file {i + 1} ({file_info['originalName']})...")
                        try:
                            index_result = await rag_service.index_document(
                                file_info["id"],
                                file_info["path"],
                                file_info["originalName"],
                                workspaceId,
                                processed_file.get("cloudinary")
                            )
                            print(f"✅ RAG indexing completed for device file {i + 1}: {index_result.get('chunksCount', 0)} chunks")
                        except Exception as rag_error:
                            print(f"⚠️ RAG indexing failed for device file {i + 1} (continuing anyway): {rag_error}")

                    uploaded_files.append(processed_file)
                    print(f"✅ Successfully processed device file {i + 1}: {file.filename}")

                except Exception as file_error:
                    print(f"❌ Failed to process device file {i + 1} ({file.filename}): {file_error}")
                    errors.append({
                        "filename": file.filename,
                        "error": str(file_error),
                        "type": "device"
                    })

        # Process URLs
        if parsed_urls:
            for i, url_info in enumerate(parsed_urls):
                file_id = str(uuid.uuid4())

                try:
                    print(f"🌐 Processing URL {i + 1}/{len(parsed_urls)}: {url_info.get('url')} ({url_info.get('type')})")

                    if url_info.get("type") in ["from_url", "url"]:
                        # Download PDF from URL
                        print(f"📥 Downloading PDF from URL: {url_info.get('url')}")
                        download_result = await url_download_service.download_pdf(url_info.get("url"), file_id)

                        if not download_result.get("success"):
                            raise Exception(f"Failed to download PDF: {download_result.get('error', 'Unknown error')}")

                        # Read the downloaded file
                        async with aiofiles.open(download_result["filePath"], 'rb') as f:
                            file_content = await f.read()

                        original_name = download_result["fileName"]
                        mimetype = download_result["mimetype"]

                        # Clean up the temporary file
                        os.unlink(download_result["filePath"])
                        print(f"🧹 Cleaned up temporary download file: {download_result['filePath']}")

                    elif url_info.get("type") == "webpage":
                        # Extract text from webpage
                        print(f"🌐 Extracting text from webpage: {url_info.get('url')}")
                        extract_result = await webpage_text_extractor_service.extract_webpage_text(url_info.get("url"), file_id)

                        if not extract_result.get("success"):
                            raise Exception(f"Failed to extract webpage text: {extract_result.get('error', 'Unknown error')}")

                        file_content = extract_result["text"].encode('utf-8')
                        original_name = extract_result["fileName"]
                        mimetype = extract_result["mimetype"]

                    else:
                        raise Exception(f"Unsupported URL type: {url_info.get('type')}")

                    file_path = UPLOADS_DIR / f"{file_id}-{original_name}"
                    async with aiofiles.open(file_path, 'wb') as f:
                        await f.write(file_content)
                    print(f"✅ Saved processed content to temporary path: {file_path}")

                    file_metadata = {
                        "id": file_id,
                        "originalName": original_name,
                        "mimetype": mimetype,
                        "size": len(file_content),
                        "path": str(file_path),
                        "uploadDate": "2024-01-01T00:00:00Z",
                        "workspaceId": workspaceId,
                        "sourceUrl": url_info.get("url"),
                        "sourceType": url_info.get("type")
                    }

                    print(f"💾 Saving metadata for URL {i + 1}: {file_metadata['id']}")
                    await file_service.save_file_metadata(file_metadata)

                    print(f"🔄 Processing upload for URL {i + 1}...")
                    processed_file = await file_service.process_file_upload(file_metadata)

                    # Auto-index PDF files for RAG with workspace ID
                    if file_metadata["mimetype"] == "application/pdf":
                        print(f"🔄 Starting RAG indexing for URL {i + 1} ({file_metadata['originalName']})...")
                        try:
                            index_result = await rag_service.index_document(
                                file_metadata["id"],
                                file_metadata["path"],
                                file_metadata["originalName"],
                                workspaceId,
                                processed_file.get("cloudinary")
                            )
                            print(f"✅ RAG indexing completed for URL {i + 1}: {index_result.get('chunksCount', 0)} chunks")
                        except Exception as rag_error:
                            print(f"⚠️ RAG indexing failed for URL {i + 1} (continuing anyway): {rag_error}")

                    uploaded_files.append(processed_file)
                    print(f"✅ Successfully processed URL {i + 1}: {url_info.get('url')}")

                except Exception as url_error:
                    print(f"❌ Failed to process URL {i + 1} ({url_info.get('url')}): {url_error}")
                    errors.append({
                        "filename": url_info.get("url"),
                        "error": str(url_error),
                        "type": url_info.get("type")
                    })

        if len(uploaded_files) == 0:
            raise HTTPException(status_code=400, detail="No files or URLs were successfully processed")

        response = {
            "success": True,
            "files": uploaded_files,
            "processedCount": len(uploaded_files),
            "totalCount": len(files) + len(parsed_urls),
            "deviceFilesCount": len(files),
            "urlsCount": len(parsed_urls),
            "errors": errors if errors else None
        }

        print(f"📤 Workspace mixed upload completed: {len(uploaded_files)}/{response['totalCount']} items processed")
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

        file_id = f"{int(asyncio.get_event_loop().time() * 1000)}{str(uuid.uuid4()).replace('-', '')[:9]}"
        file_path = UPLOADS_DIR / f"{file_id}_{file.filename}"

        # Save uploaded file
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        file_info = {
            "id": file_id,
            "originalName": file.filename,
            "mimetype": file.content_type,
            "size": len(content),
            "path": str(file_path),
            "uploadDate": "2024-01-01T00:00:00Z",
            "workspaceId": workspaceId,
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
                return RedirectResponse(url=file_urls["urls"]["thumbnailUrl"])
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

    start_time = asyncio.get_event_loop().time()
    try:
        print(f"🔍 Looking for file metadata: {file_id}")

        # Get file metadata from fileService
        file_info = await file_service.get_file_metadata(file_id)

        if not file_info:
            print(f"❌ File metadata not found for ID: {file_id}")
            raise HTTPException(status_code=404, detail="File not found")

        print(f"📊 File metadata: {file_info}")

        file_path = file_info["path"]
        print(f"📁 File path from metadata: {file_path}")
        print(f"📁 File exists: {Path(file_path).exists()}")

        if not Path(file_path).exists():
            print(f"❌ File not found on disk: {file_path}")
            raise HTTPException(status_code=404, detail="File not found on disk")

        print(f"🔄 Starting RAG indexing process...")
        print(f"📄 Indexing parameters: fileId={file_id}, filePath={file_path}, fileName={file_info['originalName']}, workspaceId={request.workspaceId}")

        # Detect content type from file info
        content_type = 'pdf' if file_info.get('mimetype') == 'application/pdf' else 'text'
        
        # Index the document using RAG service with content type
        result = await rag_service.index_document(
            file_id,
            file_path,
            file_info["originalName"],
            request.workspaceId,
            file_info.get("cloudinary"),
            content_type
        )

        processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
        print(f"✅ RAG indexing completed successfully in {processing_time}ms")
        print(f"📊 Indexing result: {result}")

        return {
            "success": True,
            "message": "Document indexed successfully",
            "chunksCount": result.get("chunksCount"),
            "processingTime": processing_time
        }

    except Exception as error:
        processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
        print(f"❌ RAG indexing error after {processing_time}ms")
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
    start_time = asyncio.get_event_loop().time()
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

        processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
        print(f"✅ RAG query completed successfully in {processing_time}ms")
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
        processing_time = (asyncio.get_event_loop().time() - start_time) * 1000
        print(f"❌ RAG query error after {processing_time}ms")
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

@app.get("/rag/health")
async def rag_health():
    print(f"🏥 RAG: Health check requested")

    try:
        print(f"🔄 Performing RAG service health check...")
        health = await rag_service.health_check()
        print(f"📊 Health check result: {health}")
        print(f"✅ Health check completed successfully")

        return health
    except Exception as error:
        print(f"❌ Health check failed")
        print(f"❌ Error type: {type(error).__name__}")
        print(f"❌ Error message: {error}")

        raise HTTPException(
            status_code=500,
            detail={
                "error": "Health check failed",
                "details": str(error)
            }
        )

# 404 handler
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=404, content={"error": "Endpoint not found"})

# Error handling
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    print("❌ Unhandled error occurred")
    print(f"❌ Error type: {type(exc).__name__}")
    print(f"❌ Error message: {exc}")

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "details": str(exc) if os.getenv("NODE_ENV") == "development" else "Something went wrong"
        }
    )

# Start server
async def start_server():
    print(f"📁 Uploads directory: {UPLOADS_DIR}")
    print(f"🖼️ Previews directory: {PREVIEWS_DIR}")

    # Initialize RAG service
    try:
        await rag_service.initialize()
    except Exception as error:
        print("⚠️ RAG service initialization failed, continuing without RAG features")

    print(f"🚀 Server running on port {PORT}")
    print(f"🌐 Server accessible at http://0.0.0.0:{PORT}")
    print(f"🌐 Replit external URL: https://{os.getenv('REPLIT_DEV_DOMAIN')}:{PORT}")
    print(f"🛡️ Environment: {os.getenv('NODE_ENV', 'development')}")
    print(f"🔧 RAG Service initialized: {'Yes' if rag_service.is_initialized else 'No'}")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Python backend server on port 5000...")
    print("🔗 Server will be accessible at http://0.0.0.0:5000")
    uvicorn.run(app, host="0.0.0.0", port=5000)