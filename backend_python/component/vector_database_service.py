
import os
import asyncio
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class VectorDatabaseService:
    def __init__(self):
        self.client = None
        self.collection_name = 'document_chunks'
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
                    vectors_config=VectorParams(size=768, distance=Distance.COSINE)
                )
                print(f'✅ Collection {self.collection_name} created successfully')
            else:
                print(f'✅ Collection {self.collection_name} already exists')
                
        except Exception as error:
            print(f'❌ Collection setup failed: {error}')
            raise error

    async def store_chunks(self, chunks: List[Dict[str, Any]]) -> List[str]:
        if not self.is_initialized_flag:
            raise Exception('VectorDatabaseService not initialized')
        
        if not chunks:
            return []
        
        try:
            points = []
            chunk_ids = []
            
            for chunk in chunks:
                chunk_id = str(uuid.uuid4())
                chunk_ids.append(chunk_id)
                
                # Prepare metadata
                metadata = chunk.get('metadata', {})
                payload = {
                    'text': chunk['text'],
                    'fileId': metadata.get('fileId'),
                    'fileName': metadata.get('fileName'),
                    'chunkIndex': metadata.get('chunkIndex'),
                    'workspaceId': metadata.get('workspaceId'),
                    'pageNumber': metadata.get('pageNumber'),
                    'startLine': metadata.get('startLine'),
                    'endLine': metadata.get('endLine'),
                    'pageUrl': metadata.get('pageUrl'),
                    'cloudinaryUrl': metadata.get('cloudinaryUrl'),
                    'thumbnailUrl': metadata.get('thumbnailUrl'),
                    'hasTableContent': metadata.get('hasTableContent', False),
                    'hasFinancialData': metadata.get('hasFinancialData', False)
                }
                
                # Remove None values
                payload = {k: v for k, v in payload.items() if v is not None}
                
                point = PointStruct(
                    id=chunk_id,
                    vector=chunk['embedding'],
                    payload=payload
                )
                points.append(point)
            
            # Store points in batches
            batch_size = 100
            for i in range(0, len(points), batch_size):
                batch = points[i:i + batch_size]
                await asyncio.to_thread(
                    self.client.upsert,
                    collection_name=self.collection_name,
                    points=batch
                )
            
            print(f'✅ Stored {len(chunks)} chunks in vector database')
            return chunk_ids
            
        except Exception as error:
            print(f'❌ Failed to store chunks: {error}')
            raise error

    async def search_similar_chunks(self, query_embedding: List[float], file_ids: Optional[List[str]] = None, 
                                   workspace_id: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
        if not self.is_initialized_flag:
            raise Exception('VectorDatabaseService not initialized')
        
        try:
            # Build filter conditions
            filter_conditions = []
            
            if file_ids:
                filter_conditions.append(
                    FieldCondition(key="fileId", match=MatchValue(any=file_ids))
                )
            
            if workspace_id:
                filter_conditions.append(
                    FieldCondition(key="workspaceId", match=MatchValue(value=workspace_id))
                )
            
            # Create filter
            query_filter = None
            if filter_conditions:
                query_filter = Filter(must=filter_conditions)
            
            # Perform search
            search_result = await asyncio.to_thread(
                self.client.search,
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=query_filter,
                limit=limit,
                with_payload=True
            )
            
            # Format results
            results = []
            for point in search_result:
                result = {
                    'id': point.id,
                    'score': point.score,
                    'text': point.payload.get('text', ''),
                    'metadata': {
                        'fileId': point.payload.get('fileId'),
                        'fileName': point.payload.get('fileName'),
                        'chunkIndex': point.payload.get('chunkIndex'),
                        'workspaceId': point.payload.get('workspaceId'),
                        'pageNumber': point.payload.get('pageNumber'),
                        'startLine': point.payload.get('startLine'),
                        'endLine': point.payload.get('endLine'),
                        'pageUrl': point.payload.get('pageUrl'),
                        'cloudinaryUrl': point.payload.get('cloudinaryUrl'),
                        'thumbnailUrl': point.payload.get('thumbnailUrl'),
                        'hasTableContent': point.payload.get('hasTableContent', False),
                        'hasFinancialData': point.payload.get('hasFinancialData', False)
                    }
                }
                results.append(result)
            
            return results
            
        except Exception as error:
            print(f'❌ Search failed: {error}')
            raise error

    async def remove_chunks_by_file_id(self, file_id: str):
        if not self.is_initialized_flag:
            raise Exception('VectorDatabaseService not initialized')
        
        try:
            # Delete points with matching file_id
            await asyncio.to_thread(
                self.client.delete,
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[FieldCondition(key="fileId", match=MatchValue(value=file_id))]
                )
            )
            
            print(f'✅ Removed chunks for file: {file_id}')
            
        except Exception as error:
            print(f'❌ Failed to remove chunks for file {file_id}: {error}')
            raise error

    async def get_chunk_count(self, file_id: Optional[str] = None, workspace_id: Optional[str] = None) -> int:
        if not self.is_initialized_flag:
            raise Exception('VectorDatabaseService not initialized')
        
        try:
            filter_conditions = []
            
            if file_id:
                filter_conditions.append(
                    FieldCondition(key="fileId", match=MatchValue(value=file_id))
                )
            
            if workspace_id:
                filter_conditions.append(
                    FieldCondition(key="workspaceId", match=MatchValue(value=workspace_id))
                )
            
            query_filter = None
            if filter_conditions:
                query_filter = Filter(must=filter_conditions)
            
            # Count points
            result = await asyncio.to_thread(
                self.client.count,
                collection_name=self.collection_name,
                count_filter=query_filter
            )
            
            return result.count
            
        except Exception as error:
            print(f'❌ Failed to count chunks: {error}')
            return 0

    def is_initialized(self) -> bool:
        return self.is_initialized_flag
