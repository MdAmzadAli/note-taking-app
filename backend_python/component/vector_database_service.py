
import os
import asyncio
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue, ScalarQuantization, ScalarQuantizationConfig, ScalarType
import uuid
from pathlib import Path
from dotenv import load_dotenv
from sql_db.db_methods.database_manager import DatabaseManager

# Load environment variables with explicit path
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# UUID namespace for consistent point IDs (matching JavaScript)
POINT_NS = '2d3c0d3e-1e1a-4f6a-9e84-1b8de377e9c9'

class VectorDatabaseService:
    def __init__(self):
        self.client = None
        self.collection_name = 'Ragdocuments'  # New collection name with int8 optimization
        self.is_initialized_flag = False
        self.db_manager = DatabaseManager()

    async def initialize(self):
        print('🔧 VectorDatabaseService: Starting initialization...')
        
        try:
            qdrant_url = os.getenv('QDRANT_URL')
            qdrant_api_key = os.getenv('QDRANT_API_KEY')
            
            if not qdrant_url:
                raise Exception('QDRANT_URL environment variable is required')
            
            print(f'🔗 Connecting to Qdrant at: {qdrant_url}')
            
            # Initialize Qdrant client
            if qdrant_api_key:
                self.client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
            else:
                self.client = QdrantClient(url=qdrant_url)
            
            # Test connection
            await asyncio.to_thread(self.client.get_collections)
            print('✅ VectorDatabaseService: Connected to Qdrant successfully')
            
            # Ensure collection exists
            await self._ensure_collection_exists()
            
            self.is_initialized_flag = True
            print('✅ VectorDatabaseService initialized successfully')
            
        except Exception as error:
            print(f'❌ VectorDatabaseService initialization failed: {error}')
            self.is_initialized_flag = False
            raise error

    async def _ensure_collection_exists(self):
        try:
            # Check if collection exists
            collections = await asyncio.to_thread(self.client.get_collections)
            collection_exists = any(col.name == self.collection_name for col in collections.collections)
            
            if not collection_exists:
                print(f'📝 Creating collection: {self.collection_name}')
                await asyncio.to_thread(
                    self.client.create_collection,
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=768, distance=Distance.COSINE),
                    quantization_config=ScalarQuantization(
                        scalar=ScalarQuantizationConfig(type=ScalarType.INT8)
                    ),
                    optimizers_config={
                        "default_segment_number": 2
                    },
                    replication_factor=1
                )
                print(f'✅ Collection {self.collection_name} created successfully')
            else:
                print(f'✅ Collection {self.collection_name} already exists')

            # Always ensure payload indexes exist
            print('🔄 Ensuring payload indexes...')
            
            try:
                await asyncio.to_thread(
                    self.client.create_payload_index,
                    collection_name=self.collection_name,
                    field_name="fileId",
                    field_schema="keyword"
                )
                print('✅ Created/verified fileId index')
            except Exception as error:
                if "already exists" in str(error):
                    print('✅ fileId index already exists')
                else:
                    print(f'⚠️ Could not create fileId index: {error}')

            try:
                await asyncio.to_thread(
                    self.client.create_payload_index,
                    collection_name=self.collection_name,
                    field_name="workspaceId",
                    field_schema="keyword"
                )
                print('✅ Created/verified workspaceId index')
            except Exception as error:
                if "already exists" in str(error):
                    print('✅ workspaceId index already exists')
                else:
                    print(f'⚠️ Could not create workspaceId index: {error}')
                
        except Exception as error:
            print(f'❌ Collection setup failed: {error}')
            raise error

    async def store_document_chunks(self, file_id: str, file_name: str, chunks: List[Dict[str, Any]], 
                                   embeddings: List[List[float]], workspace_id: Optional[str] = None, 
                                   cloudinary_data: Optional[Dict] = None, user_uuid: Optional[str] = None) -> Dict[str, Any]:
        """Store document chunks with minimal Qdrant payload and full text in SQL database"""
        if not self.is_initialized_flag:
            raise Exception('VectorDatabaseService not initialized')
        
        if not chunks or not embeddings:
            return {'chunksCount': 0, 'success': False}
        
        try:
            print(f'🏢 VectorDB: Storing chunks for {file_name} with workspaceId: {workspace_id or "null"}')
            
            # Calculate total file size early for usage tracking
            total_file_size = sum(len(chunk['text'].encode('utf-8')) for chunk in chunks)
            
            # Prepare data for both vector and SQL storage
            points = []
            contexts_data = []
            
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                context_number = i + 1  # 1-based indexing for SQL
                page_number = chunk.get('metadata', {}).get('pageNumber', 1)
                page_url = None
                thumbnail_url = None
                
                if cloudinary_data:
                    page_urls = cloudinary_data.get('pageUrls', [])
                    if page_urls and page_number <= len(page_urls):
                        page_url = page_urls[page_number - 1]
                    else:
                        page_url = cloudinary_data.get('secureUrl')
                    thumbnail_url = cloudinary_data.get('thumbnailUrl')

                # Minimal Qdrant payload - only essential search fields
                point_payload = {
                    'fileId': file_id,
                    'workspaceId': workspace_id,
                    'contextNumber': context_number,
                    'embeddingType': 'RETRIEVAL_DOCUMENT'
                }
                
                # Remove None values from Qdrant payload
                point_payload = {k: v for k, v in point_payload.items() if v is not None}

                # Log workspaceId for first few chunks for debugging
                if i < 3:
                    print(f'🔍 VectorDB: Chunk {i} minimal payload workspaceId: {point_payload.get("workspaceId") or "null"}')

                # Generate UUID v5 for consistent IDs (matching JavaScript)
                point_id = str(uuid.uuid5(uuid.UUID(POINT_NS), f'{file_id}:{i}'))
                
                point = PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=point_payload
                )
                points.append(point)
                
                # Prepare comprehensive data for SQL storage
                metadata = chunk.get('metadata', {})
                context_data = {
                    'text': chunk['text'],
                    'metadata': {
                        'chunkIndex': i,
                        'pageNumber': page_number,
                        'startLine': metadata.get('startLine'),
                        'endLine': metadata.get('endLine'),
                        'linesUsed': metadata.get('linesUsed'),
                        'totalLinesOnPage': metadata.get('totalLinesOnPage'),
                        'totalPages': metadata.get('totalPages'),
                        'pageUrl': page_url,
                        'thumbnailUrl': thumbnail_url,
                        'cloudinaryUrl': cloudinary_data.get('secureUrl') if cloudinary_data else None,
                        'sourceUrl': metadata.get('initial_url') if metadata.get('content_type') == 'webpage' else None,
                        'contentType': metadata.get('content_type'),
                        'pagesProcessed': metadata.get('pages_processed'),
                        'tokens_est': metadata.get('tokens_est'),
                        'total_chars': metadata.get('total_chars'),
                        'fileName': file_name,
                        'workspaceId': workspace_id
                    }
                }
                contexts_data.append(context_data)
            
            # Store in Qdrant with minimal payload
            await asyncio.to_thread(
                self.client.upsert,
                collection_name=self.collection_name,
                points=points,
                wait=True
            )
            print(f'✅ VectorDB: Stored {len(points)} vectors in Qdrant with minimal payload')
            
            # Store comprehensive text data in SQL database
            try:
                with DatabaseManager() as db:
                    # Handle workspace creation based on mode
                    is_single_file_mode = workspace_id and workspace_id.startswith('single_')
                    
                    if not is_single_file_mode and workspace_id:
                        # Only ensure workspace exists for workspace mode (not single file mode)
                        workspace = db.workspace_repo.get_workspace(workspace_id)
                        if not workspace:
                            # Create workspace if it doesn't exist
                            workspace = db.workspace_repo.create_workspace(
                                workspace_id, 
                                f"Workspace {workspace_id}", 
                                "Auto-created workspace for document storage",  # description as string
                                {"auto_created": True}  # metadata as dict
                            )
                            print(f'📝 SQL: Created workspace {workspace_id}')
                    elif is_single_file_mode:
                        print(f'📝 SQL: Single file mode detected for {workspace_id}, skipping workspace creation')
                    else:
                        print(f'📝 SQL: No workspace_id provided, treating as single file mode')
                    
                    # Ensure file exists  
                    file_record = db.file_repo.get_file(file_id)
                    if not file_record:
                        # Create file record with minimal schema - only essential fields
                        content_type = chunks[0].get('metadata', {}).get('content_type', 'pdf')
                        
                        # Pass workspace_id as-is (can be None for single file mode)
                        effective_workspace_id = workspace_id if not is_single_file_mode else None
                        file_record = db.file_repo.create_file(file_id, effective_workspace_id, content_type, total_file_size)
                        print(f'📝 SQL: Created file record {file_id} with workspace_id: {effective_workspace_id or "null (single file mode)"}')
                    
                    # Store contexts in bulk
                    stored_count = db.context_repo.store_contexts_bulk(file_id, contexts_data)
                    print(f'✅ SQL: Stored {stored_count} contexts in database')
                    
                    # Update file usage for the user if user_uuid is provided
                    if user_uuid:
                        try:
                            from sql_db.db_methods.usage_repository import UsageRepository
                            usage_repo = UsageRepository(db.session)
                            
                            # Check if usage record exists
                            file_usage = usage_repo.get_file_upload_usage(user_uuid)
                            
                            if file_usage:
                                # Usage exists, update it
                                updated_usage = usage_repo.update_file_upload_usage(user_uuid, total_file_size)
                                print(f'✅ Updated file usage for user {user_uuid}: added {total_file_size} bytes, total now {updated_usage["file_size_used"]} bytes')
                            else:
                                # Usage doesn't exist, initialize it
                                initialized_usage = usage_repo.initialize_file_usage_if_not_exists(user_uuid, total_file_size)
                                print(f'✅ Initialized file usage for user {user_uuid}: {initialized_usage["file_size_used"]} bytes used')
                        except Exception as usage_error:
                            print(f'⚠️ Failed to update file usage for user {user_uuid}: {usage_error}')
                            # Continue anyway, don't fail the upload due to usage tracking error
                    
            except Exception as sql_error:
                print(f'⚠️ SQL storage failed: {sql_error}')
                # Continue anyway as vector search can still work
            
            print(f'✅ Successfully stored {len(points)} chunks for {file_name}')
            return {'chunksCount': len(points), 'success': True}
            
        except Exception as error:
            print(f'❌ Document storage failed for {file_name}: {error}')
            raise error

    async def search_similar_chunks(self, query_embedding: List[float], filter_param: Optional[Dict] = None, 
                                   limit: int = 5) -> List[Dict[str, Any]]:
        """Search similar chunks and retrieve full text from SQL database"""
        if not self.is_initialized_flag:
            raise Exception('VectorDatabaseService not initialized')
        
        try:
            search_params = {
                'query_vector': query_embedding,
                'limit': limit,
                'with_payload': True
            }

            if filter_param:
                search_params['query_filter'] = Filter(**filter_param)
                print(f'🔍 VectorDB: Searching with filter: {filter_param}')
            else:
                print(f'🔍 VectorDB: Searching without filter, limit: {limit}')

            print(f'🔍 VectorDB: Query embedding length: {len(query_embedding)}')

            # Perform vector search
            vector_results = await asyncio.to_thread(
                self.client.search,
                collection_name=self.collection_name,
                **search_params
            )
            
            print(f'📊 VectorDB: Vector search returned {len(vector_results)} results')
            
            if not vector_results:
                return []
            
            # Extract file_id and context_number pairs for SQL retrieval
            context_requests = []
            for result in vector_results:
                payload = result.payload
                file_id = payload.get('fileId')
                context_number = payload.get('contextNumber')
                workspace_id = payload.get('workspaceId')
                
                if file_id and context_number:
                    context_requests.append({
                        'fileId': file_id,
                        'workspaceId': workspace_id,
                        'contextNumber': context_number,
                        'score': result.score
                    })
            
            if not context_requests:
                print(f'⚠️ No valid context requests found from vector results')
                return []
            
            # Retrieve text data from SQL database using RAG repository
            try:
                with DatabaseManager() as db:
                    full_contexts = db.rag_repo.retrieve_contexts_for_rag(context_requests)
                    print(f'📝 SQL: Retrieved {len(full_contexts)} contexts from database')
                    
                    # Combine vector scores with SQL text data
                    enriched_results = []
                    context_lookup = {(ctx['fileId'], ctx['contextNumber']): ctx for ctx in full_contexts}
                    
                    for req in context_requests:
                        file_id = req['fileId']
                        context_number = req['contextNumber']
                        score = req['score']
                        
                        context_data = context_lookup.get((file_id, context_number))
                        if context_data:
                            # Create result in format expected by search_service.py
                            enriched_result = type('SearchResult', (), {
                                'score': score,
                                'payload': {
                                    'text': context_data['text'],
                                    'fileId': file_id,
                                    'workspaceId': req['workspaceId'],
                                    'chunkIndex': context_data['metadata'].get('chunkIndex', context_number - 1),
                                    'fileName': context_data['metadata'].get('fileName'),
                                    'pageNumber': context_data['metadata'].get('pageNumber'),
                                    'startLine': context_data['metadata'].get('startLine'),
                                    'endLine': context_data['metadata'].get('endLine'),
                                    'linesUsed': context_data['metadata'].get('linesUsed'),
                                    'totalLinesOnPage': context_data['metadata'].get('totalLinesOnPage'),
                                    'totalPages': context_data['metadata'].get('totalPages'),
                                    'pageUrl': context_data['metadata'].get('pageUrl'),
                                    'cloudinaryUrl': context_data['metadata'].get('cloudinaryUrl'),
                                    'thumbnailUrl': context_data['metadata'].get('thumbnailUrl'),
                                    'embeddingType': 'RETRIEVAL_DOCUMENT'
                                }
                            })()
                            enriched_results.append(enriched_result)
                        else:
                            print(f'⚠️ No text data found for file {file_id}, context {context_number}')
                    
                    print(f'✅ Enriched {len(enriched_results)} results with text data')
                    
                    if enriched_results:
                        top_result = enriched_results[0]
                        print(f'📝 VectorDB: Top enriched result score: {top_result.score}, fileId: {top_result.payload.get("fileId")}, workspaceId: {top_result.payload.get("workspaceId")}')
                    
                    return enriched_results
                    
            except Exception as sql_error:
                print(f'⚠️ SQL retrieval failed: {sql_error}')
                # Fallback to vector results only (with minimal data)
                print(f'🔄 Falling back to vector-only results')
                return vector_results
            
        except Exception as error:
            print(f'❌ Vector search failed: {error}')
            print(f'❌ Search params were: vector_length={len(query_embedding) if query_embedding else None}, limit={limit}, filter={filter_param}')
            raise error

    async def remove_document(self, file_id: str):
        """Remove document by file ID from both vector and SQL databases"""
        print(f'🗑️ VectorDB: Starting document removal for {file_id}')
        print(f'🔍 VectorDB: Current state - initialized_flag={self.is_initialized_flag}, client_exists={self.client is not None}')
        
        # Use direct flag check instead of is_initialized() method to avoid state mismatch
        if not self.is_initialized_flag or self.client is None:
            error_msg = f'VectorDatabaseService not properly initialized. Flag: {self.is_initialized_flag}, Client: {self.client is not None}'
            print(f'❌ VectorDB: {error_msg}')
            raise Exception(error_msg)
        
        try:
            # Remove from Qdrant vector database
            print(f'🔄 VectorDB: Executing deletion for file_id={file_id} from collection={self.collection_name}')
            await asyncio.to_thread(
                self.client.delete,
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[FieldCondition(key="fileId", match=MatchValue(value=file_id))]
                )
            )
            print(f'✅ VectorDB: Successfully removed document {file_id} from vector index')
            
            # Remove from SQL database - handles both workspace and single file modes
            try:
                with DatabaseManager() as db:
                    # Check if file exists and get its workspace_id for logging
                    file_record = db.file_repo.get_file(file_id)
                    if file_record:
                        workspace_id = file_record.workspace_id
                        is_single_file_mode = workspace_id is None or (workspace_id and workspace_id.startswith('single_'))
                        print(f'🔍 SQL: File {file_id} found with workspace_id: {workspace_id or "null"} (single_file_mode: {is_single_file_mode})')
                    
                    # HARD delete file record - CASCADE handles contexts automatically
                    deleted_file = db.file_repo.hard_delete_file(file_id)
                    
                    print(f'✅ SQL: HARD deleted file record for {file_id} (contexts cascaded automatically, workspace handling preserved)')
                    
            except Exception as sql_error:
                print(f'⚠️ SQL deletion failed for {file_id}: {sql_error}')
                # Continue anyway as vector deletion succeeded
            
        except Exception as error:
            print(f'❌ VectorDB: Failed to remove document {file_id}: {error}')
            print(f'❌ VectorDB: Error type: {type(error).__name__}')
            raise error

    async def remove_workspace_metadata(self, workspace_id: str):
        """Remove all documents in a workspace by workspace ID from both vector and SQL databases"""
        print(f'🗑️ VectorDB: Starting workspace metadata removal for {workspace_id}')
        print(f'🔍 VectorDB: Current state - initialized_flag={self.is_initialized_flag}, client_exists={self.client is not None}')
        
        # Use direct flag check instead of is_initialized() method to avoid state mismatch
        if not self.is_initialized_flag or self.client is None:
            error_msg = f'VectorDatabaseService not properly initialized. Flag: {self.is_initialized_flag}, Client: {self.client is not None}'
            print(f'❌ VectorDB: {error_msg}')
            raise Exception(error_msg)
        
        try:
            # Remove from Qdrant vector database
            print(f'🔄 VectorDB: Executing workspace deletion for workspace_id={workspace_id} from collection={self.collection_name}')
            await asyncio.to_thread(
                self.client.delete,
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[FieldCondition(key="workspaceId", match=MatchValue(value=workspace_id))]
                )
            )
            print(f'✅ VectorDB: Successfully removed all documents for workspace {workspace_id} from vector index')
            
            # Remove from SQL database - CASCADE handles files and contexts automatically
            try:
                with DatabaseManager() as db:
                    # HARD delete workspace - CASCADE handles files and contexts automatically
                    workspace_deleted = db.workspace_repo.hard_delete_workspace(workspace_id)
                    
                    print(f'✅ SQL: HARD deleted workspace {workspace_id} (files and contexts cascaded automatically)')
                    
            except Exception as sql_error:
                print(f'⚠️ SQL deletion failed for workspace {workspace_id}: {sql_error}')
                # Continue anyway as vector deletion succeeded
            
        except Exception as error:
            print(f'❌ VectorDB: Failed to remove workspace {workspace_id}: {error}')
            print(f'❌ VectorDB: Error type: {type(error).__name__}')
            raise error

  
    async def health_check(self) -> Dict[str, Any]:
        """Health check (matching JavaScript)"""
        try:
            if self.client:
                await asyncio.to_thread(self.client.get_collections)
                return {'status': 'healthy', 'qdrant': True}
            return {'status': 'degraded', 'qdrant': False}
        except Exception as error:
            return {'status': 'unhealthy', 'qdrant': False, 'error': str(error)}

    def is_initialized(self) -> bool:
        # Double-check actual state vs flag
        actual_state = self.is_initialized_flag and self.client is not None
        if self.is_initialized_flag != actual_state:
            print(f'⚠️ VectorDB: State mismatch - flag={self.is_initialized_flag}, actual={actual_state}')
        return actual_state


  

# service = VectorDatabaseService()
# print(f"✅✅✅✅✅Current collection: {service.collection_name}")