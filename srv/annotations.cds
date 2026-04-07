using InventoryService as service from './service';

// ═══════════════════════════════════════════════════════════════════════
// Categories - 분류 마스터 (List Report + Object Page)
// ═══════════════════════════════════════════════════════════════════════

annotate service.Categories with @(
  UI.HeaderInfo : {
    TypeName       : '분류',
    TypeNamePlural : '분류 목록',
    Title          : { $Type: 'UI.DataField', Value: code },
    Description    : { $Type: 'UI.DataField', Value: name }
  },

  UI.SelectionFields : [ code, name, isActive ],

  UI.LineItem : [
    { $Type: 'UI.DataField', Value: code,        Label: '분류 코드', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: name,        Label: '분류명', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: description, Label: '설명', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: isActive,    Label: '활성 여부', ![@HTML5.CssDefaults]: { width: 'auto' } }
  ],

  UI.Facets : [
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'BasicInfo',
      Label  : '기본 정보',
      Target : '@UI.FieldGroup#BasicInfo'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'ProductsList',
      Label  : '소속 상품',
      Target : 'products/@UI.LineItem'
    }
  ],

  UI.FieldGroup #BasicInfo : {
    $Type : 'UI.FieldGroupType',
    Data  : [
      { $Type: 'UI.DataField', Value: code,        Label: '분류 코드' },
      { $Type: 'UI.DataField', Value: name,        Label: '분류명' },
      { $Type: 'UI.DataField', Value: description, Label: '설명' },
      { $Type: 'UI.DataField', Value: isActive,    Label: '활성 여부' }
    ]
  },

  Capabilities : {
    InsertRestrictions : { Insertable: true },
    UpdateRestrictions : { Updatable:  true },
    DeleteRestrictions : { Deletable:  true }
  }
);

annotate service.Categories with {
  code        @title: '분류 코드';
  name        @title: '분류명';
  description @title: '설명';
  isActive    @title: '활성 여부';
};

// ═══════════════════════════════════════════════════════════════════════
// Products - 상품 마스터 (List Report + Object Page)
// ═══════════════════════════════════════════════════════════════════════

annotate service.Products with @(
  UI.HeaderInfo : {
    TypeName       : '상품',
    TypeNamePlural : '상품 목록',
    Title          : { $Type: 'UI.DataField', Value: productCode },
    Description    : { $Type: 'UI.DataField', Value: name }
  },

  UI.SelectionFields : [ productCode, name, category_ID, unit, isActive ],

  UI.LineItem : [
    { $Type: 'UI.DataField', Value: productCode,  Label: '상품 코드', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: name,          Label: '상품명', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: category.name,  Label: '분류', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: unit,          Label: '단위', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: safetyStock,   Label: '안전 재고', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: isActive,      Label: '활성 여부', ![@HTML5.CssDefaults]: { width: 'auto' } }
  ],

  UI.Facets : [
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'BasicInfo',
      Label  : '기본 정보',
      Target : '@UI.FieldGroup#BasicInfo'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'CategoryInfo',
      Label  : '분류 정보',
      Target : '@UI.FieldGroup#CategoryInfo'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'DescriptionInfo',
      Label  : '상세 설명',
      Target : '@UI.FieldGroup#DescriptionInfo'
    }
  ],

  UI.FieldGroup #BasicInfo : {
    $Type : 'UI.FieldGroupType',
    Data  : [
      { $Type: 'UI.DataField', Value: productCode, Label: '상품 코드' },
      { $Type: 'UI.DataField', Value: name,         Label: '상품명' },
      { $Type: 'UI.DataField', Value: unit,         Label: '단위' },
      { $Type: 'UI.DataField', Value: safetyStock,  Label: '안전 재고' },
      { $Type: 'UI.DataField', Value: leadTime,     Label: '리드타임(일)' },
      { $Type: 'UI.DataField', Value: isActive,     Label: '활성 여부' }
    ]
  },

  UI.FieldGroup #CategoryInfo : {
    $Type : 'UI.FieldGroupType',
    Data  : [
      { $Type: 'UI.DataField', Value: category_ID,   Label: '분류' }
    ]
  },

  UI.FieldGroup #DescriptionInfo : {
    $Type : 'UI.FieldGroupType',
    Data  : [
      { $Type: 'UI.DataField', Value: description, Label: '설명' }
    ]
  },

  Capabilities : {
    InsertRestrictions : { Insertable: true },
    UpdateRestrictions : { Updatable:  true },
    DeleteRestrictions : { Deletable:  true }
  }
);

annotate service.Products with {
  productCode @title: '상품 코드';
  name        @title: '상품명';
  unit        @title: '단위';
  safetyStock @title: '안전 재고';
  leadTime    @title: '리드타임(일)';
  isActive    @title: '활성 여부';
  description @title: '설명';
  category    @(
    title: '분류',
    Common.Text: category.name,
    Common.TextArrangement: #TextFirst,
    Common.ValueList : {
      $Type          : 'Common.ValueListType',
      CollectionPath : 'Categories',
      Parameters     : [
        {
          $Type             : 'Common.ValueListParameterInOut',
          LocalDataProperty : category_ID,
          ValueListProperty : 'ID'
        },
        {
          $Type             : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'code'
        },
        {
          $Type             : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'name'
        }
      ]
    }
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Inventories - 재고 마스터 (List Report + Object Page)
// ═══════════════════════════════════════════════════════════════════════

annotate service.Inventories with @(
  UI.HeaderInfo : {
    TypeName       : '재고',
    TypeNamePlural : '재고 목록',
    Title          : { $Type: 'UI.DataField', Value: product.productCode },
    Description    : { $Type: 'UI.DataField', Value: warehouse }
  },

  UI.SelectionFields : [ product_ID, warehouse ],

  UI.LineItem : [
    { $Type: 'UI.DataField', Value: product.productCode,    Label: '상품 코드', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: product.name,           Label: '상품명', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: warehouse,       Label: '창고', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: quantity,        Label: '수량', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: reservedQty,     Label: '예약 수량', ![@HTML5.CssDefaults]: { width: 'auto' } },
    {
      $Type             : 'UI.DataField',
      Value             : availableQty,
      Label             : '가용 수량',
      ![@HTML5.CssDefaults]: { width: 'auto' }
    },
    { $Type: 'UI.DataField', Value: lastUpdated,     Label: '최종 업데이트', ![@HTML5.CssDefaults]: { width: 'auto' } }
  ],

  UI.Facets : [
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'InventoryInfo',
      Label  : '재고 정보',
      Target : '@UI.FieldGroup#InventoryInfo'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'ProductInfo',
      Label  : '상품 정보',
      Target : '@UI.FieldGroup#ProductInfo'
    }
  ],

  UI.FieldGroup #InventoryInfo : {
    $Type : 'UI.FieldGroupType',
    Data  : [
      { $Type: 'UI.DataField', Value: warehouse,    Label: '창고' },
      { $Type: 'UI.DataField', Value: quantity,      Label: '수량' },
      { $Type: 'UI.DataField', Value: reservedQty,   Label: '예약 수량' },
      { $Type: 'UI.DataField', Value: availableQty,  Label: '가용 수량' },
      { $Type: 'UI.DataField', Value: lastUpdated,   Label: '최종 업데이트' }
    ]
  },

  UI.FieldGroup #ProductInfo : {
    $Type : 'UI.FieldGroupType',
    Data  : [
      { $Type: 'UI.DataField', Value: product_ID,            Label: '상품' },
      { $Type: 'UI.DataField', Value: product.productCode,   Label: '상품 코드' },
      { $Type: 'UI.DataField', Value: product.name,          Label: '상품명' },
      { $Type: 'UI.DataField', Value: product.safetyStock,   Label: '안전 재고' }
    ]
  },

  Capabilities : {
    InsertRestrictions : { Insertable: true },
    UpdateRestrictions : { Updatable:  true },
    DeleteRestrictions : { Deletable:  true }
  }
);

// Virtual field for criticality (computed in service handler)
annotate service.Inventories with {
  warehouse    @title: '창고';
  quantity     @title: '수량';
  reservedQty  @title: '예약 수량';
  availableQty @title: '가용 수량';
  lastUpdated  @title: '최종 업데이트';
  product      @(
    title: '상품',
    Common.Text: product.name,
    Common.TextArrangement: #TextFirst,
    Common.ValueList : {
      $Type          : 'Common.ValueListType',
      CollectionPath : 'Products',
      Parameters     : [
        {
          $Type             : 'Common.ValueListParameterInOut',
          LocalDataProperty : product_ID,
          ValueListProperty : 'ID'
        },
        {
          $Type             : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'productCode'
        },
        {
          $Type             : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'name'
        }
      ]
    }
  );
};

// ═══════════════════════════════════════════════════════════════════════
// PurchaseOrders - 발주 마스터 (List Report + Object Page)
// ═══════════════════════════════════════════════════════════════════════

annotate service.PurchaseOrders with @(
  UI.HeaderInfo : {
    TypeName       : '발주',
    TypeNamePlural : '발주 목록',
    Title          : { $Type: 'UI.DataField', Value: poNumber },
    Description    : { $Type: 'UI.DataField', Value: product.name }
  },

  UI.SelectionFields : [ poNumber, product_ID, status, requestedBy ],

  UI.LineItem : [
    { $Type: 'UI.DataField', Value: poNumber,      Label: '발주 번호', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: product.name,    Label: '상품명', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: quantity,        Label: '수량', ![@HTML5.CssDefaults]: { width: 'auto' } },
    {
      $Type       : 'UI.DataField',
      Value       : status,
      Label       : '상태',
      ![@HTML5.CssDefaults]: { width: 'auto' }
    },
    { $Type: 'UI.DataField', Value: requestedBy,   Label: '요청자', ![@HTML5.CssDefaults]: { width: 'auto' } },
    { $Type: 'UI.DataField', Value: expectedDate,  Label: '입고 예정일', ![@HTML5.CssDefaults]: { width: 'auto' } }
  ],

  UI.Facets : [
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'OrderInfo',
      Label  : '발주 정보',
      Target : '@UI.FieldGroup#OrderInfo'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      ID     : 'ApprovalInfo',
      Label  : '승인 정보',
      Target : '@UI.FieldGroup#ApprovalInfo'
    }
  ],

  UI.FieldGroup #OrderInfo : {
    $Type : 'UI.FieldGroupType',
    Data  : [
      { $Type: 'UI.DataField', Value: poNumber,     Label: '발주 번호' },
      { $Type: 'UI.DataField', Value: product_ID,   Label: '상품' },
      { $Type: 'UI.DataField', Value: quantity,      Label: '수량' },
      { $Type: 'UI.DataField', Value: expectedDate,  Label: '입고 예정일' },
      { $Type: 'UI.DataField', Value: receivedDate,  Label: '실제 입고일' },
      { $Type: 'UI.DataField', Value: note,          Label: '비고' }
    ]
  },

  UI.FieldGroup #ApprovalInfo : {
    $Type : 'UI.FieldGroupType',
    Data  : [
      { $Type: 'UI.DataField', Value: status,       Label: '상태' },
      { $Type: 'UI.DataField', Value: requestedBy,  Label: '요청자' },
      { $Type: 'UI.DataField', Value: approvedBy,   Label: '승인자' },
      { $Type: 'UI.DataField', Value: approvedAt,   Label: '승인 일시' }
    ]
  },

  // Custom Actions for PO workflow
  UI.Identification : [
    {
      $Type  : 'UI.DataFieldForAction',
      Action : 'InventoryService.submitOrder',
      Label  : '승인 요청'
    },
    {
      $Type  : 'UI.DataFieldForAction',
      Action : 'InventoryService.approveOrder',
      Label  : '승인'
    },
    {
      $Type  : 'UI.DataFieldForAction',
      Action : 'InventoryService.rejectOrder',
      Label  : '반려'
    },
    {
      $Type  : 'UI.DataFieldForAction',
      Action : 'InventoryService.receiveOrder',
      Label  : '입고 처리'
    }
  ],

  Capabilities : {
    InsertRestrictions : { Insertable: true },
    UpdateRestrictions : { Updatable:  true },
    DeleteRestrictions : { Deletable:  true }
  }
);

annotate service.PurchaseOrders with {
  poNumber     @title: '발주 번호'  @readonly;
  quantity     @title: '수량';
  status       @title: '상태'      @readonly;
  requestedBy  @title: '요청자';
  approvedBy   @title: '승인자'    @readonly;
  approvedAt   @title: '승인 일시'  @readonly;
  expectedDate @title: '입고 예정일';
  receivedDate @title: '실제 입고일' @readonly;
  note         @title: '비고';
  product      @(
    title: '상품',
    Common.Text: product.name,
    Common.TextArrangement: #TextFirst,
    Common.ValueList : {
      $Type          : 'Common.ValueListType',
      CollectionPath : 'Products',
      Parameters     : [
        {
          $Type             : 'Common.ValueListParameterInOut',
          LocalDataProperty : product_ID,
          ValueListProperty : 'ID'
        },
        {
          $Type             : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'productCode'
        },
        {
          $Type             : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'name'
        }
      ]
    }
  );
};