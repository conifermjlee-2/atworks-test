"use client";

import React, { useState, useEffect, useRef } from 'react';
import ApiForm from '@/components/ApiForm';
import AnalyzerView from '@/components/AnalyzerView';
import ChainingView from '@/components/ChainingView';
import ScenarioRunnerView from '@/components/ScenarioRunnerView';
import { Toaster } from 'react-hot-toast';

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
  const [sidebarMode, setSidebarMode] = useState<'test' | 'chaining'>('test');

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
        alert(data.error || 'Failed to scan');
      }
    } catch (err) {
      console.error(err);
      alert('Error scanning path');
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

  const activeApi = apiItems.find(item => item.id === activeApiId) || null;
  const visibleCollections = collections.filter(col => col.mode === sidebarMode || (sidebarMode === 'test' && !col.mode));

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-white overflow-hidden">
      <Toaster position="bottom-right" toastOptions={{ 
        style: { background: '#333', color: '#fff' },
        success: { iconTheme: { primary: '#4ade80', secondary: '#333' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#333' } }
      }} />
      {/* Sidebar */}
      <div 
        className="flex flex-col border-r border-gray-800 bg-[#18191b] shrink-0 relative"
        style={{ width: sidebarWidth }}
      >
        {/* Resizer Handle */}
        <div 
          className="absolute top-0 right-[-2px] w-1 h-full cursor-col-resize hover:bg-green-500 z-50 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            isResizing.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        />
        {/* Workspace Title & Mode Selector */}
        <div className="flex flex-col p-4 border-b border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-lg tracking-tight truncate mr-2">My Workspace</h1>
            <div className="flex space-x-1 items-center">
              {sidebarMode === 'chaining' && (
                <button 
                  onClick={() => { setActiveCollectionId(null); setShowAnalyzer(false); }}
                  className="text-gray-400 hover:text-white text-sm px-2 leading-none"
                  title="새 전이 스캔 (Scan New Chain)"
                >🔍</button>
              )}
              <button 
                onClick={handleAddCollection}
                className="text-gray-400 hover:text-white text-xl px-2 leading-none pb-1"
                title="Add Collection"
              >+</button>
              <button 
                onClick={() => setShowAnalyzer(true)}
                className="text-gray-400 hover:text-white px-2 leading-none flex items-center justify-center"
                title="Import Project"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              </button>
            </div>
          </div>
          <select 
            value={sidebarMode} 
            onChange={e => setSidebarMode(e.target.value as 'test' | 'chaining')}
            className="bg-[#121316] text-sm text-gray-300 px-2 py-1.5 border border-gray-700 rounded focus:outline-none w-full"
          >
            <option value="test">API 테스트</option>
            <option value="chaining">API 전이 (Chaining)</option>
          </select>
        </div>
        {/* Collections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {visibleCollections.map(col => (
            <div key={col.id} className="mb-2">
              <div 
                className={`flex items-center justify-between cursor-pointer p-2 rounded transition-colors group ${activeCollectionId === col.id ? 'bg-[#2b2d31] text-white' : 'text-gray-400 hover:bg-[#202124] hover:text-gray-300'}`}
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
                  <span className="w-3 shrink-0 text-center inline-block text-[10px]">{expandedCols[col.id] === false ? '▶' : '▼'}</span>
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
                      className="bg-[#121316] text-sm text-gray-300 px-1 py-0.5 border border-green-500 rounded focus:outline-none w-full"
                    />
                  ) : (
                    <span className="font-semibold text-sm truncate uppercase tracking-wider">{col.name}</span>
                  )}
                </div>
                {editingCollectionId !== col.id && (
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddApi(col.id); }}
                      className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 px-1 transition-opacity hidden group-hover:block"
                      title="Add API"
                    >+</button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setEditingCollectionId(col.id); 
                        setEditingCollectionName(col.name); 
                      }}
                      className="text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 px-1 transition-opacity hidden group-hover:block"
                      title="Rename Collection"
                    >✎</button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteCollection(col.id); }}
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 px-1 transition-opacity hidden group-hover:block"
                      title="Delete Collection"
                    >×</button>
                  </div>
                )}
              </div>
              {expandedCols[col.id] !== false && (
                <div className="space-y-1 mt-1">
                  {apiItems.filter(api => api.collectionId === col.id).map(api => (
                    <div 
                      key={api.id}
                      onClick={() => setActiveApiId(api.id)}
                      className={`flex items-center pl-8 pr-2 py-1.5 rounded cursor-pointer text-sm group ${activeApiId === api.id ? 'bg-gray-700/80 text-white' : 'hover:bg-gray-700/50 text-gray-300'}`}
                    >
                      <span className={`${getMethodColor(api.method)} font-medium text-[10px] w-9 shrink-0`}>
                        {api.method}
                      </span>
                      <span className="truncate flex-1">{api.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteApi(api.id); }}
                        className="text-gray-500 hover:text-red-400 px-1 text-lg leading-none transition-colors"
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
        />
      ) : sidebarMode === 'chaining' && activeCollectionId ? (
        <ScenarioRunnerView 
          collectionId={activeCollectionId}
          apiItems={apiItems.filter(a => a.collectionId === activeCollectionId)}
        />
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Header Tabs */}
          <div className="flex items-center bg-[#2b2c2f] border-b border-gray-800 h-10 px-2 overflow-x-auto">
            {activeApi ? (
              <div className="flex items-center space-x-2 bg-[#202124] px-4 py-2 border-t-2 border-orange-500 rounded-t-sm text-sm text-gray-200 cursor-pointer min-w-max">
                <span className={`${getMethodColor(activeApi.method)} font-medium text-[10px]`}>{activeApi.method}</span>
                <span>{activeApi.name}</span>
                <span 
                  className="ml-2 text-gray-500 hover:text-gray-300"
                  onClick={(e) => { e.stopPropagation(); setActiveApiId(null); }}
                >×</span>
              </div>
            ) : (
              <div className="px-4 text-sm text-gray-500">No Request Selected</div>
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
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="text-gray-500 mb-4 cursor-pointer hover:text-gray-400 transition-colors" onClick={() => setShowAnalyzer(true)}>
                  <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="mx-auto opacity-20 hover:opacity-40 transition-opacity"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                </div>
                <p className="text-gray-400 text-sm">왼쪽에서 컬렉션을 선택하거나 상단의 📥 아이콘을 눌러 프론트엔드 프로젝트를 분석하세요.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
