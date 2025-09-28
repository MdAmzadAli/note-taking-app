
#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add the backend_python directory to Python path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

# Load environment variables
env_path = backend_path / '.env'
load_dotenv(dotenv_path=env_path)

from sql_db.db_schema.base import create_all_tables, engine
from sql_db.db_methods.database_manager import DatabaseManager
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sync_database_schema():
    """Sync database schema with PostgreSQL"""
    try:
        logger.info("🔄 Starting database schema synchronization...")
        
        # Check database connection
        logger.info("🔍 Testing database connection...")
        with engine.connect() as conn:
            result = conn.execute("SELECT 1")
            logger.info("✅ Database connection successful")
        
        # Create all tables from models
        logger.info("📝 Creating database tables from models...")
        create_all_tables()
        logger.info("✅ Database schema synchronized successfully")
        
        # Verify tables were created
        logger.info("🔍 Verifying created tables...")
        with engine.connect() as conn:
            result = conn.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            tables = [row[0] for row in result.fetchall()]
            
            expected_tables = ['workspaces', 'files', 'contexts', 'users', 'usage']
            
            logger.info(f"📊 Found {len(tables)} tables in database:")
            for table in tables:
                status = "✅" if table in expected_tables else "ℹ️"
                logger.info(f"  {status} {table}")
            
            # Check if all expected tables exist
            missing_tables = set(expected_tables) - set(tables)
            if missing_tables:
                logger.warning(f"⚠️ Missing expected tables: {missing_tables}")
            else:
                logger.info("✅ All expected tables found")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Database schema sync failed: {e}")
        return False

def check_database_health():
    """Check database health using DatabaseManager"""
    try:
        db_manager = DatabaseManager()
        health_status = db_manager.health_check()
        if health_status:
            logger.info("✅ Database health check passed")
        else:
            logger.error("❌ Database health check failed")
        return health_status
    except Exception as e:
        logger.error(f"❌ Database health check error: {e}")
        return False

if __name__ == "__main__":
    logger.info("🚀 Database Schema Sync Tool")
    logger.info(f"📁 Working directory: {os.getcwd()}")
    logger.info(f"🔧 Database URL: {os.getenv('DATABASE_URL', 'Not set')}")
    
    # Check environment variables
    if not os.getenv('DATABASE_URL'):
        logger.error("❌ DATABASE_URL environment variable not set")
        sys.exit(1)
    
    # Check database health first
    logger.info("🔍 Checking database health...")
    if not check_database_health():
        logger.error("❌ Database health check failed - cannot proceed")
        sys.exit(1)
    
    # Sync database schema
    if sync_database_schema():
        logger.info("🎉 Database schema sync completed successfully!")
        sys.exit(0)
    else:
        logger.error("💥 Database schema sync failed!")
        sys.exit(1)
