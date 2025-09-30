from sqlalchemy import Column, String, Integer, Text, ForeignKey, Index, DateTime, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Workspace(Base):
    """
    Minimal workspaces table - just workspace organization
    """
    __tablename__ = 'workspaces'

    # Primary key only
    id = Column(String(255), primary_key=True)
    
    # Total size of all files in workspace (in bytes)
    total_size = Column(BigInteger, default=0, nullable=False)

    # Relationships
    files = relationship("File", back_populates="workspace", cascade="all, delete-orphan")


class File(Base):
    """
    Minimal files table - file identification and type
    """
    __tablename__ = 'files'

    # Primary key
    id = Column(String(255), primary_key=True)
    
    # Foreign key to workspace - nullable for single file mode
    workspace_id = Column(String(255), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=True)

    # File type only (pdf, webpage, text, etc.)
    content_type = Column(String(100), nullable=False)
    
    # File size in bytes
    file_size = Column(BigInteger, default=0, nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="files")
    contexts = relationship("Context", back_populates="file", cascade="all, delete-orphan")

    # Essential indexes only
    __table_args__ = (
        Index('idx_files_workspace_id', 'workspace_id'),
        Index('idx_files_content_type', 'content_type'),
    )


class Context(Base):
    """
    Minimal contexts table - text chunks with page info
    """
    __tablename__ = 'contexts'

    # Composite primary key for efficiency
    file_id = Column(String(255), ForeignKey('files.id', ondelete='CASCADE'), primary_key=True)
    context_number = Column(Integer, primary_key=True)

    # Essential content
    text_content = Column(Text, nullable=False)
    page_number = Column(Integer)

    # Relationships
    file = relationship("File", back_populates="contexts")

    # Essential indexes only
    __table_args__ = (
        Index('idx_contexts_file_context', 'file_id', 'context_number'),
        Index('idx_contexts_file_page', 'file_id', 'page_number'),
    )


class User(Base):
    """
    User profiles with UUID identification
    """
    __tablename__ = 'users'

    # Primary key - UUID
    id = Column(String(255), primary_key=True)
    
    # Email field - optional (nullable=True) to identify beta users
    email = Column(String(255), nullable=True, unique=True)
    
    # Timestamp for when they signed up
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    usage = relationship("Usage", back_populates="user", uselist=False, cascade="all, delete-orphan")

    # Essential indexes
    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_created_at', 'created_at'),
    )


class Usage(Base):
    """
    User usage tracking for transcription and file upload limits
    """
    __tablename__ = 'usage'

    # Primary key
    id = Column(String(255), primary_key=True)
    
    # Foreign key to user
    user_id = Column(String(255), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # Transcription limits and usage (in minutes)
    transcription_limit = Column(Integer, default=60, nullable=False)  # 10 hours = 600 minutes
    transcription_used = Column(Integer, default=0, nullable=False)
    transcription_reset_date = Column(DateTime(timezone=True), nullable=False)
    
    # File upload limits and usage (in bytes)
    file_upload_size_limit = Column(BigInteger, default=73400320, nullable=False)  # 70MB in bytes
    file_size_used = Column(BigInteger, default=0, nullable=False)
    
    # Timestamp for when usage record was created
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="usage")

    # Essential indexes
    __table_args__ = (
        Index('idx_usage_user_id', 'user_id'),
        Index('idx_usage_transcription_reset_date', 'transcription_reset_date'),
    )