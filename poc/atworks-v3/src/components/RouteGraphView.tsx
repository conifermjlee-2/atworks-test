'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface RouteNode {
  id: string;
  route: string;
  page: string;
  apiCount: number;
  actionCount: number;
  navCount: number;
  navigations: string[];
  x: number;
  y: number;
}

interface RouteEdge {
  from: string;
  to: string;
  label?: string;
}

interface RouteGraphViewProps {
  screens: any[];
  onGoToDetails?: (route: string) => void;
  focusRoute?: string | null;
}

const NODE_W = 180;
const NODE_H = 72;
const H_GAP = 80;
const V_GAP = 40;

// ─── 계층형 레이아웃 계산 ──────────────────────────────────────────
function buildGraph(screens: any[]): { nodes: RouteNode[]; edges: RouteEdge[] } {
  const routeMap: Record<string, any> = {};
  screens.forEach(sc => {
    const key = sc.route || '/';
    routeMap[key] = sc;
  });

  const edges: RouteEdge[] = [];
  const nodeMap: Record<string, RouteNode> = {};

  screens.forEach(sc => {
    const fromRoute = sc.route || '/';
    const allNavs: string[] = [
      ...(sc.navigations || []),
      ...((sc.actions || []).flatMap((a: any) => a.navigations || [])),
    ];
    const apiCount = (sc.onEnterApis?.length || 0)
      + (sc.actions || []).reduce((s: number, a: any) => s + (a.apis?.length || 0), 0);
    const actionCount = (sc.actions || []).filter((a: any) =>
      a.trigger && a.trigger !== '(component)' && a.trigger !== '(handler)'
    ).length;

    nodeMap[fromRoute] = {
      id: fromRoute,
      route: fromRoute,
      page: sc.page || fromRoute,
      apiCount,
      actionCount,
      navCount: allNavs.length,
      navigations: allNavs,
      x: 0,
      y: 0,
    };

    const seen = new Set<string>();
    allNavs.forEach(nav => {
      // nav 는 URL 패턴일 수 있음 - 경로만 추출
      const toRoute = nav.split('?')[0].replace(/\{[^}]+\}/g, ':param');
      if (toRoute && toRoute !== fromRoute && !seen.has(toRoute)) {
        seen.add(toRoute);
        edges.push({ from: fromRoute, to: toRoute });
      }
    });
  });

  // 엣지의 to 노드 중 nodeMap에 없는 것 추가 (외부 참조 화면)
  edges.forEach(e => {
    if (!nodeMap[e.to]) {
      nodeMap[e.to] = {
        id: e.to,
        route: e.to,
        page: e.to.split('/').pop() || e.to,
        apiCount: 0,
        actionCount: 0,
        navCount: 0,
        navigations: [],
        x: 0,
        y: 0,
      };
    }
  });

  const nodes = Object.values(nodeMap);

  // ── 계층형 BFS 레이아웃 ──
  const inDegree: Record<string, number> = {};
  nodes.forEach(n => { inDegree[n.id] = 0; });
  edges.forEach(e => {
    if (inDegree[e.to] !== undefined) inDegree[e.to]++;
    else inDegree[e.to] = 1;
  });

  // 루트 노드: in-degree가 0인 것들
  const roots = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0].id);

  const levels: string[][] = [];
  const visited = new Set<string>();
  let queue = [...roots];
  while (queue.length > 0) {
    const nextQueue: string[] = [];
    const level: string[] = [];
    queue.forEach(id => {
      if (!visited.has(id)) {
        visited.add(id);
        level.push(id);
        edges.filter(e => e.from === id).forEach(e => {
          if (!visited.has(e.to)) nextQueue.push(e.to);
        });
      }
    });
    if (level.length > 0) levels.push(level);
    queue = nextQueue;
  }
  // 방문 안된 노드는 마지막 레벨에
  const unvisited = nodes.filter(n => !visited.has(n.id));
  if (unvisited.length > 0) levels.push(unvisited.map(n => n.id));

  // x, y 배치
  levels.forEach((level, li) => {
    const totalW = level.length * NODE_W + (level.length - 1) * H_GAP;
    level.forEach((id, ni) => {
      const node = nodeMap[id];
      if (node) {
        node.x = ni * (NODE_W + H_GAP) - totalW / 2 + NODE_W / 2;
        node.y = li * (NODE_H + V_GAP * 3);
      }
    });
  });

  return { nodes, edges };
}

// ─── 화살표 경로 계산 (cubic bezier) ──────────────────────────────
function edgePath(from: RouteNode, to: RouteNode): string {
  const x1 = from.x + NODE_W / 2;
  const y1 = from.y + NODE_H;
  const x2 = to.x + NODE_W / 2;
  const y2 = to.y;

  const isSameLevel = Math.abs(from.y - to.y) < 20;
  if (isSameLevel) {
    // 같은 레벨: 아래 우회
    const cy = from.y + NODE_H + 50;
    return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2 + NODE_H}`;
  }

  const cp1x = x1;
  const cp1y = y1 + Math.abs(y2 - y1) * 0.4;
  const cp2x = x2;
  const cp2y = y2 - Math.abs(y2 - y1) * 0.3;
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

export default function RouteGraphView({ screens, onGoToDetails, focusRoute }: RouteGraphViewProps) {
  const { nodes: initNodes, edges } = useMemo(() => buildGraph(screens), [screens]);

  const [nodes, setNodes] = useState<RouteNode[]>(() => initNodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastPan = useRef({ x: 0, y: 0 });

  // 노드 재배치 시 초기화
  useEffect(() => {
    const { nodes: newNodes } = buildGraph(screens);
    setNodes(newNodes);
    setSelectedId(null);
    // 초기 pan: 그래프를 중앙으로
    const svgEl = svgRef.current;
    if (svgEl) {
      const rect = svgEl.getBoundingClientRect();
      setPan({ x: rect.width / 2, y: 60 });
    }
  }, [screens]);

  // focusRoute 변경 시 노드 선택 및 중앙 정렬
  useEffect(() => {
    if (focusRoute) {
      setSelectedId(focusRoute);
      const node = nodes.find(n => n.route === focusRoute);
      if (node) {
        const svgEl = svgRef.current;
        if (svgEl) {
          const rect = svgEl.getBoundingClientRect();
          setPan({ x: rect.width / 2 - node.x * zoom, y: rect.height / 2 - node.y * zoom });
        }
      }
    }
  }, [focusRoute, nodes, zoom]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    setPan({ x: rect.width / 2, y: 60 });
  }, []);

  // ── 노드 드래그 ──
  const onNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDraggingNode(id);
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const svgPt = getSvgPoint(e, svgRef.current!, zoom, pan);
    dragOffset.current = { x: svgPt.x - node.x, y: svgPt.y - node.y };
  }, [nodes, zoom, pan]);

  // ── 캔버스 팬 ──
  const onSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (draggingNode) return;
    setIsPanning(true);
    lastPan.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [draggingNode, pan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNode) {
      const svgPt = getSvgPoint(e, svgRef.current!, zoom, pan);
      setNodes(prev => prev.map(n =>
        n.id === draggingNode
          ? { ...n, x: svgPt.x - dragOffset.current.x, y: svgPt.y - dragOffset.current.y }
          : n
      ));
    } else if (isPanning) {
      setPan({ x: e.clientX - lastPan.current.x, y: e.clientY - lastPan.current.y });
    }
  }, [draggingNode, isPanning, zoom, pan]);

  const onMouseUp = useCallback(() => {
    setDraggingNode(null);
    setIsPanning(false);
  }, []);

  // ── 줌 ──
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.min(2.5, Math.max(0.2, prev - e.deltaY * 0.001)));
  }, []);

  const nodeMap = useMemo(() => {
    const m: Record<string, RouteNode> = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  const selectedNode = selectedId ? nodeMap[selectedId] : null;
  const selectedScreen = selectedId ? screens.find((sc: any) => (sc.route || '/') === selectedId) : null;

  return (
    <div className="w-full h-full flex flex-col bg-[#0f1011] overflow-hidden select-none">
      {/* 툴바 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1b1e] border-b border-gray-800 shrink-0">
        <span className="text-xs text-gray-400 font-semibold">🗺️ 라우팅 플로우 맵</span>
        <span className="text-[10px] text-gray-600">노드 드래그 · 스크롤 줌 · 배경 드래그로 이동</span>
        <div className="ml-auto flex items-center gap-2">
          {/* 범례 */}
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-purple-600/80 border border-purple-400/60"></span> 라우트</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-600/60 border border-blue-400/40"></span> API 있음</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-600/60 border border-orange-400/40"></span> 액션 있음</span>
            <span className="flex items-center gap-1"><span className="inline-block w-7 border-t-2 border-dashed border-green-500/60"></span> 이동</span>
          </div>
          <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1 text-xs text-gray-300">
            <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))} className="hover:text-white px-1">＋</button>
            <span className="text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="hover:text-white px-1">－</button>
          </div>
          <button
            onClick={() => { setZoom(1); const svgEl = svgRef.current; if (svgEl) { const r = svgEl.getBoundingClientRect(); setPan({ x: r.width / 2, y: 60 }); } }}
            className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700"
          >
            리셋
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SVG 캔버스 */}
        <svg
          ref={svgRef}
          className="flex-1 h-full"
          style={{ cursor: isPanning ? 'grabbing' : draggingNode ? 'grabbing' : 'grab', background: 'transparent' }}
          onMouseDown={onSvgMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          <defs>
            {/* 화살표 마커 */}
            <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="rgba(74,222,128,0.7)" />
            </marker>
            <marker id="arrow-selected" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="rgba(167,139,250,0.9)" />
            </marker>
            {/* 격자 패턴 */}
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* 배경 격자 */}
          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 엣지 */}
            {edges.map((edge, ei) => {
              const fromNode = nodeMap[edge.from];
              const toNode = nodeMap[edge.to];
              if (!fromNode || !toNode) return null;
              const isHighlighted = selectedId === edge.from || selectedId === edge.to;
              return (
                <path
                  key={ei}
                  d={edgePath(fromNode, toNode)}
                  fill="none"
                  stroke={isHighlighted ? 'rgba(167,139,250,0.85)' : 'rgba(74,222,128,0.35)'}
                  strokeWidth={isHighlighted ? 2 : 1.2}
                  strokeDasharray={isHighlighted ? '0' : '5,4'}
                  markerEnd={isHighlighted ? 'url(#arrow-selected)' : 'url(#arrow-green)'}
                  style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                />
              );
            })}

            {/* 노드 */}
            {nodes.map(node => {
              const isSelected = selectedId === node.id;
              const isEdgeFrom = edges.some(e => e.from === selectedId && e.to === node.id);
              const isEdgeTo = edges.some(e => e.to === selectedId && e.from === node.id);

              let borderColor = '#4b5563'; // gray
              let glowColor = 'none';
              if (isSelected) { borderColor = '#a78bfa'; glowColor = '0 0 16px rgba(167,139,250,0.5)'; }
              else if (isEdgeFrom) { borderColor = '#4ade80'; glowColor = '0 0 10px rgba(74,222,128,0.3)'; }
              else if (isEdgeTo) { borderColor = '#fb923c'; glowColor = '0 0 10px rgba(251,146,60,0.25)'; }
              else if (node.apiCount > 0) borderColor = '#3b82f6';

              const bgColor = isSelected
                ? '#2e1f5e'
                : node.apiCount > 0 && node.actionCount > 0
                  ? '#1c2438'
                  : node.apiCount > 0
                    ? '#172035'
                    : node.actionCount > 0
                      ? '#241c10'
                      : '#1a1b1e';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: 'pointer', filter: glowColor !== 'none' ? `drop-shadow(${glowColor})` : 'none' }}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onClick={e => { e.stopPropagation(); setSelectedId(prev => prev === node.id ? null : node.id); }}
                  onDoubleClick={e => { e.stopPropagation(); if (onGoToDetails) onGoToDetails(node.route); }}
                >
                  {/* 노드 박스 */}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill={bgColor}
                    stroke={borderColor}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {/* 상단 라벨 바 */}
                  <rect width={NODE_W} height={20} rx={8} fill={isSelected ? '#6d28d9' : '#2a2b2f'} opacity={0.8} />
                  <rect y={12} width={NODE_W} height={8} fill={isSelected ? '#6d28d9' : '#2a2b2f'} opacity={0.8} />

                  {/* 라우트 경로 */}
                  <text
                    x={10}
                    y={14}
                    fontSize={10}
                    fontFamily="monospace"
                    fill={isSelected ? '#e9d5ff' : '#c4b5fd'}
                    fontWeight="bold"
                  >
                    {node.route.length > 22 ? '…' + node.route.slice(-20) : node.route}
                  </text>

                  {/* 페이지 이름 */}
                  <text
                    x={10}
                    y={38}
                    fontSize={11}
                    fontFamily="sans-serif"
                    fill={isSelected ? '#f5f3ff' : '#e2e8f0'}
                    fontWeight="600"
                  >
                    {node.page.length > 20 ? node.page.slice(0, 18) + '…' : node.page}
                  </text>

                  {/* 배지들 */}
                  {node.apiCount > 0 && (
                    <g transform="translate(8, 48)">
                      <rect width={42} height={16} rx={4} fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)" strokeWidth={0.8} />
                      <text x={5} y={11.5} fontSize={9} fill="#93c5fd" fontFamily="monospace">⚡ {node.apiCount} API</text>
                    </g>
                  )}
                  {node.actionCount > 0 && (
                    <g transform={`translate(${node.apiCount > 0 ? 56 : 8}, 48)`}>
                      <rect width={46} height={16} rx={4} fill="rgba(251,146,60,0.2)" stroke="rgba(251,146,60,0.5)" strokeWidth={0.8} />
                      <text x={5} y={11.5} fontSize={9} fill="#fdba74" fontFamily="monospace">👆 {node.actionCount} Act</text>
                    </g>
                  )}
                  {node.navCount > 0 && (
                    <g transform={`translate(${NODE_W - 46}, 48)`}>
                      <rect width={38} height={16} rx={4} fill="rgba(74,222,128,0.15)" stroke="rgba(74,222,128,0.4)" strokeWidth={0.8} />
                      <text x={5} y={11.5} fontSize={9} fill="#86efac" fontFamily="monospace">→ {node.navCount}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* 사이드 패널 - 선택된 노드 상세 */}
        {selectedNode && (
          <div className="w-64 shrink-0 bg-[#1a1b1e] border-l border-gray-800 overflow-y-auto text-xs">
            <div className="p-3 border-b border-gray-800 bg-[#252628]">
              <div className="font-bold text-purple-300 font-mono">{selectedNode.route}</div>
              <div className="text-gray-400 mt-0.5">{selectedNode.page}</div>
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-3 gap-1 p-2 border-b border-gray-800">
              <div className="bg-blue-900/30 rounded p-2 text-center">
                <div className="text-blue-300 font-bold text-lg">{selectedNode.apiCount}</div>
                <div className="text-gray-500 text-[9px]">API</div>
              </div>
              <div className="bg-orange-900/30 rounded p-2 text-center">
                <div className="text-orange-300 font-bold text-lg">{selectedNode.actionCount}</div>
                <div className="text-gray-500 text-[9px]">액션</div>
              </div>
              <div className="bg-green-900/30 rounded p-2 text-center">
                <div className="text-green-300 font-bold text-lg">{selectedNode.navCount}</div>
                <div className="text-gray-500 text-[9px]">이동</div>
              </div>
            </div>

            {/* 진입 API */}
            {selectedScreen?.onEnterApis?.length > 0 && (
              <div className="p-3 border-b border-gray-800">
                <div className="text-[10px] font-bold text-blue-400 mb-2 uppercase tracking-wider">진입 시 API</div>
                <div className="space-y-1">
                  {selectedScreen.onEnterApis.map((api: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 bg-blue-900/20 rounded px-2 py-1">
                      <span className={`font-bold font-mono text-[9px] ${api.method === 'GET' ? 'text-green-400' : api.method === 'POST' ? 'text-orange-400' : api.method === 'DELETE' ? 'text-red-400' : 'text-blue-400'}`}>
                        {api.method}
                      </span>
                      <span className="text-gray-300 font-mono truncate">{api.url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 이동하는 화면들 */}
            {selectedNode.navigations.length > 0 && (
              <div className="p-3 border-b border-gray-800">
                <div className="text-[10px] font-bold text-green-400 mb-2 uppercase tracking-wider">이동하는 화면</div>
                <div className="space-y-1">
                  {Array.from(new Set(selectedNode.navigations)).map((nav, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 bg-green-900/10 border border-green-800/30 rounded px-2 py-1 cursor-pointer hover:bg-green-900/30 transition-colors"
                      onClick={() => {
                        const toRoute = (nav as string).split('?')[0].replace(/\{[^}]+\}/g, ':param');
                        if (nodeMap[toRoute]) setSelectedId(toRoute);
                      }}
                    >
                      <span className="text-green-400">→</span>
                      <span className="text-green-300 font-mono text-[10px] truncate">{nav as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 들어오는 화면들 */}
            {(() => {
              const incomers = edges.filter(e => e.to === selectedId).map(e => e.from);
              if (incomers.length === 0) return null;
              return (
                <div className="p-3">
                  <div className="text-[10px] font-bold text-orange-400 mb-2 uppercase tracking-wider">여기로 오는 화면</div>
                  <div className="space-y-1">
                    {incomers.map((from, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 bg-orange-900/10 border border-orange-800/30 rounded px-2 py-1 cursor-pointer hover:bg-orange-900/30 transition-colors"
                        onClick={() => setSelectedId(from)}
                      >
                        <span className="text-orange-400">←</span>
                        <span className="text-orange-300 font-mono text-[10px]">{from}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 상세 목록으로 이동 버튼 */}
            <div className="p-3 border-t border-gray-800 bg-[#1e1e1e]">
              <button
                onClick={() => onGoToDetails?.(selectedNode.route)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(147,51,234,0.3)]"
              >
                <span>📋</span>
                해당 라우트 상세 보기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 헬퍼: SVG 좌표 변환 ──────────────────────────────────────────
function getSvgPoint(e: React.MouseEvent, svg: SVGSVGElement, zoom: number, pan: { x: number; y: number }) {
  const rect = svg.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  return {
    x: (cx - pan.x) / zoom,
    y: (cy - pan.y) / zoom,
  };
}
