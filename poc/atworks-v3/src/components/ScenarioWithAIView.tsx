'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
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
  "SERVER_COMPONENT__getProductsServer": {
    "timestamp": "2026-08-05T04:44:42.951Z",
    "source": "server-component",
    "function": "getProductsServer",
    "request": {
      "params": {}
    },
    "response": {
      "status": 200,
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
        },
        {
          "id": "prod-3",
          "name": "오버핏 하이엔드 피마 코튼 후드티",
          "category": "fashion",
          "price": 69000,
          "rating": 4.8,
          "reviewCount": 210,
          "image": "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80",
          "description": "부드러운 프리미엄 피마 코튼 100% 소재로 제작된 트렌디한 오버핏 데일리 후드티입니다.",
          "isBest": true
        },
        {
          "id": "prod-4",
          "name": "스마트 하이파이 무선 블루투스 스피커",
          "category": "electronics",
          "price": 189000,
          "originalPrice": 220000,
          "rating": 4.6,
          "reviewCount": 56,
          "image": "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80",
          "description": "컴팩트한 크기에서 선사하는 풍부한 베이스 사운드. 방수 기능(IPX7) 탑재로 야외 활동에 적합합니다."
        },
        {
          "id": "prod-5",
          "name": "세라믹 모던 핸드드립 커피 갓 & 팟 세트",
          "category": "living",
          "price": 54000,
          "rating": 4.9,
          "reviewCount": 92,
          "image": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
          "description": "홈카페 경험을 극대화해주는 핸드메이드 세라믹 드립 세트입니다.",
          "isNew": true
        },
        {
          "id": "prod-6",
          "name": "딥 수분 릴리프 페이셜 에센스 100ml",
          "category": "beauty",
          "price": 42000,
          "originalPrice": 50000,
          "rating": 4.9,
          "reviewCount": 312,
          "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80",
          "description": "피부 깊숙이 수분을 공급하고 장벽을 강화해주는 비건 인증 수분 에센스입니다.",
          "isBest": true
        },
        {
          "id": "prod-7",
          "name": "클래식 스퀘어 레더 크로스바디 백",
          "category": "fashion",
          "price": 149000,
          "rating": 4.7,
          "reviewCount": 45,
          "image": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80",
          "description": "천연 가죽의 정교한 텍스처가 돋보이는 모던 데일리 스퀘어 크로스백입니다."
        },
        {
          "id": "prod-8",
          "name": "스마트 피트니스 수면 분석 워치 Band 5",
          "category": "electronics",
          "price": 129000,
          "originalPrice": 159000,
          "rating": 4.8,
          "reviewCount": 178,
          "image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
          "description": "심박수, 수면 패턴, 30가지 이상의 운동 모드를 정밀 추적해 주는 피트니스 워치입니다.",
          "isNew": true
        }
      ]
    }
  },
  "GET__api_cart": {
    "timestamp": "2026-08-05T04:25:30.433Z",
    "endpoint": "/api/cart",
    "method": "GET",
    "request": {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "connection": "keep-alive",
        "host": "localhost:3002",
        "referer": "http://localhost:3002/",
        "sec-ch-ua": "\"Chromium\";v=\"151\", \"Not=A?Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
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
    "timestamp": "2026-08-04T23:51:24.318Z",
    "endpoint": "/api/cart",
    "method": "POST",
    "request": {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "connection": "keep-alive",
        "content-length": "426",
        "content-type": "application/json",
        "host": "localhost:3002",
        "origin": "http://localhost:3002",
        "referer": "http://localhost:3002/products/prod-2",
        "sec-ch-ua": "\"Chromium\";v=\"151\", \"Not=A?Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
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
  "SERVER_COMPONENT__getProductByIdServer": {
    "timestamp": "2026-08-04T23:50:50.968Z",
    "source": "server-component",
    "function": "getProductByIdServer",
    "request": {
      "params": {
        "id": "prod-2"
      }
    },
    "response": {
      "status": 200,
      "body": {
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
    }
  },
  "POST__api_orders": {
    "timestamp": "2026-08-04T23:53:07.368Z",
    "endpoint": "/api/orders",
    "method": "POST",
    "request": {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "connection": "keep-alive",
        "content-length": "651",
        "content-type": "application/json",
        "host": "localhost:3002",
        "origin": "http://localhost:3002",
        "referer": "http://localhost:3002/order",
        "sec-ch-ua": "\"Chromium\";v=\"151\", \"Not=A?Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
        "x-forwarded-for": "::1",
        "x-forwarded-host": "localhost:3002",
        "x-forwarded-port": "3002",
        "x-forwarded-proto": "http"
      },
      "body": {
        "items": [
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
        ],
        "shippingInfo": {
          "name": "홍길동",
          "phone": "010-1234-5678",
          "address": "서울특별시 강남구 테헤란로 123",
          "detailAddress": "atworks 빌딩 5층",
          "paymentMethod": "card"
        },
        "totalAmount": 89000,
        "buyType": "CART"
      }
    },
    "response": {
      "status": 200,
      "headers": {
        "content-type": "application/json"
      },
      "body": {
        "success": true,
        "orderId": "ORD-1785887587360-710",
        "orderDate": "2026. 8. 5. 오전 8:53:07",
        "totalAmount": 89000,
        "itemCount": 1,
        "message": "결제가 성공적으로 승인 처리되었습니다."
      }
    }
  },
  "DELETE__api_cart": {
    "timestamp": "2026-08-04T23:53:07.382Z",
    "endpoint": "/api/cart",
    "method": "DELETE",
    "request": {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "connection": "keep-alive",
        "host": "localhost:3002",
        "origin": "http://localhost:3002",
        "referer": "http://localhost:3002/order",
        "sec-ch-ua": "\"Chromium\";v=\"151\", \"Not=A?Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
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
      "body": {
        "success": true,
        "cart": []
      }
    }
  }
}`;

const DEFAULT_BOARD_LOGS = `{
  "GET__api_posts": {
    "timestamp": "2026-08-05T04:27:30.735Z",
    "endpoint": "/api/posts",
    "method": "GET",
    "request": {
      "headers": {
        "host": "localhost:4000"
      }
    },
    "response": {
      "status": 200,
      "body": [
        { "id": 1, "title": "First Post", "content": "Hello World!" },
        { "id": 2, "title": "Second Post", "content": "React Query is awesome." }
      ]
    }
  },
  "GET__api_posts_1": {
    "timestamp": "2026-08-05T04:28:10.000Z",
    "endpoint": "/api/posts/1",
    "method": "GET",
    "request": {
      "headers": {
        "host": "localhost:4000"
      }
    },
    "response": {
      "status": 200,
      "body": { "id": 1, "title": "First Post", "content": "Hello World!" }
    }
  },
  "POST__api_posts": {
    "timestamp": "2026-08-05T04:29:10.000Z",
    "endpoint": "/api/posts",
    "method": "POST",
    "request": {
      "headers": {
        "host": "localhost:4000",
        "content-type": "application/json"
      },
      "body": {
        "title": "New Test Post",
        "content": "This is a test post body."
      }
    },
    "response": {
      "status": 201,
      "body": {
        "id": 1700000000000,
        "title": "New Test Post",
        "content": "This is a test post body."
      }
    }
  },
  "GET__api_comments": {
    "timestamp": "2026-08-05T04:28:15.000Z",
    "endpoint": "/api/comments?postId=1",
    "method": "GET",
    "request": {
      "headers": {
        "host": "localhost:4000"
      }
    },
    "response": {
      "status": 200,
      "body": [
        { "id": 1, "postId": 1, "text": "Great post!" }
      ]
    }
  },
  "GET__api_notices": {
    "timestamp": "2026-08-05T04:27:35.000Z",
    "endpoint": "/api/notices",
    "method": "GET",
    "request": {
      "headers": {
        "host": "localhost:4000"
      }
    },
    "response": {
      "status": 200,
      "body": [
        { "id": 1, "title": "[공지] 점검 안내" },
        { "id": 2, "title": "[이벤트] 신규 가입 이벤트" }
      ]
    }
  },
  "POST__api_auth_login": {
    "timestamp": "2026-08-05T04:30:20.000Z",
    "endpoint": "/api/auth/login",
    "method": "POST",
    "request": {
      "headers": {
        "host": "localhost:4000",
        "content-type": "application/json"
      },
      "body": {
        "username": "admin",
        "password": "admin"
      }
    },
    "response": {
      "status": 200,
      "body": {
        "success": true,
        "userId": 1
      }
    }
  }
}`;

export default function ScenarioWithAIView({ rootPath, collections = [], apiItems = [], onSave, onClose, theme = 'light', onThemeToggle }: ScenarioWithAIViewProps) {
  const [targetPath, setTargetPath] = useState(rootPath || 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\shopping-mall-next-js');
  const [referenceLog, setReferenceLog] = useState(DEFAULT_API_LOGS);
  const apiCount = useMemo(() => {
    try {
      const parsed = JSON.parse(referenceLog || '{}');
      if (parsed && typeof parsed === 'object') {
        return Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
      }
      return 0;
    } catch {
      return 0;
    }
  }, [referenceLog]);
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
  const [staticViewTab, setStaticViewTab] = useState<'graph' | 'list' | 'scenarios' | 'logs'>('graph');
  const [graphFocusRoute, setGraphFocusRoute] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [naturalPrompt, setNaturalPrompt] = useState('');
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

  // Interactive Scenario Editor States
  const [editingScenarioIndex, setEditingScenarioIndex] = useState<number | null>(null);
  const [editChatHistory, setEditChatHistory] = useState<Array<{ role: 'user' | 'ai', text: string }>>([]);
  const [editInstruction, setEditInstruction] = useState('');
  const [isEditingLoading, setIsEditingLoading] = useState(false);
  const [scenarioUndoHistory, setScenarioUndoHistory] = useState<Record<number, any[]>>({});

  const handleOpenEditModal = (index: number) => {
    setEditingScenarioIndex(index);
    if (!scenarioUndoHistory[index]) {
      setScenarioUndoHistory(prev => ({ ...prev, [index]: [scenariosList[index]] }));
    }
    setEditChatHistory([
      { role: 'ai', text: `안녕하세요! "${scenariosList[index]?.title || '선택한 시나리오'}"의 스텝을 대화로 자유롭게 추가, 수정, 예외 처리하거나 삭제해 보세요.` }
    ]);
  };

  const handleSendEditInstruction = async (textToSend?: string) => {
    const instructionText = textToSend || editInstruction;
    if (!instructionText.trim() || editingScenarioIndex === null) return;

    const currentScenario = scenariosList[editingScenarioIndex];
    setEditInstruction('');
    setEditChatHistory(prev => [...prev, { role: 'user', text: instructionText }]);
    setIsEditingLoading(true);

    try {
      const res = await fetch('/api/edit-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: currentScenario,
          userInstruction: instructionText,
          referenceLog
        })
      });
      const data = await res.json();
      if (data.success && data.updatedScenario) {
        setScenariosList((prev: any[]) => {
          const next = [...prev];
          next[editingScenarioIndex] = data.updatedScenario;
          return next;
        });
        setScenarioUndoHistory(prev => ({
          ...prev,
          [editingScenarioIndex]: [...(prev[editingScenarioIndex] || []), currentScenario]
        }));
        setEditChatHistory(prev => [
          ...prev,
          { role: 'ai', text: data.aiExplanation || '요청하신 대화 지시에 맞춰 시나리오가 성공적으로 업데이트되었습니다!' }
        ]);
        toast.success('시나리오가 실시간 반영되었습니다.');
      } else {
        toast.error(data.error || '시나리오 수정에 실패했습니다.');
      }
    } catch (e: any) {
      toast.error('서버 통신 중 오류가 발생했습니다.');
    } finally {
      setIsEditingLoading(false);
    }
  };

  const handleUndoScenario = (index: number) => {
    const stack = scenarioUndoHistory[index];
    if (stack && stack.length > 0) {
      const previous = stack[stack.length - 1];
      setScenariosList((prev: any[]) => {
        const next = [...prev];
        next[index] = previous;
        return next;
      });
      setScenarioUndoHistory(prev => ({
        ...prev,
        [index]: stack.slice(0, -1)
      }));
      toast.info('이전 시나리오로 되돌렸습니다.');
      setEditChatHistory(prev => [...prev, { role: 'ai', text: '↺ 이전 시나리오 상태로 되돌렸습니다.' }]);
    } else {
      toast.error('복원할 이전 히스토리가 없습니다.');
    }
  };

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
      let aiRes;
      let isPromptMode = false;
      
      if (naturalPrompt.trim()) {
        isPromptMode = true;
        aiRes = await fetch('/api/analyze/prompt-scenario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: naturalPrompt.trim(), staticReport: staticData.staticReport, projectName: staticData.projectName, referenceLog }),
          signal: abortControllerRef.current.signal
        });
      } else {
        aiRes = await fetch('/api/analyze/scenario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ai', staticReport: staticData.staticReport, projectName: staticData.projectName, referenceLog }),
          signal: abortControllerRef.current.signal
        });
      }

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

      if (isPromptMode && aiData.scenario) {
        setScenariosList([aiData.scenario]);
        setMarkdown('');
      } else if (!isPromptMode && aiData.scenarios) {
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
              if (data.type === 'healing') {
                toast(data.message, { 
                  icon: '🩹',
                  duration: 6000,
                  style: { 
                    border: '1px solid #f97316', 
                    padding: '12px 16px', 
                    color: '#fdba74', 
                    background: '#431407',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  } 
                });
              }
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
        (a.apis || a.triggered_apis || []).map((api: any) => {
          let baseSource = a.handlerName && a.handlerName !== '(inline)' ? a.handlerName : (a.description || a.trigger);
          if (api.callerName && api.callerName !== '(inline)' && api.callerName !== '(auto-detected)') {
            if (typeof baseSource === 'string' && !baseSource.includes(api.callerName)) {
              baseSource += ` > ${api.callerName}()`;
            }
          }
          return {
            ...api,
            __source: baseSource
          };
        })
      );
      
      const onEnterApis: any[] = [
        ...(sc.onEnterApis || []).map((api: any) => {
          let source = '초기 렌더링(Root)';
          if (api.callerName && api.callerName !== '(inline)' && api.callerName !== '(auto-detected)') {
            source += ` > ${api.callerName}()`;
          }
          return { ...api, __source: source };
        }), 
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
      const routeName = sc.route || sc.page || sc.component || sc.name || sc.filePath || '/';
      
      return (
        <details 
          key={idx} 
          id={`route-block-${routeName}`}
          className={`${theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#1a1c21] border-gray-700/50'} rounded-lg border shadow-sm transition-all duration-500 hover:border-purple-500/30 group overflow-hidden mb-2`}
        >
          <summary 
            className="cursor-pointer outline-none select-none list-none [&::-webkit-details-marker]:hidden block"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(`route-block-${routeName}`);
              if (el) {
                // If it's closed, open it. If it's open, close it.
                if (el.hasAttribute('open')) {
                  el.removeAttribute('open');
                } else {
                  el.setAttribute('open', 'true');
                }
                el.classList.add('ring-2', 'ring-purple-500', 'bg-purple-900/10');
                setTimeout(() => {
                  el.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-900/10');
                }, 1500);
              }
            }}
          >
            <div className="flex items-center justify-between w-full p-2.5 px-3">
              <div className="flex items-center gap-2.5">
                <Badge variant="outline" className={`border ${theme === 'light' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-purple-900/20 text-purple-400 border-purple-800/50'}`}>
                  Screen {idx + 1}
                </Badge>
                <h5 className={`font-mono text-sm font-bold ${theme === 'light' ? 'text-slate-800' : 'text-gray-200'}`}>
                  {sc.route || '/'}
                  {sc.page && sc.page !== sc.route && <span className={`ml-2 font-normal ${theme === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>({sc.page})</span>}
                  {!sc.page && sc.component && sc.component !== sc.route && <span className={`ml-2 font-normal ${theme === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>({sc.component})</span>}
                </h5>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${theme === 'light' ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300' : 'bg-purple-900/40 text-purple-300 border-purple-700/50 hover:bg-purple-800/50 hover:border-purple-500/60'}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setGraphFocusRoute(routeName);
                    setStaticViewTab('graph');
                  }}
                  title="플로우 맵에서 이 화면 위치로 이동"
                >
                  🗺 맵에서 보기
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900' : 'bg-gray-800/80 text-gray-300 border-gray-700/60 hover:bg-gray-700/80 hover:text-white'}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopyRoute(sc, userActions, systemActions);
                  }}
                  title="이 라우트의 상세 정보를 복사"
                >
                  📋 복사
                </button>
                <div className="text-gray-500 text-xs transition-transform duration-300 group-open:rotate-180">
                  ▼
                </div>
              </div>
            </div>
          </summary>

          <div className={`p-3 pt-0 space-y-2.5 border-t mt-1 ${theme === 'light' ? 'border-slate-100' : 'border-gray-700/30'}`}>
            {/* 진입 시 자동 호출 API */}
            {onEnterApis.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-gray-400 mb-2">🚀 진입 시 호출 (onEnter)</h6>
                <div className="space-y-2">
                  {onEnterApis.map((api: any, ai: number) => (
                    <div key={ai} className={`flex flex-col gap-1.5 p-2.5 rounded border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-gray-800/50 border-gray-700/50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${theme === 'light' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-900/50 text-blue-400 border-blue-800/50'}`}>
                          {api.method || 'GET'}
                        </span>
                        <span className={`font-mono text-xs break-all ${theme === 'light' ? 'text-blue-700' : 'text-blue-200'}`}>
                          {api.endpoint || api.url || 'URL 없음'}
                        </span>
                      </div>
                      {(api.purpose || api.description) && (
                        <p className={`text-[10px] leading-snug ${theme === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>
                          {api.purpose || api.description}
                        </p>
                      )}
                      {(api.__source || api.line || api.file || api.filePath) && (
                        <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-mono w-fit px-2 py-1 rounded border ${theme === 'light' ? 'text-slate-500 bg-white border-slate-200' : 'text-gray-400 bg-gray-900/60 border-gray-700/50'}`}>
                          <span className="text-[10px]">⚡</span> 
                          <span>출처: <span className={`font-semibold ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>{api.__source || '초기 렌더링(Root)'}</span></span>
                          {(api.line || api.file || api.filePath) && (
                            <>
                              <span className={`mx-0.5 ${theme === 'light' ? 'text-slate-300' : 'text-gray-600'}`}>|</span>
                              <span className="flex items-center gap-1">
                                {(api.file || api.filePath || api.sourceFile) && <span>📄 {api.file || api.filePath || api.sourceFile}</span>}
                                {api.line && <span className={theme === 'light' ? 'text-slate-400' : 'text-gray-500'}>L{api.line}</span>}
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
                <h6 className="text-[11px] font-semibold text-gray-400 mb-1.5">🖱 사용자 인터랙션</h6>
                <div className="space-y-1.5">
                  {userActions.map((act: any, aci: number) => (
                    <div key={aci} className={`flex flex-col gap-1.5 p-2 rounded border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-gray-800/30 border-gray-700/30'}`}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="default" className={`text-[10px] ${theme === 'light' ? 'bg-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700/50'}`}>
                          {act.trigger}
                        </Badge>
                        {act.handlerName && act.handlerName !== '(inline)' && (
                          <span className={`font-mono text-[10px] ${theme === 'light' ? 'text-orange-600' : 'text-orange-300/80'}`}>
                            {act.handlerName}
                          </span>
                        )}
                        <span className={`text-xs ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>
                          {act.description}
                        </span>
                      </div>
                      
                      {(act.apis || act.triggered_apis) && (act.apis || act.triggered_apis).length > 0 && (
                        <div className="ml-2 pl-2 border-l border-gray-700 space-y-1.5">
                          {(act.apis || act.triggered_apis).map((api: any, aai: number) => {
                            const methodColor = theme === 'light' ? (
                              api.method === 'GET' ? 'text-blue-600 bg-blue-50 border-blue-200' : 
                              api.method === 'POST' ? 'text-green-600 bg-green-50 border-green-200' :
                              api.method === 'PUT' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                              api.method === 'DELETE' ? 'text-red-600 bg-red-50 border-red-200' :
                              'text-slate-600 bg-slate-50 border-slate-200'
                            ) : (
                              api.method === 'GET' ? 'text-blue-400 bg-blue-900/30 border-blue-800/50' : 
                              api.method === 'POST' ? 'text-green-400 bg-green-900/30 border-green-800/50' :
                              api.method === 'PUT' ? 'text-yellow-400 bg-yellow-900/30 border-yellow-800/50' :
                              api.method === 'DELETE' ? 'text-red-400 bg-red-900/30 border-red-800/50' :
                              'text-gray-400 bg-gray-900/30 border-gray-800/50'
                            );
                              
                            return (
                              <div key={aai} className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${methodColor}`}>
                                    {api.method}
                                  </span>
                                  <span className={`font-mono text-[11px] break-all ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>
                                    {api.endpoint || api.url || 'URL 없음'}
                                  </span>
                                </div>
                                {api.purpose && (
                                  <p className="text-[10px] text-gray-500 pl-1">
                                    {api.purpose}
                                  </p>
                                )}
                                {(api.line || api.file || api.filePath) && (
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-gray-400 font-mono bg-gray-900/60 w-fit px-1.5 py-0.5 rounded border border-gray-700/50">
                                    {(api.file || api.filePath || api.sourceFile) && <span>📄 {api.file || api.filePath || api.sourceFile}</span>}
                                    {api.line && <span className="text-gray-500">L{api.line}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {act.navigations && act.navigations.length > 0 && (
                        <div className="ml-1.5 pl-1.5 mt-1.5 border-l-2 border-green-800/50 space-y-1.5">
                          <span className="text-[8px] font-bold text-green-500/70 uppercase tracking-wider">Navigates To</span>
                          <div className="flex flex-wrap gap-1.5">
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
                <h6 className="text-[11px] font-semibold text-gray-400 mb-1.5">🔗 화면 이동</h6>
                <div className="flex flex-wrap gap-1.5">
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

            {/* 조건/권한 관련 */}
            {sc.conditions && sc.conditions.length > 0 && (
              <div>
                <h6 className="text-[11px] font-semibold text-gray-400 mb-1.5 flex items-center gap-1 mt-2.5">
                  <span>🛡️</span> 조건/권한 관련
                </h6>
                <div className="flex flex-wrap gap-2">
                  {sc.conditions.map((cond: string, ci: number) => (
                    <Badge key={ci} variant="outline" className="bg-orange-900/20 text-orange-400 border-orange-800/50 font-mono text-[10px]">
                      {cond}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      );
    });
  };
  const handleExportE2E = async (scenario: any) => {
    try {
      const res = await fetch('/api/export-e2e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: executingTargetUrl, scenario })
      });
      if (!res.ok) throw new Error('Failed to export E2E code');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'test-scenario.spec.ts';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('E2E 테스트 코드가 추출되었습니다.');
    } catch (err: any) {
      console.error(err);
      toast.error('E2E 코드 추출에 실패했습니다.');
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col overflow-hidden relative transition-colors ${theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#0d0d0d] text-white'} ${isDragging ? 'ring-2 ring-purple-600 bg-purple-900/20' : ''}`}
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

      {/* 1. 최상단 상태 헤더 */}
      <div className={`flex items-center justify-between px-4 py-2 border-b shrink-0 z-20 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#141517] border-gray-800'}`}>
        <div className="flex items-center gap-5">
          <div 
            className="flex items-center gap-2 font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500 cursor-pointer transition-transform hover:scale-105 active:scale-95"
            onClick={() => window.location.href = '/'}
          >
            <span className="tracking-tighter">ATworks</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium font-sans">
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${theme === 'light' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-green-900/30 text-green-400 border-green-800/50'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              System Online
            </span>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${theme === 'light' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-900/30 text-blue-400 border-blue-800/50'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Playwright Ready
            </span>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${theme === 'light' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-900/30 text-purple-400 border-purple-800/50'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              Gemini AI
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-4 text-[11px] font-semibold px-4 py-1.5 rounded-full border shadow-sm ${theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#1a1b1e] border-gray-700/50 text-gray-300'}`}>
            <div className="flex items-center gap-1.5"><span className={theme === 'light' ? 'text-slate-400' : 'text-gray-500'}>Screens</span><span className="text-purple-500">{screensCount}</span></div>
            <div className={`w-px h-3 ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-700'}`}></div>
            <div className="flex items-center gap-1.5"><span className={theme === 'light' ? 'text-slate-400' : 'text-gray-500'}>APIs</span><span className="text-blue-500">{apiCount}</span></div>
            <div className={`w-px h-3 ${theme === 'light' ? 'bg-slate-200' : 'bg-gray-700'}`}></div>
            <div className="flex items-center gap-1.5"><span className={theme === 'light' ? 'text-slate-400' : 'text-gray-500'}>Scenarios</span><span className="text-emerald-500">{scenariosList.length}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white px-4 py-1.5 rounded-full transition-all shadow-[0_2px_10px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_12px_rgba(16,185,129,0.4)] hover:-translate-y-0.5">
              ▶ RUN ALL
            </button>
            <button className="text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-1.5 rounded-full transition-all shadow-[0_2px_10px_rgba(147,51,234,0.3)] hover:shadow-[0_4px_12px_rgba(147,51,234,0.4)] hover:-translate-y-0.5">
              + NEW TEST
            </button>
            <button
              onClick={onThemeToggle}
              className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${theme === 'light' ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100' : 'bg-gray-800 text-amber-400 border-gray-700 hover:bg-gray-700'}`}
              title="테마 토글"
            >
              {theme === 'light' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. 두 번째 줄 액션 바 */}
      <div className={`flex items-center px-4 py-2 border-b shrink-0 z-20 gap-3 ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1b1e] border-gray-800'}`}>
        <div className={`flex items-center border rounded-md overflow-hidden text-xs w-[300px] shrink-0 ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-[#101114] border-gray-700'}`}>
          <span className={`px-2 py-1.5 font-semibold shrink-0 border-r ${theme === 'light' ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-gray-800/60 text-gray-400 border-gray-700'}`}>📁 Path</span>
          <input
            type="text"
            value={targetPath}
            onChange={(e) => handleTargetChange(e.target.value)}
            placeholder="프로젝트 절대경로..."
            className={`bg-transparent px-2 py-1.5 focus:outline-none w-full font-mono text-[11px] ${theme === 'light' ? 'text-slate-800' : 'text-gray-200'}`}
            spellCheck="false"
          />
        </div>

        <div className={`flex-1 flex items-center border rounded-md overflow-hidden text-xs transition-colors ${theme === 'light' ? 'bg-white border-purple-300 focus-within:border-purple-600' : 'bg-[#101114] border-purple-800 focus-within:border-purple-500'}`}>
          <span className="px-2.5 text-base shrink-0">🪄</span>
          <input
            type="text"
            value={naturalPrompt}
            onChange={(e) => setNaturalPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && naturalPrompt.trim()) {
                toast.success(`자연어 지시 수신: "${naturalPrompt}"`);
                handleAnalyzeAndGenerateAI();
              }
            }}
            placeholder="자연어 시나리오 지시 (Enter로 조립)"
            className={`flex-1 bg-transparent py-1.5 focus:outline-none ${theme === 'light' ? 'text-purple-900 placeholder-purple-400' : 'text-purple-100 placeholder-purple-400/50'}`}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !targetPath || phase === 'ai'}
            className={`text-xs font-bold px-3 py-1.5 rounded border transition-colors disabled:opacity-50 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'}`}
          >
            {phase === 'static' && isAnalyzing ? '분석 중...' : '1. 라우팅 분석'}
          </button>
          
          <button
            onClick={handleGenerateAI}
            disabled={isAnalyzing || !staticReport}
            className={`text-xs font-bold px-3 py-1.5 rounded border transition-colors disabled:opacity-50 ${theme === 'light' ? 'bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300' : 'bg-purple-900/60 hover:bg-purple-800 text-purple-200 border-purple-700/80'}`}
          >
            {phase === 'ai' && isAnalyzing ? 'AI 생성 중...' : '2. AI 시나리오'}
          </button>

          <input type="file" accept=".zip" ref={fileInputRef} className="hidden" onChange={handleZipUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className={`text-xs font-bold px-3 py-1.5 rounded border transition-colors flex items-center gap-1 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'}`}
            title="ZIP 업로드"
          >
            📦 ZIP
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isAnalyzing && (
        <div className="shrink-0 px-4 py-1.5 bg-[#121316] border-b border-gray-800">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full transition-all duration-1000"
                style={{ width: phase === 'static' ? '30%' : phase === 'ai' ? '70%' : '100%' }}
              />
            </div>
            <span className="shrink-0 text-purple-400 font-mono text-[11px]">
              {phase === 'static' ? '1/2 정적 코드 분석 중...' : phase === 'ai' ? '2/2 AI 시나리오 작성 중...' : '완료'}
            </span>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3. 좌측 Explorer (240px) */}
        <div className={`w-[240px] shrink-0 flex flex-col overflow-hidden border-r transition-colors ${theme === 'light' ? 'bg-[#f8f9fa] border-slate-200' : 'bg-[#141517] border-gray-800'}`}>
          <div className={`px-3 py-2 border-b font-bold text-[11px] uppercase tracking-wider flex justify-between items-center ${theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-[#1a1b1e] border-gray-800 text-gray-400'}`}>
            <div className="flex items-center gap-1.5">
              <span>📁</span> EXPLORER
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-500/30">
            {/* Route List */}
            <div className="mb-4">
              <div className={`text-[10px] font-bold uppercase px-2 mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-gray-500'}`}>ROUTES</div>
              {apps.length === 0 ? (
                <div className="text-xs px-2 text-gray-500 italic py-1">분석된 라우트가 없습니다.</div>
              ) : (
                apps.map((app, ai) => (
                  <div key={ai} className="mb-2">
                    {apps.length > 1 && (
                      <div className="text-[10px] font-semibold px-2 py-0.5 text-purple-500">
                        {app.appName}
                      </div>
                    )}
                    {(app.screens || []).map((sc: any, si: number) => {
                      const rName = sc.route || sc.page || sc.component || '/';
                      return (
                        <div 
                          key={si}
                          onClick={() => {
                            setGraphFocusRoute(rName);
                            setStaticViewTab('graph');
                          }}
                          className={`flex items-center justify-between px-2 py-1.5 rounded text-[11px] cursor-pointer transition-colors group mb-0.5 ${theme === 'light' ? 'text-slate-700 hover:bg-slate-200' : 'text-gray-300 hover:bg-gray-800/60'}`}
                        >
                          <span className="font-mono truncate font-medium flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500">📄</span> {rName}
                          </span>
                          <span className="text-[9px] text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">✅</span>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* AI Scenarios */}
            {scenariosList.length > 0 && (
              <div>
                <div className={`text-[10px] font-bold uppercase px-2 mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-gray-500'}`}>📋 SCENARIOS</div>
                {scenariosList.map((sc, idx) => (
                  <div 
                    key={idx}
                    onClick={() => setStaticViewTab('scenarios')}
                    className={`px-2 py-1.5 rounded text-[11px] cursor-pointer transition-colors mb-0.5 flex flex-col gap-0.5 ${theme === 'light' ? 'bg-white border border-slate-200 hover:border-purple-300' : 'bg-[#1a1b1e] border border-gray-800 hover:border-purple-700'}`}
                  >
                    <div className="font-semibold text-purple-500 truncate">
                      {sc.title || sc.scenarioName || `테스트 시나리오 #${idx + 1}`}
                    </div>
                    <div className="text-[9px] text-gray-500 flex justify-between">
                      <span>{(sc.flow || sc.steps || sc.actions || []).length} steps</span>
                      <span className="text-emerald-500">Ready</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Examples */}
          <div className={`p-2 border-t ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-[#1a1b1e] border-gray-800'}`}>
            <div className={`text-[10px] font-bold uppercase px-1 mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-gray-500'}`}>빠른 예시</div>
            <div className="flex gap-1">
              <button onClick={() => { handleTargetChange('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\shopping-mall-next-js'); setReferenceLog(DEFAULT_API_LOGS); setLoadedLogFileName('shopping_mall_api_logs.json'); }} className={`flex-1 text-[10px] py-1 rounded border transition-colors ${theme === 'light' ? 'bg-white hover:bg-slate-200 border-slate-300' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'}`}>쇼핑몰</button>
              <button onClick={() => { handleTargetChange('C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\react-board-example'); setReferenceLog(DEFAULT_BOARD_LOGS); setLoadedLogFileName('react_board_api_logs.json'); }} className={`flex-1 text-[10px] py-1 rounded border transition-colors ${theme === 'light' ? 'bg-white hover:bg-slate-200 border-slate-300' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'}`}>게시판</button>
            </div>
          </div>
        </div>

        {/* 4. 중앙 워크벤치 (flex-1) */}
        <div className={`flex-1 flex flex-col overflow-hidden relative ${theme === 'light' ? 'bg-slate-50' : 'bg-[#0d0d0d]'}`}>
          {/* Sub Tabs */}
          <div className={`flex items-center px-4 py-1.5 border-b shrink-0 gap-1 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#141517] border-gray-800'}`}>
            <button onClick={() => setStaticViewTab('graph')} className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${staticViewTab === 'graph' ? 'bg-purple-600 text-white' : theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-gray-400 hover:bg-gray-800'}`}>🗺 Flow Map</button>
            <button onClick={() => setStaticViewTab('list')} className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${staticViewTab === 'list' ? 'bg-purple-600 text-white' : theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-gray-400 hover:bg-gray-800'}`}>📄 Route List</button>
            <button onClick={() => setStaticViewTab('scenarios')} className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${staticViewTab === 'scenarios' ? 'bg-purple-600 text-white' : theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-gray-400 hover:bg-gray-800'}`}>📋 Scenarios</button>
            <button onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} className={`ml-auto text-xs font-semibold px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${isRightPanelOpen ? 'bg-purple-600 text-white' : theme === 'light' ? 'text-slate-600 hover:bg-slate-100 border border-slate-200' : 'text-gray-400 hover:bg-gray-800 border border-gray-700'}`}>📜 Inspector</button>
          </div>

          <div className="flex-1 overflow-auto relative">
            {phase === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/5 backdrop-blur-sm z-10">
                <div className={`flex flex-col p-8 rounded-2xl border shadow-2xl w-full max-w-xl ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#141517] border-gray-800'}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="text-4xl">🚀</div>
                    <div>
                      <h2 className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>초기 프로젝트 설정</h2>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>프론트엔드 경로와 백엔드 API 로그를 설정해주세요.</p>
                    </div>
                  </div>

                  {/* 프론트엔드 설정 영역 */}
                  <div className="mb-5">
                    <label className={`block text-sm font-semibold mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>프론트엔드 프로젝트 경로 (Target)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={targetPath}
                        onChange={(e) => handleTargetChange(e.target.value)}
                        placeholder="예: C:\projects\my-app"
                        className={`flex-1 px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme === 'light' ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#1a1b1e] border-gray-700 text-white'}`}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300' : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'}`}
                        title="ZIP 파일 업로드"
                      >
                        📁 업로드
                      </button>
                    </div>
                  </div>

                  {/* 백엔드 API 로그 설정 영역 */}
                  <div className="mb-6">
                    <div className="flex justify-between items-end mb-2">
                      <label className={`block text-sm font-semibold ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>백엔드 API 로그 (JSON)</label>
                      <button 
                        onClick={() => logFileInputRef.current?.click()}
                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'}`}
                      >
                        📄 파일 로드
                      </button>
                    </div>
                    <textarea 
                      value={referenceLog}
                      onChange={(e) => setReferenceLog(e.target.value)}
                      placeholder="API 로그 JSON을 붙여넣으세요..."
                      className={`w-full h-20 p-3 rounded-lg border font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none ${theme === 'light' ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#1a1b1e] border-gray-700 text-gray-300'}`}
                    />
                  </div>

                  {/* 최근 내역 (Quick Start) */}
                  <div className="mb-8">
                    <label className={`block text-xs font-semibold mb-3 uppercase tracking-wider ${theme === 'light' ? 'text-slate-500' : 'text-gray-500'}`}>빠른 시작 (Quick Start)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { name: '쇼핑몰 결제 모듈 예시', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\shopping-mall-next-js', logs: DEFAULT_API_LOGS, logName: 'shopping_mall_api_logs.json' },
                        { name: '사내 게시판 예시', path: 'C:\\Users\\lee\\Desktop\\atworks-test\\poc\\tmp-project\\board', logs: DEFAULT_BOARD_LOGS, logName: 'react_board_api_logs.json' }
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            handleTargetChange(item.path);
                            setReferenceLog(item.logs);
                            setLoadedLogFileName(item.logName);
                            setTimeout(() => {
                              handleAnalyze();
                            }, 100);
                          }}
                          className={`text-left p-3 rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-md ${theme === 'light' ? 'bg-white border-slate-200 hover:border-purple-400' : 'bg-[#16171a] border-gray-800 hover:border-purple-500/50'}`}
                        >
                          <div className={`font-medium text-sm mb-1 ${theme === 'light' ? 'text-slate-800' : 'text-gray-200'}`}>💡 {item.name}</div>
                          <div className={`text-[10px] truncate ${theme === 'light' ? 'text-slate-500' : 'text-gray-500'}`}>{item.path}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 실행 버튼 */}
                  <button 
                    onClick={handleAnalyze}
                    className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg transition-colors shadow-lg hover:shadow-purple-500/30 flex items-center justify-center gap-2"
                  >
                    🚀 라우팅 분석 시작
                  </button>
                </div>
              </div>
            )}

            {phase !== 'idle' && staticViewTab === 'graph' && (
              <div className="absolute inset-0 z-0">
                <RouteGraphView 
                  apps={apps} 
                  focusRoute={graphFocusRoute} 
                  theme={theme}
                  onGoToDetails={(route) => {
                    setGraphFocusRoute(route);
                    setStaticViewTab('list');
                  }}
                />
              </div>
            )}

            {phase !== 'idle' && staticViewTab === 'list' && (
              <div className={`absolute inset-0 p-6 overflow-y-auto ${theme === 'light' ? 'bg-slate-50' : 'bg-[#0d0d0d]'}`}>
                {renderRouteDetails(apps[activeAppIndex]?.screens || [])}
              </div>
            )}

            {staticViewTab === 'scenarios' && scenariosList.length > 0 && (
              <div className={`absolute inset-0 p-6 overflow-y-auto ${theme === 'light' ? 'bg-slate-50' : 'bg-[#0d0d0d]'}`}>
                <div className="max-w-4xl mx-auto space-y-6">
                  {scenariosList.map((scenario: any, i: number) => (
                    <div key={i} className={`border rounded-xl overflow-hidden shadow-sm ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#141517] border-gray-800'}`}>
                      <div className={`p-5 border-b flex justify-between items-start ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1b1e] border-gray-800'}`}>
                        <div>
                          <h3 className={`font-bold text-lg mb-1 flex items-center gap-2 ${theme === 'light' ? 'text-purple-700' : 'text-purple-400'}`}>
                            🎯 {scenario.title || `시나리오 #${i + 1}`}
                          </h3>
                          {scenario.description && <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-gray-400'}`}>{scenario.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleOpenEditModal(i)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded transition-colors font-semibold flex items-center gap-1">💬 AI 편집</button>
                          <button onClick={() => { setExecutingScenarioIndex(i); setIsExecuteModalOpen(true); }} className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded transition-colors font-semibold">▶️ 실행</button>
                          <button onClick={() => handleExportE2E(scenario)} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded transition-colors font-semibold">📝 코드 추출</button>
                          <button onClick={() => { setSavingScenario(scenario); setTargetCollectionId(''); setNewCollectionName(''); }} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors font-semibold">📥 컬렉션 저장</button>
                        </div>
                      </div>
                      <div className="p-5 space-y-4">
                        {((scenario.flow || scenario.steps || scenario.actions || scenario.scenario) || []).map((step: any, j: number) => {
                          const actionText = typeof step === 'string' ? step : (step.description || step.title || step.action || 'Action');
                          const isAdded = typeof step === 'object' && step.isAdded;
                          const isModified = typeof step === 'object' && step.isModified;
                          return (
                            <div key={j} className={`flex gap-4 p-2 rounded-lg transition-colors ${isAdded ? (theme === 'light' ? 'bg-emerald-50/80 border border-emerald-200' : 'bg-emerald-950/20 border border-emerald-800/40') : isModified ? (theme === 'light' ? 'bg-purple-50/80 border border-purple-200' : 'bg-purple-950/20 border border-purple-800/40') : ''}`}>
                              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isAdded ? 'bg-emerald-500 text-white' : isModified ? 'bg-purple-500 text-white' : (theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-900/40 text-purple-300 border border-purple-700/50')}`}>
                                {j + 1}
                              </div>
                              <div className={`mt-1.5 text-sm font-medium flex-1 flex items-center justify-between ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>
                                <span>{actionText}</span>
                                {isAdded && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500 text-white uppercase">NEW</span>}
                                {isModified && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500 text-white uppercase">MOD</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. 우측 Inspector 패널 (300px) */}
        {isRightPanelOpen && (
          <div className={`w-[300px] shrink-0 border-l flex flex-col transition-colors ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#141517] border-gray-800'}`}>
            <div className={`p-3 border-b flex justify-between items-center ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1b1e] border-gray-800'}`}>
              <div className={`font-bold text-xs uppercase tracking-wider ${theme === 'light' ? 'text-slate-600' : 'text-gray-400'}`}>📜 Inspector</div>
              <button onClick={() => setIsRightPanelOpen(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
            </div>
            <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto">
              <label className={`text-xs font-bold ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>API Logs (api_logs.json)</label>
              <textarea
                value={referenceLog}
                onChange={(e) => { setReferenceLog(e.target.value); setLoadedLogFileName('수동 입력'); }}
                disabled={isAnalyzing}
                className={`flex-1 w-full text-[10px] font-mono p-3 rounded-lg border outline-none resize-none scrollbar-thin ${theme === 'light' ? 'bg-slate-50 border-slate-300 text-slate-700 focus:border-purple-500' : 'bg-[#0d0d0d] border-gray-700 text-gray-300 focus:border-purple-500'}`}
                spellCheck="false"
              />
              <div className="flex gap-2">
                <button onClick={() => logFileInputRef.current?.click()} className={`flex-1 text-xs py-1.5 rounded border font-semibold ${theme === 'light' ? 'bg-white border-slate-300 hover:bg-slate-100' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200'}`}>파일 로드</button>
                <input type="file" accept=".json,.txt,.log" ref={logFileInputRef} className="hidden" onChange={handleLogFileUpload} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 모달: Save to Collection */}
      {savingScenario && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`border rounded-xl shadow-2xl w-full max-w-md overflow-hidden ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#1e1e1e] border-gray-700'}`}>
            <div className={`p-5 border-b ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#252628] border-gray-800'}`}>
              <h3 className={`text-lg font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                📥 API Genie 컬렉션에 등록
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className={`block text-sm font-semibold mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>저장할 대상 시나리오</label>
                <div className={`text-sm p-3 rounded-lg border line-clamp-2 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-black/30 border-gray-800 text-gray-400'}`}>
                  {savingScenario.title}
                </div>
              </div>
              <div className="mb-4">
                <label className={`block text-sm font-semibold mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>저장할 컬렉션 선택</label>
                <select
                  value={targetCollectionId}
                  onChange={(e) => setTargetCollectionId(e.target.value)}
                  className={`w-full border rounded-lg px-4 py-2.5 outline-none transition-all ${theme === 'light' ? 'bg-white border-slate-300 text-slate-800 focus:border-blue-500' : 'bg-[#121316] border-gray-700 text-white focus:border-blue-500'}`}
                >
                  <option value="" disabled>컬렉션을 선택하세요...</option>
                  <option value="new" className="font-bold text-blue-500">➕ 새 컬렉션 만들기</option>
                  {localCollections && localCollections
                    .filter(col => col.name.includes('전이') || col.mode === 'chaining')
                    .map(col => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))
                  }
                </select>
              </div>
              {targetCollectionId === 'new' && (
                <div className="mb-2 relative">
                  <label className={`block text-sm font-semibold mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-gray-300'}`}>새 컬렉션 이름</label>
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="컬렉션 이름을 입력하세요"
                    className={`w-full border rounded-lg px-4 py-2.5 outline-none transition-all ${theme === 'light' ? 'bg-white border-slate-300 text-slate-800 focus:border-blue-500' : 'bg-[#121316] border-gray-700 text-white focus:border-blue-500'}`}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setSavingScenario(null)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
                >
                  취소
                </button>
                <button
                  onClick={handleExecuteSaveToCollection}
                  disabled={isSavingToCollection || !targetCollectionId || (targetCollectionId === 'new' && !newCollectionName.trim())}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
                >
                  {isSavingToCollection ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI 대화형 시나리오 편집기 모달 (2-Pane Split Drawer) */}
      {editingScenarioIndex !== null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`border rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden transition-colors ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#141517] border-gray-800'}`}>
            {/* Modal Header */}
            <div className={`p-4 px-6 border-b flex justify-between items-center ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1b1e] border-gray-800'}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <div>
                  <h3 className={`font-bold text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    AI 대화형 시나리오 편집기
                  </h3>
                  <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>
                    "{scenariosList[editingScenarioIndex]?.title || '시나리오'}" - 자연어로 자유롭게 단계를 수정하세요
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleUndoScenario(editingScenarioIndex)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${theme === 'light' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-amber-950/40 text-amber-300 border-amber-800/50 hover:bg-amber-900/40'}`}
                  title="이전 시나리오 상태로 복원"
                >
                  ↺ 실행 취소 (Undo)
                </button>
                <button
                  onClick={() => setEditingScenarioIndex(null)}
                  className={`text-sm px-2.5 py-1 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-gray-800 text-gray-400'}`}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body (2-Pane Layout) */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Pane: Live Scenario View */}
              <div className={`w-1/2 border-r flex flex-col p-5 overflow-y-auto ${theme === 'light' ? 'bg-slate-50/50 border-slate-200' : 'bg-[#101114] border-gray-800'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>
                    📋 실시간 시나리오 스텝 ({(scenariosList[editingScenarioIndex]?.flow || scenariosList[editingScenarioIndex]?.steps || []).length} Steps)
                  </span>
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Live Synced</span>
                </div>
                
                <div className="space-y-3 flex-1">
                  {((scenariosList[editingScenarioIndex]?.flow || scenariosList[editingScenarioIndex]?.steps || scenariosList[editingScenarioIndex]?.actions || [])).map((step: any, sIdx: number) => {
                    const stepText = typeof step === 'string' ? step : (step.description || step.action || step.title || 'Step');
                    const isAdded = typeof step === 'object' && step.isAdded;
                    const isModified = typeof step === 'object' && step.isModified;
                    return (
                      <div
                        key={sIdx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isAdded 
                            ? (theme === 'light' ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 shadow-sm' : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200')
                            : isModified
                            ? (theme === 'light' ? 'bg-purple-50/80 border-purple-300 text-purple-900 shadow-sm' : 'bg-purple-950/30 border-purple-800/60 text-purple-200')
                            : (theme === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-[#16171a] border-gray-800 text-gray-300')
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                            isAdded ? 'bg-emerald-500 text-white' : isModified ? 'bg-purple-500 text-white' : (theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-gray-800 text-gray-400')
                          }`}>
                            {sIdx + 1}
                          </div>
                          <div className="flex-1 text-xs leading-relaxed">
                            <div className="font-medium flex items-center gap-2">
                              <span>{stepText}</span>
                              {isAdded && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white uppercase">NEW</span>}
                              {isModified && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500 text-white uppercase">MOD</span>}
                            </div>
                            {typeof step === 'object' && step.type && (
                              <div className={`text-[10px] mt-1 font-mono ${theme === 'light' ? 'text-slate-500' : 'text-gray-500'}`}>
                                Type: {step.type} {step.target ? `| Target: ${step.target}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Pane: AI Assistant Chat */}
              <div className="w-1/2 flex flex-col p-5 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-2 scrollbar-thin">
                  {editChatHistory.map((msg, mIdx) => (
                    <div
                      key={mIdx}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'ai' && (
                        <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs shrink-0 font-bold shadow-sm">
                          🤖
                        </div>
                      )}
                      <div
                        className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-purple-600 text-white rounded-tr-none shadow-sm'
                            : (theme === 'light' ? 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-none' : 'bg-[#1a1b1e] text-gray-200 border border-gray-800 rounded-tl-none')
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isEditingLoading && (
                    <div className="flex gap-3 justify-start items-center">
                      <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs shrink-0 font-bold animate-pulse">
                        🤖
                      </div>
                      <div className={`p-3 rounded-2xl text-xs ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-[#1a1b1e] text-gray-400'}`}>
                        AI가 사용자의 지시를 분석하여 시나리오를 재구성하는 중... ⚡
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Chips */}
                <div className="mb-3">
                  <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-gray-500'}`}>
                    💡 추천 프롬프트 (Quick Chips)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      '결제 실패 팝업 확인 예외 케이스 추가해줘',
                      '로그인 안 한 상태 접근 거부 분기 추가해줘',
                      '마지막 단계에 API 응답 200 검증 강화해줘',
                      '마지막 단계 지워줘'
                    ].map((chip, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => handleSendEditInstruction(chip)}
                        disabled={isEditingLoading}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-all disabled:opacity-50 ${theme === 'light' ? 'bg-white border-slate-300 text-slate-700 hover:border-purple-400 hover:bg-purple-50' : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:border-purple-500 hover:bg-purple-900/30'}`}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Controls */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editInstruction}
                    onChange={(e) => setEditInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isEditingLoading) {
                        handleSendEditInstruction();
                      }
                    }}
                    disabled={isEditingLoading}
                    placeholder="AI에게 시나리오 수정 지시를 내려보세요 (Enter 전송)..."
                    className={`flex-1 px-4 py-2.5 rounded-xl border text-xs outline-none transition-all ${theme === 'light' ? 'bg-white border-slate-300 text-slate-800 focus:border-purple-500' : 'bg-[#101114] border-gray-700 text-white focus:border-purple-500'}`}
                  />
                  <button
                    onClick={() => handleSendEditInstruction()}
                    disabled={isEditingLoading || !editInstruction.trim()}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isEditingLoading ? '분석 중...' : '전송'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
