
from sqlalchemy.orm import Session
from ..db_schema.base import SessionLocal, create_all_tables, engine
from .workspace_repository import WorkspaceRepository
from .file_repository import FileRepository
from .context_repository import ContextRepository
from .rag_repository import RAGRepository
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    Central database manager that coordinates all repository operations
    Provides a single entry point for all database operations
    """
    
    def __init__(self):
        self.session: Session = None
        self._workspace_repo = None
        self._file_repo = None
        self._context_repo = None
        self._rag_repo = None
    
    def __enter__(self):
        """Context manager entry"""
        self.session = SessionLocal()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        if self.session:
            if exc_type:
                self.session.rollback()
            self.session.close()
    
    @property
    def workspace_repo(self) -> WorkspaceRepository:
        """Get workspace repository"""
        if not self._workspace_repo:
            self._workspace_repo = WorkspaceRepository(self.session)
        return self._workspace_repo
    
    @property
    def file_repo(self) -> FileRepository:
        """Get file repository"""
        if not self._file_repo:
            self._file_repo = FileRepository(self.session)
        return self._file_repo
    
    @property
    def context_repo(self) -> ContextRepository:
        """Get context repository"""
        if not self._context_repo:
            self._context_repo = ContextRepository(self.session)
        return self._context_repo
    
    @property
    def rag_repo(self) -> RAGRepository:
        """Get RAG repository"""
        if not self._rag_repo:
            self._rag_repo = RAGRepository(self.session)
        return self._rag_repo
    
    def initialize_database(self):
        """Initialize database tables"""
        try:
            logger.info("Creating database tables...")
            create_all_tables()
            logger.info("Database tables created successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            return False
    
    def health_check(self) -> bool:
        """Check database connectivity"""
        try:
            with engine.connect() as conn:
                conn.execute("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    def get_session(self) -> Session:
        """Get a new database session"""
        return SessionLocal()

# Global database manager instance
db_manager = DatabaseManager()

# Convenience functions for external use
def get_db_manager() -> DatabaseManager:
    """Get database manager instance"""
    return db_manager

def initialize_database():
    """Initialize database tables"""
    return db_manager.initialize_database()

def health_check():
    """Check database health"""
    return db_manager.health_check()
