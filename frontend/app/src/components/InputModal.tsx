// src/components/InputModal.tsx
'use client';

import { motion } from 'framer-motion';
import { X, Sparkles, AlertCircle, Crosshair, Map as MapIcon, Send } from 'lucide-react';

interface InputModalProps {
  inputText: string;
  setInputText: (text: string) => void;
  targetDate: string;
  setTargetDate: (date: string) => void;
  places: string[];
  useCurrentLoc: boolean;
  isExtracting: boolean;
  loading: boolean;
  onClose: () => void;
  onToggleCurrentLoc: () => void;
  onExtract: () => void;
}

export default function InputModal({
  inputText, setInputText, targetDate, setTargetDate, places,
  useCurrentLoc, isExtracting, loading, onClose, onToggleCurrentLoc, onExtract
}: InputModalProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 relative"
      >
        {places.length > 0 && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-600" /> 일정을 알려주세요!
        </h2>
        <p className="text-sm text-slate-500 mb-6">생각나는 대로 툭 적어주시면 AI가 완벽한 동선을 짜드립니다.</p>
        
        <textarea
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)}
          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 resize-none text-slate-700 placeholder-slate-400 transition"
          placeholder="예: 강남역에서 만나서 쉑쉑버거 먹고 메가박스 갈래!"
        />

        <div className="mt-4 mb-2">
          <label className="text-sm font-bold text-slate-700 block mb-1">📅 언제 가시나요?</label>
          <input 
            type="date" 
            value={targetDate} 
            onChange={(e) => setTargetDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]} // 오늘 이전 날짜 선택 방지
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-700 transition"
          />
        </div>
        
        <div className="flex items-start gap-1.5 mt-3 mb-6 p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-xs text-amber-800 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span><strong>꿀팁:</strong> '밥', '영화' 대신 <strong>'상호명'</strong>을 적어야 정확히 찾아줍니다!</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={onToggleCurrentLoc} 
            className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-xl font-bold text-sm transition ${useCurrentLoc ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Crosshair className={`w-4 h-4 ${useCurrentLoc && 'animate-spin-slow'}`} /> 
            {useCurrentLoc ? '위치 적용됨' : '내 위치 출발'}
          </button>
          <button 
            onClick={onExtract} 
            disabled={isExtracting || loading} 
            className="flex-[2] flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isExtracting ? (
              <span className="flex items-center gap-2 animate-pulse">
                <MapIcon className="w-4 h-4" /> AI가 분석 중...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" /> 동선 추출하기
              </span>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}