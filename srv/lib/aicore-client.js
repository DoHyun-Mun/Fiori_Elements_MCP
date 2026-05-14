/**
 * AI Core Client - @sap-ai-sdk/orchestration (new API)
 * promptTemplating + MCP Tool Calling Loop
 */
const { OrchestrationClient } = require('@sap-ai-sdk/orchestration');
const LOG = require('@sap/cds').log('aicore');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://mcp-tools.c56380c.kyma.ondemand.com';

// ═══════════════════════════════════════════════════════════════
// MCP Client
// ═══════════════════════════════════════════════════════════════
let _toolsCache = null, _toolsCacheExpiry = 0;

async function listTools() {
  const now = Date.now();
  if (_toolsCache && _toolsCacheExpiry > now) return _toolsCache;
  LOG.info(`MCP Tool definitions 로딩: ${MCP_SERVER_URL}/tools/definitions`);
  const response = await fetch(`${MCP_SERVER_URL}/tools/definitions`);
  if (!response.ok) throw new Error(`MCP 서버 응답 오류: ${response.status}`);
  const data = await response.json();
  _toolsCache = data.tools || [];
  _toolsCacheExpiry = now + 300000;
  LOG.info(`MCP Tool ${_toolsCache.length}개 로드 완료`);
  return _toolsCache;
}

async function callTool(name, args) {
  LOG.info(`MCP Tool 실행: ${name}`, JSON.stringify(args).substring(0, 200));
  const response = await fetch(`${MCP_SERVER_URL}/tools/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!response.ok) {
    const errText = await response.text();
    LOG.error(`MCP Tool 실행 실패 (${name}):`, response.status);
    return { error: `도구 실행 실패: ${response.status}`, details: errText.substring(0, 300) };
  }
  const result = await response.json();
  LOG.info(`MCP Tool 결과 (${name}): ${JSON.stringify(result).substring(0, 200)}...`);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// Orchestration + Tool Calling Loop
// ═══════════════════════════════════════════════════════════════
async function chat(userMessage, history = []) {
  // 구조화 데이터 수집 (MCP Tool 응답에서 추출)
  const _toolResults = [];

  // 1. MCP Tool 목록 → OpenAI function-calling 스키마
  const mcpTools = await listTools();
  const tools = mcpTools.map(t => ({
    type: 'function',
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters
    }
  }));

  // 2. OrchestrationClient 생성 (tools를 prompt 안에 포함)
  const client = new OrchestrationClient({
    promptTemplating: {
      model: {
        name: 'anthropic--claude-4.6-sonnet',
        params: { temperature: 0.7, max_tokens: 4096 }
      },
      prompt: {
        template: [
          {
            role: 'system',
            content: `당신은 "Store AI 어시스턴트"입니다. Store AI 시스템의 AI 도우미입니다.
            현재 날짜: ${new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric',weekday:'long'})} (${new Date().toLocaleTimeString('ko-KR')})
            1.사용자의 질문에 대해 제공된 도구를 적극 활용하여 정확한 데이터 기반으로 답변하세요.
            2.도구를 사용할 수 있는 경우 반드시 도구를 호출하여 실제 데이터를 조회한 후 답변하세요.
            3.한국어로 답변하세요. 데이터를 표로 보여줄 때는 반드시 마크다운 테이블 형식(| col1 | col2 | 와 |---|---| 구분선)을 사용하세요. 탭이나 공백 정렬은 금지합니다.
            4.Tool 응답의 formatted_output 필드가 있으면, 반드시 그 텍스트를 그대로 복사하여 응답에 포함합니다. 어떠한 수정, 재배치, 생략도 금지합니다. formatted_output 내용이 최종 답변입니다.
            5. "~가능하니?", "~할 수 있어?" 같은 가능여부 질문 → Tool 호출 없이 "가능합니다" 답변
            6. "~해줘", "~생성해" 같은 실행 요청에만 Tool 호출
            7. CREATE/UPDATE/DELETE → 먼저 confirm=false로 미리보기
            8. confirm_required 응답 → 사용자에게 미리보기 보여주고 확인 요청
            9. 사용자 "네/실행/해줘" 같은 긍정 답변 → 대화 히스토리에서 직전 confirm_required 미리보기의 동일한 entity, operation, entity_id, data를 사용하여 confirm=true로 odata_crud Tool 재호출. 절대 처음부터 다시 조회(READ)하지 말 것.
            10. 사용자 "취소, 멈춰, 아니, 싫어와 같은 부정 답변" → 실행 안 함
            11. 엔티티 생성 요청 시, 필수 필드 중 사용자가 제공하지 않은 정보를 먼저 질문하고, 모든 필수 정보가 확보된 후 odata_crud Tool 호출
            12. 주요 지원 업무 
            ### 1. odata_crud : 모든 엔티티에 대한 CRUD (생성/조회/수정/삭제)
            지원 엔티티:
            - [기본] Stores, Products, Categories, Customers, Suppliers, Inventories, DailySales, CustomerPurchases, CustomerPurchaseItems, PurchaseOrders
            - [SCM/물류] DistributionCenters, GoodsReceipts, GoodsReceiptItems, TransferOrders, TransferOrderItems, StoreReceipts, StoreReceiptItems, Invoices, InvoiceItems
            - [기타] MenuItems, Materials, StoreProducts, InventorySnapshots, DemandForecasts, ChurnPredictions, CustomerSegments, SalesAnomalies, OrderRecommendations
            파라미터: entity, operation(READ/CREATE/UPDATE/DELETE), filters, entity_id, data, top, confirm, orderby, expand, apply, select

            주요 기능:
            - entity_id에 비즈니스 코드(GR-xxx, TO-xxx) 입력 시 자동 UUID 변환
            - CREATE/UPDATE 시 잘못된 필드명 자동 검증 (올바른 필드 힌트 제공)
            - $apply 집계 지원 (filter+apply 자동 합치기)
            - CAP Draft 워크플로우 자동 처리 (draftEdit→PATCH→draftActivate)
            - confirm=false → 미리보기, confirm=true → 실행

            ### 2. query_sales
            일별 매출 데이터 조회 (점포/상품별, 기간별) 파라미터: store_id, product_id, start_date, end_date, limit

            ### 3. query_customers
            고객 정보 및 구매이력 조회 파라미터: customer_id, membership_type, city, include_purchases, limit

            ### 4. search_products
            상품 검색 (키워드 또는 Vector 유사도) 파라미터: keyword, category, use_vector, limit

            ### 5. graph_co_purchase
            HANA Graph — 함께 구매되는 상품 분석 파라미터: product_id, top_n

            ### 6. graph_supply_chain
            HANA Graph — 공급망 의존도 분석 파라미터: supplier_id, analysis_type(dependency/trace)

            ### 7. vector_search
            HANA Vector Engine — 유사도 검색 파라미터: query, search_type(products/reports), top_k

            ### 8. run_demand_forecast
            수요 예측 (Prophet+XGBoost 하이브리드) 파라미터: store_id, product_id, forecast_days

            ### 9. run_anomaly_detection
            매출 이상 탐지 파라미터: store_id, metric(REVENUE/QUANTITY/PROFIT)

            ### 10. run_churn_prediction
            고객 이탈 예측 파라미터: segment, age_group, membership_type, city

            ### 11. run_customer_segmentation
            고객 세분화 (KMeans + RFM) 파라미터: 없음

            ### 12. search_reorder_products
            발주 필요 상품 검색 (Safety Stock + EOQ + 수요예측) 파라미터: store_id, urgency(CRITICAL/HIGH/MEDIUM/LOW), category, limit

            ## 메뉴 네비게이션 규칙
            메뉴/화면 위치를 안내할 때, 응답 마지막에 [NAVIGATE:URL경로]를 반드시 포함하세요.
            - 상품 관리: [NAVIGATE:/products/webapp/index.html]
            - 분류 관리: [NAVIGATE:/categories/webapp/index.html]
            - 자재 관리: [NAVIGATE:/materials/webapp/index.html]
            - 점포 관리: [NAVIGATE:/stores/webapp/index.html]
            - 공급업체: [NAVIGATE:/suppliers/webapp/index.html]
            - 물류센터: [NAVIGATE:/distributioncenters/webapp/index.html]
            - 발주 관리: [NAVIGATE:/purchaseorders/webapp/index.html]
            - 입고검수: [NAVIGATE:/goodsreceipts/webapp/index.html]
            - 인보이스: [NAVIGATE:/invoices/webapp/index.html]
            - 배송지시: [NAVIGATE:/transferorders/webapp/index.html]
            - 점포입고: [NAVIGATE:/storereceipts/webapp/index.html]
            - 재고 관리: [NAVIGATE:/inventories/webapp/index.html]
            - 고객 관리: [NAVIGATE:/customers/webapp/index.html]
            - 구매 이력: [NAVIGATE:/customerpurchases/webapp/index.html]
            - 일별 매출: [NAVIGATE:/dailysales/webapp/index.html]
            - 수요 예측: N/A
            - 발주 추천: N/A
            - 이탈 예측: N/A
            - 고객 세분화: N/A
            - 이상 탐지: N/A
            - 메뉴 관리: [NAVIGATE:/menus/webapp/index.html]`
          }
        ],
        tools: tools
      }
    }
  });

  // 3. 메시지 히스토리 구성
  const messagesHistory = [
    ...history,
    { role: 'user', content: userMessage }
  ];

  // 4. 첫 번째 호출
  LOG.info(`Orchestration SDK 호출 (tools: ${tools.length}개)`);

  let response = await client.chatCompletion({
    messagesHistory: messagesHistory
  });

  // 5. Tool Call 루프 (최대 5회)
  let loopCount = 0;
  const MAX_LOOPS = 5;

  while (loopCount < MAX_LOOPS) {
    let toolCalls = null;

    // getToolCalls() 시도
    try {
      toolCalls = response.getToolCalls?.();
    } catch (e) {
      LOG.warn('getToolCalls 실패:', e.message);
    }

    if (!toolCalls || toolCalls.length === 0) break;

    LOG.info(`Tool calls ${toolCalls.length}개 감지, 루프 #${loopCount + 1}`);

    // 각 tool call 실행 & messagesHistory에 추가
    // assistant의 tool_calls 메시지를 한 번만 추가
    messagesHistory.push({
      role: 'assistant',
      content: '',
      tool_calls: toolCalls
    });

    for (const call of toolCalls) {
      const fnName = call.function.name;
      const fnArgs = JSON.parse(call.function.arguments || '{}');
      const toolResult = await callTool(fnName, fnArgs);

      // 구조화 데이터 수집 (result 필드에 recommendations, predictions 등이 있는 경우)
      if (toolResult && toolResult.result && typeof toolResult.result === 'object') {
        _toolResults.push({ toolName: fnName, data: toolResult.result });
      }

      messagesHistory.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(toolResult)
      });
    }

    // 재호출 (messagesHistory만)
    response = await client.chatCompletion({
      messagesHistory: messagesHistory
    });

    loopCount++;
  }

  // 6. 최종 응답 추출
  let finalContent = null;
  try {
    finalContent = response.getContent?.();
  } catch (e) {
    LOG.warn('getContent 실패:', e.message);
  }

  if (!finalContent) {
    // 직접 파싱 fallback
    const raw = response.data || response;
    finalContent = raw?.module_results?.llm?.choices?.[0]?.message?.content
      || raw?.orchestration_result?.choices?.[0]?.message?.content
      || raw?.choices?.[0]?.message?.content;
  }

  if (!finalContent) {
    LOG.warn('응답 파싱 실패');
    finalContent = '응답을 처리할 수 없습니다.';
  }

  // 구조화 데이터가 있으면 응답과 함께 반환
  if (_toolResults.length > 0) {
    return { reply: finalContent, toolData: _toolResults };
  }
  return finalContent;
}

// Export
async function getToolDefinitions() { return await listTools(); }
module.exports = { chat, getToolDefinitions, listTools, callTool };