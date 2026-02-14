import sqlite3
import os

# Adjust path to where the DB lives relative to this script or execution context
DB_PATH = "backend/slusha.db"

def check_schema():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print(f"Checking schema for: {DB_PATH}")
        # Get info for 'characters' table
        cursor.execute("PRAGMA table_info(characters)")
        columns_info = cursor.fetchall()
        
        column_names = [info[1] for info in columns_info]
        print(f"Columns in 'characters' table: {column_names}")
        
        if "lorebook_id" in column_names:
            print("✅ SUCCESS: 'lorebook_id' column exists.")
        else:
            print("❌ FAILURE: 'lorebook_id' column is MISSING.")
            
    except Exception as e:
        print(f"Error checking schema: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_schema()