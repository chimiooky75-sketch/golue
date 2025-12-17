import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateRoutePlan } from '../services/geminiService';
import { RoutePlan, RouteNode, RouteEdge } from '../types';
import * as d3 from 'd3';

// Helper: Topologically sort nodes based on edges to ensure visual flow
const reorderNodes = (originalNodes: RouteNode[], edges: RouteEdge[]): RouteNode[] => {
  const nodeById = new Map(originalNodes.map(n => [n.id, n]));
  const adjacency = new Map<number, number[]>();
  const inDegree = new Map<number, number>();
  
  // Initialize in-degrees
  originalNodes.forEach(n => inDegree.set(n.id, 0));
  
  // Build Graph
  edges.forEach(e => {
      if (!adjacency.has(e.from)) adjacency.set(e.from, []);
      adjacency.get(e.from)?.push(e.to);
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  });

  const sortedNodes: RouteNode[] = [];
  const visited = new Set<number>();
  const queue: number[] = [];

  // Find start nodes (roots)
  originalNodes.forEach(n => {
      if ((inDegree.get(n.id) || 0) === 0) {
          queue.push(n.id);
      }
  });

  // Kahn's Algorithm with fallback
  while (sortedNodes.length < originalNodes.length) {
      if (queue.length === 0) {
          const unvisited = originalNodes.find(n => !visited.has(n.id));
          if (unvisited) {
              queue.push(unvisited.id);
          } else {
              break; 
          }
      }

      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      const node = nodeById.get(currentId);
      if (node) sortedNodes.push(node);

      const neighbors = adjacency.get(currentId) || [];
      neighbors.forEach(neighborId => {
          const d = (inDegree.get(neighborId) || 0) - 1;
          inDegree.set(neighborId, d);
          if (d === 0) {
              queue.push(neighborId);
          }
      });
  }

  return sortedNodes;
};

// --- Time Calculation Helpers ---
const parseDurationToMinutes = (str: string | undefined): number => {
    if (!str) return 0;
    let minutes = 0;
    // Match "1.5小时" or "1小时30分" or "40分钟"
    const hourMatch = str.match(/(\d+(\.\d+)?)小时/);
    const minMatch = str.match(/(\d+)分/);
    
    if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;
    if (minMatch) minutes += parseInt(minMatch[1]);
    
    // Fallback if just number provided (assume minutes if > 10, else hours? simplified to 0)
    if (minutes === 0 && str.match(/^\d+$/)) minutes = parseInt(str);
    
    return minutes;
};

const formatTime = (minutesFromMidnight: number): string => {
    const h = Math.floor(minutesFromMidnight / 60) % 24;
    const m = Math.floor(minutesFromMidnight % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const SmartRoute: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ node: RouteNode, x: number, y: number } | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(true); // Toggle between Input and List view
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Store layout nodes to calculate highlighting positions
  const [layoutNodes, setLayoutNodes] = useState<(RouteNode & { x: number, y: number })[]>([]);

  // --- Calculate Timeline ---
  const nodeTimeline = useMemo(() => {
    if (!routePlan) return new Map<number, { arrival: string, departure: string }>();
    
    const map = new Map<number, { arrival: string, departure: string }>();
    let currentMinutes = 9 * 60; // Start at 09:00 AM

    const sortedNodes = reorderNodes(routePlan.nodes, routePlan.edges);

    sortedNodes.forEach((node, i) => {
        let travelTime = 0;
        if (i > 0) {
            const prevNode = sortedNodes[i-1];
            const edge = routePlan.edges.find(e => e.from === prevNode.id && e.to === node.id);
            if (edge) travelTime = parseDurationToMinutes(edge.duration);
            else travelTime = 15; // default travel time gap if no direct edge found
        }
        
        currentMinutes += travelTime;
        const arrival = formatTime(currentMinutes);
        
        const stayDuration = parseDurationToMinutes(node.estimatedStay || "30分钟"); // default stay
        currentMinutes += stayDuration;
        const departure = formatTime(currentMinutes);

        map.set(node.id, { arrival, departure });
    });

    return map;
  }, [routePlan]);

  // --- Calculate Route Stats ---
  const routeStats = useMemo(() => {
    if (!routePlan || nodeTimeline.size === 0) return null;
    
    // Sort nodes to be sure about start/end
    const sortedNodes = reorderNodes(routePlan.nodes, routePlan.edges);
    if (sortedNodes.length === 0) return null;

    const firstNode = sortedNodes[0];
    const lastNode = sortedNodes[sortedNodes.length - 1];

    const start = nodeTimeline.get(firstNode.id)?.arrival || "09:00";
    const end = nodeTimeline.get(lastNode.id)?.departure || "18:00";
    
    const getMinutes = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };
    
    const durationMins = getMinutes(end) - getMinutes(start);
    const h = Math.floor(durationMins / 60);
    const m = durationMins % 60;
    
    return {
        start,
        end,
        duration: `${h}小时${m > 0 ? m + '分' : ''}`,
        count: routePlan.nodes.length
    };
  }, [routePlan, nodeTimeline]);

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setRoutePlan(null);
    setHoveredNode(null);
    setHighlightedId(null);
    try {
      const plan = await generateRoutePlan(inputText);
      setRoutePlan(plan);
      setIsEditing(false); // Switch to details view
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setErrorMsg(`生成失败: ${msg}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    setInputText("第一天先去南普陀寺烧香，然后从那里走到厦大白城沙滩拍照。中午去沙坡尾吃个汉堡，下午逛逛猫街。晚上去中山路步行街吃小吃。");
  };

  // --- Export Functions ---
  const handleDownloadJSON = () => {
    if (!routePlan) return;
    const jsonString = JSON.stringify(routePlan, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `route-plan-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportImage = () => {
    if (!svgRef.current || !containerRef.current) return;
    
    const { width, height } = containerRef.current.getBoundingClientRect();
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgRef.current);

    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<?xml version="1.0" standalone="no"?>\r\n' + source);
    
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(scale, scale);
            ctx.fillStyle = "#f8fafc"; 
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            const a = document.createElement('a');
            a.download = `route-map-${Date.now()}.png`;
            a.href = canvas.toDataURL('image/png');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };
  };

  // Zoom Controls
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehavior.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehavior.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehavior.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehavior.current.scaleBy, 0.8);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehavior.current && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth || 800;
      const initialScale = Math.min(containerWidth / 900, 0.8);
      const initialX = (containerWidth - 800 * initialScale) / 2;
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomBehavior.current.transform, d3.zoomIdentity.translate(initialX, 50).scale(initialScale));
    }
  };

  // --- Visualization Effect ---
  useEffect(() => {
    if (!routePlan || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const containerWidth = containerRef.current.clientWidth;
    const contentGroup = svg.append("g").attr("class", "content-group");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        contentGroup.attr("transform", event.transform);
        setHoveredNode(null); 
      });

    zoomBehavior.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);

    // Markers
    contentGroup.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8");

    // Layout
    const LAYOUT_WIDTH = 800;
    const COLUMN_LEFT = LAYOUT_WIDTH * 0.25;
    const COLUMN_RIGHT = LAYOUT_WIDTH * 0.75;
    const ROW_HEIGHT = 160; 
    const PADDING_TOP = 80;

    const orderedNodes = reorderNodes(routePlan.nodes, routePlan.edges);

    // Calculate positions
    const computedNodes = orderedNodes.map((node, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const isEvenRow = row % 2 === 0;
      const isLeft = isEvenRow ? (col === 0) : (col === 1);
      const x = isLeft ? COLUMN_LEFT : COLUMN_RIGHT;
      const y = PADDING_TOP + i * ROW_HEIGHT;
      return { ...node, x, y, isStart: i === 0, isEnd: i === orderedNodes.length - 1 };
    });
    
    setLayoutNodes(computedNodes); // Save for highlighting logic

    // Draw Edges
    routePlan.edges.forEach((edge, i) => {
      const source = computedNodes.find(n => n.id === edge.from);
      const target = computedNodes.find(n => n.id === edge.to);

      if (source && target) {
        const lineGenerator = d3.line<{x: number, y: number}>()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveBasis);

        const midY = (source.y + target.y) / 2;
        const pathData = lineGenerator([
            source,
            { x: source.x, y: midY },
            { x: target.x, y: midY },
            target
        ]);

        let edgeColor = "#3b82f6";
        let edgeWidth = 4;
        let edgeDash = "0";
        let edgeOpacity = 0.8;

        switch (edge.transportMode) {
          case 'SUBWAY': edgeColor = "#8b5cf6"; edgeWidth = 6; edgeOpacity = 1.0; break;
          case 'WALK': edgeColor = "#64748b"; edgeWidth = 3; edgeDash = "6,6"; edgeOpacity = 0.7; break;
          case 'BUS': edgeColor = "#059669"; edgeWidth = 4; break;
        }

        const path = contentGroup.append("path")
           .attr("d", pathData || "")
           .attr("fill", "none")
           .attr("stroke", edgeColor)
           .attr("stroke-width", edgeWidth)
           .attr("stroke-dasharray", edgeDash)
           .attr("opacity", edgeOpacity)
           .attr("class", "route-path")
           .attr("data-from", edge.from) // Add data attributes for selection
           .attr("data-to", edge.to)
           .attr("data-original-stroke", edgeColor)
           .attr("data-original-width", edgeWidth)
           .attr("data-original-opacity", edgeOpacity);

        const totalLength = path.node()?.getTotalLength() || 0;

        path.attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition().duration(1000).delay(i * 500)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .on("end", function() { d3.select(this).attr("stroke-dasharray", edgeDash); });

        // Badge
        const midX = (source.x + target.x) / 2;
        const badgeGroup = contentGroup.append("g")
            .attr("transform", `translate(${midX}, ${midY})`)
            .attr("opacity", 0)
            .attr("class", "edge-badge")
            .attr("data-from", edge.from)
            .attr("data-to", edge.to);
        
        badgeGroup.transition().delay(i * 500 + 500).duration(300).attr("opacity", 1);
        
        const labelText = edge.details ? edge.details : `${edge.duration}`;
        const estimatedWidth = labelText.length * 11 + 40;

        badgeGroup.append("rect")
            .attr("x", -estimatedWidth/2).attr("y", -14)
            .attr("width", estimatedWidth).attr("height", 28).attr("rx", 14)
            .attr("fill", "white").attr("stroke", edgeColor).attr("stroke-width", 2);

        badgeGroup.append("text")
            .attr("text-anchor", "middle").attr("dy", "0.3em")
            .attr("font-size", "11px").attr("fill", edgeColor).attr("font-weight", "bold")
            .text(`${getTransportIcon(edge.transportMode)} ${labelText}`);
      }
    });

    // Draw Nodes
    const nodeGroups = contentGroup.selectAll("g.node")
        .data(computedNodes)
        .enter().append("g")
        .attr("class", "node-group")
        .attr("id", d => `node-${d.id}`) // Add ID for selection
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .attr("cursor", "pointer")
        .on("mouseenter", (event, d) => {
           // Set Highlighted ID for React side
           setHighlightedId(d.id);
           
           const rect = (event.currentTarget as Element).getBoundingClientRect();
           const containerRect = containerRef.current?.getBoundingClientRect();
           if (containerRect) {
               const x = rect.left - containerRect.left + rect.width / 2;
               const y = rect.top - containerRect.top + rect.height / 2;
               setHoveredNode({ node: d, x, y });
           }
        })
        .on("mouseleave", () => {
           setHighlightedId(null);
           setHoveredNode(null);
        });

    nodeGroups.attr("opacity", 0)
        .transition().delay((d, i) => i * 500).duration(500)
        .attr("opacity", 1);

    nodeGroups.append("circle")
        .attr("r", 24)
        .attr("fill", d => getTypeColor(d.type))
        .attr("stroke", "white").attr("stroke-width", 4)
        .attr("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.15))")
        .attr("class", "node-circle transition-all duration-300"); // Add class for easy selection

    nodeGroups.append("text")
        .attr("text-anchor", "middle").attr("dy", "0.35em")
        .attr("fill", "white").attr("font-weight", "bold").attr("font-size", "16px")
        .text((d, i) => i + 1);

    // Labels
    const labelGroup = nodeGroups.append("g").attr("transform", "translate(0, 40)");
    labelGroup.append("text")
        .attr("text-anchor", "middle").attr("font-weight", "800")
        .attr("font-size", "15px").attr("fill", "#1e293b")
        .text(d => `${getTypeIcon(d.type)} ${d.name}`);
    
    // Initial Zoom
    const initialScale = Math.min(containerWidth / (LAYOUT_WIDTH + 100), 0.8);
    const initialX = (containerWidth - LAYOUT_WIDTH * initialScale) / 2;
    svg.call(zoom.transform, d3.zoomIdentity.translate(initialX, 50).scale(initialScale));

  }, [routePlan]);


  // --- Highlight Effect (Bidirectional & Edges) ---
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // 1. Reset/Highlight Nodes
    svg.selectAll(".node-circle")
       .transition().duration(200)
       .attr("r", (d: any) => d.id === highlightedId ? 32 : 24)
       .attr("stroke-width", (d: any) => d.id === highlightedId ? 6 : 4)
       .attr("stroke", (d: any) => d.id === highlightedId ? "#fcd34d" : "white")
       .attr("opacity", (d: any) => {
         if (highlightedId === null) return 1;
         return d.id === highlightedId ? 1 : 0.5; // Dim others
       });

    // 2. Reset/Highlight Edges
    svg.selectAll(".route-path")
       .transition().duration(200)
       .attr("stroke", function() {
          const from = parseInt(d3.select(this).attr("data-from"));
          const to = parseInt(d3.select(this).attr("data-to"));
          if (highlightedId !== null && (from === highlightedId || to === highlightedId)) {
             return "#f59e0b"; // Highlight color (Amber)
          }
          if (highlightedId !== null) return "#cbd5e1"; // Dimmed color
          return d3.select(this).attr("data-original-stroke");
       })
       .attr("stroke-width", function() {
          const from = parseInt(d3.select(this).attr("data-from"));
          const to = parseInt(d3.select(this).attr("data-to"));
          if (highlightedId !== null && (from === highlightedId || to === highlightedId)) {
             return 6;
          }
          return d3.select(this).attr("data-original-width");
       })
       .attr("opacity", function() {
          const from = parseInt(d3.select(this).attr("data-from"));
          const to = parseInt(d3.select(this).attr("data-to"));
          if (highlightedId !== null) {
              return (from === highlightedId || to === highlightedId) ? 1 : 0.2;
          }
          return d3.select(this).attr("data-original-opacity");
       });
       
     // 3. Highlight Badges associated with edges
     svg.selectAll(".edge-badge")
        .transition().duration(200)
        .attr("opacity", function() {
           const from = parseInt(d3.select(this).attr("data-from"));
           const to = parseInt(d3.select(this).attr("data-to"));
           if (highlightedId !== null) {
               return (from === highlightedId || to === highlightedId) ? 1 : 0.2;
           }
           return 1;
        });

  }, [highlightedId]);


  // --- Helper Functions ---
  const getTransportIcon = (mode: string) => {
    switch(mode) {
        case 'WALK': return '🚶'; case 'TAXI': return '🚕'; case 'BUS': return '🚌'; case 'SUBWAY': return '🚇'; default: return '🚗';
    }
  };
  const getTypeIcon = (type: string) => {
    switch(type) {
        case 'FOOD': return '🍜'; case 'SCENERY': return '🏔️'; case 'HOTEL': return '🏨'; default: return '🚩';
    }
  };
  const getTypeColor = (type: string) => {
    switch(type) {
        case 'FOOD': return '#f59e0b'; case 'SCENERY': return '#10b981'; case 'HOTEL': return '#6366f1'; default: return '#64748b';
    }
  };
  const getTypeLabel = (type: string) => {
    switch(type) {
        case 'FOOD': return '美食'; case 'SCENERY': return '景点'; case 'HOTEL': return '住宿'; default: return '其他';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* LEFT PANEL: Input OR Details List */}
      <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
        
        {/* State 1: Input Form */}
        {isEditing ? (
          <div className="p-6 flex flex-col h-full">
            <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
              <span className="bg-red-500 text-white p-1 rounded-md mr-2 text-xs">红薯</span>
              攻略变地图
            </h3>
            <p className="text-sm text-slate-500 mb-4">粘贴小红书/笔记攻略，AI 自动提取景点与美食，生成含地铁导航的顺路地图。</p>
            
            <textarea
              className="w-full flex-grow p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-slate-50 text-sm mb-4 leading-relaxed"
              placeholder="例如：第一天去南普陀寺吃素斋，然后步行去厦大白城看海，中午去沙坡尾吃汉堡..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium animate-fadeIn">
                    ⚠️ {errorMsg}
                </div>
            )}
            
            <div className="flex gap-2">
                <button
                    onClick={handleDemo}
                    className="px-4 py-3 border border-slate-300 rounded-lg text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                    试一试Demo
                </button>
                <button
                onClick={handleGenerate}
                disabled={loading || !inputText}
                className={`flex-grow py-3 rounded-lg font-bold text-white transition-all shadow-md flex items-center justify-center ${
                    loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5'
                }`}
                >
                {loading ? (
                    <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    AI 规划中...
                    </>
                ) : '✨ 生成可视化路线'}
                </button>
            </div>
          </div>
        ) : (
          /* State 2: Itinerary Details List (Timeline View) */
          <div className="flex flex-col h-full bg-slate-50">
             {/* Header */}
             <div className="p-4 bg-white border-b border-slate-200 shadow-sm z-10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center">
                        <span className="text-xl mr-2">🗓️</span> 行程时间轴
                    </h3>
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="text-xs text-slate-500 hover:text-blue-600 font-medium px-3 py-1.5 rounded-full border border-slate-200 hover:border-blue-300 transition-colors"
                    >
                       ✏️ 修改需求
                    </button>
                </div>
                
                {/* Stats Summary Card */}
                {routeStats && (
                    <div className="bg-blue-50 rounded-xl p-3 flex justify-between items-center text-sm border border-blue-100 shadow-sm">
                        <div className="text-center px-2">
                            <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">出发</div>
                            <div className="font-black text-slate-700 text-base">{routeStats.start}</div>
                        </div>
                         <div className="h-8 w-px bg-blue-200/50"></div>
                        <div className="text-center px-2">
                            <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">总时长</div>
                            <div className="font-black text-slate-700 text-base">{routeStats.duration}</div>
                        </div>
                        <div className="h-8 w-px bg-blue-200/50"></div>
                        <div className="text-center px-2">
                            <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">预计结束</div>
                            <div className="font-black text-slate-700 text-base">{routeStats.end}</div>
                        </div>
                    </div>
                )}
             </div>
             
             {/* Timeline List */}
             <div className="flex-grow overflow-y-auto p-4 space-y-0">
               {routePlan?.nodes.map((node, index) => {
                 const timeInfo = nodeTimeline.get(node.id);
                 const isLast = index === routePlan.nodes.length - 1;
                 const nextEdge = !isLast ? routePlan.edges.find(e => e.from === node.id && e.to === routePlan.nodes[index + 1].id) : null;

                 return (
                 <div key={node.id} className="relative pl-4 pb-0 group">
                   {/* Vertical Line Connection */}
                   {!isLast && (
                       <div className="absolute left-[19px] top-8 bottom-[-8px] w-0.5 bg-slate-200 group-hover:bg-blue-200 transition-colors"></div>
                   )}
                   
                   <div className="flex items-start z-10 relative">
                        {/* Node Number Dot */}
                        <div 
                            className={`w-8 h-8 rounded-full border-4 border-white shadow-sm flex-shrink-0 flex items-center justify-center text-xs font-bold text-white z-10 transition-all ${
                                highlightedId === node.id ? 'scale-110 ring-2 ring-blue-400' : ''
                            }`}
                            style={{ backgroundColor: getTypeColor(node.type) }}
                        >
                            {index + 1}
                        </div>

                        {/* Content Card */}
                        <div className="ml-3 flex-grow pb-6">
                            <div 
                                onMouseEnter={() => setHighlightedId(node.id)}
                                onMouseLeave={() => setHighlightedId(null)}
                                className={`bg-white rounded-xl border p-3 transition-all cursor-pointer relative ${
                                    highlightedId === node.id 
                                    ? 'border-blue-400 shadow-md translate-x-1' 
                                    : 'border-slate-200 hover:border-blue-200 hover:shadow-sm'
                                }`}
                            >
                                {/* Time Badge & Type */}
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-50">
                                    <div className="flex items-center text-xs font-mono font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                        {timeInfo?.arrival} <span className="mx-1 text-slate-300">→</span> {timeInfo?.departure}
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                            node.type === 'FOOD' ? 'bg-amber-50 text-amber-600' : 
                                            node.type === 'SCENERY' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'
                                    }`}>
                                        {getTypeLabel(node.type)}
                                    </span>
                                </div>

                                <h4 className="font-bold text-slate-800 text-sm mb-1">{node.name}</h4>
                                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-2">{node.description}</p>
                                
                                {node.estimatedStay && (
                                    <div className="text-[10px] text-emerald-600 flex items-center font-medium bg-emerald-50/50 rounded px-1.5 py-0.5 inline-block">
                                        <span className="mr-1">🕒</span>
                                        建议游玩 {node.estimatedStay}
                                    </div>
                                )}
                            </div>

                            {/* Transport Info to Next Node */}
                            {!isLast && nextEdge && (
                                <div className="mt-2 pl-1 flex items-center text-xs text-slate-400">
                                    <span className="bg-slate-100 px-2 py-1 rounded-full border border-slate-200 flex items-center group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                                        <span className="mr-1">{getTransportIcon(nextEdge.transportMode)}</span>
                                        <span className="font-medium">{nextEdge.duration}</span>
                                        {nextEdge.details && <span className="ml-1 opacity-70 border-l border-slate-300 pl-1"> {nextEdge.details}</span>}
                                    </span>
                                </div>
                            )}
                        </div>
                   </div>
                 </div>
                 );
               })}
               
               <div className="pl-12 pt-2 text-slate-400 text-xs italic flex items-center opacity-60">
                  <span className="mr-2 text-lg">😴</span> 行程结束，好好休息
               </div>
             </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Visualization */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative flex flex-col h-full">
        {!routePlan ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                <svg className="w-24 h-24 mb-6 opacity-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                <p className="font-medium text-lg">等待生成路线...</p>
                <p className="text-sm opacity-60 mt-1">请在左侧输入攻略文本</p>
            </div>
        ) : (
            <div ref={containerRef} className="flex-grow overflow-hidden relative bg-slate-50/50">
                 {/* Top Bar */}
                 <div className="absolute top-0 left-0 right-0 bg-white/90 backdrop-blur-md p-4 border-b border-slate-200 z-10 flex justify-between items-center shadow-sm">
                    <div>
                      <h2 className="font-black text-xl text-slate-800 tracking-tight">{routePlan.title}</h2>
                      <div className="text-[10px] text-slate-500 flex gap-3 mt-1 font-medium">
                        <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            🕒 智能时长估算
                        </span>
                        <span className="flex items-center text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                            🚇 地铁优先规划
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions and Stats */}
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                           <button 
                             onClick={handleDownloadJSON}
                             title="保存路线数据 (JSON)"
                             className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition-colors"
                           >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                           </button>
                           <button 
                             onClick={handleExportImage}
                             title="导出可视化图片 (PNG)"
                             className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition-colors"
                           >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                           </button>
                        </div>
                        <div className="flex flex-col items-end border-l border-slate-200 pl-4 h-8 justify-center">
                            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-0.5 rounded-full font-bold mb-0.5">{routePlan.nodes.length} 个地点</span>
                            <span className="text-[9px] text-slate-400">试试点击左侧列表项联动</span>
                        </div>
                    </div>
                 </div>
                 
                 {/* Zoom Controls */}
                 <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
                    <button onClick={handleZoomIn} className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-600 hover:text-blue-600 border border-slate-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <button onClick={handleZoomOut} className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-600 hover:text-blue-600 border border-slate-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <button onClick={handleResetZoom} className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-600 hover:text-blue-600 border border-slate-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                 </div>

                 {/* D3 SVG Container */}
                 <div className="w-full h-full cursor-grab active:cursor-grabbing">
                   <svg ref={svgRef} className="block w-full h-full"></svg>
                   
                   {/* Tooltip Overlay (Map Side) */}
                   {hoveredNode && (
                     <div 
                        className="absolute bg-white rounded-xl shadow-xl border border-slate-100 p-4 w-64 z-30 pointer-events-none animate-fadeIn"
                        style={{ 
                            left: hoveredNode.x + 40, 
                            top: hoveredNode.y - 40,
                        }}
                     >
                        <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
                             <span className={`text-[10px] px-2 py-0.5 rounded font-bold text-white ${
                                 hoveredNode.node.type === 'FOOD' ? 'bg-amber-500' : 
                                 hoveredNode.node.type === 'SCENERY' ? 'bg-emerald-500' : 'bg-slate-500'
                             }`}>
                                 {getTypeIcon(hoveredNode.node.type)} {getTypeLabel(hoveredNode.node.type)}
                             </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-lg mb-1">{hoveredNode.node.name}</h4>
                        
                        {/* Time Estimates in Tooltip */}
                        {nodeTimeline.get(hoveredNode.node.id) && (
                            <div className="flex justify-between items-center text-xs text-slate-500 bg-slate-50 p-2 rounded mb-2 font-mono border border-slate-100">
                                <div>
                                    <span className="block text-[10px] text-slate-400 uppercase">Arrive</span>
                                    <span className="font-bold text-slate-700">{nodeTimeline.get(hoveredNode.node.id)?.arrival}</span>
                                </div>
                                <div className="text-slate-300">→</div>
                                <div>
                                    <span className="block text-[10px] text-slate-400 uppercase">Depart</span>
                                    <span className="font-bold text-slate-700">{nodeTimeline.get(hoveredNode.node.id)?.departure}</span>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-3">{hoveredNode.node.description}</p>
                        
                        {hoveredNode.node.estimatedStay && (
                            <div className="flex items-center text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded">
                                <span className="mr-1">建议游玩:</span> {hoveredNode.node.estimatedStay}
                            </div>
                        )}
                        <div className="absolute top-12 -left-2 w-4 h-4 bg-white border-l border-b border-slate-100 transform rotate-45"></div>
                     </div>
                   )}
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SmartRoute;