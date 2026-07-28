# weather_utils.py

import math
import httpx
import os
from datetime import datetime, timedelta

# 기상청 단기예보 격자 변환 상수
RE = 6371.00877 # 지구 반경(km)
GRID = 5.0      # 격자 간격(km)
SLAT1 = 30.0    # 투영 위도1(degree)
SLAT2 = 60.0    # 투영 위도2(degree)
OLON = 126.0    # 기준점 경도(degree)
OLAT = 38.0     # 기준점 위도(degree)
XO = 43         # 기준점 X좌표(GRID)
YO = 136        # 기준점 Y좌표(GRID)

def lat_lon_to_kma_grid(lat: float, lon: float):
    """카카오맵 위도/경도를 기상청 X/Y 격자로 변환하는 함수"""
    DEGRAD = math.pi / 180.0
    re = RE / GRID
    slat1 = SLAT1 * DEGRAD
    slat2 = SLAT2 * DEGRAD
    olon = OLON * DEGRAD
    olat = OLAT * DEGRAD

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / math.pow(ro, sn)

    ra = math.tan(math.pi * 0.25 + (lat) * DEGRAD * 0.5)
    ra = re * sf / math.pow(ra, sn)
    theta = lon * DEGRAD - olon
    if theta > math.pi: theta -= 2.0 * math.pi
    if theta < -math.pi: theta += 2.0 * math.pi
    theta *= sn

    nx = math.floor(ra * math.sin(theta) + XO + 0.5)
    ny = math.floor(ro - ra * math.cos(theta) + YO + 0.5)
    
    return int(nx), int(ny)

async def fetch_current_weather(lat: float, lon: float):
    """현재 날씨(초단기실황)를 비동기로 가져오는 함수"""
    nx, ny = lat_lon_to_kma_grid(lat, lon)
    
    # 기상청 API는 정시 기준(예: 14시 00분) 업데이트이므로 시간 계산이 필요함
    now = datetime.now()
    if now.minute < 40: # 매시간 40분 이전이면 이전 시간대 데이터를 조회
        now = now - timedelta(hours=1)
        
    base_date = now.strftime("%Y%m%d")
    base_time = now.strftime("%H00")

    url = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"
    params = {
        "serviceKey": os.getenv("KMA_API_KEY"),
        "pageNo": "1",
        "numOfRows": "1000",
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
            data = response.json()
            items = data['response']['body']['items']['item']
            
            weather_info = {"PTY": "0", "RN1": "0"} # PTY: 강수형태, RN1: 1시간 강수량
            for item in items:
                if item['category'] in weather_info:
                    weather_info[item['category']] = item['obsrValue']
            
            # PTY 코드: 0(없음), 1(비), 2(비/눈), 3(눈), 5(빗방울), 6(빗방울눈날림), 7(눈날림)
            pty_code = int(weather_info["PTY"])
            if pty_code in [1, 2, 4, 5, 6]:
                return "비"
            elif pty_code in [3, 7]:
                return "눈"
            else:
                return "맑음/흐림"
                
        except Exception as e:
            print(f"Weather API Error: {e}")
            return "날씨 정보 없음"