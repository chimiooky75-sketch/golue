import React, { useState, useEffect, useRef } from 'react';
import { generateRoutePlan } from '../services/geminiService';
import { RoutePlan, RouteNode, RouteEdge } from '../types';
import * as d3 from 'd3';

// Helper: Topologically sort nodes based on edges to ensure visual flow
// This handles cases where the API returns nodes in random order but edges define a sequence.
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

  // Kahn's Algorithm with fallback for disjoint graphs/cycles
  while (sortedNodes.length < originalNodes.length) {
      // If queue is empty but we haven't visited all nodes, it means there's a cycle or disjoint island.
      // We pick the first unvisited node from original list to restart the traversal.
      if (queue.length === 0) {
          const unvisited = originalNodes.find(n => !visited.has(n.id));
          if (unvisited) {
              queue.push(unvisited.id);
          } else {
              break; // Should not happen
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

const SmartRoute: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ node: RouteNode, x: number, y: number } | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setRoutePlan(null);
    setHoveredNode(null);
    try {
      const plan = await generateRoutePlan(inputText);
      setRoutePlan(plan);
    } catch (e) {
      alert("生成路线失败，请检查网络或文本内容。");
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => {
    if (svgRef.current && zoomBehavior.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehavior.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehavior.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehavior.current.scaleBy, 0.8);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehavior.current && routePlan) {
      const containerWidth = containerRef.current?.clientWidth || 800;
      const initialScale = Math.min(containerWidth / 900, 0.8);
      // Center based on fixed layout width of 800
      const initialX = (containerWidth - 800 * initialScale) / 2;
      
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomBehavior.current.transform, d3.zoomIdentity.translate(initialX, 50).scale(initialScale));
    }
  };

  // Visualization Logic
  useEffect(() => {
    if (!routePlan || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous drawing

    const containerWidth = containerRef.current.clientWidth;
    // const containerHeight = containerRef.current.clientHeight; // Unused for vertical scroll layout

    // --- 1. Setup Zoom & Groups ---
    const contentGroup = svg.append("g").attr("class", "content-group");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        contentGroup.attr("transform", event.transform);
        // Hide tooltip on zoom/pan to prevent detached floating tooltips
        setHoveredNode(null); 
      });

    zoomBehavior.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);

    // --- 2. Layout Calculation ---
    // Define Arrow Marker
    contentGroup.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22) // Position relative to end of line
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8");

    // Layout Constants
    const LAYOUT_WIDTH = 800;
    const COLUMN_LEFT = LAYOUT_WIDTH * 0.25;
    const COLUMN_RIGHT = LAYOUT_WIDTH * 0.75;
    const ROW_HEIGHT = 140; // Balanced vertical spacing
    const PADDING_TOP = 80;

    // Sort Nodes based on connectivity (Topology) rather than array order
    const orderedNodes = reorderNodes(routePlan.nodes, routePlan.edges);

    // Calculate positions (Snake layout)
    const nodes = orderedNodes.map((node, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      
      // Logic for Snake Pattern:
      // Row 0: Left -> Right
      // Row 1: Right -> Left
      // Row 2: Left -> Right
      // ...
      const isEvenRow = row % 2 === 0;
      const isLeft = isEvenRow ? (col === 0) : (col === 1);
      
      const x = isLeft ? COLUMN_LEFT : COLUMN_RIGHT;
      const y = PADDING_TOP + i * ROW_HEIGHT;
      
      return { ...node, x, y, isStart: i === 0, isEnd: i === orderedNodes.length - 1 };
    });

    // --- 3. Draw Edges (Paths) ---
    routePlan.edges.forEach((edge, i) => {
      const source = nodes.find(n => n.id === edge.from);
      const target = nodes.find(n => n.id === edge.to);

      if (source && target) {
        const lineGenerator = d3.line<{x: number, y: number}>()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveBasis);

        const midY = (source.y + target.y) / 2;
        // Control points for S-curve
        const pathData = lineGenerator([
            source,
            { x: source.x, y: midY },
            { x: target.x, y: midY },
            target
        ]);

        // Determine style based on transport mode
        let edgeColor = "#3b82f6"; // Default Blue (Taxi)
        let edgeWidth = 4;
        let edgeDash = "0";
        let edgeOpacity = 0.8;

        switch (edge.transportMode) {
          case 'SUBWAY':
              edgeColor = "#8b5cf6"; // Violet-500
              edgeWidth = 6;
              edgeDash = "0";
              edgeOpacity = 1.0;
              break;
          case 'WALK':
              edgeColor = "#64748b"; // Slate-500
              edgeWidth = 3;
              edgeDash = "6,6";
              edgeOpacity = 0.7;
              break;
          case 'BUS':
              edgeColor = "#059669"; // Emerald-600
              edgeWidth = 4;
              edgeDash = "0";
              break;
          default:
              edgeColor = "#3b82f6";
              edgeWidth = 4;
              edgeDash = "0";
              break;
        }

        // Draw Path
        const path = contentGroup.append("path")
           .attr("d", pathData || "")
           .attr("fill", "none")
           .attr("stroke", edgeColor)
           .attr("stroke-width", edgeWidth)
           .attr("stroke-dasharray", edgeDash) // Set initial style
           .attr("opacity", edgeOpacity)
           .attr("class", "route-path");

        const totalLength = path.node()?.getTotalLength() || 0;

        // Animate Path Drawing
        // We set dasharray to totalLength to simulate drawing, then switch back to edgeDash
        path.attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(1000)
            .delay(i * 500) // Stagger animations
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .on("end", function() {
                // Restore correct dash style (e.g., dotted for Walk) after animation
                d3.select(this).attr("stroke-dasharray", edgeDash);
            });

        // --- Flowing Particle Animation ---
        if (totalLength > 0) {
            const particle = contentGroup.append("circle")
                .attr("r", 4)
                .attr("fill", "white")
                .attr("stroke", edgeColor)
                .attr("stroke-width", 2)
                .attr("filter", "drop-shadow(0 0 2px rgba(0,0,0,0.3))")
                .attr("opacity", 0); // Initially hidden

            const loopAnimation = () => {
                particle.attr("opacity", 1)
                    .transition()
                    .duration(2000) // Travel duration
                    .ease(d3.easeLinear)
                    .attrTween("transform", function() {
                        return function(t) {
                            const p = path.node()!.getPointAtLength(t * totalLength);
                            return `translate(${p.x},${p.y})`;
                        };
                    })
                    .on("end", loopAnimation); // Loop
            };

            // Start particle animation after the line is mostly drawn
            setTimeout(loopAnimation, i * 500 + 1000);
        }

        // --- Transport Badge ---
        const midX = (source.x + target.x) / 2;
        
        const badgeGroup = contentGroup.append("g")
            .attr("transform", `translate(${midX}, ${midY})`)
            .attr("opacity", 0); // Start hidden

        // Fade in badge after line draws
        badgeGroup.transition().delay(i * 500 + 500).duration(300).attr("opacity", 1);

        const labelText = edge.details ? edge.details : `${edge.duration}`;
        const estimatedWidth = labelText.length * 10 + 40;

        badgeGroup.append("rect")
            .attr("x", -estimatedWidth/2)
            .attr("y", -14)
            .attr("width", estimatedWidth)
            .attr("height", 28)
            .attr("rx", 14)
            .attr("fill", "white")
            .attr("stroke", edgeColor)
            .attr("stroke-width", 2)
            .attr("filter", "drop-shadow(0 4px 3px rgba(0,0,0,0.07))");

        badgeGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("font-size", "11px")
            .attr("fill", edgeColor)
            .attr("font-weight", "bold")
            .text(`${getTransportIcon(edge.transportMode)} ${labelText}`);
      }
    });

    // --- 4. Draw Nodes ---
    const nodeGroups = contentGroup.selectAll("g.node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .attr("cursor", "pointer")
        .on("mouseenter", (event, d) => {
           const rect = (event.currentTarget as Element).getBoundingClientRect();
           const containerRect = containerRef.current?.getBoundingClientRect();
           
           if (containerRect) {
               const x = rect.left - containerRect.left + rect.width / 2;
               const y = rect.top - containerRect.top + rect.height / 2;
               setHoveredNode({ node: d, x, y });
           }
           
           d3.select(event.currentTarget).select("circle")
             .transition().duration(200)
             .attr("r", 30)
             .attr("stroke-width", 6);
        })
        .on("mouseleave", (event) => {
           setHoveredNode(null);
           d3.select(event.currentTarget).select("circle")
             .transition().duration(200)
             .attr("r", 24)
             .attr("stroke-width", 4);
        });

    // Initial Animation for Nodes (Pop in)
    nodeGroups.attr("opacity", 0)
        .transition()
        .delay((d, i) => i * 500)
        .duration(500)
        .attr("opacity", 1);

    // Node Outer Ring (Shadow/Glow)
    nodeGroups.append("circle")
        .attr("r", 24)
        .attr("fill", d => getTypeColor(d.type))
        .attr("stroke", "white")
        .attr("stroke-width", 4)
        .attr("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.15))")
        .attr("class", "node-circle");

    // Node Index Number
    nodeGroups.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", "white")
        .attr("font-weight", "bold")
        .attr("font-family", "sans-serif")
        .attr("font-size", "16px")
        .text((d, i) => i + 1);

    // Start/End Flags
    nodeGroups.each(function(d) {
        if (d.isStart || d.isEnd) {
             const g = d3.select(this);
             g.append("rect")
              .attr("x", -20)
              .attr("y", -50)
              .attr("width", 40)
              .attr("height", 20)
              .attr("rx", 4)
              .attr("fill", d.isStart ? "#10b981" : "#ef4444");
             
             g.append("text")
              .attr("x", 0)
              .attr("y", -37)
              .attr("text-anchor", "middle")
              .attr("fill", "white")
              .attr("font-size", "10px")
              .attr("font-weight", "bold")
              .text(d.isStart ? "起点" : "终点");
             
             g.append("line")
              .attr("x1", 0).attr("y1", -30)
              .attr("x2", 0).attr("y2", -24)
              .attr("stroke", "#64748b")
              .attr("stroke-width", 2);
        }
    });

    // Labels
    const labelGroup = nodeGroups.append("g").attr("transform", "translate(0, 40)");

    labelGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("font-weight", "800")
        .attr("font-size", "15px")
        .attr("fill", "#1e293b")
        .text(d => `${getTypeIcon(d.type)} ${d.name}`);
    
    // Stay Time Pill
    labelGroup.each(function(d) {
        if (d.estimatedStay) {
            const g = d3.select(this);
            g.append("rect")
             .attr("x", -35)
             .attr("y", 10)
             .attr("width", 70)
             .attr("height", 20)
             .attr("rx", 10)
             .attr("fill", "#ecfdf5") // green-50
             .attr("stroke", "#10b981") // green-500
             .attr("stroke-width", 1);

            g.append("text")
             .attr("text-anchor", "middle")
             .attr("y", 23)
             .attr("font-size", "10px")
             .attr("fill", "#059669")
             .attr("font-weight", "bold")
             .text(`🕒 ${d.estimatedStay}`);
        }
    });

    // --- 5. Initial Zoom Position ---
    const initialScale = Math.min(containerWidth / (LAYOUT_WIDTH + 100), 0.8);
    // Center based on LAYOUT_WIDTH
    const initialX = (containerWidth - LAYOUT_WIDTH * initialScale) / 2;
    const initialY = 50;
    
    // Apply initial transform
    svg.call(zoom.transform, d3.zoomIdentity.translate(initialX, initialY).scale(initialScale));

  }, [routePlan]);

  // --- Helper Functions ---
  const getTransportIcon = (mode: string) => {
    switch(mode) {
        case 'WALK': return '🚶';
        case 'TAXI': return '🚕';
        case 'BUS': return '🚌';
        case 'SUBWAY': return '🚇';
        default: return '🚗';
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
        case 'FOOD': return '🍜'; // Food
        case 'SCENERY': return '🏔️'; // Mountain/Scenery
        case 'HOTEL': return '🏨'; // Hotel
        default: return '🚩'; // Flag/Other
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
        case 'FOOD': return '#f59e0b'; // Amber
        case 'SCENERY': return '#10b981'; // Emerald
        case 'HOTEL': return '#6366f1'; // Indigo
        default: return '#64748b'; // Slate
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
        case 'FOOD': return '美食';
        case 'SCENERY': return '景点';
        case 'HOTEL': return '住宿';
        default: return '其他';
    }
  };

  const handleDemo = () => {
    setInputText("第一天先去南普陀寺烧香，然后从那里走到厦大白城沙滩拍照。中午去沙坡尾吃个汉堡，下午逛逛猫街。晚上去中山路步行街吃小吃。");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Input Panel */}
      <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
        <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center">
          <span className="bg-red-500 text-white p-1 rounded-md mr-2 text-xs">红薯</span>
          攻略变地图
        </h3>
        <p className="text-sm text-slate-500 mb-4">粘贴小红书/笔记攻略，AI 自动生成含地铁导航的顺路地图。</p>
        
        <textarea
          className="w-full flex-grow p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-slate-50 text-sm mb-4 leading-relaxed"
          placeholder="粘贴您的攻略文本..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        
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

      {/* Visualization Panel */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative flex flex-col h-full">
        {!routePlan ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                <svg className="w-24 h-24 mb-6 opacity-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                <p className="font-medium text-lg">等待生成路线...</p>
                <p className="text-sm opacity-60 mt-1">请在左侧输入攻略文本</p>
            </div>
        ) : (
            <div ref={containerRef} className="flex-grow overflow-hidden relative bg-slate-50/50">
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
                    <div className="flex flex-col items-end">
                        <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold mb-1">{routePlan.nodes.length} 个地点</span>
                        <span className="text-[10px] text-slate-400">双击空白处或使用按钮缩放</span>
                    </div>
                 </div>
                 
                 {/* Zoom Controls */}
                 <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
                    <button 
                        onClick={handleZoomIn}
                        className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-50 border border-slate-200 transition-colors"
                        title="放大"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <button 
                        onClick={handleZoomOut}
                        className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-50 border border-slate-200 transition-colors"
                        title="缩小"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <button 
                        onClick={handleResetZoom}
                        className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-slate-50 border border-slate-200 transition-colors"
                        title="重置视角"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                 </div>

                 <div className="w-full h-full cursor-grab active:cursor-grabbing">
                   <svg ref={svgRef} className="block w-full h-full"></svg>
                   
                   {/* Tooltip Overlay */}
                   {hoveredNode && (
                     <div 
                        className="absolute bg-white rounded-xl shadow-xl border border-slate-100 p-4 w-64 z-30 pointer-events-none animate-fadeIn"
                        style={{ 
                            left: hoveredNode.x + 40, // Offset to right of node (calculated relative to container)
                            top: hoveredNode.y - 40,  // Slightly above center
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
                        <p className="text-xs text-slate-500 leading-relaxed mb-2">{hoveredNode.node.description}</p>
                        {hoveredNode.node.estimatedStay && (
                            <div className="flex items-center text-xs text-emerald-600 font-bold bg-emerald-50 p-2 rounded">
                                <span className="mr-1">建议游玩:</span> {hoveredNode.node.estimatedStay}
                            </div>
                        )}
                        {/* Little triangle pointer */}
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