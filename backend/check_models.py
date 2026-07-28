# check_models.py

import google.generativeai as genai
import os
from dotenv import load_dotenv

# 환경변수에서 키 불러오기
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("👇 내 API 키로 쓸 수 있는 모델 목록 👇")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)