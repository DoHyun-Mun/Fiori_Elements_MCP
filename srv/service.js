/**
 * InventoryService - 커스텀 핸들러
 * 상품 재고 관리 시스템의 비즈니스 로직
 */
const cds = require('@sap/cds');
const LOG = cds.log('InventoryService');

module.exports = cds.service.impl(async function () {
  const { Categories, Products, Inventories, PurchaseOrders } = this.entities;

  // ════════════════════════════════════════════════════════════════════
  // PurchaseOrders - BEFORE CREATE: 발주 번호 자동 채번
  // ════════════════════════════════════════════════════════════════════
  this.before('CREATE', PurchaseOrders, async (req) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

    // 오늘 날짜의 마지막 채번 조회
    const result = await SELECT.one
      .from(PurchaseOrders)
      .columns('count(*) as cnt')
      .where`poNumber like ${'PO-' + dateStr + '%'}`;

    const seq = String((result?.cnt || 0) + 1).padStart(4, '0');
    req.data.poNumber = `PO-${dateStr}-${seq}`;

    // 기본 상태 설정
    if (!req.data.status) {
      req.data.status = 'Draft';
    }

    // 수량 검증
    if (!req.data.quantity || req.data.quantity < 1) {
      return req.error(400, '발주 수량은 1 이상이어야 합니다.');
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Inventories - AFTER READ: availableQty 계산
  // ════════════════════════════════════════════════════════════════════
  this.after('READ', Inventories, (data) => {
    const items = Array.isArray(data) ? data : [data];
    items.forEach(item => {
      if (item) {
        item.availableQty = (item.quantity || 0) - (item.reservedQty || 0);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Inventories - AFTER CREATE/UPDATE: 재고 부족 경고
  // ════════════════════════════════════════════════════════════════════
  this.after(['CREATE', 'UPDATE'], Inventories, async (data, req) => {
    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return;

    const availableQty = (item.quantity || 0) - (item.reservedQty || 0);

    // 상품의 안전재고 확인
    if (item.product_ID) {
      const product = await SELECT.one.from(Products).where({ ID: item.product_ID });
      if (product && product.safetyStock && availableQty < product.safetyStock) {
        req.warn(
          `재고 부족 경고: ${product.name || product.productCode} - 가용 수량(${availableQty})이 안전 재고(${product.safetyStock}) 미만입니다.`
        );
      }
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Inventories - BEFORE CREATE: 중복 재고 레코드 방지
  // ════════════════════════════════════════════════════════════════════
  this.before('CREATE', Inventories, async (req) => {
    if (req.data.product_ID && req.data.warehouse) {
      const existing = await SELECT.one.from(Inventories).where({
        product_ID: req.data.product_ID,
        warehouse:  req.data.warehouse
      });
      if (existing) {
        return req.error(400, `동일한 상품/창고 조합의 재고 레코드가 이미 존재합니다. (ID: ${existing.ID})`);
      }
    }

    // 수량 음수 검증
    if (req.data.quantity != null && req.data.quantity < 0) {
      return req.error(400, '재고 수량은 0 이상이어야 합니다.');
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Inventories - BEFORE UPDATE: 수량 음수 검증
  // ════════════════════════════════════════════════════════════════════
  this.before('UPDATE', Inventories, async (req) => {
    if (req.data.quantity != null && req.data.quantity < 0) {
      return req.error(400, '재고 수량은 0 이상이어야 합니다.');
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Action: submitOrder (Draft → Submitted)
  // ════════════════════════════════════════════════════════════════════
  this.on('submitOrder', PurchaseOrders, async (req) => {
    const { ID } = req.params[0];

    const po = await SELECT.one.from(PurchaseOrders).where({ ID });
    if (!po) return req.error(404, `발주를 찾을 수 없습니다: ${ID}`);
    if (po.status !== 'Draft') {
      return req.error(400, `승인 요청은 'Draft' 상태에서만 가능합니다. (현재: ${po.status})`);
    }

    await UPDATE(PurchaseOrders).set({ status: 'Submitted' }).where({ ID });

    const updated = await SELECT.one.from(PurchaseOrders).where({ ID });
    req.info(`발주 ${po.poNumber}이(가) 승인 요청되었습니다.`);
    return updated;
  });

  // ════════════════════════════════════════════════════════════════════
  // Action: approveOrder (Submitted → Approved)
  // ════════════════════════════════════════════════════════════════════
  this.on('approveOrder', PurchaseOrders, async (req) => {
    const { ID } = req.params[0];

    const po = await SELECT.one.from(PurchaseOrders).where({ ID });
    if (!po) return req.error(404, `발주를 찾을 수 없습니다: ${ID}`);
    if (po.status !== 'Submitted') {
      return req.error(400, `승인은 'Submitted' 상태에서만 가능합니다. (현재: ${po.status})`);
    }

    const approvedBy = req.user?.id || 'system';
    const approvedAt = new Date().toISOString();

    await UPDATE(PurchaseOrders).set({
      status: 'Approved',
      approvedBy,
      approvedAt
    }).where({ ID });

    const updated = await SELECT.one.from(PurchaseOrders).where({ ID });
    req.info(`발주 ${po.poNumber}이(가) 승인되었습니다.`);
    return updated;
  });

  // ════════════════════════════════════════════════════════════════════
  // Action: rejectOrder (Submitted → Rejected)
  // ════════════════════════════════════════════════════════════════════
  this.on('rejectOrder', PurchaseOrders, async (req) => {
    const { ID } = req.params[0];
    const { reason } = req.data || {};

    const po = await SELECT.one.from(PurchaseOrders).where({ ID });
    if (!po) return req.error(404, `발주를 찾을 수 없습니다: ${ID}`);
    if (po.status !== 'Submitted') {
      return req.error(400, `반려는 'Submitted' 상태에서만 가능합니다. (현재: ${po.status})`);
    }

    const approvedBy = req.user?.id || 'system';
    const approvedAt = new Date().toISOString();
    const note = reason ? `반려 사유: ${reason}` : (po.note || '');

    await UPDATE(PurchaseOrders).set({
      status: 'Rejected',
      approvedBy,
      approvedAt,
      note
    }).where({ ID });

    const updated = await SELECT.one.from(PurchaseOrders).where({ ID });
    req.info(`발주 ${po.poNumber}이(가) 반려되었습니다.`);
    return updated;
  });

  // ════════════════════════════════════════════════════════════════════
  // Action: receiveOrder (Approved → Received, 재고 반영)
  // ════════════════════════════════════════════════════════════════════
  this.on('receiveOrder', PurchaseOrders, async (req) => {
    const { ID } = req.params[0];
    const { warehouse } = req.data || {};

    const po = await SELECT.one.from(PurchaseOrders).where({ ID });
    if (!po) return req.error(404, `발주를 찾을 수 없습니다: ${ID}`);
    if (po.status !== 'Approved') {
      return req.error(400, `입고 처리는 'Approved' 상태에서만 가능합니다. (현재: ${po.status})`);
    }

    const targetWarehouse = warehouse || 'WH-DEFAULT';
    const now = new Date().toISOString();

    // 발주 상태 업데이트
    await UPDATE(PurchaseOrders).set({
      status:       'Received',
      receivedDate: now.split('T')[0]
    }).where({ ID });

    // 재고 반영: 해당 product + warehouse 재고 조회
    const inventory = await SELECT.one.from(Inventories).where({
      product_ID: po.product_ID,
      warehouse:  targetWarehouse
    });

    if (inventory) {
      // 기존 재고 업데이트
      await UPDATE(Inventories).set({
        quantity:    inventory.quantity + po.quantity,
        lastUpdated: now
      }).where({ ID: inventory.ID });

      LOG.info(`재고 업데이트: ${targetWarehouse} +${po.quantity} (총: ${inventory.quantity + po.quantity})`);
    } else {
      // 신규 재고 레코드 생성
      const newId = cds.utils.uuid();
      await INSERT.into(Inventories).entries({
        ID:          newId,
        product_ID:  po.product_ID,
        warehouse:   targetWarehouse,
        quantity:    po.quantity,
        reservedQty: 0,
        availableQty: po.quantity,
        lastUpdated: now
      });

      LOG.info(`신규 재고 생성: ${targetWarehouse} 수량 ${po.quantity}`);
    }

    // 재고 부족 경고 체크
    const product = await SELECT.one.from(Products).where({ ID: po.product_ID });
    if (product) {
      const inv = await SELECT.one.from(Inventories).where({
        product_ID: po.product_ID,
        warehouse:  targetWarehouse
      });
      if (inv) {
        const avail = (inv.quantity || 0) - (inv.reservedQty || 0);
        if (product.safetyStock && avail < product.safetyStock) {
          req.warn(`재고 부족 경고: 가용 수량(${avail})이 안전 재고(${product.safetyStock}) 미만입니다.`);
        }
      }
    }

    const updated = await SELECT.one.from(PurchaseOrders).where({ ID });
    req.info(`발주 ${po.poNumber} 입고 처리 완료. 창고: ${targetWarehouse}, 수량: ${po.quantity}`);
    return updated;
  });

  // ════════════════════════════════════════════════════════════════════
  // Products - AFTER READ: 추가 가공 없음 (향후 확장 가능)
  // ════════════════════════════════════════════════════════════════════
  this.after('READ', Products, (data) => {
    // Placeholder for future enhancements
  });

  // ════════════════════════════════════════════════════════════════════
  // PurchaseOrders - BEFORE UPDATE: 상태 전이 규칙 강제
  // ════════════════════════════════════════════════════════════════════
  this.before('UPDATE', PurchaseOrders, async (req) => {
    // 상태를 직접 수정하는 것을 방지 (Action을 통해서만 변경 가능)
    if (req.data.status) {
      const existing = await SELECT.one.from(PurchaseOrders).where({ ID: req.data.ID });
      if (existing && req.data.status !== existing.status) {
        return req.error(400, '상태는 직접 변경할 수 없습니다. 승인 요청/승인/반려/입고 처리 버튼을 사용하세요.');
      }
    }
  });
});