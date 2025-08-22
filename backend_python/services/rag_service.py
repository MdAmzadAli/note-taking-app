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
        print(f'   QDRANT_URL: {"✅ Set" if os.getenv("QDRANT_URL") else "❌ Not set"}')
        print(f'   QDRANT_API_KEY: {"✅ Set" if os.getenv("QDRANT_API_KEY") else "⚠️ Not set (optional)"}')
        print(f'   GEMINI_EMBEDDING_API_KEY: {"✅ Set" if os.getenv("GEMINI_EMBEDDING_API_KEY") else "❌ Not set"}')
        print(f'   GEMINI_CHAT_API_KEY: {"✅ Set" if os.getenv("GEMINI_CHAT_API_KEY") else "❌ Not set"}')

        try:
            # Check if required environment variables are available
            if not (os.getenv('QDRANT_URL') and os.getenv('GEMINI_EMBEDDING_API_KEY') and os.getenv('GEMINI_CHAT_API_KEY')):
                print('⚠️ RAG environment variables not configured, running in mock mode')
                self.is_initialized = False
                return

            # Initialize all component services
            await self.embedding_service.initialize()
            await self.vector_database_service.initialize()

            self.is_initialized = True
            print('✅ RAG Service initialized successfully')
            print('📊 Final state:', {
                'qdrant': self.vector_database_service.is_initialized(),
                'embedding': self.embedding_service.is_initialized(),
                'initialized': self.is_initialized
            })
        except Exception as error:
            print('❌ RAG Service initialization failed')
            print(f'❌ Error type: {type(error).__name__}')
            print(f'❌ Error message: {error}')
            self.is_initialized = False
            # Don't throw error, allow app to continue without RAG

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
    async def index_document(self, file_id, file_path, file_name, workspace_id=None, cloudinary_data=None, content_type='pdf'):
        return await self.document_indexing_service.index_document(
            file_id, file_path, file_name, workspace_id, cloudinary_data, content_type)
    
    async def index_document_unified(self, file_id, source, file_name, workspace_id=None, cloudinary_data=None, content_type=None):
        return await self.document_indexing_service.index_document_unified(
            file_id, source, file_name, workspace_id, cloudinary_data, content_type)

    async def remove_document(self, file_id):
        return await self.document_indexing_service.remove_document(file_id)

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
            if not self.is_initialized:
                return {
                    'status': 'degraded',
                    'qdrant': False,
                    'genaiEmbedding': False,
                    'genaiChat': False,
                    'initialized': False,
                    'message': 'RAG service not configured (missing environment variables)'
                }

            vector_db_health = await self.vector_database_service.health_check()
            embedding_status = self.embedding_service.get_status()

            return {
                'status': vector_db_health['status'],
                'qdrant': vector_db_health['qdrant'],
                'genaiEmbedding': embedding_status['genai_embedding'],
                'genaiChat': embedding_status['genai_chat'],
                'initialized': self.is_initialized,
                'embeddingConfigs': embedding_status['embedding_configs']
            }
        except Exception as error:
            return {
                'status': 'unhealthy',
                'qdrant': False,
                'genaiEmbedding': self.embedding_service.get_status()['genai_embedding'],
                'genaiChat': self.embedding_service.get_status()['genai_chat'],
                'initialized': self.is_initialized,
                'error': str(error)
            }


# Create singleton instance
rag_service_instance = RAGService()