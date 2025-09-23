
from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, BIGINT, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Workspace(Base):
    """
    Workspaces table - Top level organization unit
    """
    __tablename__ = 'workspaces'
    
    # Primary key
    id = Column(String(255), primary_key=True)
    
    # Basic info
    name = Column(String(500), nullable=False)
    description = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True))
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    files = relationship("File", back_populates="workspace", cascade="all, delete-orphan")
    
    # Table indexes
    __table_args__ = (
        Index('idx_workspaces_created_at', 'created_at'),
        Index('idx_workspaces_is_deleted', 'is_deleted'),
        Index('idx_workspaces_name', 'name'),
        Index('idx_workspaces_metadata', 'metadata_json', postgresql_using='gin'),
    )


class File(Base):
    """
    Files table - Individual files within workspaces
    Optimized for single file vs workspace mode queries
    """
    __tablename__ = 'files'
    
    # Primary key
    id = Column(String(255), primary_key=True)
    
    # Foreign key to workspace with CASCADE delete
    workspace_id = Column(String(255), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    
    # File information
    file_name = Column(String(1000), nullable=False)
    original_name = Column(String(1000))
    file_type = Column(String(100))
    file_size = Column(BIGINT)
    content_type = Column(String(100))  # 'pdf', 'webpage', 'text', etc.
    
    # URLs and resources
    source_url = Column(Text)  # For webpage content
    cloudinary_url = Column(Text)
    page_urls = Column(JSON, default=[])  # Array of page URLs for PDFs
    
    # Statistics
    total_pages = Column(Integer)
    total_chunks = Column(Integer, default=0)
    
    # Processing info
    embedding_type = Column(String(100), default='RETRIEVAL_DOCUMENT')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True))
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    workspace = relationship("Workspace", back_populates="files")
    contexts = relationship("Context", back_populates="file", cascade="all, delete-orphan")
    
    # Critical indexes for efficient queries
    __table_args__ = (
        # Primary lookup indexes
        Index('idx_files_workspace_id', 'workspace_id'),
        Index('idx_files_file_name', 'file_name'),
        Index('idx_files_content_type', 'content_type'),
        
        # Composite indexes for efficient retrieval
        Index('idx_files_workspace_deleted', 'workspace_id', 'is_deleted'),
        Index('idx_files_workspace_name_deleted', 'workspace_id', 'file_name', 'is_deleted'),
        
        # Single file mode optimization
        Index('idx_files_id_workspace', 'id', 'workspace_id'),
        
        # Timestamp and metadata indexes
        Index('idx_files_created_at', 'created_at'),
        Index('idx_files_is_deleted', 'is_deleted'),
        Index('idx_files_metadata', 'metadata_json', postgresql_using='gin'),
    )


class Context(Base):
    """
    Contexts table - Individual text chunks/contexts for files
    Optimized for bulk retrieval by contextNumber arrays
    """
    __tablename__ = 'contexts'
    
    # Composite primary key for maximum efficiency with CASCADE delete
    file_id = Column(String(255), ForeignKey('files.id', ondelete='CASCADE'), primary_key=True)
    context_number = Column(Integer, primary_key=True)
    
    # The actual text content
    text_content = Column(Text, nullable=False)
    
    # Chunk metadata
    chunk_index = Column(Integer)  # Original chunk index from processing
    page_number = Column(Integer)
    
    # Line information (for PDFs)
    start_line = Column(Integer)
    end_line = Column(Integer)
    lines_used = Column(Integer)
    total_lines_on_page = Column(Integer)
    
    # Processing statistics
    tokens_estimated = Column(Integer)
    total_chars = Column(Integer)
    
    # Page resources
    page_url = Column(Text)
    thumbnail_url = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Additional metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    file = relationship("File", back_populates="contexts")
    
    # Critical indexes for bulk retrieval efficiency
    __table_args__ = (
        # Primary retrieval index - most important for performance
        Index('idx_contexts_file_context', 'file_id', 'context_number'),
        
        # Reverse lookup for context numbers
        Index('idx_contexts_context_file', 'context_number', 'file_id'),
        
        # Page-based queries
        Index('idx_contexts_file_page', 'file_id', 'page_number'),
        
        # Chunk index for original ordering
        Index('idx_contexts_file_chunk', 'file_id', 'chunk_index'),
        
        # Text search (if needed for full-text search)
        Index('idx_contexts_text_gin', 'text_content', postgresql_using='gin', postgresql_ops={'text_content': 'gin_trgm_ops'}),
        
        # Metadata queries
        Index('idx_contexts_metadata', 'metadata_json', postgresql_using='gin'),
        
        # Timestamp queries
        Index('idx_contexts_created_at', 'created_at'),
    )


# Junction table for optimized workspace-file-context queries
class WorkspaceFileContext(Base):
    """
    Materialized view-like table for ultra-fast workspace + file + context queries
    This denormalized table optimizes the most common query patterns
    """
    __tablename__ = 'workspace_file_contexts'
    
    # Composite key with CASCADE constraints for automatic cleanup
    workspace_id = Column(String(255), ForeignKey('workspaces.id', ondelete='CASCADE'), primary_key=True)
    file_id = Column(String(255), ForeignKey('files.id', ondelete='CASCADE'), primary_key=True)
    context_number = Column(Integer, primary_key=True)
    
    # Denormalized frequently accessed fields
    file_name = Column(String(1000), nullable=False)
    text_content = Column(Text, nullable=False)
    page_number = Column(Integer)
    chunk_index = Column(Integer)
    
    # Timestamps for cache invalidation
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Ultra-optimized indexes for different query patterns
    __table_args__ = (
        # Workspace mode: get contexts across multiple files
        Index('idx_wfc_workspace_contexts', 'workspace_id', 'context_number'),
        
        # Single file mode: get all contexts for one file
        Index('idx_wfc_file_contexts', 'file_id', 'context_number'),
        
        # Mixed mode: workspace + specific files
        Index('idx_wfc_workspace_file', 'workspace_id', 'file_id'),
        
        # Context number range queries
        Index('idx_wfc_workspace_context_range', 'workspace_id', 'context_number', 'file_id'),
        
        # File name filtering
        Index('idx_wfc_workspace_filename', 'workspace_id', 'file_name'),
    )
