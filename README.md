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

## 📚 참고 자료

- [SAP CAP Documentation](https://cap.cloud.sap/docs/)
- [Fiori Elements Documentation](https://ui5.sap.com/#/topic/03265b0408e2432c9571d6b3feb6b1fd)
- [OData V4 Annotations](https://cap.cloud.sap/docs/advanced/odata#annotations)
- [CDS Annotations for Fiori](https://cap.cloud.sap/docs/cds/annotations)