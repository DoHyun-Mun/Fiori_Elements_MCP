using InventoryService as service from '../../srv/service';

// ═══════════════════════════════════════════════════════════════════
// DailySales - 일별 매출 집계
// ═══════════════════════════════════════════════════════════════════

annotate service.DailySales with @(
  UI: {
    HeaderInfo: {
      TypeName: '일별 매출',
      TypeNamePlural: '일별 매출 목록',
      Title: { Value: salesDate },
      Description: { Value: store.name }
    },

    SelectionFields: [
      store_ID,
      product_ID,
      salesDate
    ],

    LineItem: [
      { Value: salesDate,       Label: '매출일',   ![@HTML5.CssDefaults]: { width: 'auto' } },
      { Value: store.name,      Label: '점포',     ![@HTML5.CssDefaults]: { width: 'auto' } },
      { Value: product.name,    Label: '상품',     ![@HTML5.CssDefaults]: { width: 'auto' } },
      { Value: quantity,        Label: '수량',     ![@HTML5.CssDefaults]: { width: 'auto' } },
      { Value: revenue,         Label: '매출액',   ![@UI.Importance]: #High, ![@HTML5.CssDefaults]: { width: 'auto' } },
      { Value: costAmount,      Label: '원가',     ![@HTML5.CssDefaults]: { width: 'auto' } },
      { Value: profit,          Label: '이익',     ![@UI.Importance]: #High, ![@HTML5.CssDefaults]: { width: 'auto' } },
      { Value: customerCount,   Label: '고객수',   ![@HTML5.CssDefaults]: { width: 'auto' } }
    ],

    PresentationVariant: {
      SortOrder: [{ Property: salesDate, Descending: true }],
      Visualizations: ['@UI.LineItem']
    },

    HeaderFacets: [
      { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Revenue' },
      { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Profit' }
    ],

    DataPoint#Revenue: {
      Value: revenue,
      Title: '매출액'
    },

    DataPoint#Profit: {
      Value: profit,
      Title: '이익'
    },

    Facets: [
      {
        $Type: 'UI.CollectionFacet',
        ID: 'SalesDetail',
        Label: '매출 상세',
        Facets: [
          { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#SalesInfo', Label: '📊 매출 정보' },
          { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#ProfitInfo', Label: '💰 손익 정보' }
        ]
      }
    ],

    FieldGroup#SalesInfo: {
      Data: [
        { Value: store_ID,       Label: '점포' },
        { Value: product_ID,     Label: '상품' },
        { Value: salesDate,      Label: '매출일자' },
        { Value: quantity,       Label: '판매수량' },
        { Value: customerCount,  Label: '고객수' }
      ]
    },

    FieldGroup#ProfitInfo: {
      Data: [
        { Value: revenue,     Label: '매출액' },
        { Value: costAmount,  Label: '원가' },
        { Value: profit,      Label: '이익' }
      ]
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// 필드 제목 및 ValueList (필터 드롭다운)
// ═══════════════════════════════════════════════════════════════════
annotate service.DailySales with {
  salesDate @title: '매출일';
  revenue   @title: '매출액';
  profit    @title: '이익';
  quantity  @title: '수량';
  costAmount @title: '원가';
  customerCount @title: '고객수';
  store     @(
    title: '점포',
    Common.Text: store.name,
    Common.TextArrangement: #TextFirst,
    Common.ValueList: {
      $Type: 'Common.ValueListType',
      CollectionPath: 'Stores',
      Parameters: [
        { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: store_ID, ValueListProperty: 'ID' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
      ]
    }
  );
  product   @(
    title: '상품',
    Common.Text: product.name,
    Common.TextArrangement: #TextFirst,
    Common.ValueList: {
      $Type: 'Common.ValueListType',
      CollectionPath: 'Products',
      Parameters: [
        { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: product_ID, ValueListProperty: 'ID' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
      ]
    }
  );
};