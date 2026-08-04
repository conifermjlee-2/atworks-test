"use client";

import React, { useState, useEffect, useRef } from 'react';
import ApiForm from '@/components/ApiForm';
import AnalyzerView from '@/components/AnalyzerView';
import ChainingView from '@/components/ChainingView';
import ScenarioRunnerView from '@/components/ScenarioRunnerView';
import FrontendFlowView from '@/components/FrontendFlowView';
import ScenarioWithAIView from '@/components/ScenarioWithAIView';
import { Toaster, toast } from 'react-hot-toast';

export type Collection = {
  id: string;
  name: string;
  mode?: string;
};

export type ApiItem = {
  id: string;
  collectionId: string;
  method: string;
  name: string;
  url: string;
  body: string;
};

export default function Home() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [apiItems, setApiItems] = useState<ApiItem[]>([]);
  const [activeApiId, setActiveApiId] = useState<string | null>(null);
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({});
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importPath, setImportPath] = useState('');
  
  // Analyzer View States
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [subProjects, setSubProjects] = useState<any[]>([]);
  const [rootPath, setRootPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Sidebar Resizing Logic
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default 320px
  const isResizing = useRef(false);

  // Mode state
  const [sidebarMode, setSidebarMode] = useState<'test' | 'chaining' | 'flow' | 'scenario'>('scenario');

  // Load initial data
  const fetchData = async () => {
    try {
      const colRes = await fetch('http://localhost:3001/collections');
      const collectionsData = await colRes.json();
      
      const apiRes = await fetch('http://localhost:3001/apiItems');
      const apiData = await apiRes.json();
      
      setCollections(collectionsData);
      setApiItems(apiData);
    } catch (err) {
      console.error("Failed to fetch data from json-server", err);
    }
  };

  useEffect(() => {
    fetchData();

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(200, e.clientX), 800); // min 200, max 800
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeImportModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const openImportModal = () => {
    setImportPath('');
    setIsModalOpen(true);
  };

  const handleAddCollection = async () => {
    const newCollection = {
      id: Math.random().toString(36).substring(7),
      name: 'NEW COLLECTION',
      mode: sidebarMode
    };
    try {
      await fetch('http://localhost:3001/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCollection)
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCollection = async (id: string) => {
    try {
      await fetch(`http://localhost:3001/collections/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameCollection = async (id: string) => {
    if (!editingCollectionName.trim()) return;
    try {
      await fetch(`http://localhost:3001/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingCollectionName })
      });
      setEditingCollectionId(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const closeImportModal = () => {
    setIsModalOpen(false);
  };

  const handleScanPath = async () => {
    if (!importPath.trim()) return;
    setIsScanning(true);
    try {
      const res = await fetch(`/api/scan-subprojects?path=${encodeURIComponent(importPath)}`);
      const data = await res.json();
      
      if (data.subProjects) {
        setSubProjects(data.subProjects);
        setRootPath(data.rootPath);
        setShowAnalyzer(true);
        closeImportModal();
      } else {
        toast.error(data.error || 'Failed to scan');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error scanning path');
    }
    setIsScanning(false);
  };

  const handleAddApi = async (collectionId: string) => {
    const newItem = {
      id: Math.random().toString(36).substring(7),
      collectionId,
      name: 'New Request',
      method: 'GET',
      url: '',
      body: ''
    };

    try {
      await fetch('http://localhost:3001/apiItems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      setExpandedCols(prev => ({ ...prev, [collectionId]: true }));
      setActiveApiId(newItem.id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteApi = async (id: string) => {
    if (!confirm('정말 이 API를 삭제하시겠습니까?')) return;
    try {
      await fetch(`http://localhost:3001/apiItems/${id}`, {
        method: 'DELETE',
      });
      fetchData();
      if (activeApiId === id) setActiveApiId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'text-green-400';
      case 'POST': return 'text-orange-400';
      case 'PUT': return 'text-blue-400';
      case 'DELETE': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const toggleCol = (id: string) => {
    setExpandedCols(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const newExpanded: Record<string, boolean> = {};
    visibleCollections.forEach(col => { newExpanded[col.id] = true; });
    setExpandedCols(newExpanded);
  };

  const collapseAll = () => {
    const newExpanded: Record<string, boolean> = {};
    visibleCollections.forEach(col => { newExpanded[col.id] = false; });
    setExpandedCols(newExpanded);
  };

  const activeApi = apiItems.find(item => item.id === activeApiId) || null;
  const visibleCollections = collections.filter(col => col.mode === sidebarMode || (sidebarMode === 'test' && !col.mode));

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      <Toaster position="bottom-right" toastOptions={{ 
        style: { background: '#333', color: '#fff' },
        success: { iconTheme: { primary: '#4ade80', secondary: '#333' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#333' } }
      }} />
      {/* Sidebar */}
      <div 
        className="flex flex-col border-r border-border bg-card/40 backdrop-blur-xl shrink-0 relative shadow-[4px_0_24px_rgba(0,0,0,0.2)]"
        style={{ width: sidebarWidth }}
      >
        {/* Resizer Handle */}
        <div 
          className="absolute top-0 right-[-2px] w-1 h-full cursor-col-resize hover:bg-primary/50 z-50 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            isResizing.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        />
        {/* Workspace Title & Mode Selector */}
        <div className="flex flex-col p-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="font-extrabold text-lg tracking-tight truncate mr-2 bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent drop-shadow-sm">My Workspace</h1>
            <div className="flex space-x-1 items-center">
              <button 
                onClick={fetchData}
                className="text-muted-foreground hover:text-foreground px-2 leading-none flex items-center justify-center transition-colors"
                title="새로고침 (Refresh Data)"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
              {sidebarMode === 'chaining' && (
                <button 
                  onClick={() => { setActiveCollectionId(null); setShowAnalyzer(false); }}
                  className="text-muted-foreground hover:text-foreground text-sm px-2 leading-none transition-colors"
                  title="새 전이 스캔 (Scan New Chain)"
                >🔍</button>
              )}
              <button 
                onClick={handleAddCollection}
                className="text-muted-foreground hover:text-foreground text-xl px-2 leading-none pb-1 transition-colors"
                title="Add Collection"
              >+</button>
              <button 
                onClick={() => setShowAnalyzer(true)}
                className="text-muted-foreground hover:text-foreground px-2 leading-none flex items-center justify-center transition-colors"
                title="Import Project"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              </button>
            </div>
          </div>
          <select 
            value={sidebarMode} 
            onChange={e => {
              setSidebarMode(e.target.value as 'test' | 'chaining' | 'flow' | 'scenario');
              setShowAnalyzer(false);
            }}
            className="bg-input text-sm text-foreground px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary w-full shadow-sm transition-shadow appearance-none"
          >
            <option value="scenario" className="bg-background text-foreground">시나리오 with AI</option>
            <option value="test" className="bg-background text-foreground">API 테스트</option>
            <option value="chaining" className="bg-background text-foreground">API 전이 (Chaining)</option>
            <option value="flow" className="bg-background text-foreground">프론트 흐름 (Frontend Flow)</option>
          </select>
          
          {visibleCollections.length > 0 && (
            <div className="flex items-center justify-end space-x-3 text-[11px] text-muted-foreground pt-1 font-medium">
              <button onClick={expandAll} className="hover:text-foreground transition-colors">전체 펴기</button>
              <button onClick={collapseAll} className="hover:text-foreground transition-colors">전체 접기</button>
            </div>
          )}
        </div>
        {/* Collections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pt-2 scroll-smooth">
          {visibleCollections.map(col => (
            <div key={col.id} className="mb-2">
              <div 
                className={`flex items-center justify-between cursor-pointer p-2 rounded-md transition-all duration-200 group border border-transparent ${activeCollectionId === col.id ? 'bg-primary/10 border-primary/20 text-primary shadow-[inset_0_1px_4px_rgba(99,102,241,0.1)]' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                onClick={() => {
                  toggleCol(col.id);
                  setActiveCollectionId(col.id);
                }}
                onDoubleClick={() => {
                  setEditingCollectionId(col.id);
                  setEditingCollectionName(col.name);
                }}
              >
                <div className="flex items-center space-x-2 w-full overflow-hidden mr-2">
                  <span className={`w-4 h-4 shrink-0 flex items-center justify-center text-[10px] transition-transform duration-200 ${expandedCols[col.id] ? 'rotate-90' : 'rotate-0'}`}>▶</span>
                  {editingCollectionId === col.id ? (
                    <input
                      type="text"
                      value={editingCollectionName}
                      onChange={(e) => setEditingCollectionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameCollection(col.id);
                        if (e.key === 'Escape') setEditingCollectionId(null);
                      }}
                      onBlur={() => handleRenameCollection(col.id)}
                      autoFocus
                      className="bg-input text-sm text-foreground px-2 py-1 border border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary w-full shadow-sm"
                    />
                  ) : (
                    <span className="font-bold text-[13px] truncate uppercase tracking-widest">{col.name}</span>
                  )}
                </div>
                {editingCollectionId !== col.id && (
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddApi(col.id); }}
                      className="text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md hover:bg-muted transition-colors"
                      title="Add API"
                    >+</button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setEditingCollectionId(col.id); 
                        setEditingCollectionName(col.name); 
                      }}
                      className="text-muted-foreground hover:text-blue-400 px-1.5 py-1 rounded-md hover:bg-muted transition-colors"
                      title="Rename Collection"
                    >✎</button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteCollection(col.id); }}
                      className="text-muted-foreground hover:text-red-400 px-1.5 py-1 rounded-md hover:bg-muted transition-colors"
                      title="Delete Collection"
                    >×</button>
                  </div>
                )}
              </div>
              {expandedCols[col.id] && (
                <div className="space-y-1 mt-1.5 origin-top animate-in fade-in slide-in-from-top-2 duration-200">
                  {apiItems.filter(api => api.collectionId === col.id).map(api => (
                    <div 
                      key={api.id}
                      onClick={() => {
                        setActiveApiId(api.id);
                        setShowAnalyzer(false);
                        if (sidebarMode === 'chaining') {
                          setActiveCollectionId(api.collectionId);
                        }
                      }}
                      className={`flex items-center pl-8 pr-2 py-1.5 rounded-md cursor-pointer text-[13px] group transition-colors ${activeApiId === api.id ? 'bg-primary/20 text-foreground font-medium shadow-[inset_2px_0_0_var(--color-primary)]' : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'}`}
                    >
                      <span className={`${getMethodColor(api.method)} font-bold text-[10px] w-10 shrink-0`}>
                        {api.method}
                      </span>
                      <span className="truncate flex-1">{api.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteApi(api.id); }}
                        className="text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded-sm hover:bg-muted opacity-0 group-hover:opacity-100 transition-all text-sm leading-none"
                        title="Delete API"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      {showAnalyzer ? (
        <AnalyzerView 
          onClose={() => setShowAnalyzer(false)}
          collections={collections}
          apiItems={apiItems}
          onSave={fetchData}
        />
      ) : sidebarMode === 'chaining' && !activeCollectionId ? (
        <ChainingView 
          rootPath={rootPath} 
          onAnalyzeRequired={() => setShowAnalyzer(true)} 
          collections={visibleCollections}
          onSave={fetchData}
          onClose={() => setSidebarMode('test')}
        />
      ) : sidebarMode === 'chaining' && activeCollectionId ? (
        <ScenarioRunnerView 
          collectionId={activeCollectionId}
          apiItems={apiItems.filter(a => a.collectionId === activeCollectionId)}
          activeApiId={activeApiId}
        />
      ) : sidebarMode === 'scenario' ? (
        <ScenarioWithAIView
          rootPath={rootPath}
          collections={collections}
          apiItems={apiItems}
          onSave={fetchData}
          onClose={() => setSidebarMode('test')}
        />
      ) : sidebarMode === 'flow' ? (
        <FrontendFlowView 
          rootPath={rootPath}
          onClose={() => setSidebarMode('test')}
        />
      ) : (
        <div className="flex-1 flex flex-col bg-background/50">
          {/* Header Tabs */}
          <div className="flex items-center bg-card/40 backdrop-blur-md border-b border-border h-11 px-3 overflow-x-auto shadow-sm">
            {activeApi ? (
              <div className="flex items-center space-x-2 bg-background px-4 py-2 border-t-[3px] border-primary rounded-t-lg text-sm text-foreground cursor-pointer min-w-max shadow-[0_-4px_12px_rgba(0,0,0,0.1)] relative top-[1px]">
                <span className={`${getMethodColor(activeApi.method)} font-bold text-[10px]`}>{activeApi.method}</span>
                <span className="font-medium">{activeApi.name}</span>
                <span 
                  className="ml-3 text-muted-foreground hover:text-destructive transition-colors text-lg leading-none"
                  onClick={(e) => { e.stopPropagation(); setActiveApiId(null); }}
                >×</span>
              </div>
            ) : (
              <div className="px-4 text-sm text-muted-foreground font-medium">No Request Selected</div>
            )}
          </div>

          {/* Form Component */}
          <div className="flex-1 overflow-hidden">
            {activeApi ? (
              <ApiForm 
                apiItem={activeApi} 
                onSave={fetchData} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <div 
                  className="w-24 h-24 mb-6 rounded-3xl bg-muted/30 border border-border flex items-center justify-center cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 group shadow-sm hover:shadow-lg" 
                  onClick={() => setShowAnalyzer(true)}
                >
                  <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground group-hover:text-primary transition-colors"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">프론트엔드 프로젝트 스캔</h3>
                <p className="text-muted-foreground text-sm max-w-md text-center leading-relaxed">
                  왼쪽에서 컬렉션을 선택하거나 상단의 아이콘을 눌러<br/>
                  분석할 프로젝트 경로를 입력하세요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
