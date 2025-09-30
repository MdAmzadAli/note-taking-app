# Import components with logging
print("🔧 RAG Service: Starting component imports...")

try:
    from component.chunking_service import ChunkingService
    print("✅ RAG: ChunkingService imported successfully")
except ImportError as e:
    print(f"❌ RAG: Failed to import ChunkingService: {e}")

try:
    from component.embedding_service import EmbeddingService
    print("✅ RAG: EmbeddingService imported successfully")
except ImportError as e:
    print(f"❌ RAG: Failed to import EmbeddingService: {e}")

try:
    from component.vector_database_service import VectorDatabaseService
    print("✅ RAG: VectorDatabaseService imported successfully")
except ImportError as e:
    print(f"❌ RAG: Failed to import VectorDatabaseService: {e}")

try:
    from component.search_service import SearchService
    print("✅ RAG: SearchService imported successfully")
except ImportError as e:
    print(f"❌ RAG: Failed to import SearchService: {e}")

try:
    from component.answer_generation_service import AnswerGenerationService
    print("✅ RAG: AnswerGenerationService imported successfully")
except ImportError as e:
    print(f"❌ RAG: Failed to import AnswerGenerationService: {e}")

try:
    from component.document_indexing_service import DocumentIndexingService
    print("✅ RAG: DocumentIndexingService imported successfully")
except ImportError as e:
    print(f"❌ RAG: Failed to import DocumentIndexingService: {e}")

try:
    from component.unified_chunking_service import UnifiedChunkingService
    print("✅ RAG: UnifiedChunkingService imported successfully")
except ImportError as e:
    print(f"❌ RAG: Failed to import UnifiedChunkingService: {e}")

print("🔧 RAG Service: All component imports completed")
import os
from pathlib import Path
from dotenv import load_dotenv
from typing import Dict, Any

# Load environment variables from the backend_python directory
env_path = Path(__file__).parent.parent / '.env'
print(f"🔧 RAG Service ENV: Loading environment variables from: {env_path}")
load_dotenv(dotenv_path=env_path)

# Log environment variables for debugging
print(f"🔧 RAG Service ENV: Environment variables after loading:")
print(f"   QDRANT_URL: {'✅ Set' if os.getenv('QDRANT_URL') else '❌ Not set'} ({os.getenv('QDRANT_URL', 'None')})")
print(f"   QDRANT_API_KEY: {'✅ Set' if os.getenv('QDRANT_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('QDRANT_API_KEY', '')), 8) if os.getenv('QDRANT_API_KEY') else 'None'})")
print(f"   GEMINI_EMBEDDING_API_KEY: {'✅ Set' if os.getenv('GEMINI_EMBEDDING_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('GEMINI_EMBEDDING_API_KEY', '')), 8) if os.getenv('GEMINI_EMBEDDING_API_KEY') else 'None'})")
print(f"   GEMINI_CHAT_API_KEY: {'✅ Set' if os.getenv('GEMINI_CHAT_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('GEMINI_CHAT_API_KEY', '')), 8) if os.getenv('GEMINI_CHAT_API_KEY') else 'None'})")


class RAGService:
    def __init__(self):
        print("🔧 RAG Service: Starting initialization...")
        self.chunk_size = 800
        self.chunk_overlap = 100
        self.is_initialized = False

        # Initialize component services with logging
        try:
            self.chunking_service = ChunkingService(self.chunk_size, self.chunk_overlap)
            print("✅ RAG: ChunkingService component initialized")
        except Exception as e:
            print(f"❌ RAG: Failed to initialize ChunkingService: {e}")

        try:
            self.unified_chunking_service = UnifiedChunkingService(self.chunk_size, self.chunk_overlap)
            print("✅ RAG: UnifiedChunkingService component initialized")
        except Exception as e:
            print(f"❌ RAG: Failed to initialize UnifiedChunkingService: {e}")

        try:
            self.embedding_service = EmbeddingService()
            print("✅ RAG: EmbeddingService component initialized")
        except Exception as e:
            print(f"❌ RAG: Failed to initialize EmbeddingService: {e}")

        try:
            self.vector_database_service = VectorDatabaseService()
            print("✅ RAG: VectorDatabaseService component initialized")
        except Exception as e:
            print(f"❌ RAG: Failed to initialize VectorDatabaseService: {e}")

        try:
            self.search_service = SearchService(self.embedding_service, self.vector_database_service)
            print("✅ RAG: SearchService component initialized")
        except Exception as e:
            print(f"❌ RAG: Failed to initialize SearchService: {e}")

        try:
            self.answer_generation_service = AnswerGenerationService(self.embedding_service, self.search_service)
            print("✅ RAG: AnswerGenerationService component initialized")
        except Exception as e:
            print(f"❌ RAG: Failed to initialize AnswerGenerationService: {e}")

        try:
            self.document_indexing_service = DocumentIndexingService(
                self.chunking_service, self.embedding_service, self.vector_database_service
            )
            print("✅ RAG: DocumentIndexingService component initialized")
        except Exception as e:
            print(f"❌ RAG: Failed to initialize DocumentIndexingService: {e}")

        print("🔧 RAG Service: Component initialization completed")

    async def initialize(self):
        print('🔄 RAG Service: Starting initialization...')
        print('🔧 Environment check:')
        print(f'   QDRANT_URL: {"✅ Set" if os.getenv("QDRANT_URL") else "❌ Not set"} ({os.getenv("QDRANT_URL", "None")})')
        print(f'   QDRANT_API_KEY: {"✅ Set" if os.getenv("QDRANT_API_KEY") else "⚠️ Not set (optional)"} ({'*' * min(len(os.getenv("QDRANT_API_KEY", "")), 8) if os.getenv("QDRANT_API_KEY") else "None"})')
        print(f'   GEMINI_EMBEDDING_API_KEY: {"✅ Set" if os.getenv("GEMINI_EMBEDDING_API_KEY") else "❌ Not set"} ({'*' * min(len(os.getenv("GEMINI_EMBEDDING_API_KEY", "")), 8) if os.getenv("GEMINI_EMBEDDING_API_KEY") else "None"})')
        print(f'   GEMINI_CHAT_API_KEY: {"✅ Set" if os.getenv("GEMINI_CHAT_API_KEY") else "❌ Not set"} ({'*' * min(len(os.getenv("GEMINI_CHAT_API_KEY", "")), 8) if os.getenv("GEMINI_CHAT_API_KEY") else "None"})')

        # Initialize component services with detailed error reporting
        embedding_initialized = False
        vector_db_initialized = False

        print('🔧 Initializing EmbeddingService...')
        try:
            await self.embedding_service.initialize()
            embedding_initialized = self.embedding_service.is_initialized()
            print(f'✅ EmbeddingService initialized: {embedding_initialized}')
        except Exception as embed_error:
            print(f'❌ EmbeddingService initialization failed: {embed_error}')
            embedding_initialized = False

        print('🔧 Initializing VectorDatabaseService...')
        try:
            await self.vector_database_service.initialize()
            vector_db_initialized = self.vector_database_service.is_initialized()
            print(f'✅ VectorDatabaseService initialized: {vector_db_initialized}')
        except Exception as vector_error:
            print(f'❌ VectorDatabaseService initialization failed: {vector_error}')
            vector_db_initialized = False

        # Set initialization status based on component success
        self.is_initialized = embedding_initialized and vector_db_initialized

        if self.is_initialized:
            print('✅ RAG Service initialized successfully')
            print('📊 Final state:', {
                'qdrant': vector_db_initialized,
                'embedding': embedding_initialized,
                'initialized': self.is_initialized
            })
        else:
            print('⚠️ RAG Service partially initialized - some components failed')
            print('📊 Component states:', {
                'qdrant': vector_db_initialized,
                'embedding': embedding_initialized,
                'initialized': self.is_initialized
            })
            # Continue anyway to allow partial functionality

    # Delegate to ChunkingService
    async def extract_text_from_pdf(self, file_path):
        return await self.chunking_service.extract_text_from_pdf(file_path)

    def split_into_chunks(self, pdf_data, metadata=None):
        if metadata is None:
            metadata = {}
        return self.chunking_service.split_into_chunks(pdf_data, metadata)

    async def process_pdf(self, file_path, metadata=None):
        if metadata is None:
            metadata = {}
        return await self.chunking_service.process_pdf(file_path, metadata)

    def update_chunking_config(self, chunk_size, chunk_overlap):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.document_indexing_service.update_chunking_config(chunk_size, chunk_overlap)
        self.unified_chunking_service.set_chunk_size(chunk_size)
        self.unified_chunking_service.set_chunk_overlap(chunk_overlap)

    def split_with_strategy(self, data, metadata=None, strategy='semantic'):
        if metadata is None:
            metadata = {}
        return self.unified_chunking_service.split_with_strategy(data, metadata, strategy)

    def analyze_pdf_structure(self, pdf_data):
        return self.chunking_service.analyze_pdf_structure(pdf_data)

    def get_chunking_stats(self, chunks):
        return self.chunking_service.get_chunking_stats(chunks)

    # Delegate to EmbeddingService
    async def generate_embedding(self, text, task_type='document'):
        return await self.embedding_service.generate_embedding(text, task_type)

    async def generate_batch_embeddings(self, texts, task_type='document'):
        return await self.embedding_service.generate_batch_embeddings(texts, task_type)

    # Delegate to DocumentIndexingService
    async def index_document(self, file_id, file_path, metadata, user_uuid=None):
        return await self.document_indexing_service.index_document(
            file_id, file_path, metadata, user_uuid)

    async def index_document_unified(self, file_id, source, file_name, workspace_id=None, cloudinary_data=None, content_type=None, user_uuid=None):
        return await self.document_indexing_service.index_document_unified(
            file_id, source, file_name, workspace_id, cloudinary_data, content_type, user_uuid)

    async def remove_document(self, file_id, user_uuid=None):
        """Remove a document from the RAG index"""
        try:
            result = await self.document_indexing_service.remove_document(file_id, user_uuid)
            return result
        except Exception as error:
            print(f"❌ RAG: Failed to remove document {file_id}: {error}")
            return {
                'success': False,
                'fileId': file_id,
                'message': f'Document removal failed: {str(error)}'
            }

    # Delegate to SearchService
    async def search_relevant_chunks(self, query, file_ids=None, workspace_id=None, limit=5):
        return await self.search_service.search_relevant_chunks(query, file_ids, workspace_id, limit)

    async def search_workspace_relevant_chunks(self, query, file_ids, workspace_id, total_limit):
        return await self.search_service.search_workspace_relevant_chunks(query, file_ids, workspace_id, total_limit)

    async def search_single_file_chunks(self, query, file_ids, workspace_id, limit):
        return await self.search_service.search_single_file_chunks(query, file_ids, workspace_id, limit)

    def apply_mmr(self, candidates, query_embedding, total_limit, min_per_doc):
        return self.search_service.apply_mmr(candidates, query_embedding, total_limit, min_per_doc)

    def compute_text_similarity(self, text1, text2):
        return self.search_service.compute_text_similarity(text1, text2)

    # Delegate to AnswerGenerationService
    async def generate_answer(self, query, file_ids=None, workspace_id=None):
        return await self.answer_generation_service.generate_answer(query, file_ids, workspace_id)

    def is_financial_query(self, query):
        return self.answer_generation_service.is_financial_query(query)

    async def generate_two_step_answer(self, query, relevant_chunks):
        return await self.answer_generation_service.generate_two_step_answer(query, relevant_chunks)

    async def generate_standard_answer(self, query, relevant_chunks):
        return await self.answer_generation_service.generate_standard_answer(query, relevant_chunks)

    # Health check with all components
    async def health_check(self):
        try:
            # Get component health status
            vector_db_health = await self.vector_database_service.health_check()
            embedding_status = self.embedding_service.get_status()

            # Determine overall health status
            qdrant_healthy = vector_db_health.get('qdrant', False)
            embedding_healthy = embedding_status.get('genai_embedding', False)
            chat_healthy = embedding_status.get('genai_chat', False)

            # If both core services are working, we're healthy
            # If at least one is working, we're degraded but functional
            # If neither is working, we're unhealthy
            if qdrant_healthy and embedding_healthy:
                overall_status = 'healthy'
            elif qdrant_healthy or embedding_healthy:
                overall_status = 'degraded'
            else:
                overall_status = 'unhealthy'

            # Update our initialization status based on component health
            self.is_initialized = qdrant_healthy and embedding_healthy

            return {
                'status': overall_status,
                'qdrant': qdrant_healthy,
                'genaiEmbedding': embedding_healthy,
                'genaiChat': chat_healthy,
                'initialized': self.is_initialized,
                'embeddingConfigs': embedding_status.get('embedding_configs', []),
                'message': f'RAG service status: {overall_status}'
            }
        except Exception as error:
            return {
                'status': 'unhealthy',
                'qdrant': False,
                'genaiEmbedding': False,
                'genaiChat': False,
                'initialized': False,
                'error': str(error)
            }

    def is_ready_for_indexing(self) -> bool:
        """Check if RAG service is ready for document indexing"""
        vector_ready = (self.vector_database_service is not None and 
                       self.vector_database_service.is_initialized() and
                       self.vector_database_service.client is not None)
        embedding_ready = (self.embedding_service is not None and 
                          self.embedding_service.is_initialized())
        
        print(f'🔍 RAG indexing readiness check: vector_ready={vector_ready}, embedding_ready={embedding_ready}')
        
        return (self.document_indexing_service is not None and
                vector_ready and embedding_ready)

    def is_ready_for_search(self) -> bool:
        """Check if RAG service is ready for searching"""
        vector_ready = (self.vector_database_service is not None and 
                       self.vector_database_service.is_initialized() and
                       self.vector_database_service.client is not None)
        embedding_ready = (self.embedding_service is not None and 
                          self.embedding_service.is_initialized())
        
        print(f'🔍 RAG search readiness check: vector_ready={vector_ready}, embedding_ready={embedding_ready}')
        
        return (self.search_service is not None and
                vector_ready and embedding_ready)

    def is_ready_for_deletion(self) -> bool:
        """Check if RAG service is ready for document deletion"""
        vector_ready = (self.vector_database_service is not None and 
                       self.vector_database_service.is_initialized() and
                       self.vector_database_service.client is not None)
        
        print(f'🔍 RAG deletion readiness check: vector_ready={vector_ready}')
        
        return vector_ready

    def get_detailed_status(self) -> dict:
        """Get detailed status of all RAG service components"""
        status = {
            'rag_initialized': self.is_initialized,
            'vector_service_exists': self.vector_database_service is not None,
            'vector_initialized': False,
            'vector_client_exists': False,
            'embedding_service_exists': self.embedding_service is not None,
            'embedding_initialized': False,
            'ready_for_indexing': False,
            'ready_for_search': False,
            'ready_for_deletion': False
        }
        
        if self.vector_database_service:
            status['vector_initialized'] = self.vector_database_service.is_initialized()
            status['vector_client_exists'] = self.vector_database_service.client is not None
        
        if self.embedding_service:
            status['embedding_initialized'] = self.embedding_service.is_initialized()
        
        status['ready_for_indexing'] = self.is_ready_for_indexing()
        status['ready_for_search'] = self.is_ready_for_search()
        status['ready_for_deletion'] = self.is_ready_for_deletion()
        
        return status

    async def search_query(self, query: str, limit: int = 5, workspace_id: str = None) -> Dict[str, Any]:
        """
        Search for relevant documents based on a query
        """
        try:
            if not self.search_service:
                raise Exception("Search service not initialized")

            print(f"🔍 RAG: Starting search for query: '{query[:50]}{'...' if len(query) > 50 else ''}'")
            print(f"🏢 RAG: Using workspaceId filter: {workspace_id or 'null'}")

            # Perform search using the search service
            search_results = await self.search_service.search_documents(query, limit, workspace_id)

            print(f"📊 RAG: Search completed, found {len(search_results.get('chunks', []))} relevant chunks")

            return search_results

        except Exception as error:
            print(f"❌ RAG: Search failed: {error}")
            raise error


# Create singleton instance
rag_service_instance = RAGService()