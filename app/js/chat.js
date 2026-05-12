// ═══════════════════════════════════════════════════════════════
// AI Chat Side Panel Logic
// ═══════════════════════════════════════════════════════════════
let chatHistory = [];
let chatOpen = false;
let chatSending = false;

function toggleChat() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('chatPanel');
    const tab = document.getElementById('chatToggleTab');
    const main = document.getElementById('main');
    if (chatOpen) { panel.classList.add('open'); tab.classList.add('hidden'); main.classList.add('chat-open'); document.getElementById('chatInput').focus(); }
    else { panel.classList.remove('open'); tab.classList.remove('hidden'); main.classList.remove('chat-open'); }
}
function handleChatKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }
function autoResizeInput(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 90) + 'px'; el.style.overflowY = el.scrollHeight > 90 ? 'auto' : 'hidden'; }

function appendMessage(role, content) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg ' + role;
    if (role === 'assistant') { msgDiv.innerHTML = renderMarkdown(content); }
    else if (role === 'system') { msgDiv.innerHTML = content; }
    else { msgDiv.textContent = content; }
    const container = document.getElementById('chatMessages');
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return msgDiv;
}

function renderMarkdown(text) {
    return text
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function setTyping(show) {
    document.getElementById('chatTyping').classList.toggle('show', show);
    if (show) { var c = document.getElementById('chatMessages'); c.scrollTop = c.scrollHeight; }
}

// ═══════════════════════════════════════════════════════════════
// 상세보기 버튼 헬퍼
// ═══════════════════════════════════════════════════════════════
function addDetailButton(msgDiv, label, color1, color2, url, msgType) {
    var btn = document.createElement("div");
    btn.style.cssText = "margin-top:8px;padding:8px 14px;background:linear-gradient(135deg," + color1 + "," + color2 + ");color:white;border-radius:8px;font-size:0.75rem;font-weight:600;cursor:pointer;display:block;width:fit-content;";
    btn.textContent = label;
    btn.onclick = function() {
        showContentFrame(url);
        highlightMenuForUrl(url);
        var frame = document.getElementById("contentFrame");
        frame.onload = function() { document.getElementById('frameLoader').classList.add('hidden'); setTimeout(function() { frame.contentWindow.postMessage({type: msgType}, "*"); }, 200); };
    };
    msgDiv.appendChild(btn);
}

// ═══════════════════════════════════════════════════════════════
// toolData 기반 데이터 처리 (JSON 직접 활용, 정규식 불필요)
// ═══════════════════════════════════════════════════════════════
function processToolData(toolData, msgDiv) {
    if (!toolData || !Array.isArray(toolData) || toolData.length === 0) return false;
    var processed = false;

    toolData.forEach(function(td) {
        if (!td.data) return;
        var d = td.data;
        var tn = td.toolName || "";
        console.log("[DEBUG] Processing toolData:", tn, Object.keys(d));

        // 1. 발주 추천 (search_reorder_products)
        if (tn === "search_reorder_products" || d.ML_예측_발주추천 || d["ML_예측_발주추천"] || (d.summary && d.summary.total_items)) {
            var recTable = [];
            var mlRec = d.ML_예측_발주추천 || d["ML_예측_발주추천"];
            if (mlRec && mlRec.recommendations) {
                recTable = mlRec.recommendations.map(function(r) {
                    return { product: r.product_name||r.name||"", currentStock: r.current_stock||0, mlDemand: r.ml_demand||r.daily_demand||null, rptDemand: r.forecast_daily||r.rpt_demand||null, diff: r.forecast_diff_pct || null, recommendQty: r.recommended_qty||r.quantity||0, urgency: r.urgency||r.priority||"MEDIUM" };
                });
            }
            var analysisItems = [];
            var reasonsD = d["발주_사유_분석"] || d.발주_사유_분석;
            if (reasonsD && reasonsD.explanations) {
                analysisItems = reasonsD.explanations.map(function(e) {
                    return {
                        product: e.product_name||e.name||"",
                        store: e.store_name||"",
                        urgency: e.urgency||"",
                        summary: e.summary||"",
                        reasons: e.reasons||[],
                        timeseries: e["시계열_분석"]||e.시계열_분석||{},
                        externalFactors: e["외부_요인_영향"]||e.외부_요인_영향||{},
                        whatIfNot: e.what_if_not_ordered||e["what_if_not_ordered"]||"",
                        recommendedAction: e.recommended_action||e["recommended_action"]||""
                    };
                });
            }
            var ext = d["외부_요인_데이터"]||d.외부_요인_데이터||{};
            var judge = d["AI_종합_판단"]||d.AI_종합_판단||{};
            var rpt = d["RPT1_AI_예측"]||d.RPT1_AI_예측||{};
            var fa = d.filter_applied||{};
            // 점포명: filter_applied.store_id가 UUID일 수 있으므로, recommendations에서 store_name 추출 우선
            var mlRecs = (mlRec && mlRec.recommendations) || [];
            var sn = (mlRecs.length > 0 && mlRecs[0].store_name) ? mlRecs[0].store_name : (fa.store_id||d.store_name||"");
            localStorage.setItem("orderRecommendationData", JSON.stringify({
                meta: "AI 발주 추천 | "+(sn||"전체")+" | "+new Date().toLocaleString("ko-KR"), storeName: sn, summary: d.summary||{}, table: recTable,
                timeseries: {},
                rpt: {},
                external: { day: ext["요일"]||"", season: ext["계절"]||"", news: ext["뉴스_트렌드"]||"", weather: ext["날씨"]||"", holiday: ext["공휴일"]||"", payday: ext["급여일"]||"" },
                analysis: analysisItems, reasons: [],
                aiJudgment: { conclusion: judge["결론"]||"", confidence: judge["신뢰도"]||"", recommendation: judge["권고"]||"" }
            }));
            addDetailButton(msgDiv, "📋 발주 추천 상세 보기", "#E37400", "#D93025", "/orderrecommendations/webapp/index.html", "recommendationUpdate");
            processed = true;
        }

        // 2. 수요 예측 (run_demand_forecast)
        if (tn === "run_demand_forecast" || (d.forecasts && !d.ML_예측_발주추천)) {
            var rawForecasts = d.forecasts||d.predictions||d.forecast_table||d.forecast_data||[];
            var ft = rawForecasts.map(function(r) {
                return { date: (r.ds||r.date||"").substring(0,10), forecast: Math.round(r.hybrid_forecast||r.forecast||r.qty||0), low: Math.round(r.yhat_lower||r.low||r.confidence_low||0), high: Math.round(r.yhat_upper||r.high||r.confidence_high||0) };
            });
            var fTarget = d.forecast_target||{};
            var fsn = fTarget.store||d.store_name||d.storeName||"";
            var fpn = fTarget.product||d.product_name||d.productName||"";
            if (!fsn && fTarget.scope) {
                // "전체 점포/상품 합산" 형태 파싱
                var scopeParts = fTarget.scope.split("/");
                if (scopeParts.length >= 1) fsn = scopeParts[0].replace("전체","").trim() || fTarget.scope;
            }
            var fk = d.kpi||d.metrics||{};
            // 예측 사유 분석에서 추세 추출
            var reasonAnalysis = d["예측_사유_분석"]||d.예측_사유_분석;
            var trendFromAnalysis = "";
            if (reasonAnalysis && reasonAnalysis["시계열_분석"]) {
                var tsA = reasonAnalysis["시계열_분석"];
                if (tsA["추세_변화율"]) trendFromAnalysis = tsA["추세_변화율"];
                else if (tsA["추세"]) trendFromAnalysis = tsA["추세"];
            }
            // 예측 사유 분석 파싱
            var fa2 = [];
            if (reasonAnalysis) {
                if (reasonAnalysis["시계열_분석"]) fa2.push({title:"📊 시계열 분석", items: Object.entries(reasonAnalysis["시계열_분석"]).map(function(kv){return kv[0]+": "+kv[1];})});
                if (reasonAnalysis["외부_요인_영향"]) fa2.push({title:"🌍 외부 요인", items: Object.entries(reasonAnalysis["외부_요인_영향"]).map(function(kv){return kv[0]+": "+kv[1];})});
                if (reasonAnalysis["예측_신뢰도"]) fa2.push({title:"🎯 예측 신뢰도", items: Object.entries(reasonAnalysis["예측_신뢰도"]).map(function(kv){return kv[0]+": "+kv[1];})});
                if (reasonAnalysis["핵심_예측_사유"]) fa2.push({title:"💡 핵심 사유", items: reasonAnalysis["핵심_예측_사유"]});
            }
            var avg = ft.length>0?(ft.reduce(function(s,r){return s+r.forecast;},0)/ft.length).toFixed(1):"-";
            var pk = ft.length>0?ft.reduce(function(m,r){return r.forecast>m.forecast?r:m;},ft[0]):null;
            // RPT-1 예측 데이터
            var rptForecast = d["RPT1_AI_예측"]||d.RPT1_AI_예측||null;
            // 외부 요인 수집 데이터
            var extFactors = d.external_factors_collected||d["external_factors_collected"]||null;
            localStorage.setItem("forecastData", JSON.stringify({
                meta: "AI 예측 결과 | "+(fsn||"")+" / "+(fpn||"")+" | "+new Date().toLocaleString("ko-KR"),
                storeName: fsn, productName: fpn,
                kpi: { avg: avg, trend: fk.trend||trendFromAnalysis||"-", peak: pk?(pk.date||"").slice(5):"-", model: d.model_name||d.forecast_days ? d.forecast_days+"일" : (d.model||"AI") },
                table: ft, analysis: fa2.length>0?fa2:[{title:"📊 분석 요약",items:["데이터 기반 예측 완료"]}],
                rpt1: rptForecast,
                externalFactors: extFactors
            }));
            addDetailButton(msgDiv, "📊 예측 결과 상세 보기", "#0070F2", "#6B4FBB", "/demandforecasts/webapp/index.html", "forecastUpdate");
            processed = true;
        }

        // 3. 이탈 예측 (run_churn_prediction)
        if (tn === "run_churn_prediction" || d.high_risk_customers || d.high_risk_count) {
            var rawCusts = d.high_risk_customers||d.churn_results||d.customers||[];
            var custs = rawCusts.map(function(c) {
                return { code: c.CUSTOMER_CODE||c.customer_code||c.code||"", name: c.NAME||c.customer_name||c.name||"", age: c.AGE_GROUP||c.age_group||c.age||"", membership: c.MEMBERSHIP_TYPE||c.membership_type||c.membership||"", city: c.CITY||c.city||"", probability: c.churn_probability||c.churn_score||c.probability||"", risk: c.churn_risk||c.risk||"", factor: c.churn_reason||c.main_factor||c.factor||"", store: c.PREFERRED_STORE||c.preferred_store||c.store||"", payment: c.MAIN_PAYMENT||c.main_payment||c.payment||"" };
            });
            var pf = d.metrics||d.performance||d.model_performance||{};
            var fcts = d.top_features||d.factors||d.main_factors||[];
            if (Array.isArray(fcts) && fcts.length > 0 && Array.isArray(fcts[0])) {
                // top_features는 [[name, importance], ...] 형태
                fcts = fcts.filter(function(f){return f[1]>0;}).map(function(f){return f[0]+": "+f[1];});
            }
            if (typeof fcts==='object'&&!Array.isArray(fcts)) fcts=Object.entries(fcts).map(function(kv){return kv[0]+": "+kv[1];});
            var csn = d.store_name||d.storeName||"";
            localStorage.setItem("churnPredictionData", JSON.stringify({
                meta: "이탈 예측 | "+(csn||"전체")+" | "+new Date().toLocaleString("ko-KR"), storeName: csn,
                totalCustomers: (d.total_customers||custs.length)+"명",
                churnCustomers: (d.high_risk_count||custs.length)+"명",
                churnRate: (d.high_risk_rate||d.churn_rate||"-")+"%", accuracy: pf.accuracy||"-",
                performance: { accuracy: pf.accuracy||"-", precision: pf.precision||"-", recall: pf.recall||"-", f1: pf.f1||pf.f1_score||"-", auc: pf.auc_roc||pf.auc||"-" },
                customers: custs, factors: fcts
            }));
            addDetailButton(msgDiv, "⚠️ 이탈 예측 상세 보기", "#D93025", "#7B2FF2", "/churnpredictions/webapp/index.html", "churnUpdate");
            processed = true;
        }

        // 4. 이상 탐지 (run_anomaly_detection)
        if (tn === "run_anomaly_detection" || d.top_anomalies || d.anomaly_count) {
            var anomAnalysis = d["이상_탐지_분석"]||d.이상_탐지_분석||{};
            // 이상_탐지_분석.이상_항목_상세 우선 사용 (한국어 키, 상품명 포함)
            var rawItems = anomAnalysis["이상_항목_상세"]||d.top_anomalies||d.anomalies||[];
            var ai = rawItems.map(function(a) {
                return { date: a["날짜"]||(a.SALES_DATE||a.date||"").substring(0,10), product: a["상품명"]||a.PRODUCT_ID||a.product||"", qty: a["판매량"]||a.quantity||a.revenue||"", change: String(a["정상_범위_대비"]||a.revenue_zscore||a.change||"-"), type: a["유형"]||a.anomaly_type||a.type||"", severity: a["심각도"]||a.severity||"" };
            });
            var asn = anomAnalysis["점포명"]||d.store_name||d.storeName||"";
            var ar = anomAnalysis["탐지_사유"]||d.reasons||[];
            var arec = anomAnalysis["권고_사항"]||d.recommendations||[];
            if(typeof ar==='string')ar=[ar]; if(typeof arec==='string')arec=[arec];
            localStorage.setItem("salesAnomalyData", JSON.stringify({
                meta: "이상 탐지 | "+(asn||"전체")+" | "+new Date().toLocaleString("ko-KR"), store: asn||"-",
                target: anomAnalysis["분석_대상"]||d.model||"매출 이상 탐지", totalRecords: (d.input_records||"-")+"건",
                anomalyCount: (d.anomaly_count||rawItems.length)+"건", anomalyRate: (d.anomaly_rate||"-")+"%",
                byType: d.by_type||{}, bySeverity: d.by_severity||{},
                items: ai, reasons: ar, recommendations: arec
            }));
            addDetailButton(msgDiv, "🚨 이상 탐지 상세 보기", "#E37400", "#D93025", "/salesanomalies/webapp/index.html", "anomalyUpdate");
            processed = true;
        }

        // 5. 고객 세분화 (run_customer_segmentation 단독 호출일 때만)
        if (tn === "run_customer_segmentation" && toolData.length === 1) {
            var rawSegs = d.segments||d.customer_segments||[];
            var segSummary = {};
            var segGrouped = null; // 그룹핑된 데이터 (객체 형태)
            var flatSegs = []; // 평면 배열

            // segments가 객체(그룹핑)인지 배열인지 확인
            if (rawSegs && !Array.isArray(rawSegs) && typeof rawSegs === 'object') {
                // 그룹핑된 객체: { "VIP_Champions": [...], "At_Risk": [...] }
                segGrouped = rawSegs;
                Object.keys(rawSegs).forEach(function(name) {
                    var customers = rawSegs[name] || [];
                    segSummary[name] = { count: customers.length, avgRfm: 0, totalRfm: 0 };
                    customers.forEach(function(c) {
                        segSummary[name].totalRfm += (c.rfm_score||c.rfmScore||0);
                        flatSegs.push({ segment_name: name, rfm_score: c.rfm_score||c.rfmScore||0, NAME: c.NAME||c.name||"", AGE_GROUP: c.AGE_GROUP||c.age_group||"", MEMBERSHIP_TYPE: c.MEMBERSHIP_TYPE||c.membership_type||"", CITY: c.CITY||c.city||"" });
                    });
                    segSummary[name].avgRfm = customers.length > 0 ? (segSummary[name].totalRfm / customers.length).toFixed(1) : "0";
                });
            } else {
                // 기존 배열 형태
                flatSegs = Array.isArray(rawSegs) ? rawSegs : [];
                flatSegs.forEach(function(s) {
                    var name = s.segment_name||s.segmentName||"Unknown";
                    if (!segSummary[name]) segSummary[name] = { count: 0, avgRfm: 0, totalRfm: 0 };
                    segSummary[name].count++;
                    segSummary[name].totalRfm += (s.rfm_score||s.rfmScore||0);
                });
                Object.keys(segSummary).forEach(function(k) { segSummary[k].avgRfm = (segSummary[k].totalRfm / segSummary[k].count).toFixed(1); });
            }

            var totalCustomers = flatSegs.length;
            var metrics = d.metrics||{};
            // AI 생성 마케팅 전략 (segment_meta)
            var segMeta = d.segment_meta||d["segment_meta"]||null;
            localStorage.setItem("customerSegmentData", JSON.stringify({
                meta: "고객 세분화 | "+new Date().toLocaleString("ko-KR"),
                totalCustomers: totalCustomers+"명",
                nClusters: metrics.n_clusters||Object.keys(segSummary).length,
                modelName: d.model_name||metrics.model_name||"-",
                segmentSummary: segSummary,
                segmentMeta: segMeta,
                segmentGrouped: segGrouped,
                segments: flatSegs
            }));
            addDetailButton(msgDiv, "👥 고객 세분화 상세 보기", "#188038", "#0070F2", "/customersegments/webapp/index.html", "segmentUpdate");
            processed = true;
        }
    });
    return processed;
}

// ═══════════════════════════════════════════════════════════════
// 메시지 전송
// ═══════════════════════════════════════════════════════════════
async function sendChatMessage() {
    if (chatSending) return;
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    input.value = ''; input.style.height = 'auto';
    appendMessage('user', message);
    chatSending = true;
    document.getElementById('chatSendBtn').disabled = true;
    setTyping(true);

    try {
        const response = await fetch('/chat/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, history: chatHistory })
        });
        const data = await response.json();
        if (data.success !== false && data.reply) {
            var msgDiv = appendMessage('assistant', data.reply);
            chatHistory.push({ role: 'user', content: message });
            chatHistory.push({ role: 'assistant', content: data.reply });
            if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

            // [NAVIGATE:url] 패턴 감지 → 메뉴 이동 버튼 생성
            var navMatch = (data.reply || '').match(/\[NAVIGATE:(\/[^\]]+)\]/);
            if (navMatch) {
                data.reply = data.reply.replace(/\[NAVIGATE:[^\]]+\]/g, '').trim();
                msgDiv.innerHTML = renderMarkdown(data.reply);
                addDetailButton(msgDiv, "📂 해당 메뉴로 이동", "#0070F2", "#4CAF50", navMatch[1], "navigate");
            }

            // toolData가 있으면 JSON 기반으로 처리 (정규식 불필요)
            var toolData = data.toolData ? (typeof data.toolData === 'string' ? JSON.parse(data.toolData) : data.toolData) : null;
            console.log("[DEBUG] toolData received:", toolData ? JSON.stringify(toolData).substring(0, 300) : "none");
            if (toolData) {
                processToolData(toolData, msgDiv);
            }
        } else {
            appendMessage('system', '&#x26A0;&#xFE0F; ' + (data.error || '응답을 받을 수 없습니다.'));
        }
    } catch (error) {
        appendMessage('system', '&#x26A0;&#xFE0F; 네트워크 오류가 발생했습니다.');
    } finally {
        chatSending = false;
        document.getElementById('chatSendBtn').disabled = false;
        setTyping(false);
    }
}

// ═══════════════════════════════════════════════════════════════
// Chat Panel Resize
// ═══════════════════════════════════════════════════════════════
(function() {
    var handle = document.getElementById("chatResizeHandle");
    var panel = document.getElementById("chatPanel");
    var main = document.getElementById("main");
    var MIN_W = 300, MAX_W = 800;
    var isResizing = false, startX, startWidth;
    if (!handle) return;
    handle.addEventListener("mousedown", function(e) {
        isResizing = true; startX = e.clientX; startWidth = panel.offsetWidth;
        panel.classList.add("resizing"); main.classList.add("chat-resizing");
        document.body.classList.add("chat-resizing"); handle.classList.add("active");
        e.preventDefault();
    });
    document.addEventListener("mousemove", function(e) {
        if (!isResizing) return;
        var diff = startX - e.clientX;
        var nw = Math.min(MAX_W, Math.max(MIN_W, startWidth + diff));
        panel.style.width = nw + "px";
        main.style.marginRight = nw + "px";
        document.documentElement.style.setProperty("--chat-width", nw + "px");
    });
    document.addEventListener("mouseup", function() {
        if (!isResizing) return;
        isResizing = false;
        panel.classList.remove("resizing"); main.classList.remove("chat-resizing");
        document.body.classList.remove("chat-resizing"); handle.classList.remove("active");
    });
})();
