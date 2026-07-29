# atworks-v3 — 프론트 코드 분석 기반 API 자동 등록 기능 기획서

## 1. 배경 및 목적

atworks-v3는 Postman 유사한 API 요청/컬렉션 관리 도구다. 현재는 API를 **수동으로 하나씩 등록**해야 하는데, 실제 API 목록은 이미 프론트엔드 코드(fetch/axios/react-query/useSWR 호출부, Next.js route handler)에 다 존재한다.

이 기능은 **로컬 프론트 프로젝트 경로를 입력하면 → 코드에서 API 호출부를 자동 탐지해 후보로 추천하고 → 사람이 골라서 → 이미 만들어둔 특정 컬렉션에 등록**하는 흐름을 제공한다. 목표는 "API 등록의 수작업 최소화"이지, "완전 자동화"가 아니다 (정적분석 특성상 confidence가 붙은 후보 추천까지가 현실적 목표).

## 2. 확정된 제품 조건 (사용자 확인 완료)

| 항목 | 결정 |
|---|---|
| 소스 연동 방식 | 사용자가 **로컬 파일시스템 경로를 직접 입력** (예: `C:\Users\lee\Desktop\atworks-test\poc\tmp-project\shopping-mall-next-js`) |
| 실행 환경 | atworks-v3를 **로컬에서 구동**, 별도 Git clone/인증 불필요 — 입력한 경로를 바로 스캔 |
| 반영 방식 | 시스템이 **후보를 추천** → 사람이 **선택** → 사람이 **미리 만들어둔 특정 컬렉션**에 등록 |
| 1차 범위 | **모노레포/멀티레포까지 고려**, **워크스페이스 다중 관리 지원** |
| 대상 프레임워크 | React, Next.js 우선 (fetch, axios, TanStack/React Query, useSWR, Next.js route 컨벤션) |
| 추가 분석 기능 | 프론트엔드 코드 기반 **API 전이(Chaining) 관계 추적** 기능 포함 |

## 3. 핵심 사용자 흐름 (End-to-End)

```
[1] 로컬 경로 입력
    사용자가 로컬 프론트 프로젝트 경로 입력
    예: C:\Users\lee\Desktop\atworks-test\poc\tmp-project\shopping-mall-next-js
    (atworks-v3가 로컬에서 구동되므로 별도 Git clone/인증 절차 없이 해당 경로를 바로 스캔)
        ↓
[2] 서브 프로젝트 감지 (모노레포 대응)
    입력 경로 하위 스캔 → package.json / app 디렉토리 여러 개 발견 시
    "apps/web, apps/admin, packages/shared-ui" 처럼 서브 프로젝트 목록 표시
    → 사용자가 분석 대상 서브 프로젝트 체크
        ↓
[3] 분석 실행 (백그라운드 잡)
    선택된 서브 프로젝트별로 AST 분석 엔진 실행
    (fetch / axios / react-query / useSWR / 이름 모를 커스텀 wrapper 휴리스틱 /
     Next.js app-router·pages-router 컨벤션)
        ↓
[4] 후보 리스트 화면
    서브 프로젝트별 그룹핑, confidence(high/medium/low) 표시,
    이미 사용자가 갖고 있는 기존 컬렉션 항목과 url+method 비교해
    "이미 등록됨" 뱃지로 중복 후보 사전 필터링
        ↓
[5] 선택 & 등록
    사용자가 원하는 후보 체크 → 대상 컬렉션 선택(기존에 만들어둔 컬렉션 드롭다운)
    → [컬렉션에 추가] 클릭
        ↓
[6] 등록 완료
    선택된 항목이 컬렉션 내 개별 요청(Request)으로 생성됨
    (method, url 자동 채움 + description에 출처 메타데이터 자동 삽입)
```

## 4. 화면 설계 (와이어프레임 레벨)

### 4-0. 글로벌 사이드바 (워크스페이스 및 컬렉션 관리)
- 상단 타이틀인 "My Workspace"를 **셀렉트박스(드롭다운)** 형태로 제공하여, 여러 워크스페이스(프로젝트 단위, 팀 단위 등) 간의 전환이 가능하도록 구성.
- 선택된 워크스페이스 내에 종속된 컬렉션 목록 출력.

### 4-1. 로컬 경로 입력 화면
- 입력창: 로컬 프로젝트 절대경로 (예: `C:\Users\lee\Desktop\atworks-test\poc\tmp-project\shopping-mall-next-js`)
- 경로 유효성 검사: 존재하는 디렉토리인지, `package.json`이 하위에 하나라도 있는지 즉시 체크
- Windows 경로(`\`)와 macOS/Linux 경로(`/`) 둘 다 입력 가능하도록 파싱 처리
- `[분석 시작]` 버튼

### 4-2. 서브 프로젝트 선택 화면 (모노레포 대응)
- 루트 스캔 결과를 트리/리스트로 표시
```
☑ apps/web            (Next.js, app router 감지)
☑ apps/admin          (Next.js, pages router 감지)
☐ packages/shared-ui  (React 컴포넌트, API 호출 없음으로 추정 → 기본 체크 해제)
```
- 서브 프로젝트 판별 기준: `package.json` 존재 위치 + `next.config.js`/`app`·`pages` 디렉토리 유무로 자동 그룹핑, 사용자가 수동으로 추가/제외 가능

### 4-3. 후보 리스트 화면 (핵심 화면)
| 선택 | 서브프로젝트 | Method | URL | Confidence | 근거/출처 | 상태 |
|---|---|---|---|---|---|---|
| ☑ | apps/web | POST | /api/orders | High | axios · src/api/order.ts:13 | 신규 |
| ☑ | apps/web | GET | /api/profile | High | react-query · src/hooks/useProfile.ts:23 | 신규 |
| ☐ | apps/admin | GET | /api/users/{id} | Medium | 커스텀 wrapper(httpService.request) · src/lib/http.ts:7 | 신규 |
| — | apps/web | GET | /api/dashboard | High | Next.js route handler | **이미 등록됨** (dimmed 처리) |

- 필터: confidence(전체/high만/medium+low만), 서브프로젝트, 라이브러리 종류
- 검색: URL 패턴 검색
- Low confidence 항목은 기본 접힘(collapsed) 처리, 필요시 펼쳐서 확인
- 근거/출처 클릭 시 해당 코드 라인 미리보기 (스니펫) 표시 — 검토 신뢰도를 높이는 핵심 UX

### 4-4. 후보 선택 → 특정 컬렉션 등록 (핵심 플로우 상세)

**선택 UX**
- 후보 리스트 각 행 앞 체크박스로 다중 선택 (서브 프로젝트/파일 경계 상관없이 자유롭게 섞어서 선택 가능)
- 리스트 상단 "전체 선택" / "이 서브프로젝트만 선택" / "high confidence만 선택" 등 일괄 선택 버튼 제공
- 이미 "등록됨"으로 표시된 항목은 체크박스 비활성화(재등록 방지)
- 선택 시 하단에 플로팅 액션바 노출: `N개 선택됨  [컬렉션에 추가]`

**대상 컬렉션 선택 모달** (`[컬렉션에 추가]` 클릭 시 오픈)
```
┌─────────────────────────────────────┐
│  선택한 12개 API를 등록할 컬렉션 선택      │
│                                       │
│  대상 컬렉션 ▾ [ 쇼핑몰 주문 API      ]  │  ← 사용자가 미리 만들어둔 컬렉션 목록에서 선택
│                                       │
│  등록 미리보기                          │
│  · POST /api/orders                  │
│  · GET  /api/profile                 │
│  · GET  /api/users/{id}              │
│  ... 외 9건                           │
│                                       │
│         [취소]      [등록]            │
└─────────────────────────────────────┘
```
- 대상 컬렉션 드롭다운은 **atworks-v3에 이미 존재하는 컬렉션만** 노출 (신규 컬렉션 생성은 이 모달 밖에서 기존 흐름대로 사용자가 미리 진행 — 확정된 조건대로 "특정 컬렉션은 내가 먼저 만든다")
- 컬렉션 내 폴더 구조가 있다면(하위 폴더로 그룹핑 운영 중인 경우) 폴더 선택 옵션도 함께 노출 (선택 안 하면 컬렉션 최상위에 등록)

**등록 시 후보 → 컬렉션 요청(Request) 필드 매핑**

| 후보(ApiCandidate) 필드 | 등록되는 Request 필드 | 비고 |
|---|---|---|
| method | Method | 그대로 매핑 |
| url | URL | path parameter 표기 정규화(`{id}` 형태로 통일) |
| library, confidence, file_path, line | Description | 자동 생성 문구 삽입: `자동 감지됨 · axios · src/api/order.ts:13 · confidence: high` |
| — | Params/Headers/Body | 기본 비워둠 (정적분석으로 body 스키마까지 추론하는 건 1차 범위 밖 → 사용자가 등록 후 직접 채움) |
| — | Name(요청 이름) | `{METHOD} {URL}` 형태로 자동 생성, 등록 후 사용자가 자유롭게 수정 가능 |

**등록 처리 및 결과**
- `[등록]` 클릭 → 선택된 후보들을 일괄(batch)로 대상 컬렉션에 Request로 생성
- 처리 중 진행 표시 (`8/12건 등록 중…`)
- 완료 후 토스트: `"12개 API가 [쇼핑몰 주문 API] 컬렉션에 등록되었습니다"` + `[컬렉션으로 이동]` 바로가기
- 후보 리스트 화면으로 돌아오면 방금 등록한 항목은 "등록됨" 상태로 전환되어 시각적으로 구분됨 (중복 등록 방지, 재분석 시에도 유지)

**엣지 케이스**
- 등록 도중 실패한 항목이 있으면(예: 컬렉션 권한 문제) 해당 항목만 실패로 표시하고 나머지는 정상 등록 진행 (부분 실패 허용, all-or-nothing 아님)
- 동일 후보를 서로 다른 두 컬렉션에 각각 등록하는 것은 허용 (컬렉션은 사용자의 자유로운 분류 기준이므로 제한하지 않음)

### 4-5. API 전이 (Chaining) 추적 모드 (신규 기능)
- 특정 API 항목(Request)의 상세 폼이나 우측 상단 옵션 메뉴에 `[API 전이(Chaining) 분석]` 버튼 제공.
- **기능 동작**:
  1. 버튼을 누르면 이전에 스캔해둔 프론트엔드 코드 AST 데이터를 재활용.
  2. 현재 API가 호출된 지점(파일, 라인)을 찾고, 그 직후(then, await 이후, useEffect 내 의존성 등)에 **연쇄적으로 호출되는 다른 API**를 역추적하여 트리 형태로 시각화.
  3. 예: `POST /api/login` 성공 후 → `GET /api/user/profile` → `GET /api/user/settings` 순으로 호출되는 흐름을 프론트 코드 흐름에서 파악해 시각적 연결고리로 보여줌.
- **활용도**: 복잡한 워크플로우(결제, 로그인, 장바구니 등)를 파악하고, 여러 API를 묶어서 시나리오 테스트로 전환할 때 큰 도움을 줌.

## 5. 모노레포 대응 전략

1. **서브 프로젝트 자동 판별**: 입력된 로컬 경로 하위를 스캔해 `package.json`이 위치한 디렉토리를 서브 프로젝트 후보로 간주 (workspace 설정인 `pnpm-workspace.yaml`, `turbo.json`, root `package.json`의 `workspaces` 필드도 참고해 그룹 경계 판단)
2. **프레임워크 자동 감지**: 서브 프로젝트별로 `next.config.js` 존재 여부, `app`/`pages` 디렉토리 존재 여부로 Next.js 여부 및 라우터 방식(app/pages) 판별
3. **분석은 서브 프로젝트 단위로 격리 실행**: 상수 테이블(`BASE_URL` 등)이 서브 프로젝트를 넘어 섞이지 않도록 스코프 분리
4. **성능**: 대형 모노레포 대비 분석은 비동기 잡 큐로 처리, 진행률 표시 (예: "apps/web 분석 중… 128/340 파일")

## 6. 데이터 모델 (제안)

```
LocalProjectConnection
  id, local_path, created_by, last_analyzed_at

AnalysisRun
  id, local_project_connection_id, status(pending/running/done/failed),
  started_at, finished_at

SubProject
  id, analysis_run_id, path(e.g. "apps/web"), framework(next-app/next-pages/react),
  file_count

ApiCandidate
  id, sub_project_id, file_path, line, library(fetch/axios/react-query/useSWR/heuristic/wrapper/next-route),
  method, url, confidence(high/medium/low), reason,
  status(pending/selected/registered/dismissed),
  matched_existing_request_id (nullable, 중복 감지용)

CollectionRegistration
  id, candidate_id, target_collection_id, target_folder_id(nullable),
  created_request_id, registered_by, registered_at
```

## 7. 중복 감지 로직 (기존 컬렉션과의 비교)

- 후보의 `(method, url)` 정규화 값(path parameter `{id}`/`:id`/`[id]` 형태 통일)과 기존 컬렉션 내 요청들의 `(method, url)`을 비교
- 완전 일치 → "이미 등록됨" (기본적으로 후보 리스트에서 흐리게 표시, 선택 불가 처리)
- 유사 일치(경로만 다르고 파라미터 위치만 다른 경우) → "유사 항목 있음" 뱃지, 사용자가 직접 판단하도록 표시만 하고 선택은 허용

## 8. MVP 범위

**포함**
- 로컬 프로젝트 경로 입력 → 스캔 → 모노레포 서브 프로젝트 자동 감지
- fetch / axios / TanStack Query / useSWR / Next.js route 컨벤션 / 이름 모를 wrapper 휴리스틱 분석
- confidence 기반 후보 리스트 + 근거 코드 스니펫 미리보기
- 사람이 선택 → 기존 컬렉션에 등록
- 완전 일치 기준 중복 감지

**1차 제외 (다음 로드맵)**
- 원격 Git 저장소 연동(현재는 로컬 경로 입력만 지원, 추후 필요 시 clone 방식 추가 검토)
- GraphQL 클라이언트(Apollo/urql), Next.js Server Actions 지원
- 재분석 시 diff 알림(코드 변경으로 새 API 생긴 경우 자동 감지·알림)
- 서로 다른 서브 프로젝트 간 wrapper import 추적(현재는 파일 내 1단계 추적까지)
- 유사 중복 항목 자동 병합 제안

## 9. 리스크 및 제약사항

| 리스크 | 설명 | 대응 |
|---|---|---|
| False Positive | 휴리스틱 레이어가 URL처럼 생긴 문자열을 잘못 잡을 수 있음 | confidence를 medium 이하로 명확히 구분, 사람 검토 필수화 |
| 완전 동적 URL | 런타임에만 값이 결정되는 경로는 정적분석 한계 | low confidence로 표시하되 리스트에서 배제하지 않음(존재 자체는 알려야 함) |
| 대형 모노레포 성능 | 파일 수가 많으면 분석 시간 증가 | 비동기 잡 처리 + 서브 프로젝트 단위 분할 실행 |
| 로컬 경로 접근 권한/오타 | 잘못된 경로 입력, `node_modules` 등 불필요한 디렉토리까지 스캔 시도 | 입력 즉시 경로 유효성 검사 + `node_modules`/`.git`/`dist`/`build` 등 기본 제외 목록 적용 |

---

**참고**: 위 흐름에서 [3] 분석 실행 단계에 들어가는 AST 분석 엔진은 이전에 만들어둔 `extract.js` 로직(fetch/axios/TanStack Query/useSWR 패턴 매칭 + URL-모양 기반 범용 휴리스틱 + wrapper 함수 추적 + Next.js 라우트 컨벤션 탐지)을 그대로 백엔드 분석 워커에 이식하면 됩니다.