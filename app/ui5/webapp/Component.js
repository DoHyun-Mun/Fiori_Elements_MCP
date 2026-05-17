sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, Device, JSONModel) {
    "use strict";

    return UIComponent.extend("storepjt.ui5.Component", {

        metadata: {
            manifest: "json"
        },

        init: function () {
            // 부모 init 호출
            UIComponent.prototype.init.apply(this, arguments);

            // device 모델 (반응형 지원)
            const oDeviceModel = new JSONModel(Device);
            oDeviceModel.setDefaultBindingMode("OneWay");
            this.setModel(oDeviceModel, "device");

            // app 모델 (Shell 상태 — 메뉴, 현재 선택, chat open 등)
            const oAppModel = new JSONModel({
                menu: { items: [] },
                selectedTopMenuId: null,
                selectedSubMenuId: null,
                chatOpen: false,
                sidebarCollapsed: false,
                currentUrl: ""
            });
            this.setModel(oAppModel, "app");

            // 라우터 초기화
            this.getRouter().initialize();
        }
    });
});