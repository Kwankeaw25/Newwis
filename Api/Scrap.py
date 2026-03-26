import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
import time
import json
import sys
import os
from googlenewsdecoder import new_decoderv1

# Add Api directory to path so we can import Agent1 and Database
sys.path.insert(0, os.path.dirname(__file__))
from Agent1 import perform_summarization, call_gamma4b
from Database import Database

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware to allow frontend to communicate with API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()

def get_final_url(url):
    """
    ใช้ googlenewsdecoder เพื่อให้ได้ URL ของบทความจริง
    """
    try:
        decoded = new_decoderv1(url, interval=1)
        if decoded.get('status'):
            return decoded.get('decoded_url')
        return url
    except Exception:
        return url

def extract_content(url, headers):
    """
    สกัดเนื้อหาข่าวแบบง่ายๆ ด้วย BeautifulSoup
    """
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200: return "", ""
        
        soup = BeautifulSoup(res.content, 'html.parser')
        # ลบส่วนเกิน
        for s in soup(['script', 'style', 'nav', 'header', 'footer']): s.decompose()
        
        # หาเนื้อหาจาก <article> หรือ <p>
        article = soup.find('article')
        target = article if article else soup
        paragraphs = target.find_all('p')
        
        # ค้นหารูปภาพ - ลำดับความสำคัญ:
        # 1. og:image (มีทุกเว็บข่าว แน่นอนที่สุด)
        # 2. <img> ใน article
        # 3. <img> ทั้งหน้า
        pic = ""
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            pic = og_image['content']
        else:
            image = target.find('img') if article else soup.find('img')
            if image:
                pic = image.get('src') or image.get('data-src') or ""
                if pic and pic.startswith('/'):
                    from urllib.parse import urljoin
                    pic = urljoin(url, pic)

        content_text = '\n'.join(p.get_text(strip=True) for p in paragraphs if len(p.get_text()) > 40)
        return content_text, pic
    except Exception as e:
        print(f"Error extracting content from {url}: {e}")
        return "", ""

def scrape_news(keyword: str):
    """Scrape ข่าวจาก Google News ตาม keyword ที่กำหนด"""
    DATA = []
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    
    print(f"ดึงข้อมูลจาก Google News สำหรับ '{keyword}'...")
    rss_url = f"https://news.google.com/rss/search?q={keyword}&hl=th&gl=TH&ceid=TH:th"
    
    res = requests.get(rss_url, headers=headers)
    soup = BeautifulSoup(res.content, 'xml')
    items = soup.find_all('item')[:30]
    
    for item in tqdm(items, desc="กำลังประมวลผล"):
        title = item.title.text
        link = get_final_url(item.link.text)
        
        try:
            result = extract_content(link, headers)
            if isinstance(result, tuple) and len(result) == 2:
                content, image_url = result
            else:
                content, image_url = str(result), ""
        except Exception as e:
            print(f"Error processing {link}: {e}")
            content, image_url = "", ""
        
        DATA.append({
            "title": title,
            "content": content if content else "ไม่พบเนื้อหา",
            "image_url": image_url,
            "url": link,
            "source": item.find('source').text if item.find('source') else ""
        })
        time.sleep(0.3)

    # บันทึกข้อมูล
    json_path = os.path.join(os.path.dirname(__file__), "..", "google_news.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(DATA, f, ensure_ascii=False, indent=4)
    print(f"บันทึกข้อมูล {len(DATA)} รายการ")
    return DATA


@app.get("/news")
async def news_endpoint(keyword: str = Query(..., description="คำค้นหาข่าว")):
    try:
        data = scrape_news(keyword)
        summary = await perform_summarization(f"สรุปข่าว{keyword}")

        # หาภาพที่มี URL (เอามาสูงสุด 2 รูป) — กรองรูปที่ไม่เกี่ยวข้องออก
        skip_patterns = ['google.com/logos', 'gstatic.com', 'favicon', 'logo', 'icon', 'badge', 'avatar', 'btn_', 'pixel', 'tracker', '.svg', 'brand']
        images = []
        for item in data:
            img = item.get("image_url", "")
            if not img or img in images:
                continue
            img_lower = img.lower()
            if any(pat in img_lower for pat in skip_patterns):
                continue
            images.append(img)
            if len(images) >= 2:
                break

        # บันทึกข้อมูลลงไฟล์ (Plain Text สำหรับแสดงผลแบบเดิม)
        summary_path = os.path.join(os.path.dirname(__file__), "..", "summary.txt")
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(summary)   
        
        # บันทึกลง Database
        db.save_summary(keyword, summary)
        
        return {
            "summary": summary,
            "images": images
        }
        
    except Exception as e:
        return {"error": str(e)}


 
@app.get("/chat")
async def chat_endpoint(message: str = Query(..., description="ข้อความจากผู้ใช้")):
    try:
        # โหลดข้อมูลข่าวเพื่อใช้เป็น Context
        context = "ไม่มีข้อมูลข่าวล่าสุดในระบบ"
        json_path = os.path.join(os.path.dirname(__file__), "..", "google_news.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    news_data = json.load(f)
                    # ส่งเป็น JSON string เพื่อให้ AI วิเคราะห์
                    context = json.dumps(news_data, ensure_ascii=False)
            except:
                pass

        system_prompt = f"""คุณคือ "ผู้เชี่ยวชาญวิเคราะห์ข่าวเจาะลึก (News Insight Expert)" หน้าที่ของคุณคือตอบคำถามจากผู้ใช้โดยอ้างอิงจากข้อมูลข่าวที่ระบบสรุปไว้ให้ (Context) คุณต้องมีความเป็นกลาง แม่นยำ และสามารถเชื่อมโยงประเด็นต่างๆ ได้อย่างมืออาชีพ

Knowledge Base (Context):
{context}

Guidelines & Rules:
1. Strictly Evidence-Based: ตอบคำถามโดยใช้ข้อมูลจาก Context ที่ให้ไว้เท่านั้น หากผู้ใช้ถามเรื่องที่ไม่มีในข้อมูล ให้ตอบสุภาพว่า "ขออภัยครับ ข้อมูลในส่วนนี้ไม่ได้ระบุไว้ในรายงานข่าวล่าสุด"
2. Deep Analysis: หากผู้ใช้ถามให้เปรียบเทียบหรือวิเคราะห์แนวโน้ม ให้พยายามเชื่อมโยงข้อมูลจากข่าวหลายๆ แหล่งที่อยู่ใน Context เดียวกัน
3. Source Attribution: เมื่ออ้างถึงข้อมูลใดๆ ให้ระบุแหล่งที่มา (Source) เสมอ เพื่อความน่าเชื่อถือ
4. No Speculation: ห้ามคาดเดาเหตุการณ์ในอนาคตที่ไม่มีมูลฐานจากข่าว หรือแสดงความเห็นส่วนตัวที่รุนแรง
5. Language: ตอบเป็นภาษาไทยที่สุภาพ เป็นทางการแต่เข้าใจง่าย

Output Structure:
บทวิเคราะห์/คำตอบ: [คำอธิบายโดยละเอียด]
ข้อมูลสนับสนุน: [Bullet points สั้นๆ จากข่าวที่เกี่ยวข้อง]
แหล่งอ้างอิง: [รายชื่อสำนักข่าวหรือ URL]
"""
        response = await call_gamma4b(system_prompt, user_input=message, temperature=0.7)
        return {"response": response}
    except Exception as e:
        print(f"Error in chat_endpoint: {e}")
        return {"error": f"เกิดข้อผิดพลาดในการสนทนา: {e}"}
