
import os
import asyncio
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue, ScalarQuantization, ScalarQuantizationConfig, ScalarType
import uuid
from pathlib import Path
from dotenv import load_dotenv

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
                                   cloudinary_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Store document chunks with document-specific logic (matching JavaScript)"""
        if not self.is_initialized_flag:
            raise Exception('VectorDatabaseService not initialized')
        
        if not chunks or not embeddings:
            return {'chunksCount': 0, 'success': False}
        
        try:
            print(f'🏢 VectorDB: Storing chunks for {file_name} with workspaceId: {workspace_id or "null"}')
            points = []
            
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                page_number = chunk.get('metadata', {}).get('pageNumber', 1)
                page_url = None
                if cloudinary_data:
                    page_urls = cloudinary_data.get('pageUrls', [])
                    if page_urls and page_number <= len(page_urls):
                        page_url = page_urls[page_number - 1]
                    else:
                        page_url = cloudinary_data.get('secureUrl')

                # Create point payload matching JavaScript structure
                point_payload = {
                    'text': chunk['text'],
                    'fileId': file_id,
                    'fileName': file_name,
                    'chunkIndex': i,
                    'workspaceId': workspace_id,
                    'totalChunks': len(chunks),
                    'pageNumber': page_number,
                    'startLine': chunk.get('metadata', {}).get('startLine'),
                    'endLine': chunk.get('metadata', {}).get('endLine'),
                    'linesUsed': chunk.get('metadata', {}).get('linesUsed'),
                    'totalLinesOnPage': chunk.get('metadata', {}).get('totalLinesOnPage'),
                    'totalPages': chunk.get('metadata', {}).get('totalPages'),
                    'pageUrl': page_url,
                    'cloudinaryUrl': cloudinary_data.get('secureUrl') if cloudinary_data else None,
                    'embeddingType': 'RETRIEVAL_DOCUMENT'
                }
                
                # For webpage content, add source URL information
                content_type = chunk.get('metadata', {}).get('content_type')
                if content_type == 'webpage':
                    point_payload['sourceUrl'] = chunk.get('metadata', {}).get('initial_url')
                    point_payload['contentType'] = 'webpage'
                    point_payload['pagesProcessed'] = chunk.get('metadata', {}).get('pages_processed', 1)

                # Add additional metadata
                metadata = chunk.get('metadata', {})
                for key, value in metadata.items():
                    if key not in point_payload and value is not None:
                        point_payload[key] = value

                # Remove None values
                point_payload = {k: v for k, v in point_payload.items() if v is not None}

                # Log workspaceId for first few chunks for debugging
                if i < 3:
                    print(f'🔍 VectorDB: Chunk {i} payload workspaceId: {point_payload.get("workspaceId") or "null"}')

                # Generate UUID v5 for consistent IDs (matching JavaScript)
                point_id = str(uuid.uuid5(uuid.UUID(POINT_NS), f'{file_id}:{i}'))
                
                point = PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=point_payload
                )
                points.append(point)
            
            # Store points
            await asyncio.to_thread(
                self.client.upsert,
                collection_name=self.collection_name,
                points=points,
                wait=True
            )
            
            print(f'✅ Successfully stored {len(points)} chunks for {file_name}')
            return {'chunksCount': len(points), 'success': True}
            
        except Exception as error:
            print(f'❌ Document storage failed for {file_name}: {error}')
            raise error

    async def search_similar_chunks(self, query_embedding: List[float], filter_param: Optional[Dict] = None, 
                                   limit: int = 5) -> List[Dict[str, Any]]:
        """Search similar chunks with optional filter (matching JavaScript)"""
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

            # Perform search
            search_result = await asyncio.to_thread(
                self.client.search,
                collection_name=self.collection_name,
                **search_params
            )
            
            print(f'📊 VectorDB: Search returned {len(search_result)} results')
            
            if search_result:
                top_result = search_result[0]
                print(f'📝 VectorDB: Top result score: {top_result.score}, fileId: {top_result.payload.get("fileId")}, workspaceId: {top_result.payload.get("workspaceId")}')
            
            return search_result
            
        except Exception as error:
            print(f'❌ Vector search failed: {error}')
            print(f'❌ Search params were: vector_length={len(query_embedding) if query_embedding else None}, limit={limit}, filter={filter_param}')
            raise error

    async def remove_document(self, file_id: str):
        """Remove document by file ID (matching JavaScript)"""
        print(f'🗑️ VectorDB: Starting document removal for {file_id}')
        print(f'🔍 VectorDB: Current state - initialized_flag={self.is_initialized_flag}, client_exists={self.client is not None}')
        
        # Use direct flag check instead of is_initialized() method to avoid state mismatch
        if not self.is_initialized_flag or self.client is None:
            error_msg = f'VectorDatabaseService not properly initialized. Flag: {self.is_initialized_flag}, Client: {self.client is not None}'
            print(f'❌ VectorDB: {error_msg}')
            raise Exception(error_msg)
        
        try:
            print(f'🔄 VectorDB: Executing deletion for file_id={file_id} from collection={self.collection_name}')
            await asyncio.to_thread(
                self.client.delete,
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[FieldCondition(key="fileId", match=MatchValue(value=file_id))]
                )
            )
            print(f'✅ VectorDB: Successfully removed document {file_id} from index')
            
        except Exception as error:
            print(f'❌ VectorDB: Failed to remove document {file_id}: {error}')
            print(f'❌ VectorDB: Error type: {type(error).__name__}')
            raise error

    async def remove_workspace_metadata(self, workspace_id: str):
        """Remove all documents in a workspace by workspace ID"""
        print(f'🗑️ VectorDB: Starting workspace metadata removal for {workspace_id}')
        print(f'🔍 VectorDB: Current state - initialized_flag={self.is_initialized_flag}, client_exists={self.client is not None}')
        
        # Use direct flag check instead of is_initialized() method to avoid state mismatch
        if not self.is_initialized_flag or self.client is None:
            error_msg = f'VectorDatabaseService not properly initialized. Flag: {self.is_initialized_flag}, Client: {self.client is not None}'
            print(f'❌ VectorDB: {error_msg}')
            raise Exception(error_msg)
        
        try:
            print(f'🔄 VectorDB: Executing workspace deletion for workspace_id={workspace_id} from collection={self.collection_name}')
            await asyncio.to_thread(
                self.client.delete,
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[FieldCondition(key="workspaceId", match=MatchValue(value=workspace_id))]
                )
            )
            print(f'✅ VectorDB: Successfully removed all documents for workspace {workspace_id} from index')
            
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