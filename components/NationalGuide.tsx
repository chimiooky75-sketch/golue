import React, { useState } from 'react';
import { searchDestinations } from '../services/geminiService';
import { DestinationResult } from '../types';

interface ProvinceNode {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
}

// Stylized simplified map nodes
const PROVINCES: ProvinceNode[] = [
  { id: 'xinjiang', name: '新疆', x: 15, y: 25, color: '#fca5a5' },
  { id: 'tibet', name: '西藏', x: 20, y: 55, color: '#fca5a5' },
  { id: 'qinghai', name: '青海', x: 35, y: 40, color: '#fdba74' },
  { id: 'sichuan', name: '四川', x: 45, y: 55, color: '#fdba74' },
  { id: 'yunnan', name: '云南', x: 40, y: 75, color: '#86efac' },
  { id: 'gansu', name: '甘肃', x: 40, y: 30, color: '#fdba74' },
  { id: 'inner_mongolia', name: '内蒙古', x: 55, y: 20, color: '#93c5fd' },
  { id: 'beijing', name: '北京', x: 70, y: 28, color: '#f87171' },
  { id: 'heilongjiang', name: '黑龙江', x: 85, y: 15, color: '#93c5fd' },
  { id: 'xian', name: '西安', x: 55, y: 45, color: '#fcd34d' },
  { id: 'shanghai', name: '上海', x: 85, y: 55, color: '#f87171' },
  { id: 'guangzhou', name: '广州', x: 75, y: 80, color: '#f87171' },
  { id: 'hunan', name: '湖南', x: 65, y: 65, color: '#fcd34d' },
  { id: 'wuhan', name: '武汉', x: 65, y: 55, color: '#fcd34d' },
  { id: 'fujian', name: '福建', x: 80, y: 70, color: '#86efac' },
  { id: 'taiwan', name: '台湾', x: 90, y: 75, color: '#86efac' },
];

const NationalGuide: React.FC = () => {
  const [selectedProvince, setSelectedProvince] = useState<ProvinceNode | null>(null);
  const [result, setResult] = useState<DestinationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleProvinceClick = async (province: ProvinceNode) => {
    setSelectedProvince(province);
    setLoading(true);
    setResult(null);
    try {
      const data = await searchDestinations(province.name);
      setResult(data);
    } catch (e) {
      console.error(e);
      // Fallback UI
      setResult({ 
        text: `抱歉，暂时无法连接到排雷中心获取${province.name}的数据。`, 
        mapLinks: [] 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
        <h2 className="text-2xl font-bold mb-2">全国避雷/攻略地图</h2>
        <p className="opacity-90">点击省份/城市，AI 实时生成基于 Google Maps 的避雷攻略。</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-grow h-full overflow-hidden">
        {/* Map Visualization */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative h-96 lg:h-auto flex-shrink-0 overflow-hidden">
          <div className="absolute top-4 left-4 z-10 text-xs text-slate-400 font-mono">GRID SYSTEM: CHINA_V2.0</div>
          
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Abstract Grid Lines */}
            <path d="M10,10 L90,10 M10,30 L90,30 M10,50 L90,50 M10,70 L90,70 M10,90 L90,90" stroke="#f1f5f9" strokeWidth="0.5" />
            <path d="M10,10 L10,90 M30,10 L30,90 M50,10 L50,90 M70,10 L70,90 M90,10 L90,90" stroke="#f1f5f9" strokeWidth="0.5" />
            
            {/* Connections (Stylized) */}
            <path d="M45,55 L35,40 L15,25" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2,2" fill="none" />
            <path d="M45,55 L40,75 L75,80 L80,70" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2,2" fill="none" />
            <path d="M45,55 L55,45 L70,28 L85,15" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2,2" fill="none" />
            <path d="M55,45 L85,55" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2,2" fill="none" />

            {/* Nodes */}
            {PROVINCES.map((p) => (
              <g 
                key={p.id} 
                className="cursor-pointer group"
                onClick={() => handleProvinceClick(p)}
              >
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r={selectedProvince?.id === p.id ? 4 : 2} 
                  fill={p.color} 
                  className={`transition-all duration-300 ${selectedProvince?.id === p.id ? 'animate-pulse' : ''}`}
                />
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r={selectedProvince?.id === p.id ? 8 : 4} 
                  stroke={p.color}
                  strokeWidth="0.5"
                  fill="transparent"
                  className="opacity-50 group-hover:scale-150 transition-transform origin-center"
                />
                <text 
                  x={p.x} 
                  y={p.y + 5} 
                  textAnchor="middle" 
                  className={`text-[3px] font-bold fill-slate-600 transition-all ${selectedProvince?.id === p.id ? 'fill-blue-600 text-[4px]' : ''}`}
                >
                  {p.name}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Results Panel */}
        <div className="lg:w-1/2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-y-auto h-full">
          {!selectedProvince ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p>请在左侧地图选择目的地</p>
            </div>
          ) : (
            <div className="animate-fadeIn">
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                <span className="mr-2 text-2xl">🚩</span> 
                {selectedProvince.name} 避雷攻略
              </h3>

              {loading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
                  <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse"></div>
                  <p className="text-sm text-blue-500 mt-4 flex items-center">
                    <svg className="animate-spin w-4 h-4 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    正在咨询 Google Maps...
                  </p>
                </div>
              ) : result ? (
                <div>
                  <div className="prose prose-sm text-slate-600 mb-6">
                    <div dangerouslySetInnerHTML={{ __html: result.text.replace(/\n/g, '<br/>') }} />
                  </div>
                  
                  {result.mapLinks && result.mapLinks.length > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <h4 className="font-bold text-slate-800 mb-3 text-sm">Google Maps 资源 (点击查看)</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {result.mapLinks.map((link, idx) => (
                          <a 
                            key={idx} 
                            href={link.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 group"
                          >
                            <span className="w-8 h-8 bg-white rounded-full flex items-center justify-center mr-3 shadow-sm text-blue-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </span>
                            <span className="text-sm font-medium text-blue-900 group-hover:underline truncate flex-1">
                              {link.title}
                            </span>
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NationalGuide;
