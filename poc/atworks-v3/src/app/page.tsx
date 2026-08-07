"use client";

import React, { useState, useEffect, useRef } from 'react';
import ApiForm from '@/components/ApiForm';
import AnalyzerView from '@/components/AnalyzerView';
import ChainingView from '@/components/ChainingView';
import ScenarioRunnerView from '@/components/ScenarioRunnerView';
import FrontendFlowView from '@/components/FrontendFlowView';
import ScenarioWithAIView from '@/components/ScenarioWithAIView';
import { Toaster, toast } from 'react-hot-toast';
import { Hexagon, Sparkles, Beaker, Network, Workflow, Settings } from 'lucide-react';

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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

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
      setShowAnalyzer(false);
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
    <div className={`flex h-screen overflow-hidden font-sans ${theme === 'dark' ? 'dark bg-background text-foreground' : 'bg-white text-slate-800'}`}>
      <Toaster position="bottom-right" toastOptions={{ 
        style: { background: theme === 'dark' ? '#333' : '#fff', color: theme === 'dark' ? '#fff' : '#333' },
        success: { iconTheme: { primary: '#4ade80', secondary: theme === 'dark' ? '#333' : '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: theme === 'dark' ? '#333' : '#fff' } }
      }} />
      {/* 1. Thin Dark Sidebar (Icon Bar) */}
      <div className={`w-[72px] flex flex-col items-center py-5 border-r shrink-0 z-50 transition-colors ${theme === 'light' ? 'bg-[#f8f9fa] border-slate-200' : 'bg-[#0E0F11] border-[#1F2023]'}`}>
        <div 
          className="mb-8 select-none flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95" 
          title="AtWorks - Home"
          onClick={() => window.location.href = '/'}
        >
          <Hexagon className={`w-8 h-8 ${theme === 'light' ? 'text-purple-600' : 'text-purple-500'}`} />
        </div>
        
        <div className="flex flex-col space-y-4 w-full px-2 flex-1">
          <button 
            onClick={() => { setSidebarMode('scenario'); setShowAnalyzer(false); }}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${sidebarMode === 'scenario' ? (theme === 'light' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'bg-purple-600/90 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]') : (theme === 'light' ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-700' : 'text-[#8A8F98] hover:bg-[#1F2023] hover:text-[#EDEDEE]')}`}
            title="Scenario with AI"
          >
            <Sparkles className="w-6 h-6 mb-1" />
            <span className="text-[9px] font-medium tracking-wide">Scenario</span>
          </button>
          <button 
            onClick={() => { setSidebarMode('chaining'); setShowAnalyzer(false); }}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${sidebarMode === 'chaining' ? (theme === 'light' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'bg-purple-600/90 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]') : (theme === 'light' ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-700' : 'text-[#8A8F98] hover:bg-[#1F2023] hover:text-[#EDEDEE]')}`}
            title="API Chaining"
          >
            <Network className="w-6 h-6 mb-1" />
            <span className="text-[9px] font-medium tracking-wide">Chaining</span>
          </button>
          <button 
            onClick={() => { setSidebarMode('test'); setShowAnalyzer(false); }}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${sidebarMode === 'test' ? (theme === 'light' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'bg-purple-600/90 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]') : (theme === 'light' ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-700' : 'text-[#8A8F98] hover:bg-[#1F2023] hover:text-[#EDEDEE]')}`}
            title="API Test"
          >
            <Beaker className="w-6 h-6 mb-1" />
            <span className="text-[9px] font-medium tracking-wide">Test</span>
          </button>
          <button 
            onClick={() => { setSidebarMode('flow'); setShowAnalyzer(false); }}
            className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${sidebarMode === 'flow' ? (theme === 'light' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'bg-purple-600/90 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]') : (theme === 'light' ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-700' : 'text-[#8A8F98] hover:bg-[#1F2023] hover:text-[#EDEDEE]')}`}
            title="Frontend Flow"
          >
            <Workflow className="w-6 h-6 mb-1" />
            <span className="text-[9px] font-medium tracking-wide">Flow</span>
          </button>
        </div>
        
        <button className={`mt-auto p-2 transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-[#8A8F98] hover:text-[#EDEDEE]'}`} title="Settings">
          <Settings className="w-[22px] h-[22px]" />
        </button>
      </div>

      {/* 2. Second Sub-sidebar (Collections/API tree) */}
      {sidebarMode !== 'scenario' && (
        <div 
          className={`flex flex-col shrink-0 relative border-r transition-colors ${theme === 'light' ? 'bg-[#f4f5f7] border-slate-200 text-slate-800' : 'bg-[#1C1C1C] border-border text-foreground'}`}
          style={{ width: sidebarWidth }}
        >
          {/* Resizer Handle */}
          <div 
            className="absolute top-0 right-[-2px] w-[3px] h-full cursor-col-resize hover:bg-purple-500/50 z-50 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              isResizing.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
          />
          {/* Workspace Title & Actions */}
          <div className="flex flex-col p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-semibold text-[15px] tracking-tight text-foreground/90">
                {sidebarMode === 'test' ? 'API Requests' : sidebarMode === 'chaining' ? 'API Chaining' : 'Flow Explorer'}
              </h1>
              <div className="flex space-x-1 items-center">
                <button 
                  onClick={fetchData}
                  className="text-muted-foreground hover:bg-muted/80 hover:text-foreground p-1.5 rounded-md transition-colors"
                  title="Refresh Data"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
                {sidebarMode === 'chaining' && (
                  <button 
                    onClick={() => { setActiveCollectionId(null); setShowAnalyzer(false); }}
                    className="text-muted-foreground hover:bg-muted/80 hover:text-foreground text-sm p-1.5 rounded-md transition-colors"
                    title="Scan New Chain"
                  >🔍</button>
                )}
                <button 
                  onClick={handleAddCollection}
                  className="text-muted-foreground hover:bg-muted/80 hover:text-foreground text-lg p-1.5 rounded-md leading-none flex items-center justify-center transition-colors"
                  title="Add Collection"
                >+</button>
                {sidebarMode !== 'chaining' && (
                  <button 
                    onClick={() => setShowAnalyzer(true)}
                    className="text-muted-foreground hover:bg-muted/80 hover:text-foreground p-1.5 rounded-md transition-colors"
                    title="Import Project"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                  </button>
                )}
              </div>
            </div>
            
            {visibleCollections.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 font-medium px-1">
                <span>{visibleCollections.length} COLLECTIONS</span>
                <div className="flex space-x-3">
                  <button onClick={expandAll} className="hover:text-foreground transition-colors">Expand All</button>
                  <button onClick={collapseAll} className="hover:text-foreground transition-colors">Collapse All</button>
                </div>
              </div>
            )}
          </div>

          {/* Collections List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1 scroll-smooth">
            {visibleCollections.map(col => (
              <div key={col.id} className="mb-1">
                <div 
                  className={`flex items-center justify-between cursor-pointer px-2 py-1.5 rounded-md transition-colors group border border-transparent ${activeCollectionId === col.id ? 'bg-muted/80 text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                  onClick={() => {
                    toggleCol(col.id);
                    setActiveCollectionId(col.id);
                  }}
                  onDoubleClick={() => {
                    setEditingCollectionId(col.id);
                    setEditingCollectionName(col.name);
                  }}
                >
                  <div className="flex items-center space-x-1.5 w-full overflow-hidden mr-2">
                    <span className={`w-4 h-4 shrink-0 flex items-center justify-center text-[10px] transition-transform duration-200 text-muted-foreground/60 ${expandedCols[col.id] ? 'rotate-90' : 'rotate-0'}`}>▶</span>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="shrink-0 text-muted-foreground/70"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
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
                        className="bg-background text-sm text-foreground px-1.5 py-0.5 border border-primary/50 rounded focus:outline-none focus:ring-1 focus:ring-primary w-full"
                      />
                    ) : (
                      <span className="text-[13px] truncate">{col.name}</span>
                    )}
                  </div>
                  {editingCollectionId !== col.id && (
                    <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAddApi(col.id); }}
                        className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                        title="Add API"
                      ><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg></button>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingCollectionId(col.id); 
                          setEditingCollectionName(col.name); 
                        }}
                        className="text-muted-foreground hover:text-blue-500 p-1 rounded hover:bg-muted transition-colors"
                        title="Rename"
                      ><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteCollection(col.id); }}
                        className="text-muted-foreground hover:text-red-500 p-1 rounded hover:bg-muted transition-colors"
                        title="Delete"
                      ><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </div>
                  )}
                </div>
                {expandedCols[col.id] && (
                  <div className="space-y-0.5 mt-0.5 ml-4 border-l border-border/50 pl-2">
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
                        className={`flex items-center pl-2 pr-2 py-1.5 rounded-md cursor-pointer text-[12.5px] group transition-colors relative ${activeApiId === api.id ? 'bg-primary/10 text-foreground font-medium' : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'}`}
                      >
                        {activeApiId === api.id && (
                          <div className="absolute left-[-9px] top-[50%] translate-y-[-50%] w-[3px] h-[16px] bg-primary rounded-r-full" />
                        )}
                        <span className={`${getMethodColor(api.method)} font-semibold text-[10px] w-10 shrink-0`}>
                          {api.method}
                        </span>
                        <span className="truncate flex-1">{api.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteApi(api.id); }}
                          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
          theme={theme}
          onThemeToggle={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
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
