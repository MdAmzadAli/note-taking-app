
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, delete, select
from typing import List, Dict, Any, Optional
from ..db_schema.models import Workspace, File, Context
from .base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)

class FileRepository(BaseRepository):
    """
    Repository for file operations
    Optimized for both single file and workspace mode queries
    """
    
    def create_file(self, file_id: str, workspace_id: Optional[str], content_type: str, file_size: int = 0) -> File:
        """Create a new file record with minimal schema"""
        with self.transaction():
            file_record = File(
                id=file_id,
                workspace_id=workspace_id,  # Can be None for single file mode
                content_type=content_type,
                file_size=file_size
            )
            self.session.add(file_record)
            
            # Update workspace total size if file belongs to a workspace
            if workspace_id and file_size > 0:
                self._update_workspace_size(workspace_id, file_size)
            
            return file_record
    
    def get_file(self, file_id: str) -> Optional[File]:
        """Get file by ID"""
        return self.session.query(File).filter(
            File.id == file_id
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
            
            # Update workspace size before soft deleting
            if file_record.workspace_id and file_record.file_size > 0:
                self._update_workspace_size(file_record.workspace_id, -file_record.file_size)
            
            # Soft delete the file - contexts cascade automatically
            file_record.is_deleted = True
            file_record.deleted_at = func.now()
            
            return True
    
    def hard_delete_file(self, file_id: str) -> bool:
        """Permanently delete file - CASCADE handles all related data automatically"""
        with self.transaction():
            # Get file info before deletion to update workspace size
            file_record = self.session.query(File).filter(
                File.id == file_id
            ).first()
            
            if file_record:
                # Update workspace size before hard deleting
                if file_record.workspace_id and file_record.file_size > 0:
                    self._update_workspace_size(file_record.workspace_id, -file_record.file_size)
                
                # Delete the file
                deleted_count = self.session.query(File).filter(
                    File.id == file_id
                ).delete()
                
                return deleted_count > 0
            
            return False
    
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
    
    def _update_workspace_size(self, workspace_id: str, size_delta: int):
        """Update workspace total size by adding/subtracting size delta"""
        from ..db_schema.models import Workspace
        self.session.query(Workspace).filter(
            Workspace.id == workspace_id
        ).update({
            Workspace.total_size: Workspace.total_size + size_delta
        })
    
    def update_file_size(self, file_id: str, new_size: int):
        """Update file size and adjust workspace total accordingly"""
        with self.transaction():
            file_record = self.session.query(File).filter(
                File.id == file_id
            ).first()
            
            if file_record:
                old_size = file_record.file_size
                size_delta = new_size - old_size
                
                # Update file size
                file_record.file_size = new_size
                
                # Update workspace total size if file belongs to a workspace
                if file_record.workspace_id and size_delta != 0:
                    self._update_workspace_size(file_record.workspace_id, size_delta)
