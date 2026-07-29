# main.py

import os
import json
import math
import asyncio
import requests
import httpx
import google.generativeai as genai
from fastapi.middleware.cors import CORSMiddleware
from weather_utils import fetch_current_weather
from typing import List, Optional
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime

# 1. 환경변수(.env) 로드 및 Gemini API 키 설정
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

# 2. CORS 설정 (Next.js 연동)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", # 로컬 개발용
        "https://perfect-travel-planer.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- [Pydantic 데이터 모델 정의] ---

class PlaceDetail(BaseModel):
    name: str
    estimated_cost: int 
    category: str   # 예: "식비", "카페/디저트", "문화/티켓", "경유/무료", "기타"
    breakdown: str  # 예: "2인 영화 티켓 + 팝콘 콤보 세트"

class TextInput(BaseModel):
    text: str
    date: Optional[str] = None
    lat: Optional[float] = 37.4979  # 기본값: 강남역 위도
    lon: Optional[float] = 127.0276 # 기본값: 강남역 경도

class PlaceLocation(BaseModel):
    name: str
    lat: float
    lng: float

class RouteRequest(BaseModel):
    places: List[PlaceLocation]


# --- [기본 시스템 프롬프트 템플릿] ---
BASE_SYSTEM_PROMPT = """
[System Persona]
너는 자연어 처리(NER, 개체명 인식)에 특화된 수석 데이터 엔지니어이자 스마트 여행 플래너야.
사용자의 정제되지 않은 줄글이나 메모에서 실제 지도 검색이 가능한 '장소(Location)' 키워드를 추출하고, 해당 장소에서 발생할 2인 기준 평균 예상 데이트 비용 및 지출 내역을 추정하는 역할을 맡고 있어.

[Task]
1. 입력된 텍스트에서 사용자가 방문하고자 하는 실제 '고유명사(상호명, 랜드마크, 지하철역 등)'를 시간 흐름(순서)대로 추출해 줘.
2. 각 장소별 2인 기준 평균 예상 비용(원 단위, 정수), 지출 카테고리, 세부 지출 항목을 추정해 줘.
   - 식당/술집: 카테고리 "식비", 예: "2인 메인 요리 + 음료"
   - 카페: 카테고리 "카페/디저트", 예: "음료 2잔 + 디저트 1개"
   - 영화관/전시회: 카테고리 "문화/티켓", 예: "2인 관람권 + 콤보 세트"
   - 공원/지하철역/단순 경유지: 카테고리 "경유/무료", 금액 0원, 예: "무료 입장/산책"

[Constraints]
1. 불필요한 인사말, 조언, 부연 설명은 절대 출력하지 마.
2. '밥', '영화', '카페', '산책' 같은 추상적인 단어는 철저히 제외하고 구체적인 장소명만 추출해.
3. 출력은 반드시 아래의 JSON 포맷을 엄격하게 지켜야 해. (마크다운 백틱 없이 순수 JSON만 출력)

[Output Format (Strict JSON)]
{
  "places": ["장소1", "장소2"],
  "place_details": [
    {
      "name": "장소1",
      "estimated_cost": 45000,
      "category": "문화/티켓",
      "breakdown": "2인 영화 티켓 (30,000원) + 팝콘 세트 (15,000원)"
    },
    {
      "name": "장소2",
      "estimated_cost": 0,
      "category": "경유/무료",
      "breakdown": "산책 및 단순 경유 (비용 없음)"
    }
  ]
}
"""
# --- [Google Places API 평점/리뷰 가져오기] ---
async def fetch_place_rating(place_name: str, lat: float, lng: float):
    """장소명과 좌표를 기반으로 구글 평점과 리뷰 수를 가져옵니다."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        return {"rating": None, "user_ratings_total": 0}

    # 1. Text Search로 장소의 Place ID 찾기
    search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    search_params = {
        "query": place_name,
        "location": f"{lat},{lng}",
        "radius": 5000,
        "key": api_key,
        "language": "ko"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(search_url, params=search_params)
            data = res.json()
            if data.get("results"):
                # 가장 정확도가 높은 첫 번째 결과의 평점 반환
                best_match = data["results"][0]
                return {
                    "rating": best_match.get("rating", 0.0),
                    "user_ratings_total": best_match.get("user_ratings_total", 0)
                }
        except Exception as e:
            print(f"Google Places API Error ({place_name}): {e}")
            
    return {"rating": None, "user_ratings_total": 0}

# --- [API 엔드포인트 1: AI 장소 추출 + 실시간 날씨 및 플랜 B 제안] ---
@app.post("/api/extract-places")
async def extract_places(input_data: TextInput):
    try:
        current_weather = "정보 없음"
        weather_instruction = ""
        
        # 1. 날짜 처리 및 방어 로직
        if input_data.date:
            try:
                target_date = datetime.strptime(input_data.date, "%Y-%m-%d").date()
                today = datetime.now().date()
                diff_days = (target_date - today).days

                if diff_days < 0:
                    current_weather = "과거 날짜 (날씨 생략)"
                elif 0 <= diff_days <= 2:
                    # D-Day ~ D+2 (3일 이내): 날씨 예측 가능 구간
                    # (현재는 초단기 실황 API를 사용 중이므로 당일 날씨 기준으로 응답함)
                    current_weather = await fetch_current_weather(input_data.lat, input_data.lon)
                else:
                    # D+3 이상: 날씨 예측 불가 구간
                    current_weather = "먼 날짜 (예측 불가)"
            except ValueError:
                # 날짜 형식이 잘못되었을 경우 방어
                current_weather = await fetch_current_weather(input_data.lat, input_data.lon)
        else:
            # 날짜가 넘어오지 않은 경우 기본적으로 오늘 날씨 조회
            current_weather = await fetch_current_weather(input_data.lat, input_data.lon)

        # 2. 날씨 상태에 따라 동적 프롬프트 생성 (비/눈 올 때 플랜 B 강제 유도)
        if current_weather in ["비", "눈"]:
            weather_instruction = f"""
            \n[🌧️ 긴급 날씨 정보: 선택하신 일정의 날씨는 '{current_weather}'입니다!]
            야외 장소(공원, 산책로, 야외 유적지 등)가 포함되어 있다면, 
            해당 장소의 breakdown(세부지출) 필드 끝에 반드시 아래 문구를 추가해주세요:
            " (⚠️ 비/눈 예보! 근처 실내 대체장소를 추천해요)"
            """
        
        full_system_prompt = BASE_SYSTEM_PROMPT + weather_instruction

        # 3. Gemini API 호출
        model = genai.GenerativeModel(
            model_name='gemini-flash-latest', 
            system_instruction=full_system_prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        response = model.generate_content(input_data.text)
        parsed_data = json.loads(response.text)
        
        places = parsed_data.get("places", [])
        place_details = parsed_data.get("place_details", [])

        # 각 장소별로 비동기 평점 데이터 조회
        # (좌표는 초기 맵 렌더링을 위해 기준 위경도를 넘겨주거나, 이후 카카오 로컬 API로 보정 가능)
        tasks = [
            fetch_place_rating(detail["name"], input_data.lat, input_data.lon) 
            for detail in place_details
        ]
        ratings = await asyncio.gather(*tasks)
        
        for idx, detail in enumerate(place_details):
            detail["rating"] = ratings[idx]["rating"]
            detail["reviews"] = ratings[idx]["user_ratings_total"]
        
        # 방어 로직: 필수 항목 누락 시 기본값 세팅
        if not place_details and places:
            place_details = [{"name": p, "estimated_cost": 0, "category": "기타", "breakdown": "기본 항목"} for p in places]
            
        return {
            "places": places,
            "place_details": place_details,
            "weather": current_weather
        }
        
    except Exception as e:
        return {"error": str(e), "places": [], "place_details": [], "weather": "서버 에러"}


# --- [API 엔드포인트 2: 카카오 모빌리티 길찾기] ---
@app.post("/api/get-route")
async def get_route(data: RouteRequest):
    kakao_key = os.getenv("KAKAO_REST_API_KEY")
    headers = {"Authorization": f"KakaoAK {kakao_key}"}
    url = "https://apis-navi.kakaomobility.com/v1/directions"
    
    results = []
    places = data.places

    for i in range(len(places) - 1):
        origin = places[i]
        dest = places[i+1]
        
        params = {
            "origin": f"{origin.lng},{origin.lat}",
            "destination": f"{dest.lng},{dest.lat}",
            "priority": "RECOMMEND"
        }
        
        try:
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                route_data = response.json()

                print(f"[{origin.name} -> {dest.name}] ODsay 응답: ", route_data) # 터미널에 찍히는 진짜 이유를 확인
                
                if route_data.get('routes'):
                    summary = route_data['routes'][0]['summary']
                    fare = summary.get('fare', {})
                    
                    paths = []
                    for section in route_data['routes'][0]['sections']:
                        for road in section['roads']:
                            vertexes = road['vertexes']
                            for v_idx in range(0, len(vertexes), 2):
                                paths.append({"lng": vertexes[v_idx], "lat": vertexes[v_idx+1]})
                    
                    results.append({
                        "from": origin.name,
                        "to": dest.name,
                        "distance_m": summary['distance'],
                        "duration_sec": summary['duration'],
                        "taxi_fare": fare.get('taxi', 0),
                        "toll_fare": fare.get('toll', 0),
                        "paths": paths
                    })
                else:
                    results.append({"from": origin.name, "to": dest.name, "error": "경로 없음"})
            else:
                results.append({"from": origin.name, "to": dest.name, "error": "API 탐색 실패"})
                
        except Exception as e:
            results.append({"from": origin.name, "to": dest.name, "error": str(e)})

    return {"route_info": results}

# --- [대중교통 길찾기 (ODsay API)] ---
@app.post("/api/get-transit-route")
async def get_transit_route(data: RouteRequest):
    odsay_key = os.getenv("ODSAY_API_KEY")
    url = "https://api.odsay.com/v1/api/searchPubTransPathT"
    
    results = []
    places = data.places
    
    headers = {
        "Referer": "https://perfect-travel-planer.onrender.com" 
    }

    # client는 여기서 한 번만 엽니다.
    async with httpx.AsyncClient() as client:
        for i in range(len(places) - 1):
            origin = places[i]
            dest = places[i+1]
            
            params = {
                "apiKey": odsay_key,
                "SX": origin.lng,
                "SY": origin.lat,
                "EX": dest.lng,
                "EY": dest.lat,
                "OPT": 0 # 0: 최단시간, 1: 최소환승
            }

            try:
                response = await client.get(url, params=params, headers=headers)
                route_data = response.json()
                
                print(f"[{origin.name} -> {dest.name}] ODsay 응답: ", route_data) 
                
                if "result" in route_data:
                    # 가장 최적의 경로 1개만 추출
                    best_path = route_data["result"]["path"][0]
                    info = best_path["info"]
                    
                    total_vehicles = info.get("busTransitCount", 0) + info.get("subwayTransitCount", 0)
                    actual_transfer_count = total_vehicles - 1 if total_vehicles > 0 else 0
                    
                    results.append({
                        "from": origin.name,
                        "to": dest.name,
                        "transit_time_min": info["totalTime"],
                        "transit_fare": info.get("payment", 0),
                        "transfer_count": actual_transfer_count,
                        "path_type": best_path.get("pathType") 
                    })
                else:
                    results.append({"from": origin.name, "to": dest.name, "error": "대중교통 경로 없음"})
            except Exception as e:
                results.append({"from": origin.name, "to": dest.name, "error": str(e)})

    return {"transit_route_info": results}


# --- [API 엔드포인트 3: AI 동선 자동 최적화 (TSP 알고리즘)] ---
def haversine_distance(lat1, lon1, lat2, lon2):
    """두 위경도 지점 간의 직선 거리(km) 계산"""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@app.post("/api/optimize-route")
async def optimize_route(data: RouteRequest):
    """Greedy TSP 알고리즘을 사용해 첫 출발지 기준 최단 이동 동선으로 재정렬"""
    places = [p.dict() for p in data.places]
    if len(places) <= 2:
        return {"optimized_places": places}

    unvisited = places[1:]  # 출발지(첫 번째 장소)는 고정
    optimized = [places[0]]

    while unvisited:
        current = optimized[-1]
        # 가장 가까운 다음 장소 찾기
        nearest = min(
            unvisited, 
            key=lambda p: haversine_distance(current['lat'], current['lng'], p['lat'], p['lng'])
        )
        optimized.append(nearest)
        unvisited.remove(nearest)

    return {"optimized_places": optimized}


# --- [API 엔드포인트 4: 카카오 이미지 검색 썸네일] ---
@app.get("/api/place-image")
async def get_place_image(query: str):
    kakao_key = os.getenv("KAKAO_REST_API_KEY")
    headers = {"Authorization": f"KakaoAK {kakao_key}"}
    url = "https://dapi.kakao.com/v2/search/image"
    
    try:
        res = requests.get(url, headers=headers, params={"query": query, "size": 1})
        if res.status_code == 200:
            docs = res.json().get("documents")
            if docs:
                return {"image_url": docs[0]["thumbnail_url"]}
    except Exception as e:
        print(f"이미지 검색 에러: {e}")
        
    return {"image_url": None}


@app.get("/")
def read_root():
    return {"message": "동선 플래너 백엔드 서버가 정상 작동 중입니다!... 🚀"}