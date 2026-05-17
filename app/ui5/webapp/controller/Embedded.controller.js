sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent"
], function (Controller, UIComponent) {
    "use strict";

    return Controller.extend("storepjt.ui5.controller.Embedded", {

        onInit: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("embedded").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var sAppPath = oEvent.getParameter("arguments").appPath;
            if (!sAppPath) return;
            try {
                sAppPath = decodeURIComponent(sAppPath);
            } catch (e) { /* noop */ }
            this._setIframeSrc(sAppPath);
        },

        _setIframeSrc: function (sUrl) {
            var that = this;
            var sFinalUrl = this._resolveAppUrl(sUrl);
            var fnApply = function () {
                var iframe = document.getElementById("ui5ContentFrame");
                if (iframe) {
                    var bChanged = iframe.src !== sFinalUrl;
                    if (bChanged) {
                        // load 시 pending postMessage 발사
                        iframe.onload = function () {
                            try {
                                var oAppCtrl = that._getAppController();
                                if (oAppCtrl && oAppCtrl.consumePendingFramePost) {
                                    var pending = oAppCtrl.consumePendingFramePost(sUrl);
                                    if (pending && pending.msgType) {
                                        setTimeout(function () {
                                            try {
                                                iframe.contentWindow.postMessage({ type: pending.msgType }, "*");
                                            } catch (e) { /* noop */ }
                                        }, 200);
                                    }
                                }
                            } catch (e) { /* noop */ }
                        };
                        iframe.src = sFinalUrl;
                    } else {
                        // URL 동일 → load 안 됨. 즉시 postMessage 발사.
                        try {
                            var oAppCtrl = that._getAppController();
                            if (oAppCtrl && oAppCtrl.consumePendingFramePost) {
                                var pending = oAppCtrl.consumePendingFramePost(sUrl);
                                if (pending && pending.msgType && iframe.contentWindow) {
                                    iframe.contentWindow.postMessage({ type: pending.msgType }, "*");
                                }
                            }
                        } catch (e) { /* noop */ }
                    }
                } else {
                    setTimeout(fnApply, 50);
                }
            };
            fnApply();
        },

        _getAppController: function () {
            // App.view (root) 컨트롤러 획득
            var oComponent = this.getOwnerComponent();
            if (!oComponent) return null;
            var oRootView = oComponent.getRootControl && oComponent.getRootControl();
            if (oRootView && oRootView.getController) {
                return oRootView.getController();
            }
            return null;
        },

        _resolveAppUrl: function (sUrl) {
            if (!sUrl) return "about:blank";
            // 절대 URL이면 그대로
            if (/^https?:\/\//i.test(sUrl)) return sUrl;
            // 로컬 개발 환경 감지: UI5 dev server는 보통 8080. CAP은 4004.
            var sHost = window.location.hostname;
            var sPort = window.location.port;
            var bIsLocalDev = (sHost === "localhost" || sHost === "127.0.0.1") && sPort && sPort !== "4004";
            if (bIsLocalDev) {
                // /customers/webapp/index.html → http://localhost:4004/customers/webapp/index.html
                if (sUrl.charAt(0) !== "/") sUrl = "/" + sUrl;
                return "http://localhost:4004" + sUrl;
            }
            // 운영(approuter same-origin) 또는 cds watch 단독: 상대 경로 그대로
            return sUrl;
        }
    });
});