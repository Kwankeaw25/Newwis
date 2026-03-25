import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def check_db():
    try:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=os.getenv("POSTGRES_PORT", "5432"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "Chrxnxs08"),
            dbname=os.getenv("POSTGRES_DB", "news_db")
        )
        cur = conn.cursor()
        cur.execute("SELECT * FROM summarized_news ORDER BY created_at DESC LIMIT 1;")
        row = cur.fetchone()
        if row:
            print(f"ID: {row[0]}")
            print(f"Keyword: {row[1]}")
            print(f"Summary Text: {row[2]}")
            print(f"Created At: {row[3]}")
        else:
            print("No data found.")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
