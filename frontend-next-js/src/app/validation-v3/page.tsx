"use client";
import React, { useState, useRef, useEffect } from 'react';
import JsonTreeViewer from "@/components/validation/JsonTreeViewer";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function Home() {
  // ===== [핵심 상태(State) 관리] =====
  const urlInputRef = useRef<HTMLInputElement>(null); // URL 입력창 포커스 제어용
  const [url, setUrl] = useState(''); // 대상 API URL
  const [showUrlSuggestions, setShowUrlSuggestions] = useState(false); // 추천 URL 목록 표시 여부
  const [focusedSuggestionIdx, setFocusedSuggestionIdx] = useState<number>(-1); // 방향키 탐색용 인덱스
  const [suggestedUrls, setSuggestedUrls] = useState<string[]>([
    'http://localhost:8080/api/delivery/standard',
    'http://localhost:8080/api/delivery/international',
    'http://localhost:8080/api/delivery/express',
  ]); // URL 추천 목록 상태 (삭제 가능하도록 분리)
  const [method, setMethod] = useState('GET'); // HTTP 메서드 (GET, POST 등)

  const [executionResult, setExecutionResult] = useState<any>(null); // 외부 API 실제 호출 결과 (Status, Body)
  const [rules, setRules] = useState<any[]>([]); // 사용자가 등록한 검증 규칙(Rule) 목록
  const [selectedRuleIdx, setSelectedRuleIdx] = useState<number | null>(null); // 현재 UI에서 '선택 모드(⌖)'가 활성화된 규칙의 인덱스
  const [validationResults, setValidationResults] = useState<any[] | null>(null); // 백엔드 채점 엔진이 반환한 규칙별 합격/불합격 결과
  const [globalPassed, setGlobalPassed] = useState<boolean | null>(null); // AND, OR 연산이 모두 적용된 최종 전체 테스트 통과 여부

  // [UX 기능] 우클릭 하이라이트: 규칙 선택 시 위쪽 JSON 트리에서 해당 경로를 노란색 배경으로 스크롤 및 강조 표시하기 위한 상태
  const [highlightPath, setHighlightPath] = useState<string | null>(null);

  // [UX 기능] 실시간 값 툴팁: JSON Path 입력창에 마우스를 올렸을 때(hover), 해당 인덱스와 추출된 실제 값을 보여주기 위한 상태
  const [hoveredInputIdx, setHoveredInputIdx] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);

  // ===== [API 등록 기능] =====
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveMeta, setSaveMeta] = useState({ name: '', description: '', group: '' });

  // Swagger 분석용 URL 상태 관리 (로컬 스토리지 연동)
  const [swaggerUrl, setSwaggerUrl] = useState('http://localhost:8080/v3/api-docs');

  // URL Query(?loadApi=id) 감지 및 로컬 스토리지에서 Swagger URL 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSwaggerUrl = localStorage.getItem('swaggerUrl');
      if (savedSwaggerUrl) setSwaggerUrl(savedSwaggerUrl);

      const params = new URLSearchParams(window.location.search);
      const loadId = params.get('loadApi');
      if (loadId) {
        fetch('/api/tester/apis')
          .then(res => res.json())
          .then(data => {
            const api = data.find((a: any) => a.id === loadId);
            if (api) {
              setUrl(api.url);
              setMethod(api.method);
              setRules(api.rules || []);
              toast.success(`'${api.name}' 불러오기 완료`);
            }
          })
          .catch(console.error);
      }
    }
  }, []);

  const handleSaveApi = async () => {
    if (!saveMeta.name) return toast.error("API 이름을 입력해주세요.");
    setLoading(true);
    try {
      const res = await fetch('/api/tester/apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          method,
          rules,
          ...saveMeta
        })
      });
      if (res.ok) {
        toast.success("API가 성공적으로 등록되었습니다.");
        setIsSaveModalOpen(false);
        setSaveMeta({ name: '', description: '', group: '' }); // 리셋
      } else {
        toast.error("API 저장에 실패했습니다.");
      }
    } catch (e) {
      toast.error("저장 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  // ===== [API 실행 및 채점 요청] =====
  // 1) 사용자가 입력한 URL로 실제 API를 호출하여 응답(Response Body)을 받아옵니다.
  // 2) 만약 등록된 검증 규칙(rules)이 있다면, 응답값과 규칙을 묶어 백엔드(/api/tester/execute)로 보내 채점(평가)을 수행합니다.
  const handleExecute = async (isNewApi = false) => {
    if (!url) return toast.error("URL을 입력해주세요");
    setLoading(true);

    // API URL이 변경되었을 때만 화면을 완전히 초기화하여 스크롤 튕김 방지
    if (isNewApi) {
      setValidationResults(null);
      setExecutionResult(null);
    }

    try {
      // 새로운 API를 호출하는 경우(isNewApi=true) 기존에 작성된 엉뚱한 규칙들을 보내지 않기 위해 빈 배열 처리
      const activeRules = isNewApi ? [] : rules.map(r => ({
        fieldPath: r.fieldPath,
        operator: r.operator,
        expectedValue: r.expectedValue,
        valueType: r.valueType,
        logicalOperator: r.logicalOperator
      }));

      // Next.js 백엔드 채점 엔진 라우트로 POST 요청 발송
      const res = await fetch('/api/tester/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, headers: {}, rules: activeRules })
      });
      const data = await res.json();

      // 실행 결과 화면 업데이트
      setExecutionResult(data.executionResult);
      if (isNewApi) {
        setRules([]); // API 변경 시 기존 룰 찌꺼기 초기화
      }
      // 채점 결과가 같이 넘어왔다면 테이블 렌더링을 위해 세팅
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

  // ===== [JSON Tree 연동: 규칙 생성 및 수정] =====
  // 사용자가 상단 JSON Tree에서 특정 노드(값)를 클릭했을 때 호출됩니다.
  const handleAddRuleFromClick = (path: string, value: any, type: string) => {
    // 1) 특정 규칙의 '선택 모드(⌖)'가 활성화된 상태라면 -> 새 규칙 추가 대신 기존 규칙의 경로/값을 '덮어쓰기(수정)' 합니다.
    if (selectedRuleIdx !== null && selectedRuleIdx < rules.length) {
      const newRules = [...rules];
      newRules[selectedRuleIdx].fieldPath = path;
      newRules[selectedRuleIdx].expectedValue = String(value);
      newRules[selectedRuleIdx].valueType = type;

      // 만약 해당 규칙 아래에 종속된 'AND/OR' 하위 규칙들이 있다면, 부모 경로를 함께 동기화해 줍니다.
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
      setSelectedRuleIdx(null); // 값 입력이 끝났으므로 선택 모드 해제
      setHighlightPath(null); // 노란색 하이라이트 해제
    } else {
      // 2) 선택 모드가 아니라면 -> 트리를 누를 때마다 표 맨 아래에 '새로운 검증 규칙'으로 추가합니다.
      setRules(prev => [...prev, {
        fieldPath: path,
        operator: '=',
        expectedValue: String(value), // 사용자가 누른 원본 응답값을 기본 기대값(Expected)으로 세팅
        valueType: type,
        selected: true,
        logicalOperator: 'NONE' // 최상위 부모 조건으로 생성
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

      // 정수인 경우 값이 너무 작으면(1, 2 등) 20%를 해도 반올림 시 그대로가 되므로 최소 변동폭을 보장
      const delta = isInt ? Math.max(base * 0.2, 2) : base * 0.2;

      const randomDelta = (Math.random() * 2 - 1) * delta; // -delta ~ +delta
      const result = orig + randomDelta;

      if (isInt) {
        let rounded = Math.round(result);
        // 랜덤 결과가 원본과 똑같다면 강제로 1을 더하거나 빼서 확실히 변하게 만듦
        if (rounded === orig) {
          rounded += (Math.random() > 0.5 ? 1 : -1);
        }
        return String(rounded);
      } else {
        return result.toFixed(1);
      }
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mixMatchData, setMixMatchData] = useState<any>(null);
  const [expandedApis, setExpandedApis] = useState<number[]>([]);

  const handleAiRecommend = async () => {
    if (!url) {
      return toast.info("API URL을 먼저 입력해주세요.");
    }

    let targetSwaggerUrl = swaggerUrl;
    if (!targetSwaggerUrl) {
      const input = window.prompt("분석할 Swagger JSON URL을 입력하세요.", "http://localhost:8080/v3/api-docs");
      if (!input) return;
      targetSwaggerUrl = input;
      setSwaggerUrl(targetSwaggerUrl);
      localStorage.setItem('swaggerUrl', targetSwaggerUrl);
    }

    const toastId = toast.loading("⚡ 타입 매칭(V3) 룰을 추출하는 중입니다...");
    try {
      const res = await fetch('/api/tester/recommend-v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swaggerUrl: targetSwaggerUrl, targetPath: url, targetMethod: method })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.recommendedRules && data.recommendedRules.length > 0) {
          setMixMatchData(data);
          
          // 규칙을 테이블에 즉시 적용
          const mappedRules = data.recommendedRules.map((r: any) => ({
            fieldPath: r.jsonPath,
            operator: '=',
            expectedValue: r.exampleValue,
            valueType: r.type,
            selected: true,
            logicalOperator: 'NONE',
            isRecommended: true,
            sourceApi: r.sourceApi
          }));
          setRules(mappedRules);
          toast.success(`총 ${mappedRules.length}개의 믹스매치 룰이 즉시 적용되었습니다! 옆의 버튼을 눌러 분석 결과를 확인하세요.`, { id: toastId });
        } else {
          toast.info("추천할 만한 검증 룰을 찾지 못했습니다.", { id: toastId });
        }
      } else {
        toast.error(`AI 분석 실패`, { id: toastId });
      }
    } catch (e: any) {
      toast.error(`오류 발생: ${e.message}`, { id: toastId });
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
      <header className="mb-8 flex items-center gap-3">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">⚡ API Validation Recommender (V3)</h1>
        <button onClick={() => setIsInfoModalOpen(true)} className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold hover:bg-gray-300 transition-colors" title="V3 프로젝트 설명 보기">?</button>
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
                  ref={urlInputRef}
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (showUrlSuggestions && suggestedUrls.length > 0) {
                        setFocusedSuggestionIdx(prev => (prev < suggestedUrls.length - 1 ? prev + 1 : prev));
                      } else {
                        setShowUrlSuggestions(true);
                        setFocusedSuggestionIdx(0);
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (showUrlSuggestions && suggestedUrls.length > 0) {
                        setFocusedSuggestionIdx(prev => (prev > 0 ? prev - 1 : 0));
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (showUrlSuggestions && focusedSuggestionIdx >= 0 && focusedSuggestionIdx < suggestedUrls.length) {
                        // 방향키로 목록을 고른 상태에서 엔터를 치면 해당 주소가 입력창에 반영됨
                        setUrl(suggestedUrls[focusedSuggestionIdx]);
                        setShowUrlSuggestions(false);
                        setFocusedSuggestionIdx(-1);
                      } else {
                        // 아무것도 선택하지 않고 엔터를 치면 바로 실행
                        setShowUrlSuggestions(false);
                        handleExecute(true);
                      }
                    } else if (e.key === 'Escape') {
                      setShowUrlSuggestions(false);
                      setFocusedSuggestionIdx(-1);
                    }
                  }}
                  onFocus={() => setShowUrlSuggestions(true)}
                  onClick={() => setShowUrlSuggestions(true)}
                  onBlur={() => setTimeout(() => {
                    setShowUrlSuggestions(false);
                    setFocusedSuggestionIdx(-1);
                  }, 200)}
                  placeholder="e.g., https://jsonplaceholder.typicode.com/users/1"
                  className="w-full"
                />
                {showUrlSuggestions && suggestedUrls.length > 0 && (
                  <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestedUrls.map((s, i) => (
                      <li
                        key={i}
                        className={`px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm flex justify-between items-center group ${focusedSuggestionIdx === i ? 'bg-blue-50' : ''}`}
                        onMouseEnter={() => setFocusedSuggestionIdx(i)}
                        onMouseDown={(e) => {
                          e.preventDefault(); // 기본 클릭 동작을 막아 blur 이벤트로 인한 문제 방지
                          setUrl(s);
                          setShowUrlSuggestions(false);
                          setTimeout(() => urlInputRef.current?.focus(), 0); // 상태 업데이트 후 포커스 복귀
                        }}
                      >
                        <span>{s}</span>
                        <button
                          type="button"
                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          onMouseDown={(e) => {
                            e.stopPropagation(); // 부모(li)의 onMouseDown(선택)이 발생하지 않도록 차단
                            setSuggestedUrls(prev => prev.filter(item => item !== s));
                          }}
                          title="목록에서 삭제"
                        >
                          ✕
                        </button>
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
                <CardTitle className="text-lg font-semibold">2. Response Body Schema</CardTitle>
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
              <CardHeader className="flex flex-col gap-3 pb-4 border-b mb-4">
                {/* 상단: 제목 + 실행 액션 */}
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="text-lg font-semibold">3. 값 검증 규칙</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleAddRuleFromClick('$.newField', '', 'string')} className="text-gray-600 border-gray-200 hover:border-gray-300 h-8 text-xs">+ 규칙 추가</Button>
                    <Button variant="secondary" size="sm" onClick={() => setIsSaveModalOpen(true)} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 h-8 text-xs">💾 API 등록</Button>
                    <Button size="sm" onClick={() => handleExecute(false)} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs font-semibold px-4 shadow-md">{loading ? '실행 중...' : '▶ 검증 실행'}</Button>
                  </div>
                </div>

                {/* 하단: 추천 + 랜덤 + 편집 */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* 그룹 1 - Swagger 스펙 추천 */}
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mr-0.5">AI 스펙 추출</span>
                    <input
                      type="text"
                      value={swaggerUrl}
                      onChange={(e) => {
                        setSwaggerUrl(e.target.value);
                        localStorage.setItem('swaggerUrl', e.target.value);
                      }}
                      placeholder="Swagger JSON URL"
                      className="h-7 text-xs px-2 w-[220px] rounded-md border border-emerald-200 outline-none focus:border-emerald-400 text-gray-600"
                    />
                    <button onClick={handleAiRecommend} className="flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold px-3 h-7 rounded-md shadow-sm hover:from-emerald-600 hover:to-teal-600 transition-all">⚡ 타입 매칭 스펙 (V3)</button>
                    {mixMatchData && (
                      <button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-1 bg-white border border-emerald-500 text-emerald-600 text-xs font-semibold px-3 h-7 rounded-md shadow-sm hover:bg-emerald-50 transition-all">📋 V3 매칭 결과 보기</button>
                    )}
                  </div>

                  {/* 그룹 2 - 자동 추천 */}
                  <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-1.5">
                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wide mr-0.5">추천</span>
                    <button onClick={() => handleAutoRecommend(false)} className="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold px-3 h-7 rounded-md shadow-sm hover:from-purple-600 hover:to-pink-600 transition-all">✨ 자동</button>
                    <button onClick={() => handleAutoRecommend(true)} className="flex items-center gap-1 bg-gradient-to-r from-rose-500 to-orange-400 text-white text-xs font-semibold px-3 h-7 rounded-md shadow-sm hover:from-rose-600 hover:to-orange-500 transition-all">🌪 풀랜덤</button>
                  </div>

                  {/* 그룹 3 - 값 조작 */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-0.5">랜덤</span>
                    <button onClick={handleRandomizeAllOperators} className="text-xs text-fuchsia-600 bg-white border border-fuchsia-200 hover:bg-fuchsia-50 h-7 px-2.5 rounded-md transition-all">조건</button>
                    <button onClick={handleRandomizeAll} className="text-xs text-sky-600 bg-white border border-sky-200 hover:bg-sky-50 h-7 px-2.5 rounded-md transition-all">값</button>
                    <button onClick={handleRandomizeAllBoth} className="text-xs text-violet-600 bg-white border border-violet-200 hover:bg-violet-50 h-7 px-2.5 rounded-md font-semibold transition-all">조건+값</button>
                  </div>

                  {/* 그룹 4 - 삭제 */}
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide mr-0.5">삭제</span>
                    <button onClick={() => { if (confirm('모든 규칙을 초기화하시겠습니까?')) { setRules([]); setSelectedRuleIdx(null); } }} className="text-xs text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 h-7 px-2.5 rounded-md transition-all">초기화</button>
                    <button onClick={() => { const newRules = rules.filter(r => !r.selected); setRules(newRules); setSelectedRuleIdx(null); setHighlightPath(null); }} className="text-xs text-red-500 bg-white border border-red-200 hover:bg-red-50 h-7 px-2.5 rounded-md transition-all">선택 삭제</button>
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
                            {rule.isRecommended && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-sm whitespace-nowrap">스펙 추천</span>
                                {rule.sourceApi && (
                                  <span className="text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded font-medium border border-sky-100 truncate max-w-[200px]" title={rule.sourceApi}>
                                    from: {rule.sourceApi}
                                  </span>
                                )}
                              </div>
                            )}
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

      {/* API 등록 모달 */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">API 등록 및 저장</h2>
            <p className="text-sm text-gray-500 mb-6">현재 테스트 중인 URL, Method, 그리고 검증 규칙들을 저장소에 등록합니다.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">API 이름 <span className="text-red-500">*</span></label>
                <Input value={saveMeta.name} onChange={e => setSaveMeta({ ...saveMeta, name: e.target.value })} placeholder="예: 회원 프로필 조회 API" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">그룹 (태그)</label>
                <Input value={saveMeta.group} onChange={e => setSaveMeta({ ...saveMeta, group: e.target.value })} placeholder="예: User API" />
              </div>
              {/* V2: AI 유사 스펙 분석 버튼 */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleAiRecommend}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0"
                >
                  ⚡ 타입 매칭 스펙 (V3)
                </Button>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">설명</label>
                <Input value={saveMeta.description} onChange={e => setSaveMeta({ ...saveMeta, description: e.target.value })} placeholder="API에 대한 부가적인 설명" />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-8">
              <Button variant="outline" onClick={() => setIsSaveModalOpen(false)}>취소</Button>
              <Button onClick={handleSaveApi} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                {loading ? '저장 중...' : '저장하기'}
              </Button>
            </div>
          </div>
        </div>
      )}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              ⚡ V3 필드 타입 매칭 완료!
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-2">
              Swagger 스펙에서 1-depth 필드명과 타입이 일치하는 API 전체 목록입니다. 여러 API에서 실제 값을 추출하여 무작위로 섞었습니다!
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 overflow-y-auto max-h-[400px] border rounded-md">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0">
                <TableRow>
                  <TableHead className="w-[60px] text-center">순위</TableHead>
                  <TableHead className="w-[80px] text-center">매치 여부</TableHead>
                  <TableHead className="w-[80px]">Method</TableHead>
                  <TableHead className="w-[250px]">API Path</TableHead>
                  <TableHead>요약</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!mixMatchData?.matchedApis || mixMatchData.matchedApis.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-4">조건이 일치하는 매칭 API가 없습니다.</TableCell>
                  </TableRow>
                ) : (
                  mixMatchData.matchedApis.map((api: any, idx: number) => {
                    const usedRules = mixMatchData?.recommendedRules?.filter((rule: any) => rule.sourceApi === api.path) || [];
                    return (
                      <React.Fragment key={idx}>
                        <TableRow 
                          className="cursor-pointer hover:bg-gray-50 transition-colors" 
                          onClick={() => setExpandedApis(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                        >
                          <TableCell className="text-center font-medium">{idx + 1}</TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                              100% 매치
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${api.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                              {api.method}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{api.path}</TableCell>
                          <TableCell className="text-sm text-gray-600">{api.summary}</TableCell>
                          <TableCell className="text-right">
                            <span className="text-gray-400 text-xs">{expandedApis.includes(idx) ? '▲' : '▼'}</span>
                          </TableCell>
                        </TableRow>
                        {expandedApis.includes(idx) && (
                          <TableRow className="border-0 hover:bg-transparent">
                            <TableCell colSpan={6} className="p-0">
                              <div className="p-4 overflow-x-auto shadow-inner bg-gray-900">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-800 px-2 py-1 rounded">추출된 원본 데이터 (Extracted Data)</span>
                                </div>
                                <pre className="text-green-400 font-mono text-xs leading-relaxed pl-2">
                                  {JSON.stringify(api.extractedData || {}, null, 2)}
                                </pre>
                                {usedRules.length > 0 && (
                                  <div className="mt-4 pt-3 border-t border-gray-700">
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">🎯 최종 추천 룰에 채택된 필드</span>
                                    <div className="flex flex-wrap gap-2">
                                      {usedRules.map((rule: any, rIdx: number) => (
                                        <span key={rIdx} className="text-xs text-white bg-emerald-600 px-2 py-1 rounded-md font-medium shadow-sm">
                                          {rule.jsonPath.replace('$.', '')} <span className="text-emerald-200 ml-1 font-normal">({rule.exampleValue})</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInfoModalOpen} onOpenChange={setIsInfoModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">API 값 검증 V3 (타입 매칭 기반 믹스매치)</DialogTitle>
          </DialogHeader>
          
          <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mt-2 mb-6">
            <p className="text-sm text-blue-800 font-medium leading-relaxed">
              💡 타 API의 실제 응답 데이터를 활용해 검증 룰을 자동 조립하는 <strong>데이터 믹스 앤 매치(Mix &amp; Match) 엔진</strong>입니다.
            </p>
          </div>

          <div className="space-y-8 text-sm text-gray-800 leading-relaxed">
            {/* 5단계 동작 원리 */}
            <section>
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-3">V3 엔진의 5단계 동작 원리</h3>
              <ol className="list-decimal pl-5 space-y-3">
                <li>
                  <strong>타겟 스펙 파악 (기준점 설정)</strong>
                  <p className="text-gray-600 mt-1">타겟 API의 Swagger 스펙에서 200 성공 응답의 1-depth 필드 이름과 타입(예: userId: integer)을 추출합니다.</p>
                </li>
                <li>
                  <strong>Swagger 전체 순회 및 교집합 찾기</strong>
                  <p className="text-gray-600 mt-1">타겟 API <strong>자기 자신을 제외(continue)</strong>한 모든 API를 순회하며, 타겟 API와 '필드 이름'과 '데이터 타입'이 똑같은 필드를 반환하는 API들을 추려냅니다.</p>
                </li>
                <li>
                  <strong>후보 API 실제 호출 시도</strong>
                  <p className="text-gray-600 mt-1">추려진 후보 API들에게 빈 데이터(&#123;&#125;)를 활용해 실제로 HTTP 요청을 날려봅니다. (안전상 DELETE, Path Variable은 Skip)</p>
                </li>
                <li>
                  <strong>실제 데이터 조각 수집 (추출)</strong>
                  <p className="text-gray-600 mt-1">정상 응답이 온 후보 API에서 교집합에 해당하는 1-depth 필드의 실제 값만 뽑아와 룰 조각으로 만듭니다.</p>
                </li>
                <li>
                  <strong>믹스 앤 매치 (Mix &amp; Match)</strong>
                  <p className="text-gray-600 mt-1">각 필드별로 수집된 여러 API의 실제 값들 중 하나를 랜덤으로 뽑아, 최종적인 1-depth 테스트 룰 목록으로 조합하여 프론트엔드에 전달합니다.</p>
                </li>
              </ol>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsInfoModalOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
