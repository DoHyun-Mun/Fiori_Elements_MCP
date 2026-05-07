/* ═══════════════════════════════════════════════════════════════
 * Supply Chain Graph - 위험 경로 강조 네트워크
 * ═══════════════════════════════════════════════════════════════ */
var scNetwork = null;
var scRiskOnly = true;

// 메인 진입점
async function loadSupplyChainGraph(riskOnly) {
    if (riskOnly !== undefined) scRiskOnly = riskOnly;
    await loadSupplyChainNetwork();
}

// 상품 드롭다운 로드
async function loadProductDropdown() {
    try {
        var res = await fetch("/inventory/Products?$top=50&$select=ID,name&$filter=isActive eq true&$orderby=name asc");
        if (!res.ok) return;
        var data = await res.json();
        scProductsCache = data.value || [];
        var sel = document.getElementById('scProductSelect');
        sel.innerHTML = '<option value="">-- 상품 선택 --</option>' +
            scProductsCache.map(function(p) { return '<option value="'+p.ID+'">'+p.name+'</option>'; }).join('');
    } catch(e) { console.warn("상품 드롭다운 로드 실패:", e); }
}

// 옵션 전환
function switchSupplyChainOption(option) {
    scCurrentOption = option;
    document.getElementById('scBtnN').classList.toggle('active', option === 'N');
    document.getElementById('scBtnA').classList.toggle('active', option === 'A');
    document.getElementById('scBtnB').classList.toggle('active', option === 'B');
    var sel = document.getElementById('scProductSelect');
    var legend = document.getElementById('scLegend');

    // 두 드롭다운 모두 숨기기
    document.getElementById('scStoreSelect').style.display = 'none';

    if (option === 'N') {
        sel.style.display = 'none';
        legend.innerHTML = '<span class="sc-legend-item"><span class="sc-legend-dot" style="background:#7C4DFF;"></span> 공급업체</span><span class="sc-legend-item"><span class="sc-legend-dot" style="background:#43A047;"></span> 정상</span><span class="sc-legend-item"><span class="sc-legend-dot" style="background:#FFC107;"></span> 주의</span><span class="sc-legend-item"><span class="sc-legend-dot" style="background:#D93025;"></span> 부족</span><span class="sc-legend-item"><span class="sc-legend-dot" style="background:#1976D2;"></span> 점포</span>';
        loadSupplyChainNetwork();
    } else if (option === 'A') {
        sel.style.display = '';
        legend.innerHTML = '<span class="sc-legend-item"><span class="sc-legend-dot" style="background:#7C4DFF;"></span> 공급업체</span><span class="sc-legend-item"><span class="sc-legend-dot" style="background:#FFC107;"></span> 자재</span><span class="sc-legend-item"><span class="sc-legend-dot" style="background:#1976D2;"></span> 상품</span><span class="sc-legend-item"><span class="sc-legend-dot" style="background:#43A047;"></span> 점포</span>';
        var productId = sel.value;
        if (productId) loadSupplyChainOptionA(productId);
        else if (scProductsCache.length > 0) { sel.value = scProductsCache[0].ID; loadSupplyChainOptionA(scProductsCache[0].ID); }
    } else {
        sel.style.display = 'none';
        document.getElementById('scStoreSelect').style.display = '';
        legend.innerHTML = '<span class="sc-legend-item"><span class="sc-legend-dot" style="background:#43A047;"></span> 정상(>100%)</span><span class="sc-legend-item"><span class="sc-legend-dot" style="background:#FFC107;"></span> 주의(50~100%)</span><span class="sc-legend-item"><span class="sc-legend-dot" style="background:#D93025;"></span> 부족(<50%)</span>';
        loadStoreDropdown();
        var storeId = document.getElementById('scStoreSelect').value;
        if (storeId) loadSupplyChainOptionB(storeId);
    }
}

// ═══ 네트워크: 공급업체 → 상품(재고상태) → 점포 ═══
async function loadSupplyChainNetwork() {
    var container = document.getElementById("supplyChainGraph");
    if (!container) return;
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-tertiary);font-size:0.8rem;">로딩중...</div>';
    try {
        var [supRes, matRes, prodRes, storeRes, pmRes, spRes, invRes] = await Promise.all([
            fetch("/inventory/Suppliers?$top=50&$select=ID,name&$filter=isActive eq true"),
            fetch("/inventory/Materials?$top=50&$select=ID,supplier_ID&$filter=isActive eq true"),
            fetch("/inventory/Products?$top=50&$select=ID,name&$filter=isActive eq true"),
            fetch("/inventory/Stores?$top=30&$select=ID,name&$filter=isActive eq true"),
            fetch("/inventory/ProductMaterials?$top=200&$select=product_ID,material_ID"),
            fetch("/inventory/StoreProducts?$top=500&$select=store_ID,product_ID&$filter=isActive eq true"),
            fetch("/inventory/Inventories?$top=500&$select=product_ID,quantity,availableQty,minStock")
        ]);
        var suppliers = (await supRes.json()).value || [];
        var materials = (await matRes.json()).value || [];
        var products = (await prodRes.json()).value || [];
        var stores = (await storeRes.json()).value || [];
        var prodMats = (await pmRes.json()).value || [];
        var storePrds = (await spRes.json()).value || [];
        var inventories = (await invRes.json()).value || [];

        // 상품별 재고 상태 집계 (전체 점포 합산)
        var productStock = {}; // product_ID → { totalQty, totalMin }
        inventories.forEach(function(inv) {
            if (!productStock[inv.product_ID]) productStock[inv.product_ID] = { qty: 0, min: 0 };
            productStock[inv.product_ID].qty += (inv.availableQty || inv.quantity || 0);
            productStock[inv.product_ID].min += (inv.minStock || 0);
        });

        function getProductColor(pId) {
            var s = productStock[pId];
            if (!s || s.qty <= 0) return {background:"#FFCDD2",border:"#D93025"}; // 부족
            if (s.min > 0 && s.qty <= s.min * 0.5) return {background:"#FFCDD2",border:"#D93025"}; // 부족
            if (s.min > 0 && s.qty <= s.min) return {background:"#FFF9C4",border:"#FFC107"}; // 주의
            return {background:"#C8E6C9",border:"#43A047"}; // 정상
        }

        // 자재→공급업체 매핑
        var matToSupplier = {};
        materials.forEach(function(m) { if (m.supplier_ID) matToSupplier[m.ID] = m.supplier_ID; });

        // 상품→공급업체 매핑 (자재를 통해)
        var productSuppliers = {};
        prodMats.forEach(function(pm) {
            var supId = matToSupplier[pm.material_ID];
            if (supId) {
                if (!productSuppliers[pm.product_ID]) productSuppliers[pm.product_ID] = new Set();
                productSuppliers[pm.product_ID].add(supId);
            }
        });

        var nodes = [], edges = [], nodeIds = new Set();

        // 상품 노드 먼저 필터링 (위험 경로만 모드)
        var prodMap = {};
        products.forEach(function(p) { prodMap[p.ID] = p; });
        var connectedProducts = new Set();
        var riskProducts = new Set(); // 부족/주의 상품

        Object.keys(productSuppliers).forEach(function(pId) {
            if (prodMap[pId]) {
                var stockColor = getProductColor(pId);
                var stockInfo = productStock[pId];
                var isRisk = stockColor.border === "#D93025" || stockColor.border === "#FFC107";
                if (isRisk) riskProducts.add(pId);

                // 위험 경로만 모드일 때, 정상 상품은 스킵
                if (scRiskOnly && !isRisk) return;

                var label = prodMap[pId].name;
                if (stockInfo) label += "\n(" + stockInfo.qty + ")";
                nodes.push({id:"P_"+pId, label:label, group:"product", shape:"box", color:stockColor, font:{color:"#333",size:10,multi:true}, margin:7, title: prodMap[pId].name + (stockInfo ? " | 재고:"+stockInfo.qty+" | 기준:"+stockInfo.min : "")});
                nodeIds.add("P_"+pId);
                connectedProducts.add(pId);
            }
        });

        // 공급업체 노드 (위험 경로만 모드: 관련 공급업체만)
        var connectedSuppliers = new Set();
        if (scRiskOnly) {
            connectedProducts.forEach(function(pId) {
                if (productSuppliers[pId]) productSuppliers[pId].forEach(function(sId) { connectedSuppliers.add(sId); });
            });
        }
        suppliers.forEach(function(s) {
            if (scRiskOnly && !connectedSuppliers.has(s.ID)) return;
            nodes.push({id:"S_"+s.ID, label:"🟣 "+s.name, group:"supplier", shape:"box", color:{background:"#EDE7F6",border:"#7C4DFF"}, font:{color:"#4A148C",size:11,multi:true}, margin:8});
            nodeIds.add("S_"+s.ID);
        });

        // 점포 노드 (위험 경로만 모드: 관련 점포만)
        var connectedStoreIds = new Set();
        if (scRiskOnly) {
            storePrds.forEach(function(sp) {
                if (connectedProducts.has(sp.product_ID)) connectedStoreIds.add(sp.store_ID);
            });
        }
        stores.forEach(function(st) {
            if (scRiskOnly && !connectedStoreIds.has(st.ID)) return;
            nodes.push({id:"T_"+st.ID, label:"🏪 "+st.name, group:"store", shape:"box", color:{background:"#E3F2FD",border:"#1976D2"}, font:{color:"#1565C0",size:11,multi:true}, margin:8});
            nodeIds.add("T_"+st.ID);
        });

        // 엣지: 공급업체 → 상품
        var supProdEdgeSet = new Set();
        Object.keys(productSuppliers).forEach(function(pId) {
            productSuppliers[pId].forEach(function(sId) {
                var key = sId+"|"+pId;
                if (supProdEdgeSet.has(key)) return;
                supProdEdgeSet.add(key);
                if (nodeIds.has("S_"+sId) && nodeIds.has("P_"+pId)) {
                    edges.push({from:"S_"+sId, to:"P_"+pId, color:{color:"#CE93D8"}, arrows:"to", width:2});
                }
            });
        });

        // 엣지: 상품 → 점포
        var spEdgeSet = new Set();
        storePrds.forEach(function(sp) {
            var key = sp.product_ID+"|"+sp.store_ID;
            if (spEdgeSet.has(key)) return;
            spEdgeSet.add(key);
            if (connectedProducts.has(sp.product_ID) && nodeIds.has("T_"+sp.store_ID)) {
                edges.push({from:"P_"+sp.product_ID, to:"T_"+sp.store_ID, color:{color:"#90CAF9"}, arrows:"to", width:1.5});
            }
        });

        container.innerHTML = '';
        if (scNetwork) { scNetwork.destroy(); scNetwork = null; }
        var data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
        var options = { physics:{solver:"forceAtlas2Based",forceAtlas2Based:{gravitationalConstant:-80,centralGravity:0.01,springLength:180,springConstant:0.02},stabilization:{iterations:120}}, interaction:{hover:true,tooltipDelay:200}, layout:{improvedLayout:true} };
        scNetwork = new vis.Network(container, data, options);
        scNetwork.once("stabilizationIterationsDone", function() { scNetwork.moveTo({scale:0.55}); });
    } catch(e) { console.warn("네트워크 로드 실패:", e); }
}

// ═══ 상품공급: 특정 상품 중심 트리 ═══
async function loadSupplyChainOptionA(productId) {
    if (!productId) return;
    var container = document.getElementById("supplyChainGraph");
    if (!container) return;
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-tertiary);font-size:0.8rem;">로딩중...</div>';
    try {
        var [pmRes, spRes, prodRes] = await Promise.all([
            fetch("/inventory/ProductMaterials?$filter=product_ID eq "+productId+"&$select=material_ID"),
            fetch("/inventory/StoreProducts?$filter=product_ID eq "+productId+" and isActive eq true&$select=store_ID"),
            fetch("/inventory/Products?$filter=ID eq "+productId+"&$select=ID,name&$top=1")
        ]);
        var prodMats = (await pmRes.json()).value || [];
        var storePrds = (await spRes.json()).value || [];
        var prodData = (await prodRes.json()).value || [];
        var product = prodData.length > 0 ? prodData[0] : { ID: productId, name: "상품" };
        var matIds = prodMats.map(function(pm){return pm.material_ID;});
        var storeIds = [...new Set(storePrds.map(function(sp){return sp.store_ID;}))];
        var materials = [];
        if (matIds.length > 0) { var mf = matIds.map(function(id){return "ID eq "+id;}).join(" or "); var r = await fetch("/inventory/Materials?$filter="+encodeURIComponent(mf)+"&$select=ID,name,supplier_ID"); materials = (await r.json()).value || []; }
        var supIds = [...new Set(materials.filter(function(m){return m.supplier_ID;}).map(function(m){return m.supplier_ID;}))];
        var suppliers = [];
        if (supIds.length > 0) { var sf = supIds.map(function(id){return "ID eq "+id;}).join(" or "); var r2 = await fetch("/inventory/Suppliers?$filter="+encodeURIComponent(sf)+"&$select=ID,name"); suppliers = (await r2.json()).value || []; }
        var stores = [];
        if (storeIds.length > 0) { var tf = storeIds.map(function(id){return "ID eq "+id;}).join(" or "); var r3 = await fetch("/inventory/Stores?$filter="+encodeURIComponent(tf)+"&$select=ID,name"); stores = (await r3.json()).value || []; }
        var nodes = [], edges = [];
        nodes.push({id:"P_"+product.ID, label:"🔵 "+product.name, shape:"box", color:{background:"#E3F2FD",border:"#1976D2"}, font:{color:"#1565C0",size:13,bold:true}, margin:12, level:2, borderWidth:3});
        materials.forEach(function(m) { nodes.push({id:"M_"+m.ID, label:"🟡 "+m.name, shape:"box", color:{background:"#FFF8E1",border:"#FFC107"}, font:{color:"#F57F17",size:11}, margin:8, level:1}); edges.push({from:"M_"+m.ID, to:"P_"+product.ID, color:{color:"#90CAF9"}, arrows:"to", width:2.5, label:"BOM", font:{size:8,color:"#1565C0"}}); });
        suppliers.forEach(function(s) { nodes.push({id:"S_"+s.ID, label:"🟣 "+s.name, shape:"box", color:{background:"#EDE7F6",border:"#7C4DFF"}, font:{color:"#4A148C",size:11}, margin:8, level:0}); });
        materials.forEach(function(m) { if(m.supplier_ID) edges.push({from:"S_"+m.supplier_ID, to:"M_"+m.ID, color:{color:"#CE93D8"}, arrows:"to", width:2, label:"공급", font:{size:8,color:"#7B1FA2"}}); });
        stores.forEach(function(st) { nodes.push({id:"T_"+st.ID, label:"🟢 "+st.name, shape:"box", color:{background:"#E8F5E9",border:"#43A047"}, font:{color:"#1B5E20",size:11}, margin:8, level:3}); edges.push({from:"P_"+product.ID, to:"T_"+st.ID, color:{color:"#A5D6A7"}, arrows:"to", width:2, label:"판매", font:{size:8,color:"#2E7D32"}}); });
        container.innerHTML = '';
        if (scNetwork) { scNetwork.destroy(); scNetwork = null; }
        var data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
        scNetwork = new vis.Network(container, data, { layout:{hierarchical:{direction:"LR",sortMethod:"directed",levelSeparation:140,nodeSpacing:35,treeSpacing:40}}, physics:false, interaction:{hover:true,zoomView:true}, edges:{smooth:{type:"cubicBezier"}} });
    } catch(e) { console.warn("상품공급 로드 실패:", e); }
}

// 점포 드롭다운 로드
var scStoresCache = [];
async function loadStoreDropdown() {
    if (scStoresCache.length > 0) return; // 이미 로드됨
    try {
        var res = await fetch("/inventory/Stores?$top=30&$select=ID,name&$filter=isActive eq true&$orderby=name asc");
        if (!res.ok) return;
        var data = await res.json();
        scStoresCache = data.value || [];
        var sel = document.getElementById('scStoreSelect');
        sel.innerHTML = '<option value="">-- 점포 선택 --</option>' +
            scStoresCache.map(function(s) { return '<option value="'+s.ID+'">'+s.name+'</option>'; }).join('');
        // 첫 번째 점포 자동 선택
        if (scStoresCache.length > 0) {
            sel.value = scStoresCache[0].ID;
            loadSupplyChainOptionB(scStoresCache[0].ID);
        }
    } catch(e) { console.warn("점포 드롭다운 로드 실패:", e); }
}

// ═══ 재고상태: 점포별 수평 막대 차트 (Chart.js) ═══
var scBarChart = null;
async function loadSupplyChainOptionB(storeId) {
    if (!storeId) return;
    var container = document.getElementById("supplyChainGraph");
    if (!container) return;
    // 컨테이너 높이를 동적으로 조절 (상품 수 × 32px, 최소 200px)
    var dynamicHeight = Math.max(300, 32 * 30); // 초기값, 데이터 로드 후 조정
    container.style.overflowY = 'auto';
    container.innerHTML = '<div id="scBarWrap" style="width:100%;position:relative;"><canvas id="scBarCanvas"></canvas></div>';

    try {
        // 해당 점포의 재고 데이터 조회
        var [invRes, prodRes] = await Promise.all([
            fetch("/inventory/Inventories?$filter=store_ID eq " + storeId + "&$select=product_ID,quantity,availableQty,minStock&$top=50"),
            fetch("/inventory/Products?$top=50&$select=ID,name&$filter=isActive eq true")
        ]);
        var inventories = (await invRes.json()).value || [];
        var products = (await prodRes.json()).value || [];
        var prodMap = {}; products.forEach(function(p) { prodMap[p.ID] = p; });

        // 재고 비율 계산 + 정렬 (부족 → 주의 → 정상)
        var items = inventories.map(function(inv) {
            var prod = prodMap[inv.product_ID];
            if (!prod) return null;
            var qty = inv.availableQty || inv.quantity || 0;
            var min = inv.minStock || 1;
            var ratio = Math.round((qty / min) * 100);
            return { name: prod.name, qty: qty, min: min, ratio: ratio };
        }).filter(function(x) { return x !== null; });

        // 부족한 것부터 정렬
        items.sort(function(a, b) { return a.ratio - b.ratio; });

        // 막대 색상 결정
        var colors = items.map(function(item) {
            if (item.ratio < 50) return '#D93025';   // 부족
            if (item.ratio <= 100) return '#FFC107';  // 주의
            return '#43A047';                          // 정상
        });

        var labels = items.map(function(item) { return item.name; });
        var values = items.map(function(item) { return item.ratio; });

        // 차트 높이를 상품 수에 맞게 동적 조절
        var chartHeight = Math.max(250, items.length * 32 + 60);
        var wrap = document.getElementById('scBarWrap');
        if (wrap) wrap.style.height = chartHeight + 'px';

        // Chart.js 수평 막대
        var canvas = document.getElementById('scBarCanvas');
        if (!canvas) return;
        if (scBarChart) { scBarChart.destroy(); scBarChart = null; }

        scBarChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '재고 비율 (%)',
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors.map(function(c) { return c; }),
                    borderWidth: 1,
                    borderRadius: 4,
                    barThickness: 18
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                var item = items[ctx.dataIndex];
                                return item.name + ': ' + item.qty + '/' + item.min + ' (' + item.ratio + '%)';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: Math.max(200, Math.max.apply(null, values) + 20),
                        ticks: { callback: function(v) { return v + '%'; }, font: { size: 10 } },
                        grid: { color: '#F0F0F0' },
                        title: { display: true, text: '재고/기준 비율 (%)', font: { size: 10, weight: '500' } }
                    },
                    y: {
                        ticks: { font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });
    } catch(e) { console.warn("재고상태 막대차트 실패:", e); container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--danger);font-size:0.8rem;">로드 실패</div>'; }
}
