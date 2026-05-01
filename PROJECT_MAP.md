# 📍 store-pjt 프로젝트 기능 지도

> 점포 상품별 재고 발주 관리 시스템 (SAP CAP + Fiori + HANA Cloud + AI Core)

---

## 🎯 1. Overview / 대시보드 (메인 페이지)

| 기능 | 파일 위치 |
|------|----------|
| 메인 HTML (KPI, 차트, 네트워크 그래프, 바로가기) | `app/index.html` |
| 대시보드 데이터 로드 (KPI, Chart.js 차트) | `app/index.html` 내 `<script>` → `loadDashboardData()` |
| 공급망 네트워크 그래프 (vis.js) | `app/index.html` 내 `loadSupplyChainGraph()` |
| AI Chat 사이드 패널 (UI + 드래그 리사이즈) | `app/index.html` 하단 Chat 섹션 |
| 메뉴 트리 (3계층 동적 로드) | `app/index.html` 내 `loadMenuData()` |

---

## 🗄️ 2. 데이터베이스 스키마 (HANA Cloud)

| 기능 | 파일 위치 |
|------|----------|
| 전체 엔티티 정의 (22개 테이블) | `db/schema.cds` |
| 초기 데이터 CSV (마스터/트랜잭션) | `db/data/*.csv` |
| HDI Role (Graph 접근 권한) | `db/src/roles/graph_access.hdbrole` |

### 주요 엔티티
- **마스터**: Categories, Products, Suppliers, Materials, Stores, Customers
- **트랜잭션**: PurchaseOrders, SupplyOrders, CustomerPurchases
- **ML 입력**: DailySales, InventorySnapshots
- **ML 출력**: DemandForecasts, ChurnPredictions, CustomerSegments, SalesAnomalies, OrderRecommendations
- **설정**: MenuItems, StoreProducts, ProductMaterials, Inventories

---

## ⚙️ 3. 백엔드 서비스 (CAP Node.js)

| 기능 | 파일 위치 |
|------|----------|
| OData 서비스 정의 (InventoryService) | `srv/service.cds` |
| 비즈니스 로직 (발주 워크플로우, 재고, 자동채번) | `srv/service.js` |
| OData 어노테이션 (공통) | `srv/annotations.cds` |
| AI Chat 서비스 정의 | `srv/chat-service.cds` |
| AI Chat 핸들러 (sendMessage, healthCheck) | `srv/chat-service.js` |
| AI Core 클라이언트 (Orchestration + MCP Tool Calling) | `srv/lib/aicore-client.js` |

### 비즈니스 로직 상세 (`srv/service.js`)
- 발주 상태 관리: Draft → Submitted → Approved → Received
- 공급 주문: Draft → Confirmed → Shipped → Delivered
- 재고 자동 반영 (입고 시 수량 증가)
- 자동 채번 (PO-YYYYMMDD-XXXX)
- 판매가 자동 계산 (원가 × 마진율)

### AI Chat 상세 (`srv/lib/aicore-client.js`)
- SAP AI Core Orchestration SDK 사용
- MCP Tool Server 연동 (function-calling)
- Tool Call Loop (최대 5회)
- 모델: gpt-4o

---

## 🖥️ 4. Fiori Elements UI 앱 (16개)

| 앱 | 폴더 | 기능 |
|----|------|------|
| 상품 관리 | `app/products/` | 상품 CRUD |
| 점포 관리 | `app/stores/` | 점포 CRUD |
| 재고 관리 | `app/inventories/` | 재고 조회/수정 |
| 발주 관리 | `app/purchaseorders/` | 발주 상태 워크플로우 |
| 공급 주문 | `app/supplyorders/` | 입출고 관리 |
| 고객 관리 | `app/customers/` | 고객 마스터 |
| 고객 구매이력 | `app/customerpurchases/` | 구매 내역 조회 |
| 일별 매출 | `app/dailysales/` | 시계열 매출 데이터 |
| 재고 스냅샷 | `app/inventorysnapshots/` | 재고 이력 조회 |
| 수요 예측 | `app/demandforecasts/` | ML 예측 결과 |
| 발주 추천 | `app/orderrecommendations/` | ML 기반 추천 |
| 이탈 예측 | `app/churnpredictions/` | 고객 이탈 예측 |
| 고객 세분화 | `app/customersegments/` | RFM 분석 결과 |
| 매출 이상탐지 | `app/salesanomalies/` | 이상 감지 결과 |
| 자재 관리 | `app/materials/` | 자재 마스터 |
| 공급업체 | `app/suppliers/` | 공급업체 관리 |
| 점포별 상품 | `app/storeproducts/` | 점포-상품 매핑 |
| 메뉴 관리 | `app/menus/` | 메뉴 트리 설정 |
| 카테고리 | `app/categories/` | 분류 마스터 |

**각 앱 구조:**
```
app/{앱이름}/
├── annotations.cds     ← UI 어노테이션 (테이블 컬럼, 필터 등)
├── package.json
├── ui5.yaml
└── webapp/
    ├── manifest.json   ← OData 서비스 연결, 라우팅
    └── Component.js
```

---

## 🌐 5. Approuter (인증/라우팅)

| 기능 | 파일 위치 |
|------|----------|
| 라우팅 설정 (XSUAA 인증, CSRF 보호) | `approuter/xs-app.json` |
| Approuter 패키지 | `approuter/package.json` |
| Approuter Docker 이미지 | `approuter/Dockerfile` |

### 라우팅 규칙 (`approuter/xs-app.json`)
- `/chat/*` → CAP Backend (CSRF 비활성)
- `/odata/v4/*` → CAP Backend (XSUAA 인증)
- `/*` → CAP Backend (XSUAA 인증)

---

## 🚀 6. Kyma 배포 (Kubernetes)

| 기능 | 파일 위치 |
|------|----------|
| 네임스페이스 (`store-pjt`) | `k8s/namespace.yaml` |
| CAP Backend Deployment | `k8s/deployment.yaml` |
| CAP Backend Service | `k8s/service.yaml` |
| Approuter Deployment (XSUAA 바인딩) | `k8s/approuter-deployment.yaml` |
| Approuter Service | `k8s/approuter-service.yaml` |
| API Gateway (외부 URL) | `k8s/apirule.yaml` |
| HDI Deployer Job (스키마+CSV 배포) | `k8s/hdi-deployer-job.yaml` |
| HANA HDI ServiceInstance | `k8s/hana-serviceinstance.yaml` |
| HANA HDI ServiceBinding | `k8s/hana-servicebinding.yaml` |
| XSUAA ServiceInstance | `k8s/xsuaa-serviceinstance.yaml` |
| XSUAA ServiceBinding | `k8s/xsuaa-servicebinding.yaml` |
| AI Core Secret | `k8s/aicore-secret.yaml` |
| Docker Registry Secret | `k8s/graph-grantor-secret.yaml` |
| UAA Secret (Approuter용) | `k8s/uaa-default-services-secret.yaml` |
| Approuter ConfigMap | `k8s/approuter-xs-app-configmap.yaml` |
| 배포 자동화 스크립트 | `scripts/deploy-kyma.sh` |
| 배포 가이드 | `k8s/README.md` |

### 외부 접근 URL
- `https://store-pjt.c56380c.kyma.ondemand.com/`

---

## 🛠️ 7. 빌드 & 스크립트

| 기능 | 파일 위치 |
|------|----------|
| CAP Backend Dockerfile (multi-stage) | `Dockerfile` |
| HDI Deployer Dockerfile | `Dockerfile.hdi-deployer` |
| 마스터 데이터 생성 (100건씩) | `scripts/generate-data.js` |
| 대량 고객/구매 데이터 생성 (500+건) | `scripts/generate-bulk-data.js` |
| 시계열 데이터 생성 (DailySales 60일) | `scripts/generate-daily-sales.js` |
| Kyma 배포 자동화 | `scripts/deploy-kyma.sh` |

### 빌드 & 배포 명령어
```bash
# CAP Backend
docker build --no-cache -t ghcr.io/dohyun-mun/store-pjt:latest --platform linux/amd64 .
docker push ghcr.io/dohyun-mun/store-pjt:latest

# Approuter
docker build --no-cache -t ghcr.io/dohyun-mun/store-pjt-approuter:latest --platform linux/amd64 approuter/
docker push ghcr.io/dohyun-mun/store-pjt-approuter:latest

# HDI Deployer
docker build -f Dockerfile.hdi-deployer -t ghcr.io/dohyun-mun/store-pjt-hdi-deployer:latest --platform linux/amd64 .

# Kyma 배포
export KUBECONFIG=./kubeconfig-dev.yaml
kubectl rollout restart deployment store-pjt -n store-pjt
kubectl rollout restart deployment approuter -n store-pjt
```

---

## 🔑 8. 설정 파일

| 기능 | 파일 위치 |
|------|----------|
| CDS 빌드 설정 | `.cdsrc.json` |
| 환경변수 (AI Core, MCP Server URL) | `.env` |
| XSUAA 보안 설정 (scopes, roles) | `xs-security.json` |
| 프로젝트 의존성 | `package.json` |
| 서버 엔트리포인트 | `server.js` |
| Docker 빌드 제외 | `.dockerignore` |
| Git 제외 | `.gitignore` |

---

## 🔗 9. 아키텍처 흐름

```
브라우저 (index.html)
    ↓ HTTPS
Kyma APIRule (store-pjt.c56380c.kyma.ondemand.com)
    ↓
Approuter (XSUAA 인증 + 라우팅)
    ↓ HTTP (내부)
CAP Backend (Node.js :4004)
    ├── OData (InventoryService) → HANA Cloud
    └── Chat (ChatService) → AI Core Orchestration → MCP Tool Server