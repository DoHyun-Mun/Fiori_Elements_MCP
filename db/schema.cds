namespace com.inventory;

using {
  cuid,
  managed
} from '@sap/cds/common';

/**
 * Category (분류 마스터)
 */
entity Categories : cuid, managed {
  code        : String(10) @mandatory @assert.unique;
  name        : String(100) @mandatory;
  description : String(500);
  isActive    : Boolean default true;
  products    : Association to many Products on products.category = $self;
}

/**
 * Product (상품 마스터)
 */
entity Products : cuid, managed {
  productCode : String(20) @mandatory @assert.unique;
  name        : String(200) @mandatory;
  category    : Association to Categories;
  unit        : String(10);  // EA, KG, L 등
  safetyStock : Integer default 0;
  leadTime    : Integer default 0;     // 발주 리드타임(일)
  isActive    : Boolean default true;
  description : String(1000);
  inventories : Association to many Inventories on inventories.product = $self;
  orders      : Association to many PurchaseOrders on orders.product = $self;
}

/**
 * Inventory (재고 마스터)
 */
entity Inventories : cuid, managed {
  product      : Association to Products;
  warehouse    : String(50);  // 창고 코드
  quantity     : Integer not null default 0 @assert.range: [ 0, ];
  reservedQty  : Integer default 0 @assert.range: [ 0, ];
  availableQty : Integer default 0;  // computed: quantity - reservedQty
  lastUpdated  : Timestamp;
}

/**
 * PurchaseOrder (발주 마스터)
 */
entity PurchaseOrders : cuid, managed {
  poNumber     : String(20) @assert.unique;  // 자동 채번 PO-YYYYMMDD-XXXX
  product      : Association to Products;
  quantity     : Integer not null @assert.range: [ 1, ];
  status       : String(20) default 'Draft';  // Draft / Submitted / Approved / Rejected / Received
  requestedBy  : String(100);
  approvedBy   : String(100);
  approvedAt   : Timestamp;
  expectedDate : Date;
  receivedDate : Date;
  note         : String(500);
}