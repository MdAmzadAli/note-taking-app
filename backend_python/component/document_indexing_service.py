import asyncio
import uuid
import os
from typing import List, Dict, Any, Optional
from .unified_chunking_service import UnifiedChunkingService

class DocumentIndexingService:
    def __init__(self, chunking_service, embedding_service, vector_database_service):
        # Maintain backward compatibility with existing chunking service
        self.chunking_service = chunking_service
        self.embedding_service = embedding_service
        self.vector_database_service = vector_database_service

        # Add unified chunking service
        self.unified_chunking_service = UnifiedChunkingService(
            chunk_size=getattr(chunking_service, 'chunk_size', 800),
            chunk_overlap=getattr(chunking_service, 'chunk_overlap', 75)
        )

    async def index_document(self, file_id: str, file_path_or_url: str, metadata: Dict = None) -> Dict:
        """
        Index document with chunking and vector storage
        @param file_id: Unique file identifier
        @param file_path_or_url: Path to file or URL to process
        @param metadata: Optional metadata
        @returns: Indexing result
        """
        print(f'📚 Starting document indexing for: {file_id}')
        print(f'📂 Input: {file_path_or_url}')

        if metadata is None:
            metadata = {}

        try:
            # Determine if input is URL or file path
            is_url = isinstance(file_path_or_url, str) and (file_path_or_url.startswith('http://') or file_path_or_url.startswith('https://'))

            print(f'🔍 Processing {"URL" if is_url else "file"}: {file_path_or_url}')

            # Process with unified chunking service
            if is_url:
                # For URLs, let unified chunking service handle the processing
                print(f'🌐 Processing URL with unified chunking service (webpage crawler)')
                chunking_result = await self.unified_chunking_service.process_content(file_path_or_url, "webpage", metadata)
            else:
                # For files, check if it exists and process accordingly
                if not os.path.exists(file_path_or_url):
                    raise FileNotFoundError(f'File not found: {file_path_or_url}')

                print(f'📄 Processing file with unified chunking service')
                chunking_result = await self.unified_chunking_service.process_content(file_path_or_url,"pdf", metadata)

            chunks = chunking_result.get('chunks', [])
            if not chunks:
                raise Exception('No chunks generated from content')

            # Generate document-optimized embeddings in batches
            embeddings = await self.generate_embeddings_for_chunks(chunks)

            # Store in vector database
            # For webpages, don't pass cloudinaryData to prevent Cloudinary integration
            cloudinary_for_storage = metadata.get('cloudinaryData') if not is_url else None

            print(f'🔄 Storing {len(chunks)} chunks with workspaceId: {metadata.get("workspaceId") or "null"}')
            if is_url:
                print(f'🌐 Webpage content - excluding Cloudinary integration')

            result = await self.vector_database_service.store_document_chunks(
                file_id,
                metadata.get('fileName', os.path.basename(file_path_or_url)),
                chunks,
                embeddings,
                metadata.get('workspaceId'),
                cloudinary_for_storage
            )

            print(f'✅ Successfully indexed {result.get("chunksCount")} chunks for {file_id} in workspace: {metadata.get("workspaceId") or "null"}')
            return result

        except Exception as error:
            print(f'❌ Document indexing failed for {file_id}: {error}')
            raise error

    async def generate_embeddings_for_chunks(self, chunks: List[Dict[str, Any]]) -> List[List[float]]:
        """
        Generate embeddings for chunks in batches
        """
        all_embeddings = []
        # Process in batches of 100 (API limit)
        batch_size = 100

        for batch_start in range(0, len(chunks), batch_size):
            batch_end = min(batch_start + batch_size, len(chunks))
            batch_chunks = chunks[batch_start:batch_end]

            print(f'🔄 Processing batch {(batch_start // batch_size) + 1}/{(len(chunks) + batch_size - 1) // batch_size} ({len(batch_chunks)} chunks)')

            # Extract texts for batch embedding
            batch_texts = [chunk['text'] for chunk in batch_chunks]
            print('📝 Batch texts: crossed')
            # Generate embeddings for the entire batch
            batch_embeddings = await self.embedding_service.generate_batch_embeddings(batch_texts, 'document')
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    async def remove_document(self, file_id: str) -> Dict[str, Any]:
        """
        Remove document from index
        """
        try:
            # Check if vector database service is initialized before attempting removal
            if not self.vector_database_service.is_initialized():
                print(f'⚠️ Vector database service not initialized, cannot remove document {file_id}')
                return {
                    'success': False,
                    'fileId': file_id,
                    'message': f'Vector database service not initialized for document {file_id}'
                }
            
            await self.vector_database_service.remove_document(file_id)
            print(f'✅ Removed document {file_id} from index')
            return {
                'success': True,
                'fileId': file_id,
                'message': f'Document {file_id} removed successfully'
            }
        except Exception as error:
            print(f'❌ Failed to remove document {file_id}: {error}')
            raise error

    async def index_document_unified(self, file_id: str, source: str, file_name: str, 
                                   workspace_id: Optional[str] = None, cloudinary_data: Optional[Dict] = None, 
                                   content_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Index a document using the unified chunking service with auto-detection

        Args:
            file_id: Unique identifier for the document
            source: File path, URL, or text content
            file_name: Name of the file/document
            workspace_id: Optional workspace identifier
            cloudinary_data: Optional cloudinary data for images/previews
            content_type: Optional content type override ('pdf', 'webpage', 'text')

        Returns:
            Indexing result with success status and metadata
        """
        try:
            print(f'📄 Starting unified document indexing for: {file_name} ({file_id})')
            print(f'🏢 Indexing with workspaceId: {workspace_id or "null"}')

            if not self.vector_database_service.is_initialized():
                raise Exception("Vector database not initialized")

            # Check if document is already indexed
            document_exists = await self.vector_database_service.check_document_exists(file_id)
            if document_exists:
                print(f'📄 Document already indexed: {file_id} (found existing chunks)')
                chunks_count = await self.vector_database_service.get_document_chunk_count(file_id)

                return {
                    'success': True,
                    'message': 'Document already indexed',
                    'chunksCount': chunks_count,
                    'alreadyIndexed': True
                }

            # Auto-detect content type if not provided
            if content_type is None:
                content_type = self.unified_chunking_service.detect_content_type(source)
                print(f'🔍 Auto-detected content type: {content_type}')

            # Process using unified chunking service
            processing_result = await self.unified_chunking_service.process_content(
                source, 
                content_type, 
                {
                    'fileId': file_id,
                    'fileName': file_name,
                    'workspaceId': workspace_id,
                    'cloudinaryData':cloudinary_data,
                    'contentType': content_type
                }
            )

            chunks = processing_result.get('chunks', [])
            if not chunks:
                raise Exception('No chunks generated from content')

            print(f'📄 Created {len(chunks)} chunks using unified service')

            # Generate embeddings
            embeddings = await self.generate_embeddings_for_chunks(chunks)

            # Store in vector database
            # For webpages, don't pass cloudinaryData to prevent Cloudinary integration
            cloudinary_for_storage = cloudinary_data if content_type != 'webpage' else None

            print(f'🔄 Storing {len(chunks)} chunks with workspaceId: {workspace_id or "null"}')
            if content_type == 'webpage':
                print(f'🌐 Webpage content - excluding Cloudinary integration')

            result = await self.vector_database_service.store_document_chunks(
                file_id,
                file_name,
                chunks,
                embeddings,
                workspace_id,
                cloudinary_for_storage
            )

            # Add processing statistics
            processing_stats = self.unified_chunking_service.get_processing_stats(chunks)
            content_analysis = self.unified_chunking_service.analyze_content_structure(processing_result)

            result['processingStats'] = processing_stats
            result['contentAnalysis'] = content_analysis
            result['unifiedServiceInfo'] = processing_result.get('unified_service_info', {})
            result['processingStrategy'] = 'unified_chunking_service'

            print(f'✅ Successfully indexed {result.get("chunksCount")} chunks using unified service')
            return result

        except Exception as error:
            print(f'❌ Unified document indexing failed for {file_name}: {error}')
            raise error

    def update_chunking_config(self, chunk_size: int, chunk_overlap: int):
        """
        Update chunking configuration for both services
        """
        self.chunking_service.set_chunk_size(chunk_size)
        self.chunking_service.set_chunk_overlap(chunk_overlap)
        self.unified_chunking_service.set_chunk_size(chunk_size)
        self.unified_chunking_service.set_chunk_overlap(chunk_overlap)

    def get_processing_stats(self, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get processing statistics
        """
        return self.chunking_service.get_chunking_stats(chunks)

    def analyze_pdf_structure(self, pdf_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze PDF structure
        """
        return self.chunking_service.analyze_pdf_structure(pdf_data)