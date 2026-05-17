sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Link",
    "sap/m/Button",
    "sap/m/CustomListItem",
    "sap/ui/core/CustomData",
    "sap/ui/core/HTML"
], function (Controller, JSONModel, UIComponent, MessageToast, VBox, HBox, Text, Link, Button, CustomListItem, CustomData, HTMLControl) {
    "use strict";

    var SEVERITY_TO_STATE = { HIGH: "Error", MEDIUM: "Warning", LOW: "Information" };
    var INSIGHT_ICONS = {
        STOCKOUT: "sap-icon://alert",
        ALERT: "sap-icon://warning2",
        OPPORTUNITY: "sap-icon://trend-up",
        RECOMMEND: "sap-icon://target-group"
    };
    var STATUS_ICONS = { GREEN: "🟢", YELLOW: "🟡", RED: "🔴" };
    var PRIORITY_STATES = { HIGH: "Error", MEDIUM: "Warning", LOW: "Success" };

    function fmtKRW(n) {
        if (n == null || isNaN(n)) return "-";
        if (n >= 100000000) return "₩" + (n / 100000000).toFixed(1) + "억";
        if (n >= 10000) return "₩" + (n / 10000).toFixed(0) + "만";
        return "₩" + Number(n).toLocaleString("ko-KR");
    }

    // 바로가기 8종 (HTML dashboard와 동일)
    var SHORTCUTS = [
        { icon: "🏷️", title: "상품 관리",   url: "/products/webapp/index.html" },
        { icon: "🏪", title: "점포 관리",   url: "/stores/webapp/index.html" },
        { icon: "📦", title: "재고 관리",   url: "/inventories/webapp/index.html" },
        { icon: "📋", title: "발주 관리",   url: "/purchaseorders/webapp/index.html" },
        { icon: "🔮", title: "수요 예측",   url: "/demandforecasts/webapp/index.html" },
        { icon: "🚨", title: "이상 탐지",   url: "/salesanomalies/webapp/index.html" },
        { icon: "🎯", title: "AI 추천",     url: "/orderrecommendations/webapp/index.html" },
        { icon: "👤", title: "고객 관리",   url: "/customers/webapp/index.html" }
    ];

    return Controller.extend("storepjt.ui5.controller.Dashboard", {

        onInit: function () {
            this._oModel = new JSONModel({
                today: new Date().toLocaleDateString("ko-KR", {
                    year: "numeric", month: "long", day: "numeric", weekday: "long"
                }),
                kpi: {
                    revenueText: "-", revenueChangeText: "", revenueState: "None", revenueClass: "",
                    healthText: "-", healthChangeText: "", healthState: "None", healthClass: "",
                    stockoutText: "-", pendingText: "-"
                },
                insights: [],
                forecast: [],
                forecastSummary: "",
                stores: [],
                orderRecs: [],
                anomalies: [],
                shortcuts: SHORTCUTS.slice()
            });
        this.getView().setModel(this._oModel, "dashboard");

        // 공급망 그래프 상태
        this._scRiskOnly = true;
        this._scNetwork = null;

        var oRouter = UIComponent.getRouterFor(this);
        oRouter.getRoute("dashboard").attachPatternMatched(this._onRouteMatched, this);

        // 첫 로드
        this._loadAll();
    },

    onAfterRendering: function () {
        // VizFrame 기본 "차트 제목" 라벨 제거 + 축 제목만 숨김 (legend label은 measure 이름 그대로)
        var oViz = this.byId("vizSalesForecast");
        if (oViz && !this._vizTuned) {
            oViz.setVizProperties({
                title: { visible: false },
                plotArea: { dataLabel: { visible: false } },
                interaction: { selectability: { mode: "none" } },
                valueAxis: { title: { visible: false } },
                categoryAxis: { title: { visible: false } }
            });
            this._vizTuned = true;
        }

        // 공급망 그래프 — DOM 노드(#supplyChainGraph)가 렌더된 후 1회 로드
        if (!this._scLoaded && document.getElementById("supplyChainGraph")) {
            this._scLoaded = true;
            this._loadSupplyChainNetwork();
        }

        // P8-2 v23: AI 인사이트 첫 카드 Link가 페이지 로드 직후 자동 focus/selection
        // 상태로 보이는 문제 → 100ms 후 (UI5 라이프사이클 종료 + factory 카드 렌더 후)
        // selection 강제 클리어 + activeElement blur. CSS만으론 dom selection이
        // 안 잡히는 케이스가 있어 JS로도 보강.
        if (!this._selectionCleared) {
            this._selectionCleared = true;
            setTimeout(function () {
                try {
                    if (window.getSelection) {
                        var sel = window.getSelection();
                        if (sel && sel.removeAllRanges) sel.removeAllRanges();
                    }
                    if (document.activeElement && document.activeElement.blur &&
                        document.activeElement !== document.body) {
                        document.activeElement.blur();
                    }
                } catch (e) { /* ignore */ }
            }, 150);
        }
    },

        _onRouteMatched: function () {
            // 라우트 진입 시마다 갱신 (필요 시)
            // 첫 onInit 호출은 라우트 매칭 전이므로 _loadAll이 onInit에서도 한 번 호출됨.
            // 중복 방지를 위해 onInit에서 호출하지 않고 여기서만 해도 OK.
            // 일단 onInit 호출 유지 + 라우트 진입 시 재로드는 생략 (성능)
        },

        onRefresh: function () {
            this._loadAll();
            MessageToast.show("새로고침 중...");
        },

        _loadAll: function () {
            this._loadKPI();
            this._loadInsights();
            this._loadForecast();
            this._loadStoreHealth();
            this._loadOrderRecs();
            this._loadAnomalies();
            // 공급망 네트워크는 onAfterRendering에서 DOM 준비 후 호출
        },

        // ---------- KPI ----------
        _loadKPI: function () {
            var that = this;
            fetch("/inventory/getDashboardKPIs()")
                .then(function (r) { if (!r.ok) throw new Error("KPI " + r.status); return r.json(); })
                .then(function (data) {
                    var d = data || {};
                    var revText = fmtKRW(d.todayRevenue || 0);
                    var rc = d.revenueChange || 0;
                    var revChangeText = (rc >= 0 ? "↑ 전일 대비 +" : "↓ 전일 대비 ") + rc.toFixed(1) + "%";
                    var revState = rc >= 0 ? "Success" : "Error";

                    var healthText = (d.healthScore || 0) + "점";
                    var hc = d.healthChange || 0;
                    var healthChangeText = (hc >= 0 ? "↑ +" : "↓ ") + Math.abs(hc);
                    var healthState = hc >= 0 ? "Success" : "Error";

                    that._oModel.setProperty("/kpi", {
                        revenueText: revText,
                        revenueChangeText: revChangeText,
                        revenueState: revState,
                        revenueClass: rc >= 0 ? "kpiChangeUp" : "kpiChangeDown",
                        healthText: healthText,
                        healthChangeText: healthChangeText,
                        healthState: healthState,
                        healthClass: hc >= 0 ? "kpiChangeUp" : "kpiChangeDown",
                        stockoutText: (d.stockoutRisk || 0) + "건",
                        pendingText: (d.pendingOrders || 0) + "건"
                    });

                    // P8-2 v23: UI5는 class= 속성에 binding/expression을 적용하지 않고
                    // 리터럴로 그대로 두므로(예: "{dashboard>/kpi/revenueClass}" 텍스트 그대로
                    // DOM에 들어감), 동적 className은 반드시 controller에서 addStyleClass로
                    // 부착해야 함. view에는 정적 base class("kpiChange")만 두고 여기서
                    // up/down variant를 toggle.
                    var oRev = that.byId("kpiRevChange");
                    if (oRev) {
                        oRev.removeStyleClass("kpiChangeUp").removeStyleClass("kpiChangeDown");
                        oRev.addStyleClass(rc >= 0 ? "kpiChangeUp" : "kpiChangeDown");
                    }
                    var oHealth = that.byId("kpiHealthChange");
                    if (oHealth) {
                        oHealth.removeStyleClass("kpiChangeUp").removeStyleClass("kpiChangeDown");
                        oHealth.addStyleClass(hc >= 0 ? "kpiChangeUp" : "kpiChangeDown");
                    }
                })
                .catch(function (e) { console.warn("[Dashboard] KPI 실패:", e); });
        },

        // ---------- AI Insights ----------
        _loadInsights: function () {
            var that = this;
            fetch("/inventory/getAIInsights()")
                .then(function (r) { if (!r.ok) throw new Error("Insights " + r.status); return r.json(); })
                .then(function (data) {
                    var items = (data && data.value) || data || [];
                    var mapped = items.map(function (it) {
                        var sev = (it.severity || "LOW").toUpperCase();
                        var sevCls = "severity" + sev;            // severityHIGH/MEDIUM/LOW
                        return Object.assign({}, it, {
                            icon: INSIGHT_ICONS[it.type] || "sap-icon://lightbulb",
                            severityText: sev,
                            severityBadge: sev,
                            severityClass: sevCls,
                            // 표현식 바인딩이 styleClass에 잘 안 먹는 케이스 우회 →
                            // 미리 합쳐진 className 제공
                            cardClass: "aiInsightCard " + sevCls,
                            badgeClass: "insightBadge " + sevCls,
                            actionLabelArrow: (it.actionLabel || "상세 보기") + " →"
                        });
                    });
                    that._oModel.setProperty("/insights", mapped);
                })
                .catch(function (e) { console.warn("[Dashboard] Insights 실패:", e); });
        },

        // ---------- Sales Forecast ----------
        _loadForecast: function () {
            var that = this;
            fetch("/inventory/getSalesForecastTrend()")
                .then(function (r) { if (!r.ok) throw new Error("Forecast " + r.status); return r.json(); })
                .then(function (data) {
                    var items = (data && data.value) || data || [];
                    var rows = items.map(function (d) {
                        var label = d.date;
                        if (label && label.length >= 10) {
                            var p = label.split("-");
                            label = p[1] + "/" + p[2];
                        }
                        return {
                            label: label,
                            actual: d.actual,
                            forecast: d.forecast
                        };
                    });
                    that._oModel.setProperty("/forecast", rows);

                    // 요약문
                    var actuals = rows.map(function (r) { return r.actual; }).filter(function (v) { return v != null; });
                    var forecasts = rows.map(function (r) { return r.forecast; }).filter(function (v) { return v != null; });
                    var summary = "";
                    if (actuals.length > 0 && forecasts.length > 0) {
                        var lastActual = actuals[actuals.length - 1];
                        var avgForecast = forecasts.reduce(function (s, v) { return s + v; }, 0) / forecasts.length;
                        var changeRate = lastActual > 0 ? ((avgForecast - lastActual) / lastActual * 100).toFixed(1) : 0;
                        var arrow = changeRate >= 0 ? "📈" : "📉";
                        summary = arrow + " 실적 대비 " + changeRate + "% " + (changeRate >= 0 ? "상승" : "하락") + " 예측";
                    }
                    that._oModel.setProperty("/forecastSummary", summary);
                })
                .catch(function (e) { console.warn("[Dashboard] Forecast 실패:", e); });
        },

        // ---------- Store Health ----------
        _loadStoreHealth: function () {
            var that = this;
            fetch("/inventory/getStoreHealthScores()")
                .then(function (r) { if (!r.ok) throw new Error("Health " + r.status); return r.json(); })
                .then(function (data) {
                    var stores = (data && data.value) || data || [];
                    var mapped = stores.map(function (s) {
                        return Object.assign({}, s, {
                            statusIcon: STATUS_ICONS[s.status] || "⚪",
                            statusClass: "shStatus" + (s.status || "GREEN"),
                            scoreText: (s.score || 0) + "점",
                            statusSub: (s.stockoutCount > 0) ? ("⚠️ " + s.stockoutCount + "건") : "✅ 정상"
                        });
                    });
                    that._oModel.setProperty("/stores", mapped);
                })
                .catch(function (e) { console.warn("[Dashboard] Health 실패:", e); });
        },

        // ---------- Order Recommendations Top 5 ----------
        _loadOrderRecs: function () {
            var that = this;
            var url = "/inventory/OrderRecommendations?$filter=status eq 'Pending'&$orderby=priority asc&$top=5&$expand=store($select=name),product($select=name)";
            fetch(url)
                .then(function (r) { if (!r.ok) throw new Error("Rec " + r.status); return r.json(); })
                .then(function (data) {
                    var items = (data && data.value) || [];
                    var po = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                    items.sort(function (a, b) { return (po[a.priority] || 9) - (po[b.priority] || 9); });
                    var mapped = items.map(function (it, idx) {
                        return {
                            rank: String(idx + 1),
                            priority: it.priority || "",
                            priorityState: PRIORITY_STATES[it.priority] || "None",
                            storeName: (it.store && it.store.name) || "점포",
                            productName: (it.product && it.product.name) || "상품",
                            recommendedQty: it.recommendedQty
                        };
                    });
                    that._oModel.setProperty("/orderRecs", mapped);
                })
                .catch(function (e) { console.warn("[Dashboard] OrderRec 실패:", e); });
        },

        // ---------- Sales Anomalies Top 5 ----------
        _loadAnomalies: function () {
            var that = this;
            var url = "/inventory/SalesAnomalies?$orderby=detectedAt desc&$top=5&$expand=store($select=name),product($select=name)";
            fetch(url)
                .then(function (r) { if (!r.ok) throw new Error("Anom " + r.status); return r.json(); })
                .then(function (data) {
                    var items = (data && data.value) || [];
                    var mapped = items.map(function (it) {
                        var sn = (it.store && it.store.name) || "Store";
                        return {
                            icon: it.anomalyType === "SPIKE" ? "📈" : "📉",
                            title: sn + " " + (it.metricName || ""),
                            sub: "Z:" + (parseFloat(it.zScore) || 0).toFixed(1) + " | Dev:" + Math.round(it.deviation || 0),
                            anomalyType: it.anomalyType || "",
                            anomState: it.anomalyType === "SPIKE" ? "Warning" : "Error"
                        };
                    });
                    that._oModel.setProperty("/anomalies", mapped);
                })
                .catch(function (e) { console.warn("[Dashboard] Anomaly 실패:", e); });
        },

        // ---------- 핸들러 ----------

        // actionUrl/url 패턴 → msgType 추론 (Phase 4)
        // 5종 AI 결과 앱은 UI5 view 라우트로 분기 (App.controller가 받아서 _navigateUI5View)
        _inferMsgTypeFromUrl: function (sUrl) {
            if (!sUrl) return null;
            var u = sUrl.toLowerCase();
            if (u.indexOf("/demandforecasts/") !== -1) return "forecastUpdate";
            if (u.indexOf("/orderrecommendations/") !== -1) return "recommendationUpdate";
            if (u.indexOf("/churnpredictions/") !== -1) return "churnUpdate";
            if (u.indexOf("/customersegments/") !== -1) return "segmentUpdate";
            if (u.indexOf("/salesanomalies/") !== -1) return "anomalyUpdate";
            return null;
        },

        // App.controller 인스턴스 획득 (rootControl)
        _getAppController: function () {
            try {
                var oRoot = this.getOwnerComponent().getRootControl();
                return oRoot && oRoot.getController();
            } catch (e) { return null; }
        },

        _navigateActionUrl: function (sUrl) {
            if (!sUrl) return;
            var sMsgType = this._inferMsgTypeFromUrl(sUrl);
            var oApp = this._getAppController();
            if (sMsgType && oApp && typeof oApp.navigateAndPostMessage === "function") {
                // UI5 view 5종 → App.controller가 _navigateUI5View로 분기
                oApp.navigateAndPostMessage(sUrl, sMsgType);
                return;
            }
            // 그 외(또는 App 획득 실패): 기존 iframe 라우팅
            this._navEmbedded(sUrl);
        },

        onInsightAction: function (oEvent) {
            var sUrl = oEvent.getSource().data("url");
            this._navigateActionUrl(sUrl);
        },

        onOrderRecPress: function (oEvent) {
            var sUrl = oEvent.getSource().data("url");
            // 발주 추천은 항상 recommendationUpdate. URL이 비어있어도 강제 라우팅.
            if (!sUrl) {
                var oApp = this._getAppController();
                if (oApp && typeof oApp.navigateAndPostMessage === "function") {
                    oApp.navigateAndPostMessage("/orderrecommendations/webapp/index.html", "recommendationUpdate");
                    return;
                }
            }
            this._navigateActionUrl(sUrl);
        },

        _navEmbedded: function (sUrl) {
            if (!sUrl) return;
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("embedded", { appPath: encodeURIComponent(sUrl) });
        },

        // ---------- 바로가기 ----------
        shortcutCardFactory: function (sId, oContext) {
            var d = oContext.getObject() || {};
            var that = this;
            var oIcon = new Text({ text: d.icon || "" }).addStyleClass("shortcutIcon");
            var oTitle = new Text({ text: d.title || "" }).addStyleClass("shortcutTitle");
            var oCard = new HBox(sId, {
                alignItems: "Center",
                items: [oIcon, oTitle]
            });
            oCard.addStyleClass("shortcutCard");
            oCard.attachBrowserEvent("click", function () {
                that._navigateActionUrl(d.url);
            });
            return oCard;
        },

        // ---------- 공급망 네트워크 (vis-network) ----------
        // app/js/supply-chain.js의 loadSupplyChainNetwork 로직 포팅
        onScRiskOnlyToggle: function (oEvent) {
            this._scRiskOnly = !!oEvent.getParameter("selected");
            this._loadSupplyChainNetwork();
        },

        _loadSupplyChainNetwork: function () {
            var that = this;
            var container = document.getElementById("supplyChainGraph");
            if (!container) return;
            if (typeof vis === "undefined" || !vis.Network) {
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8396A8;font-size:0.8rem;">vis-network 라이브러리 로드 실패</div>';
                return;
            }
            container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8396A8;font-size:0.8rem;">로딩중...</div>';

            var riskOnly = this._scRiskOnly;

            Promise.all([
                fetch("/inventory/Suppliers?$top=50&$select=ID,name&$filter=isActive eq true").then(function (r) { return r.json(); }),
                fetch("/inventory/Materials?$top=50&$select=ID,supplier_ID&$filter=isActive eq true").then(function (r) { return r.json(); }),
                fetch("/inventory/Products?$top=50&$select=ID,name&$filter=isActive eq true").then(function (r) { return r.json(); }),
                fetch("/inventory/Stores?$top=30&$select=ID,name&$filter=isActive eq true").then(function (r) { return r.json(); }),
                fetch("/inventory/ProductMaterials?$top=200&$select=product_ID,material_ID").then(function (r) { return r.json(); }),
                fetch("/inventory/StoreProducts?$top=500&$select=store_ID,product_ID&$filter=isActive eq true").then(function (r) { return r.json(); }),
                fetch("/inventory/Inventories?$top=500&$select=product_ID,quantity,availableQty,minStock").then(function (r) { return r.json(); })
            ]).then(function (results) {
                var suppliers   = (results[0] && results[0].value) || [];
                var materials   = (results[1] && results[1].value) || [];
                var products    = (results[2] && results[2].value) || [];
                var stores      = (results[3] && results[3].value) || [];
                var prodMats    = (results[4] && results[4].value) || [];
                var storePrds   = (results[5] && results[5].value) || [];
                var inventories = (results[6] && results[6].value) || [];

                // 상품별 재고 상태 집계
                var productStock = {};
                inventories.forEach(function (inv) {
                    if (!productStock[inv.product_ID]) productStock[inv.product_ID] = { qty: 0, min: 0 };
                    productStock[inv.product_ID].qty += (inv.availableQty || inv.quantity || 0);
                    productStock[inv.product_ID].min += (inv.minStock || 0);
                });

                function getProductColor(pId) {
                    var s = productStock[pId];
                    if (!s || s.qty <= 0) return { background: "#FFCDD2", border: "#D93025" }; // 부족
                    if (s.min > 0 && s.qty <= s.min * 0.5) return { background: "#FFCDD2", border: "#D93025" };
                    if (s.min > 0 && s.qty <= s.min) return { background: "#FFF9C4", border: "#FFC107" };
                    return { background: "#C8E6C9", border: "#43A047" }; // 정상
                }

                // 자재→공급업체 매핑
                var matToSupplier = {};
                materials.forEach(function (m) { if (m.supplier_ID) matToSupplier[m.ID] = m.supplier_ID; });

                // 상품→공급업체 매핑 (자재를 통해)
                var productSuppliers = {};
                prodMats.forEach(function (pm) {
                    var supId = matToSupplier[pm.material_ID];
                    if (supId) {
                        if (!productSuppliers[pm.product_ID]) productSuppliers[pm.product_ID] = {};
                        productSuppliers[pm.product_ID][supId] = true;
                    }
                });

                var nodes = [], edges = [], nodeIds = {};
                var prodMap = {};
                products.forEach(function (p) { prodMap[p.ID] = p; });
                var connectedProducts = {};

                Object.keys(productSuppliers).forEach(function (pId) {
                    if (prodMap[pId]) {
                        var stockColor = getProductColor(pId);
                        var stockInfo = productStock[pId];
                        var isRisk = stockColor.border === "#D93025" || stockColor.border === "#FFC107";

                        if (riskOnly && !isRisk) return;

                        var label = prodMap[pId].name;
                        if (stockInfo) label += "\n(" + stockInfo.qty + ")";
                        nodes.push({
                            id: "P_" + pId,
                            label: label,
                            group: "product",
                            shape: "box",
                            color: stockColor,
                            font: { color: "#333", size: 10, multi: true },
                            margin: 7,
                            title: prodMap[pId].name + (stockInfo ? " | 재고:" + stockInfo.qty + " | 기준:" + stockInfo.min : "")
                        });
                        nodeIds["P_" + pId] = true;
                        connectedProducts[pId] = true;
                    }
                });

                // 공급업체 노드
                var connectedSuppliers = {};
                if (riskOnly) {
                    Object.keys(connectedProducts).forEach(function (pId) {
                        if (productSuppliers[pId]) {
                            Object.keys(productSuppliers[pId]).forEach(function (sId) {
                                connectedSuppliers[sId] = true;
                            });
                        }
                    });
                }
                suppliers.forEach(function (s) {
                    if (riskOnly && !connectedSuppliers[s.ID]) return;
                    nodes.push({
                        id: "S_" + s.ID,
                        label: "🟣 " + s.name,
                        group: "supplier",
                        shape: "box",
                        color: { background: "#EDE7F6", border: "#7C4DFF" },
                        font: { color: "#4A148C", size: 11, multi: true },
                        margin: 8
                    });
                    nodeIds["S_" + s.ID] = true;
                });

                // 점포 노드
                var connectedStoreIds = {};
                if (riskOnly) {
                    storePrds.forEach(function (sp) {
                        if (connectedProducts[sp.product_ID]) connectedStoreIds[sp.store_ID] = true;
                    });
                }
                stores.forEach(function (st) {
                    if (riskOnly && !connectedStoreIds[st.ID]) return;
                    nodes.push({
                        id: "T_" + st.ID,
                        label: "🏪 " + st.name,
                        group: "store",
                        shape: "box",
                        color: { background: "#E3F2FD", border: "#1976D2" },
                        font: { color: "#1565C0", size: 11, multi: true },
                        margin: 8
                    });
                    nodeIds["T_" + st.ID] = true;
                });

                // 엣지: 공급업체 → 상품
                var supProdEdgeSet = {};
                Object.keys(productSuppliers).forEach(function (pId) {
                    Object.keys(productSuppliers[pId]).forEach(function (sId) {
                        var key = sId + "|" + pId;
                        if (supProdEdgeSet[key]) return;
                        supProdEdgeSet[key] = true;
                        if (nodeIds["S_" + sId] && nodeIds["P_" + pId]) {
                            edges.push({ from: "S_" + sId, to: "P_" + pId, color: { color: "#CE93D8" }, arrows: "to", width: 2 });
                        }
                    });
                });

                // 엣지: 상품 → 점포
                var spEdgeSet = {};
                storePrds.forEach(function (sp) {
                    var key = sp.product_ID + "|" + sp.store_ID;
                    if (spEdgeSet[key]) return;
                    spEdgeSet[key] = true;
                    if (connectedProducts[sp.product_ID] && nodeIds["T_" + sp.store_ID]) {
                        edges.push({ from: "P_" + sp.product_ID, to: "T_" + sp.store_ID, color: { color: "#90CAF9" }, arrows: "to", width: 1.5 });
                    }
                });

                container.innerHTML = "";
                if (that._scNetwork) { try { that._scNetwork.destroy(); } catch (e) { /* noop */ } that._scNetwork = null; }
                var data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
                var options = {
                    physics: {
                        solver: "forceAtlas2Based",
                        forceAtlas2Based: { gravitationalConstant: -80, centralGravity: 0.01, springLength: 180, springConstant: 0.02 },
                        stabilization: { iterations: 120 }
                    },
                    interaction: { hover: true, tooltipDelay: 200 },
                    layout: { improvedLayout: true }
                };
                that._scNetwork = new vis.Network(container, data, options);
                that._scNetwork.once("stabilizationIterationsDone", function () {
                    try { that._scNetwork.moveTo({ scale: 0.55 }); } catch (e) { /* noop */ }
                });
            }).catch(function (e) {
                console.warn("[Dashboard] 공급망 네트워크 로드 실패:", e);
                if (container) {
                    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#D93025;font-size:0.8rem;">로드 실패</div>';
                }
            });
        },

        // ---------- 점포 Health 카드 Factory ----------
        // P8-2 v23: 동적 className(shStatusGREEN/YELLOW/RED)을 위해 factory 사용.
        // XML class="{= ...}" expression binding은 UI5에서 동작하지 않으므로 addStyleClass로 부착.
        storeHealthFactory: function (sId, oContext) {
            var d = oContext.getObject() || {};
            var oBox = new VBox(sId, {
                justifyContent: "Center",
                alignItems: "Center",
                items: [
                    new Text({ text: d.statusIcon || "" }).addStyleClass("shIcon"),
                    new Text({ text: d.scoreText || "" }).addStyleClass("shScore"),
                    new Text({ text: d.storeName || "" }).addStyleClass("shName"),
                    new Text({ text: d.statusSub || "" }).addStyleClass("shSub")
                ]
            });
            oBox.addStyleClass("storeHealthItem");
            if (d.statusClass) oBox.addStyleClass(d.statusClass);   // shStatusGREEN/YELLOW/RED
            return oBox;
        },

        // ---------- 발주 추천 List Factory ----------
        // P8-2 v23: priority 별 .recRank 색상 분기를 위해 factory.
        // 기존 view의 inline 구조(HBox > [HBox(rank+title) | HBox(qty+button)])를 코드로 재현.
        orderRecFactory: function (sId, oContext) {
            var d = oContext.getObject() || {};
            var that = this;

            var oRank = new Text({ text: d.rank || "" });
            oRank.addStyleClass("recRank");
            if (d.priority) oRank.addStyleClass(d.priority);   // HIGH/MEDIUM/LOW

            var oTitle = new Text({ text: d.storeName || "" }).addStyleClass("recItemTitle");
            var oSub   = new Text({ text: d.productName || "" }).addStyleClass("recItemSub");
            var oTitleBox = new VBox({ items: [oTitle, oSub] }).addStyleClass("sapUiSmallMarginBegin");

            var oLeft = new HBox({
                alignItems: "Center",
                items: [oRank, oTitleBox]
            });

            var oQty = new Text({ text: "+" + (d.recommendedQty || 0) }).addStyleClass("recQty");
            var oBtn = new Button({
                text: "발주",
                type: "Emphasized",
                press: function (oEvent) { that.onOrderRecPress(oEvent); },
                customData: [
                    new CustomData({
                        key: "url",
                        value: "/purchaseorders/webapp/index.html",
                        writeToDom: false
                    })
                ]
            });
            oBtn.addStyleClass("sapUiTinyMarginBegin");
            oBtn.addStyleClass("recAction");

            var oRight = new HBox({
                alignItems: "Center",
                items: [oQty, oBtn]
            });

            var oRow = new HBox({
                alignItems: "Center",
                justifyContent: "SpaceBetween",
                width: "100%",
                items: [oLeft, oRight]
            });
            oRow.addStyleClass("recRow");

            var oItem = new CustomListItem(sId, { content: [oRow] });
            oItem.addStyleClass("recItem");
            return oItem;
        },

        // ---------- 이상 탐지 List Factory ----------
        // P8-2 v23: anomalyType(SPIKE/DROP)별 .anomBadge 색상 분기를 위해 factory.
        anomalyFactory: function (sId, oContext) {
            var d = oContext.getObject() || {};

            var oIcon = new Text({ text: d.icon || "" }).addStyleClass("anomIcon");
            var oTitle = new Text({ text: d.title || "" }).addStyleClass("anomItemTitle");
            var oSub   = new Text({ text: d.sub || "" }).addStyleClass("anomItemSub");
            var oTitleBox = new VBox({ items: [oTitle, oSub] }).addStyleClass("sapUiSmallMarginBegin");

            var oLeft = new HBox({
                alignItems: "Center",
                items: [oIcon, oTitleBox]
            });

            var oBadge = new Text({ text: d.anomalyType || "" });
            oBadge.addStyleClass("anomBadge");
            if (d.anomalyType) oBadge.addStyleClass(d.anomalyType);   // SPIKE/DROP

            var oRow = new HBox({
                alignItems: "Center",
                justifyContent: "SpaceBetween",
                width: "100%",
                items: [oLeft, oBadge]
            });
            oRow.addStyleClass("anomRow");

            var oItem = new CustomListItem(sId, { content: [oRow] });
            oItem.addStyleClass("anomItem");
            return oItem;
        },

        // ---------- AI Insight 카드 Factory ----------
        // XML view 안의 표현식 바인딩이 styleClass에 동적 적용 안 되는 문제를 우회해서
        // 카드 트리를 코드로 직접 생성. severityHIGH/MEDIUM/LOW 클래스 명시 부착.
        insightCardFactory: function (sId, oContext) {
            var oData = oContext.getObject() || {};
            var sSev = (oData.severity || "LOW").toUpperCase();
            var sCardCls = "aiInsightCard severity" + sSev;
            var sBadgeCls = "insightBadge severity" + sSev;
            var that = this;

            var oBadge = new Text({ text: oData.severityBadge || sSev });
            oBadge.addStyleClass(sBadgeCls);

            var oTitle = new Text({ text: oData.title || "" , maxLines: 2 });
            oTitle.addStyleClass("insightTitle");

            var oDesc = new Text({ text: oData.description || "", maxLines: 2 });
            oDesc.addStyleClass("insightDesc");

            // Metric 1
            var oM1Lbl = new Text({ text: oData.metric1Label || "" }); oM1Lbl.addStyleClass("insightMetricLabel");
            var oM1Val = new Text({ text: oData.metric1Value || "" }); oM1Val.addStyleClass("insightMetricValue");
            var oM1Box = new VBox({ items: [oM1Lbl, oM1Val] }); oM1Box.addStyleClass("insightMetric");

            // Metric 2
            var oM2Lbl = new Text({ text: oData.metric2Label || "" }); oM2Lbl.addStyleClass("insightMetricLabel");
            var oM2Val = new Text({ text: oData.metric2Value || "" }); oM2Val.addStyleClass("insightMetricValue");
            var oM2Box = new VBox({ items: [oM2Lbl, oM2Val] }); oM2Box.addStyleClass("insightMetric");

            var oMetrics = new HBox({ items: [oM1Box, oM2Box] });
            oMetrics.addStyleClass("insightMetrics");

            // Action link
            var oLink = new Link({
                text: oData.actionLabelArrow || ((oData.actionLabel || "상세 보기") + " →"),
                press: function () { that._navigateActionUrl(oData.actionUrl); }
            });
            oLink.addStyleClass("insightAction");

            // Card root
            var oCard = new VBox(sId, {
                items: [oBadge, oTitle, oDesc, oMetrics, oLink]
            });
            oCard.addStyleClass(sCardCls);
            return oCard;
        }
    });
});
