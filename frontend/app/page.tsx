// app/page.tsx
'use client';

import { useKakaoLoader } from 'react-kakao-maps-sdk';
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';

import InputModal from './src/components/InputModal';
import Sidebar from './src/components/Sidebar';
import MapView from './src/components/MapView';

declare global {
  interface Window {
    kakao: any;
    Kakao: any;
  }
}

interface MarkerType {
  id: string; // 드래그 앤 드롭을 위한 고유 ID
  title: string;
  lat: number;
  lng: number;
  error: boolean;
  cost?: number; // 장소별 예상 비용
  category?: string;
  breakdown?: string;
  imageUrl?: string;
  rating?: number;
  reviews?: number;
}

export default function Home() {
  // 카카오톡 SDK 초기화 로직
  useEffect(() => {
    if (typeof window !== "undefined" && window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_APP_KEY);
    }
  }, []);

  const [loading, error] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_APP_KEY as string,
    libraries: ['services', 'clusterer', 'drawing'],
  });

  const [inputText, setInputText] = useState("");
  const [places, setPlaces] = useState<string[]>([]);
  const [markers, setMarkers] = useState<MarkerType[]>([]);
  const [routeInfos, setRouteInfos] = useState<{
    from: string; 
    to: string; 
    distance_m: number; 
    duration_sec: number; 
    error?: string; 
    taxi_fare?: number; 
    toll_fare?: number;
    paths?: { lat: number; lng: number }[];
  }[]>([]);
  const [routePaths, setRoutePaths] = useState<{lat: number, lng: number}[]>([]);
  
  const [isExtracting, setIsExtracting] = useState(false);
  const [useCurrentLoc, setUseCurrentLoc] = useState(false);
  const [myLoc, setMyLoc] = useState<{lat: number, lng: number} | null>(null);
  
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(true); 
  const [segmentModes, setSegmentModes] = useState<Record<string, 'walk' | 'car' | 'transit'>>({});
  const [transitInfos, setTransitInfos] = useState<any[]>([]);
  
  const [isMobile, setIsMobile] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const [activeCostTooltipId, setActiveCostTooltipId] = useState<string | null>(null);

  const [weather, setWeather] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0]);

  interface SaveSlot {
    id: string;
    title: string;
    date: string;
    markers: MarkerType[];
    places: string[];
    routeInfos: any[];
    segmentModes: Record<string, 'walk' | 'car' | 'transit'>;
  }
  const [savedSlots, setSavedSlots] = useState<SaveSlot[]>([]);

  // 📱 모바일 화면 감지 이벤트
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // 초기화
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 💾 데이터 불러오기 (최초 1회 실행)
  useEffect(() => {
    const savedMarkers = localStorage.getItem('planner_markers');
    if (savedMarkers && savedMarkers !== '[]') {
      setMarkers(JSON.parse(savedMarkers));
      setRouteInfos(JSON.parse(localStorage.getItem('planner_routeInfos') || '[]'));
      setSegmentModes(JSON.parse(localStorage.getItem('planner_segmentModes') || '{}'));
      setPlaces(JSON.parse(localStorage.getItem('planner_places') || '[]'));
      setIsModalOpen(false); // 저장된 일정이 있으면 모달 닫기
    }
    setIsLoaded(true); // 로딩 완료 플래그
  }, []);

  // 💾 데이터 자동 저장 (일정이 변경될 때마다 덮어쓰기)
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('planner_markers', JSON.stringify(markers));
      localStorage.setItem('planner_routeInfos', JSON.stringify(routeInfos));
      localStorage.setItem('planner_segmentModes', JSON.stringify(segmentModes));
      localStorage.setItem('planner_places', JSON.stringify(places));
      localStorage.setItem('planner_saved_slots', JSON.stringify(savedSlots));
    }
  }, [markers, routeInfos, segmentModes, places, savedSlots, isLoaded]);

  const toggleCurrentLoc = () => {
    if (useCurrentLoc) {
      setUseCurrentLoc(false);
      setMyLoc(null);
    } else {
      if (!navigator.geolocation) {
        alert("이 브라우저에서는 위치 정보를 지원하지 않습니다.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setUseCurrentLoc(true);
        },
        () => alert("위치 정보를 가져오는 데 실패했습니다.")
      );
    }
  };

  // 백엔드 통신: 길찾기(이동시간/택시비/경로) 요청 함수
  const fetchRoutes = async (currentMarkers: MarkerType[]) => {
    const validMarkers = currentMarkers.filter(m => !m.error);
    if (validMarkers.length > 1) {
      try {
        const routePayload = validMarkers.map(m => ({ name: m.title, lat: m.lat, lng: m.lng }));
        
        const [routeRes, transitRes] = await Promise.all([
          fetch("${process.env.NEXT_PUBLIC_API_URL}/api/get-route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ places: routePayload }),
          }),
          fetch("${process.env.NEXT_PUBLIC_API_URL}/api/get-transit-route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ places: routePayload }),
          })
        ]);

        if (routeRes.ok) {
          const routeData = await routeRes.json();
          if (routeData.route_info) {
            setRouteInfos(routeData.route_info);
            const allPaths: {lat: number, lng: number}[] = [];
            routeData.route_info.forEach((info: any) => {
              if (info.paths) allPaths.push(...info.paths);
            });
            setRoutePaths(allPaths);
          }
        }

        if (transitRes.ok) {
          const transitData = await transitRes.json();
          if (transitData.transit_route_info) {
            setTransitInfos(transitData.transit_route_info);
          }
        }
      } catch (e) {
        console.error("길찾기 정보 획득 실패:", e);
      }
    } else {
      setRouteInfos([]);
      setRoutePaths([]);
      setTransitInfos([]);
    }
  };

  // 동선 추출 버튼 클릭 핸들러
  const handleExtract = async () => {
    if (!inputText.trim()) return alert("일정 메모를 입력해주세요!");
    
    setIsExtracting(true);
    setPlaces([]);
    setMarkers([]);
    setRouteInfos([]);
    setRoutePaths([]);

    const targetLat = (useCurrentLoc && myLoc) ? myLoc.lat : mapCenter.lat;
    const targetLng = (useCurrentLoc && myLoc) ? myLoc.lng : mapCenter.lng;

    try {
      const response = await fetch("${process.env.NEXT_PUBLIC_API_URL}/api/extract-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: inputText, 
          lat: targetLat, 
          lon: targetLng,
          date: targetDate
        }),
      });

      if (!response.ok) throw new Error("서버 응답 에러");
      const data = await response.json();

      if (data.places && data.places.length > 0) {
        let finalPlaces = [...data.places];
        let finalDetails = data.place_details || []; // 백엔드에서 온 비용 데이터 받기

        if (data.weather) {
          setWeather(data.weather);
        }
        
        if (useCurrentLoc && myLoc) {
          finalPlaces.unshift("내 현재 위치");
          finalDetails.unshift({ name: "내 현재 위치", estimated_cost: 0 }); // 출발지는 0원
        }
        
        setPlaces(finalPlaces);
        setIsModalOpen(false); // 팝업 닫기
        await searchSequentialAndGetRoutes(finalPlaces, myLoc, finalDetails); // 파라미터로 넘김
      } else {
        alert("장소를 찾을 수 없어요. 더 구체적으로 적어주세요!");
      }
    } catch (err) {
      console.error(err);
      alert("백엔드 서버와 통신할 수 없습니다.");
    } finally {
      setIsExtracting(false);
    }
  };

  // 동선 최적화 API 호출 함수
  const handleOptimizeRoute = async () => {
    const validMarkers = markers.filter(m => !m.error);
    if (validMarkers.length <= 2) {
      alert("경유지가 3개 이상일 때 최적화가 의미 있어요!");
      return;
    }

    try {
      const routePayload = validMarkers.map(m => ({ name: m.title, lat: m.lat, lng: m.lng }));
      const response = await fetch("${process.env.NEXT_PUBLIC_API_URL}/api/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places: routePayload }),
      });
      
      const data = await response.json();
      
      if (data.optimized_places) {
        // 백엔드에서 준 최적화 순서대로 기존 마커 배열 재정렬
        const optimizedMarkers = data.optimized_places.map((optPlace: any) => 
          validMarkers.find(m => m.title === optPlace.name)
        ).filter(Boolean) as MarkerType[];
        
        setMarkers(optimizedMarkers); // 상태 덮어쓰기
        await fetchRoutes(optimizedMarkers); // 변경된 순서로 길찾기 선 다시 긋기
      }
    } catch (error) {
      console.error("동선 최적화 에러:", error);
    }
  };

  // 슬롯 저장/불러오기/삭제 함수
  const handleSaveToSlot = () => {
    if (savedSlots.length >= 3) return alert("저장소(3개)가 꽉 찼습니다. 기존 일정을 삭제해주세요!");
    if (markers.length === 0) return alert("저장할 일정이 없습니다.");

    const newSlot: SaveSlot = {
      id: Date.now().toString(),
      title: `${inputText.substring(0, 10)}... 코스`,
      date: targetDate,
      markers, places, routeInfos, segmentModes
    };
    setSavedSlots([...savedSlots, newSlot]);
    alert("일정이 저장소에 보관되었습니다! 💾");
  };

  const handleLoadSlot = (slot: SaveSlot) => {
    if(confirm("현재 편집 중인 일정이 덮어씌워집니다. 불러오시겠습니까?")) {
      setMarkers(slot.markers);
      setPlaces(slot.places);
      setRouteInfos(slot.routeInfos);
      setSegmentModes(slot.segmentModes);
      setTargetDate(slot.date);
    }
  };

  const handleDeleteSlot = (id: string) => {
    setSavedSlots(savedSlots.filter(s => s.id !== id));
  };

  // 카카오맵 장소 검색 및 순차적 꼬리물기 알고리즘 
  const searchSequentialAndGetRoutes = async (placeNames: string[], initialLoc: {lat: number, lng: number} | null, placeDetails: any[] = []) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) return;

    const ps = new window.kakao.maps.services.Places();
    const newMarkers: MarkerType[] = [];
    let previousCoord = initialLoc;

    for (let i = 0; i < placeNames.length; i++) {
      const pName = placeNames[i];
      const uniqueId = Math.random().toString(36).substr(2, 9);
      
      // 💸 현재 장소의 예상 금액, 카테고리, 세부내역 찾기
      const detail = placeDetails.find(d => d.name === pName);
      const placeCost = detail ? detail.estimated_cost : 0;
      const placeCategory = detail ? detail.category : '기타';
      const placeBreakdown = detail ? detail.breakdown : '';

      if (pName === "내 현재 위치" && initialLoc) {
        newMarkers.push({ 
          id: uniqueId, 
          title: pName, 
          lat: initialLoc.lat, 
          lng: initialLoc.lng, 
          error: false, 
          cost: placeCost,
          category: placeCategory,
          breakdown: placeBreakdown
        });
        continue;
      }

      const searchOptions: any = {};
      if (previousCoord && !pName.endsWith("역")) {
        searchOptions.location = new window.kakao.maps.LatLng(previousCoord.lat, previousCoord.lng);
        searchOptions.sort = window.kakao.maps.services.SortBy.DISTANCE;
      }

      let searchKeyword = pName;
      if (searchKeyword === "영화") searchKeyword = "영화관";

      const searchResult = await new Promise<any>((resolve) => {
        ps.keywordSearch(searchKeyword, (data: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK) {
            let filteredData = data;
            if (!pName.includes("출구") && !pName.includes("주차") && !pName.includes("투루카") && !pName.includes("쏘카") && !pName.includes("아파트")) {
              filteredData = data.filter((d: any) => 
                !d.place_name.includes("출구") && !d.place_name.includes("주차") && !d.place_name.includes("투루카") && !d.place_name.includes("쏘카") && !d.place_name.includes("아파트") && !d.place_name.includes("빌라")
              );
            }
            const searchList = filteredData.length > 0 ? filteredData : data;
            let targetPlace = searchList[0]; 
            if (pName.endsWith("역")) {
              const station = searchList.find((d: any) => d.category_group_code === 'SW8');
              if (station) targetPlace = station;
            }
            resolve({ success: true, realName: targetPlace.place_name, lat: parseFloat(targetPlace.y), lng: parseFloat(targetPlace.x) });
          } else {
            resolve({ success: false });
          }
        }, searchOptions);
      });

      // 검색 결과에 따라 마커 배열에 데이터 추가
      if (searchResult.success) {
        const finalName = pName === "내 현재 위치" ? pName : searchResult.realName;
        
        // 📸 백엔드에 썸네일 이미지 요청 (현재 위치는 제외)
        let fetchedImageUrl = "";
        if (finalName !== "내 현재 위치") {
          try {
            const imgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/place-image?query=${encodeURIComponent(finalName)}`);
            if (imgRes.ok) {
              const imgData = await imgRes.json();
              fetchedImageUrl = imgData.image_url || "";
            }
          } catch (e) { console.error("이미지 로드 실패", e); }
        }

        newMarkers.push({ 
          id: uniqueId, 
          title: finalName, 
          lat: searchResult.lat, 
          lng: searchResult.lng, 
          error: false, 
          cost: placeCost,
          category: placeCategory,
          breakdown: placeBreakdown,
          imageUrl: fetchedImageUrl,
          rating: detail?.rating,
          reviews: detail?.reviews
        });
        previousCoord = { lat: searchResult.lat, lng: searchResult.lng };
      } else {
        newMarkers.push({ 
          id: uniqueId, 
          title: pName, 
          lat: 0, 
          lng: 0, 
          error: true, 
          cost: placeCost,
          category: placeCategory,
          breakdown: placeBreakdown
        });
      }
    }
    
    setMarkers(newMarkers);
    await fetchRoutes(newMarkers); 
  };

  // 구간별 이동 수단을 실시간으로 반영하여 총 시간 계산!
  const totalDurationMin = Math.ceil(routeInfos.reduce((sum, r) => {
    const fromMarker = markers.find(m => m.title === r.from);
    const mode = fromMarker ? (segmentModes[fromMarker.id] || 'walk') : 'walk';
    
    if (mode === 'walk') {
      return sum + (r.distance_m / 67) * 60; // 도보(약 67m/분) 초 단위 변환
    }
    return sum + (r.duration_sec || 0); // 자동차 시간
  }, 0) / 60);
  const totalDistanceKm = (routeInfos.reduce((sum, r) => sum + (r.distance_m || 0), 0) / 1000).toFixed(1);

  // 총 예산 계산식 (장소 비용 + 택시/톨비)
  const totalPlacesCost = markers.filter(m => !m.error).reduce((sum, m) => sum + (m.cost || 0), 0);
  const totalTransportCost = routeInfos.reduce((sum, r) => {
    const fromMarker = markers.find(m => m.title === r.from);
    const mode = fromMarker ? (segmentModes[fromMarker.id] || 'walk') : 'walk';
    if (mode === 'car') return sum + (r.taxi_fare || 0) + (r.toll_fare || 0);
    return sum;
  }, 0);
  const totalEstimatedCost = totalPlacesCost + totalTransportCost;

  const validMapCenter = markers.find(m => !m.error);
  const mapCenter = validMapCenter 
    ? { lat: validMapCenter.lat, lng: validMapCenter.lng } 
    : (useCurrentLoc && myLoc) 
      ? { lat: myLoc.lat, lng: myLoc.lng } 
      : { lat: 37.5665, lng: 126.9780 };

  // 카카오톡 공유 기능 함수 (리치 템플릿 - List 타입 적용)
  const handleKakaoShare = () => {
    if (!window.Kakao) {
      alert("카카오톡 공유 기능을 불러오지 못했습니다.");
      return;
    }

    const validMarkers = markers.filter(m => !m.error);
    if (validMarkers.length === 0) return alert("공유할 동선이 없습니다.");

    // 카카오 리스트 템플릿은 최대 3개까지만 아이템 노출이 가능함
    const listContents = validMarkers.slice(0, 3).map((m, index) => ({
      title: `${index + 1}. ${m.title}`,
      description: m.category || "방문 장소",
      imageUrl: m.imageUrl || "https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fblog.kakaocdn.net%2Fdn%2FcTKIq5%2Fbtq65G2N147%2FeYn5L6Xz7m9X6X8Z7QZ6K0%2Fimg.png", // 이미지가 없을 때 띄울 기본 플레이스홀더 이미지
      link: {
        mobileWebUrl: 'http://localhost:3000',
        webUrl: 'http://localhost:3000',
      },
    }));

    window.Kakao.Share.sendDefault({
      objectType: 'list',
      headerTitle: `🚗 AI 동선 플래너\n⏱️ ${totalDurationMin}분 소요 | 💸 ${totalEstimatedCost.toLocaleString()}원`,
      headerLink: {
        mobileWebUrl: 'http://localhost:3000',
        webUrl: 'http://localhost:3000',
      },
      contents: listContents,
      buttons: [
        {
          title: validMarkers.length > 3 ? `앱에서 전체 코스 보기 (총 ${validMarkers.length}곳)` : '자세한 동선 보기',
          link: {
            mobileWebUrl: 'http://localhost:3000',
            webUrl: 'http://localhost:3000',
          },
        },
      ],
    });
  };

  return (
    <main className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      
      {/* 입력 모달 팝업 */}
      <AnimatePresence>
        {isModalOpen && (
          <InputModal 
            inputText={inputText}
            setInputText={setInputText}
            places={places}
            useCurrentLoc={useCurrentLoc}
            isExtracting={isExtracting}
            loading={loading}
            onClose={() => setIsModalOpen(false)}
            onToggleCurrentLoc={toggleCurrentLoc}
            onExtract={handleExtract}
            targetDate={targetDate}
            setTargetDate={setTargetDate}
          />
        )}
      </AnimatePresence>

      <Sidebar 
        isMobile={isMobile}
        isPanelOpen={isPanelOpen}
        isExtracting={isExtracting}
        places={places}
        markers={markers}
        setMarkers={setMarkers}
        routeInfos={routeInfos}
        segmentModes={segmentModes}
        setSegmentModes={setSegmentModes}
        totalDurationMin={totalDurationMin}
        totalDistanceKm={totalDistanceKm}
        totalEstimatedCost={totalEstimatedCost}
        activeCostTooltipId={activeCostTooltipId}
        setActiveCostTooltipId={setActiveCostTooltipId}
        setIsModalOpen={setIsModalOpen}
        handleKakaoShare={handleKakaoShare}
        fetchRoutes={fetchRoutes}
        weather={weather}
        handleOptimizeRoute={handleOptimizeRoute}
        savedSlots={savedSlots}
        handleSaveToSlot={handleSaveToSlot}
        handleLoadSlot={handleLoadSlot}
        handleDeleteSlot={handleDeleteSlot}
        transitInfos={transitInfos} 
        targetDate={targetDate}
      />

      <MapView 
        isMobile={isMobile}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
        loading={loading}
        error={error}
        mapCenter={mapCenter}
        markers={markers}
        routeInfos={routeInfos}
        segmentModes={segmentModes}
        transitInfos={transitInfos}
      />

    </main>
  );
}