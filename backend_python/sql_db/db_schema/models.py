from sqlalchemy import Column, String, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from .base import Base

class Workspace(Base):
    """
    Minimal workspaces table - just workspace organization
    """
    __tablename__ = 'workspaces'

    # Primary key only
    id = Column(String(255), primary_key=True)

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