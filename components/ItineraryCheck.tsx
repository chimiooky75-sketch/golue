import React, { useState } from 'react';
import { analyzeItinerary } from '../services/geminiService';
import { RiskAnalysis } from '../types';
import * as d3 from 'd3';

const ItineraryCheck: React.FC = () => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskAnalysis | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await analyzeItinerary(text);
      setResult(data);
    } catch (e) {
      alert("分析失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  // Simple Risk Gauge using D3 (embedded as SVG logic for simplicity in React)
  const RiskGauge = ({ score }: { score: number }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    let color = 'text-emerald-500';
    if (score > 30) color = 'text-yellow-500';
    if (score > 70) color = 'text-red-500';

    return (
      <div className="relative flex items-center justify-center w-32 h-32 mx-auto mb-4">
        <svg className="transform -rotate-90 w-32 h-32">
          <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200" />
          <circle 
            cx="64" cy="64" r={radius} 
            stroke="currentColor" strokeWidth="8" 
            fill="transparent" 
            strokeDasharray={circumference} 
            strokeDashoffset={offset} 
            className={`${color} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`text-3xl font-bold ${color}`}>{score}</span>
          <span className="text-xs text-slate-500 uppercase font-semibold">风险指数</span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      {/* Input Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <h3 className="text-lg font-bold text-slate-800 mb-4">粘贴你的行程</h3>
        <textarea
          className="w-full flex-grow p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-slate-50 text-slate-700 text-sm"
          placeholder="粘贴你的行程安排... (例如: Day 1: 抵达厦门, 打车去酒店, 晚上去曾厝垵吃海鲜...)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !text}
          className={`mt-4 w-full py-3 rounded-lg font-bold text-white transition-all ${
            loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
          }`}
        >
          {loading ? '正在检测风险...' : '开始体检'}
        </button>
      </div>

      {/* Results Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-y-auto">
        {!result && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            <p>体检报告将显示在这里</p>
          </div>
        )}

        {loading && (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 animate-pulse">正在比对避雷数据库...</p>
          </div>
        )}

        {result && (
          <div>
            <RiskGauge score={result.score} />
            <div className="mb-6">
              <h4 className="font-bold text-slate-800 mb-1">诊断摘要</h4>
              <p className="text-slate-600 text-sm leading-relaxed">{result.summary}</p>
            </div>

            <h4 className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">发现的雷点</h4>
            <div className="space-y-4">
              {result.risks.map((risk, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-lg border-l-4 border-red-500">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-slate-800">{risk.location}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${
                      risk.riskLevel === 'HIGH' ? 'bg-red-500' : risk.riskLevel === 'MEDIUM' ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}>
                      {risk.riskLevel === 'HIGH' ? '高危' : risk.riskLevel === 'MEDIUM' ? '中危' : '低危'}
                    </span>
                  </div>
                  <p className="text-xs text-red-600 font-medium mb-1">{risk.reason}</p>
                  <p className="text-xs text-slate-500 italic">" {risk.suggestion} "</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItineraryCheck;