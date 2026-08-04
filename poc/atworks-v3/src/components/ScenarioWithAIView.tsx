'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import RouteGraphView from './RouteGraphView';

interface ScenarioWithAIViewProps {
  rootPath: string;
  collections?: any[];
  apiItems?: any[];
  onSave?: () => void;
  onClose: () => void;
}

// Simple Markdown renderer (supports headers, bold, code, lists, tables, mermaid blocks)
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Mermaid code block
    if (line.trim().startsWith('```mermaid')) {
      const blockLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        blockLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-4 bg-[#1a1f2e] border border-blue-900/50 rounded-lg p-4 overflow-x-auto">
          <div className="text-xs text-blue-400 font-mono mb-2 flex items-center gap-1">
            <span>🗺️</span> Mermaid Diagram
          </div>
          <pre className="text-sm text-blue-300 font-mono whitespace-pre">{blockLines.join('\n')}</pre>
        </div>
      );
      i++;
      continue;
    }

    // Generic code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().replace('```', '').trim();
      const blockLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        blockLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-3 rounded-lg overflow-hidden border border-gray-700/50">
          {lang && (
            <div className="bg-gray-800 px-3 py-1 text-xs text-gray-400 font-mono border-b border-gray-700">
              {lang}
            </div>
          )}
          <pre className="bg-[#0d1117] text-sm text-gray-200 font-mono p-4 overflow-x-auto whitespace-pre">
            {blockLines.join('\n')}
          </pre>
        </div>
      );
      i++;
      continue;
    }

    // Table rows
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const isHeader = tableLines.length > 1 && tableLines[1].includes('---');
      const rows = tableLines.filter((_, idx) => !(isHeader && idx === 1));
      elements.push(
        <div key={i} className="my-4 overflow-x-auto rounded-lg border border-gray-700/50">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row, ri) => {
                const cells = row.split('|').slice(1, -1).map(c => c.trim());
                const isHead = ri === 0 && isHeader;
                return (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-[#1a1b1e]' : 'bg-[#16171a]'}>
                    {cells.map((cell, ci) =>
                      isHead ? (
                        <th key={ci} className="px-3 py-2 text-left text-xs font-bold text-gray-300 bg-gray-800/80 border-b border-gray-700">
                          {cell}
                        </th>
                      ) : (
                        <td key={ci} className="px-3 py-2 text-gray-300 border-b border-gray-800/50">
                          {renderInlineMarkdown(cell)}
                        </td>
                      )
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // H1
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-2xl font-extrabold text-white mt-10 mb-6 pb-3 border-b border-gray-700 flex items-center gap-3">
          <span className="text-purple-400">❖</span>
          {renderInlineMarkdown(line.slice(2))}
        </h1>
      );
    }
    // H2
    else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-blue-200 mt-10 mb-5 px-4 py-2.5 bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg shadow-sm">
          {renderInlineMarkdown(line.slice(3))}
        </h2>
      );
    }
    // H3
    else if (line.startsWith('### ')) {
      elements.push(
        <div key={`h3-${i}`} className="mt-8 mb-4">
          <Card.Header className="rounded-t-lg bg-[#1a1b1e]">
            <h3 className="text-base font-bold text-purple-300">
              {renderInlineMarkdown(line.slice(4))}
            </h3>
          </Card.Header>
          <div className="h-0.5 bg-gradient-to-r from-purple-800/60 to-transparent"></div>
        </div>
      );
    }
    // H4
    else if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={i} className="text-sm font-bold text-green-300 mt-5 mb-2 px-2 border-l-2 border-green-500/50">
          {renderInlineMarkdown(line.slice(5))}
        </h4>
      );
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-yellow-500/60 bg-yellow-900/10 px-4 py-3 my-4 rounded-r-lg text-sm text-yellow-200/90 italic shadow-sm">
          {renderInlineMarkdown(line.slice(2))}
        </blockquote>
      );
    }
    // Horizontal rule
    else if (line.trim() === '---') {
      elements.push(<div key={i} className="my-8 border-t border-dashed border-gray-700" />);
    }
    // List item
    else if (line.match(/^(\s*)([-*+]|\d+\.) /)) {
      const depth = line.search(/\S/) / 2;
      const text = line.replace(/^\s*[-*+\d.]+\s/, '');
      const isTopLevel = depth === 0;
      elements.push(
        <div 
          key={i} 
          className={`flex items-start gap-2.5 my-1.5 text-sm text-gray-300 transition-colors p-2 rounded-md ${isTopLevel ? 'bg-[#16171a] border border-gray-800/60' : 'hover:bg-[#1a1b1e]'}`} 
          style={{ marginLeft: depth === 0 ? 0 : depth * 16 + 8 }}
        >
          <span className={`mt-0.5 shrink-0 select-none ${isTopLevel ? 'text-purple-500' : 'text-blue-500/70'}`}>
            {isTopLevel ? '▶' : '•'}
          </span>
          <span className="leading-relaxed flex-1">{renderInlineMarkdown(text)}</span>
        </div>
      );
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={i} className="h-3" />);
    }
    // Normal paragraph
    else {
      elements.push(
        <p key={i} className="text-sm text-gray-300 my-1 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    }

    i++;
  }

  return <div className="leading-relaxed">{elements}</div>;
}


function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Inline code
  const codeRegex = /`([^`]+)`/g;
  const boldRegex = /\*\*([^*]+)\*\*/g;

  // Process both patterns
  const allTokens: { start: number; end: number; node: React.ReactNode }[] = [];

  let m: RegExpExecArray | null;

  const methodRegex = /\b(GET|POST|PUT|DELETE|PATCH)\b/g;
  const methodCopy = new RegExp(methodRegex.source, 'g');
  while ((m = methodCopy.exec(text)) !== null) {
    let variant: 'success' | 'primary' | 'destructive' | 'default' = 'default';
    if (m[1] === 'GET') variant = 'success';
    else if (m[1] === 'POST' || m[1] === 'PUT' || m[1] === 'PATCH') variant = 'primary';
    else if (m[1] === 'DELETE') variant = 'destructive';
    
    allTokens.push({
      start: m.index,
      end: m.index + m[0].length,
      node: <Badge key={key++} variant={variant}>{m[1]}</Badge>,
    });
  }

  const codeCopy = new RegExp(codeRegex.source, 'g');
  while ((m = codeCopy.exec(text)) !== null) {
    // Only add if not overlapping with existing token
    if (!allTokens.some(t => t.start < m!.index + m![0].length && t.end > m!.index)) {
      allTokens.push({
        start: m.index,
        end: m.index + m[0].length,
        node: <code key={key++} className="bg-gray-800 text-orange-300 px-1.5 py-0.5 rounded text-xs font-mono">{m[1]}</code>,
      });
    }
  }
  const boldCopy = new RegExp(boldRegex.source, 'g');
  while ((m = boldCopy.exec(text)) !== null) {
    // Only add if not overlapping with existing token
    if (!allTokens.some(t => t.start < m!.index + m![0].length && t.end > m!.index)) {
      allTokens.push({
        start: m.index,
        end: m.index + m[0].length,
        node: <strong key={key++} className="font-bold text-white">{m[1]}</strong>,
      });
    }
  }

  allTokens.sort((a, b) => a.start - b.start);

  let cursor = 0;
  for (const token of allTokens) {
    if (token.start > cursor) {
      parts.push(text.slice(cursor, token.start));
    }
    parts.push(token.node);
    cursor = token.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return parts.length === 0 ? text : <>{parts}</>;
}

const DEFAULT_API_LOGS = `{
  "GET__api_cart": {
    "timestamp": "2026-08-04T02:05:33.225Z",
    "endpoint": "/api/cart",
    "method": "GET",
    "request": {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "connection": "keep-alive",
        "cookie": "__next_hmr_refresh_hash__=111",
        "host": "localhost:3002",
        "referer": "http://localhost:3002/",
        "sec-ch-ua": "\\"Not;A=Brand\\";v=\\"8\\", \\"Chromium\\";v=\\"150\\", \\"Google Chrome\\";v=\\"150\\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\\"Windows\\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        "x-forwarded-for": "::1",
        "x-forwarded-host": "localhost:3002",
        "x-forwarded-port": "3002",
        "x-forwarded-proto": "http"
      },
      "body": null
    },
    "response": {
      "status": 200,
      "headers": {
        "content-type": "application/json"
      },
      "body": []
    }
  },
  "POST__api_cart": {
    "timestamp": "2026-08-03T06:36:43.317Z",
    "endpoint": "/api/cart",
    "method": "POST",
    "request": {
      "headers": {
        "accept": "*/*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "connection": "keep-alive",
        "content-length": "498",
        "content-type": "application/json",
        "host": "localhost:3002",
        "origin": "http://localhost:3005",
        "referer": "http://localhost:3005/",
        "sec-ch-ua": "\\"Not;A=Brand\\";v=\\"8\\", \\"Chromium\\";v=\\"150\\", \\"Google Chrome\\";v=\\"150\\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\\"Windows\\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        "x-forwarded-for": "::1",
        "x-forwarded-host": "localhost:3002",
        "x-forwarded-port": "3002",
        "x-forwarded-proto": "http"
      },
      "body": {
        "product": {
          "id": "prod-2",
          "name": "북유럽 감성 미니멀 스탠드 조명",
          "category": "living",
          "price": 89000,
          "originalPrice": 110000,
          "rating": 4.7,
          "reviewCount": 84,
          "image": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80",
          "description": "아늑한 분위기를 연출해 주는 스마트 터치 스탠드 조명입니다. 3단계 조도 조절 가능.",
          "isNew": true
        },
        "quantity": 1
      }
    },
    "response": {
      "status": 200,
      "headers": {
        "content-type": "application/json"
      },
      "body": {
        "success": true,
        "cart": [
          {
            "product": {
              "id": "prod-2",
              "name": "북유럽 감성 미니멀 스탠드 조명",
              "category": "living",
              "price": 89000,
              "originalPrice": 110000,
              "rating": 4.7,
              "reviewCount": 84,
              "image": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80",
              "description": "아늑한 분위기를 연출해 주는 스마트 터치 스탠드 조명입니다. 3단계 조도 조절 가능.",
              "isNew": true
            },
            "quantity": 1
          }
        ]
      }
    }
  },
  "GET__api_products": {
    "timestamp": "2026-08-03T06:36:43.270Z",
    "endpoint": "/api/products",
    "method": "GET",
    "request": {
      "headers": {
        "accept": "*/*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "connection": "keep-alive",
        "host": "localhost:3002",
        "origin": "http://localhost:3005",
        "referer": "http://localhost:3005/",
        "sec-ch-ua": "\\"Not;A=Brand\\";v=\\"8\\", \\"Chromium\\";v=\\"150\\", \\"Google Chrome\\";v=\\"150\\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\\"Windows\\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        "x-forwarded-for": "::1",
        "x-forwarded-host": "localhost:3002",
        "x-forwarded-port": "3002",
        "x-forwarded-proto": "http"
      },
      "body": null
    },
    "response": {
      "status": 200,
      "headers": {
        "content-type": "application/json"
      },
      "body": [
        {
          "id": "prod-1",
          "name": "프리미엄 무선 노이즈캔슬링 헤드폰 X1",
          "category": "electronics",
          "price": 349000,
          "originalPrice": 399000,
          "rating": 4.9,
          "reviewCount": 128,
          "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
          "description": "몰입감 넘치는 사운드와 강력한 노이즈 캔슬링 기술이 적용된 프리미엄 무선 헤드폰입니다. 최대 30시간 지속 배터리 탑재.",
          "isBest": true
        },
        {
          "id": "prod-2",
          "name": "북유럽 감성 미니멀 스탠드 조명",
          "category": "living",
          "price": 89000,
          "originalPrice": 110000,
          "rating": 4.7,
          "reviewCount": 84,
          "image": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80",
          "description": "아늑한 분위기를 연출해 주는 스마트 터치 스탠드 조명입니다. 3단계 조도 조절 가능.",
          "isNew": true
        }
      ]
    }
  }
}`;

export default function ScenarioWithAIView({ rootPath, collections = [], apiItems = [], onSave, onClose }: ScenarioWithAIViewProps) {
  const [targetPath, setTargetPath] = useState(rootPath || 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\shopping-mall-next-js');
  const [referenceLog, setReferenceLog] = useState(DEFAULT_API_LOGS);
  const [loadedLogFileName, setLoadedLogFileName] = useState('api_logs.json');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [markdown, setMarkdown] = useState<string>('');
  const [scenariosList, setScenariosList] = useState<any[]>([]);
  const [screensCount, setScreensCount] = useState(0);
  const [staticReport, setStaticReport] = useState<string>('');
  const [projectName, setProjectName] = useState('');
  const [apps, setApps] = useState<any[]>([]);
  const [activeAppIndex, setActiveAppIndex] = useState(0);
  const [apiLogs, setApiLogs] = useState<any>(null);
  const [phase, setPhase] = useState<'idle' | 'static' | 'ai' | 'done'>('idle');
  const [staticViewTab, setStaticViewTab] = useState<'graph' | 'list'>('graph');
  const [graphFocusRoute, setGraphFocusRoute] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logFileInputRef = useRef<HTMLInputElement>(null);

  // Save Modal States
  const [savingScenario, setSavingScenario] = useState<any>(null);
  const [targetCollectionId, setTargetCollectionId] = useState<string>('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isSavingToCollection, setIsSavingToCollection] = useState(false);
  
  // 모달 내 컬렉션 실시간 갱신용 상태
  const [localCollections, setLocalCollections] = useState<any[]>(collections || []);
  const [isRefreshingCollections, setIsRefreshingCollections] = useState(false);

  // Browser Test Execution States
  const [isExecuteModalOpen, setIsExecuteModalOpen] = useState(false);
  const [executingScenarioIndex, setExecutingScenarioIndex] = useState<number | null>(null);
  const [executingTargetUrl, setExecutingTargetUrl] = useState('http://localhost:3002');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeLogs, setExecuteLogs] = useState<{type: string, message: string}[]>([]);
  const [executeVideoUrl, setExecuteVideoUrl] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const executeAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executeLogs]);

  useEffect(() => {
    setLocalCollections(collections || []);
  }, [collections]);

  useEffect(() => {
    if (executingScenarioIndex !== null) {
      setExecuteLogs([]);
      setExecuteVideoUrl(null);
    }
  }, [executingScenarioIndex]);

  const refreshCollections = async () => {
    setIsRefreshingCollections(true);
    try {
      const res = await fetch('http://localhost:3001/collections');
      const data = await res.json();
      setLocalCollections(data);
    } catch (e) {
      console.warn('Failed to refresh collections', e);
    } finally {
      setIsRefreshingCollections(false);
    }
  };

  const handleLogFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setReferenceLog(content);
        setLoadedLogFileName(file.name);
      }
    };
    reader.readAsText(file);
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleAnalyzeAndGenerateAI = async () => {
    if (!targetPath.trim()) return;
    setIsAnalyzing(true);
    setMarkdown('');
    setScenariosList([]);
    
    abortControllerRef.current = new AbortController();

    try {
      setPhase('static');
      const staticRes = await fetch('/api/analyze/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetPath, action: 'static' }),
      });
      const staticData = await staticRes.json();

      if (!staticRes.ok) {
        toast.error(staticData.error || '분석 중 오류가 발생했습니다.');
        setPhase('idle');
        return;
      }

      const parsedApps = staticData.apps || [];
      const totalScreens = parsedApps.reduce((acc: number, app: any) => acc + (app.screens?.length || 0), 0);

      setApps(parsedApps);
      setScreensCount(totalScreens);
      setActiveAppIndex(0);
      setStaticReport(staticData.staticReport || '');
      setProjectName(staticData.projectName || '');
      setApiLogs(staticData.apiLogs || null);
      toast.success('라우팅 분석이 완료되었습니다. 이어서 AI 분석을 시작합니다!');

      // AI Generate phase
      setPhase('ai');
      const aiRes = await fetch('/api/analyze/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai', staticReport: staticData.staticReport, projectName: staticData.projectName, referenceLog }),
        signal: abortControllerRef.current.signal
      });
      const aiData = await aiRes.json();

      if (!aiRes.ok) {
        if (aiData.rawOutput) {
          toast.error('AI가 유효한 JSON을 반환하지 않았습니다. 원본 응답을 화면에 표시합니다.');
          setMarkdown(aiData.rawOutput);
          setPhase('done');
          return;
        }
        toast.error(aiData.error || 'AI 생성 중 오류가 발생했습니다.');
        setMarkdown(staticData.staticReport);
        setPhase('done');
        return;
      }

      if (aiData.scenarios) {
        setScenariosList(aiData.scenarios);
        setMarkdown('');
      } else {
        setMarkdown(aiData.markdown || aiData.rawOutput || '');
      }
      setPhase('done');
      toast.success(`AI 시나리오 생성 완료!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '오류가 발생했습니다.');
      setPhase('idle');
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
    setPhase('idle');
    toast.success('분석이 취소되었습니다.');
  };

  const handleAnalyze = async () => {
    if (!targetPath.trim()) return;
    setIsAnalyzing(true);
    setMarkdown('');
    setScenariosList([]);
    setPhase('static');

    try {
      setPhase('static');
      abortControllerRef.current = new AbortController();
      const res = await fetch('/api/analyze/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: targetPath, action: 'static' }),
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '분석 중 오류가 발생했습니다.');
        setPhase('idle');
        return;
      }

      const parsedApps = data.apps || [];
      const totalScreens = parsedApps.reduce((acc: number, app: any) => acc + (app.screens?.length || 0), 0);

      setApps(parsedApps);
      setScreensCount(totalScreens);
      setActiveAppIndex(0);
      setStaticReport(data.staticReport || '');
      setProjectName(data.projectName || '');
      toast.success('라우팅 분석이 완료되었습니다!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '분석 중 오류가 발생했습니다.');
      setPhase('idle');
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processZipFile(file);
  };

  const processZipFile = async (file: File) => {
    if (!file) return;
    
    setIsAnalyzing(true);
    setPhase('static');
    setApps([]);
    setStaticReport('');
    setMarkdown('');
    setScenariosList([]);
    setScreensCount(0);
    setProjectName('');
    setActiveAppIndex(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/analyze/scenario', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const parsedApps = data.apps || [];
      const totalScreens = parsedApps.reduce((acc: number, app: any) => acc + (app.screens?.length || 0), 0);

      setApps(parsedApps);
      setScreensCount(totalScreens);
      setActiveAppIndex(0);
      setStaticReport(data.staticReport);
      setProjectName(data.projectName || file.name.replace('.zip', ''));
      toast.success('ZIP 라우팅 분석이 완료되었습니다!');
    } catch (err: any) {
      toast.error(err.message || 'ZIP 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
      // 리셋
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCopyRoute = (sc: any, userActions: any[], componentActions: any[]) => {
    let text = `### 라우트: ${sc.route || '/'} (${sc.page})\n`;
    
    if (sc.onEnterApis?.length) {
      text += `\n**[진입 시 API]**\n` + sc.onEnterApis.map((api: any) => `- ${api.method} ${api.url} (L${api.line})`).join('\n') + '\n';
    }
    
    if (userActions.length) {
      text += `\n**[사용자 액션]**\n` + userActions.map((a: any) => {
        let t = `- ${a.trigger}`;
        if (a.handlerName && a.handlerName !== '(inline)') t += ` → ${a.handlerName}`;
        if (a.apis?.length) t += `\n  - API: ` + a.apis.map((api: any) => `${api.method} ${api.url} (L${api.line})`).join(', ');
        if (a.navigations?.length) t += `\n  - 이동: ` + a.navigations.join(', ');
        return t;
      }).join('\n') + '\n';
    }
    
    if (componentActions.length) {
      text += `\n**[하위 컴포넌트 API]**\n` + componentActions.map((a: any) => {
        let t = `- ${a.handlerName}`;
        if (a.apis?.length) t += `\n  - API: ` + a.apis.map((api: any) => `${api.method} ${api.url} (L${api.line})`).join(', ');
        return t;
      }).join('\n') + '\n';
    }
    
    if (sc.navigations?.length) {
      text += `\n**[페이지 이동]**\n` + sc.navigations.map((nav: string) => `- → ${nav}`).join('\n') + '\n';
    }
    
    navigator.clipboard.writeText(text.trim()).then(() => {
      toast.success(`${sc.route || '/'} 라우트 정보가 복사되었습니다!`);
    });
  };

  const handleGenerateAI = async () => {
    if (!staticReport) return;
    setIsAnalyzing(true);
    setPhase('ai');
    setMarkdown('');
    setScenariosList([]);
    try {
      const res = await fetch('/api/analyze/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai', staticReport, projectName, referenceLog }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.rawOutput) {
          toast.error('AI가 유효한 JSON을 반환하지 않았습니다. 원본 응답을 화면에 표시합니다.');
          setMarkdown(data.rawOutput);
          setPhase('done');
          return;
        }
        throw new Error(data.error);
      }

      if (data.scenarios) {
        setScenariosList(data.scenarios);
      } else {
        setMarkdown(data.markdown || data.rawOutput || '');
      }
      setPhase('done');
      toast.success(`AI 시나리오 도출 완료!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '오류가 발생했습니다.');
      setPhase('static');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecuteSaveToCollection = async () => {
    if (!savingScenario) return;
    
    // Validate
    if (targetCollectionId === 'new' && !newCollectionName.trim()) {
      toast.error('새 컬렉션 이름을 입력해주세요.');
      return;
    }
    if (!targetCollectionId) {
      toast.error('저장할 컬렉션을 선택해주세요.');
      return;
    }

    setIsSavingToCollection(true);
    try {
      // 실시간 로그 조회 (저장 시점)
      let currentLogs = null;
      try {
        const logRes = await fetch('/api/analyze/scenario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootPath: targetPath, action: 'get-logs' }),
        });
        const logData = await logRes.json();
        if (logData.apiLogs) {
          currentLogs = logData.apiLogs;
        }
      } catch (e) {
        console.warn('Failed to fetch realtime logs', e);
      }

      let finalCollectionId = targetCollectionId;

      // 1. 새 컬렉션 생성
      if (targetCollectionId === 'new') {
        const colRes = await fetch('http://localhost:3001/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: Math.random().toString(36).substring(7),
            name: newCollectionName.trim(),
            mode: 'chaining'
          })
        });
        const newCol = await colRes.json();
        finalCollectionId = newCol.id;
      }

      // 2. 스텝 순회하며 API 아이템 등록
      let count = 0;
      const savedApis: any[] = [];
      const allSteps = savingScenario.steps || savingScenario.flow || savingScenario.actions || savingScenario.scenario || [];
      
      for (const step of allSteps) {
        const stepApis = step.apis || step.apiCalls || step.triggered_apis || (step.api_call ? [step.api_call] : step.apiCall ? [step.apiCall] : step.api ? [step.api] : []);
        
        for (const apiData of stepApis) {
          if (!apiData) continue;

          let endpoint = typeof apiData === 'string' ? apiData : (apiData.endpoint || apiData.url);
          let method = typeof apiData === 'string' ? 'GET' : (apiData.method || 'GET');

          if (typeof apiData === 'string') {
            const parts = apiData.trim().split(/\s+/);
            if (parts.length >= 2 && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(parts[0].toUpperCase())) {
              method = parts[0].toUpperCase();
              endpoint = parts.slice(1).join(' ');
            }
          }

          if (!endpoint) continue;

          // API 이름은 엔드포인트 기반 또는 설명 기반
          const apiName = `[Step ${step.step || step.sequence || ''}] ${method} ${endpoint.split('?')[0]}`.replace(/\[Step \]\s*/, '');
          
          let bodyStr = '';
          let finalEndpoint = endpoint;
          if (currentLogs) {
            const rawEndpoint = endpoint.split('?')[0];
            const searchEndpoint = rawEndpoint.startsWith('/') ? rawEndpoint : `/${rawEndpoint}`;
            for (const key of Object.keys(currentLogs)) {
              if (currentLogs[key].method === method && currentLogs[key].endpoint === searchEndpoint) {
                if (currentLogs[key].request?.body) {
                  bodyStr = typeof currentLogs[key].request.body === 'string' ? currentLogs[key].request.body : JSON.stringify(currentLogs[key].request.body, null, 2);
                }
                // 매칭된 로그에서 호스트 정보를 가져옴
                const host = currentLogs[key].request?.headers?.host || 'localhost:3002';
                const proto = currentLogs[key].request?.headers?.['x-forwarded-proto'] || 'http';
                
                // AI가 생성한 템플릿 URL 대신, 로그에 찍힌 '진짜' 완벽한 엔드포인트(파라미터 포함)를 사용합니다.
                const actualEndpoint = currentLogs[key].endpoint; 
                finalEndpoint = `${proto}://${host}${actualEndpoint.startsWith('/') ? '' : '/'}${actualEndpoint}`;
                break;
              }
            }
          }

          // 로그에 매칭되지 않더라도, 상대경로라면 기본 백엔드 주소를 붙여줌 (404 방지)
          if (!finalEndpoint.startsWith('http')) {
            finalEndpoint = `http://localhost:3002${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
          }
          
          await fetch('http://localhost:3001/apiItems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: Math.random().toString(36).substring(7),
              collectionId: finalCollectionId,
              name: apiName,
              method: method,
              url: finalEndpoint,
              body: bodyStr
            })
          });
          savedApis.push({ name: apiName, method, url: finalEndpoint });
          count++;
        }
      }

      if (count > 0) {
        console.log(`[Collection Save Success] '${savingScenario.title}' 시나리오에서 저장된 API 목록:`, savedApis);
        toast.success(`'${savingScenario.title}' 시나리오에서 ${count}개의 API가 컬렉션에 등록되었습니다!`);
      } else {
        toast.error('저장할 API 항목을 찾지 못했습니다.');
      }
      
      if (onSave) onSave();
      setSavingScenario(null);
      setTargetCollectionId('');
      setNewCollectionName('');
    } catch (err) {
      console.error(err);
      toast.error('컬렉션 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingToCollection(false);
    }
  };

  const handleStartExecution = async () => {
    if (executingScenarioIndex === null) return;
    const scenario = scenariosList[executingScenarioIndex];
    
    setIsExecuting(true);
    setExecuteLogs([]);
    setExecuteVideoUrl(null);
    executeAbortControllerRef.current = new AbortController();
    
    try {
      const res = await fetch('/api/execute-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: executingTargetUrl, scenario }),
        signal: executeAbortControllerRef.current.signal
      });
      
      if (!res.body) throw new Error('No readable stream');
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'video') {
              setExecuteVideoUrl(data.url);
            } else {
              setExecuteLogs(prev => [...prev, { type: data.type, message: data.message }]);
            }
          } catch (e) {
            console.error('Failed to parse log line', line);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      toast.error('테스트 실행 중 오류가 발생했습니다.');
      setExecuteLogs(prev => [...prev, { type: 'error', message: err.message || 'Unknown error' }]);
    } finally {
      setIsExecuting(false);
      executeAbortControllerRef.current = null;
    }
  };

  const handleCopy = () => {
    const textToCopy = scenariosList.length > 0 ? JSON.stringify(scenariosList, null, 2) : markdown;
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success('클립보드에 복사되었습니다!');
    });
  };

  const handleCopyStatic = () => {
    navigator.clipboard.writeText(staticReport).then(() => {
      toast.success('라우팅 분석(정적 분석) 결과가 클립보드에 복사되었습니다!');
    });
  };
  const handleTargetChange = (newPath: string) => {
    setTargetPath(newPath);
    setPhase('idle');
    setStaticReport('');
    setApps([]);
    setScenariosList([]);
    setMarkdown('');
    setActiveAppIndex(0);
  };

  const handleDownload = () => {
    const content = scenariosList.length > 0 ? JSON.stringify(scenariosList, null, 2) : markdown;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = scenariosList.length > 0 ? 'scenarios.json' : 'project-analysis.md';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('다운로드 완료!');
  };

  const renderRouteDetails = (screensList: any[]) => {
    return screensList.map((sc: any, idx: number) => {
      // Find all APIs from component/handler triggers that were filtered out from user actions
      const systemActions = (sc.actions || []).filter((a: any) => 
        a.trigger === '(component)' || a.trigger === '(handler)'
      );
      const systemApis = systemActions.flatMap((a: any) => 
        (a.apis || a.triggered_apis || []).map((api: any) => ({
          ...api,
          __source: a.handlerName && a.handlerName !== '(inline)' ? a.handlerName : (a.description || a.trigger)
        }))
      );
      
      const onEnterApis: any[] = [
        ...(sc.onEnterApis || []).map((api: any) => ({ ...api, __source: '초기 렌더링(Root)' })), 
        ...systemApis
      ];
      
      const allNavs: string[] = [
        ...(sc.navigations || []),
        ...((sc.actions || []).flatMap((a: any) => a.navigations || [])),
      ];
      const userActions = (sc.actions || []).filter((a: any) => 
        a.trigger && 
        a.trigger !== '(component)' && 
        a.trigger !== '(handler)' &&
        (
          ((a.apis && a.apis.length > 0) || (a.triggered_apis && a.triggered_apis.length > 0)) || 
          (a.navigations && a.navigations.length > 0) || 
          (a.handlerName && a.handlerName !== '(inline)')
        )
      );
      
      return (
        <details 
          key={idx} 
          id={`route-block-${sc.route || '/'}`}
          className="bg-[#1a1c21] rounded-xl border border-gray-700/50 shadow-sm transition-all duration-500 hover:border-purple-500/30 group overflow-hidden mb-4"
        >
          <summary 
            className="flex items-center justify-between p-4 cursor-pointer outline-none select-none list-none [&::-webkit-details-marker]:hidden"
            onClick={() => {
              const el = document.getElementById(`route-block-${sc.route || '/'}`);
              if (el) {
                el.classList.add('ring-2', 'ring-purple-500', 'bg-purple-900/10');
                setTimeout(() => {
                  el.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-900/10');
                }, 1500);
              }
            }}
          >
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-purple-900/20 text-purple-400 border-purple-800/50">
                Screen {idx + 1}
              </Badge>
              <h5 className="font-mono text-sm font-bold text-gray-200">
                {sc.route || '/'}
              </h5>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-purple-900/40 text-purple-300 border border-purple-700/50 hover:bg-purple-800/50 hover:border-purple-500/60 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setGraphFocusRoute(sc.route || '/');
                  setStaticViewTab('graph');
                }}
                title="플로우 맵에서 이 화면 위치로 이동"
              >
                🗺 맵에서 보기
              </button>
              <div className="text-gray-500 text-xs transition-transform duration-300 group-open:rotate-180">
                ▼
              </div>
            </div>
          </summary>

          <div className="p-4 pt-0 space-y-4 border-t border-gray-700/30 mt-2">
            {/* 진입 시 자동 호출 API */}
            {onEnterApis.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-400 mb-2">🚀 진입 시 호출 (onEnter)</h6>
                <div className="space-y-2">
                  {onEnterApis.map((api: any, ai: number) => (
                    <div key={ai} className="flex flex-col gap-1.5 p-2.5 rounded bg-gray-800/50 border border-gray-700/50">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 border border-blue-800/50">
                          {api.method || 'GET'}
                        </span>
                        <span className="font-mono text-xs text-blue-200 break-all">
                          {api.endpoint || api.url || 'URL 없음'}
                        </span>
                      </div>
                      {(api.purpose || api.description) && (
                        <p className="text-[10px] text-gray-400 leading-snug">
                          {api.purpose || api.description}
                        </p>
                      )}
                      {(api.__source || api.line || api.file || api.filePath) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400 font-mono bg-gray-900/60 w-fit px-2 py-1 rounded border border-gray-700/50">
                          <span className="text-[10px]">⚡</span> 
                          <span>출처: <span className="text-gray-300 font-semibold">{api.__source || '초기 렌더링(Root)'}</span></span>
                          {(api.line || api.file || api.filePath) && (
                            <>
                              <span className="text-gray-600 mx-0.5">|</span>
                              <span className="text-gray-400 flex items-center gap-1">
                                {(api.file || api.filePath) && <span>📄 {(api.file || api.filePath).split('/').pop()?.split('\\').pop()}</span>}
                                {api.line && <span className="text-gray-500">L{api.line}</span>}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 사용자 액션 */}
            {userActions.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-400 mb-2">🖱 사용자 인터랙션</h6>
                <div className="space-y-2">
                  {userActions.map((act: any, aci: number) => (
                    <div key={aci} className="flex flex-col gap-2 p-2.5 rounded bg-gray-800/30 border border-gray-700/30">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="bg-gray-700/50 text-gray-300 text-[10px] hover:bg-gray-700/50">
                          {act.trigger}
                        </Badge>
                        {act.handlerName && act.handlerName !== '(inline)' && (
                          <span className="font-mono text-[10px] text-orange-300/80">
                            {act.handlerName}
                          </span>
                        )}
                        <span className="text-xs text-gray-300">
                          {act.description}
                        </span>
                      </div>
                      
                      {(act.apis || act.triggered_apis) && (act.apis || act.triggered_apis).length > 0 && (
                        <div className="ml-2 pl-2 border-l border-gray-700 space-y-1.5">
                          {(act.apis || act.triggered_apis).map((api: any, aai: number) => {
                            const methodColor = 
                              api.method === 'GET' ? 'text-blue-400 bg-blue-900/30 border-blue-800/50' : 
                              api.method === 'POST' ? 'text-green-400 bg-green-900/30 border-green-800/50' :
                              api.method === 'PUT' ? 'text-yellow-400 bg-yellow-900/30 border-yellow-800/50' :
                              api.method === 'DELETE' ? 'text-red-400 bg-red-900/30 border-red-800/50' :
                              'text-gray-400 bg-gray-900/30 border-gray-800/50';
                              
                            return (
                              <div key={aai} className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${methodColor}`}>
                                    {api.method}
                                  </span>
                                  <span className="font-mono text-[11px] text-gray-300 break-all">
                                    {api.endpoint}
                                  </span>
                                </div>
                                {api.purpose && (
                                  <p className="text-[10px] text-gray-500 pl-1">
                                    {api.purpose}
                                  </p>
                                )}
                                {(api.line || api.file || api.filePath) && (
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-gray-400 font-mono bg-gray-900/60 w-fit px-1.5 py-0.5 rounded border border-gray-700/50">
                                    {(api.file || api.filePath) && <span>📄 {(api.file || api.filePath).split('/').pop()?.split('\\').pop()}</span>}
                                    {api.line && <span className="text-gray-500">L{api.line}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {act.navigations && act.navigations.length > 0 && (
                        <div className="ml-2 pl-2 mt-2 border-l-2 border-green-800/50 space-y-2">
                          <span className="text-[9px] font-bold text-green-500/70 uppercase tracking-wider">Navigates To</span>
                          <div className="flex flex-wrap gap-2">
                            {act.navigations.map((nav: string, ani: number) => (
                              <div 
                                key={ani} 
                                className="flex items-center group/nav bg-gradient-to-r from-green-900/20 to-transparent border border-green-800/30 rounded-lg px-2.5 py-1.5 w-fit hover:border-green-500/50 hover:from-green-900/40 transition-all cursor-pointer relative overflow-hidden"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGraphFocusRoute(nav.split('?')[0].replace(/\{[^}]+\}/g, ':param'));
                                  setStaticViewTab('graph');
                                }}
                                title="클릭하여 맵에서 해당 화면 위치로 이동"
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                                <div className="w-5 h-5 rounded-md bg-green-900/50 flex items-center justify-center mr-2.5 z-10 shrink-0">
                                  <span className="text-green-400 text-[10px]">🧭</span>
                                </div>
                                <div className="flex flex-col z-10">
                                  <span className="text-[8px] font-bold text-green-500/70 uppercase tracking-widest leading-none mb-0.5">
                                    Navigate To
                                  </span>
                                  <span className="text-[10px] font-mono text-green-300 break-all max-w-[280px]">
                                    {nav}
                                  </span>
                                </div>
                                <div className="ml-3 z-10 text-green-600 group-hover:text-green-400 group-hover:translate-x-1 transition-all">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 독립적인 화면 이동 (actions 없이 정의된 경우) */}
            {sc.navigations && sc.navigations.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-400 mb-2">🔗 화면 이동</h6>
                <div className="flex flex-wrap gap-2">
                  {sc.navigations.map((nav: string, ni: number) => (
                    <div 
                      key={ni} 
                      className="flex items-center group/nav bg-gradient-to-r from-green-900/20 to-transparent border border-green-800/30 rounded-lg px-2.5 py-1.5 w-fit hover:border-green-500/50 hover:from-green-900/40 transition-all cursor-pointer relative overflow-hidden mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGraphFocusRoute(nav.split('?')[0].replace(/\{[^}]+\}/g, ':param'));
                        setStaticViewTab('graph');
                      }}
                      title="클릭하여 맵에서 해당 화면 위치로 이동"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                      <div className="w-5 h-5 rounded-md bg-green-900/50 flex items-center justify-center mr-2.5 z-10 shrink-0">
                        <span className="text-green-400 text-[10px]">🧭</span>
                      </div>
                      <div className="flex flex-col z-10">
                        <span className="text-[8px] font-bold text-green-500/70 uppercase tracking-widest leading-none mb-0.5">
                          Navigate To
                        </span>
                        <span className="text-[10px] font-mono text-green-300 break-all max-w-[280px]">
                          {nav}
                        </span>
                      </div>
                      <div className="ml-3 z-10 text-green-600 group-hover:text-green-400 group-hover:translate-x-1 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      );
    });
  };


  return (
    <div 
      className={`flex-1 flex flex-col bg-[#1e1e1e] text-white overflow-hidden relative transition-colors ${isDragging ? 'ring-2 ring-purple-500 bg-purple-900/10' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
          if (file.name.endsWith('.zip')) {
            await processZipFile(file);
          } else {
            toast.error('ZIP 파일만 분석 가능합니다.');
          }
        }
      }}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-purple-900/40 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-dashed border-purple-500 m-2 rounded-lg">
          <div className="text-center">
            <div className="text-6xl mb-4">📁</div>
            <h2 className="text-2xl font-bold text-white mb-2">여기에 ZIP 파일을 놓아주세요</h2>
            <p className="text-purple-200">자동으로 분석이 시작됩니다</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#252628] border-b border-gray-800 shadow-sm shrink-0">
        <h2 className="text-lg font-bold flex items-center gap-2 text-purple-300">
          <span>🤖</span>
          시나리오 with AI
        </h2>
        <div className="flex items-center gap-2">
          {staticReport && (
            <button onClick={handleCopyStatic} className="text-xs bg-blue-900/40 border border-blue-700/50 hover:bg-blue-800/60 text-blue-300 hover:text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 mr-2">
              <span>📋</span> 라우팅 분석 복사
            </button>
          )}
          {(markdown || scenariosList.length > 0) && (
            <>
              <button onClick={handleCopy} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5">
                <span>📋</span> AI 시나리오 복사
              </button>
              <button onClick={handleDownload} className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5">
                <span>⬇️</span> project-analysis.md 저장
              </button>
            </>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 bg-gray-800 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>

      <div className="p-4 bg-[#202124] border-b border-gray-800 flex flex-col gap-3 shadow-md z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-[#121316] border border-gray-700 rounded-md overflow-hidden">
            <span className="px-3 text-gray-500 text-sm border-r border-gray-700 bg-gray-800/50 whitespace-nowrap">타겟 프로젝트</span>
            <input 
              type="text" 
              value={targetPath}
              onChange={(e) => handleTargetChange(e.target.value)}
              placeholder="예: C:\Users\lee\Desktop\my-react-app (절대경로 입력)"
              className="flex-1 bg-transparent text-sm text-gray-200 px-3 py-2 focus:outline-none"
              spellCheck="false"
            />
          </div>
          <input 
            type="file" 
            accept=".zip" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleZipUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-200 font-bold py-2 px-4 rounded-md transition-colors shadow-sm flex items-center gap-2 border border-gray-600 whitespace-nowrap"
            title="ZIP 파일로 프론트엔드 프로젝트 업로드"
          >
            📁 ZIP 분석
          </button>
          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing || !targetPath || phase === 'ai'}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2 px-6 rounded-md transition-colors whitespace-nowrap shadow-sm flex items-center gap-2"
          >
            {phase === 'static' && isAnalyzing ? '정적 분석 중...' : '1. 라우팅 분석'}
          </button>
          {phase !== 'idle' && (
            <button 
              onClick={handleGenerateAI}
              disabled={isAnalyzing || !staticReport}
              className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2 px-6 rounded-md transition-colors whitespace-nowrap shadow-sm flex items-center gap-2"
            >
              {phase === 'ai' && isAnalyzing ? 'AI 호출 중...' : '2. AI 시나리오 찾기'}
            </button>
          )}
          {phase === 'idle' && (
            <button 
              onClick={handleAnalyzeAndGenerateAI}
              disabled={isAnalyzing || !targetPath}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-2 px-6 rounded-md transition-colors whitespace-nowrap shadow-sm flex items-center gap-2 border border-blue-500/50"
            >
              🚀 원클릭 AI 시나리오 도출
            </button>
          )}
          {isAnalyzing && (
            <button 
              onClick={handleAbort}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-md transition-colors whitespace-nowrap shadow-sm flex items-center gap-2"
            >
              🛑 멈춤
            </button>
          )}
        </div>
        
        {/* Quick Examples */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">빠른 예시:</span>
          <button 
            onClick={() => handleTargetChange('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\react-board-example')}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700 transition-colors"
          >
            React 게시판 예시
          </button>
          <button 
            onClick={() => setTargetPath('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\shopping-mall-next-js')}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700 transition-colors"
          >
            쇼핑몰 예시
          </button>
          <button 
            onClick={() => setTargetPath('C:\\Users\\lee\\Desktop\\atworks\\ai\\davis-frontend\\apps\\agent-bt')}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded border border-gray-700 transition-colors"
          >
            에이전트 BT 예시
          </button>
        </div>
      </div>

      {/* Reference Log Input */}
      <div className="p-4 bg-[#1a1b1e] border-b border-gray-800 flex flex-col gap-2 shadow-inner">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-400 flex items-center gap-2">
            <span>📝</span> 참고 로그 및 추가 요구사항 (선택사항)
            {loadedLogFileName && (
              <Badge variant="outline" className="bg-gray-800 text-gray-300 border-gray-600 ml-2">
                {loadedLogFileName}
              </Badge>
            )}
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept=".json,.txt,.log" 
              ref={logFileInputRef} 
              className="hidden" 
              onChange={handleLogFileUpload}
            />
            <button
              onClick={() => logFileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="text-xs bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-200 py-1.5 px-3 rounded transition-colors flex items-center gap-1.5 border border-gray-600"
            >
              <span>📁</span> 로그 업로드
            </button>
          </div>
        </div>
        <textarea
          value={referenceLog}
          onChange={(e) => {
            setReferenceLog(e.target.value);
            setLoadedLogFileName('직접 입력');
          }}
          disabled={isAnalyzing}
          placeholder="여기에 백엔드 API 로그, Swagger 명세, 수동 테스트 결과 등 참고할 내용을 붙여넣으면 AI가 시나리오 생성 시 참고하여 정확도를 높입니다."
          className="w-full bg-[#121316] text-gray-300 text-sm p-3 rounded-md border border-gray-700/60 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none resize-y min-h-[80px]"
          spellCheck="false"
        />
      </div>

      {/* Progress bar during analysis */}
      {isAnalyzing && (
        <div className="shrink-0 px-4 py-2 bg-[#1a1b1e] border-b border-gray-800">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full transition-all duration-1000"
                style={{ width: phase === 'static' ? '30%' : phase === 'ai' ? '70%' : '100%' }}
              />
            </div>
            <span className="shrink-0 text-purple-400">
              {phase === 'static' ? '1/2 정적 코드 분석' : phase === 'ai' ? '2/2 AI 시나리오 생성' : '완료'}
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-[#161719]">
        {phase === 'idle' && !markdown && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8">
            <span className="text-6xl mb-6 opacity-40">🤖</span>
            <h3 className="text-gray-300 font-semibold text-lg mb-2">시나리오 with AI</h3>
            <p className="text-sm text-center max-w-md text-gray-500 mb-6 leading-relaxed">
              프론트엔드 프로젝트의 소스코드를 정적 분석한 후,<br />
              Gemini AI가 사용자 시나리오와 테스트 케이스를 자동으로 생성합니다.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-sm w-full text-xs">
              {[
                { icon: '🔍', label: '라우팅 분석', desc: 'App/Pages Router' },
                { icon: '⚡', label: 'API 추출', desc: 'fetch / axios / RTK' },
                { icon: '🧩', label: '컴포넌트 추적', desc: '화면별 컴포넌트' },
                { icon: '📝', label: '시나리오 생성', desc: 'AI 기반 자동화' },
              ].map((item, idx) => (
                <div key={idx} className="bg-[#1e1f22] border border-gray-700/50 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-300">{item.label}</div>
                    <div className="text-gray-500">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 bg-purple-900/20 border border-purple-700/30 rounded-lg p-3 max-w-md text-xs text-purple-300/80">
              💡 내부적으로 <strong>Antigravity CLI (AgentAPI)</strong>를 호출하여 로컬 컨텍스트와 연동해 시나리오를 작성합니다.
            </div>
          </div>
        )}

        {((phase === 'static' && !isAnalyzing) || phase === 'ai') && !markdown && (
          <div className="overflow-auto h-full p-5 space-y-4">
            {phase === 'ai' && isAnalyzing && (
              <div className="flex items-center gap-4 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-700/30 rounded-xl p-4 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <div className="relative w-8 h-8 shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-900/30" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-blue-300">🤖 AI 시나리오 도출 중...</h3>
                  <p className="text-xs text-blue-200/70 mt-0.5">
                    추출된 화면 분석 결과를 바탕으로 Gemini가 사용자 흐름을 분석하고 있습니다. 잠시만 기다려주세요.
                  </p>
                </div>
              </div>
            )}
            {/* 요약 배너 */}
            <div className="flex items-center gap-4 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-700/30 rounded-xl p-4">
              <span className="text-3xl">✅</span>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-100">
                  {projectName || '프로젝트'} — 정적 분석 완료
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  총 <strong className="text-purple-300">{screensCount}개</strong> 화면에서 라우팅 · 컴포넌트 · API · 사용자 액션 · 이동 흐름을 추출했습니다.
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <div className="bg-green-900/30 border border-green-700/30 text-green-300 px-3 py-1 rounded-full font-semibold">
                  2단계 버튼을 눌러 시나리오 생성 →
                </div>
              </div>
            </div>

            {/* 앱 탭 (모노레포 지원) */}
            {apps.length > 1 && (
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700">
                {apps.map((app, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveAppIndex(idx)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                      activeAppIndex === idx
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                  >
                    {app.appName || `App ${idx + 1}`} 
                    <span className="ml-2 text-xs bg-black/30 px-2 py-0.5 rounded-full">
                      {app.screens?.length || 0}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* 통계 카드 */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '화면', value: screensCount, icon: '🖥️', color: 'purple' },
                { label: '전체 API', value: apps.reduce((total, app) => total + (app.screens || []).reduce((s: number, sc: any) => s + (sc.onEnterApis?.length || 0) + (sc.actions || []).reduce((a: number, ac: any) => a + (ac.apis?.length || 0), 0), 0), 0), icon: '⚡', color: 'blue' },
                { label: '사용자 액션', value: apps.reduce((total, app) => total + (app.screens || []).reduce((s: number, sc: any) => s + (sc.actions?.length || 0), 0), 0), icon: '👆', color: 'orange' },
                { label: '페이지 이동', value: apps.reduce((total, app) => total + (app.screens || []).reduce((s: number, sc: any) => s + (sc.navigations?.length || 0) + (sc.actions || []).reduce((a: number, ac: any) => a + (ac.navigations?.length || 0), 0), 0), 0), icon: '🧭', color: 'green' },
              ].map((stat, i) => (
                <div key={i} className="bg-[#1e1e1e] border border-gray-700/60 rounded-lg p-3 text-center">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold text-gray-100">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>

{/* 라우트별 그룹 헤더 */}
            <div className="flex items-center justify-between mb-4 mt-8">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">라우트별 상세</h4>
              {staticViewTab === 'list' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-gray-800/80 text-gray-300 border border-gray-700/60 hover:bg-gray-700/80 hover:text-white transition-colors"
                    onClick={() => {
                      document
                        .querySelectorAll<details>('[id^="route-block-"]')
                        .forEach((el) => {
                          el.open = true;
                        });
                    }}
                  >
                    전체 펴기
                  </button>
                  <button
                    type="button"
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-gray-800/80 text-gray-300 border border-gray-700/60 hover:bg-gray-700/80 hover:text-white transition-colors"
                    onClick={() => {
                      document
                        .querySelectorAll<details>('[id^="route-block-"]')
                        .forEach((el) => {
                          el.open = false;
                        });
                    }}
                  >
                    전체 접기
                  </button>
                </div>
              )}
            </div>
            
            {/* 뷰 모드 토글 (플로팅) */}
            <div className="fixed bottom-8 right-8 z-50 flex items-center bg-[#121316]/80 backdrop-blur-md p-1.5 rounded-full border border-gray-700/50 shadow-2xl">
              <button
                onClick={() => setStaticViewTab('graph')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${staticViewTab === 'graph' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
              >
                🗺 플로우 맵 뷰
              </button>
              <button
                onClick={() => setStaticViewTab('list')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${staticViewTab === 'list' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
              >
                📄 리스트 뷰
              </button>
            </div>

            {/* 그래프 뷰 (단일 레이아웃) */}
            {staticViewTab === 'graph' && (
              <div className="h-[700px] w-full rounded-xl overflow-hidden border border-gray-700/60 relative">
                <RouteGraphView 
                  screens={apps[activeAppIndex]?.screens || []} 
                  onGoToDetails={(route) => {
                    if (staticViewTab === 'graph') {
                      setStaticViewTab('list');
                      setTimeout(() => {
                        const el = document.getElementById(`route-block-${route}`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          el.classList.add('ring-2', 'ring-purple-500', 'bg-purple-900/40', 'z-10', 'relative');
                          setTimeout(() => {
                            el.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-900/40', 'z-10', 'relative');
                          }, 2000);
                        }
                      }, 100);
                    }
                  }}
                  focusRoute={graphFocusRoute}
                />
              </div>
            )}

            {/* 리스트 뷰 */}
            {staticViewTab === 'list' && (
              <div className="space-y-4">
                {renderRouteDetails(apps[activeAppIndex]?.screens || [])}
              </div>
            )}
          </div>
        )}

        {isAnalyzing && phase === 'static' && !markdown && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-purple-900/30" />
                <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-purple-300 font-semibold">
                  {phase === 'static' ? '🔍 소스코드 정적 분석 중...' : '🤖 AI가 시나리오를 생성하고 있습니다...'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {phase === 'static' ? '라우팅, API 호출, 액션 패턴을 추출하고 있습니다.' : 'Gemini AI가 사용자 흐름을 해석하고 테스트케이스를 작성합니다.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {markdown && (
          <div className="max-w-5xl mx-auto p-6 pb-16">
            {/* Stats bar */}
            {phase === 'done' && (
              <div className="mb-6 flex items-center gap-3 flex-wrap">
                <span className="bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                  🖥️ {screensCount}개 화면 분석 완료
                </span>
                <span className="bg-green-900/40 border border-green-700/40 text-green-300 text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                  🤖 AgentAPI 시나리오 생성 완료
                </span>
              </div>
            )}
            <MarkdownRenderer content={markdown} />
          </div>
        )}

        {/* Save to Collection Modal */}
        {savingScenario && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-gray-800 bg-[#252628]">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📥</span> API Genie 컬렉션에 등록
                </h3>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">저장할 대상 시나리오</label>
                  <div className="text-sm text-gray-400 bg-black/30 p-3 rounded-lg border border-gray-800 line-clamp-2">
                    {savingScenario.title}
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-300">저장할 컬렉션 선택</label>
                    <button
                      onClick={refreshCollections}
                      disabled={isRefreshingCollections}
                      className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors"
                      title="컬렉션 목록 새로고침"
                    >
                      <span className={`inline-block ${isRefreshingCollections ? 'animate-spin' : ''}`}>🔄</span>
                    </button>
                  </div>
                  <select
                    value={targetCollectionId}
                    onChange={(e) => setTargetCollectionId(e.target.value)}
                    className="w-full bg-[#121316] text-white border border-gray-700 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="" disabled>컬렉션을 선택하세요...</option>
                    <option value="new" className="font-bold text-blue-400">➕ 새 컬렉션 만들기</option>
                    {localCollections && localCollections
                      .filter(col => col.name.includes('전이') || col.mode === 'chaining')
                      .map(col => (
                        <option key={col.id} value={col.id}>{col.name}</option>
                      ))
                    }
                  </select>
                </div>

                {targetCollectionId === 'new' && (
                  <div className="mb-2 animate-in slide-in-from-top-2">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">새 컬렉션 이름</label>
                    <input
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="예: 회원가입 시나리오"
                      className="w-full bg-[#121316] text-white border border-gray-700 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      autoFocus
                    />
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-800 bg-[#252628] flex justify-end gap-2">
                <button
                  onClick={() => setSavingScenario(null)}
                  disabled={isSavingToCollection}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-transparent hover:bg-gray-800 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleExecuteSaveToCollection}
                  disabled={isSavingToCollection || !targetCollectionId || (targetCollectionId === 'new' && !newCollectionName.trim())}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  {isSavingToCollection ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Browser Test Execute Modal */}
        {isExecuteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-gray-800 bg-[#252628] flex justify-between items-center shrink-0">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>▶️</span> 브라우저 테스트 실행
                </h3>
                <button
                  onClick={() => setIsExecuteModalOpen(false)}
                  disabled={isExecuting}
                  className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
                {executingScenarioIndex !== null && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">테스트 시나리오</label>
                    <div className="text-sm text-gray-400 bg-black/30 p-3 rounded-lg border border-gray-800">
                      {scenariosList[executingScenarioIndex].title}
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">타겟 URL</label>
                  <input
                    type="text"
                    value={executingTargetUrl}
                    onChange={(e) => setExecutingTargetUrl(e.target.value)}
                    disabled={isExecuting}
                    placeholder="예: http://localhost:3002"
                    className="w-full bg-[#121316] text-white border border-gray-700 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                  />
                </div>

                {executingScenarioIndex !== null && (() => {
                  let activeStep = -1;
                  let hasError = false;
                  executeLogs.forEach(log => {
                    if (log.type === 'error') hasError = true;
                    const m = log.message.match(/\[(?:스텝|step|Step)\s*(\d+)/i);
                    if (m) activeStep = parseInt(m[1], 10) - 1;
                  });
                  if (!isExecuting && executeLogs.length > 0 && !hasError) activeStep = 999;

                  return (
                    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2">
                      <label className="block text-sm font-semibold text-gray-300 mb-2">시나리오 상세 스텝</label>
                      <div className="bg-[#1a1b1e] border border-gray-700 rounded-lg p-3 min-h-[100px] h-40 resize-y overflow-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-600">
                        {((scenariosList[executingScenarioIndex].flow || scenariosList[executingScenarioIndex].steps || scenariosList[executingScenarioIndex].actions || scenariosList[executingScenarioIndex].scenario) || []).map((step: any, idx: number) => {
                          let primaryText: React.ReactNode = typeof step === 'string' ? step : (step.description || step.user_action || step.userAction || step.action || step.task || step.activity || step.name || step.title || 'Action');
                          let secondaryText: React.ReactNode = null;
                          
                          if (primaryText === 'Action' && typeof step === 'object') {
                            const possibleKeys = Object.keys(step).filter(k => !['step', 'sequence', 'appName', 'screen', 'page', 'apis', 'apiCalls', 'api_call', 'apiCall', 'api', 'next_page', 'nextPage', 'type', 'target', 'endpoint', 'method'].includes(k));
                            if (possibleKeys.length > 0 && typeof step[possibleKeys[0]] === 'string') {
                              primaryText = step[possibleKeys[0]];
                            }
                          }
                          
                          if (typeof step === 'object' && step.type) {
                             let techDetail: React.ReactNode = null;
                             if (step.type === 'navigate' && step.target) {
                               techDetail = <span>navigate &rarr; <span className="text-blue-300 font-mono text-xs">{step.target}</span></span>;
                             } else if (step.type === 'api_call' && step.endpoint) {
                               const isGet = (step.method || 'GET').toUpperCase() === 'GET';
                               const methodColor = isGet ? 'text-green-400' : step.method === 'POST' ? 'text-orange-400' : step.method === 'DELETE' ? 'text-red-400' : 'text-blue-400';
                               const extraDesc = isGet ? ' (화면 조작 없음 - 백그라운드 자동 호출)' : '';
                               techDetail = (
                                 <span>
                                   api_call <span className={`font-mono text-[9px] px-1 py-0.5 rounded bg-gray-800 border border-gray-700 ${methodColor}`}>[{step.method || 'GET'}]</span> <span className="font-mono text-gray-400 text-xs ml-1">{step.endpoint}</span>
                                   <span className="text-gray-500 text-[10px] ml-1">{extraDesc}</span>
                                 </span>
                               );
                             } else if (step.type === 'submit' && step.target) {
                               techDetail = <span>submit: <span className="text-orange-300 font-mono text-xs">{step.target}</span></span>;
                             }

                             if (step.description) {
                               primaryText = step.description;
                               secondaryText = techDetail;
                             } else if (techDetail) {
                               primaryText = techDetail;
                               secondaryText = null;
                             }
                          }

                          const isDone = activeStep > idx || activeStep === 999;
                          const isCurrent = activeStep === idx && isExecuting;

                          return (
                            <div key={idx} className={`text-sm flex items-start gap-2 p-1.5 rounded-lg transition-colors ${isCurrent ? 'bg-purple-900/20 border border-purple-500/30' : 'border border-transparent'}`}>
                              <span className="shrink-0 mt-0.5">
                                {isDone ? (
                                  <span className="text-green-400 text-sm">✅</span>
                                ) : isCurrent ? (
                                  <span className="text-purple-400 text-sm inline-block animate-spin">⏳</span>
                                ) : (
                                  <span className="text-gray-600 font-bold text-xs">[{idx + 1}]</span>
                                )}
                              </span>
                              <div className="flex flex-col">
                                <span className={`leading-tight break-all ${isDone ? 'text-gray-400' : isCurrent ? 'text-purple-200 font-semibold' : 'text-gray-300'}`}>
                                  {primaryText}
                                </span>
                                {secondaryText && (
                                  <span className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                                    {secondaryText}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Console Output */}
                <div className="flex-1 min-h-[200px] flex flex-col">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">실행 로그</label>
                  <div className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg p-3 font-mono text-xs overflow-y-auto max-h-[300px]">
                    {executeLogs.length === 0 && !isExecuting && (
                      <div className="text-gray-600 text-center py-8 italic">테스트를 시작하면 로그가 표시됩니다.</div>
                    )}
                    {executeLogs.map((log, idx) => (
                      <div key={idx} className={`mb-1 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-300'}`}>
                        <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log.message}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {/* Video Player */}
                {executeVideoUrl && (
                  <div className="mt-2 animate-in slide-in-from-top-2">
                    <label className="block text-sm font-semibold text-green-400 mb-2">🎥 녹화 영상</label>
                    <video 
                      src={executeVideoUrl} 
                      controls 
                      autoPlay 
                      className="w-full rounded-lg border border-gray-700 shadow-lg"
                    />
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-gray-800 bg-[#252628] flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => setIsExecuteModalOpen(false)}
                  disabled={isExecuting}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-transparent hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  닫기
                </button>
                {isExecuting && (
                  <button
                    onClick={() => {
                      executeAbortControllerRef.current?.abort();
                      setIsExecuting(false);
                      setExecuteLogs(prev => [...prev, { type: 'error', message: '[시스템] 테스트가 사용자에 의해 중단되었습니다.' }]);
                    }}
                    className="px-4 py-2 text-sm font-medium text-red-400 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors border border-red-800/50 flex items-center gap-2"
                  >
                    ⏹️ 중지
                  </button>
                )}
                <button
                  onClick={handleStartExecution}
                  disabled={isExecuting || !executingTargetUrl}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  {isExecuting ? (
                    <>
                      <span className="animate-spin inline-block">⏳</span> 실행 중...
                    </>
                  ) : (
                    '▶️ 테스트 시작'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {scenariosList.length > 0 && phase === 'done' && (
          <div className="max-w-5xl mx-auto p-6 pb-16 space-y-6">
            {/* Stats bar */}
            <div className="mb-6 flex items-center gap-3 flex-wrap">
              <span className="bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                🖥️ {screensCount}개 화면 분석 완료
              </span>
              <span className="bg-green-900/40 border border-green-700/40 text-green-300 text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                🤖 AgentAPI 기반 시나리오 {scenariosList.length}개 도출 완료
              </span>
            </div>
            
            {scenariosList.map((scenario: any, i: number) => (
              <div key={i} className="bg-[#1a1b1e] border border-gray-700/60 rounded-xl overflow-hidden shadow-lg transition-transform hover:-translate-y-1 hover:shadow-2xl">
                <div className="bg-gradient-to-r from-[#252628] to-[#1e1e1e] px-6 py-5 border-b border-gray-700/60">
                  <div className="flex items-start justify-between">
                    <h3 className="text-xl font-bold text-blue-300 flex items-center gap-2">
                      <span className="text-2xl drop-shadow-md">🎯</span> {scenario.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setExecutingScenarioIndex(i);
                          setIsExecuteModalOpen(true);
                        }}
                        className="text-[10px] bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded border border-green-600 transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <span>▶️</span> 실제 브라우저 테스트 실행
                      </button>
                      <button 
                        onClick={() => {
                          setSavingScenario(scenario);
                          setTargetCollectionId('');
                          setNewCollectionName('');
                        }}
                        className="text-[10px] bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded border border-blue-600 transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <span>📥</span> 컬렉션으로 전이
                      </button>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(scenario, null, 2));
                          toast.success('시나리오 JSON이 복사되었습니다!');
                        }}
                        className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-2 py-1 rounded border border-gray-700 transition-colors flex items-center gap-1"
                      >
                        <span>📋</span> JSON 복사
                      </button>
                    </div>
                  </div>
                  {scenario.description && <p className="text-sm text-gray-400 mt-2 ml-8 leading-relaxed">{scenario.description}</p>}
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {((scenario.flow || scenario.steps || scenario.actions || scenario.scenario) || []).map((step: any, j: number) => {
                      // Handle various formats that Gemini might return
                      let stepAction: React.ReactNode = typeof step === 'string' ? step : (step.user_action || step.userAction || step.action || step.task || step.activity || step.name || step.title || step.description || 'Action');
                      if (stepAction === 'Action' && typeof step === 'object') {
                        const possibleKeys = Object.keys(step).filter(k => !['step', 'sequence', 'appName', 'screen', 'page', 'apis', 'apiCalls', 'api_call', 'apiCall', 'api', 'next_page', 'nextPage'].includes(k));
                        if (possibleKeys.length > 0 && typeof step[possibleKeys[0]] === 'string') {
                          stepAction = step[possibleKeys[0]];
                        }
                      }
                      if (typeof step === 'object' && step.type) {
                        if (step.type === 'navigate' && step.target) {
                          stepAction = <span>navigate &rarr; <span className="text-blue-300 font-mono text-sm">{step.target}</span></span>;
                        } else if (step.type === 'api_call' && step.endpoint) {
                          const isGet = (step.method || 'GET').toUpperCase() === 'GET';
                          const methodColor = isGet ? 'text-green-400' : step.method === 'POST' ? 'text-orange-400' : step.method === 'DELETE' ? 'text-red-400' : 'text-blue-400';
                          const extraDesc = isGet ? ' (화면 조작 없음 - 백그라운드 자동 호출)' : '';
                          stepAction = (
                            <span>
                              api_call <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 ${methodColor}`}>[{step.method || 'GET'}]</span> <span className="font-mono text-gray-300 text-sm ml-1">{step.endpoint}</span>
                              <span className="text-gray-500 text-xs ml-1 font-normal">{extraDesc}</span>
                            </span>
                          );
                        } else if (step.type === 'submit' && step.target) {
                          stepAction = <span>submit: <span className="text-orange-300 font-mono text-sm">{step.target}</span></span>;
                        }
                      }
                      const stepApis = step.apis || step.apiCalls || step.triggered_apis || (step.api_call ? [step.api_call] : step.apiCall ? [step.apiCall] : step.api ? [step.api] : []);
                      const stepNum = step.step || step.sequence || (j + 1);
                      const stepDesc = (step.stepDescription && step.stepDescription !== stepAction) ? step.stepDescription : null;
                      const stepScreen = step.screen || step.page || null;
                      const stepNextPage = step.next_page || step.nextPage || null;
                      
                      return (
                      <div key={j} className="flex gap-4 items-start relative group">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/60 text-purple-300 flex items-center justify-center font-bold z-10 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                            {stepNum}
                          </div>
                          {j < (((scenario.flow || scenario.steps || scenario.actions || scenario.scenario) || []).length - 1) && (
                            <div className="w-0.5 h-full bg-gray-700/50 absolute top-8 left-4 -ml-[1px]" />
                          )}
                        </div>
                        <div className="pb-4 pt-1">
                          <div className="group-hover:text-white transition-colors flex flex-col">
                            {step.description ? (
                              <>
                                <div className="text-[15px] font-semibold text-gray-200">{step.description}</div>
                                <div className="text-gray-400 text-sm mt-1.5 font-normal leading-relaxed">{stepAction}</div>
                              </>
                            ) : (
                              <div className="text-[15px] font-semibold text-gray-200">{stepAction}</div>
                            )}
                          </div>
                          {stepScreen && (
                            <div className="text-xs mt-2 mb-1 flex items-center gap-2 group/nav relative w-fit">
                              <div className="bg-green-500/20 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                                <span className="text-[10px]">🚀</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-green-500 uppercase tracking-wide">NAVIGATE TO</span>
                                <span className="text-green-400 font-mono text-xs cursor-default">
                                  {stepScreen.split('?')[0]}
                                </span>
                              </div>
                              
                              {/* Hover tooltip for full URL */}
                              {stepScreen.includes('?') && (
                                <div className="absolute left-8 top-full mt-1 opacity-0 group-hover/nav:opacity-100 transition-opacity bg-gray-900 text-gray-300 text-[10px] font-mono px-2 py-1.5 rounded border border-gray-700 whitespace-nowrap z-50 pointer-events-none shadow-xl">
                                  {stepScreen}
                                </div>
                              )}
                            </div>
                          )}
                          {stepDesc && (
                            <div className="text-sm text-gray-400 mt-2 italic leading-relaxed">{stepDesc}</div>
                          )}
                          {stepApis && stepApis.length > 0 && (
                            <div className="flex flex-col gap-2 mt-3">
                              {stepApis.map((api: any, k: number) => {
                                if (typeof api === 'string') {
                                  return (
                                    <span key={k} className="text-xs font-mono bg-[#16171a] border border-gray-700/80 text-gray-400 px-2.5 py-1.5 rounded-md shadow-sm w-fit">
                                      {api}
                                    </span>
                                  );
                                }

                                const method = api.method || 'GET';
                                const endpoint = api.url || api.endpoint || '';
                                const desc = api.description || api.purpose || '';
                                
                                const methodColor = method === 'GET' ? 'text-green-400 border-green-800 bg-green-900/20' 
                                                 : method === 'POST' ? 'text-orange-400 border-orange-800 bg-orange-900/20' 
                                                 : method === 'DELETE' ? 'text-red-400 border-red-800 bg-red-900/20' 
                                                 : 'text-blue-400 border-blue-800 bg-blue-900/20';

                                return (
                                  <div key={k} className="flex flex-col gap-1.5 bg-[#16171a] border border-gray-700/80 p-2.5 rounded-md shadow-sm w-fit min-w-[250px]">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${methodColor}`}>
                                        {method}
                                      </span>
                                      <span className="font-mono text-xs text-blue-200 break-all">
                                        {endpoint}
                                      </span>
                                    </div>
                                    {desc && (
                                      <p className="text-[11px] text-gray-400 ml-1">
                                        {desc}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {stepNextPage && (
                            <div className="text-xs text-blue-400 mt-2 flex items-center gap-1.5 font-mono">
                              <span>➡️ 이동: {stepNextPage}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
