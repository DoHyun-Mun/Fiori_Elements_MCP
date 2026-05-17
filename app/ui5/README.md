# UI5 Shell (`app/ui5/`)

> AI 점포 운영 시스템의 **UI5 통합 Shell**
> Shell + Dashboard + AI Chat + AI 결과 5앱 (UI5 표준 / `sap.tnt.ToolPage` / `sap.viz` VizFrame)
> Fiori Elements 19개 앱은 변경 없이 **iframe 임베딩**

---

## 📁 구조

```
app/ui5/
├── package.json          # UI5 dev 서버 의존성 + scripts (start/build)
├── ui5.yaml              # fiori-tools-proxy 설정 (/inventory, /chat → :4004)
├── .gitignore            # node_modules/, dist/
└── webapp/
    ├── index.html        # sap-ui-core 부트 + Component
    ├── Component.js      # UIComponent + JSONModel + Router init
    ├── manifest.json     # 라우팅 (dashboard / embedded / 5 AI views)
    ├── i18n/i18n.properties
    ├── css/style.css
    ├── img/logo.png
    ├── view/             # 9개 XML view
    │   ├── App.view.xml              # ToolPage Shell (Header + SideNav + NavContainer)
    │   ├── Dashboard.view.xml        # KPI 4 + AI Insights + VizFrame + Health + Order/Anomaly
    │   ├── Embedded.view.xml         # Fiori Elements iframe wrapper
    │   ├── Chat.fragment.xml         # AI Chat Dialog
    │   ├── DemandForecasts.view.xml
    │   ├── OrderRecommendations.view.xml
    │   ├── ChurnPredictions.view.xml
    │   ├── CustomerSegments.view.xml
    │   └── SalesAnomalies.view.xml
    ├── controller/       # 9개 controller (View와 1:1)
    └── model/
        └── chatProcessor.js          # AI Chat tool_calls 5종 파싱
```

---

## 🚀 로컬 개발

### 옵션 A — CAP 정적 서빙 (권장)
프로젝트 루트에서 `cds watch` 실행 → CAP이 `app/ui5/`를 자동 정적 서빙.

```bash
cds watch
# → http://localhost:4004/ui5/index.html
```

### 옵션 B — UI5 dev 서버 (hot reload)
```bash
cd app/ui5
npm install
npm start
# → http://localhost:8080
# (proxy: /inventory, /chat → localhost:4004 자동 포워딩)
```

> ⚠️ 옵션 B는 cross-origin (`8080` ↔ `4004`)이라 iframe 안 Fiori Elements는 4004 origin으로 직접 로드됩니다. postMessage는 정상 동작.

---

## 🚀 빌드 / 배포

**빌드/dist 동기화는 불필요합니다.** 프로젝트 전체가 같이 배포되며 CAP이 `app/ui5/`를 정적 서빙합니다.

- **운영(Kyma)**: approuter `xs-app.json` catch-all (`^(.*)$` → cap-backend) → `https://<host>/ui5/index.html`
- **배포 명령**: 프로젝트 루트의 `./scripts/deploy-kyma.sh --app` 한 번이면 끝
- **인증**: XSUAA (approuter)에서 자동 처리

(필요 시 `npm run build`로 dist를 만들 수는 있지만, 운영에는 webapp/ 원본이 그대로 사용됩니다.)

---

## 🏗️ 아키텍처 핵심

### 라우팅 (`manifest.json`)

| Route | Pattern | View |
|---|---|---|
| `dashboard` | `` (empty) | Dashboard |
| `embedded` | `embedded/{appPath}` | Embedded (iframe wrapper) |
| `demandForecasts` | `demand-forecasts` | DemandForecasts |
| `orderRecommendations` | `order-recommendations` | OrderRecommendations |
| `churnPredictions` | `churn-predictions` | ChurnPredictions |
| `customerSegments` | `customer-segments` | CustomerSegments |
| `salesAnomalies` | `sales-anomalies` | SalesAnomalies |

### 백엔드 API (변경 없음)

- `GET /inventory/MenuItems` — 3계층 메뉴 트리 (level 1/2/3, parent_ID 매핑, leaf은 `url` 보유)
- `GET /inventory/getDashboardKPIs()` / `getAIInsights()` / `getSalesForecastTrend()` / `getStoreHealthScores()`
- `POST /chat/sendMessage` — `{ message, history }` → `{ reply, toolData }`

### AI Chat → AI 5앱 데이터 흐름

```
[Chat 입력] → POST /chat/sendMessage → { reply, toolData: [{toolName, data}] }
   ↓
chatProcessor.processToolData(toolData)
   ├─ search_reorder_products  → localStorage("orderRecommendationData")  + msgType="recommendationUpdate"
   ├─ run_demand_forecast      → localStorage("forecastData")             + msgType="forecastUpdate"
   ├─ run_churn_prediction     → localStorage("churnPredictionData")      + msgType="churnUpdate"
   ├─ run_anomaly_detection    → localStorage("salesAnomalyData")         + msgType="anomalyUpdate"
   └─ run_customer_segmentation→ localStorage("customerSegmentData")      + msgType="segmentUpdate"
   ↓
[상세 보기 버튼 클릭] → App.controller.navigateAndPostMessage(url, msgType)
   ├─ msgType이 _UI5_ROUTE_MAP에 있으면 → router.navTo(routeName) + window.postMessage({type: msgType})
   └─ 없으면 → embedded 라우트로 iframe 표시
   ↓
[해당 View의 message listener] → localStorage 읽고 KPI/차트/Table 갱신
```

### Shell ↔ iframe (Fiori Elements 19앱)

- 사이드바 leaf 클릭 → `embedded/{path}` 라우트 → iframe `src` 변경
- iframe → Shell: `parent.postMessage({type:'navigateTo', url:'...'}, '*')`
- 운영 보안: `App.controller._onWindowMessage`에서 운영 hostname일 때만 `event.origin === window.location.origin` 검증 (로컬 dev는 cross-origin이라 SKIP)

---

## ⚠️ UI5 1.120 알려진 함정

| 함정 | 회피 방법 |
|---|---|
| **표현식 바인딩 `${...} != null`** SyntaxError | `=== null \|\| === undefined` 또는 truthy/falsy로 우회 |
| **VizFrame 네임스페이스** 점 prefix 동작 안 함 | `xmlns:viz="sap.viz.ui5.controls"` / `xmlns:vData="sap.viz.ui5.data"` / `xmlns:vFeed="sap.viz.ui5.controls.common.feeds"` |
| **VizFrame Donut named 모델 미렌더** | default 모델 사용 (`view.setModel(donutModel)` name 생략) |
| **`l:Grid items=` 동적 바인딩 미지원** | `List + CustomListItem` 패턴으로 우회 |
| **MessageStrip 멀티라인 `\n` 무시** | CSS `white-space: pre-line` 강제 |
| **manifest routing controlId** | `App.view.xml`의 `NavContainer id="pageContainer"`와 일치해야 함 |

---

## 🐛 알려진 잔여 이슈 (보완 라운드 후보)

- **디자인 디테일** — 5개 AI view의 헤더/카드/표 미세 레이아웃, VizFrame "차트 제목" 텍스트 잔존
- **Chat UX** — Enter 키 전송 미동작 (`liveChange`만 있음), 환영 메시지 가시성 타이밍, Dialog 우측 정렬
- **누락 기능** (Phase 6에서 미루기로 합의):
  - DemandForecasts Action 가이드 카드 (주간 발주량/피크일/추세)
  - CustomerSegments 캠페인 시뮬레이션 버튼
  - ChurnPredictions 글로벌 ROI 카드
- **CSRF 토큰** — 운영(approuter)에서 토큰 헤더 패턴이 dev와 다를 수 있음. PurchaseOrders POST 첫 시도 시 검증 필요.

---

## 📦 Markdown 렌더링 (`marked.js` self-host)

채팅 응답의 마크다운(헤딩 `#`, 표 `| ... |`, 리스트 `- `, 볼드 `**...**` 등)은 **`marked` 라이브러리로 렌더링**합니다.

**구성**:
- `webapp/lib/marked.min.js` (self-hosted, ~40KB, marked v15)
- `webapp/index.html`의 `<head>`에서 `sap-ui-bootstrap` **위쪽**에 동기 `<script>`로 로드
- `App.controller.js`의 `_renderMarkdown(text)`이 `window.marked.parse(text)` 호출

**왜 self-host인가?**
이전엔 CDN(`cdn.jsdelivr.net`)에서 async 동적 로드했는데, marked v15의 UMD 헤더가 AMD 분기로 빠지는 race condition으로 인해 `window.marked`가 등록 안 되는 케이스가 발생함. self-host + sap-ui-bootstrap **전에 동기 로드**하면:
- AMD `define`이 아직 정의되지 않은 시점이라 `window.marked = f()` 분기로 무조건 등록됨
- async 타이밍 의존성 제거 → 첫 chat 메시지부터 안정적
- 외부 CDN 의존 제거 (사내망/오프라인에서도 동작)
