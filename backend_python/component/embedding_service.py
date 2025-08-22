import os
import asyncio
from typing import List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables with explicit path
env_path = Path(__file__).parent.parent / '.env'
print(f"🔧 Embedding Service ENV: Loading environment variables from: {env_path}")
load_dotenv(dotenv_path=env_path)

# Log environment variables for debugging
print(f"🔧 Embedding Service ENV: Environment variables after loading:")
print(f"   GEMINI_EMBEDDING_API_KEY: {'✅ Set' if os.getenv('GEMINI_EMBEDDING_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('GEMINI_EMBEDDING_API_KEY', '')), 8) if os.getenv('GEMINI_EMBEDDING_API_KEY') else 'None'})")
print(f"   GEMINI_CHAT_API_KEY: {'✅ Set' if os.getenv('GEMINI_CHAT_API_KEY') else '❌ Not set'} ({'*' * min(len(os.getenv('GEMINI_CHAT_API_KEY', '')), 8) if os.getenv('GEMINI_CHAT_API_KEY') else 'None'})")

class EmbeddingService:
    def __init__(self):
        self.genai_embedding = None
        self.genai_chat = None
        self.is_initialized_flag = False

        # Task-specific embedding configurations (matching JavaScript version)
        self.embedding_configs = {
            'document': {
                'model': 'text-embedding-004',
                'taskType': 'RETRIEVAL_DOCUMENT'
            },
            'query': {
                'model': 'text-embedding-004',
                'taskType': 'QUESTION_ANSWERING'
            },
            'similarity': {
                'model': 'text-embedding-004',
                'taskType': 'SEMANTIC_SIMILARITY'
            },
            'code': {
                'model': 'text-embedding-004',
                'taskType': 'CODE_RETRIEVAL_QUERY'
            },
            'classification': {
                'model': 'text-embedding-004',
                'taskType': 'CLASSIFICATION'
            },
            'clustering': {
                'model': 'text-embedding-004',
                'taskType': 'CLUSTERING'
            },
            'factVerification': {
                'model': 'text-embedding-004',
                'taskType': 'FACT_VERIFICATION'
            }
        }

    async def initialize(self):
        try:
            # Initialize Google GenAI for embeddings
            embedding_api_key = os.getenv('GEMINI_EMBEDDING_API_KEY')
            if embedding_api_key:
                print('🔄 Initializing Google GenAI for embeddings...')
                try:
                    import google.genai as genai
                    self.genai_embedding = genai.Client(api_key=embedding_api_key)
                    print('✅ Google GenAI Embedding client initialized')
                except ImportError as import_error:
                    print(f'❌ Failed to import google.genai: {import_error}')
                    raise Exception(f'Google GenAI SDK not available: {import_error}')
            else:
                print('⚠️ GEMINI_EMBEDDING_API_KEY not set, embedding service will not be available')

            # Initialize Google GenAI for chat
            chat_api_key = os.getenv('GEMINI_CHAT_API_KEY')
            if chat_api_key:
                print('🔄 Initializing Google GenAI for chat...')
                try:
                    if chat_api_key != embedding_api_key:
                        import google.genai as genai
                        self.genai_chat = genai.Client(api_key=chat_api_key)
                    else:
                        self.genai_chat = self.genai_embedding
                    print('✅ Google GenAI Chat client initialized')
                except ImportError as import_error:
                    print(f'❌ Failed to import google.genai for chat: {import_error}')
                    # Don't raise here, allow embedding to work even if chat fails
            else:
                print('⚠️ GEMINI_CHAT_API_KEY not set, chat service will not be available')

            # Set initialized flag based on whether we have at least embeddings
            self.is_initialized_flag = self.genai_embedding is not None
            
            if self.is_initialized_flag:
                print('✅ Embedding Service initialized successfully')
            else:
                print('❌ Embedding Service initialization failed - no valid API keys or SDK issues')

        except Exception as error:
            print(f'❌ Embedding Service initialization failed: {error}')
            self.is_initialized_flag = False
            raise error

    async def generate_embedding(self, text: str, task_type: str = 'document') -> List[float]:
        """Generate task-specific embeddings using Google GenAI"""
        try:
            if not self.genai_embedding:
                raise Exception("Google GenAI Embedding client not initialized")

            config = self.embedding_configs.get(task_type)
            if not config:
                print(f'⚠️ Unknown task type: {task_type}, using document config')
                config = self.embedding_configs['document']

            print(f'🔧 Generating {task_type} embedding with task type: {config["taskType"]}')

            # Use proper Google GenAI SDK method
            response = await asyncio.to_thread(
                self.genai_embedding.models.embed_content,
                model=config['model'],
                contents=[text],
                task_type=config['taskType']
            )

            if not response or not hasattr(response, 'embeddings') or not response.embeddings:
                raise Exception("No embedding values returned")

            if not response.embeddings[0] or not hasattr(response.embeddings[0], 'values'):
                raise Exception("Invalid embedding format - no values property")

            embedding = response.embeddings[0].values
            print(f'✅ Generated {task_type} embedding (dimension: {len(embedding)})')
            return embedding

        except Exception as error:
            print(f'❌ {task_type} embedding generation failed: {str(error)}')
            raise error

    async def generate_batch_embeddings(self, texts: List[str], task_type: str = 'document') -> List[List[float]]:
        """Generate batch embeddings for multiple texts (up to 100 per call)"""
        try:
            if not self.genai_embedding:
                raise Exception("Google GenAI Embedding client not initialized")

            if not isinstance(texts, list) or len(texts) == 0:
                raise Exception("Texts must be a non-empty array")

            if len(texts) > 100:
                raise Exception("Batch size cannot exceed 100 texts per API call")

            config = self.embedding_configs.get(task_type)
            if not config:
                print(f'⚠️ Unknown task type: {task_type}, using document config')
                config = self.embedding_configs['document']

            print(f'🔧 Generating batch {task_type} embeddings for {len(texts)} texts with task type: {config["taskType"]}')

            # Use proper Google GenAI SDK method for batch processing
            response = await asyncio.to_thread(
                self.genai_embedding.models.embed_content,
                model=config['model'],
                contents=texts,
                task_type=config['taskType']
            )

            if not response or not hasattr(response, 'embeddings') or not isinstance(response.embeddings, list):
                raise Exception("No embeddings array returned")

            if len(response.embeddings) != len(texts):
                raise Exception(f"Expected {len(texts)} embeddings, got {len(response.embeddings)}")

            embeddings = []
            for emb in response.embeddings:
                if not emb or not hasattr(emb, 'values'):
                    raise Exception("Invalid embedding format - no values property")
                embeddings.append(emb.values)

            print(f'✅ Generated batch {task_type} embeddings ({len(embeddings)} embeddings, dimension: {len(embeddings[0]) if embeddings else 0})')
            return embeddings

        except Exception as error:
            print(f'❌ Batch {task_type} embedding generation failed: {str(error)}')
            raise error

    def is_initialized(self) -> bool:
        return self.is_initialized_flag

    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive status information matching JavaScript version"""
        return {
            'genai_embedding': bool(self.genai_embedding),
            'genai_chat': bool(self.genai_chat),
            'embedding_configs': list(self.embedding_configs.keys())
        }

    def get_embedding_dimension(self) -> int:
        """Returns the dimension of embeddings produced by the model"""
        return 768  # text-embedding-004 produces 768-dimensional embeddings