
import os
# import google.generativeai as genai
# from google.generativeai import GenerativeModel
from typing import List, Optional
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class EmbeddingService:
    def __init__(self):
        self.genai_embedding = None
        self.genai_chat = None
        self.embedding_model = None
        self.chat_model = None
        self.is_initialized_flag = False

    async def initialize(self):
        print('🔧 EmbeddingService: Starting initialization...')
        
        try:
            # Configure Google AI with embedding API key
            embedding_api_key = os.getenv('GEMINI_EMBEDDING_API_KEY')
            chat_api_key = os.getenv('GEMINI_CHAT_API_KEY')
            
            if not embedding_api_key:
                raise Exception('GEMINI_EMBEDDING_API_KEY environment variable is required')
            
            if not chat_api_key:
                raise Exception('GEMINI_CHAT_API_KEY environment variable is required')

            # Initialize embedding client
            genai.configure(api_key=embedding_api_key)
            self.genai_embedding = genai
            self.embedding_model = 'text-embedding-004'
            
            # Initialize chat client with separate API key if different
            if chat_api_key != embedding_api_key:
                # Create a separate client for chat with different API key
                import google.generativeai as chat_genai
                chat_genai.configure(api_key=chat_api_key)
                self.genai_chat = chat_genai
            else:
                self.genai_chat = genai
            
            self.chat_model = GenerativeModel('gemini-2.5-flash')
            
            print('✅ EmbeddingService: Google AI clients configured successfully')
            print('🔧 Models configured:')
            print(f'   Embedding: {self.embedding_model}')
            print('   Chat: gemini-2.5-flash')
            
            self.is_initialized_flag = True
            print('✅ EmbeddingService initialized successfully')
            
        except Exception as error:
            print(f'❌ EmbeddingService initialization failed: {error}')
            self.is_initialized_flag = False
            raise error

    async def generate_embedding(self, text: str) -> List[float]:
        if not self.is_initialized_flag:
            raise Exception('EmbeddingService not initialized')
        
        if not text or not text.strip():
            raise Exception('Text cannot be empty')
        
        try:
            # Generate embedding using Google AI
            response = await asyncio.to_thread(
                self.genai_embedding.embed_content,
                model=self.embedding_model,
                content=text,
                task_type="retrieval_document"
            )
            
            if not response or 'embedding' not in response:
                raise Exception('Invalid embedding response')
            
            return response['embedding']
            
        except Exception as error:
            print(f'❌ Embedding generation failed: {error}')
            raise error

    async def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        if not self.is_initialized_flag:
            raise Exception('EmbeddingService not initialized')
        
        if not texts:
            return []
        
        embeddings = []
        for text in texts:
            embedding = await self.generate_embedding(text)
            embeddings.append(embedding)
        
        return embeddings

    def is_initialized(self) -> bool:
        return self.is_initialized_flag

    def get_embedding_dimension(self) -> int:
        """Returns the dimension of embeddings produced by the model"""
        return 768  # text-embedding-004 produces 768-dimensional embeddings
