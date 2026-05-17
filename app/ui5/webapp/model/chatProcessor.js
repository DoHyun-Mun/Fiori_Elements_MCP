sap.ui.define([], function () {
    "use strict";

    function _set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* noop */ }
    }

    function _processOrderRec(d, buttons) {
        var recTable = [];
        var mlRec = d["ML_예측_발주추천"];
        if (mlRec && mlRec.recommendations) {
            recTable = mlRec.recommendations.map(function (r) {
                return {
                    product: r.product_name || r.name || "",
                    currentStock: r.current_stock || 0,
                    mlDemand: r.ml_demand || r.daily_demand || null,
                    rptDemand: r.forecast_daily || r.rpt_demand || null,
                    diff: r.forecast_diff_pct || null,
                    recommendQty: r.recommended_qty || r.quantity || 0,
                    urgency: r.urgency || r.priority || "MEDIUM"
                };
            });
        }
        var analysisItems = [];
        var reasonsD = d["발주_사유_분석"];
        if (reasonsD && reasonsD.explanations) {
            analysisItems = reasonsD.explanations.map(function (e) {
                return {
                    product: e.product_name || e.name || "",
                    store: e.store_name || "",
                    urgency: e.urgency || "",
                    summary: e.summary || "",
                    reasons: e.reasons || [],
                    timeseries: e["시계열_분석"] || {},
                    externalFactors: e["외부_요인_영향"] || {},
                    whatIfNot: e.what_if_not_ordered || "",
                    recommendedAction: e.recommended_action || ""
                };
            });
        }
        var ext = d["외부_요인_데이터"] || {};
        var judge = d["AI_종합_판단"] || {};
        var fa = d.filter_applied || {};
        var mlRecs = (mlRec && mlRec.recommendations) || [];
        var sn = (mlRecs.length > 0 && mlRecs[0].store_name) ? mlRecs[0].store_name : (fa.store_id || d.store_name || "");
        _set("orderRecommendationData", {
            meta: "AI 발주 추천 | " + (sn || "전체") + " | " + new Date().toLocaleString("ko-KR"),
            storeName: sn,
            summary: d.summary || {},
            table: recTable,
            timeseries: {},
            rpt: {},
            external: {
                day: ext["요일"] || "",
                season: ext["계절"] || "",
                news: ext["뉴스_트렌드"] || "",
                weather: ext["날씨"] || "",
                holiday: ext["공휴일"] || "",
                payday: ext["급여일"] || ""
            },
            analysis: analysisItems,
            reasons: [],
            aiJudgment: {
                conclusion: judge["결론"] || "",
                confidence: judge["신뢰도"] || "",
                recommendation: judge["권고"] || ""
            }
        });
        buttons.push({
            label: "📋 발주 추천 상세 보기",
            color1: "#E37400", color2: "#D93025",
            url: "/orderrecommendations/webapp/index.html",
            msgType: "recommendationUpdate"
        });
    }

    function _processForecast(d, buttons) {
        var raw = d.forecasts || d.predictions || d.forecast_table || d.forecast_data || [];
        var ft = raw.map(function (r) {
            return {
                date: (r.ds || r.date || "").substring(0, 10),
                forecast: Math.round(r.hybrid_forecast || r.forecast || r.qty || 0),
                low: Math.round(r.yhat_lower || r.low || r.confidence_low || 0),
                high: Math.round(r.yhat_upper || r.high || r.confidence_high || 0)
            };
        });
        var fT = d.forecast_target || {};
        var fsn = fT.store || d.store_name || d.storeName || "";
        var fpn = fT.product || d.product_name || d.productName || "";
        if (!fsn && fT.scope) {
            var sp = fT.scope.split("/");
            if (sp.length >= 1) fsn = sp[0].replace("전체", "").trim() || fT.scope;
        }
        var fk = d.kpi || d.metrics || {};
        var ra = d["예측_사유_분석"];
        var trend = "";
        if (ra && ra["시계열_분석"]) {
            var ts = ra["시계열_분석"];
            trend = ts["추세_변화율"] || ts["추세"] || "";
        }
        var fa2 = [];
        if (ra) {
            var titleMap = { "시계열_분석": "📊 시계열 분석", "외부_요인_영향": "🌍 외부 요인", "예측_신뢰도": "🎯 예측 신뢰도" };
            ["시계열_분석", "외부_요인_영향", "예측_신뢰도"].forEach(function (k) {
                if (ra[k]) {
                    fa2.push({
                        title: titleMap[k],
                        items: Object.entries(ra[k]).map(function (kv) { return kv[0] + ": " + kv[1]; })
                    });
                }
            });
            if (ra["핵심_예측_사유"]) {
                fa2.push({ title: "💡 핵심 사유", items: ra["핵심_예측_사유"] });
            }
        }
        var avg = ft.length > 0 ? (ft.reduce(function (s, r) { return s + r.forecast; }, 0) / ft.length).toFixed(1) : "-";
        var pk = ft.length > 0 ? ft.reduce(function (m, r) { return r.forecast > m.forecast ? r : m; }, ft[0]) : null;
        _set("forecastData", {
            meta: "AI 예측 결과 | " + (fsn || "") + " / " + (fpn || "") + " | " + new Date().toLocaleString("ko-KR"),
            storeName: fsn,
            productName: fpn,
            kpi: {
                avg: avg,
                trend: fk.trend || trend || "-",
                peak: pk ? (pk.date || "").slice(5) : "-",
                model: d.model_name || (d.forecast_days ? d.forecast_days + "일" : (d.model || "AI"))
            },
            table: ft,
            analysis: fa2.length > 0 ? fa2 : [{ title: "📊 분석 요약", items: ["데이터 기반 예측 완료"] }],
            rpt1: d["RPT1_AI_예측"] || null,
            externalFactors: d.external_factors_collected || null
        });
        buttons.push({
            label: "📊 예측 결과 상세 보기",
            color1: "#0070F2", color2: "#6B4FBB",
            url: "/demandforecasts/webapp/index.html",
            msgType: "forecastUpdate"
        });
    }

    function _processChurn(d, buttons) {
        var raw = d.high_risk_customers || d.churn_results || d.customers || [];
        var custs = raw.map(function (c) {
            return {
                code: c.CUSTOMER_CODE || c.customer_code || c.code || "",
                name: c.NAME || c.customer_name || c.name || "",
                age: c.AGE_GROUP || c.age_group || c.age || "",
                membership: c.MEMBERSHIP_TYPE || c.membership_type || c.membership || "",
                city: c.CITY || c.city || "",
                probability: c.churn_probability || c.churn_score || c.probability || "",
                risk: c.churn_risk || c.risk || "",
                factor: c.churn_reason || c.main_factor || c.factor || "",
                store: c.PREFERRED_STORE || c.preferred_store || c.store || "",
                payment: c.MAIN_PAYMENT || c.main_payment || c.payment || ""
            };
        });
        var pf = d.metrics || d.performance || d.model_performance || {};
        var fcts = d.top_features || d.factors || d.main_factors || [];
        if (Array.isArray(fcts) && fcts.length > 0 && Array.isArray(fcts[0])) {
            fcts = fcts.filter(function (f) { return f[1] > 0; }).map(function (f) { return f[0] + ": " + f[1]; });
        }
        if (typeof fcts === "object" && !Array.isArray(fcts)) {
            fcts = Object.entries(fcts).map(function (kv) { return kv[0] + ": " + kv[1]; });
        }
        var csn = d.store_name || d.storeName || "";
        _set("churnPredictionData", {
            meta: "이탈 예측 | " + (csn || "전체") + " | " + new Date().toLocaleString("ko-KR"),
            storeName: csn,
            totalCustomers: (d.total_customers || custs.length) + "명",
            churnCustomers: (d.high_risk_count || custs.length) + "명",
            churnRate: (d.high_risk_rate || d.churn_rate || "-") + "%",
            accuracy: pf.accuracy || "-",
            performance: {
                accuracy: pf.accuracy || "-",
                precision: pf.precision || "-",
                recall: pf.recall || "-",
                f1: pf.f1 || pf.f1_score || "-",
                auc: pf.auc_roc || pf.auc || "-"
            },
            customers: custs,
            factors: fcts
        });
        buttons.push({
            label: "⚠️ 이탈 예측 상세 보기",
            color1: "#D93025", color2: "#7B2FF2",
            url: "/churnpredictions/webapp/index.html",
            msgType: "churnUpdate"
        });
    }

    function _processAnomaly(d, buttons) {
        var aa = d["이상_탐지_분석"] || {};
        var rawItems = aa["이상_항목_상세"] || d.top_anomalies || d.anomalies || [];
        var ai = rawItems.map(function (a) {
            return {
                date: a["날짜"] || (a.SALES_DATE || a.date || "").substring(0, 10),
                product: a["상품명"] || a.PRODUCT_ID || a.product || "",
                qty: a["판매량"] || a.quantity || a.revenue || "",
                change: String(a["정상_범위_대비"] || a.revenue_zscore || a.change || "-"),
                type: a["유형"] || a.anomaly_type || a.type || "",
                severity: a["심각도"] || a.severity || ""
            };
        });
        var asn = aa["점포명"] || d.store_name || d.storeName || "";
        var ar = aa["탐지_사유"] || d.reasons || [];
        var arec = aa["권고_사항"] || d.recommendations || [];
        if (typeof ar === "string") ar = [ar];
        if (typeof arec === "string") arec = [arec];
        _set("salesAnomalyData", {
            meta: "이상 탐지 | " + (asn || "전체") + " | " + new Date().toLocaleString("ko-KR"),
            store: asn || "-",
            target: aa["분석_대상"] || d.model || "매출 이상 탐지",
            totalRecords: (d.input_records || "-") + "건",
            anomalyCount: (d.anomaly_count || rawItems.length) + "건",
            anomalyRate: (d.anomaly_rate || "-") + "%",
            byType: d.by_type || {},
            bySeverity: d.by_severity || {},
            items: ai,
            reasons: ar,
            recommendations: arec
        });
        buttons.push({
            label: "🚨 이상 탐지 상세 보기",
            color1: "#E37400", color2: "#D93025",
            url: "/salesanomalies/webapp/index.html",
            msgType: "anomalyUpdate"
        });
    }

    function _processSegment(d, toolDataLen, buttons) {
        var rawSegs = d.segments || d.customer_segments || [];
        var segSummary = {};
        var segGrouped = null;
        var flatSegs = [];

        if (rawSegs && !Array.isArray(rawSegs) && typeof rawSegs === "object") {
            segGrouped = rawSegs;
            Object.keys(rawSegs).forEach(function (name) {
                var customers = rawSegs[name] || [];
                segSummary[name] = { count: customers.length, avgRfm: 0, totalRfm: 0 };
                customers.forEach(function (c) {
                    segSummary[name].totalRfm += (c.rfm_score || c.rfmScore || 0);
                    flatSegs.push({
                        segment_name: name,
                        rfm_score: c.rfm_score || c.rfmScore || 0,
                        NAME: c.NAME || c.name || "",
                        AGE_GROUP: c.AGE_GROUP || c.age_group || "",
                        MEMBERSHIP_TYPE: c.MEMBERSHIP_TYPE || c.membership_type || "",
                        CITY: c.CITY || c.city || ""
                    });
                });
                segSummary[name].avgRfm = customers.length > 0 ? (segSummary[name].totalRfm / customers.length).toFixed(1) : "0";
            });
        } else {
            flatSegs = Array.isArray(rawSegs) ? rawSegs : [];
            flatSegs.forEach(function (s) {
                var name = s.segment_name || s.segmentName || "Unknown";
                if (!segSummary[name]) segSummary[name] = { count: 0, avgRfm: 0, totalRfm: 0 };
                segSummary[name].count++;
                segSummary[name].totalRfm += (s.rfm_score || s.rfmScore || 0);
            });
            Object.keys(segSummary).forEach(function (k) {
                segSummary[k].avgRfm = (segSummary[k].totalRfm / segSummary[k].count).toFixed(1);
            });
        }

        var totalCustomers = flatSegs.length;
        var metrics = d.metrics || {};
        var segMeta = d.segment_meta || null;
        _set("customerSegmentData", {
            meta: "고객 세분화 | " + new Date().toLocaleString("ko-KR"),
            totalCustomers: totalCustomers + "명",
            nClusters: metrics.n_clusters || Object.keys(segSummary).length,
            modelName: d.model_name || metrics.model_name || "-",
            segmentSummary: segSummary,
            segmentMeta: segMeta,
            segmentGrouped: segGrouped,
            segments: flatSegs
        });
        buttons.push({
            label: "👥 고객 세분화 상세 보기",
            color1: "#188038", color2: "#0070F2",
            url: "/customersegments/webapp/index.html",
            msgType: "segmentUpdate"
        });
    }

    function processToolData(toolData) {
        var buttons = [];
        if (!toolData || !Array.isArray(toolData) || toolData.length === 0) {
            return buttons;
        }
        toolData.forEach(function (td) {
            if (!td || !td.data) return;
            var d = td.data;
            var tn = td.toolName || "";

            if (tn === "search_reorder_products" || d["ML_예측_발주추천"] || (d.summary && d.summary.total_items)) {
                _processOrderRec(d, buttons);
            }
            if (tn === "run_demand_forecast" || (d.forecasts && !d["ML_예측_발주추천"])) {
                _processForecast(d, buttons);
            }
            if (tn === "run_churn_prediction" || d.high_risk_customers || d.high_risk_count) {
                _processChurn(d, buttons);
            }
            if (tn === "run_anomaly_detection" || d.top_anomalies || d.anomaly_count) {
                _processAnomaly(d, buttons);
            }
            if (tn === "run_customer_segmentation" && toolData.length === 1) {
                _processSegment(d, toolData.length, buttons);
            }
        });
        return buttons;
    }

    return {
        processToolData: processToolData
    };
});