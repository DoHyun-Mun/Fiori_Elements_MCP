# 📍 store-pjt 프로젝트 기능 지도

> AI 점포 운영 관리 시스템 (SAP CAP + Fiori + HANA Cloud + AI Core + Knowledge Graph)

---

## 🎯 1. AI 대시보드 (메인 페이지)

| 기능 | 파일 위치 |
|------|----------|
| 메인 HTML (6-STRIP 구조) | `app/index.html` |
| AI 대시보드 JS (KPI, 인사이트, 차트, 건전성) | `app/js/dashboard.js` |
| 공급망 네트워크 그래프 (vis.js, 위험경로 강조) | `app/js/supply-chain.js` |
| 앱 라우팅 / 메뉴 (3계층 동적 로드) | `app/js/app.js` |
| AI Chat 사이드 패널 | `app/js/chat.js` |
| CSS 스타일 (메인) | `app/css/main.css` |
| CSS 스타일 (채팅) | `app/css/chat.css` |

### 대시보드 구조 (6 STRIP)
1. **동적 KPI** (매출↑%, 재고건전성, 결품위험, 발주대기) — 클릭 시 상세 메뉴 이동
2. **AI 인사이트 카드** (결품임박, 매출이상, 발주추천) — 실시간 AI 분석
3. **매출 트렌드 + AI 예측** | **점포별 재고 건전성** — Chart.js + 히트맵
4. **발주 추천 Top 5** | **이상 탐지 Top 5** — 즉시 액션 가능
5. **공급망 네트워크** (위험 경로 기본 표시) — vis-network

---

## 🗄️ 2. 데이터베이스 스키마 (HANA Cloud)

| 기능 | 파일 위치 |
|------|----------|
| 전체 엔티티 정의 | `db/schema.cds` |
| 초기 데이터 CSV (마스터/트랜잭션) | `db/data/*.csv` |
| HDI Role (Graph 접근 권한) | `db/src/roles/graph_access.hdbrole` |

### 주요 엔티티
- **마스터**: Categories, Products, Suppliers, Materials, Stores, Customers
- **재고/발주**: Inventories, PurchaseOrders, StoreProducts, ProductMaterials
- **유통 프로세스**: DistributionCenters, InboundOrders, GoodsReceipts, Invoices, TransferOrders, StoreReceipts
- **매출/고객**: DailySales, CustomerPurchases, CustomerPurchaseItems
- **AI/ML 결과**: DemandForecasts, OrderRecommendations, ChurnPredictions, CustomerSegments, SalesAnomalies
- **설정**: MenuItems

---

## ⚙️ 3. 백엔드 서비스 (CAP Node.js)

| 기능 | 파일 위치 |
|------|----------|
| OData 서비스 정의 (InventoryService) | `srv/service.cds` |
| 비즈니스 로직 + AI 대시보드 Function Imports | `srv/service.js` |
| OData 어노테이션 (마스터 데이터) | `srv/annotations.cds` |
| OData 어노테이션 (물류 프로세스) | `srv/logistics-annotations.cds` |
| AI Chat 서비스 정의 | `srv/chat-service.cds` |
| AI Chat 핸들러 (sendMessage, healthCheck) | `srv/chat-service.js` |
| AI Core 클라이언트 (Orchestration + MCP Tool Calling) | `srv/lib/aicore-client.js` |

### AI 대시보드 Function Imports (`srv/service.cds` + `srv/service.js`)
| Function | 설명 |
|----------|------|
| `getDashboardKPIs()` | 오늘 매출(전일대비%), 재고건전성점수, 결품위험건수, 발주대기건수 |
| `getAIInsights()` | AI 인사이트 카드 (결품임박/매출이상/발주추천, 최대 5개) |
| `getStoreHealthScores()` | 점포별 건전성 점수 (가용재고/최소재고 비율 기반) |
| `getSalesForecastTrend()` | 매출 실적(7일) + AI 예측(7일) 결합 데이터 |

### 비즈니스 로직 상세 (`srv/service.js`)
- 발주 상태 관리: Draft → Submitted → Approved → Received
- 재고 자동 반영 (입고 시 수량 증가)
- 자동 채번 (PO-YYYYMMDD-XXXX, CP-YYYYMMDD-XXXX)
- 판매가 자동 계산 (원가 × 마진율)
- 고객 통계 자동 업데이트 (구매 시)

### AI Chat (`srv/lib/aicore-client.js`)
- SAP AI Core Orchestration SDK (@sap-ai-sdk/orchestration)
- MCP Tool Server 연동 (function-calling)
- Tool Call Loop (최대 5회)
- 모델: gpt-4o

---

## 🖥️ 4. Fiori Elements UI 앱

| 앱 | 폴더 | 기능 |
|----|------|------|
| 분류 관리 | `app/categories/` | 카테고리 CRUD |
| 상품 관리 | `app/products/` | 상품 CRUD |
| 자재 관리 | `app/materials/` | 자재 마스터 |
| 점포 관리 | `app/stores/` | 점포 CRUD |
| 점포별 상품 | `app/storeproducts/` | 점포-상품 매핑 |
| 공급업체 | `app/suppliers/` | 공급업체 관리 |
| 물류센터 | `app/distributioncenters/` | DC 관리 |
| 재고 관리 | `app/inventories/` | 재고 조회/수정 |
| 발주 관리 | `app/purchaseorders/` | 발주 상태 워크플로우 |
| 입고오더 | `app/inboundorders/` | 공급업체→DC 입고 |
| 입고검수 | `app/goodsreceipts/` | 수량/품질 확인 |
| 인보이스 | `app/invoices/` | 세금계산서 관리 |
| 배송지시 | `app/transferorders/` | DC→점포 배송 |
| 점포입고 | `app/storereceipts/` | 점포 수령 확인 |
| 고객 관리 | `app/customers/` | 고객 마스터 |
| 고객 구매이력 | `app/customerpurchases/` | 구매 내역 |
| 일별 매출 | `app/dailysales/` | 시계열 매출 |
| 수요 예측 | `app/demandforecasts/` | ML 예측 결과 |
| 발주 추천 | `app/orderrecommendations/` | AI 기반 추천 |
| 이탈 예측 | `app/churnpredictions/` | 고객 이탈 예측 |
| 고객 세분화 | `app/customersegments/` | RFM 분석 |
| 매출 이상탐지 | `app/salesanomalies/` | 이상 감지 |
| 메뉴 관리 | `app/menus/` | 메뉴 트리 설정 |

---

## 🌐 5. Approuter (인증/라우팅)

| 기능 | 파일 위치 |
|------|----------|
| 라우팅 설정 (XSUAA 인증) | `approuter/xs-app.json` |
| Approuter 패키지 | `approuter/package.json` |
| Approuter Docker 이미지 | `approuter/Dockerfile` |

---

## 🚀 6. Kyma 배포 (Kubernetes)

| 기능 | 파일 위치 |
|------|----------|
| 네임스페이스 (`store-pjt`) | `k8s/namespace.yaml` |
| CAP Backend Deployment | `k8s/deployment.yaml` |
| CAP Backend Service | `k8s/service.yaml` |
| Approuter Deployment | `k8s/approuter-deployment.yaml` |
| Approuter Service | `k8s/approuter-service.yaml` |
| API Gateway (외부 URL) | `k8s/apirule.yaml` |
| HDI Deployer Job | `k8s/hdi-deployer-job.yaml` |
| HANA HDI ServiceInstance/Binding | `k8s/hana-serviceinstance.yaml`, `k8s/hana-servicebinding.yaml` |
| XSUAA ServiceInstance/Binding | `k8s/xsuaa-serviceinstance.yaml`, `k8s/xsuaa-servicebinding.yaml` |
| AI Core Secret | `k8s/aicore-secret.yaml` |
| 배포 자동화 스크립트 | `scripts/deploy-kyma.sh` |

### 외부 접근 URL
- `https://store-pjt.c56380c.kyma.ondemand.com/`

---

## 🛠️ 7. 빌드 & 스크립트

| 기능 | 파일 위치 |
|------|----------|
| CAP Backend Dockerfile | `Dockerfile` |
| HDI Deployer Dockerfile | `Dockerfile.hdi-deployer` |
| 마스터 데이터 생성 (100건씩) | `scripts/generate-data.js` |
| 대량 고객/구매 데이터 생성 | `scripts/generate-bulk-data.js` |
| 시계열 데이터 생성 (DailySales 60일) | `scripts/generate-daily-sales.js` |
| **AI 대시보드 더미 데이터** (Forecasts, Recommendations, Anomalies) | `scripts/generate-ai-dashboard-data.js` |
| 물류 프로세스 데이터 생성 | `scripts/generate-logistics-data.js` |
| 재고 업데이트 스크립트 | `scripts/update-inventory-stock.js` |
| Kyma 배포 자동화 | `scripts/deploy-kyma.sh` |

### 빌드 & 배포 명령어
```bash
# 로컬 개발
cds serve

# AI 대시보드 데이터 재생성 (날짜 기준 갱신)
node scripts/generate-ai-dashboard-data.js

# Docker 빌드 & 배포
docker build --no-cache -t ghcr.io/dohyun-mun/store-pjt:latest --platform linux/amd64 .
docker push ghcr.io/dohyun-mun/store-pjt:latest

# Kyma 전체 배포
./scripts/deploy-kyma.sh

# Pod 재시작 (빠른 배포)
export KUBECONFIG=./kubeconfig-dev.yaml
kubectl rollout restart deployment store-pjt -n store-pjt
```

---

## 🔑 8. 설정 파일

| 기능 | 파일 위치 |
|------|----------|
| CDS 빌드 설정 | `.cdsrc.json` |
| 환경변수 (AI Core, MCP Server URL) | `.env` |
| XSUAA 보안 설정 | `xs-security.json` |
| 프로젝트 의존성 | `package.json` |
| 서버 엔트리포인트 | `server.js` |

---

## 🔗 9. 아키텍처 흐름

```
브라우저 (AI 대시보드 + Fiori Elements)
    ↓ HTTPS
Kyma APIRule (store-pjt.c56380c.kyma.ondemand.com)
    ↓
Approuter (XSUAA 인증 + 라우팅)
    ↓ HTTP (내부)
CAP Backend (Node.js :4004)
    ├── OData (InventoryService) → HANA Cloud (HDI Container)
    │     ├── CRUD (22 엔티티)
    │     └── AI Function Imports (getDashboardKPIs, getAIInsights, ...)
    └── Chat (ChatService) → AI Core Orchestration → MCP Tool Server
```

### 데이터 흐름 (AI 대시보드)
```
DailySales (HANA) ─────→ getDashboardKPIs() ─→ KPI 카드
DemandForecasts (HANA) ─→ getSalesForecastTrend() ─→ 매출+예측 차트
OrderRecommendations ───→ getAIInsights() ─→ AI 인사이트 카드
SalesAnomalies ─────────→ getAIInsights() ─→ AI 인사이트 카드
Inventories ────────────→ getStoreHealthScores() ─→ 점포 건전성 히트맵
```

---

## 📊 10. 메뉴 체계 (5개 대분류)

| 대분류 | 중분류 | 소메뉴 |
|--------|--------|--------|
| 🏷️ 마스터 데이터 | 상품, 점포, 거래처 | 분류/상품/자재/점포/점포상품/공급업체/물류센터 |
| 📋 구매 (P2P) | 발주, 입고, 정산 | 발주관리/입고오더/입고검수/인보이스 |
| 🚛 물류·재고 | 배송, 재고 | 배송지시/점포입고/재고관리 |
| 👤 판매 & 고객 | 매출, 고객 | 일별매출/고객관리/구매이력