import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

class Database:
    def __init__(self):
        self.host = os.getenv("POSTGRES_HOST", "localhost")
        self.port = os.getenv("POSTGRES_PORT", "5432")
        self.user = os.getenv("POSTGRES_USER", "postgres")
        self.password = os.getenv("POSTGRES_PASSWORD", "Chrxnxs08")
        self.dbname = os.getenv("POSTGRES_DB", "news_db")
        self.conn = None
        self._initialize_db()

    def _get_connection(self):
        try:
            return psycopg2.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                dbname=self.dbname
            )
        except Exception as e:
            print(f"Error connecting to PostgreSQL: {e}")
            return None

    def _initialize_db(self):
        """Create the table if it doesn't exist."""
        conn = self._get_connection()
        if not conn:
            return
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS summarized_news (
                        id SERIAL PRIMARY KEY,
                        keyword TEXT NOT NULL,
                        summary_text TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                conn.commit()
                print("Database initialized successfully.")
        except Exception as e:
            print(f"Error initializing database: {e}")
            conn.rollback()
        finally:
            conn.close()

    def save_summary(self, keyword, summary_text):
        """Save a new summary to the database."""
        conn = self._get_connection()
        if not conn:
            return False
        
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO summarized_news (keyword, summary_text, created_at) VALUES (%s, %s, %s)",
                    (keyword, summary_text, datetime.now())
                )
                conn.commit()
                print(f"Summary for '{keyword}' saved to DB.")
                return True
        except Exception as e:
            print(f"Error saving summary to DB: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

if __name__ == "__main__":
    # Quick test
    db = Database()
    db.save_summary("test_keyword", "This is a test summary content.")
