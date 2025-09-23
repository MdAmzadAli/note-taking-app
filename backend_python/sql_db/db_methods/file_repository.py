
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, delete, select
from typing import List, Dict, Any, Optional
from ..db_schema.models import Workspace, File, Context, WorkspaceFileContext
from .base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)

class FileRepository(BaseRepository):
    """
    Repository for file operations
    Optimized for both single file and workspace mode queries
    """
    
    def create_file(self, file_id: str, workspace_id: str, file_name: str, 
                   file_data: Dict[str, Any]) -> File:
        """Create a new file record"""
        with self.transaction():
            file_record = File(
                id=file_id,
                workspace_id=workspace_id,
                file_name=file_name,
                original_name=file_data.get('original_name'),
                file_type=file_data.get('file_type'),
                file_size=file_data.get('file_size'),
                content_type=file_data.get('content_type'),
                source_url=file_data.get('source_url'),
                cloudinary_url=file_data.get('cloudinary_url'),
                page_urls=file_data.get('page_urls', []),
                total_pages=file_data.get('total_pages'),
                embedding_type=file_data.get('embedding_type', 'RETRIEVAL_DOCUMENT'),
                metadata_json=file_data.get('metadata', {})
            )
            self.session.add(file_record)
            return file_record
    
    def get_file(self, file_id: str) -> Optional[File]:
        """Get file by ID"""
        return self.session.query(File).filter(
            and_(
                File.id == file_id,
                File.is_deleted == False
            )
        ).first()
    
    def get_file_with_workspace(self, file_id: str) -> Optional[File]:
        """Get file with workspace information"""
        return self.session.query(File).join(Workspace).filter(
            and_(
                File.id == file_id,
                File.is_deleted == False,
                Workspace.is_deleted == False
            )
        ).first()
    
    def get_files_by_workspace(self, workspace_id: str, limit: int = 100, 
                              offset: int = 0) -> List[File]:
        """Get all files in a workspace"""
        return self.session.query(File).filter(
            and_(
                File.workspace_id == workspace_id,
                File.is_deleted == False
            )
        ).offset(offset).limit(limit).all()
    
    def get_files_by_ids(self, file_ids: List[str]) -> List[File]:
        """Get multiple files by their IDs (for workspace mode)"""
        return self.session.query(File).filter(
            and_(
                File.id.in_(file_ids),
                File.is_deleted == False
            )
        ).all()
    
    def update_file_chunks_count(self, file_id: str, chunk_count: int):
        """Update total chunks count for a file"""
        with self.transaction():
            self.session.query(File).filter(
                File.id == file_id
            ).update({File.total_chunks: chunk_count})
    
    def delete_file(self, file_id: str) -> bool:
        """Soft delete file - CASCADE handles contexts automatically"""
        with self.transaction():
            file_record = self.session.query(File).filter(
                File.id == file_id
            ).first()
            
            if not file_record:
                return False
            
            # Soft delete the file - contexts cascade automatically
            file_record.is_deleted = True
            file_record.deleted_at = func.now()
            
            return True
    
    def hard_delete_file(self, file_id: str) -> bool:
        """Permanently delete file - CASCADE handles all related data automatically"""
        with self.transaction():
            deleted_count = self.session.query(File).filter(
                File.id == file_id
            ).delete()
            
            return deleted_count > 0
    
    def search_files(self, workspace_id: Optional[str] = None, 
                    file_name_pattern: Optional[str] = None,
                    content_type: Optional[str] = None,
                    limit: int = 50, offset: int = 0) -> List[File]:
        """Search files with various filters"""
        query = self.session.query(File).filter(File.is_deleted == False)
        
        if workspace_id:
            query = query.filter(File.workspace_id == workspace_id)
        
        if file_name_pattern:
            query = query.filter(File.file_name.ilike(f'%{file_name_pattern}%'))
        
        if content_type:
            query = query.filter(File.content_type == content_type)
        
        return query.offset(offset).limit(limit).all()
    
    def get_file_stats(self, file_id: str) -> Dict[str, Any]:
        """Get file statistics"""
        file_record = self.get_file(file_id)
        if not file_record:
            return {}
        
        context_count = self.session.query(func.count(Context.context_number)).filter(
            Context.file_id == file_id
        ).scalar()
        
        return {
            'file_size': file_record.file_size,
            'total_pages': file_record.total_pages,
            'total_chunks': file_record.total_chunks,
            'actual_context_count': context_count,
            'content_type': file_record.content_type
        }
