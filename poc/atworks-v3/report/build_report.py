import os, pathlib, re

BRAIN = pathlib.Path(r'C:\Users\lee\.gemini\antigravity\brain')
REPORT = pathlib.Path(r'C:\Users\lee\Desktop\atworks-test\poc\atworks-v3\report')

def read(p):
    try:
        return pathlib.Path(p).read_text(encoding='utf-8')
    except Exception as e:
        return f'<!-- [ERROR: {e}] -->'

def extract_body(html):
    m = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m2 = re.search(r'</style>(.*)', html, re.DOTALL | re.IGNORECASE)
    if m2:
        return m2.group(1).strip()
    return html

ai_html    = read(BRAIN / '5640b45a-a51f-487d-af1e-1e78fc1567cf' / 'section_ai_scenario.html')
chain_html = read(REPORT / 'section_chaining.html')
test_html  = read(BRAIN / '0747f770-349e-4a04-a9ee-82bb8a371c97' / 'section_api_test.html')

ai_body    = extract_body(ai_html)
chain_body = extract_body(chain_html)
test_body  = extract_body(test_html)

print(f'Bodies: ai={len(ai_body)}, chain={len(chain_body)}, test={len(test_body)}')

HEAD = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>atworks-v3 프론트 소스 분석 &amp; AI 시나리오 파이프라인 심층 분석</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
:root{--bg:#0a0b0e;--surface:#111318;--surface2:#181b22;--border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.10);--text:#e8eaf0;--muted:#6b7280;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:"Inter",sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px;}
.hero{padding:72px 48px 56px;border-bottom:1px solid var(--border);position:relative;overflow:hidden;}
.hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 60% -10%,rgba(99,102,241,0.12) 0%,transparent 70%),radial-gradient(ellipse 40% 40% at 10% 100%,rgba(16,185,129,0.08) 0%,transparent 60%);pointer-events:none;}
.hero-label{display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);color:#818cf8;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:4px 12px;border-radius:100px;margin-bottom:28px;}
.hero h1{font-size:clamp(32px,5vw,56px);font-weight:800;line-height:1.15;letter-spacing:-.03em;margin-bottom:20px;}
.hero h1 em{font-style:normal;color:#818cf8;}
.hero-desc{font-size:15px;color:var(--muted);max-width:700px;line-height:1.75;margin-bottom:40px;}
.hero-desc strong{color:var(--text);}
.legend{display:flex;gap:8px;flex-wrap:wrap;}
.legend-item{display:flex;align-items:center;gap:6px;padding:5px 14px;border-radius:100px;border:1px solid var(--border2);background:var(--surface);font-size:12px;font-weight:500;}
.legend-dot{width:8px;height:8px;border-radius:50%;}
.nav-tabs{display:flex;border-bottom:1px solid var(--border);padding:0 48px;position:sticky;top:0;background:rgba(10,11,14,0.92);backdrop-filter:blur(20px);z-index:100;}
.nav-tab{padding:16px 20px;font-size:13px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;cursor:pointer;transition:all .2s;text-decoration:none;display:flex;align-items:center;gap:7px;}
.nav-tab:hover{color:var(--text);}
.nav-tab.active{color:var(--text);border-bottom-color:#818cf8;}
.nav-dot{width:7px;height:7px;border-radius:50%;}
.section-wrapper{padding:60px 48px 80px;}
.section-divider{border:none;border-top:1px solid var(--border);margin:0;}
footer{border-top:1px solid var(--border);padding:32px 48px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted);}
footer strong{color:var(--text);}
@media(max-width:768px){.hero,.section-wrapper{padding-left:24px;padding-right:24px;}.nav-tabs{padding:0 24px;}footer{flex-direction:column;gap:8px;text-align:center;padding:24px;}}
</style>
</head>
<body>
<header class="hero">
<div class="hero-label">🔬 atworks-v3 · 프로젝트 심층 분석 리포트</div>
<h1>프론트 소스를 어떻게 타고 들어가<br><em>화면·액션·API</em>를 발라내는가</h1>
<p class="hero-desc">분석기는 코드를 런타임에 직접 실행하지 않습니다. 소스코드를 <strong>AST(구문 분석 트리)</strong>로 파싱하여 <strong>화면 경로(Route) → 사용자 액션(Action) → API 호출(Endpoint) → Payload 타입</strong> 간의 정적 연관 관계를 구축한 후, <strong>LLM</strong>이 테스트 시나리오를 제안합니다.</p>
<div class="legend">
<div class="legend-item"><div class="legend-dot" style="background:#818cf8"></div>시나리오 with AI (1~3단계)</div>
<div class="legend-item"><div class="legend-dot" style="background:#34d399"></div>API 전이 추적 (추출 중)</div>
<div class="legend-item"><div class="legend-dot" style="background:#fcd34d"></div>API 테스트 (진입 입력)</div>
<div class="legend-item"><div class="legend-dot" style="background:#f97316"></div>LLM AI 제작</div>
</div>
</header>
<nav class="nav-tabs">
<a class="nav-tab active" href="#scenario-ai"><div class="nav-dot" style="background:#818cf8"></div>시나리오 with AI</a>
<a class="nav-tab" href="#api-chaining"><div class="nav-dot" style="background:#34d399"></div>API 테스트 전이 기능</a>
<a class="nav-tab" href="#api-test"><div class="nav-dot" style="background:#fcd34d"></div>API 테스트 기능</a>
</nav>"""

FOOT = """<footer>
<div><strong>atworks-v3</strong> — 프론트 소스 분석 기반 API 자동 등록 &amp; AI 시나리오 파이프라인</div>
<div>Next.js · TypeScript · AST(Babel) · LLM · react-query</div>
</footer>
<script>
const tabs=document.querySelectorAll(".nav-tab");
const ids=["scenario-ai","api-chaining","api-test"];
const sections=ids.map(id=>document.getElementById(id)).filter(Boolean);
const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){const i=sections.indexOf(e.target);if(i>=0)tabs.forEach((t,j)=>t.classList.toggle("active",i===j));}});},{rootMargin:"-30% 0px -60% 0px"});
sections.forEach(s=>obs.observe(s));
tabs.forEach((tab,i)=>{tab.addEventListener("click",e=>{e.preventDefault();sections[i]?.scrollIntoView({behavior:"smooth"});});});
</script>
</body></html>"""

html = (HEAD +
    '<div class="section-wrapper" id="scenario-ai">' + ai_body + '</div>' +
    '<hr class="section-divider"/>' +
    '<div class="section-wrapper" id="api-chaining">' + chain_body + '</div>' +
    '<hr class="section-divider"/>' +
    '<div class="section-wrapper" id="api-test">' + test_body + '</div>' +
    FOOT)

out = REPORT / 'index.html'
out.write_text(html, encoding='utf-8')
print(f'index.html saved: {len(html):,} bytes')
