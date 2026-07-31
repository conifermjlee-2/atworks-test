"use client";

import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';

interface FrontendFlowViewProps {
  rootPath: string;
  onClose: () => void;
}

type FlowNode = {
  type: 'screen' | 'component' | 'api';
  name: string;
  filePath: string;
  children?: FlowNode[];
};

export default function FrontendFlowView({ rootPath, onClose }: FrontendFlowViewProps) {
  const [targetPath, setTargetPath] = useState(rootPath || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [flowData, setFlowData] = useState<FlowNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (rootPath) {
      setTargetPath(rootPath);
    }
  }, [rootPath]);

  const handleAnalyze = async () => {
    if (!targetPath.trim()) return;
    setIsAnalyzing(true);
    setFlowData([]);
    try {
      const res = await fetch(`/api/analyze/flow?rootPath=${encodeURIComponent(targetPath)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze flow');
      
      setFlowData(data.screens || []);
      toast.success('프론트엔드 흐름 분석 완료!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleNode = (nodePath: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodePath]: !prev[nodePath]
    }));
  };

  const renderNode = (node: FlowNode, depth: number, pathKey: string) => {
    const isExpanded = expandedNodes[pathKey] !== false; // Default true
    
    let icon = '';
    let colorClass = '';
    
    if (node.type === 'screen') {
      icon = '🖥️';
      colorClass = 'text-blue-400 font-bold text-base';
    } else if (node.type === 'component') {
      icon = '🧩';
      colorClass = 'text-purple-400 font-medium text-sm';
    } else if (node.type === 'api') {
      icon = '⚡';
      colorClass = 'text-green-400 font-mono text-xs font-bold';
    }

    return (
      <div key={pathKey} className={`ml-${depth > 0 ? 6 : 0} mt-1.5`}>
        <div 
          className={`flex items-center space-x-2 py-1.5 px-3 rounded cursor-pointer hover:bg-gray-800 transition-colors ${depth === 0 ? 'bg-[#2a2b2f] border border-gray-700/50 shadow-sm mb-2 mt-4' : ''}`}
          onClick={() => toggleNode(pathKey)}
        >
          {node.children && node.children.length > 0 ? (
            <span className="text-gray-500 text-xs w-4 text-center flex-shrink-0">{isExpanded ? '▼' : '▶'}</span>
          ) : (
            <span className="w-4 flex-shrink-0"></span>
          )}
          <span className="text-sm flex-shrink-0">{icon}</span>
          <span className={`truncate ${colorClass}`}>{node.name}</span>
          <span className="text-xs text-gray-500 ml-2 truncate opacity-70">({node.filePath})</span>
        </div>
        
        {isExpanded && node.children && node.children.length > 0 && (
          <div className="border-l-2 border-gray-700/50 ml-5 pl-2 mt-1 mb-2">
            {node.children.map((child, idx) => renderNode(child, depth + 1, `${pathKey}-${idx}`))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] text-white overflow-hidden relative">
      <div className="flex items-center justify-between p-4 bg-[#252628] border-b border-gray-800 shadow-sm">
        <h2 className="text-lg font-bold flex items-center text-blue-400">
          <span className="mr-2">🗺️</span> 프론트엔드 전체 흐름 시각화
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 bg-gray-800 rounded">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div className="p-4 bg-[#202124] border-b border-gray-800 flex items-center space-x-3 shadow-md z-10">
        <div className="flex-1 flex items-center bg-[#121316] border border-gray-700 rounded-md overflow-hidden">
          <span className="px-3 text-gray-500 text-sm border-r border-gray-700 bg-gray-800/50 whitespace-nowrap">타겟 프로젝트</span>
          <input 
            type="text" 
            value={targetPath}
            onChange={e => setTargetPath(e.target.value)}
            placeholder="C:\path\to\frontend\project"
            className="flex-1 bg-transparent text-sm text-gray-200 px-3 py-2 focus:outline-none"
            spellCheck="false"
          />
        </div>
        <button 
          onClick={handleAnalyze}
          disabled={isAnalyzing || !targetPath}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2 px-6 rounded-md transition-colors whitespace-nowrap shadow-sm"
        >
          {isAnalyzing ? '흐름 분석 중...' : '흐름 분석 시작'}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-[#161719]">
        {flowData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <span className="text-4xl mb-4 opacity-50">🗺️</span>
            <p className="text-sm">타겟 프로젝트를 선택하고 분석을 시작하세요.</p>
            <p className="text-xs text-gray-600 mt-2">화면(라우팅) ➡️ 컴포넌트 ➡️ API 호출 흐름을 추출합니다.</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-end mb-4 border-b border-gray-800 pb-2">
              <h3 className="text-gray-300 font-bold">
                감지된 화면 (Screens): <span className="text-blue-400">{flowData.length}</span>개
              </h3>
              <div className="space-x-4 text-xs bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700">
                <span className="text-blue-400 font-bold">🖥️ Screen</span>
                <span className="text-purple-400 font-medium">🧩 Component</span>
                <span className="text-green-400 font-mono font-bold">⚡ API Call</span>
              </div>
            </div>
            
            <div className="bg-[#1e1e1e] border border-gray-700/80 rounded-lg p-2 shadow-inner">
              {flowData.map((node, idx) => renderNode(node, 0, `root-${idx}`))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
