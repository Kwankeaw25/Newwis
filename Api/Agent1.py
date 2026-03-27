import json
import httpx
import asyncio
import os
from dotenv import load_dotenv


# Load environment variables from .env file
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip('"').strip("'").strip()

async def call_gamma4b(prompt, user_input, temperature, api_key=None, model=None):
    url = "https://openrouter.ai/api/v1/chat/completions" 
    
    # Use provided api_key or fall back to environment variable
    # Clean up the key just in case it has quotes or spaces
    effective_api_key = (api_key.strip('"').strip("'").strip() if api_key else OPENROUTER_API_KEY)
    # Use provided model or fall back to default
    effective_model = model if model else "arcee-ai/trinity-large-preview:free"
    
    headers = {
        "Authorization": f"Bearer {effective_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000", # สำหรับ OpenRouter ตรวจสอบแหล่งที่มา
        "X-Title": "Newwis AI Dashboard" # ชื่อแอปพลิเคชัน
    }
    
    payload = {
        "model": effective_model,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_input}
        ],
        "temperature": temperature,
        "max_tokens": 5000
    }

    max_retries = 3
    for attempt in range(max_retries):
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers, timeout=60.0)
                if response.status_code != 200:
                    print(f"OpenRouter Error {response.status_code}: {response.text}")
                    return f"AI Error ({response.status_code}): {response.text[:200]}"
                
                data = response.json()
                if 'choices' in data and len(data['choices']) > 0:
                    return data['choices'][0]['message']['content'].strip()
                else:
                    return "AI returned an empty or unexpected response format."
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    print(f"Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"Final exception during AI call: {e}")
                    return f"Exception: {str(e)}"

async def perform_summarization(nh: str = "สรุปข่าวทั่วไป", api_key=None, model=None):
    # Determine the path to google_news.json relative to this file (Api/Agent1.py)
    json_path = os.path.join(os.path.dirname(__file__), "..", "google_news.json")
    
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            news_data = f.read()
    else:
        news_data = "ไม่พบข้อมูลข่าว"

    prompt = f"""คุณคือ "หัวหน้ากองบรรณาธิการข่าว AI" ผู้เชี่ยวชาญด้านการจัดระเบียบข้อมูลข่าวสารจำนวนมากให้เหลือเพียงสาระสำคัญที่อ่านง่าย
    
Task: วิเคราะห์รายการข่าวที่ได้รับมา โดยมีขั้นตอนการทำงาน (Chain of Thought) ดังนี้:
1. Content Validation: ตัดข่าวที่ไม่มีเนื้อหา หรือ "ไม่พบเนื้อหา/ดึงข้อมูลไม่ได้" ออกทันที
2. De-duplication: คัดเลือกเอาข่าวที่ซ้ำกันออก ให้เหลือเพียงฉบับที่สมบูรณ์ที่สุด
3. Topic Categorization: จัดกลุ่มข่าวที่เหลือตามประเด็นสำคัญ
4. Summarization: สรุปออกเป็นประเด็นหลัก (Who, What, Where, When, Why)
5. กฎเหล็ก: [เนื้อหาข่าว] ต้องสรุปเป็น 1 ย่อหน้า (Paragraph) ที่มีเนื้อหาครบถ้วนและลึกซึ้ง โดยมีความยาว "ห้ามต่ำกว่า 500 ตัวอักษร" และ "ห้ามเกิน 8 บรรทัด" ต่อหนึ่งข่าว
6. Output Format (ต้องใช้ Markdown เท่านั้น):

# สรุปสถานการณ์{nh}ในช่วงนี้

## [หัวข้อข่าวโดยสรุป]

[สรุปเนื้อหาข่าวทุกข่าวรวมกัน 1 ย่อหน้า (500+ ตัวอักษร, ไม่เกิน 8 บรรทัด) โดยใช้ **ตัวหนา** เน้นคำสำคัญ]

### แหล่งอ้างอิง
- [ชื่อสำนักข่าว 1]
- [ชื่อสำนักข่าว 2]

7. กฎการจัดรูปแบบ Markdown:
- ใช้ # สำหรับหัวข้อหลัก (เรื่อง), ## สำหรับหัวข้อข่าว, ### สำหรับหัวข้อย่อย
- ใช้ **ข้อความ** ทำตัวหนาสำหรับคำสำคัญ ชื่อคน สถานที่ ตัวเลข
- ใช้ - สำหรับรายการ (bullet list)
- เว้นบรรทัดว่างระหว่างหัวข้อและเนื้อหา
8. ข้อห้ามเด็ดขาด: ห้ามใส่ "หมายเหตุ" หรือ "Note" หรือข้อความกำกับใดๆ ในผลลัพธ์ ให้แสดงเฉพาะเนื้อหาข่าวเท่านั้น ไม่ต้องมีข้อความอธิบายกฎเกณฑ์หรือเงื่อนไขการสรุป"""
    
    # Limit to 10000 chars to avoid context limits
    user_input = f"วิเคราะห์ข่าวจากข้อมูลต่อไปนี้ (เน้นประเด็น: {nh}):\n\n{str(news_data)[:10000]}" 
    ans = await call_gamma4b(prompt, user_input=user_input, temperature=0.7, api_key=api_key, model=model)
    return ans

async def convert_to_json(summary_text: str, api_key=None, model=None):
    prompt = """
    แปลงเนื้อหาข่าวที่ได้รับให้เป็น JSON Object เท่านั้น (Strict JSON Output)
    ห้ามมีข้อความอื่นนอกจาก JSON
    
    Format:
    {
        "topic": "หัวข้อข่าวหลัก",
        "headline": "ชื่อข่าวโดยสรุป",
        "content": "เนื้อหาสรุป 1 ย่อหน้า",
        "source": "แหล่งที่มา"
    }
    """
    ans = await call_gamma4b(prompt, user_input=summary_text, temperature=0.1, api_key=api_key, model=model)
    return ans