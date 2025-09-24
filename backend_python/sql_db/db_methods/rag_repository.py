
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from typing import List, Dict, Any, Optional, Tuple
from ..db_schema.models import File, Context
from .base_repository import BaseRepository
from .context_repository import ContextRepository
import logging

logger = logging.getLogger(__name__)

class RAGRepository(BaseRepository):
    """
    Specialized repository for RAG operations
    Optimized for the specific query patterns used after vector search
    """
    
    def __init__(self, session: Session):
        super().__init__(session)
        self.context_repo = ContextRepository(session)
    
    def retrieve_contexts_for_rag(self, vector_search_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Main RAG retrieval method - gets text contexts based on vector search results
        
        vector_search_results format:
        [
            {
                'fileId': 'file123',
                'workspaceId': 'workspace456', 
                'contextNumber': 5,
                'score': 0.85,
                'fileName': 'document.pdf'
            },
            ...
        ]
        """
        if not vector_search_results:
            return []
        
        # Group by workspace mode vs single file mode
        workspace_mode_results = {}  # workspace_id -> [(file_id, context_numbers)]
        single_file_results = {}     # file_id -> [context_numbers]
        
        for result in vector_search_results:
            file_id = result.get('fileId')
            workspace_id = result.get('workspaceId')
            context_number = result.get('contextNumber')
            
            if not file_id or context_number is None:
                continue
            
            # Determine if this is workspace mode (multiple files) or single file mode
            if workspace_id and workspace_id.startswith('single_'):
                # Single file mode
                if file_id not in single_file_results:
                    single_file_results[file_id] = []
                single_file_results[file_id].append(context_number)
            else:
                # Workspace mode
                if workspace_id not in workspace_mode_results:
                    workspace_mode_results[workspace_id] = {}
                if file_id not in workspace_mode_results[workspace_id]:
                    workspace_mode_results[workspace_id][file_id] = []
                workspace_mode_results[workspace_id][file_id].append(context_number)
        
        all_contexts = []
        
        # Handle single file mode (optimized single file queries)
        for file_id, context_numbers in single_file_results.items():
            contexts = self.context_repo.get_contexts_by_numbers(file_id, context_numbers)
            
            for context in contexts:
                all_contexts.append({
                    'fileId': context.file_id,
                    'contextNumber': context.context_number,
                    'text': context.text_content,
                    'metadata': {
                        'chunkIndex': context.chunk_index,
                        'pageNumber': context.page_number,
                        'startLine': context.start_line,
                        'endLine': context.end_line,
                        'linesUsed': context.lines_used,
                        'totalLinesOnPage': context.total_lines_on_page,
                        'tokensEstimated': context.tokens_estimated,
                        'totalChars': context.total_chars,
                        'pageUrl': context.page_url,
                        'thumbnailUrl': context.thumbnail_url,
                        **context.metadata_json
                    }
                })
        
        # Handle workspace mode (optimized workspace queries)
        for workspace_id, file_contexts in workspace_mode_results.items():
            # Flatten all context numbers for this workspace
            all_context_numbers = []
            file_ids = list(file_contexts.keys())
            
            for context_numbers in file_contexts.values():
                all_context_numbers.extend(context_numbers)
            
            # Use optimized denormalized table query
            contexts = self.context_repo.get_contexts_workspace_optimized(
                workspace_id, all_context_numbers, file_ids
            )
            
            for context in contexts:
                all_contexts.append({
                    'fileId': context['file_id'],
                    'contextNumber': context['context_number'],
                    'text': context['text_content'],
                    'metadata': {
                        'fileName': context['file_name'],
                        'chunkIndex': context['chunk_index'],
                        'pageNumber': context['page_number'],
                        'workspaceId': workspace_id
                    }
                })
        
        return all_contexts
    
    def retrieve_expanded_context(self, file_id: str, context_number: int, 
                                 expand_before: int = 1, expand_after: int = 1) -> List[Dict[str, Any]]:
        """
        Retrieve expanded context (neighboring chunks) for better RAG responses
        """
        start_context = max(1, context_number - expand_before)
        end_context = context_number + expand_after
        
        contexts = self.context_repo.get_context_range(file_id, start_context, end_context)
        
        return [
            {
                'fileId': context.file_id,
                'contextNumber': context.context_number,
                'text': context.text_content,
                'isTarget': context.context_number == context_number,
                'metadata': {
                    'chunkIndex': context.chunk_index,
                    'pageNumber': context.page_number,
                    'tokensEstimated': context.tokens_estimated
                }
            }
            for context in contexts
        ]
    
    def get_context_neighbors(self, file_id: str, context_numbers: List[int],
                             window_size: int = 2) -> List[Dict[str, Any]]:
        """
        Get neighboring contexts for multiple context numbers
        Useful for providing more context around retrieved chunks
        """
        all_context_numbers = set()
        
        for context_num in context_numbers:
            for i in range(context_num - window_size, context_num + window_size + 1):
                if i > 0:  # Context numbers are 1-based
                    all_context_numbers.add(i)
        
        contexts = self.context_repo.get_contexts_by_numbers(file_id, list(all_context_numbers))
        
        return [
            {
                'fileId': context.file_id,
                'contextNumber': context.context_number,
                'text': context.text_content,
                'isOriginal': context.context_number in context_numbers,
                'metadata': {
                    'chunkIndex': context.chunk_index,
                    'pageNumber': context.page_number,
                    'tokensEstimated': context.tokens_estimated
                }
            }
            for context in contexts
        ]
    
    def get_rag_statistics(self, workspace_id: Optional[str] = None, 
                          file_id: Optional[str] = None) -> Dict[str, Any]:
        """Get statistics relevant for RAG operations"""
        if file_id:
            # Single file stats
            return self.context_repo.get_context_stats(file_id)
        
        elif workspace_id:
            # Workspace stats
            stats = self.session.query(
                func.count(WorkspaceFileContext.context_number).label('total_contexts'),
                func.count(func.distinct(WorkspaceFileContext.file_id)).label('total_files')
            ).filter(
                WorkspaceFileContext.workspace_id == workspace_id
            ).first()
            
            return {
                'total_contexts': stats.total_contexts or 0,
                'total_files': stats.total_files or 0,
                'workspace_id': workspace_id
            }
        
        return {}
    
    def validate_context_existence(self, file_context_pairs: List[Tuple[str, int]]) -> List[Tuple[str, int]]:
        """
        Validate that context numbers exist for given files
        Returns list of valid (file_id, context_number) pairs
        """
        if not file_context_pairs:
            return []
        
        # Build query to check existence
        conditions = []
        for file_id, context_number in file_context_pairs:
            conditions.append(
                and_(
                    Context.file_id == file_id,
                    Context.context_number == context_number
                )
            )
        
        if not conditions:
            return []
        
        existing_contexts = self.session.query(
            Context.file_id, Context.context_number
        ).filter(or_(*conditions)).all()
        
        return [(ctx.file_id, ctx.context_number) for ctx in existing_contexts]
