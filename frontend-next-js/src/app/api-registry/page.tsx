"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from 'next/navigation';
import { Trash2, ChevronDown, ChevronRight, Copy } from 'lucide-react';

export default function ApiRegistryPage() {
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPulling, setIsPulling] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<any>>(new Set());
  const [expandedId, setExpandedId] = useState<any | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const router = useRouter();

  const fetchApis = async () => {
    try {
      const res = await fetch('/api/tester/apis');
      const data = await res.json();
      const loadedApis = Array.isArray(data) ? data : [];
      setApis(loadedApis);
      setSelectedIds(new Set()); // Reset selections on refresh
      
      // Expand all groups by default
      const groups = new Set(loadedApis.map((api: any) => api.group || '기타'));
      setExpandedGroups(groups as Set<string>);
    } catch (e) {
      toast.error('API 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApis();
  }, []);

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개의 API를 정말 삭제하시겠습니까?`)) return;
    
    const idArray = Array.from(selectedIds);
    try {
      const res = await fetch(`/api/tester/apis/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idArray })
      });
      if (res.ok) {
        toast.success(`${idArray.length}개 항목이 일괄 삭제되었습니다.`);
        fetchApis();
      } else {
        toast.error('일괄 삭제 실패');
      }
    } catch (e) {
      toast.error('오류 발생');
    }
  };

  const handleDelete = async (id: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/tester/apis?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('삭제되었습니다.');
        fetchApis();
      } else {
        toast.error('삭제 실패');
      }
    } catch (e) {
      toast.error('오류 발생');
    }
  };

  const handleLoad = (id: any, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/validation?loadApi=${id}`);
  };

  const handlePullSwagger = async () => {
    const swaggerUrl = window.prompt("Swagger JSON URL을 입력하세요.\n(예: http://localhost:8080/v3/api-docs)");
    if (!swaggerUrl) return;

    setIsPulling(true);
    const id = toast.loading("Swagger 파싱 및 자동 등록 중...");
    
    try {
      const res = await fetch('/api/tester/apis/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swaggerUrl })
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(`완료! ${data.addedCount}개의 API가 새로 등록되었습니다.`, { id });
        fetchApis();
      } else {
        toast.error(`실패: ${data.error || '알 수 없는 오류'}`, { id });
      }
    } catch (e: any) {
      toast.error(`오류 발생: ${e.message}`, { id });
    } finally {
      setIsPulling(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(apis.map(api => api.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: any, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const toggleExpand = (id: any) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleGroup = (group: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(group)) newSet.delete(group);
    else newSet.add(group);
    setExpandedGroups(newSet);
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success('복사되었습니다.');
  };

  const allSelected = apis.length > 0 && selectedIds.size === apis.length;

  // Group APIs by 'group' field
  const groupedApis = apis.reduce((acc, api) => {
    const groupName = api.group || '기타';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(api);
    return acc;
  }, {} as Record<string, any[]>);

  const getMethodColor = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'POST': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'PUT': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getMethodBgColor = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-blue-50/50 hover:bg-blue-50 border-blue-200';
      case 'POST': return 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200';
      case 'PUT': return 'bg-orange-50/50 hover:bg-orange-50 border-orange-200';
      case 'DELETE': return 'bg-red-50/50 hover:bg-red-50 border-red-200';
      default: return 'bg-gray-50/50 hover:bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            API 관리
          </h1>
          <p className="text-gray-500 mt-2">등록된 API 및 검증 규칙(Rule) 목록을 관리합니다.</p>
        </div>
        <div className="flex gap-3 items-center">
          {selectedIds.size > 0 && (
            <Button 
              onClick={handleBatchDelete} 
              variant="destructive"
              className="shadow-md transition-all animate-in slide-in-from-right-4"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {selectedIds.size}개 선택 삭제
            </Button>
          )}
          <Button 
            onClick={handlePullSwagger} 
            disabled={isPulling}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition-all active:scale-95"
          >
            {isPulling ? "가져오는 중..." : "🔗 Swagger 가져오기"}
          </Button>
          <Button onClick={() => router.push('/validation')} className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all active:scale-95">
            + 새 테스트 작성
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-2">
        <input 
          type="checkbox" 
          className="w-4 h-4 cursor-pointer accent-blue-600"
          checked={allSelected}
          onChange={(e) => handleSelectAll(e.target.checked)}
          id="selectAll"
        />
        <label htmlFor="selectAll" className="text-sm font-medium text-gray-700 cursor-pointer">
          전체 선택 ({selectedIds.size}/{apis.length})
        </label>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-sm border">로딩 중...</div>
      ) : apis.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border">
          <div className="text-4xl mb-4">📭</div>
          등록된 API가 없습니다.<br/>
          값 검증 페이지에서 테스트 후 저장해보세요.
        </div>
      ) : (
        <div className="space-y-6 pb-20">
          {Object.entries(groupedApis).map(([groupName, groupApis]) => {
            const isGroupExpanded = expandedGroups.has(groupName);
            return (
              <div key={groupName} className="space-y-2">
                {/* Group Header */}
                <div 
                  className="flex items-center justify-between pb-2 border-b-2 border-gray-100 cursor-pointer group"
                  onClick={() => toggleGroup(groupName)}
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-800">{groupName}</h2>
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">
                      {groupApis.length}
                    </span>
                  </div>
                  <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                    {isGroupExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>

                {/* API List */}
                {isGroupExpanded && (
                  <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                    {groupApis.map(api => {
                      const isExpanded = expandedId === api.id;
                      const isSelected = selectedIds.has(api.id);
                      
                      return (
                        <div 
                          key={api.id}
                          className={`rounded-lg border overflow-hidden transition-all duration-200 ${getMethodBgColor(api.method)} ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : 'shadow-sm hover:shadow-md'}`}
                        >
                          {/* API Row Header */}
                          <div 
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-3 cursor-pointer"
                            onClick={() => toggleExpand(api.id)}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex items-center gap-2 shrink-0">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 cursor-pointer accent-blue-600 ml-1"
                                  checked={isSelected}
                                  onChange={(e) => handleSelectRow(api.id, e.target.checked)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className={`w-20 text-center font-bold text-sm px-2 py-1 rounded border ${getMethodColor(api.method)}`}>
                                  {api.method}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 truncate">
                                <span className="font-mono text-sm font-semibold text-gray-700 truncate">{api.url}</span>
                                <span className="text-sm text-gray-500 truncate hidden md:inline-block">- {api.name}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 shrink-0 pl-7 sm:pl-0">
                              {api.rules && api.rules.length > 0 && (
                                <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-full border">
                                  규칙 {api.rules.length}개
                                </span>
                              )}
                              <div className="text-gray-400">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Detail Panel */}
                          {isExpanded && (
                            <div className="bg-white p-4 border-t border-gray-100/50 animate-in slide-in-from-top-1 fade-in duration-200">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">API 상세 설명</h4>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md border shadow-sm">
                                      {api.description || <span className="text-gray-400 italic">설명이 제공되지 않았습니다.</span>}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">전체 URL</h4>
                                    <div className="flex items-center gap-2 bg-gray-50 p-2 px-3 rounded-md border shadow-sm group">
                                      <span className={`text-xs font-bold ${api.method === 'GET' ? 'text-blue-600' : 'text-green-600'}`}>
                                        {api.method}
                                      </span>
                                      <span className="text-sm font-mono text-gray-800 break-all">{api.url}</span>
                                      <button 
                                        className="ml-auto text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => copyToClipboard(api.url, e)}
                                        title="URL 복사"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-1">메타데이터</h4>
                                    <div className="bg-gray-50 p-3 rounded-md border shadow-sm space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">API ID</span>
                                        <span className="font-mono text-gray-700">{api.id}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">생성일시</span>
                                        <span className="text-gray-700">{new Date(api.createdAt).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">최근 수정일시</span>
                                        <span className="text-gray-700">{new Date(api.updatedAt || api.createdAt).toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2 pt-2">
                                    <Button size="sm" variant="outline" onClick={(e) => handleLoad(api.id, e)} className="bg-white hover:bg-blue-50 text-blue-600 border-blue-200">
                                      불러오기
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={(e) => handleDelete(api.id, e)}>
                                      삭제
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
