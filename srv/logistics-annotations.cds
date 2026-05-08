using InventoryService as service from './service';

// DistributionCenters
annotate service.DistributionCenters with @(
  UI.HeaderInfo : { TypeName: '물류센터', TypeNamePlural: '물류센터 목록', Title: {$Type:'UI.DataField',Value:dcCode}, Description: {$Type:'UI.DataField',Value:name} },
  UI.SelectionFields : [ dcCode, name, city, dcType, isActive ],
  UI.LineItem : [
    {$Type:'UI.DataField', Value:dcCode, Label:'DC 코드', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:name, Label:'센터명', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:city, Label:'도시', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:dcType, Label:'유형', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:capacity, Label:'최대용량', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:currentStock, Label:'현재보관량', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:manager, Label:'담당자', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:isActive, Label:'활성', ![@HTML5.CssDefaults]:{width:'auto'}}
  ],
  UI.Facets : [
    {$Type:'UI.ReferenceFacet', ID:'BasicInfo', Label:'기본 정보', Target:'@UI.FieldGroup#BasicInfo'},
    {$Type:'UI.ReferenceFacet', ID:'Contact', Label:'연락처', Target:'@UI.FieldGroup#Contact'}
  ],
  UI.FieldGroup #BasicInfo : {$Type:'UI.FieldGroupType', Data:[
    {$Type:'UI.DataField', Value:dcCode, Label:'DC 코드'}, {$Type:'UI.DataField', Value:name, Label:'센터명'},
    {$Type:'UI.DataField', Value:dcType, Label:'유형'}, {$Type:'UI.DataField', Value:capacity, Label:'최대용량'},
    {$Type:'UI.DataField', Value:currentStock, Label:'현재보관량'}, {$Type:'UI.DataField', Value:isActive, Label:'활성'},
    {$Type:'UI.DataField', Value:description, Label:'설명'}
  ]},
  UI.FieldGroup #Contact : {$Type:'UI.FieldGroupType', Data:[
    {$Type:'UI.DataField', Value:address, Label:'주소'}, {$Type:'UI.DataField', Value:city, Label:'도시'},
    {$Type:'UI.DataField', Value:phone, Label:'전화번호'}, {$Type:'UI.DataField', Value:email, Label:'이메일'},
    {$Type:'UI.DataField', Value:manager, Label:'담당자'}
  ]},
  UI.PresentationVariant : {SortOrder:[{Property:dcCode}], Visualizations:['@UI.LineItem']},
  Capabilities : {InsertRestrictions:{Insertable:true}, UpdateRestrictions:{Updatable:true}, DeleteRestrictions:{Deletable:true}}
);
annotate service.DistributionCenters with { dcCode @title:'DC 코드'; name @title:'센터명'; city @title:'도시'; dcType @title:'유형'; capacity @title:'최대용량'; currentStock @title:'현재보관량'; manager @title:'담당자'; isActive @title:'활성'; };

// InboundOrders
annotate service.InboundOrders with @(
  UI.HeaderInfo : { TypeName: '입고오더 (IO)', TypeNamePlural: '입고오더 (IO) 목록', Title: {$Type:'UI.DataField',Value:orderNumber}, Description: {$Type:'UI.DataField',Value:status} },
  UI.SelectionFields : [ orderNumber, status, supplier_ID, dc_ID, orderDate ],
  UI.LineItem : [
    {$Type:'UI.DataField', Value:orderNumber, Label:'오더번호', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:status, Label:'상태', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:supplier.name, Label:'공급업체', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:dc.name, Label:'물류센터', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:orderDate, Label:'주문일', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:expectedDate, Label:'예정일', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:arrivedDate, Label:'도착일', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:totalAmount, Label:'합계금액', ![@HTML5.CssDefaults]:{width:'auto'}}
  ],
  UI.Facets : [
    {$Type:'UI.ReferenceFacet', ID:'BasicInfo', Label:'기본 정보', Target:'@UI.FieldGroup#BasicInfo'},
    {$Type:'UI.ReferenceFacet', ID:'Items', Label:'품목 목록', Target:'items/@UI.LineItem'}
  ],
  UI.FieldGroup #BasicInfo : {$Type:'UI.FieldGroupType', Data:[
    {$Type:'UI.DataField', Value:orderNumber, Label:'오더번호'}, {$Type:'UI.DataField', Value:status, Label:'상태'},
    {$Type:'UI.DataField', Value:supplier.supplierCode, Label:'공급업체 코드'}, {$Type:'UI.DataField', Value:supplier.name, Label:'공급업체명'},
    {$Type:'UI.DataField', Value:dc.dcCode, Label:'물류센터 코드'}, {$Type:'UI.DataField', Value:dc.name, Label:'물류센터명'},
    {$Type:'UI.DataField', Value:purchaseOrder.poNumber, Label:'발주번호 (PO)'},
    {$Type:'UI.DataField', Value:orderDate, Label:'주문일'}, {$Type:'UI.DataField', Value:expectedDate, Label:'예정일'},
    {$Type:'UI.DataField', Value:arrivedDate, Label:'도착일'}, {$Type:'UI.DataField', Value:totalAmount, Label:'합계금액'},
    {$Type:'UI.DataField', Value:requestedBy, Label:'요청자'}, {$Type:'UI.DataField', Value:note, Label:'비고'}
  ]},
  UI.PresentationVariant : {SortOrder:[{Property:orderDate, Descending:true}], Visualizations:['@UI.LineItem']},
  Capabilities : {InsertRestrictions:{Insertable:true}, UpdateRestrictions:{Updatable:true}, DeleteRestrictions:{Deletable:true}}
);
annotate service.InboundOrderItems with @(UI.LineItem:[
  {$Type:'UI.DataField', Value:product.productCode, Label:'상품코드'},
  {$Type:'UI.DataField', Value:product.name, Label:'상품명'},
  {$Type:'UI.DataField', Value:orderedQty, Label:'주문수량'},
  {$Type:'UI.DataField', Value:receivedQty, Label:'입고수량'},
  {$Type:'UI.DataField', Value:unitPrice, Label:'단가'},
  {$Type:'UI.DataField', Value:totalPrice, Label:'금액'}
]);
annotate service.InboundOrders with { orderNumber @title:'IO번호'; status @title:'상태'; orderDate @title:'주문일'; expectedDate @title:'예정일'; totalAmount @title:'합계금액'; };

// GoodsReceipts
annotate service.GoodsReceipts with @(
  UI.HeaderInfo : { TypeName: '입고검수 (GR)', TypeNamePlural: '입고검수 (GR) 목록', Title: {$Type:'UI.DataField',Value:grNumber}, Description: {$Type:'UI.DataField',Value:status} },
  UI.SelectionFields : [ grNumber, status, dc_ID, store_ID, inspectedBy ],
  UI.LineItem : [
    {$Type:'UI.DataField', Value:grNumber, Label:'GR번호', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:status, Label:'상태', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:inboundOrder.purchaseOrder.poNumber, Label:'발주번호 (PO)', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:dc.name, Label:'물류센터', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:store.name, Label:'점포', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:inboundOrder.orderNumber, Label:'입고오더 (IO)', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:totalPassedQty, Label:'합격수량', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:totalRejectedQty, Label:'불합격수량', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:inspectedBy, Label:'검수자', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:inspectedAt, Label:'검수일시', ![@HTML5.CssDefaults]:{width:'auto'}}
  ],
  UI.Facets : [
    {$Type:'UI.ReferenceFacet', ID:'BasicInfo', Label:'검수 정보', Target:'@UI.FieldGroup#BasicInfo'},
    {$Type:'UI.ReferenceFacet', ID:'Items', Label:'검수 품목', Target:'items/@UI.LineItem'}
  ],
  UI.FieldGroup #BasicInfo : {$Type:'UI.FieldGroupType', Data:[
    {$Type:'UI.DataField', Value:grNumber, Label:'GR번호'}, {$Type:'UI.DataField', Value:status, Label:'상태'},
    {$Type:'UI.DataField', Value:dc.dcCode, Label:'물류센터 코드'}, {$Type:'UI.DataField', Value:dc.name, Label:'물류센터명'},
    {$Type:'UI.DataField', Value:store.storeCode, Label:'점포 코드'}, {$Type:'UI.DataField', Value:store.name, Label:'점포명'},
    {$Type:'UI.DataField', Value:inboundOrder.orderNumber, Label:'입고오더 (IO)'},
    {$Type:'UI.DataField', Value:inboundOrder.purchaseOrder.poNumber, Label:'발주번호 (PO)'},
    {$Type:'UI.DataField', Value:inspectedBy, Label:'검수자'}, {$Type:'UI.DataField', Value:inspectedAt, Label:'검수일시'},
    {$Type:'UI.DataField', Value:totalPassedQty, Label:'합격수량'}, {$Type:'UI.DataField', Value:totalRejectedQty, Label:'불합격수량'},
    {$Type:'UI.DataField', Value:rejectReason, Label:'불합격사유'}
  ]},
  UI.PresentationVariant : {SortOrder:[{Property:inspectedAt, Descending:true}], Visualizations:['@UI.LineItem']},
  Capabilities : {InsertRestrictions:{Insertable:true}, UpdateRestrictions:{Updatable:true}, DeleteRestrictions:{Deletable:true}}
);
annotate service.GoodsReceiptItems with @(UI.LineItem:[
  {$Type:'UI.DataField', Value:product.productCode, Label:'상품코드'},
  {$Type:'UI.DataField', Value:product.name, Label:'상품명'},
  {$Type:'UI.DataField', Value:orderedQty, Label:'주문수량'},
  {$Type:'UI.DataField', Value:passedQty, Label:'합격수량'},
  {$Type:'UI.DataField', Value:rejectedQty, Label:'불합격수량'},
  {$Type:'UI.DataField', Value:inspectionNote, Label:'검수메모'}
]);
annotate service.GoodsReceipts with { grNumber @title:'GR번호'; status @title:'상태'; inspectedBy @title:'검수자'; inspectedAt @title:'검수일시'; };

// Invoices
annotate service.Invoices with @(
  UI.HeaderInfo : { TypeName: '인보이스 (IR)', TypeNamePlural: '인보이스 (IR) 목록', Title: {$Type:'UI.DataField',Value:invoiceNumber}, Description: {$Type:'UI.DataField',Value:status} },
  UI.SelectionFields : [ invoiceNumber, status, supplier_ID, invoiceDate, paymentMethod ],
  UI.LineItem : [
    {$Type:'UI.DataField', Value:invoiceNumber, Label:'인보이스번호', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:status, Label:'상태', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:supplier.name, Label:'공급업체', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:invoiceDate, Label:'발행일', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:dueDate, Label:'만기일', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:subtotal, Label:'공급가액', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:taxAmount, Label:'세액', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:totalAmount, Label:'합계', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:paymentMethod, Label:'결제방법', ![@HTML5.CssDefaults]:{width:'auto'}}
  ],
  UI.Facets : [
    {$Type:'UI.ReferenceFacet', ID:'BasicInfo', Label:'인보이스 정보', Target:'@UI.FieldGroup#BasicInfo'},
    {$Type:'UI.ReferenceFacet', ID:'Payment', Label:'결제 정보', Target:'@UI.FieldGroup#Payment'},
    {$Type:'UI.ReferenceFacet', ID:'Items', Label:'품목 목록', Target:'items/@UI.LineItem'}
  ],
  UI.FieldGroup #BasicInfo : {$Type:'UI.FieldGroupType', Data:[
    {$Type:'UI.DataField', Value:invoiceNumber, Label:'인보이스번호'}, {$Type:'UI.DataField', Value:status, Label:'상태'},
    {$Type:'UI.DataField', Value:supplier.supplierCode, Label:'공급업체 코드'}, {$Type:'UI.DataField', Value:supplier.name, Label:'공급업체명'},
    {$Type:'UI.DataField', Value:goodsReceipt.grNumber, Label:'GR번호'},
    {$Type:'UI.DataField', Value:purchaseOrder.poNumber, Label:'발주번호 (PO)'},
    {$Type:'UI.DataField', Value:invoiceDate, Label:'발행일'}, {$Type:'UI.DataField', Value:dueDate, Label:'만기일'},
    {$Type:'UI.DataField', Value:subtotal, Label:'공급가액'}, {$Type:'UI.DataField', Value:taxRate, Label:'세율(%)'},
    {$Type:'UI.DataField', Value:taxAmount, Label:'세액'}, {$Type:'UI.DataField', Value:totalAmount, Label:'합계'}
  ]},
  UI.FieldGroup #Payment : {$Type:'UI.FieldGroupType', Data:[
    {$Type:'UI.DataField', Value:paymentMethod, Label:'결제방법'}, {$Type:'UI.DataField', Value:paymentRef, Label:'결제참조'},
    {$Type:'UI.DataField', Value:paidDate, Label:'결제일'}, {$Type:'UI.DataField', Value:note, Label:'비고'}
  ]},
  UI.PresentationVariant : {SortOrder:[{Property:invoiceDate, Descending:true}], Visualizations:['@UI.LineItem']},
  Capabilities : {InsertRestrictions:{Insertable:true}, UpdateRestrictions:{Updatable:true}, DeleteRestrictions:{Deletable:true}}
);
annotate service.InvoiceItems with @(UI.LineItem:[
  {$Type:'UI.DataField', Value:product.productCode, Label:'상품코드'},
  {$Type:'UI.DataField', Value:product.name, Label:'상품명'},
  {$Type:'UI.DataField', Value:quantity, Label:'수량'},
  {$Type:'UI.DataField', Value:unitPrice, Label:'단가'},
  {$Type:'UI.DataField', Value:amount, Label:'금액'},
  {$Type:'UI.DataField', Value:taxAmount, Label:'세액'}
]);
annotate service.Invoices with { invoiceNumber @title:'IR번호'; status @title:'상태'; invoiceDate @title:'발행일'; totalAmount @title:'합계'; paymentMethod @title:'결제방법'; };

// TransferOrders
annotate service.TransferOrders with @(
  UI.HeaderInfo : { TypeName: '배송지시 (TO)', TypeNamePlural: '배송지시 (TO) 목록', Title: {$Type:'UI.DataField',Value:toNumber}, Description: {$Type:'UI.DataField',Value:status} },
  UI.SelectionFields : [ toNumber, status, dc_ID, store_ID, priority, carrier ],
  UI.LineItem : [
    {$Type:'UI.DataField', Value:toNumber, Label:'배송번호', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:status, Label:'상태', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:dc.name, Label:'물류센터', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:store.name, Label:'점포', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:priority, Label:'우선순위', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:createdDate, Label:'생성일', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:shippedDate, Label:'출하일', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:deliveredDate, Label:'배송완료일', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:totalQty, Label:'총수량', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:carrier, Label:'운송업체', ![@HTML5.CssDefaults]:{width:'auto'}}
  ],
  UI.Facets : [
    {$Type:'UI.ReferenceFacet', ID:'BasicInfo', Label:'배송 정보', Target:'@UI.FieldGroup#BasicInfo'},
    {$Type:'UI.ReferenceFacet', ID:'Items', Label:'배송 품목', Target:'items/@UI.LineItem'}
  ],
  UI.FieldGroup #BasicInfo : {$Type:'UI.FieldGroupType', Data:[
    {$Type:'UI.DataField', Value:toNumber, Label:'배송번호'}, {$Type:'UI.DataField', Value:status, Label:'상태'},
    {$Type:'UI.DataField', Value:dc.dcCode, Label:'물류센터 코드'}, {$Type:'UI.DataField', Value:dc.name, Label:'물류센터명'},
    {$Type:'UI.DataField', Value:store.storeCode, Label:'점포 코드'}, {$Type:'UI.DataField', Value:store.name, Label:'점포명'},
    {$Type:'UI.DataField', Value:priority, Label:'우선순위'}, {$Type:'UI.DataField', Value:createdDate, Label:'생성일'},
    {$Type:'UI.DataField', Value:pickedDate, Label:'피킹일'}, {$Type:'UI.DataField', Value:shippedDate, Label:'출하일'},
    {$Type:'UI.DataField', Value:deliveredDate, Label:'배송완료일'}, {$Type:'UI.DataField', Value:totalQty, Label:'총수량'},
    {$Type:'UI.DataField', Value:carrier, Label:'운송업체'}, {$Type:'UI.DataField', Value:trackingNo, Label:'운송장번호'},
    {$Type:'UI.DataField', Value:storeReceipt.srNumber, Label:'점포입고 (SR)'},
    {$Type:'UI.DataField', Value:storeReceipt.status, Label:'SR 상태'}
  ]},
  UI.PresentationVariant : {SortOrder:[{Property:createdDate, Descending:true}], Visualizations:['@UI.LineItem']},
  Capabilities : {InsertRestrictions:{Insertable:true}, UpdateRestrictions:{Updatable:true}, DeleteRestrictions:{Deletable:true}}
);
annotate service.TransferOrderItems with @(UI.LineItem:[
  {$Type:'UI.DataField', Value:product.productCode, Label:'상품코드'},
  {$Type:'UI.DataField', Value:product.name, Label:'상품명'},
  {$Type:'UI.DataField', Value:requestedQty, Label:'요청수량'},
  {$Type:'UI.DataField', Value:pickedQty, Label:'피킹수량'},
  {$Type:'UI.DataField', Value:shippedQty, Label:'출하수량'}
]);
annotate service.TransferOrders with { toNumber @title:'TO번호'; status @title:'상태'; priority @title:'우선순위'; carrier @title:'운송업체'; totalQty @title:'총수량'; };

// StoreReceipts
annotate service.StoreReceipts with @(
  UI.HeaderInfo : { TypeName: '점포입고 (SR)', TypeNamePlural: '점포입고 (SR) 목록', Title: {$Type:'UI.DataField',Value:srNumber}, Description: {$Type:'UI.DataField',Value:status} },
  UI.SelectionFields : [ srNumber, status, store_ID, receivedBy ],
  UI.LineItem : [
    {$Type:'UI.DataField', Value:srNumber, Label:'입고번호', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:status, Label:'상태', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:store.name, Label:'점포', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:transferOrder.toNumber, Label:'배송지시', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:totalReceivedQty, Label:'수령수량', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:totalDamagedQty, Label:'파손수량', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:receivedBy, Label:'수령자', ![@HTML5.CssDefaults]:{width:'auto'}},
    {$Type:'UI.DataField', Value:receivedAt, Label:'수령일시', ![@HTML5.CssDefaults]:{width:'auto'}}
  ],
  UI.Facets : [
    {$Type:'UI.ReferenceFacet', ID:'BasicInfo', Label:'입고 정보', Target:'@UI.FieldGroup#BasicInfo'},
    {$Type:'UI.ReferenceFacet', ID:'Items', Label:'입고 품목', Target:'items/@UI.LineItem'}
  ],
  UI.FieldGroup #BasicInfo : {$Type:'UI.FieldGroupType', Data:[
    {$Type:'UI.DataField', Value:srNumber, Label:'입고번호'}, {$Type:'UI.DataField', Value:status, Label:'상태'},
    {$Type:'UI.DataField', Value:store.storeCode, Label:'점포 코드'}, {$Type:'UI.DataField', Value:store.name, Label:'점포명'},
    {$Type:'UI.DataField', Value:transferOrder.toNumber, Label:'배송지시 (TO)'},
    {$Type:'UI.DataField', Value:transferOrder.dc.name, Label:'출발 물류센터'},
    {$Type:'UI.DataField', Value:transferOrder.carrier, Label:'운송업체'},
    {$Type:'UI.DataField', Value:receivedBy, Label:'수령자'}, {$Type:'UI.DataField', Value:receivedAt, Label:'수령일시'},
    {$Type:'UI.DataField', Value:totalReceivedQty, Label:'수령수량'}, {$Type:'UI.DataField', Value:totalDamagedQty, Label:'파손수량'},
    {$Type:'UI.DataField', Value:note, Label:'비고'}
  ]},
  UI.PresentationVariant : {SortOrder:[{Property:receivedAt, Descending:true}], Visualizations:['@UI.LineItem']},
  Capabilities : {InsertRestrictions:{Insertable:true}, UpdateRestrictions:{Updatable:true}, DeleteRestrictions:{Deletable:true}}
);
annotate service.StoreReceiptItems with @(UI.LineItem:[
  {$Type:'UI.DataField', Value:product.productCode, Label:'상품코드'},
  {$Type:'UI.DataField', Value:product.name, Label:'상품명'},
  {$Type:'UI.DataField', Value:expectedQty, Label:'예정수량'},
  {$Type:'UI.DataField', Value:receivedQty, Label:'수령수량'},
  {$Type:'UI.DataField', Value:damagedQty, Label:'파손수량'},
  {$Type:'UI.DataField', Value:note, Label:'비고'}
]);
annotate service.StoreReceipts with { srNumber @title:'SR번호'; status @title:'상태'; receivedBy @title:'수령자'; receivedAt @title:'수령일시'; };
