
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, Dict, Any
from ..db_schema.models import User, Usage
from .base_repository import BaseRepository
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class UsageRepository(BaseRepository):
    """
    Repository for user usage operations
    """
    
    def __init__(self, session: Session):
        super().__init__(session)
    
    def get_transcription_usage(self, user_uuid: str) -> Optional[Dict[str, Any]]:
        """
        Get transcription used and transcription limit from usage table via user UUID
        
        Args:
            user_uuid: UUID of the user
            
        Returns:
            Dict with transcription_used and transcription_limit, or None if not found
        """
        try:
            usage = self.session.query(Usage).join(User).filter(
                User.id == user_uuid
            ).first()
            
            if not usage:
                return None
            
            return {
                'transcription_used': usage.transcription_used,
                'transcription_limit': usage.transcription_limit,
                'transcription_reset_date': usage.transcription_reset_date
            }
            
        except Exception as e:
            logger.error(f"Error getting transcription usage for user {user_uuid}: {e}")
            raise
    
    def initialize_usage_if_not_exists(self, user_uuid: str, current_transcription_duration: int) -> Dict[str, Any]:
        """
        Initialize usage table with current transcription duration if not existed earlier
        
        Args:
            user_uuid: UUID of the user
            current_transcription_duration: Duration in minutes to initialize with
            
        Returns:
            Dict with usage data
        """
        try:
            # Check if user exists
            user = self.session.query(User).filter(User.id == user_uuid).first()
            if not user:
                raise ValueError(f"User with UUID {user_uuid} not found")
            
            # Check if usage record exists
            usage = self.session.query(Usage).filter(Usage.user_id == user_uuid).first()
            
            if usage:
                # Usage already exists, return current data
                return {
                    'transcription_used': usage.transcription_used,
                    'transcription_limit': usage.transcription_limit,
                    'transcription_reset_date': usage.transcription_reset_date,
                    'created': False
                }
            
            # Create new usage record
            usage_id = str(uuid.uuid4())
            reset_date = datetime.now() + timedelta(days=30)  # Reset every 30 days
            
            new_usage = Usage(
                id=usage_id,
                user_id=user_uuid,
                transcription_used=current_transcription_duration,
                transcription_limit=600,  # Default 10 hours = 600 minutes
                transcription_reset_date=reset_date
            )
            
            self.session.add(new_usage)
            self.session.commit()
            
            return {
                'transcription_used': new_usage.transcription_used,
                'transcription_limit': new_usage.transcription_limit,
                'transcription_reset_date': new_usage.transcription_reset_date,
                'created': True
            }
            
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error initializing usage for user {user_uuid}: {e}")
            raise
    
    def update_transcription_used(self, user_uuid: str, additional_duration: int) -> Dict[str, Any]:
        """
        Update transcription used by adding additional duration
        
        Args:
            user_uuid: UUID of the user
            additional_duration: Duration in minutes to add to current usage
            
        Returns:
            Dict with updated usage data
        """
        try:
            usage = self.session.query(Usage).join(User).filter(
                User.id == user_uuid
            ).first()
            
            if not usage:
                raise ValueError(f"Usage record not found for user {user_uuid}")
            
            # Update transcription used
            usage.transcription_used += additional_duration
            usage.updated_at = datetime.now()
            
            self.session.commit()
            
            return {
                'transcription_used': usage.transcription_used,
                'transcription_limit': usage.transcription_limit,
                'transcription_reset_date': usage.transcription_reset_date,
                'updated': True
            }
            
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error updating transcription usage for user {user_uuid}: {e}")
            raise
