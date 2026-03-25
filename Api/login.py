
import os
import pickle
import google.oauth2.credentials
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request



# ตั้งค่า Google OAuth2 Scopes
SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, 'credentials.json')
TOKEN_FILE = os.path.join(BASE_DIR, 'token.pickle')

def google_oauth_login():
    """
    Template สำหรับการ Login ด้วย Google Account (OAuth2)
    *จำเป็นต้องมีไฟล์ credentials.json จาก Google Cloud Console*
    """
    creds = None
    # ไฟล์ token.pickle จะเก็บ access และ refresh tokens ของผู้ใช้
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)
            
    # ถ้าไม่มี credentials ที่ใช้งานได้ ให้ทำการ Login ใหม่
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                return {"error": f"ไม่พบไฟล์ credentials.json ที่ {CREDENTIALS_FILE}"}
                
            flow = google_auth_oauthlib.flow.InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES)
            # ใน Docker อาจจะต้องรันแบบ console หรือตั้งค่า port Forwarding
            creds = flow.run_local_server(port=0)
            
        # บันทึก credentials สำหรับการใช้งานครั้งต่อไป
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)

    try:
        service = build('oauth2', 'v2', credentials=creds)
        user_info = service.userinfo().get().execute()
        print(f"Login สำเร็จ: {user_info['name']} ({user_info['email']})")
        return user_info
    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google: {e}")
        return None

if __name__ == "__main__":
    print("--- Google OAuth2 Configuration Template ---")
    print("จำเป็นต้องมีไฟล์ credentials.json ในโฟลเดอร์ Api/")
    # ตัวอย่างการเรียกใช้งาน:
    user = google_oauth_login()
    if user:
        print(f"สวัสดีคุณ {user['name']}")
