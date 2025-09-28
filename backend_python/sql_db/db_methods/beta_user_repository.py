from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Dict, Any, Optional
from ..db_schema.models import User
from .base_repository import BaseRepository
import logging
import uuid

logger = logging.getLogger(__name__)

class BetaUserRepository(BaseRepository):
    """
    Repository for beta user operations
    """
    
    def create_beta_user(self, email: str) -> User:
        """Create a new beta user with email"""
        with self.transaction():
            # Generate unique ID for beta user
            user_id = str(uuid.uuid4())
            
            beta_user = User(
                id=user_id,
                email=email.lower().strip()
            )
            self.session.add(beta_user)
            return beta_user
    
    def create_beta_user_with_uuid(self, user_uuid: str, email: Optional[str] = None) -> User:
        """Create a new beta user with specific UUID and optional email"""
        with self.transaction():
            beta_user = User(
                id=user_uuid,
                email=email.lower().strip() if email else None
            )
            self.session.add(beta_user)
            return beta_user
    
    def get_beta_user_by_email(self, email: str) -> Optional[User]:
        """Get beta user by email"""
        return self.session.query(User).filter(
            User.email == email.lower().strip()
        ).first()
    
    def get_beta_user_by_id(self, user_id: str) -> Optional[User]:
        """Get beta user by ID"""
        return self.session.query(User).filter(
            User.id == user_id
        ).first()
    
    def update_beta_user_email(self, user_id: str, new_email: str) -> Optional[User]:
        """Update beta user email"""
        with self.transaction():
            beta_user = self.session.query(User).filter(
                User.id == user_id
            ).first()
            
            if not beta_user:
                return None
            
            beta_user.email = new_email.lower().strip()
            return beta_user
    
    def email_exists(self, email: str) -> bool:
        """Check if email already exists"""
        count = self.session.query(User).filter(
            User.email == email.lower().strip()
        ).count()
        return count > 0
    
    def list_beta_users(self, limit: int = 100, offset: int = 0) -> List[User]:
        """List all beta users"""
        return self.session.query(User).order_by(
            User.created_at.desc()
        ).offset(offset).limit(limit).all()
    
    def get_beta_user_count(self) -> int:
        """Get total count of beta users"""
        return self.session.query(User).count()
    
    def delete_beta_user(self, user_id: str) -> bool:
        """Delete beta user by ID"""
        with self.transaction():
            beta_user = self.session.query(User).filter(
                User.id == user_id
            ).first()
            
            if not beta_user:
                return False
            
            self.session.delete(beta_user)
            return True