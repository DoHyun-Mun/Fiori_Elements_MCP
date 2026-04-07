using com.inventory as db from '../db/schema';

/**
 * InventoryService - 상품 재고 관리 서비스
 * OData V4 기반, Fiori Elements 연동
 */
service InventoryService @(path: '/inventory') {

  /**
   * Categories - 분류 마스터
   */
  entity Categories as projection on db.Categories;

  /**
   * Products - 상품 마스터
   */
  entity Products as projection on db.Products;

  /**
   * Inventories - 재고 마스터
   */
  entity Inventories as projection on db.Inventories;

  /**
   * PurchaseOrders - 발주 마스터
   */
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
}