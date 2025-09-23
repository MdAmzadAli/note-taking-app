
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, delete, select, text
from sqlalchemy.dialects.postgresql import insert
from typing import List, Dict, Any, Optional, Tuple
from ..db_schema.models import File, Context, WorkspaceFileContext
from .base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)

class ContextRepository(BaseRepository):
    """
    Repository for context operations
    Optimized for bulk retrieval and efficient single file vs workspace mode queries
    """
    
    def store_contexts_bulk(self, file_id: str, contexts_data: List[Dict[str, Any]]) -> int:
        """
        Bulk store contexts for a file with optimal performance
        Returns the number of contexts stored
        """
        with self.transaction():
            # Prepare context records
            context_records = []
            denormalized_records = []
            
            # Get file and workspace info for denormalization
            file_record = self.session.query(File).filter(File.id == file_id).first()
            if not file_record:
                raise ValueError(f"File {file_id} not found")
            
            for i, context_data in enumerate(contexts_data):
                context_number = i + 1  # 1-based indexing
                
                # Main context record
                context_record = {
                    'file_id': file_id,
                    'context_number': context_number,
                    'text_content': context_data.get('text', ''),
                    'chunk_index': context_data.get('metadata', {}).get('chunkIndex', i),
                    'page_number': context_data.get('metadata', {}).get('pageNumber'),
                    'start_line': context_data.get('metadata', {}).get('startLine'),
                    'end_line': context_data.get('metadata', {}).get('endLine'),
                    'lines_used': context_data.get('metadata', {}).get('linesUsed'),
                    'total_lines_on_page': context_data.get('metadata', {}).get('totalLinesOnPage'),
                    'tokens_estimated': context_data.get('metadata', {}).get('tokens_est'),
                    'total_chars': context_data.get('metadata', {}).get('total_chars'),
                    'page_url': context_data.get('metadata', {}).get('pageUrl'),
                    'thumbnail_url': context_data.get('metadata', {}).get('thumbnailUrl'),
                    'metadata_json': context_data.get('metadata', {})
                }
                context_records.append(context_record)
                
                # Denormalized record for fast queries
                denormalized_record = {
                    'workspace_id': file_record.workspace_id,
                    'file_id': file_id,
                    'context_number': context_number,
                    'file_name': file_record.file_name,
                    'text_content': context_data.get('text', ''),
                    'page_number': context_data.get('metadata', {}).get('pageNumber'),
                    'chunk_index': context_data.get('metadata', {}).get('chunkIndex', i)
                }
                denormalized_records.append(denormalized_record)
            
            # Bulk insert contexts
            self.session.bulk_insert_mappings(Context, context_records)
            
            # Bulk insert denormalized records
            self.session.bulk_insert_mappings(WorkspaceFileContext, denormalized_records)
            
            # Update file's total chunks count
            file_record.total_chunks = len(context_records)
            
            return len(context_records)
    
    def get_contexts_by_numbers(self, file_id: str, context_numbers: List[int]) -> List[Context]:
        """
        Get specific contexts by their context numbers (CRITICAL for RAG retrieval)
        This is the main method used after vector search
        """
        return self.session.query(Context).filter(
            and_(
                Context.file_id == file_id,
                Context.context_number.in_(context_numbers)
            )
        ).order_by(Context.context_number).all()
    
    def get_contexts_by_numbers_multi_file(self, file_context_pairs: List[Tuple[str, List[int]]]) -> List[Context]:
        """
        Get contexts from multiple files (for workspace mode)
        file_context_pairs: List of (file_id, [context_numbers])
        """
        if not file_context_pairs:
            return []
        
        # Build OR conditions for each file
        conditions = []
        for file_id, context_numbers in file_context_pairs:
            if context_numbers:
                conditions.append(
                    and_(
                        Context.file_id == file_id,
                        Context.context_number.in_(context_numbers)
                    )
                )
        
        if not conditions:
            return []
        
        return self.session.query(Context).filter(
            or_(*conditions)
        ).order_by(Context.file_id, Context.context_number).all()
    
    def get_contexts_workspace_optimized(self, workspace_id: str, 
                                        context_numbers: List[int],
                                        file_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Ultra-optimized method for workspace mode using denormalized table
        Returns contexts with file information
        """
        query = self.session.query(WorkspaceFileContext).filter(
            and_(
                WorkspaceFileContext.workspace_id == workspace_id,
                WorkspaceFileContext.context_number.in_(context_numbers)
            )
        )
        
        if file_ids:
            query = query.filter(WorkspaceFileContext.file_id.in_(file_ids))
        
        results = query.order_by(
            WorkspaceFileContext.file_id, 
            WorkspaceFileContext.context_number
        ).all()
        
        return [
            {
                'file_id': r.file_id,
                'context_number': r.context_number,
                'file_name': r.file_name,
                'text_content': r.text_content,
                'page_number': r.page_number,
                'chunk_index': r.chunk_index
            }
            for r in results
        ]
    
    def get_context_range(self, file_id: str, start_context: int, end_context: int) -> List[Context]:
        """Get a range of contexts (useful for expanded context retrieval)"""
        return self.session.query(Context).filter(
            and_(
                Context.file_id == file_id,
                Context.context_number.between(start_context, end_context)
            )
        ).order_by(Context.context_number).all()
    
    def get_contexts_by_page(self, file_id: str, page_number: int) -> List[Context]:
        """Get all contexts for a specific page"""
        return self.session.query(Context).filter(
            and_(
                Context.file_id == file_id,
                Context.page_number == page_number
            )
        ).order_by(Context.context_number).all()
    
    def search_contexts_text(self, workspace_id: Optional[str] = None,
                           file_id: Optional[str] = None,
                           search_text: str = "",
                           limit: int = 50) -> List[Context]:
        """Full-text search in contexts (if needed for hybrid search)"""
        query = self.session.query(Context)
        
        if file_id:
            query = query.filter(Context.file_id == file_id)
        elif workspace_id:
            query = query.join(File).filter(File.workspace_id == workspace_id)
        
        if search_text:
            query = query.filter(Context.text_content.ilike(f'%{search_text}%'))
        
        return query.limit(limit).all()
    
    def get_context_stats(self, file_id: str) -> Dict[str, Any]:
        """Get context statistics for a file"""
        stats = self.session.query(
            func.count(Context.context_number).label('total_contexts'),
            func.avg(Context.tokens_estimated).label('avg_tokens'),
            func.avg(Context.total_chars).label('avg_chars'),
            func.max(Context.page_number).label('max_page')
        ).filter(Context.file_id == file_id).first()
        
        return {
            'total_contexts': stats.total_contexts or 0,
            'avg_tokens': float(stats.avg_tokens or 0),
            'avg_chars': float(stats.avg_chars or 0),
            'max_page': stats.max_page or 0
        }
    
    def delete_file_contexts(self, file_id: str) -> int:
        """Delete all contexts for a file"""
        with self.transaction():
            # Delete from denormalized table
            self.session.query(WorkspaceFileContext).filter(
                WorkspaceFileContext.file_id == file_id
            ).delete()
            
            # Delete main contexts
            deleted_count = self.session.query(Context).filter(
                Context.file_id == file_id
            ).delete()
            
            return deleted_count
    
    def refresh_denormalized_data(self, workspace_id: str):
        """Refresh denormalized table for a workspace (maintenance operation)"""
        with self.transaction():
            # Delete existing denormalized data
            self.session.query(WorkspaceFileContext).filter(
                WorkspaceFileContext.workspace_id == workspace_id
            ).delete()
            
            # Rebuild from normalized tables
            rebuild_query = text("""
                INSERT INTO workspace_file_contexts 
                (workspace_id, file_id, context_number, file_name, text_content, page_number, chunk_index)
                SELECT 
                    f.workspace_id,
                    c.file_id,
                    c.context_number,
                    f.file_name,
                    c.text_content,
                    c.page_number,
                    c.chunk_index
                FROM contexts c
                JOIN files f ON c.file_id = f.id
                WHERE f.workspace_id = :workspace_id 
                  AND f.is_deleted = false
            """)
            
            self.session.execute(rebuild_query, {'workspace_id': workspace_id})
