
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Any, Optional, Union
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

class BaseRepository:
    """
    Base repository class with common database operations
    """
    
    def __init__(self, session: Session):
        self.session = session
    
    @contextmanager
    def transaction(self):
        """Context manager for database transactions"""
        try:
            yield self.session
            self.session.commit()
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Database transaction failed: {e}")
            raise
        except Exception as e:
            self.session.rollback()
            logger.error(f"Unexpected error in transaction: {e}")
            raise
    
    def bulk_insert_or_update(self, model_class, data_list: List[Dict[str, Any]]):
        """Efficient bulk insert or update"""
        try:
            if not data_list:
                return
            
            # Use bulk operations for better performance
            self.session.bulk_insert_mappings(model_class, data_list)
            self.session.commit()
            
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Bulk operation failed: {e}")
            raise
    
    def execute_raw_sql(self, query: str, params: Optional[Dict] = None):
        """Execute raw SQL query"""
        try:
            result = self.session.execute(query, params or {})
            return result.fetchall()
        except SQLAlchemyError as e:
            logger.error(f"Raw SQL execution failed: {e}")
            raise
