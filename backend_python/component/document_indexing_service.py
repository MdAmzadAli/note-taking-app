
import asyncio
import uuid
from typing import List, Dict, Any, Optional

class DocumentIndexingService:
    def __init__(self, chunking_service, embedding_service, vector_database_service):
        self.chunking_service = chunking_service
        self.embedding_service = embedding_service
        self.vector_database_service = vector_database_service

    async def index_document(self, file_path: str, file_id: str, file_name: str, 
                           workspace_id: Optional[str] = None, cloudinary_data: Optional[Dict] = None) -> Dict[str, Any]:
        try:
            print(f'📄 DocumentIndexingService: Starting indexing for {file_name}')
            print(f'📁 File ID: {file_id}')
            print(f'🏢 Workspace ID: {workspace_id}')

            # Extract text and create chunks
            print('📝 Extracting text from PDF...')
            pdf_data = await self.chunking_service.extract_text_from_pdf(file_path)
            
            if not pdf_data or not pdf_data.get('pages'):
                raise Exception('No text content extracted from PDF')

            print(f'📊 Extracted {len(pdf_data["pages"])} pages')

            # Create metadata for chunking
            metadata = {
                'fileId': file_id,
                'fileName': file_name,
                'workspaceId': workspace_id
            }

            # Add Cloudinary URLs if available
            if cloudinary_data:
                metadata.update({
                    'pageUrl': cloudinary_data.get('pageUrl'),
                    'cloudinaryUrl': cloudinary_data.get('cloudinaryUrl'),
                    'thumbnailUrl': cloudinary_data.get('thumbnailUrl')
                })

            print('✂️ Splitting into chunks...')
            chunks = self.chunking_service.split_into_chunks(pdf_data, metadata)
            
            if not chunks:
                raise Exception('No chunks created from document')

            print(f'📊 Created {len(chunks)} chunks')

            # Generate embeddings for all chunks
            print('🧠 Generating embeddings...')
            chunk_texts = [chunk['text'] for chunk in chunks]
            embeddings = await self.embedding_service.generate_embeddings_batch(chunk_texts)

            # Add embeddings to chunks
            for i, chunk in enumerate(chunks):
                chunk['embedding'] = embeddings[i]

            print(f'✅ Generated {len(embeddings)} embeddings')

            # Store chunks in vector database
            print('💾 Storing chunks in vector database...')
            chunk_ids = await self.vector_database_service.store_chunks(chunks)

            print(f'✅ Document indexing complete for {file_name}')
            print(f'📊 Summary: {len(chunks)} chunks, {len(embeddings)} embeddings, {len(chunk_ids)} stored')

            return {
                'fileId': file_id,
                'fileName': file_name,
                'workspaceId': workspace_id,
                'totalChunks': len(chunks),
                'totalPages': len(pdf_data['pages']),
                'chunkIds': chunk_ids,
                'processingStats': {
                    'pagesProcessed': len(pdf_data['pages']),
                    'chunksCreated': len(chunks),
                    'embeddingsGenerated': len(embeddings),
                    'chunksStored': len(chunk_ids)
                }
            }

        except Exception as error:
            print(f'❌ Document indexing failed for {file_name}: {error}')
            raise error

    async def remove_document(self, file_id: str) -> Dict[str, Any]:
        try:
            print(f'🗑️ DocumentIndexingService: Removing document {file_id}')

            # Get chunk count before removal
            chunk_count = await self.vector_database_service.get_chunk_count(file_id=file_id)
            
            # Remove chunks from vector database
            await self.vector_database_service.remove_chunks_by_file_id(file_id)

            print(f'✅ Document removal complete for {file_id}')
            print(f'📊 Removed {chunk_count} chunks')

            return {
                'fileId': file_id,
                'chunksRemoved': chunk_count,
                'status': 'success'
            }

        except Exception as error:
            print(f'❌ Document removal failed for {file_id}: {error}')
            raise error

    async def reindex_document(self, file_path: str, file_id: str, file_name: str, 
                              workspace_id: Optional[str] = None, cloudinary_data: Optional[Dict] = None) -> Dict[str, Any]:
        try:
            print(f'🔄 DocumentIndexingService: Reindexing document {file_name}')

            # Remove existing chunks
            await self.remove_document(file_id)

            # Index the document again
            return await self.index_document(file_path, file_id, file_name, workspace_id, cloudinary_data)

        except Exception as error:
            print(f'❌ Document reindexing failed for {file_name}: {error}')
            raise error

    async def get_document_stats(self, file_id: Optional[str] = None, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        try:
            print(f'📊 DocumentIndexingService: Getting stats for file_id={file_id}, workspace_id={workspace_id}')

            chunk_count = await self.vector_database_service.get_chunk_count(file_id, workspace_id)

            return {
                'fileId': file_id,
                'workspaceId': workspace_id,
                'totalChunks': chunk_count,
                'status': 'success'
            }

        except Exception as error:
            print(f'❌ Failed to get document stats: {error}')
            return {
                'fileId': file_id,
                'workspaceId': workspace_id,
                'totalChunks': 0,
                'status': 'error',
                'error': str(error)
            }
