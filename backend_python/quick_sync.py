
#!/usr/bin/env python3

from sql_db.db_methods.database_manager import DatabaseManager

def quick_sync():
    """Quick database schema sync"""
    db_manager = DatabaseManager()
    
    print("🔄 Syncing database schema...")
    success = db_manager.initialize_database()
    
    if success:
        print("✅ Database schema synced successfully!")
    else:
        print("❌ Database schema sync failed!")
    
    return success

if __name__ == "__main__":
    quick_sync()
