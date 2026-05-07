using com.inventory as db from '../db/schema';

/**
 * InventoryService - 점포 상품별 재고 발주 관리 서비스
 * OData V4 기반, Fiori Elements 연동
 */
service InventoryService @(path: '/inventory') {

  /**
   * Categories - 분류 마스터
   */
  @odata.draft.enabled
  entity Categories as projection on db.Categories;

  /**
   * Products - 상품 마스터
   */
  @odata.draft.enabled
  entity Products as projection on db.Products;

  /**
   * Inventories - 재고 마스터
   */
  @odata.draft.enabled
  entity Inventories as projection on db.Inventories;

  annotate Inventories with {
    availableQty @readonly;
  };


  /**
   * Stores - 점포 마스터
   */
  @odata.draft.enabled
  entity Stores as projection on db.Stores;

  /**
   * Suppliers - 공급업체 마스터
   */
  @odata.draft.enabled
  entity Suppliers as projection on db.Suppliers;

  /**
   * Materials - 자재 마스터
   */
  @odata.draft.enabled
  entity Materials as projection on db.Materials;

  /**
   * StoreProducts - 점포별 상품 관리
   */
  @odata.draft.enabled
  entity StoreProducts as projection on db.StoreProducts;

  /**
   * ProductMaterials - 상품-자재 BOM
   */
  @odata.draft.enabled
  entity ProductMaterials as projection on db.ProductMaterials;

  /**
   * PurchaseOrders - 발주 마스터
   */
  @odata.draft.enabled
  entity PurchaseOrders as projection on db.PurchaseOrders
  actions {
    /** 승인 요청: Draft → Submitted */
    action submitOrder() returns PurchaseOrders;
    /** 승인: Submitted → Approved */
    action approveOrder() returns PurchaseOrders;
    /** 반려: Submitted → Rejected */
    action rejectOrder(reason : String) returns PurchaseOrders;
    /** 입고 처리: Approved → Received (재고 반영) */
    action receiveOrder(warehouse : String(50)) returns PurchaseOrders;
  };

  /**
   * Customers - 고객 마스터
   */
  @odata.draft.enabled
  entity Customers as projection on db.Customers;

  /**
   * CustomerPurchases - 고객 구매 이력
   */
  @odata.draft.enabled
  entity CustomerPurchases as projection on db.CustomerPurchases;

  /**
   * CustomerPurchaseItems - 구매 상세 품목
   */
  entity CustomerPurchaseItems as projection on db.CustomerPurchaseItems;

  /**
   * DailySales - 일별 매출 집계 (ML 수요 예측 입력)
   */
  @odata.draft.enabled
  entity DailySales as projection on db.DailySales;
  /**
   * DemandForecasts - 수요 예측 결과 (ML 출력)
   */
  @odata.draft.enabled
  entity DemandForecasts as projection on db.DemandForecasts;

  /**
   * OrderRecommendations - 발주 추천 (ML 예측 기반)
   */
  @odata.draft.enabled
  entity OrderRecommendations as projection on db.OrderRecommendations;

  /**
   * MenuItems - 메뉴 관리 (3계층 트리 구조)
   */
  @odata.draft.enabled
  entity MenuItems as projection on db.MenuItems;

  // ════════════════════════════════════════════════════════════════════
  // 예측 분석 결과 엔티티 (Python ML 서버 → OData API → HANA)
  // ════════════════════════════════════════════════════════════════════

  /**
   * ChurnPredictions - 고객 이탈 예측 결과 (Python ML 출력)
   */
  @odata.draft.enabled
  entity ChurnPredictions as projection on db.ChurnPredictions;

  /**
   * CustomerSegments - 고객 세분화 결과 (Python ML 출력)
   */
  @odata.draft.enabled
  entity CustomerSegments as projection on db.CustomerSegments;

  /**
   * SalesAnomalies - 매출 이상 탐지 결과 (Python ML 출력)
   */
  @odata.draft.enabled
  entity SalesAnomalies as projection on db.SalesAnomalies;

  /**
   * Search 지원 필드 지정
   */
  annotate Products with {
    productCode @Search.defaultSearchElement;
    name        @Search.defaultSearchElement;
  };

  annotate Categories with {
    code @Search.defaultSearchElement;
    name @Search.defaultSearchElement;
  };

  annotate PurchaseOrders with {
    poNumber @Search.defaultSearchElement;
  };

  annotate Stores with {
    storeCode @Search.defaultSearchElement;
    name      @Search.defaultSearchElement;
    city      @Search.defaultSearchElement;
    manager   @Search.defaultSearchElement;
  };

  annotate Suppliers with {
    supplierCode  @Search.defaultSearchElement;
    name          @Search.defaultSearchElement;
    contactPerson @Search.defaultSearchElement;
    city          @Search.defaultSearchElement;
  };

  annotate Materials with {
    materialCode @Search.defaultSearchElement;
    name         @Search.defaultSearchElement;
  };

  annotate Customers with {
    customerCode   @Search.defaultSearchElement;
    name           @Search.defaultSearchElement;
    city           @Search.defaultSearchElement;
  };

  annotate CustomerPurchases with {
    purchaseNumber @Search.defaultSearchElement;
  };

  annotate MenuItems with {
    code  @Search.defaultSearchElement;
    title @Search.defaultSearchElement;
  };

  annotate ChurnPredictions with {
    churnRisk @Search.defaultSearchElement;
  };

  annotate CustomerSegments with {
    segmentName @Search.defaultSearchElement;
    segmentCode @Search.defaultSearchElement;
  };

  annotate SalesAnomalies with {
    anomalyType @Search.defaultSearchElement;
    severity    @Search.defaultSearchElement;
    metricName  @Search.defaultSearchElement;
  };

  // ═══════════════════════════════════════════════════════════════
  // 유통 프로세스 엔티티 (물류센터 → 입고 → 검수 → 인보이스 → 배송 → 점포입고)
  // ═══════════════════════════════════════════════════════════════

  /**
   * DistributionCenters - 물류센터
   */
  @odata.draft.enabled
  entity DistributionCenters as projection on db.DistributionCenters;

  /**
   * InboundOrders - 입고오더 (공급업체 → 물류센터)
   */
  @odata.draft.enabled
  entity InboundOrders as projection on db.InboundOrders;
  entity InboundOrderItems as projection on db.InboundOrderItems;

  /**
   * GoodsReceipts - 입고검수
   */
  @odata.draft.enabled
  entity GoodsReceipts as projection on db.GoodsReceipts;
  entity GoodsReceiptItems as projection on db.GoodsReceiptItems;

  /**
   * Invoices - 인보이스/세금계산서
   */
  @odata.draft.enabled
  entity Invoices as projection on db.Invoices;
  entity InvoiceItems as projection on db.InvoiceItems;

  /**
   * TransferOrders - 배송지시 (물류센터 → 점포)
   */
  @odata.draft.enabled
  entity TransferOrders as projection on db.TransferOrders;
  entity TransferOrderItems as projection on db.TransferOrderItems;

  /**
   * StoreReceipts - 점포입고
   */
  @odata.draft.enabled
  entity StoreReceipts as projection on db.StoreReceipts;
  entity StoreReceiptItems as projection on db.StoreReceiptItems;

  // ═══════════════════════════════════════════════════════════════
  // AI 대시보드 전용 Function Imports
  // ═══════════════════════════════════════════════════════════════

  /** 대시보드 동적 KPI (매출, 재고건전성, 결품위험, 발주대기) */
  function getDashboardKPIs() returns {
    todayRevenue: Decimal(15,2);
    revenueChange: Decimal(5,2);
    healthScore: Integer;
    healthChange: Integer;
    stockoutRisk: Integer;
    pendingOrders: Integer;
  };

  /** AI 인사이트 카드 (긴급/주의/기회/통찰/추천) */
  function getAIInsights() returns array of {
    type: String(20);
    severity: String(10);
    title: String(200);
    description: String(500);
    metric1Label: String(50);
    metric1Value: String(50);
    metric2Label: String(50);
    metric2Value: String(50);
    actionLabel: String(50);
    actionUrl: String(200);
    store: String(100);
    product: String(100);
  };

  /** 점포별 건전성 점수 */
  function getStoreHealthScores() returns array of {
    storeId: String(36);
    storeName: String(200);
    city: String(100);
    score: Integer;
    status: String(10);
    stockoutCount: Integer;
    totalProducts: Integer;
  };

  /** 매출 트렌드 + AI 예측 결합 데이터 */
  function getSalesForecastTrend() returns array of {
    date: String(10);
    actual: Decimal(15,2);
    forecast: Decimal(15,2);
    confidenceLow: Decimal(15,2);
    confidenceHigh: Decimal(15,2);
  };
}
