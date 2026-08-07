'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

interface RouteNodeData extends Record<string, unknown> {
  route: string;
  page: string;
  apiCount: number;
  actionCount: number;
  navCount: number;
  navigations: string[];
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (route: string) => void;
  theme?: 'light' | 'dark';
}

type CustomRouteNodeType = Node<RouteNodeData, 'customRoute'>;

const CustomRouteNode = ({ data, selected }: NodeProps<CustomRouteNodeType>) => {
  const isSelected = selected || data.isSelected;
  const isLight = data.theme === 'light';
  
  let borderColor = isLight ? 'border-slate-300' : 'border-gray-600';
  let glowColor = '';
  let bgColor = isLight ? 'bg-white' : 'bg-[#1a1b1e]';

  if (isSelected) {
    borderColor = isLight ? 'border-purple-500' : 'border-purple-400';
    glowColor = isLight ? 'shadow-[0_0_12px_rgba(168,85,247,0.4)]' : 'shadow-[0_0_16px_rgba(167,139,250,0.5)]';
    bgColor = isLight ? 'bg-purple-50' : 'bg-[#2e1f5e]';
  } else if (data.apiCount > 0 && data.actionCount > 0) {
    borderColor = isLight ? 'border-blue-400' : 'border-blue-500';
    bgColor = isLight ? 'bg-blue-50' : 'bg-[#1c2438]';
  } else if (data.apiCount > 0) {
    borderColor = isLight ? 'border-blue-300' : 'border-blue-500';
    bgColor = isLight ? 'bg-slate-50' : 'bg-[#172035]';
  } else if (data.actionCount > 0) {
    borderColor = isLight ? 'border-orange-300' : 'border-orange-500';
    bgColor = isLight ? 'bg-orange-50' : 'bg-[#241c10]';
  }

  const textColorSelected = isLight ? '#6b21a8' : '#e9d5ff';
  const textColorNormal = isLight ? '#334155' : '#c4b5fd';
  const pageTextColorSelected = isLight ? '#4c1d95' : '#f5f3ff';
  const pageTextColorNormal = isLight ? '#1e293b' : '#e2e8f0';

  return (
    <div 
      className={`relative w-[180px] h-[60px] rounded-lg border-2 ${borderColor} ${bgColor} ${glowColor} overflow-hidden transition-all duration-200`}
      onClick={() => data.onSelect(data.route)}
      onDoubleClick={(e) => { e.stopPropagation(); data.onDoubleClick(data.route); }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      {/* Header bar */}
      <div className={`w-full h-5 ${isSelected ? (isLight ? 'bg-purple-200' : 'bg-purple-700/80') : (isLight ? 'bg-slate-200' : 'bg-gray-800/80')}`} />
      
      {/* Route Path */}
      <div className="absolute top-[2px] left-[10px] text-[10px] font-mono font-bold truncate w-[160px]" style={{ color: isSelected ? textColorSelected : textColorNormal }}>
        {data.route.length > 22 ? '…' + data.route.slice(-20) : data.route}
      </div>

      {/* Page Name */}
      <div className="absolute top-[20px] left-[10px] text-[11px] font-sans font-semibold truncate w-[160px]" style={{ color: isSelected ? pageTextColorSelected : pageTextColorNormal }}>
        {data.page.length > 20 ? data.page.slice(0, 18) + '…' : data.page}
      </div>

      {/* Badges */}
      <div className="absolute top-[38px] left-[8px] flex gap-1">
        {data.apiCount > 0 && (
          <div className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${isLight ? 'bg-blue-100/50 border-blue-300 text-blue-700' : 'bg-blue-500/20 border-blue-500/50 text-blue-300'}`}>
            ⚡ {data.apiCount} API
          </div>
        )}
        {data.actionCount > 0 && (
          <div className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${isLight ? 'bg-orange-100/50 border-orange-300 text-orange-700' : 'bg-orange-500/20 border-orange-500/50 text-orange-300'}`}>
            👆 {data.actionCount} Act
          </div>
        )}
      </div>
      
      {data.navCount > 0 && (
        <div className="absolute top-[38px] right-[8px]">
          <div className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${isLight ? 'bg-green-100/50 border-green-400 text-green-700' : 'bg-green-500/15 border-green-500/40 text-green-300'}`}>
            → {data.navCount}
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

const nodeTypes = {
  customRoute: CustomRouteNode,
};

// Layout with Dagre
const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 180;
  const nodeHeight = 60;

  dagreGraph.setGraph({ rankdir: direction, ranksep: 50, nodesep: 60 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

interface RouteGraphViewProps {
  screens?: any[];
  apps?: any[];
  onGoToDetails?: (route: string) => void;
  focusRoute?: string | null;
  theme?: 'light' | 'dark';
}

export default function RouteGraphView({ screens, apps, onGoToDetails, focusRoute, theme = 'light' }: RouteGraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const effectiveScreens: any[] = React.useMemo(() => {
    if (screens && Array.isArray(screens) && screens.length > 0) {
      return screens;
    }
    if (apps && Array.isArray(apps) && apps.length > 0) {
      return apps.flatMap((app: any) => app.screens || []);
    }
    return Array.isArray(screens) ? screens : [];
  }, [screens, apps]);

  // Build nodes and edges from screens
  const buildGraphData = useCallback(() => {
    const initialNodes: any[] = [];
    const initialEdges: any[] = [];
    const seenRoutes = new Set<string>();

    (effectiveScreens || []).forEach(sc => {
      const fromRoute = sc.route || '/';
      seenRoutes.add(fromRoute);
      
      const allNavs: string[] = [
        ...(sc.navigations || []),
        ...((sc.actions || []).flatMap((a: any) => a.navigations || [])),
      ];
      
      const apiCount = (sc.onEnterApis?.length || 0)
        + (sc.actions || []).reduce((s: number, a: any) => s + (a.apis?.length || 0), 0);
        
      const actionCount = (sc.actions || []).filter((a: any) =>
        a.trigger && a.trigger !== '(component)' && a.trigger !== '(handler)'
      ).length;

      initialNodes.push({
        id: fromRoute,
        type: 'customRoute',
        data: {
          route: fromRoute,
          page: sc.page || fromRoute,
          apiCount,
          actionCount,
          navCount: allNavs.length,
          navigations: allNavs,
          isSelected: false,
          theme,
        },
        position: { x: 0, y: 0 }
      });

      const seenNavs = new Set<string>();
      allNavs.forEach(nav => {
        const toRoute = nav.split('?')[0].replace(/\{[^}]+\}/g, ':param');
        if (toRoute && toRoute !== fromRoute && !seenNavs.has(toRoute)) {
          seenNavs.add(toRoute);
          initialEdges.push({
            id: `${fromRoute}->${toRoute}`,
            source: fromRoute,
            target: toRoute,
            animated: false,
            style: { stroke: 'rgba(74,222,128,0.35)', strokeWidth: 1.2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'rgba(74,222,128,0.7)',
            },
          });
        }
      });
    });

    // Add nodes for external refs
    initialEdges.forEach(e => {
      if (!seenRoutes.has(e.target)) {
        seenRoutes.add(e.target);
        initialNodes.push({
          id: e.target,
          type: 'customRoute',
          data: {
            route: e.target,
            page: e.target.split('/').pop() || e.target,
            apiCount: 0,
            actionCount: 0,
            navCount: 0,
            navigations: [],
            isSelected: false,
            theme,
          },
          position: { x: 0, y: 0 }
        });
      }
    });

    return { initialNodes, initialEdges };
  }, [effectiveScreens, theme]);

  useEffect(() => {
    const { initialNodes, initialEdges } = buildGraphData();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
    setNodes(layoutedNodes as any);
    setEdges(layoutedEdges as any);
  }, [effectiveScreens, buildGraphData, setNodes, setEdges]);

  // Handle Selection updates
  useEffect(() => {
    if (focusRoute) setSelectedId(focusRoute);
  }, [focusRoute]);

  // Inject callbacks into node data
  const handleNodeSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const handleNodeDoubleClick = useCallback((route: string) => {
    if (onGoToDetails) onGoToDetails(route);
  }, [onGoToDetails]);

  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === selectedId,
        onSelect: handleNodeSelect,
        onDoubleClick: handleNodeDoubleClick,
      }
    })));
    
    // Highlight edges related to selected node
    setEdges(eds => eds.map(e => {
      const isHighlighted = e.source === selectedId || e.target === selectedId;
      return {
        ...e,
        animated: isHighlighted,
        style: {
          stroke: isHighlighted ? 'rgba(167,139,250,0.85)' : 'rgba(74,222,128,0.35)',
          strokeWidth: isHighlighted ? 2 : 1.2
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isHighlighted ? 'rgba(167,139,250,0.9)' : 'rgba(74,222,128,0.7)',
        }
      };
    }));
  }, [selectedId, setNodes, setEdges, handleNodeSelect, handleNodeDoubleClick]);


  // Selected Node Side Panel Data
  const selectedNode = selectedId ? nodes.find(n => n.id === selectedId) : null;
  const selectedScreen = selectedId ? (effectiveScreens || []).find((sc: any) => (sc.route || '/') === selectedId) : null;
  const incomers = edges.filter(e => e.target === selectedId).map(e => e.source);

  const isLight = theme === 'light';

  return (
    <div className={`w-full h-full flex flex-col ${isLight ? 'bg-slate-50' : 'bg-[#0f1011]'} overflow-hidden select-none`}>
      {/* Toolbar */}
      <div className={`flex items-center gap-3 px-4 py-2 ${isLight ? 'bg-white border-slate-200' : 'bg-[#1a1b1e] border-gray-800'} border-b shrink-0 z-10`}>
        <span className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-gray-400'}`}>🗺️ 라우팅 플로우 맵 (React Flow)</span>
        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-600'}`}>노드 드래그 · 스크롤 줌 · 배경 드래그로 이동</span>
        <div className="ml-auto flex items-center gap-2">
          {/* Legend */}
          <div className={`flex items-center gap-3 text-[10px] ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
            <span className="flex items-center gap-1"><span className={`inline-block w-2.5 h-2.5 rounded-sm ${isLight ? 'bg-purple-500 border border-purple-400' : 'bg-purple-600/80 border border-purple-400/60'}`}></span> 선택됨</span>
            <span className="flex items-center gap-1"><span className={`inline-block w-2.5 h-2.5 rounded-sm ${isLight ? 'bg-blue-400 border border-blue-300' : 'bg-blue-600/60 border border-blue-400/40'}`}></span> API 있음</span>
            <span className="flex items-center gap-1"><span className={`inline-block w-2.5 h-2.5 rounded-sm ${isLight ? 'bg-orange-400 border border-orange-300' : 'bg-orange-600/60 border border-orange-400/40'}`}></span> 액션 있음</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* React Flow Canvas */}
        <div className="flex-1 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onPaneClick={() => setSelectedId(null)}
            fitView
            minZoom={0.1}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background color={isLight ? "#cbd5e1" : "#333"} variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls style={{ backgroundColor: isLight ? '#ffffff' : '#1a1b1e', borderColor: isLight ? '#e2e8f0' : '#333' }} />
            <MiniMap 
              nodeColor={(n) => {
                if (n.id === selectedId) return isLight ? '#a855f7' : '#6d28d9';
                return isLight ? '#cbd5e1' : '#2a2b2f';
              }}
              style={{ backgroundColor: isLight ? '#f8fafc' : '#0f1011', borderColor: isLight ? '#e2e8f0' : '#333' }}
              maskColor={isLight ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)"}
            />
          </ReactFlow>
        </div>

        {/* Side Panel */}
        {selectedNode && selectedNode.data && (
          <div className={`w-64 shrink-0 ${isLight ? 'bg-white border-slate-200' : 'bg-[#1a1b1e] border-gray-800'} border-l overflow-y-auto text-xs z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.1)]`}>
            <div className={`p-3 border-b ${isLight ? 'border-slate-200 bg-slate-50' : 'border-gray-800 bg-[#252628]'}`}>
              <div className={`font-bold ${isLight ? 'text-purple-700' : 'text-purple-300'} font-mono break-all`}>{selectedNode.data.route as string}</div>
              <div className={`${isLight ? 'text-slate-600' : 'text-gray-400'} mt-0.5`}>{selectedNode.data.page as string}</div>
            </div>

            {/* Stats */}
            <div className={`grid grid-cols-3 gap-1 p-2 border-b ${isLight ? 'border-slate-200' : 'border-gray-800'}`}>
              <div className={`${isLight ? 'bg-blue-50' : 'bg-blue-900/30'} rounded p-2 text-center`}>
                <div className={`${isLight ? 'text-blue-700' : 'text-blue-300'} font-bold text-lg`}>{selectedNode.data.apiCount as number}</div>
                <div className={`${isLight ? 'text-slate-500' : 'text-gray-500'} text-[9px]`}>API</div>
              </div>
              <div className={`${isLight ? 'bg-orange-50' : 'bg-orange-900/30'} rounded p-2 text-center`}>
                <div className={`${isLight ? 'text-orange-700' : 'text-orange-300'} font-bold text-lg`}>{selectedNode.data.actionCount as number}</div>
                <div className={`${isLight ? 'text-slate-500' : 'text-gray-500'} text-[9px]`}>액션</div>
              </div>
              <div className={`${isLight ? 'bg-green-50' : 'bg-green-900/30'} rounded p-2 text-center`}>
                <div className={`${isLight ? 'text-green-700' : 'text-green-300'} font-bold text-lg`}>{selectedNode.data.navCount as number}</div>
                <div className={`${isLight ? 'text-slate-500' : 'text-gray-500'} text-[9px]`}>이동</div>
              </div>
            </div>

            {/* Enter APIs */}
            {selectedScreen?.onEnterApis?.length > 0 && (
              <div className={`p-3 border-b ${isLight ? 'border-slate-200' : 'border-gray-800'}`}>
                <div className={`text-[10px] font-bold ${isLight ? 'text-blue-600' : 'text-blue-400'} mb-2 uppercase tracking-wider`}>진입 시 API</div>
                <div className="space-y-1">
                  {selectedScreen.onEnterApis.map((api: any, i: number) => (
                    <div key={i} className={`flex items-center gap-1.5 ${isLight ? 'bg-blue-50' : 'bg-blue-900/20'} rounded px-2 py-1`}>
                      <span className={`font-bold font-mono text-[9px] ${api.method === 'GET' ? (isLight ? 'text-green-600' : 'text-green-400') : api.method === 'POST' ? (isLight ? 'text-orange-600' : 'text-orange-400') : api.method === 'DELETE' ? (isLight ? 'text-red-600' : 'text-red-400') : (isLight ? 'text-blue-600' : 'text-blue-400')}`}>
                        {api.method}
                      </span>
                      <span className={`${isLight ? 'text-slate-700' : 'text-gray-300'} font-mono truncate`} title={api.url}>{api.url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing */}
            {(selectedNode.data.navigations as string[]).length > 0 && (
              <div className={`p-3 border-b ${isLight ? 'border-slate-200' : 'border-gray-800'}`}>
                <div className={`text-[10px] font-bold ${isLight ? 'text-green-600' : 'text-green-400'} mb-2 uppercase tracking-wider`}>이동하는 화면</div>
                <div className="space-y-1">
                  {Array.from(new Set(selectedNode.data.navigations as string[])).map((nav, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 ${isLight ? 'bg-green-50 border border-green-200 hover:bg-green-100' : 'bg-green-900/10 border border-green-800/30 hover:bg-green-900/30'} rounded px-2 py-1 cursor-pointer transition-colors`}
                      onClick={() => {
                        const toRoute = (nav as string).split('?')[0].replace(/\{[^}]+\}/g, ':param');
                        setSelectedId(toRoute);
                      }}
                    >
                      <span className={isLight ? 'text-green-600' : 'text-green-400'}>→</span>
                      <span className={`${isLight ? 'text-green-700' : 'text-green-300'} font-mono text-[10px] break-all`}>{nav as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Incoming */}
            {incomers.length > 0 && (
              <div className="p-3">
                <div className={`text-[10px] font-bold ${isLight ? 'text-orange-600' : 'text-orange-400'} mb-2 uppercase tracking-wider`}>여기로 오는 화면</div>
                <div className="space-y-1">
                  {incomers.map((from, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 ${isLight ? 'bg-orange-50 border border-orange-200 hover:bg-orange-100' : 'bg-orange-900/10 border border-orange-800/30 hover:bg-orange-900/30'} rounded px-2 py-1 cursor-pointer transition-colors`}
                      onClick={() => setSelectedId(from)}
                    >
                      <span className={isLight ? 'text-orange-600' : 'text-orange-400'}>←</span>
                      <span className={`${isLight ? 'text-orange-700' : 'text-orange-300'} font-mono text-[10px] break-all`}>{from}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Details Button */}
            <div className={`p-3 border-t ${isLight ? 'border-slate-200 bg-white' : 'border-gray-800 bg-[#1e1e1e]'}`}>
              <button
                onClick={() => onGoToDetails?.(selectedNode.data.route as string)}
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
