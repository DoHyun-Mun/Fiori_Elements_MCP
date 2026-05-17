// Phase 8-2 v11: Chat.controller.js는 더 이상 사용되지 않습니다.
// 사이드 패널로 회귀하면서 모든 chat 관련 로직이 App.controller.js로 통합되었습니다.
// 본 모듈은 manifest.json/Component.js의 dependency 호환을 위해 유지만 하는 placeholder.
sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";
    return Controller.extend("storepjt.ui5.controller.Chat", {});
});