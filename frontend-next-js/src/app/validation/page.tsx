"use client";
import React, { useState } from 'react';
import JsonTreeViewer from "@/components/validation/JsonTreeViewer";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

export default function Home() {
  const [url, setUrl] = useState('');
  const [showUrlSuggestions, setShowUrlSuggestions] = useState(false);
  const [method, setMethod] = useState('GET');

  const [executionResult, setExecutionResult] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [selectedRuleIdx, setSelectedRuleIdx] = useState<number | null>(null);
  const [validationResults, setValidationResults] = useState<any[] | null>(null);
  const [globalPassed, setGlobalPassed] = useState<boolean | null>(null);
  // 우클릭 하이라이트: 해당 경로의 JSON 트리 노드를 하이라이트
  const [highlightPath, setHighlightPath] = useState<string | null>(null);
  // 툴팅: 호버 중인 입력창의 인덱스 및 실제 값
  const [hoveredInputIdx, setHoveredInputIdx] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);

  const handleExecute = async (isNewApi = false) => {
    if (!url) return toast.error("URL을 입력해주세요");
    setLoading(true);
    setValidationResults(null);
    try {
      const activeRules = isNewApi ? [] : rules.map(r => ({
        fieldPath: r.fieldPath,
        operator: r.operator,
        expectedValue: r.expectedValue,
        valueType: r.valueType,
        logicalOperator: r.logicalOperator
      }));

      const res = await fetch('/api/tester/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, headers: {}, rules: activeRules })
      });
      const data = await res.json();
      setExecutionResult(data.executionResult);
      if (isNewApi) {
        setRules([]);
      }
      if (data.validationResults) {
        setValidationResults(data.validationResults);
        setGlobalPassed(data.globalPassed);
      }
    } catch (e) {
      console.error(e);
      toast.error('API 실행에 실패했습니다.');
    }
    setLoading(false);
  };

  const handleAddRuleFromClick = (path: string, value: any, type: string) => {
    if (selectedRuleIdx !== null && selectedRuleIdx < rules.length) {
      const newRules = [...rules];
      newRules[selectedRuleIdx].fieldPath = path;
      newRules[selectedRuleIdx].expectedValue = String(value);
      newRules[selectedRuleIdx].valueType = type;

      // Also update children if it's a parent rule
      if (newRules[selectedRuleIdx].logicalOperator === 'NONE') {
        for (let i = selectedRuleIdx + 1; i < newRules.length; i++) {
          if (newRules[i].logicalOperator !== 'NONE') {
            newRules[i].fieldPath = path;
          } else {
            break;
          }
        }
      }

      setRules(newRules);
      setSelectedRuleIdx(null);
      setHighlightPath(null);
    } else {
      setRules(prev => [...prev, {
        fieldPath: path,
        operator: '=',
        expectedValue: String(value),
        valueType: type,
        selected: true,
        logicalOperator: 'NONE'
      }]);
    }
  };

  const handleAddChildRule = (parentIdx: number) => {
    const parentRule = rules[parentIdx];
    const newRule = {
      fieldPath: parentRule.fieldPath,
      operator: '=',
      expectedValue: '',
      valueType: parentRule.valueType || 'string',
      selected: true,
      logicalOperator: 'AND'
    };
    
    // Find the end of the current group
    let insertIdx = parentIdx + 1;
    while (insertIdx < rules.length && rules[insertIdx].logicalOperator !== 'NONE') {
      insertIdx++;
    }

    const newRules = [...rules];
    newRules.splice(insertIdx, 0, newRule);
    setRules(newRules);
  };

  // ===== JSONPath 기반 실제 값 조회 헬퍼 함수 =====
  // 원본 응답 데이터에서 fieldPath 경로에 해당하는 실제 값을 추출합니다.
  // JSON Path 입력창 툴팁 표시에 사용됩니다.
  const getValueByPath = (fieldPath: string): string | null => {
    if (!executionResult?.responseBody || !fieldPath) return null;
    try {
      const parsed = JSON.parse(executionResult.responseBody);
      // $ 시작 예외 자동 교정 (백엔드와 동일한 로직)
      let path = fieldPath;
      if (path && !path.startsWith('$')) {
        path = '$' + (path.startsWith('[') ? '' : '.') + path;
      }
      // JSONPath-plus 동적 import 대신, 간단한 경로 파싱 (e.g. [1].score, data.name)
      // 실제 값을 직접 traverse하여 추출
      const segments = path
        .replace(/^\$/, '')
        .match(/(\.[a-zA-Z_][\w]*|\[\d+\])/g);
      if (!segments) return String(parsed);
      let current: any = parsed;
      for (const seg of segments) {
        if (current === null || current === undefined) return null;
        if (seg.startsWith('[')) {
          const idx = parseInt(seg.slice(1, -1));
          current = current[idx];
        } else {
          current = current[seg.slice(1)];
        }
      }
      return current !== undefined && current !== null ? String(current) : null;
    } catch {
      return null;
    }
  };

  // ===== 스마트 랜덤 헬퍼 함수 =====
  // 원본 응답값을 참고해서 타입에 맞는 '그럴싸한' 랜덤 값을 생성합니다.
  // - 숫자: 원본값 ±20% 범위에서 현실적인 값 생성
  // - 문자열: 같은 응답 안의 다른 문자열 값을 참조 (없으면 test_xxxx로 폴백)
  // - 불리언: 원본의 반대값 (의도적 실패 케이스 생성)
  const generateSmartRandom = (
    originalValue: any,
    valueType: string,
    allStringValues: string[] = []
  ): string => {
    const type = valueType.toLowerCase();
    if (type === 'boolean') {
      // 원본의 반대값을 넣어서 의도적으로 실패 케이스 생성
      const orig = String(originalValue).toLowerCase() === 'true';
      return String(!orig);
    } else if (type === 'number') {
      const orig = parseFloat(String(originalValue));
      const isInt = Number.isInteger(orig);
      const base = orig === 0 ? 10 : Math.abs(orig);
      const delta = base * 0.2; // ±20% 범위
      const sign = orig < 0 ? -1 : 1;
      const randomDelta = (Math.random() * 2 - 1) * delta; // -delta ~ +delta
      const result = orig + randomDelta;
      return isInt ? String(Math.round(result)) : result.toFixed(1);
    } else {
      // 문자열: 같은 응답 내 다른 문자열 값 참조
      const others = allStringValues.filter(v => v !== String(originalValue));
      if (others.length > 0) {
        return others[Math.floor(Math.random() * others.length)];
      }
      // 다른 값이 없으면 기존 방식(폴백)
      return 'test_' + Math.random().toString(36).substring(2, 7);
    }
  };

  const handleAutoRecommend = (isFullRandom: boolean = false) => {
    if (!executionResult || !executionResult.responseBody) {
      return toast.info("먼저 API를 실행하여 응답값을 받아주세요.");
    }
    try {
      const parsed = JSON.parse(executionResult.responseBody);
      const possiblePaths: { path: string, value: any }[] = [];
      
      const traverse = (obj: any, currentPath: string) => {
        if (obj !== null && typeof obj === 'object') {
          if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
              traverse(obj[i], currentPath ? `${currentPath}[${i}]` : `[${i}]`);
            }
          } else {
            Object.keys(obj).forEach(key => {
              const newPath = currentPath ? `${currentPath}.${key}` : key;
              traverse(obj[key], newPath);
            });
          }
        } else if (obj !== null && obj !== undefined) {
           possiblePaths.push({ path: currentPath, value: obj });
        }
      };
      
      traverse(parsed, '');
      
      if (possiblePaths.length === 0) {
        return toast.info("추천할 만한 유효한 필드를 찾지 못했습니다.");
      }
      
      // Shuffle array randomly
      for (let i = possiblePaths.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [possiblePaths[i], possiblePaths[j]] = [possiblePaths[j], possiblePaths[i]];
      }
      // Pick a random amount between 1 and total available paths
      // (cap at 50 to prevent browser from freezing with too many UI rows)
      const maxCount = Math.min(possiblePaths.length, 50);
      const randomCount = Math.floor(Math.random() * maxCount) + 1;
      const selected = possiblePaths.slice(0, randomCount);
      
      const ops = ['=', '!=', '>', '<', '>=', '<=', 'contains'];
      const newRules = selected.map(item => {
        const type = typeof item.value === 'number' ? 'number' : typeof item.value === 'boolean' ? 'boolean' : 'string';
        let op = '=';
        let val = String(item.value);

        if (isFullRandom) {
          op = ops[Math.floor(Math.random() * ops.length)];
          // 원본 응답 내 모든 문자열 값을 수집 (문자열 타입 스마트 랜덤에서 참조)
          const allStringValues = possiblePaths
            .filter(p => typeof p.value === 'string')
            .map(p => String(p.value));
          val = generateSmartRandom(item.value, type, allStringValues);
        }

        return {
          fieldPath: item.path,
          operator: op,
          expectedValue: val,
          valueType: type,
          selected: true,
          logicalOperator: 'NONE'
        };
      });
      
      setRules(newRules);
    } catch (e) {
      toast.error("응답값이 유효한 JSON 형식이 아닙니다.");
    }
  };

  const handleRandomizeAll = () => {
    // 원본 응답에서 모든 문자열 값을 추출 (스마트 랜덤 참조용)
    let allStringValues: string[] = [];
    try {
      if (executionResult?.responseBody) {
        const parsed = JSON.parse(executionResult.responseBody);
        const collect = (obj: any) => {
          if (typeof obj === 'string') allStringValues.push(obj);
          else if (Array.isArray(obj)) obj.forEach(collect);
          else if (obj && typeof obj === 'object') Object.values(obj).forEach(collect);
        };
        collect(parsed);
      }
    } catch (e) { /* JSON 파싱 실패 시 폴백 사용 */ }

    setRules(prev => prev.map(rule => {
      const type = String(rule.valueType || 'string').toLowerCase();
      // 원본값을 찾아서 스마트 랜덤 생성
      const originalValue = rule.expectedValue;
      const randomVal = generateSmartRandom(originalValue, type, allStringValues);
      return { ...rule, expectedValue: randomVal };
    }));
  };

  const handleRandomizeAllOperators = () => {
    const ops = ['=', '!=', '>', '<', '>=', '<=', 'contains'];
    setRules(prev => prev.map(rule => {
      return { ...rule, operator: ops[Math.floor(Math.random() * ops.length)] };
    }));
  };

  const handleRandomizeAllBoth = () => {
    const ops = ['=', '!=', '>', '<', '>=', '<=', 'contains'];
    // 원본 응답에서 모든 문자열 값을 추출 (스마트 랜덤 참조용)
    let allStringValues: string[] = [];
    try {
      if (executionResult?.responseBody) {
        const parsed = JSON.parse(executionResult.responseBody);
        const collect = (obj: any) => {
          if (typeof obj === 'string') allStringValues.push(obj);
          else if (Array.isArray(obj)) obj.forEach(collect);
          else if (obj && typeof obj === 'object') Object.values(obj).forEach(collect);
        };
        collect(parsed);
      }
    } catch (e) { /* JSON 파싱 실패 시 폴백 사용 */ }

    setRules(prev => prev.map(rule => {
      const type = String(rule.valueType || 'string').toLowerCase();
      const originalValue = rule.expectedValue;
      const randomVal = generateSmartRandom(originalValue, type, allStringValues);
      return { 
        ...rule, 
        operator: ops[Math.floor(Math.random() * ops.length)],
        expectedValue: randomVal 
      };
    }));
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">✨ API Validation Recommender</h1>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. API Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      setShowUrlSuggestions(false);
                      handleExecute(true);
                    }
                  }}
                  onFocus={() => setShowUrlSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowUrlSuggestions(false), 200)}
                  placeholder="e.g., https://jsonplaceholder.typicode.com/users/1"
                  className="w-full"
                />
                {showUrlSuggestions && (
                  <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {[
                      'http://localhost:3000/api/tester/mock',
                      'http://localhost:3000/api/tester/mock2',
                      'http://localhost:3000/api/tester/mock3',
                      'https://jsonplaceholder.typicode.com/users/1',
                      'https://jsonplaceholder.typicode.com/posts/1',
                      'https://api.publicapis.org/entries'
                    ].map((s, i) => (
                      <li
                        key={i}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onMouseDown={() => {
                          setUrl(s);
                          setShowUrlSuggestions(false);
                        }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button 
                onClick={() => handleExecute(true)} 
                disabled={loading}
                className="w-full sm:w-32"
              >
                {loading ? 'Executing...' : 'Execute API'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {executionResult && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
                <CardTitle className="text-lg font-semibold">Response Body Schema</CardTitle>
                {selectedRuleIdx !== null ? (
                  <span className="text-xs text-sky-700 bg-sky-100 px-2 py-1 rounded border border-sky-200 cursor-pointer" onClick={() => { setSelectedRuleIdx(null); setHighlightPath(null); }}>
                    ⌖ 선택 모드 — 원하는 키를 클릭하세요 ✕
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">키를 클릭하면 새 규칙이 추가됩니다</span>
                )}
              </CardHeader>
              <CardContent className="pt-0 overflow-auto max-h-[600px]">
                {executionResult.responseBody ? (
                  <JsonTreeViewer
                    jsonData={executionResult.responseBody}
                    onNodeClick={handleAddRuleFromClick}
                    highlightPath={highlightPath}
                  />
                ) : (
                  <pre className="text-sm bg-gray-50 p-4 rounded-md border text-gray-800">No Content</pre>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-4 pb-4 border-b mb-4">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-4">
                  <CardTitle className="text-lg font-semibold whitespace-nowrap">값 검증 규칙</CardTitle>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex gap-2 pr-3 border-r border-gray-200">
                    <Button variant="outline" size="sm" onClick={() => handleAutoRecommend(false)} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none shadow-[0_2px_6px_rgba(236,72,153,0.25)] hover:from-purple-600 hover:to-pink-600">✨ 자동 추천</Button>
                    <Button variant="outline" size="sm" onClick={() => handleAutoRecommend(true)} className="bg-gradient-to-r from-rose-500 to-orange-500 text-white border-none shadow-[0_2px_6px_rgba(244,63,94,0.25)] hover:from-rose-600 hover:to-orange-600">🌪️ 풀 랜덤 추천</Button>
                  </div>
                  <div className="flex gap-2 pr-3 border-r border-gray-200">
                    <Button variant="outline" size="sm" onClick={handleRandomizeAllOperators} className="bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200 hover:bg-fuchsia-100">🎲 조건 랜덤</Button>
                    <Button variant="outline" size="sm" onClick={handleRandomizeAll} className="bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100">🎲 값 랜덤</Button>
                    <Button variant="outline" size="sm" onClick={handleRandomizeAllBoth} className="bg-violet-50 text-violet-700 border-violet-200 font-semibold hover:bg-violet-100">🎲 조건+값 랜덤</Button>
                  </div>
                  <div className="flex gap-2 pr-3 border-r border-gray-200">
                    <Button variant="outline" size="sm" onClick={() => {
                      if (confirm('모든 규칙을 초기화하시겠습니까?')) {
                        setRules([]);
                        setSelectedRuleIdx(null);
                      }
                    }} className="text-gray-500 border-gray-200">초기화</Button>
                    <Button variant="destructive" size="sm" onClick={() => {
                      const newRules = rules.filter(r => !r.selected);
                      setRules(newRules);
                      setSelectedRuleIdx(null);
                      setHighlightPath(null);
                    }} className="bg-red-50 text-red-500 border border-red-200 hover:bg-red-100">선택 삭제</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleAddRuleFromClick('$.newField', '', 'string')}>+ 규칙 추가</Button>
                    <Button size="sm" onClick={() => handleExecute(false)} disabled={loading} className="bg-blue-500 hover:bg-blue-600 text-white shadow-[0_2px_4px_rgba(59,130,246,0.3)]">검증 실행</Button>
                  </div>
                </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <div className="flex justify-center items-center h-full">
                          <Checkbox 
                            checked={rules.length > 0 && rules.every(r => r.selected)}
                            onCheckedChange={(c) => {
                              setRules(rules.map(r => ({ ...r, selected: !!c })));
                            }}
                          />
                        </div>
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-24"></TableHead>
                      <TableHead>JSON Path</TableHead>
                      <TableHead className="w-36">조건</TableHead>
                      <TableHead>값</TableHead>
                      <TableHead className="w-20 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule, idx) => (
                      <TableRow key={idx} className={rule.selected ? "bg-gray-50/50" : ""}>
                        <TableCell className="align-middle">
                          <div className="flex justify-center items-center h-full">
                            <Checkbox
                              checked={rule.selected || false}
                              onCheckedChange={c => {
                                const newRules = [...rules];
                                newRules[idx].selected = !!c;
                                setRules(newRules);
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {rule.logicalOperator === 'NONE' ? (
                            <button
                              title="클릭: 응답 바디 스키마에서 위치 확인 및 필드 선택"
                              onClick={() => {
                                if (selectedRuleIdx === idx) {
                                  setSelectedRuleIdx(null);
                                  setHighlightPath(null);
                                } else {
                                  setSelectedRuleIdx(idx);
                                  const path = rule.fieldPath;
                                  if (path) {
                                    setHighlightPath(path);
                                    setTimeout(() => {
                                      const el = document.querySelector(`[data-json-path="${path}"]`);
                                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }, 50);
                                  }
                                }
                              }}
                              className={`w-8 h-8 rounded-md flex items-center justify-center mx-auto text-lg transition-all ${selectedRuleIdx === idx ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                              ⌖
                            </button>
                          ) : (
                            <div className="text-gray-300 text-2xl text-center pl-2">↳</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {rule.logicalOperator === 'NONE' ? (
                            <button
                              title="논리 연산자(AND/OR) 추가"
                              onClick={() => handleAddChildRule(idx)}
                              className="w-8 h-8 rounded-md bg-emerald-50 border border-dashed border-emerald-400 text-emerald-500 flex items-center justify-center mx-auto text-xl hover:bg-emerald-100 transition-all"
                            >+</button>
                          ) : (
                            <Select
                              value={rule.logicalOperator}
                              onValueChange={val => {
                                const newRules = [...rules];
                                newRules[idx].logicalOperator = val;
                                setRules(newRules);
                              }}
                            >
                              <SelectTrigger className="h-8 bg-emerald-50 border-emerald-500 text-emerald-700 font-semibold w-[70px] ml-2 px-2 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input
                              type="text"
                              value={rule.fieldPath}
                              readOnly={rule.logicalOperator !== 'NONE'}
                              onChange={e => {
                                const newRules = [...rules];
                                newRules[idx].fieldPath = e.target.value;
                                if (rule.logicalOperator === 'NONE') {
                                  for (let i = idx + 1; i < newRules.length; i++) {
                                    if (newRules[i].logicalOperator !== 'NONE') {
                                      newRules[i].fieldPath = e.target.value;
                                    } else {
                                      break;
                                    }
                                  }
                                }
                                setRules(newRules);
                              }}
                              onMouseEnter={() => setHoveredInputIdx(idx)}
                              onMouseLeave={() => setHoveredInputIdx(null)}
                              className={`h-8 ${rule.logicalOperator !== 'NONE' ? 'bg-gray-100 text-gray-400 ml-4 w-[calc(100%-1rem)] cursor-not-allowed' : 'w-full'}`}
                            />
                            {hoveredInputIdx === idx && executionResult && (() => {
                              const val = getValueByPath(rule.fieldPath);
                              // 아래쪽 2개 행은 툴팁을 위쪽으로 띄워 잘림 현상 방지
                              const showAbove = idx >= rules.length - 2 && rules.length > 1;
                              return (
                                <div className={`absolute left-0 z-50 bg-gray-800 text-white text-xs rounded-md px-3 py-1.5 shadow-lg whitespace-nowrap pointer-events-none ${showAbove ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                                  <div className={`absolute left-4 w-2 h-2 bg-gray-800 rotate-45 ${showAbove ? '-bottom-1' : '-top-1'}`} />
                                  <span className="text-gray-400">현재 값: </span>
                                  <span className="text-yellow-300 font-mono font-semibold">
                                    {val !== null ? val : '경로를 찾을 수 없음'}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Select
                              value={rule.operator}
                              onValueChange={val => {
                                const newRules = [...rules];
                                newRules[idx].operator = val;
                                setRules(newRules);
                              }}
                            >
                              <SelectTrigger className="h-8 flex-1 text-xs px-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="=">같다 (=)</SelectItem>
                                <SelectItem value="!=">다르다 (!=)</SelectItem>
                                <SelectItem value=">">보다 크다 (&gt;)</SelectItem>
                                <SelectItem value="<">보다 작다 (&lt;)</SelectItem>
                                <SelectItem value=">=">크거나 같다 (&gt;=)</SelectItem>
                                <SelectItem value="<=">작거나 같다 (&lt;=)</SelectItem>
                                <SelectItem value="contains">포함한다</SelectItem>
                              </SelectContent>
                            </Select>
                            <button
                              title="랜덤 조건 생성"
                              onClick={() => {
                                const ops = ['=', '!=', '>', '<', '>=', '<=', 'contains'];
                                const newRules = [...rules];
                                newRules[idx].operator = ops[Math.floor(Math.random() * ops.length)];
                                setRules(newRules);
                              }}
                              className="text-lg hover:scale-110 transition-transform"
                            >🎲</button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              value={rule.expectedValue}
                              onChange={e => {
                                const newRules = [...rules];
                                newRules[idx].expectedValue = e.target.value;
                                setRules(newRules);
                              }}
                              className="h-8 flex-1"
                            />
                            <button
                              title="랜덤 값 생성"
                              onClick={() => {
                                const newRules = [...rules];
                                const type = String(rule.valueType || 'string').toLowerCase();
                                // 원본 응답에서 모든 문자열 값을 추출 (스마트 랜덤 참조용)
                                let allStringValues: string[] = [];
                                try {
                                  if (executionResult?.responseBody) {
                                    const parsed = JSON.parse(executionResult.responseBody);
                                    const collect = (obj: any) => {
                                      if (typeof obj === 'string') allStringValues.push(obj);
                                      else if (Array.isArray(obj)) obj.forEach(collect);
                                      else if (obj && typeof obj === 'object') Object.values(obj).forEach(collect);
                                    };
                                    collect(parsed);
                                  }
                                } catch (e) { /* 폴백 */ }
                                const randomVal = generateSmartRandom(rule.expectedValue, type, allStringValues);
                                newRules[idx].expectedValue = randomVal;
                                setRules(newRules);
                              }}
                              className="text-lg hover:scale-110 transition-transform"
                            >🎲</button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center align-middle">
                          <Button
                            variant="destructive"
                            size="sm"
                            title="이 규칙 삭제"
                            onClick={() => {
                              const newRules = rules.filter((_, i) => i !== idx);
                              setRules(newRules);
                              if (selectedRuleIdx === idx) {
                                setSelectedRuleIdx(null);
                                setHighlightPath(null);
                              } else if (selectedRuleIdx !== null && selectedRuleIdx > idx) {
                                setSelectedRuleIdx(selectedRuleIdx - 1);
                              }
                            }}
                            className="h-7 px-3 bg-red-100 text-red-600 hover:bg-red-200 border-none w-auto shadow-none mx-auto"
                          >
                            삭제
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {validationResults && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
              <CardTitle className="text-lg font-semibold">4. Validation Results (Engine Evaluation)</CardTitle>
              {globalPassed !== null && (
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${globalPassed ? 'bg-emerald-100/50 text-emerald-600 border-emerald-200' : 'bg-red-100/50 text-red-600 border-red-200'}`}>
                  최종 결과: {globalPassed ? '성공' : '실패'}
                </span>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 text-center">연산자</TableHead>
                    <TableHead>JSON Path</TableHead>
                    <TableHead>실제값 (Actual)</TableHead>
                    <TableHead>조건 (Operator)</TableHead>
                    <TableHead>기대값 (Expected)</TableHead>
                    <TableHead className="w-32 text-center">결과 (Result)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResults.map((vr, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center font-medium text-gray-500">
                        {idx > 0 ? (vr.rule.logicalOperator === 'NONE' ? '-' : (vr.rule.logicalOperator || 'AND')) : '-'}
                      </TableCell>
                      <TableCell className={`font-mono font-medium ${vr.rule.logicalOperator !== 'NONE' ? "pl-8 text-sky-400/70" : "text-sky-600"}`}>
                        {vr.rule.logicalOperator !== 'NONE' && <span className="text-gray-300 mr-2">↳</span>}
                        {vr.rule.fieldPath}
                      </TableCell>
                      <TableCell className={vr.rule.logicalOperator !== 'NONE' ? "text-gray-400" : "text-gray-600"}>{vr.actualValue}</TableCell>
                      <TableCell className={`font-medium ${vr.rule.logicalOperator !== 'NONE' ? "text-gray-400" : "text-gray-700"}`}>{vr.rule.operator}</TableCell>
                      <TableCell className={vr.rule.logicalOperator !== 'NONE' ? "text-gray-400" : "text-gray-600"}>{vr.rule.expectedValue}</TableCell>
                      <TableCell className="text-center">
                        <span className={`block w-full py-1.5 rounded-full text-xs font-semibold border ${vr.passed ? 'bg-emerald-50 text-emerald-500 border-emerald-200' : 'bg-red-50 text-red-500 border-red-200'}`}>
                          {vr.passed ? '성공' : '실패'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
