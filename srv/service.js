/**
 * InventoryService - 커스텀 핸들러
 * 점포 상품별 재고 발주 관리 시스템 비즈니스 로직
 */
const cds = require('@sap/cds');
const LOG = cds.log('InventoryService');

module.exports = cds.service.impl(async function () {
  const {
    Categories, Products, Inventories, PurchaseOrders, Stores,
    Suppliers, Materials, StoreProducts, ProductMaterials,
    
    Customers, CustomerPurchases, CustomerPurchaseItems,
    DailySales, InventorySnapshots, DemandForecasts, OrderRecommendations
  } = this.entities;

  // ════════════════════════════════════════════════════════════════════
  // PurchaseOrders - BEFORE CREATE: 발주 번호 자동 채번 + totalAmount 계산
  // ════════════════════════════════════════════════════════════════════
  this.before('CREATE', PurchaseOrders, async (req) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

    const result = await SELECT.one
      .from(PurchaseOrders)
      .columns('count(*) as cnt')
      .where`poNumber like ${'PO-' + dateStr + '%'}`;

    const seq = String((result?.cnt || 0) + 1).padStart(4, '0');
    req.data.poNumber = `PO-${dateStr}-${seq}`;

    if (!req.data.status) req.data.status = 'Draft';
    if (!req.data.quantity || req.data.quantity < 1) {
      return req.error(400, '발주 수량은 1 이상이어야 합니다.');
    }
    // totalAmount 자동 계산
    if (req.data.unitPrice && req.data.quantity) {
      req.data.totalAmount = req.data.unitPrice * req.data.quantity;
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // PurchaseOrders - BEFORE UPDATE: 상태 직접 변경 방지 + totalAmount 재계산
  // ════════════════════════════════════════════════════════════════════
  this.before('UPDATE', PurchaseOrders, async (req) => {
    if (req.data.status) {
      const existing = await SELECT.one.from(PurchaseOrders).where({ ID: req.data.ID });
      if (existing && req.data.status !== existing.status) {
        return req.error(400, '상태는 직접 변경할 수 없습니다. 승인 요청/승인/반려/입고 처리 버튼을 사용하세요.');
      }
    }
    // totalAmount 재계산
    if (req.data.unitPrice != null || req.data.quantity != null) {
      const existing = await SELECT.one.from(PurchaseOrders).where({ ID: req.data.ID });
      if (existing) {
        const qty = req.data.quantity ?? existing.quantity;
        const price = req.data.unitPrice ?? existing.unitPrice;
        req.data.totalAmount = (price || 0) * (qty || 0);
      }
    }
  });

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
  // Inventories - BEFORE CREATE: 중복 재고 레코드 방지 (product + store + warehouse)
  // ════════════════════════════════════════════════════════════════════
  this.before('CREATE', Inventories, async (req) => {
    if (req.data.product_ID && req.data.warehouse) {
      const where = {
        product_ID: req.data.product_ID,
        warehouse: req.data.warehouse
      };
      if (req.data.store_ID) where.store_ID = req.data.store_ID;

      const existing = await SELECT.one.from(Inventories).where(where);
      if (existing) {
        return req.error(400, `동일한 상품/점포/창고 조합의 재고 레코드가 이미 존재합니다. (ID: ${existing.ID})`);
      }
    }
    if (req.data.quantity != null && req.data.quantity < 0) {
      return req.error(400, '재고 수량은 0 이상이어야 합니다.');
    }
    // availableQty 자동 계산
    const qty = req.data.quantity ?? 0;
    const reserved = req.data.reservedQty ?? 0;
    req.data.availableQty = qty - reserved;
  });

  this.before('UPDATE', Inventories, async (req) => {
    if (req.data.quantity != null && req.data.quantity < 0) {
      return req.error(400, '재고 수량은 0 이상이어야 합니다.');
    }
    // availableQty 자동 계산
    if (req.data.quantity != null || req.data.reservedQty != null) {
      const existing = await SELECT.one.from(Inventories).where({ ID: req.data.ID });
      if (existing) {
        const qty = req.data.quantity ?? existing.quantity ?? 0;
        const reserved = req.data.reservedQty ?? existing.reservedQty ?? 0;
        req.data.availableQty = qty - reserved;
      }
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
    await UPDATE(PurchaseOrders).set({
      status: 'Approved',
      approvedBy: req.user?.id || 'system',
      approvedAt: new Date().toISOString()
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
    await UPDATE(PurchaseOrders).set({
      status: 'Rejected',
      approvedBy: req.user?.id || 'system',
      approvedAt: new Date().toISOString(),
      note: reason ? `반려 사유: ${reason}` : (po.note || '')
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

    await UPDATE(PurchaseOrders).set({
      status: 'Received',
      receivedDate: now.split('T')[0]
    }).where({ ID });

    // 재고 반영: product + store + warehouse
    const invWhere = { product_ID: po.product_ID, warehouse: targetWarehouse };
    if (po.store_ID) invWhere.store_ID = po.store_ID;

    const inventory = await SELECT.one.from(Inventories).where(invWhere);

    if (inventory) {
      await UPDATE(Inventories).set({
        quantity: inventory.quantity + po.quantity,
        lastUpdated: now
      }).where({ ID: inventory.ID });
      LOG.info(`재고 업데이트: ${targetWarehouse} +${po.quantity} (총: ${inventory.quantity + po.quantity})`);
    } else {
      await INSERT.into(Inventories).entries({
        ID: cds.utils.uuid(),
        product_ID: po.product_ID,
        store_ID: po.store_ID || null,
        warehouse: targetWarehouse,
        quantity: po.quantity,
        reservedQty: 0,
        availableQty: po.quantity,
        lastUpdated: now
      });
      LOG.info(`신규 재고 생성: ${targetWarehouse} 수량 ${po.quantity}`);
    }

    const updated = await SELECT.one.from(PurchaseOrders).where({ ID });
    req.info(`발주 ${po.poNumber} 입고 처리 완료. 창고: ${targetWarehouse}, 수량: ${po.quantity}`);
    return updated;
  });


  // ════════════════════════════════════════════════════════════════════
  // AI 대시보드 Function Imports
  // ════════════════════════════════════════════════════════════════════

  /**
   * getDashboardKPIs - 동적 KPI (매출, 재고건전성, 결품위험, 발주대기)
   */
  this.on('getDashboardKPIs', async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // 매출: 오늘 데이터가 없으면 가장 최근 날짜 기준으로 표시
    let todayRevenue = 0, yesterdayRevenue = 0, revenueLabel = '오늘';
    const todaySales = await SELECT.from('com.inventory.DailySales').where({ salesDate: today });
    todayRevenue = todaySales.reduce((sum, r) => sum + (parseFloat(r.revenue) || 0), 0);

    if (todayRevenue === 0) {
      // 오늘 데이터 없으면 → 가장 최근 날짜 매출 사용
      const recent = await SELECT.from('com.inventory.DailySales').orderBy({ salesDate: 'desc' }).limit(700);
      if (recent.length > 0) {
        const latestDate = recent[0].salesDate;
        const prevDate = new Date(new Date(latestDate).getTime() - 86400000).toISOString().split('T')[0];
        todayRevenue = recent.filter(r => r.salesDate === latestDate).reduce((sum, r) => sum + (parseFloat(r.revenue) || 0), 0);
        yesterdayRevenue = recent.filter(r => r.salesDate === prevDate).reduce((sum, r) => sum + (parseFloat(r.revenue) || 0), 0);
        revenueLabel = latestDate.slice(5); // "04-29" 형태
      }
    } else {
      const yesterdaySales = await SELECT.from('com.inventory.DailySales').where({ salesDate: yesterday });
      yesterdayRevenue = yesterdaySales.reduce((sum, r) => sum + (parseFloat(r.revenue) || 0), 0);
    }
    const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : 0;

    // 재고 건전성 점수 (가용재고/최소재고 비율 평균 → 100점 만점)
    const inventories = await SELECT.from('com.inventory.Inventories');
    let healthSum = 0, healthCount = 0;
    let stockoutRisk = 0;
    inventories.forEach(inv => {
      const avail = inv.quantity - (inv.reservedQty || 0);
      const minS = inv.minStock || 1;
      const ratio = avail / minS;
      if (ratio < 0.5) stockoutRisk++;
      healthSum += Math.min(ratio, 2.0); // 캡 2.0
      healthCount++;
    });
    const healthScore = healthCount > 0 ? Math.round((healthSum / healthCount) * 50) : 85;

    // 발주 대기 (Submitted 상태)
    const pendingResult = await SELECT.from('com.inventory.PurchaseOrders').where({ status: 'Submitted' });
    const pendingOrders = pendingResult.length;

    return {
      todayRevenue: todayRevenue,
      revenueChange: Math.round(revenueChange * 10) / 10,
      healthScore: Math.min(100, healthScore),
      healthChange: -3, // 전일 대비 변화 (시뮬레이션)
      stockoutRisk: stockoutRisk,
      pendingOrders: pendingOrders
    };
  });

  /**
   * getAIInsights - AI 인사이트 카드 (최대 5개)
   */
  this.on('getAIInsights', async () => {
    const insights = [];

    // 1. 결품 임박 (OrderRecommendations HIGH)
    const highRecs = await SELECT.from('com.inventory.OrderRecommendations')
      .where({ priority: 'HIGH', status: 'Pending' })
      .limit(3);

    for (const rec of highRecs) {
      const store = await SELECT.one.from('com.inventory.Stores').where({ ID: rec.store_ID });
      const product = await SELECT.one.from('com.inventory.Products').where({ ID: rec.product_ID });
      if (store && product) {
        insights.push({
          type: 'STOCKOUT',
          severity: 'HIGH',
          title: `${store.name} '${product.name}' 결품 임박`,
          description: `현재고 ${rec.currentStock}개, 7일 예측수요 ${Math.round(rec.forecastDemand)}개`,
          metric1Label: '현재고',
          metric1Value: `${rec.currentStock}개`,
          metric2Label: '예측수요(7일)',
          metric2Value: `${Math.round(rec.forecastDemand)}개`,
          actionLabel: '즉시 발주 추천 보기',
          actionUrl: '/orderrecommendations/webapp/index.html',
          store: store.name,
          product: product.name
        });
      }
    }

    // 2. 매출 이상 탐지 (SalesAnomalies HIGH)
    const highAnomalies = await SELECT.from('com.inventory.SalesAnomalies')
      .where({ severity: 'HIGH' })
      .orderBy({ detectedAt: 'desc' })
      .limit(2);

    for (const anom of highAnomalies) {
      const store = await SELECT.one.from('com.inventory.Stores').where({ ID: anom.store_ID });
      const product = await SELECT.one.from('com.inventory.Products').where({ ID: anom.product_ID });
      if (store && product) {
        const isSpike = anom.anomalyType === 'SPIKE';
        insights.push({
          type: isSpike ? 'OPPORTUNITY' : 'ALERT',
          severity: isSpike ? 'MEDIUM' : 'HIGH',
          title: isSpike
            ? `${store.name} ${anom.metricName} 급증 감지 (+${Math.round(Math.abs(anom.deviation))})`
            : `${store.name} ${anom.metricName} 급락 감지 (${Math.round(anom.deviation)})`,
          description: `실제: ${Math.round(anom.actualValue)} / 예측: ${Math.round(anom.expectedValue)} (Z-Score: ${parseFloat(anom.zScore).toFixed(1)})`,
          metric1Label: '실제값',
          metric1Value: String(Math.round(anom.actualValue)),
          metric2Label: 'Z-Score',
          metric2Value: parseFloat(anom.zScore).toFixed(1),
          actionLabel: '상세 분석 보기',
          actionUrl: '/salesanomalies/webapp/index.html',
          store: store.name,
          product: product.name
        });
      }
    }

    // 3. 발주 추천 요약
    const pendingRecs = await SELECT.from('com.inventory.OrderRecommendations')
      .where({ status: 'Pending' });
    if (pendingRecs.length > 0) {
      const totalQty = pendingRecs.reduce((s, r) => s + (r.recommendedQty || 0), 0);
      insights.push({
        type: 'RECOMMEND',
        severity: 'LOW',
        title: `AI 발주 추천 ${pendingRecs.length}건 대기 중`,
        description: `총 추천 수량: ${totalQty}개, HIGH ${pendingRecs.filter(r=>r.priority==='HIGH').length}건 포함`,
        metric1Label: '추천 건수',
        metric1Value: `${pendingRecs.length}건`,
        metric2Label: '총 수량',
        metric2Value: `${totalQty}개`,
        actionLabel: '발주 추천 검토',
        actionUrl: '/orderrecommendations/webapp/index.html',
        store: '전체',
        product: '복수 상품'
      });
    }

    // 우선순위 정렬: HIGH > MEDIUM > LOW
    const sevOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    insights.sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9));

    return insights.slice(0, 5);
  });

  /**
   * getStoreHealthScores - 점포별 건전성 점수
   */
  this.on('getStoreHealthScores', async () => {
    const stores = await SELECT.from('com.inventory.Stores').where({ isActive: true, storeType: 'Store' });
    const inventories = await SELECT.from('com.inventory.Inventories');

    // 점포별 재고 집계
    const storeInvMap = {};
    inventories.forEach(inv => {
      const sid = inv.store_ID;
      if (!sid) return;
      if (!storeInvMap[sid]) storeInvMap[sid] = { items: 0, stockoutRisk: 0, healthSum: 0 };
      storeInvMap[sid].items++;
      const avail = (inv.quantity || 0) - (inv.reservedQty || 0);
      const minS = inv.minStock || 1;
      const ratio = avail / minS;
      if (ratio < 0.5) storeInvMap[sid].stockoutRisk++;
      storeInvMap[sid].healthSum += Math.min(ratio, 2.0);
    });

    return stores.map(store => {
      const inv = storeInvMap[store.ID] || { items: 0, stockoutRisk: 0, healthSum: 0 };
      const score = inv.items > 0 ? Math.min(100, Math.round((inv.healthSum / inv.items) * 50)) : 85;
      let status = 'GREEN';
      if (score < 60) status = 'RED';
      else if (score < 80) status = 'YELLOW';

      return {
        storeId: store.ID,
        storeName: store.name,
        city: store.city || '',
        score: score,
        status: status,
        stockoutCount: inv.stockoutRisk,
        totalProducts: inv.items
      };
    }).sort((a, b) => a.score - b.score); // 점수 낮은 순 (위험한 것 먼저)
  });

  /**
   * getSalesForecastTrend - 매출 실적 + AI 예측 결합
   */
  this.on('getSalesForecastTrend', async () => {
    const result = [];

    // 지난 7일 실적 (기존 5개 상품만 필터 - DemandForecasts와 동일 상품)
    const forecastProducts = [
      'b1000001-0001-4000-8000-000000000001',
      'b1000001-0002-4000-8000-000000000002',
      'b1000001-0003-4000-8000-000000000003',
      'b1000001-0004-4000-8000-000000000004',
      'b1000001-0005-4000-8000-000000000005'
    ];
    const sales = await SELECT.from('com.inventory.DailySales')
      .where({ product_ID: { in: forecastProducts } })
      .orderBy({ salesDate: 'desc' })
      .limit(175); // 5점포 × 5상품 × 7일

    const salesByDate = {};
    sales.forEach(s => {
      if (!salesByDate[s.salesDate]) salesByDate[s.salesDate] = 0;
      salesByDate[s.salesDate] += parseFloat(s.revenue) || 0;
    });

    const actualDates = Object.keys(salesByDate).sort().slice(-7);
    actualDates.forEach(d => {
      result.push({
        date: d,
        actual: salesByDate[d],
        forecast: null,
        confidenceLow: null,
        confidenceHigh: null
      });
    });

    // 향후 7일 예측
    const forecasts = await SELECT.from('com.inventory.DemandForecasts')
      .orderBy({ forecastDate: 'asc' });

    const forecastByDate = {};
    forecasts.forEach(f => {
      if (!forecastByDate[f.forecastDate]) {
        forecastByDate[f.forecastDate] = { qty: 0, lo: 0, hi: 0 };
      }
      // forecastQty를 매출로 환산 (평균 단가 20000원 가정)
      forecastByDate[f.forecastDate].qty += (parseFloat(f.forecastQty) || 0) * 20000;
      forecastByDate[f.forecastDate].lo += (parseFloat(f.confidenceLow) || 0) * 20000;
      forecastByDate[f.forecastDate].hi += (parseFloat(f.confidenceHigh) || 0) * 20000;
    });

    const forecastDates = Object.keys(forecastByDate).sort().slice(0, 7);
    forecastDates.forEach(d => {
      result.push({
        date: d,
        actual: null,
        forecast: forecastByDate[d].qty,
        confidenceLow: forecastByDate[d].lo,
        confidenceHigh: forecastByDate[d].hi
      });
    });

    return result;
  });

  // ════════════════════════════════════════════════════════════════════
  // Products - 안전재고 등 수정 안내
  // ════════════════════════════════════════════════════════════════════
  this.on('error', (err, req) => {
    if (err.code === '501' && err.message?.includes('bypass_draft')) {
      err.message = '이 필드는 상품 관리 화면에서 편집(Edit) 버튼을 눌러 수정해주세요.';
      err.code = 400;
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Products - BEFORE CREATE/UPDATE: 마진율 기반 판매가 자동 계산
  // ════════════════════════════════════════════════════════════════════
  this.before(['CREATE', 'UPDATE'], Products, async (req) => {
    const d = req.data;
    // costPrice 또는 marginRate가 변경되면 sellingPrice 자동 계산
    if (d.costPrice != null || d.marginRate != null) {
      let costPrice = d.costPrice;
      let marginRate = d.marginRate;

      // UPDATE 시 기존 값 보완
      if (costPrice == null || marginRate == null) {
        const existing = await SELECT.one.from(Products).where({ ID: d.ID });
        if (existing) {
          if (costPrice == null) costPrice = existing.costPrice;
          if (marginRate == null) marginRate = existing.marginRate;
        }
      }

      costPrice = Number(costPrice) || 0;
      marginRate = Number(marginRate) || 0;

      // 판매가 = 원가 × (1 + 마진율/100), 소수점 이하 반올림
      req.data.sellingPrice = Math.round(costPrice * (1 + marginRate / 100));
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Products - AFTER READ: placeholder
  // ════════════════════════════════════════════════════════════════════
  this.after('READ', Products, (data) => {
    // Placeholder for future enhancements
  });

  // ════════════════════════════════════════════════════════════════════
  // CustomerPurchases - BEFORE CREATE: 구매 번호 자동 채번 + totalAmount 계산
  // ════════════════════════════════════════════════════════════════════
  this.before('CREATE', CustomerPurchases, async (req) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

    const result = await SELECT.one
      .from(CustomerPurchases)
      .columns('count(*) as cnt')
      .where`purchaseNumber like ${'CP-' + dateStr + '%'}`;

    const seq = String((result?.cnt || 0) + 1).padStart(4, '0');
    req.data.purchaseNumber = `CP-${dateStr}-${seq}`;

    if (!req.data.purchaseDate) {
      req.data.purchaseDate = new Date().toISOString();
    }

    // items totalPrice & totalAmount 자동 계산
    if (req.data.items && req.data.items.length > 0) {
      let total = 0;
      for (const item of req.data.items) {
        item.totalPrice = (item.unitPrice || 0) * (item.quantity || 1) - (item.discount || 0);
        total += item.totalPrice;
      }
      req.data.totalAmount = total;
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // CustomerPurchases - AFTER CREATE: 고객 통계 업데이트
  // ════════════════════════════════════════════════════════════════════
  this.after('CREATE', CustomerPurchases, async (data, req) => {
    if (data.customer_ID) {
      try {
        const customer = await SELECT.one.from(Customers).where({ ID: data.customer_ID });
        if (customer) {
          await UPDATE(Customers).where({ ID: data.customer_ID }).set({
            totalPurchaseAmount: (customer.totalPurchaseAmount || 0) + (data.totalAmount || 0),
            visitCount: (customer.visitCount || 0) + 1,
            lastVisitDate: new Date().toISOString().split('T')[0]
          });
        }
      } catch (e) {
        LOG.error('고객 통계 업데이트 실패:', e.message);
      }
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Customers - BEFORE CREATE: 고객 번호 자동 채번
  // ════════════════════════════════════════════════════════════════════
  this.before('CREATE', Customers, async (req) => {
    if (!req.data.customerCode) {
      const result = await SELECT.one
        .from(Customers)
        .columns('count(*) as cnt');
      const seq = String((result?.cnt || 0) + 1).padStart(5, '0');
      req.data.customerCode = `CUST-${seq}`;
    }
    if (!req.data.registeredAt) {
      req.data.registeredAt = new Date().toISOString().split('T')[0];
    }
  });
});
