// app/src/components/PlaceCard.tsx
'use client';

import { Reorder } from 'framer-motion';
import { GripVertical, MapPin, Clock, AlertCircle, Map, Info } from 'lucide-react';

export default function PlaceCard({
  marker, index, isLast, route, transitRoute, nextMarker,
  segmentMode, onModeChange,
  activeTooltipId, onToggleTooltip, onDragEnd
}: any) {
  return (
    <Reorder.Item 
      value={marker}
      onDragEnd={onDragEnd} 
      className="relative list-none mb-6 cursor-grab active:cursor-grabbing"
    >
      {/* 좌측 타임라인 동그라미 */}
      <span className={`absolute flex items-center justify-center w-7 h-7 bg-white border-2 rounded-full left-[9px] top-4 ring-4 ring-[#F8FAFC] shadow-sm z-10 ${marker.error ? 'border-red-400 text-red-500' : 'border-slate-800 text-slate-800'}`}>
        <span className="font-bold text-[12px]">{index + 1}</span>
      </span>
      
      {/* 장소 카드 본체 */}
      <div className={`ml-[52px] bg-white p-3.5 rounded-2xl shadow-sm transition-all flex items-center gap-3 border ${marker.error ? 'bg-red-50/30 border-red-100' : 'border-slate-100 hover:border-slate-200 hover:shadow-md'}`}>
        <GripVertical className="w-4 h-4 shrink-0 text-slate-200 hover:text-slate-400 transition-colors" />
        
        {/* 📸 썸네일 */}
        {!marker.error && marker.imageUrl ? (
          <img src={marker.imageUrl} alt={marker.title} className="w-12 h-12 object-cover rounded-xl shadow-sm shrink-0 bg-slate-50" />
        ) : (
          <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded-xl shrink-0 border border-slate-100">
            <MapPin className="w-5 h-5 text-slate-300" />
          </div>
        )}

        {/* 텍스트 및 우측 뱃지 */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
          <h3 title={marker.title} className={`font-bold text-[15px] truncate ${marker.error ? 'text-red-500 line-through' : 'text-slate-800'}`}>
            {marker.title}
          </h3>
          {!marker.error && marker.rating > 0 && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100 flex items-center gap-0.5 shrink-0">
              ⭐ {marker.rating} <span className="text-amber-400 font-medium">({marker.reviews}+)</span>
            </span>
          )}
          <div className="flex items-center gap-2">
            {!marker.error && (
              <a 
                href={`https://map.kakao.com/link/to/${marker.title},${marker.lat},${marker.lng}`}
                target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded flex items-center gap-1 transition"
              >
                <Map className="w-3 h-3" /> 안내
              </a>
            )}
            {!marker.error && marker.cost !== undefined && marker.cost > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleTooltip(marker.id); }}
                  className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1 transition"
                >
                  {marker.cost.toLocaleString()}원 <Info className="w-3 h-3" />
                </button>
                {/* 툴팁 팝오버 */}
                {activeTooltipId === marker.id && (
                  <div className="absolute left-0 top-7 z-30 w-52 bg-slate-800 text-white text-xs rounded-xl p-3 shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-slate-600">
                      <span className="font-bold text-blue-300 bg-blue-900/50 px-1.5 py-0.5 rounded text-[10px]">
                        🏷️ {marker.category || '지출 내역'}
                      </span>
                      <button onClick={() => onToggleTooltip(null)} className="text-slate-400 hover:text-white font-bold text-[10px]">✕</button>
                    </div>
                    <p className="text-slate-200 font-medium leading-relaxed">{marker.breakdown || '정보가 없습니다.'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 하단 연결 정보 (시간/거리/이동수단) */}
      {!isLast && !marker.error && (
      <div className="ml-[64px] py-1.5">
        {!route ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg text-slate-400 text-[11px] font-medium animate-pulse"><Clock className="w-3 h-3" /> 계산 중...</div>
        ) : route.error ? (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-red-500 text-[11px] font-medium bg-red-50 border border-red-100"><AlertCircle className="w-3 h-3" /> 경로 확인 불가</div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0 border border-slate-200">
              <button
                onClick={() => onModeChange(marker.id, 'walk')}
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all ${segmentMode === 'walk' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >🚶</button>
              <button
                onClick={() => onModeChange(marker.id, 'car')}
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all ${segmentMode === 'car' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >🚗</button>
              <button
                onClick={() => onModeChange(marker.id, 'transit')}
                className={`px-2 py-1 text-[11px] rounded-md font-medium transition-all ${segmentMode === 'transit' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >🚌</button>
            </div>
            
            <div className="inline-flex items-center gap-2 text-slate-500 text-[11px] font-medium">
              {segmentMode === 'walk' && (
                <>
                  <span className="text-slate-700 font-bold">{Math.ceil(route.distance_m / 67)}분</span>
                  <span className="text-slate-300">|</span>
                  <span>{(route.distance_m / 1000).toFixed(1)}km</span>
                </>
              )}
              {segmentMode === 'car' && (
                <>
                  <span className="text-slate-700 font-bold">{Math.ceil(route.duration_sec / 60)}분</span>
                  <span className="text-slate-300">|</span>
                  <span>{(route.distance_m / 1000).toFixed(1)}km</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-blue-600 font-bold">
                    택시 {((route.taxi_fare && route.taxi_fare > 0) ? route.taxi_fare : (route.distance_m <= 1600 ? 4800 : 4800 + Math.ceil((route.distance_m - 1600) / 131) * 100)).toLocaleString()}원
                  </span>
                </>
              )}
              {segmentMode === 'transit' && transitRoute && (
                <>
                  {transitRoute.error ? (
                    <span className="text-red-400">대중교통 경로 없음</span>
                  ) : (
                    <>
                      <span className="text-slate-700 font-bold">{transitRoute.transit_time_min}분</span>
                      <span className="text-slate-300">|</span>
                      <span>환승 {transitRoute.transfer_count}회</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-blue-600 font-bold">{transitRoute.transit_fare.toLocaleString()}원</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )}
    </Reorder.Item>
  );
}