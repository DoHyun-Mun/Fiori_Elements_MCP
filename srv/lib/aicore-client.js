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
        name: 'gpt-4o',
        params: { temperature: 0.7, max_tokens: 4096 }
      },
      prompt: {
        template: [
          {
            role: 'system',
            content: `당신은 "Store AI 어시스턴트"입니다. 점포별 상품 재고 발주 관리 시스템의 AI 도우미입니다.
사용자의 질문에 대해 제공된 도구를 적극 활용하여 정확한 데이터 기반으로 답변하세요.
도구를 사용할 수 있는 경우 반드시 도구를 호출하여 실제 데이터를 조회한 후 답변하세요.
한국어로 답변하고, 데이터를 표 또는 목록 형식으로 깔끔하게 정리해주세요.
Tool 응답의 formatted_output 필드가 있으면, 반드시 그 텍스트를 그대로 복사하여 응답에 포함합니다. 어떠한 수정, 재배치, 생략도 금지합니다. formatted_output 내용이 최종 답변입니다.`
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