# 🏪 AI 점포 운영 시스템 - Project Map

> **SAP BTP + CAP + HANA Cloud + AI Core + MCP Tools**
> 점포 상품별 재고 발주 관리 + AI 예측 분석 통합 플랫폼

---

## 📁 프로젝트 구조

```
store-pjt/
├── app/                          # 프론트엔드 (Fiori Elements + Custom HTML)
│   ├── index.html                # 메인 SPA (AI 대시보드 + 사이드 메뉴 + 채팅)
│   ├── services.cds              # 앱별 annotation 참조 등록
│   ├── css/
│   │   ├── main.css              # 대시보드/레이아웃 스타일
│   │   └── chat.css              # AI 채팅 패널 스타일
│   ├── js/
│   │   ├── app.js                # SPA 라우팅, 메뉴 로딩, iframe 관리
│   │   ├── chat.js               # AI 채팅 (toolData JSON 기반 처리)
│   │   ├── dashboard.js          # 대시보드 KPI/차트/인사이트 로딩
│   │   └── supply-chain.js       # 공급망 네트워크 그래프 (vis.js)
│   │
│   ├── # ═══ Fiori Elements 앱 (OData + CDS Annotation) ═══
│   ├── categories/               # 분류 관리
│   ├── products/                 # 상품 관리
│   ├── inventories/              # 재고 관리
│   ├── stores/                   # 점포 관리
│   ├── suppliers/                # 공급업체 관리
│   ├── materials/                # 자재 관리
│   ├── storeproducts/            # 점포별 상품 관리
│   ├── purchaseorders/           # 발주 관리 (워크플로우: Draft→Submitted→Approved→Received)
│   ├── customers/                # 고객 관리
│   ├── customerpurchases/        # 고객 구매 이력
│   ├── dailysales/               # 일별 매출 (Fiori Elements + SelectionFields 필터)
│   ├── menus/                    # 메뉴 관리 (3계층 트리)
│   │
│   ├── # ═══ 유통 프로세스 앱 ═══
│   ├── distributioncenters/      # 물류센터 관리
│   ├── inboundorders/            # 입고오더 (공급업체→DC)
│   ├── goodsreceipts/            # 입고검수
│   ├── invoices/                 # 인보이스/세금계산서
│   ├── transferorders/           # 배송지시 (DC→점포)
│   ├── storereceipts/            # 점포입고
│   │
│   ├── # ═══ AI 분석 상세 페이지 (Custom HTML, localStorage 연동) ═══
│   ├── demandforecasts/webapp/index.html    # 수요 예측 (차트+Action가이드+발주생성)
│   ├── orderrecommendations/webapp/index.html # 발주 추천 (AI판단+사유분석+일괄발주)
│   ├── churnpredictions/webapp/index.html   # 이탈 예측 (위험등급+리텐션전략+고객상세)
│   ├── salesanomalies/webapp/index.html     # 이상 탐지 (대응가이드+항목테이블+권고)
│   └── customersegments/webapp/index.html   # 고객 세분화 (RFM카드+마케팅전략+액션플랜)
│
├── srv/                          # 백엔드 서비스 (CAP Node.js)
│   ├── service.cds               # InventoryService 엔티티/액션/함수 정의
│   ├── service.js                # 비즈니스 로직 (발주 워크플로우, KPI, 인사이트)
│   ├── annotations.cds           # UI Annotation (Fiori Elements용)
│   ├── logistics-annotations.cds # 유통 프로세스 Annotation
│   ├── chat-service.cds          # ChatService 정의
│   ├── chat-service.js           # 채팅 → AI Core 연동
│   └── lib/
│       └── aicore-client.js      # SAP AI Core Orchestration + MCP Tool Calling
│
├── db/                           # 데이터 모델 + 샘플 데이터
│   ├── schema.cds                # 전체 엔티티 스키마 (25+ 엔티티)
│   ├── data/                     # CSV 초기 데이터 (점포/상품/재고/매출/고객 등)
│   └── src/roles/                # HANA DB 역할 정의
│
├── scripts/                      # 데이터 생성/관리 스크립트
│   ├── generate-daily-sales.js   # DailySales 데이터 생성
│   ├── generate-ai-dashboard-data.js # AI 대시보드 데이터 생성
│   ├── generate-logistics-data.js # 유통 프로세스 데이터 생성
│   ├── generate-bulk-data.js     # 대량 데이터 일괄 생성
│   ├── generate-data.js          # 기본 마스터 데이터 생성
│   └── update-inventory-stock.js # 재고 업데이트
│
├── approuter/                    # SAP AppRouter (인증/라우팅)
├── k8s/                          # Kyma/K8s 배포 매니페스트
├── chart/                        # Helm Chart
├── server.js                     # CAP 서버 엔트리 (정적 파일 서빙 포함)
├── package.json                  # 프로젝트 의존성
└── xs-security.json              # XSUAA 보안 설정
```

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (SPA)                                               │
│  ┌─────────┐ ┌──────────────┐ ┌───────────────────────────┐ │
│  │Dashboard│ │Fiori Elements│ │AI Chat (Side Panel)        │ │
│  │(KPI/차트)│ │(OData CRUD) │ │→ toolData JSON 처리       │ │
│  └────┬────┘ └──────┬───────┘ └────────────┬──────────────┘ │
│       │              │                       │                │
│  ┌────┴──────────────┴───────────────────────┴──────────────┐│
│  │          AI 분석 상세 페이지 (localStorage 연동)          ││
│  │  수요예측 | 발주추천 | 이탈예측 | 이상탐지 | 고객세분화   ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP
┌──────────────────────────────┴──────────────────────────────┐
│  CAP Server (Node.js)                                        │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │InventoryService│ │ChatService  │  │ AI Core Client     │  │
│  │(OData V4)     │ │(sendMessage)│  │ (Orchestration +   │  │
│  │getDashboardKPIs│ │             │  │  MCP Tool Calling) │  │
│  │getAIInsights  │ └──────┬──────┘  └─────────┬──────────┘  │
│  │getSalesForecast│        │                    │             │
│  └───────┬───────┘         │                    │             │
│          │                 │                    │             │
│  ┌───────┴───────┐         │              ┌────┴────┐        │
│  │  SQLite/HANA  │         │              │SAP AI   │        │
│  │  (25+ Tables) │         │              │Core     │        │
│  └───────────────┘         │              └────┬────┘        │
└────────────────────────────┼───────────────────┼─────────────┘
                             │                   │
                    ┌────────┴────────┐  ┌──────┴──────┐
                    │  GPT-4o (LLM)   │  │ MCP Server  │
                    │  Orchestration   │  │ (Python ML) │
                    └─────────────────┘  └─────────────┘
```

---

## 🤖 AI 분석 기능 (MCP Tools)

| Tool | 기능 | 상세 페이지 | 주요 데이터 |
|------|------|------------|------------|
| `search_reorder_products` | 발주 추천 | orderrecommendations | ML_예측_발주추천, 발주_사유_분석, AI_종합_판단 |
| `run_demand_forecast` | 수요 예측 | demandforecasts | forecasts, 예측_사유_분석, RPT1_AI_예측 |
| `run_churn_prediction` | 이탈 예측 | churnpredictions | high_risk_customers, metrics, top_features |
| `run_anomaly_detection` | 이상 탐지 | salesanomalies | top_anomalies, 이상_탐지_분석 |
| `run_customer_segmentation` | 고객 세분화 | customersegments | segments (RFM + KMeans) |
| `query_sales` | 매출 조회 | - | DailySales 필터 |
| `query_customers` | 고객 조회 | - | Customers + Purchases |
| `search_products` | 상품 검색 | - | Vector 유사도 검색 |
| `graph_co_purchase` | 연관 상품 | - | HANA Graph PageRank |
| `graph_supply_chain` | 공급망 분석 | - | 공급업체 의존도 |
| `vector_search` | 시맨틱 검색 | - | HANA Vector Engine |

---

## 📊 대시보드 (app/index.html + dashboard.js)

| 섹션 | 내용 | 데이터 소스 |
|------|------|-----------|
| KPI 카드 | 최근 매출 / 재고 건전성 / 결품 위험 / 발주 대기 | getDashboardKPIs() |
| AI 인사이트 | 긴급/주의/기회 카드 (동적) | getAIInsights() |
| 매출 트렌드 + AI 예측 | 7일 실적 + 7일 예측 차트 + 예측 근거 | getSalesForecastTrend() |
| 점포 건전성 | 점포별 점수 그리드 | getStoreHealthScores() |
| 발주 추천 Top 5 | 긴급도별 정렬 | OrderRecommendations |
| 이상 탐지 | 최근 이상 건 | SalesAnomalies |
| 공급망 네트워크 | vis.js 그래프 (위험 경로 강조) | Inventories + Stores |

---

## 💬 AI 채팅 흐름 (chat.js)

```
사용자 입력 → /chat/sendMessage → AI Core Orchestration
                                    → MCP Tool Calling (필요시)
                                    → LLM 응답 생성
                                    
응답 수신 ← { reply, toolData: [{toolName, data}] }
         ↓
processToolData(toolData, msgDiv)
  ├── toolName === "search_reorder_products" → localStorage("orderRecommendationData") + 버튼
  ├── toolName === "run_demand_forecast"     → localStorage("forecastData") + 버튼
  ├── toolName === "run_churn_prediction"    → localStorage("churnPredictionData") + 버튼
  ├── toolName === "run_anomaly_detection"   → localStorage("salesAnomalyData") + 버튼
  └── toolName === "run_customer_segmentation" → localStorage("customerSegmentData") + 버튼
```

---

## 🎨 AI 상세 페이지 디자인 패턴 (통일)

모든 AI 분석 상세 페이지는 동일한 UX 패턴:

1. **KPI 카드** - 핵심 수치 한눈에
2. **Action 가이드/전략** - "그래서 뭘 해야 하는지"
3. **데이터 테이블/카드** - 상세 항목 (접기/펼치기)
4. **사유/근거** - "왜 이렇게 판단했는지"

| 페이지 | Action 가이드 예시 |
|--------|-------------------|
| 수요 예측 | 주간 발주 기준량, 피크일 대비, 추세 판단 → 발주 생성 |
| 발주 추천 | AI 종합 판단, 긴급도 가이드, 상품별 사유 → 일괄 발주 |
| 이탈 예측 | 위험등급별 리텐션 전략, 즉시 실행 액션 플랜 |
| 이상 탐지 | 유형별 대응 가이드 (급등/급감/패턴이탈) |
| 고객 세분화 | 세그먼트별 마케팅 전략, 액션 플랜 테이블 |

---

## 🗄️ 주요 엔티티 (db/schema.cds)

| 영역 | 엔티티 |
|------|--------|
| 마스터 | Categories, Products, Stores, Suppliers, Materials |
| 관계 | StoreProducts, ProductMaterials |
| 재고/발주 | Inventories, PurchaseOrders |
| 고객 | Customers, CustomerPurchases, CustomerPurchaseItems |
| 매출 | DailySales |
| AI 예측 | DemandForecasts, OrderRecommendations |
| AI 분석 | ChurnPredictions, CustomerSegments, SalesAnomalies |
| 유통 | DistributionCenters, InboundOrders, GoodsReceipts, Invoices, TransferOrders, StoreReceipts |
| 메뉴 | MenuItems (3계층 트리) |

---

## 🔑 핵심 비즈니스 로직 (srv/service.js)

| 기능 | 설명 |
|------|------|
| PO 자동 채번 | `PO-YYYYMMDD-XXXX` 형식 자동 생성 |
| PO 워크플로우 | Draft → Submitted → Approved/Rejected → Received |
| 입고 처리 | receiveOrder 시 재고 자동 반영 |
| 판매가 자동 계산 | costPrice × (1 + marginRate/100) |
| KPI 동적 계산 | 최근 매출 fallback, 건전성 점수, 결품 위험 |
| AI 인사이트 | 실시간 데이터 기반 긴급/주의/기회 카드 생성 |

---

## 🚀 배포 환경

| 환경 | 구성 |
|------|------|
| 로컬 개발 | SQLite + cds watch |
| Kyma (K8s) | HANA Cloud + AI Core + AppRouter + XSUAA |
| MCP Server | Python ML (Kyma 배포) - Prophet, XGBoost, KMeans, IsolationForest |

---

## 📅 최종 업데이트: 2026-05-08
