import sqlite3
import os

DB_PATH = "backend/sluxa.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found, skipping migration (will be created fresh).")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(characters)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "lorebook_id" not in columns:
            print("Migrating: Adding lorebook_id to characters table...")
            cursor.execute("ALTER TABLE characters ADD COLUMN lorebook_id INTEGER REFERENCES lorebooks(id)")
            conn.commit()
            print("Migration successful.")
        else:
            print("Migration skipped: lorebook_id already exists.")
            
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()