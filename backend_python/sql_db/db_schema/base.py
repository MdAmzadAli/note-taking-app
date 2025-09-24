
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from the correct path
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# Create base class for all models
Base = declarative_base()

# Database URL from environment - prioritize .env file over system env
DATABASE_URL = os.getenv('DATABASE_URL')

# Debug: Print which database we're connecting to (first 50 chars for security)
print(f"🔗 Connecting to database: {DATABASE_URL[:50]}..." if DATABASE_URL else "❌ No DATABASE_URL found")


# Create engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False  # Set to True for SQL debugging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Metadata for table operations
metadata = MetaData()

def get_db_session():
    """Get database session"""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def create_all_tables():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)

def drop_all_tables():
    """Drop all tables (use with caution)"""
    Base.metadata.drop_all(bind=engine)
