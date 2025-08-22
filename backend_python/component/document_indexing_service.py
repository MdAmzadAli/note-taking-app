
import asyncio
import uuid
import os
from typing import List, Dict, Any, Optional

class DocumentIndexingService:
    def __init__(self, chunking_service, embedding_service, vector_database_service):
        self.chunking_service = chunking_service
        self.embedding_service = embedding_service
        self.vector_database_service = vector_database_service

    async def index_document(self, file_id: str, file_path: str, file_name: str, 
                           workspace_id: Optional[str] = None, cloudinary_data: Optional[Dict] = None, 
                           content_type: str = 'pdf') -> Dict[str, Any]:
        """
        Index a document with optimized document embeddings
        """
        try:
            print(f'📄 Starting document indexing for: {file_name} ({file_id})')
            print(f'🏢 Indexing with workspaceId: {workspace_id or "null"}')
            print(f'📋 Content type: {content_type}')

            if not self.vector_database_service.is_initialized():
                raise Exception("Vector database not initialized")

            # Check if document is already indexed first
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

            chunks = []
            result = None

            if content_type == 'pdf':
                # Validate file path for PDF
                if not file_path or not os.path.exists(file_path):
                    raise Exception(f"File not found: {file_path}")

                # Process PDF: extract and chunk in one call using enhanced ChunkingService
                pdf_result = await self.chunking_service.process_pdf(file_path, {
                    'fileId': file_id,
                    'fileName': file_name,
                    'workspaceId': workspace_id,
                    'filePath': file_path,
                    'cloudinaryData': cloudinary_data,
                    'contentType': 'pdf'
                })

                pdf_data = pdf_result.get('pdfData')
                chunks = pdf_result.get('chunks')

                if not pdf_data or not pdf_data.get('fullText') or not pdf_data['fullText'].strip():
                    raise Exception('No text content found in PDF')

                # Log PDF analysis
                structure_analysis = self.chunking_service.analyze_pdf_structure(pdf_data)
                chunking_stats = self.chunking_service.get_chunking_stats(chunks)

                print(f'📊 PDF Processing Summary:', {
                    **pdf_result.get('summary', {}),
                    'structureAnalysis': structure_analysis.get('recommendedStrategy'),
                    'chunkingStats': {
                        'avgSize': chunking_stats.get('averageChunkSize'),
                        'range': f"{chunking_stats.get('minChunkSize')}-{chunking_stats.get('maxChunkSize')}"
                    }
                })
            else:
                # Process text content for webpages and other sources
                # file_path contains the text content for non-PDF sources
                text_result = await self.chunking_service.process_text_content(file_path, {
                    'fileId': file_id,
                    'fileName': file_name,
                    'workspaceId': workspace_id,
                    'cloudinaryData': cloudinary_data,
                    'contentType': content_type
                })

                chunks = text_result.get('chunks')

                if not text_result.get('textData', {}).get('fullText') or not text_result['textData']['fullText'].strip():
                    raise Exception('No text content provided')

                print(f'📊 Text Processing Summary:', text_result.get('summary', {}))

            print(f'📄 Created {len(chunks)} chunks for {file_name}')

            # Generate document-optimized embeddings in batches
            embeddings = await self.generate_embeddings_for_chunks(chunks)

            # Store in vector database
            print(f'🔄 Storing {len(chunks)} chunks with workspaceId: {workspace_id or "null"}')
            result = await self.vector_database_service.store_document_chunks(
                file_id,
                file_name,
                chunks,
                embeddings,
                workspace_id,
                cloudinary_data
            )

            print(f'✅ Successfully indexed {result.get("chunksCount")} chunks for {file_name} in workspace: {workspace_id or "null"}')
            return result

        except Exception as error:
            print(f'❌ Document indexing failed for {file_name}: {error}')
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

            # Generate embeddings for the entire batch
            batch_embeddings = await self.embedding_service.generate_batch_embeddings(batch_texts, 'document')
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    async def remove_document(self, file_id: str) -> Dict[str, Any]:
        """
        Remove document from index
        """
        try:
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

    def update_chunking_config(self, chunk_size: int, chunk_overlap: int):
        """
        Update chunking configuration
        """
        self.chunking_service.set_chunk_size(chunk_size)
        self.chunking_service.set_chunk_overlap(chunk_overlap)

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
