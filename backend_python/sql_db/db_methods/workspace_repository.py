
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, delete
from typing import List, Dict, Any, Optional
from ..db_schema.models import Workspace, File, Context, WorkspaceFileContext
from .base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)

class WorkspaceRepository(BaseRepository):
    """
    Repository for workspace operations
    Optimized for single file vs workspace mode queries
    """
    
    def create_workspace(self, workspace_id: str, name: str, description: str = None, 
                        metadata: Dict[str, Any] = None) -> Workspace:
        """Create a new workspace"""
        with self.transaction():
            workspace = Workspace(
                id=workspace_id,
                name=name,
                description=description,
                metadata_json=metadata or {}
            )
            self.session.add(workspace)
            return workspace
    
    def get_workspace(self, workspace_id: str) -> Optional[Workspace]:
        """Get workspace by ID"""
        return self.session.query(Workspace).filter(
            and_(
                Workspace.id == workspace_id,
                Workspace.is_deleted == False
            )
        ).first()
    
    def get_workspace_with_files(self, workspace_id: str) -> Optional[Workspace]:
        """Get workspace with all its files"""
        return self.session.query(Workspace).filter(
            and_(
                Workspace.id == workspace_id,
                Workspace.is_deleted == False
            )
        ).first()
    
    def list_workspaces(self, limit: int = 100, offset: int = 0) -> List[Workspace]:
        """List all active workspaces"""
        return self.session.query(Workspace).filter(
            Workspace.is_deleted == False
        ).offset(offset).limit(limit).all()
    
    def delete_workspace(self, workspace_id: str) -> bool:
        """
        Soft delete workspace - CASCADE will handle files and contexts automatically
        """
        with self.transaction():
            workspace = self.session.query(Workspace).filter(
                Workspace.id == workspace_id
            ).first()
            
            if not workspace:
                return False
            
            # Soft delete the workspace - files and contexts cascade automatically
            workspace.is_deleted = True
            workspace.deleted_at = func.now()
            
            # Bulk soft delete all files in workspace (preserves soft delete pattern)
            self.session.query(File).filter(
                File.workspace_id == workspace_id
            ).update({
                File.is_deleted: True,
                File.deleted_at: func.now()
            })
            
            return True
    
    def hard_delete_workspace(self, workspace_id: str) -> bool:
        """
        Permanently delete workspace - CASCADE handles all related data automatically
        """
        with self.transaction():
            deleted_count = self.session.query(Workspace).filter(
                Workspace.id == workspace_id
            ).delete()
            
            return deleted_count > 0
    
    def get_workspace_stats(self, workspace_id: str) -> Dict[str, Any]:
        """Get comprehensive workspace statistics"""
        # File count and total size
        file_stats = self.session.query(
            func.count(File.id).label('file_count'),
            func.sum(File.file_size).label('total_size'),
            func.sum(File.total_chunks).label('total_chunks')
        ).filter(
            and_(
                File.workspace_id == workspace_id,
                File.is_deleted == False
            )
        ).first()
        
        # Context count by file type
        context_stats = self.session.query(
            File.content_type,
            func.count(Context.context_number).label('context_count')
        ).join(Context, File.id == Context.file_id).filter(
            and_(
                File.workspace_id == workspace_id,
                File.is_deleted == False
            )
        ).group_by(File.content_type).all()
        
        return {
            'file_count': file_stats.file_count or 0,
            'total_size': file_stats.total_size or 0,
            'total_chunks': file_stats.total_chunks or 0,
            'context_by_type': {stat.content_type: stat.context_count for stat in context_stats}
        }
