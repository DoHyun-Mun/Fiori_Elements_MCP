/**
 * ChatService - AI Core Orchestration + MCP Tool Calling 채팅 서비스
 */
service ChatService @(path: '/chat') {

  /**
   * 채팅 메시지 전송
   */
  type ChatMessage {
    role    : String;    // 'user' | 'assistant' | 'system'
    content : String;
  }

  action sendMessage(
    message : String,
    history : array of ChatMessage
  ) returns {
    reply    : String;
    success  : Boolean;
    error    : String;
    toolData : LargeString;
  };

  /**
   * 서비스 상태 확인
   */
  function healthCheck() returns {
    status   : String;
    aicore   : Boolean;
    mcpTools : Integer;
  };
}