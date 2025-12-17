import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapZone } from '../types';
import { zoneService } from '../services/zoneService';
import * as d3 from 'd3';

type SelectionState = 
  | { type: 'single', data: MapZone }
  | { type: 'cluster', data: MapZone[] }
  | null;

const CLUSTER_THRESHOLD = 8; // Distance percentage threshold for clustering
const CITIES = ['厦门', '三亚', '丽江', '青岛', '长沙', '成都', '西安', '大理'];

const SafetyMap: React.FC = () => {
  const [zones, setZones] = useState<MapZone[]>([]);
  const [activeCity, setActiveCity] = useState('厦门');
  const [searchQuery, setSearchQuery] = useState('');
  const [selection, setSelection] = useState<SelectionState>(null);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newZoneCoords, setNewZoneCoords] = useState<{ x: number, y: number } | null>(null);
  
  // Zoom & Pan Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<HTMLElement, unknown> | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    type: 'RED' as 'RED' | 'GREEN',
    description: '',
  });

  useEffect(() => {
    refreshZones();
  }, []);

  // Initialize D3 Zoom
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;

    const zoom = d3.zoom<HTMLElement, unknown>()
      .scaleExtent([1, 4]) // Min zoom 1x, Max zoom 4x
      .on('zoom', (event) => {
        if (contentRef.current) {
          contentRef.current.style.transform = event.transform.toString();
        }
      });

    zoomBehavior.current = zoom;
    d3.select(containerRef.current).call(zoom);

    // Initial center if needed, or just reset
    resetZoom();

    return () => {
       // Cleanup if needed
    };
  }, [containerRef.current]);

  // Reset zoom when city changes
  useEffect(() => {
    resetZoom();
  }, [activeCity]);

  const resetZoom = () => {
    if (containerRef.current && zoomBehavior.current) {
      d3.select(containerRef.current)
        .transition()
        .duration(750)
        .call(zoomBehavior.current.transform, d3.zoomIdentity);
    }
  };

  const handleZoomIn = () => {
    if (containerRef.current && zoomBehavior.current) {
      d3.select(containerRef.current)
        .transition()
        .duration(300)
        .call(zoomBehavior.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (containerRef.current && zoomBehavior.current) {
      d3.select(containerRef.current)
        .transition()
        .duration(300)
        .call(zoomBehavior.current.scaleBy, 1 / 1.3);
    }
  };

  const refreshZones = () => {
    setZones(zoneService.getActiveZones());
  };

  // Filter Zones based on search query AND active city, supporting Route Queries
  const { filteredZones, routeOverlay } = useMemo(() => {
    const activeZones = zones.filter(z => z.city === activeCity);
    
    if (!searchQuery.trim()) {
        return { filteredZones: activeZones, routeOverlay: null };
    }

    const query = searchQuery.toLowerCase().trim();
    // Route matching: "A到B" or "从A到B" or "A->B"
    const routeRegex = /(?:从|^)(.+?)(?:到|去|至|->)(.+)/;
    const match = query.match(routeRegex);

    if (match) {
        const startTerm = match[1].trim();
        const endTerm = match[2].trim();
        
        if (startTerm && endTerm) {
             const startMatches = activeZones.filter(z => z.name.toLowerCase().includes(startTerm));
             const endMatches = activeZones.filter(z => z.name.toLowerCase().includes(endTerm));
             
             // Combined list for display
             const combined = [...new Set([...startMatches, ...endMatches])];
             
             let overlay = null;
             // Only draw line if we found potential start AND end points
             if (startMatches.length > 0 && endMatches.length > 0) {
                 const getAvg = (zs: MapZone[]) => ({
                    x: zs.reduce((s, z) => s + z.coordinates.x, 0) / zs.length,
                    y: zs.reduce((s, z) => s + z.coordinates.y, 0) / zs.length
                 });
                 overlay = { start: getAvg(startMatches), end: getAvg(endMatches) };
             }
             
             return { filteredZones: combined, routeOverlay: overlay };
        }
    }

    // Standard Search
    return { 
        filteredZones: activeZones.filter(zone => zone.name.toLowerCase().includes(query)),
        routeOverlay: null
    };
  }, [zones, searchQuery, activeCity]);

  // Clustering Logic using filteredZones
  const mapItems = useMemo(() => {
    const items: Array<{ kind: 'single', zone: MapZone } | { kind: 'cluster', zones: MapZone[], x: number, y: number, id: string }> = [];
    const processingZones = [...filteredZones]; // Copy to process

    while (processingZones.length > 0) {
      const current = processingZones.pop()!;
      const clusterMembers = [current];
      
      // Find neighbors
      for (let i = processingZones.length - 1; i >= 0; i--) {
        const other = processingZones[i];
        const dist = Math.sqrt(
          Math.pow(current.coordinates.x - other.coordinates.x, 2) + 
          Math.pow(current.coordinates.y - other.coordinates.y, 2)
        );

        if (dist < CLUSTER_THRESHOLD) {
          clusterMembers.push(other);
          processingZones.splice(i, 1);
        }
      }

      if (clusterMembers.length === 1) {
        items.push({ kind: 'single', zone: clusterMembers[0] });
      } else {
        // Calculate center
        const avgX = clusterMembers.reduce((sum, z) => sum + z.coordinates.x, 0) / clusterMembers.length;
        const avgY = clusterMembers.reduce((sum, z) => sum + z.coordinates.y, 0) / clusterMembers.length;
        items.push({
          kind: 'cluster',
          zones: clusterMembers,
          x: avgX,
          y: avgY,
          id: `cluster-${current.id}-${clusterMembers.length}`
        });
      }
    }
    return items;
  }, [filteredZones]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingMode || !contentRef.current) return;

    // Need to calculate coordinates relative to the TRANSFORMED content
    const rect = contentRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Ensure within bounds
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      setNewZoneCoords({ x, y });
      setFormData(prev => ({ ...prev, city: activeCity }));
      setShowModal(true);
      setIsAddingMode(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newZoneCoords) {
      zoneService.submitZone({
        name: formData.name,
        city: formData.city,
        type: formData.type,
        description: formData.description,
        coordinates: newZoneCoords
      });
      setShowModal(false);
      setFormData({ name: '', city: activeCity, type: 'RED', description: '' });
      alert("感谢爆料！您的信息审核通过后将展示在地图上。");
    }
  };

  const openGoogleMaps = (locationName: string) => {
    const query = encodeURIComponent(`${activeCity} ${locationName}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
      {/* Header & Controls */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-1">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              {activeCity}避雷地图
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] rounded border border-blue-200">
                可缩放
              </span>
            </h2>
            <p className="text-sm text-slate-500">
              {isAddingMode ? '请点击地图选择位置' : '绿色=放心店，红色=高危区'}
            </p>
          </div>
          <button
            onClick={() => {
              setIsAddingMode(!isAddingMode);
              setSelection(null);
            }}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm flex items-center ${
              isAddingMode 
                ? 'bg-slate-800 text-white animate-pulse' 
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {isAddingMode ? '取消' : '+ 我要爆料'}
          </button>
        </div>

        {/* City Selector */}
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          {CITIES.map(city => (
            <button
              key={city}
              onClick={() => { setActiveCity(city); setSelection(null); setSearchQuery(''); }}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeCity === city
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {city}
            </button>
          ))}
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text"
            placeholder={`搜索${activeCity}地点或路线 (如: 机场到曾厝垵)...`}
            className="w-full py-2 pl-10 pr-4 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelection(null); 
            }}
          />
        </div>
      </div>

      {/* Map Area */}
      <div 
        ref={containerRef}
        className={`relative flex-grow bg-slate-100 overflow-hidden h-96 sm:h-[500px] ${isAddingMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      >
        {/* Zoom Controls (Floating) */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          <button 
            onClick={handleZoomIn}
            className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-700 hover:bg-slate-50 border border-slate-200"
            title="放大"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </button>
          <button 
            onClick={handleZoomOut}
            className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-700 hover:bg-slate-50 border border-slate-200"
            title="缩小"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
          </button>
          <button 
            onClick={resetZoom}
            className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-700 hover:bg-slate-50 border border-slate-200"
            title="重置"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>

        {/* Legend (Floating) */}
        <div className="absolute bottom-4 left-4 z-20 bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm text-xs space-y-1 pointer-events-none border border-slate-100">
          <div className="flex items-center"><div className="w-3 h-3 bg-emerald-500 rounded-full mr-2 shadow-sm border border-white"></div> 放心区</div>
          <div className="flex items-center"><div className="w-3 h-3 bg-red-500 rounded-full mr-2 shadow-sm border border-white"></div> 踩雷区</div>
          <div className="flex items-center"><div className="w-3 h-3 bg-orange-600 rounded-full mr-2 flex items-center justify-center text-[6px] text-white shadow-sm border border-white">N</div> 聚合区域</div>
        </div>

        {/* Scalable Content Wrapper */}
        <div 
          ref={contentRef} 
          className="w-full h-full origin-top-left relative"
          onClick={handleMapClick}
        >
          {/* Abstract Generic City Map Background */}
          <svg className="w-full h-full pointer-events-none absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
              </pattern>
              <marker id="routeArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L6,3 z" fill="#3b82f6" />
              </marker>
            </defs>
            <rect width="100" height="100" fill="#f8fafc" />
            <rect width="100" height="100" fill="url(#grid)" />
            
            {/* Abstract Roads */}
            <path d="M0,50 Q25,45 50,50 T100,50" stroke="#cbd5e1" strokeWidth="2" fill="none" />
            <path d="M50,0 Q55,25 50,50 T50,100" stroke="#cbd5e1" strokeWidth="2" fill="none" />
            <path d="M20,0 L80,100" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,2" fill="none" />
            <path d="M80,0 L20,100" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,2" fill="none" />
            
            {/* Abstract Water/Park */}
            <path d="M70,70 Q85,60 100,70 V100 H70 Z" fill="#e0f2fe" />
            <path d="M0,0 H30 Q20,20 0,30 Z" fill="#ecfccb" />
            
            {/* Route Overlay Line */}
            {routeOverlay && (
                <>
                <line 
                    x1={routeOverlay.start.x} y1={routeOverlay.start.y}
                    x2={routeOverlay.end.x} y2={routeOverlay.end.y}
                    stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="3,2"
                    markerEnd="url(#routeArrow)"
                    className="animate-pulse"
                />
                </>
            )}
          </svg>

          {/* Render Map Items (Clusters and Single Zones) */}
          {mapItems.map((item) => {
            if (item.kind === 'single') {
              const zone = item.zone;
              const isSelected = selection?.type === 'single' && selection.data.id === zone.id;
              
              return (
                <button
                  key={zone.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelection({ type: 'single', data: zone });
                  }}
                  className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg transform transition-transform hover:scale-125 focus:outline-none flex items-center justify-center ${
                    zone.type === 'RED' ? 'bg-red-500' : 'bg-emerald-500'
                  } ${isSelected ? 'ring-2 ring-slate-800 scale-110 z-10' : 'z-0'}`}
                  style={{ left: `${zone.coordinates.x}%`, top: `${zone.coordinates.y}%` }}
                  aria-label={zone.name}
                >
                  {zone.isUserGenerated && <span className="text-[8px] text-white">★</span>}
                  {isSelected && (
                     <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-slate-800"></div>
                  )}
                </button>
              );
            } else {
              // Render Cluster
              const isSelected = selection?.type === 'cluster' && selection.data === item.zones;
              const hasRed = item.zones.some(z => z.type === 'RED');
              const count = item.zones.length;

              return (
                <button
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelection({ type: 'cluster', data: item.zones });
                  }}
                  className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white shadow-lg transform transition-transform hover:scale-110 focus:outline-none flex items-center justify-center text-white font-bold text-xs ${
                    hasRed ? 'bg-orange-600' : 'bg-emerald-600'
                  } ${isSelected ? 'ring-2 ring-slate-800 scale-105 z-10' : 'z-0'}`}
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                >
                  {count}
                </button>
              );
            }
          })}
        </div>
      </div>

      {/* Info Panel */}
      {selection && (
        <div className="p-6 bg-white border-t border-slate-100 relative max-h-60 overflow-y-auto z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
           <button 
            onClick={() => setSelection(null)}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 z-10 bg-slate-50 rounded-full p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          
          {selection.type === 'single' ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-slate-900">{selection.data.name}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selection.data.type === 'RED' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {selection.data.type === 'RED' ? '高危' : '推荐'}
                </span>
              </div>
              <p className="text-slate-600 mb-4">{selection.data.description}</p>
              
              <div className="flex gap-2">
                 <button 
                   onClick={() => openGoogleMaps(selection.data.name)}
                   className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors text-sm"
                 >
                   <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                   在 Google 地图中查看
                 </button>
              </div>

              {selection.data.isUserGenerated && (
                <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wide text-right">来自社区贡献</p>
              )}
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-slate-900 mb-3">该区域包含 {selection.data.length} 个地点</h3>
              <div className="space-y-3">
                {selection.data.map((zone) => (
                  <div key={zone.id} className="flex items-start p-2 bg-slate-50 rounded border border-slate-100 cursor-pointer hover:bg-slate-100 group"
                       onClick={() => setSelection({ type: 'single', data: zone })}>
                    <span className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full mr-2 ${zone.type === 'RED' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                    <div className="flex-grow">
                      <div className="font-bold text-sm text-slate-800 flex items-center justify-between">
                        <span>
                          {zone.name}
                          {zone.isUserGenerated && <span className="text-[10px] text-slate-400 ml-1">★</span>}
                        </span>
                        <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">查看 &rarr;</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{zone.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Submission Modal */}
      {showModal && (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-800 mb-4">爆料避雷点 ({activeCity})</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">地点名称</label>
                <input 
                  required
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="例如：xx海鲜大排档"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">所属城市</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})}
                >
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">判定</label>
                <div className="flex space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="RED" 
                      checked={formData.type === 'RED'}
                      onChange={() => setFormData({...formData, type: 'RED'})}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">红区 (踩雷)</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="GREEN" 
                      checked={formData.type === 'GREEN'}
                      onChange={() => setFormData({...formData, type: 'GREEN'})}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">绿区 (推荐)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">详细描述</label>
                <textarea 
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24"
                  placeholder="为什么推荐或避雷？请详细描述经历..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-700 transition shadow-md"
                >
                  提交爆料
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafetyMap;