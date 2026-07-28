// app/src/components/MapView.tsx
'use client';

import { useState, useEffect } from 'react'; 
import { Map, MapMarker, Polyline } from 'react-kakao-maps-sdk';
import { ChevronLeft, ChevronRight, Map as MapIcon } from 'lucide-react';

export default function MapView({
  isMobile, isPanelOpen, setIsPanelOpen,
  loading, error, mapCenter, markers, routeInfos, segmentModes
}: any) {
  
  // 2. 카카오맵 인스턴스를 담을 상태 추가
  const [map, setMap] = useState<any>(null);

  // 3. 사이드바가 열리거나 닫힐 때 지도의 크기를 강제로 재계산(relayout)
  useEffect(() => {
    if (map && window.kakao && window.kakao.maps) {
      // Framer Motion 애니메이션이 끝나는 시간(약 300~400ms)을 고려해 살짝 여유를 두고 재계산
      const timer = setTimeout(() => {
        map.relayout(); 
        map.setCenter(new window.kakao.maps.LatLng(mapCenter.lat, mapCenter.lng)); // 중심축 다시 맞추기
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isPanelOpen, map, mapCenter]);

  return (
    <section className="flex-1 w-full h-full relative z-0">
      
      {/* 패널 열기/닫기 토글 버튼 (PC & 모바일 반응형) */}
      <button 
        onClick={() => setIsPanelOpen(!isPanelOpen)} 
        className={`absolute bg-white border border-slate-200 text-slate-600 shadow-[4px_0_10px_rgba(0,0,0,0.1)] flex items-center justify-center hover:bg-slate-50 hover:text-blue-600 transition-all z-[40]
          ${isMobile ? 'right-4 w-12 h-12 rounded-full' : 'left-0 top-1/2 -translate-y-1/2 w-8 h-12 rounded-r-xl'}
        `}
        style={isMobile ? { bottom: isPanelOpen ? 'calc(65vh + 16px)' : '16px' } : {}} 
        title={isPanelOpen ? "패널 닫기" : "패널 열기"}
      >
        {isMobile ? (
           isPanelOpen ? <ChevronLeft className="w-6 h-6 -rotate-90" /> : <MapIcon className="w-5 h-5" />
        ) : (
           isPanelOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
        )}
      </button>

      {loading ? (
        <div className="flex flex-col h-full items-center justify-center bg-slate-100 text-slate-400 gap-3">
          <MapIcon className="w-10 h-10 animate-pulse text-blue-500" />
          <span className="font-semibold text-xs tracking-wide text-slate-500">지도 로딩 중...</span>
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center font-bold text-red-500 bg-red-50">
          지도 로드 에러!
        </div>
      ) : (
        <Map 
          center={mapCenter} 
          style={{ width: '100%', height: '100%' }} 
          level={6}
          onCreate={setMap} // 👇 🔥 4. 지도가 생성될 때 map 인스턴스를 상태에 저장
        >
          {/* 마커 렌더링 */}
          {markers.filter((m: any) => !m.error).map((marker: any, idx: number) => (
            <MapMarker key={marker.id} position={{ lat: marker.lat, lng: marker.lng }} title={marker.title}>
              <div style={{ padding: "6px 10px", color: "#0f172a", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap" }}>
                {idx + 1}. {marker.title}
              </div>
            </MapMarker>
          ))}

          {/* 경로(선) 렌더링 */}
          {markers.filter((m: any) => !m.error).map((marker: any, idx: number, arr: any[]) => {
            if (idx === arr.length - 1) return null;
            
            const nextMarker = arr[idx + 1];
            const mode = segmentModes[marker.id] || 'walk';
            const route = routeInfos.find((r: any) => r.from === marker.title);
            
            let segmentPath = [];
            if (route && route.paths && route.paths.length > 0) {
              segmentPath = route.paths;
            } else {
              segmentPath = [
                { lat: marker.lat, lng: marker.lng },
                { lat: nextMarker.lat, lng: nextMarker.lng }
              ];
            }

            return (
              <Polyline 
                key={`line-${marker.id}`}
                path={segmentPath} 
                strokeWeight={5} 
                strokeColor={mode === 'car' ? "#2563eb" : "#10b981"} 
                strokeOpacity={0.9} 
                strokeStyle={mode === 'car' ? "solid" : "shortdash"} 
              />
            );
          })}
        </Map>
      )}
    </section>
  );
}