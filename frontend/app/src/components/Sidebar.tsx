// app/src/components/Sidebar.tsx
'use client';

import { useState } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion'; 
import { Route, Edit3, MapPin, Navigation, Share2, Map as MapIcon, Plus, Sparkles, CalendarDays, Clock, Banknote, CalendarPlus, ChevronDown, ChevronUp } from 'lucide-react';
import PlaceCard from './PlaceCard';

export default function Sidebar({
  isMobile, isPanelOpen, isExtracting, places, markers, setMarkers,
  routeInfos, segmentModes, setSegmentModes,
  totalDurationMin, totalDistanceKm, totalEstimatedCost,
  activeCostTooltipId, setActiveCostTooltipId,
  setIsModalOpen, handleKakaoShare, fetchRoutes,
  weather, handleOptimizeRoute, targetDate, transitInfos,
  savedSlots, handleSaveToSlot, handleLoadSlot, handleDeleteSlot,
}: any) {
  const [activeTab, setActiveTab] = useState<'current' | 'storage'>('current');
  const [isActionPanelOpen, setIsActionPanelOpen] = useState(true);

  const handleExportCalendar = () => {
    const validMarkers = markers.filter((m: any) => !m.error);
    if (validMarkers.length === 0) return alert("저장할 일정이 없습니다.");

    // targetDate(YYYY-MM-DD)를 포맷팅 (기준시간 오전 10시 시작으로 가상 설정)
    const baseDateStr = targetDate ? targetDate.replace(/-/g, '') : new Date().toISOString().slice(0,10).replace(/-/g, '');
    let currentTime = new Date(`${targetDate || new Date().toISOString().slice(0,10)}T10:00:00`);

    let icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//AI Course Planner//KO\nCALSCALE:GREGORIAN\n`;

    validMarkers.forEach((marker: any, index: number) => {
      const startTime = currentTime.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";
      // 임의로 각 장소당 2시간 체류한다고 가정
      currentTime.setHours(currentTime.getHours() + 2); 
      const endTime = currentTime.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";

      icsContent += `BEGIN:VEVENT\n`;
      icsContent += `DTSTART:${startTime}\n`;
      icsContent += `DTEND:${endTime}\n`;
      icsContent += `SUMMARY:[일정] ${marker.title}\n`;
      icsContent += `DESCRIPTION:카테고리: ${marker.category || '없음'}\\n예상 비용: ${marker.cost ? marker.cost.toLocaleString() + '원' : '없음'}\\n세부 내역: ${marker.breakdown || ''}\n`;
      icsContent += `LOCATION:${marker.title}\n`;
      icsContent += `END:VEVENT\n`;
    });

    icsContent += `END:VCALENDAR`;

    // 파일 다운로드 트리거
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `AI_동선플랜_${baseDateStr}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.section 
      initial={false} 
      animate={
        isMobile
          ? { height: isPanelOpen ? '65vh' : '0px', y: isPanelOpen ? 0 : 100 } 
          : { width: isPanelOpen ? '460px' : '0px', x: isPanelOpen ? 0 : -460 } // 🔥 너비를 380px에서 460px로 시원하게 확장!
      }
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`bg-[#F8FAFC] flex flex-col z-20 shrink-0 border-slate-200 overflow-hidden
        ${isMobile ? 'absolute bottom-0 w-full rounded-t-3xl border-t shadow-[0_-10px_40px_rgba(0,0,0,0.1)]' : 'relative h-full border-r shadow-[10px_0_30px_rgba(0,0,0,0.05)]'}
      `}
    >
      {/* 헤더 영역 */}
      <div className="pt-4 pb-0 px-6 bg-white shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-blue-200 shadow-lg">
              <Route className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI 동선 플래너</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">스마트 여행 코스 생성기</p>
            </div>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors font-semibold text-xs" title="새로운 일정 짜기">
            <Edit3 className="w-3.5 h-3.5" /> 새 일정
          </button>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('current')} 
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'current' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            현재 일정
          </button>
          <button 
            onClick={() => setActiveTab('storage')} 
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'storage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            내 저장소 <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'storage' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{savedSlots.length}/3</span>
          </button>
        </div>
      </div>

      {/* 본문 영역 */}
      <div className="flex flex-col flex-1 overflow-hidden bg-[#F8FAFC]">
        {activeTab === 'current' ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* 요약 대시보드 */}
            <div className="px-6 py-4 shrink-0 space-y-3 bg-white border-b border-slate-100">
              {markers.length > 0 && !isExtracting && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-3 rounded-2xl flex flex-col items-center justify-center border border-slate-100">
                    <MapPin className="w-4 h-4 text-slate-400 mb-1" />
                    <span className="text-sm font-bold text-slate-700">{markers.filter((m: any) => !m.error).length}곳</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl flex flex-col items-center justify-center border border-slate-100">
                    <Clock className="w-4 h-4 text-slate-400 mb-1" />
                    <span className="text-sm font-bold text-slate-700">{totalDurationMin}분</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl flex flex-col items-center justify-center border border-slate-100">
                    <Banknote className="w-4 h-4 text-blue-500 mb-1" />
                    <span className="text-sm font-bold text-blue-600">{totalEstimatedCost.toLocaleString()}원</span>
                  </div>
                </div>
              )}

              {/* 날씨 배지 */}
              {weather && !isExtracting && markers.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-100 text-slate-600">
                  {weather === '비' && <>🌧️ <span className="text-blue-600">비 예보!</span> 플랜 B를 확인하세요</>}
                  {weather === '눈' && <>❄️ <span className="text-indigo-600">눈 예보!</span> 플랜 B를 확인하세요</>}
                  {weather === '먼 날짜 (예측 불가)' && <>🗓️ 날씨는 3일 이내만 예측 가능해요</>}
                  {weather === '맑음/흐림' && <>🌤️ 날씨가 좋아요! 완벽한 일정을 즐기세요</>}
                </div>
              )}
            </div>

            {/* 타임라인 리스트 */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4">
              {isExtracting ? (
                <div className="space-y-4 pt-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-slate-100 p-4 rounded-2xl flex gap-4 animate-pulse shadow-sm">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl shrink-0"></div>
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/3 mt-2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : markers.length > 0 ? (
                <>
                  <div className="flex justify-between items-end mb-4 px-1">
                    <h3 className="font-bold text-slate-900">📍 코스 타임라인</h3>
                    <motion.button 
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleOptimizeRoute}
                      className="text-[11px] bg-white text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex items-center gap-1 font-bold"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" /> 동선 자동 정렬
                    </motion.button>
                  </div>
                  <Reorder.Group axis="y" values={markers} onReorder={setMarkers} className="relative">
                    <div className="absolute top-4 bottom-4 left-[23px] w-[2px] bg-slate-200/50"></div>                  
                    {markers.map((marker: any, idx: number) => (
                      <PlaceCard
                        key={marker.id} marker={marker} index={idx} isLast={idx === markers.length - 1}
                        route={routeInfos?.find((r: any) => r.from === marker.title)}
                        transitRoute={transitInfos?.find((r: any) => r.from === marker.title)}
                        nextMarker={markers[idx + 1]} segmentMode={segmentModes[marker.id] || 'walk'}
                        onModeChange={(id: string, mode: 'walk' | 'car' | 'transit') => setSegmentModes((prev: any) => ({ ...prev, [id]: mode }))}
                        activeTooltipId={activeCostTooltipId}
                        onToggleTooltip={(id: string) => setActiveCostTooltipId(activeCostTooltipId === id ? null : id)}
                        onDragEnd={() => fetchRoutes(markers)}
                      />
                    ))}
                  </Reorder.Group>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-2 shadow-inner"><MapIcon className="w-8 h-8 text-slate-300" /></div>
                  <p className="text-sm font-medium">아직 등록된 일정이 없습니다.</p>
                </div>
              )}
            </div>
            {!isExtracting && markers.filter((m: any) => !m.error).length > 0 && (
              <div className="shrink-0 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-10 relative flex flex-col">
                <div className={`absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-500 ease-in-out ${
                  isActionPanelOpen 
                    ? '-top-3.5'
                    : '-top-16'
                }`}>
                  <button
                    onClick={() => setIsActionPanelOpen(!isActionPanelOpen)}
                    className={`flex items-center justify-center rounded-full transition-all ${
                      isActionPanelOpen
                        ? "bg-white border border-slate-200 text-slate-400 hover:text-slate-600 p-1 shadow-sm" // 열렸을 때 (흰색 미니멀 버튼)
                        : "bg-blue-600 border border-blue-500 text-white p-3 shadow-[0_4px_16px_rgba(37,99,235,0.4)] hover:bg-blue-700 hover:-translate-y-1" // 닫혔을 때 (파란색 플로팅 버튼)
                    }`}
                    title={isActionPanelOpen ? "액션 메뉴 숨기기" : "액션 메뉴 열기"}
                  >
                    {isActionPanelOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-5 h-5" /> 
                    )}
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {isActionPanelOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden"
                    >
                      <div className="p-5 space-y-2.5 pt-5">
                        <button onClick={handleKakaoShare} className="w-full flex items-center justify-center gap-2 bg-[#FEE500] text-[#191919] py-3.5 rounded-2xl font-bold text-sm hover:bg-[#FADA0A] transition shadow-sm">
                          <Share2 className="w-4 h-4" /> 카카오톡으로 동선 공유
                        </button>
                        <div className="flex gap-2">
                          <button onClick={handleExportCalendar} className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 border border-blue-100 py-3.5 rounded-2xl font-bold text-sm hover:bg-blue-100 transition shadow-sm">
                            <CalendarPlus className="w-4 h-4" /> 일정 등록
                          </button>
                          <button onClick={handleSaveToSlot} className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-800 transition shadow-sm">
                            <CalendarDays className="w-4 h-4" /> 보관함 킵
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {savedSlots.length === 0 ? (
              <div className="text-center text-slate-400 text-sm mt-10 py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                보관된 일정이 없습니다.<br/>마음에 드는 코스를 저장해보세요!
              </div>
            ) : (
              <div className="space-y-4">
                {savedSlots.map((slot: any) => (
                  <div key={slot.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group relative">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base mb-1">{slot.title}</h4>
                        <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md">📅 {slot.date}</span>
                      </div>
                      <button onClick={() => handleDeleteSlot(slot.id)} className="text-slate-300 hover:text-red-500 transition px-2 py-1 text-xs font-bold bg-slate-50 rounded-lg hover:bg-red-50">삭제</button>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed border-l-2 border-slate-100 pl-2">{slot.places.join(" ➔ ")}</p>
                    <button onClick={() => handleLoadSlot(slot)} className="w-full mt-4 bg-slate-900 text-white font-bold text-sm py-3 rounded-xl hover:bg-slate-800 transition shadow-sm">
                      이 일정 불러오기
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}