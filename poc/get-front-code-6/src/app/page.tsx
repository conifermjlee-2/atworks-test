'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { MappingItem, MappingResult } from '@/types';
import styles from './page.module.css';

const CALL_LABEL: Record<string, string> = {
  Client: 'Client',
  ServerComponent: 'Server Component',
  ServerAction: 'Server Action',
  Unknown: 'Unknown',
};

export default function Home() {
  const [targetPath, setTargetPath] = useState('');
  const [result, setResult] = useState<MappingResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, MappingItem[]>();
    for (const item of result?.mappings ?? []) {
      const key = `${item.viewName}|${item.file}|${item.callType}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return Array.from(map.entries());
  }, [result]);

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!targetPath.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '분석 실패');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function copyMarkdown() {
    if (!result) return;
    const rows = result.mappings.map(item =>
      `| ${item.viewName} | ${item.callType} | ${item.file} | ${item.api.method} | ${item.api.endpoint} | ${item.api.resolver} |`,
    );
    await navigator.clipboard.writeText([
      '## 화면별 API 매핑',
      '',
      `- 대상: \`${result.targetPath}\``,
      `- 파일: ${result.totalFiles}개`,
      `- API: ${result.totalApis}개`,
      '',
      '| View | Type | File | Method | Endpoint | Resolver |',
      '|---|---|---|---|---|---|',
      ...rows,
    ].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <main className={styles.shell}>
      <section className={styles.header}>
        <div>
          <p className={styles.eyebrow}>get-front-code-6 · Offline AST Analyzer</p>
          <h1>프론트엔드 API 정적 분석기</h1>
          <p className={styles.lead}>
            React와 Next.js 소스에서 화면별 REST API 호출을 추적합니다. Fetch, Axios, React Query, SWR, RTK Query를 AST 기반으로 수집합니다.
          </p>
        </div>
        <div className={styles.metrics}>
          <Metric label="Files" value={result?.totalFiles ?? 0} />
          <Metric label="Views" value={result?.totalViews ?? 0} />
          <Metric label="APIs" value={result?.totalApis ?? 0} />
        </div>
      </section>

      <section className={styles.panel}>
        <form className={styles.form} onSubmit={analyze}>
          <label htmlFor="targetPath">분석 대상 폴더</label>
          <div className={styles.inputRow}>
            <input
              id="targetPath"
              value={targetPath}
              onChange={event => setTargetPath(event.target.value)}
              placeholder="C:\Users\lee\Desktop\atworks-test\poc\tmp-project\..."
              spellCheck={false}
            />
            <button disabled={loading || !targetPath.trim()}>{loading ? '분석 중' : '분석 실행'}</button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </form>
        <aside className={styles.scope}>
          <span>지원 범위</span>
          <strong>Next App Router, React, TS/JS</strong>
          <strong>fetch · axios · useQuery · useSWR · createApi</strong>
          <strong>tsconfig paths alias</strong>
        </aside>
      </section>

      {result && (
        <section className={styles.results}>
          <div className={styles.toolbar}>
            <div>
              <h2>분석 결과</h2>
              <p>{result.targetPath}</p>
            </div>
            <button type="button" onClick={copyMarkdown}>{copied ? '복사됨' : 'Markdown 복사'}</button>
          </div>

          {groups.length === 0 ? (
            <div className={styles.empty}>검출된 API 호출이 없습니다.</div>
          ) : (
            <div className={styles.accordion}>
              {groups.map(([key, items], index) => {
                const [viewName, file, callType] = key.split('|');
                return (
                  <details key={key} open>
                    <summary>
                      <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
                      <span className={styles.view}>{viewName}</span>
                      <span className={`call-${callType.toLowerCase()} ${styles.call}`}>{CALL_LABEL[callType] ?? callType}</span>
                      <code>{file}</code>
                      <b>{items.length}</b>
                    </summary>
                    <ul>
                      {items.map((item, itemIndex) => (
                        <li key={`${item.api.endpoint}-${itemIndex}`}>
                          <span className={`${styles.method} method-${item.api.method.toLowerCase()}`}>{item.api.method}</span>
                          <code>{item.api.endpoint}</code>
                          <small>{item.api.resolver}{item.api.isDynamic ? ' · dynamic' : ''}</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          )}

          {result.errors.length > 0 && (
            <details className={styles.errors}>
              <summary>파싱 오류 {result.errors.length}개</summary>
              <ul>
                {result.errors.map(item => (
                  <li key={item.file}><code>{item.file}</code> {item.message}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
