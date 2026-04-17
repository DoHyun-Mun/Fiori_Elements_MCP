# CAP + Fiori Elements Training Project

SAP CAP (Cloud Application Programming Model) + Fiori Elements를 활용한 OData V4 기반 CRUD 애플리케이션 예제입니다.

## 📁 프로젝트 구조

```
fiori-cap-test/
├── db/
│   ├── schema.cds              # CDS 데이터 모델 (Products, Categories, Orders, OrderItems)
│   └── data/
│       ├── com.training.fiori-Categories.csv
│       ├── com.training.fiori-Products.csv
│       ├── com.training.fiori-Orders.csv
│       └── com.training.fiori-OrderItems.csv
├── srv/
│   ├── catalog-service.cds     # OData V4 서비스 정의
│   ├── catalog-service.js      # 서비스 핸들러 (Actions, Before/After 이벤트)
│   └── annotations.cds         # Fiori Elements UI Annotations
├── app/
│   ├── index.html              # Fiori Launchpad (진입점)
│   ├── products/               # 제품 관리 Fiori Elements 앱
│   │   ├── webapp/
│   │   │   ├── manifest.json   # 앱 디스크립터 (라우팅, 모델 설정)
│   │   │   ├── Component.js    # UI5 컴포넌트
│   │   │   ├── index.html
│   │   │   └── i18n/
│   │   ├── package.json
│   │   └── ui5.yaml
│   └── orders/                 # 주문 관리 Fiori Elements 앱
│       ├── webapp/
│       │   ├── manifest.json
│       │   ├── Component.js
│       │   ├── index.html
│       │   └── i18n/
│       ├── package.json
│       └── ui5.yaml
├── .cdsrc.json                 # CAP 설정
├── package.json
└── README.md
```

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. CAP 서버 실행

```bash
npm run watch
# 또는
cds watch
```

서버가 시작되면 브라우저에서 http://localhost:4004 접속

### 3. Fiori Elements 앱 접근

브라우저에서 http://localhost:4004/app/index.html 접속 후 타일 클릭
또는 직접:
- 제품 관리: http://localhost:4004/app/products/webapp/index.html
- 주문 관리: http://localhost:4004/app/orders/webapp/index.html

## 📋 주요 개념

### CAP CDS 모델 (db/schema.cds)

- **Products**: 제품 마스터 (코드, 명칭, 카테고리, 가격, 재고)
- **Categories**: 제품 카테고리 (계층 구조 지원)
- **Orders**: 주문 헤더 (주문번호, 고객, 날짜, 상태)
- **OrderItems**: 주문 항목 (제품, 수량, 금액)

### OData V4 Annotations (srv/annotations.cds)

| Annotation | 용도 |
|---|---|
| `@UI.SelectionFields` | List Report 검색 필터 |
| `@UI.LineItem` | 목록 테이블 컬럼 정의 |
| `@UI.HeaderInfo` | Object Page 헤더 |
| `@UI.Facets` | Object Page 섹션 구조 |
| `@UI.FieldGroup` | Object Page 필드 그룹 |
| `@Common.ValueList` | 드롭다운 값 도움 |
| `Criticality` | 상태별 색상 표시 (Red/Orange/Green) |

### Fiori Elements 패턴

- **List Report**: 검색 + 목록 테이블 (SAP 표준 패턴)
- **Object Page**: 상세 보기 + 편집 (헤더 + 섹션)
- **Bound Actions**: 엔티티에 바인딩된 커스텀 액션 버튼

### CAP 서비스 핸들러 (srv/catalog-service.js)

- `deactivateProduct`: 제품 비활성화 액션
- `updateStock`: 재고 수량 업데이트 액션
- `cancelOrder`: 주문 취소 액션 (상태 검증 포함)
- `before CREATE` Orders: 주문번호 자동 생성
- `after CREATE/UPDATE/DELETE` OrderItems: 주문 총금액 자동 계산

## 🔧 OData V4 API

서버 실행 후 사용 가능한 엔드포인트:

```
GET  http://localhost:4004/catalog/Products
GET  http://localhost:4004/catalog/Products?$select=productCode,name,price&$orderby=price desc
GET  http://localhost:4004/catalog/Products?$filter=status eq 'A'&$expand=category
GET  http://localhost:4004/catalog/Orders?$expand=items($expand=product)
GET  http://localhost:4004/catalog/$metadata
```

## ☁️ Kyma Runtime 배포

### 아키텍처

```
[브라우저] → [APIRule/Istio Gateway] → [Approuter (XSUAA 인증)] → [CAP Backend :4004]
                                              ↓
                                    [XSUAA (BTP Service Operator)]
                                              ↓
                                         [IAS (IdP) - SSO]
```

### 접속 URL

https://fiori-mcp-test.c56380c.kyma.ondemand.com/

### 배포된 K8s 리소스

| 리소스 | 파일 | 설명 |
|--------|------|------|
| XSUAA ServiceInstance | `k8s/xsuaa-serviceinstance.yaml` | BTP Service Operator로 XSUAA 프로비저닝 |
| XSUAA ServiceBinding | `k8s/xsuaa-servicebinding.yaml` | XSUAA credentials 자동 생성 (`xsuaa-binding-secret`) |
| UAA Default Services Secret | `k8s/uaa-default-services-secret.yaml` | Approuter의 `default-services.json` (XSUAA credentials) |
| Approuter ConfigMap | `k8s/approuter-xs-app-configmap.yaml` | Approuter의 `xs-app.json` (라우팅 설정) |
| Approuter Deployment | `k8s/approuter-deployment.yaml` | XSUAA 인증 + 라우팅 |
| Approuter Service | `k8s/approuter-service.yaml` | Approuter ClusterIP Service |
| CAP Backend Deployment | `k8s/deployment.yaml` | CAP Backend (Istio sidecar 비활성) |
| CAP Backend Service | `k8s/service.yaml` | CAP Backend ClusterIP Service |
| APIRule | `k8s/apirule.yaml` | Istio Gateway 외부 접속 |
| Namespace | `k8s/namespace.yaml` | `fiori-mcp-test` namespace |

### 인증 흐름 (OAuth2 Authorization Code Flow)

```
① 브라우저 → APIRule/Istio Gateway → Approuter
      ↓
② Approuter: "인증 안 됐네?" → 브라우저에 XSUAA authorize URL로 리다이렉트 지시
      ↓
③ 브라우저 → XSUAA (BTP 클라우드, Kyma 외부)
      ↓
④ XSUAA: "IAS가 IdP로 설정되어 있네" → 브라우저에 IAS 로그인 페이지로 리다이렉트
      ↓
⑤ 브라우저 → IAS 로그인 페이지 (사용자가 ID/PW 입력 또는 SSO)
      ↓
⑥ IAS → XSUAA로 SAML assertion 전달
      ↓
⑦ XSUAA → 브라우저에 authorization code 발급 → Approuter callback URL로 리다이렉트
      ↓
⑧ Approuter → XSUAA에 authorization code로 JWT 토큰 교환 요청
      ↓
⑨ XSUAA → Approuter에 JWT 토큰 발급
      ↓
⑩ Approuter: JWT 토큰을 세션에 저장, 요청을 CAP Backend로 포워딩 (Authorization 헤더에 JWT 첨부)
      ↓
⑪ CAP Backend: Fiori 앱 + OData 응답 → 브라우저
```

### 핵심 포인트

- **XSUAA는 Kyma 클러스터 안에서 실행되지 않는다.** XSUAA는 BTP 클라우드 서비스(`authentication.ap12.hana.ondemand.com`)로 외부에서 운영된다.
- Kyma 안의 **ServiceInstance/ServiceBinding 리소스**는 BTP Service Operator가 BTP 클라우드의 XSUAA 서비스를 "프로비저닝"하고, 생성된 credentials(clientid, clientsecret 등)을 Kubernetes Secret으로 가져오는 역할을 한다.
- **Approuter**가 Kyma 안에서 실행되면서, 이 XSUAA credentials를 사용해 외부 XSUAA 서비스와 OAuth2 authorization code flow를 수행한다.
- **IAS(Identity Authentication Service)**는 XSUAA 뒤에 있는 실제 IdP(Identity Provider)로, XSUAA가 인증을 IAS에 위임한다.
- 요약: **APIRule → Approuter(Kyma 내부) → XSUAA(BTP 외부 서비스) → IAS(IdP) → 토큰 발급 → Approuter → CAP Backend(Kyma 내부)**

### Docker 이미지 빌드 & Push

```bash
# CAP Backend
docker build -t ghcr.io/dohyun-mun/fiori-mcp-test:latest .
docker push ghcr.io/dohyun-mun/fiori-mcp-test:latest

# Approuter
cd approuter
docker build -t ghcr.io/dohyun-mun/fiori-mcp-test-approuter:latest .
docker push ghcr.io/dohyun-mun/fiori-mcp-test-approuter:latest
```

### 배포 순서

```bash
# 1. Namespace
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/namespace.yaml

# 2. XSUAA (BTP Service Operator)
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/xsuaa-serviceinstance.yaml
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/xsuaa-servicebinding.yaml

# 3. Secrets & ConfigMap
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/uaa-default-services-secret.yaml
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/approuter-xs-app-configmap.yaml

# 4. CAP Backend
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/deployment.yaml
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/service.yaml

# 5. Approuter
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/approuter-deployment.yaml
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/approuter-service.yaml

# 6. APIRule (외부 접속)
KUBECONFIG=kubeconfig-dev.yaml kubectl apply -f k8s/apirule.yaml
```

### 전체 재배포

```bash
KUBECONFIG=kubeconfig-dev.yaml kubectl rollout restart deployment fiori-mcp-test -n fiori-mcp-test
KUBECONFIG=kubeconfig-dev.yaml kubectl rollout restart deployment approuter -n fiori-mcp-test
```

### 해결한 주요 이슈

1. **IAS 직접 인증 불가** → XSUAA 인증으로 전환 (IAS는 XSUAA Bundled 타입이므로 직접 authorization_code flow 사용 불가)
2. **502 Bad Gateway (ECONNRESET)** → Istio sidecar mTLS 충돌 해결 (Approuter, CAP Backend 양쪽 모두 `sidecar.istio.io/inject: "false"` 설정)

## 📚 참고 자료

- [SAP CAP Documentation](https://cap.cloud.sap/docs/)
- [Fiori Elements Documentation](https://ui5.sap.com/#/topic/03265b0408e2432c9571d6b3feb6b1fd)
- [OData V4 Annotations](https://cap.cloud.sap/docs/advanced/odata#annotations)
- [CDS Annotations for Fiori](https://cap.cloud.sap/docs/cds/annotations)
- [SAP BTP Service Operator](https://github.com/SAP/sap-btp-service-operator)
- [SAP Approuter](https://www.npmjs.com/package/@sap/approuter)
