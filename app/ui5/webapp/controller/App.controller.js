sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/UIComponent",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/CustomListItem",
    "sap/m/VBox",
    "sap/m/Text",
    "sap/ui/core/HTML",
    "storepjt/ui5/model/chatProcessor"
], function (Controller, JSONModel, UIComponent, Fragment, MessageToast, CustomListItem, VBox, Text, HTML, chatProcessor) {
    "use strict";

    // 대분류 code별 아이콘 매핑 (sap-icon)
    var MENU_ICONS = {
        MASTER: "sap-icon://database",
        PROCURE: "sap-icon://cart",
        LOGISTICS: "sap-icon://shipping-status",
        SALES: "sap-icon://line-chart",
        AI: "sap-icon://artificial-intelligence",
        SYSTEM: "sap-icon://settings"
    };

    // marked.js는 index.html에서 self-host(`lib/marked.min.js`)로 sap-ui-bootstrap 전에
    // 동기 로드됨. 여기서는 별도 처리 불필요 (race condition / AMD 분기 충돌 방지).

    function fmtTime() {
        var d = new Date();
        var h = String(d.getHours()).padStart(2, "0");
        var m = String(d.getMinutes()).padStart(2, "0");
        return h + ":" + m;
    }

    return Controller.extend("storepjt.ui5.controller.App", {

        onInit: function () {
            // app 모델 (메뉴 + chat panel 토글)
            this._oAppModel = this.getOwnerComponent().getModel("app");
            if (!this._oAppModel) {
                this._oAppModel = new JSONModel({});
                this.getOwnerComponent().setModel(this._oAppModel, "app");
            }
            this._oAppModel.setData({
                menu: { roots: [], sideItems: [], activeTopId: null, allTree: [] },
                chatOpen: true
            });

            // chat 모델 (메시지/입력값/sending) — view에 직접 set
            this._oChatModel = new JSONModel({
                messages: [],
                history: [],
                inputValue: "",
                sending: false
            });
            this.getView().setModel(this._oChatModel, "chat");

            // 환영 메시지
            this._appendChatMessage(
                "assistant",
                "안녕하세요! Store AI입니다.\n\n다음과 같이 물어보실 수 있어요:\n- 전체 점포 발주 추천 보여줘\n- 강남 본점 미니PC 수요 예측해줘\n- 이탈 예측해줘\n- 고객 세분화 분석 해줘\n- 강남 본점 매출 이상 탐지 해줘"
            );

            this._clearAILocalStorage();
            this._loadMenu();

            this._oRouter = UIComponent.getRouterFor(this);

            // postMessage 핸들러 (iframe → Shell)
            this._messageHandler = this._onWindowMessage.bind(this);
            window.addEventListener("message", this._messageHandler);
        },

        onExit: function () {
            if (this._messageHandler) {
                window.removeEventListener("message", this._messageHandler);
            }
        },

        onAfterRendering: function () {
            this._attachLogoClick();
            this._ensureChatClickDelegate();
        },

        _attachLogoClick: function () {
            if (this._logoClickAttached) return;
            var oLogo = this.byId("topLogoBox");
            if (!oLogo) return;
            var oDom = oLogo.getDomRef();
            if (!oDom) return;
            var that = this;
            oDom.style.cursor = "pointer";
            oDom.title = "대시보드로 이동";
            oDom.addEventListener("click", function () { that.onLogoPress(); });
            this._logoClickAttached = true;
        },

        // ---------- 메뉴 로딩 / 트리 변환 ----------

        _loadMenu: function () {
            var that = this;
            var sUrl = "/inventory/MenuItems?$filter=isActive eq true&$orderby=sortOrder asc&$select=ID,code,title,level,url,parent_ID,sortOrder";
            fetch(sUrl)
                .then(function (r) {
                    if (!r.ok) { throw new Error("HTTP " + r.status); }
                    return r.json();
                })
                .then(function (data) {
                    var items = (data && data.value) || [];
                    var tree = that._buildMenuTree(items);
                    var roots = tree.map(function (n) {
                        return {
                            ID: n.ID,
                            code: n.code,
                            title: n.title || n.code,
                            icon: MENU_ICONS[n.code] || "sap-icon://folder"
                        };
                    });
                    var oData = that._oAppModel.getData();
                    oData.menu.allTree = tree;
                    oData.menu.roots = roots;
                    oData.menu.sideItems = [];
                    that._oAppModel.setData(oData);
                    if (tree.length > 0) {
                        that._selectTop(tree[0].ID);
                    }
                    that._refreshTopActiveClass();
                })
                .catch(function (err) {
                    console.error("[App] 메뉴 로드 실패:", err);
                    MessageToast.show("메뉴를 불러오지 못했습니다");
                });
        },

        _buildMenuTree: function (items) {
            var byId = {};
            items.forEach(function (i) {
                byId[i.ID] = Object.assign({}, i, { children: [] });
            });
            var roots = [];
            items.forEach(function (i) {
                var node = byId[i.ID];
                if (i.parent_ID && byId[i.parent_ID]) {
                    byId[i.parent_ID].children.push(node);
                } else {
                    roots.push(node);
                }
            });
            var sortRec = function (arr) {
                arr.sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
                arr.forEach(function (n) { if (n.children && n.children.length) sortRec(n.children); });
            };
            sortRec(roots);
            return roots;
        },

        _selectTop: function (sTopId) {
            var oData = this._oAppModel.getData();
            var top = (oData.menu.allTree || []).find(function (n) { return n.ID === sTopId; });
            if (!top) return;
            oData.menu.activeTopId = sTopId;
            var sideItems = (top.children || []).map(function (mid) {
                return {
                    ID: mid.ID,
                    code: mid.code,
                    title: mid.title || mid.code,
                    url: mid.url,
                    icon: this._iconForCode(mid.code),
                    children: (mid.children || []).map(function (leaf) {
                        return {
                            ID: leaf.ID,
                            code: leaf.code,
                            title: leaf.title || leaf.code,
                            url: leaf.url
                        };
                    })
                };
            }, this);
            oData.menu.sideItems = sideItems;
            this._oAppModel.setData(oData);
            this._refreshTopActiveClass();

            if ((!top.children || top.children.length === 0) && top.url) {
                this._navigateEmbedded(top.url);
            }
        },

        _refreshTopActiveClass: function () {
            var oData = this._oAppModel.getData();
            var sActiveId = oData.menu.activeTopId;
            (oData.menu.roots || []).forEach(function (r) {
                r.activeClass = (r.ID === sActiveId) ? "topMenuItemActive" : "";
            });
            this._oAppModel.setData(oData);
        },

        _iconForCode: function (code) {
            if (!code) return "sap-icon://document";
            if (code.indexOf("STORE") !== -1) return "sap-icon://retail-store";
            if (code.indexOf("PRODUCT") !== -1) return "sap-icon://product";
            if (code.indexOf("CUSTOMER") !== -1 || code === "CUSTOMERS") return "sap-icon://customer";
            if (code.indexOf("ORDER") !== -1) return "sap-icon://sales-order";
            if (code.indexOf("INVENTOR") !== -1) return "sap-icon://inventory";
            if (code.indexOf("FORECAST") !== -1) return "sap-icon://line-chart";
            if (code.indexOf("CHURN") !== -1) return "sap-icon://warning2";
            if (code.indexOf("ANOM") !== -1) return "sap-icon://alert";
            if (code.indexOf("SEG") !== -1) return "sap-icon://pie-chart";
            return "sap-icon://document";
        },

        // ---------- 핸들러 ----------

        onSideNavToggle: function () {
            var oToolPage = this.byId("toolPage");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        onHomePress: function () { this._oRouter.navTo("dashboard"); },
        onLogoPress: function () { this._oRouter.navTo("dashboard"); },

        onTopTabSelect: function (oEvent) {
            var sId = oEvent.getParameter("selectedKey") || (oEvent.getParameter("item") && oEvent.getParameter("item").getKey());
            if (!sId) return;
            this._selectTop(sId);
        },

        onSideItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            if (!oItem) return;
            var oCtx = oItem.getBindingContext("app");
            if (!oCtx) return;
            var oData = oCtx.getObject();
            if (oData && oData.url) {
                this._navigateEmbedded(oData.url);
            }
        },

        // ---------- 사이드바 하단 즐겨찾기 (Quicklinks) ----------
        // HTML dashboard에선 href="#" 빈 링크. UI5도 동일하게 placeholder 처리 —
        // MessageToast로 "준비 중" 안내만 띄우고 별도 라우팅 없음.
        onQuicklinkS4: function () {
            MessageToast.show("S/4HANA 연결 준비 중");
        },

        onQuicklinkHelp: function () {
            MessageToast.show("Help 준비 중");
        },

        onQuicklinkSupport: function () {
            MessageToast.show("Support 준비 중");
        },

        // ---------- AI Chat 사이드 패널 (Phase 8-2 v11) ----------

        // 패널 열기/닫기 — 단순 boolean 토글
        onChatToggle: function () {
            var bOpen = !!this._oAppModel.getProperty("/chatOpen");
            this._oAppModel.setProperty("/chatOpen", !bOpen);
            if (!bOpen) {
                this._scrollChatBottom();
            }
        },

        // List factory — Joule 스타일 버블 (시간 위 + 버블 아래)
        messageFactory: function (sId, oContext) {
            var oData = oContext.getObject() || {};
            var sRole = oData.role || "assistant";
            var bIsUser = (sRole === "user");
            var bIsSystem = (sRole === "system");

            var oBubbleHtml = new HTML({
                content: oData.contentHtml || "<div></div>",
                sanitizeContent: false
            });
            var sBubbleClass = "chatBubble " + (bIsUser ? "chatBubble-user" : (bIsSystem ? "chatBubble-system" : "chatBubble-assistant"));
            var oBubbleWrap = new VBox({ items: [oBubbleHtml] });
            oBubbleWrap.addStyleClass(sBubbleClass);

            var oTimeText = new Text({ text: oData.timestamp || "" });
            oTimeText.addStyleClass("chatTime");

            var oCol = new VBox({ items: [oTimeText, oBubbleWrap] });
            oCol.addStyleClass("chatMsgCol chatMsgCol-" + sRole);

            var oItem = new CustomListItem(sId, {
                content: [oCol],
                type: "Inactive"   // P8-2 v19: 클릭 highlight/선택 차단
            });
            oItem.addStyleClass("chatMessageItem chatMessageItem-" + sRole);
            return oItem;
        },

        _renderMarkdown: function (text) {
            var html;
            if (typeof window !== "undefined" && window.marked && window.marked.parse) {
                window.marked.setOptions({ gfm: true, breaks: true });
                html = window.marked.parse(text);
            } else {
                html = String(text || "")
                    .replace(/```(\w*)\n?([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
                    .replace(/`([^`]+)`/g, "<code>$1</code>")
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\*(.+?)\*/g, "<em>$1</em>")
                    .replace(/^- (.+)$/gm, "• $1")
                    .replace(/\n/g, "<br>");
            }
            return html.replace(/<table>/g, "<div class=\"chatTableScroll\"><table>").replace(/<\/table>/g, "</table></div>");
        },

        _escapeHtml: function (s) {
            return String(s || "")
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        },

        _appendChatMessage: function (role, content, extraButtonsHtml) {
            var data = this._oChatModel.getData();
            var html;
            if (role === "user") {
                html = "<div>" + this._escapeHtml(content).replace(/\n/g, "<br>") + "</div>";
            } else if (role === "system") {
                html = "<div>" + content + "</div>";
            } else {
                html = "<div>" + this._renderMarkdown(content) + (extraButtonsHtml || "") + "</div>";
            }
            data.messages.push({
                role: role,
                content: content,
                contentHtml: html,
                timestamp: fmtTime()
            });
            this._oChatModel.setData(data);
            this._scrollChatBottom();
        },

        // P8-2 v18: UI5 ScrollContainer는 outer(.sapMScrollCont) + inner(.sapMScrollContScroll) 2단 구조.
        // 실제 스크롤 가능 element는 inner — outer에 scrollTop set해도 안 움직임.
        _scrollChatBottom: function () {
            var that = this;
            setTimeout(function () {
                var oScroll = that.byId("chatScroll");
                if (!oScroll || !oScroll.getDomRef) return;
                var oOuter = oScroll.getDomRef();
                if (!oOuter) return;
                var oInner = oOuter.querySelector(".sapMScrollContScroll") || oOuter;
                oInner.scrollTop = oInner.scrollHeight;
            }, 100);
        },

        // 메시지 전송 (P8-2 v14)
        // - 한글 IME 안전: Input의 DOM value를 직접 읽음 (양방향 바인딩 제거)
        // - 표준 챗봇 UX: 사용자 메시지 즉시 추가 → assistant 자리에 typing placeholder 메시지
        //                 추가 → 응답 도착 시 placeholder를 실제 응답으로 in-place 교체
        onSendMessage: function (oEvent) {
            var that = this;
            var data = this._oChatModel.getData();
            if (data.sending) return;

            var oInput = this.byId("chatInput");
            var msg = "";
            if (oEvent && oEvent.getParameter) {
                msg = oEvent.getParameter("value") || "";
            }
            if (!msg && oInput) { msg = oInput.getValue() || ""; }
            msg = msg.trim();
            if (!msg) return;

            // 1) 사용자 메시지 추가 + 입력바 즉시 비우기
            this._appendChatMessage("user", msg);
            if (oInput) { oInput.setValue(""); }
            data.inputValue = "";
            data.sending = true;
            this._oChatModel.setData(data);

            // 2) assistant 자리에 typing placeholder 메시지 추가 (점멸 3 dot)
            this._appendTypingMessage();

            // 3) API 호출
            var history = (data.history || []).slice(-20);
            fetch("/chat/sendMessage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg, history: history })
            })
                .then(function (r) { return r.json(); })
                .then(function (resp) {
                    // 4) typing placeholder를 실제 응답으로 교체
                    that._removeLastTyping();
                    that._handleChatResponse(resp, msg);
                })
                .catch(function (err) {
                    console.error("[Chat] sendMessage 실패:", err);
                    that._removeLastTyping();
                    that._appendChatMessage("system", "네트워크 오류가 발생했습니다.");
                })
                .finally(function () {
                    var d = that._oChatModel.getData();
                    d.sending = false;
                    that._oChatModel.setData(d);
                });
        },

        // typing placeholder 메시지 추가 (assistant role + isTyping 플래그)
        _appendTypingMessage: function () {
            var data = this._oChatModel.getData();
            data.messages.push({
                role: "assistant",
                content: "",
                contentHtml: '<div class="chatTypingDots"><span></span><span></span><span></span></div>',
                timestamp: fmtTime(),
                isTyping: true
            });
            this._oChatModel.setData(data);
            this._scrollChatBottom();
        },

        // 마지막 typing placeholder 메시지 제거
        _removeLastTyping: function () {
            var data = this._oChatModel.getData();
            var msgs = data.messages || [];
            for (var i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i] && msgs[i].isTyping) {
                    msgs.splice(i, 1);
                    break;
                }
            }
            this._oChatModel.setData(data);
        },

        _handleChatResponse: function (resp, userMsg) {
            if (!resp || resp.success === false || !resp.reply) {
                this._appendChatMessage("system", ((resp && resp.error) || "응답을 받을 수 없습니다."));
                return;
            }
            var reply = resp.reply;
            var navMatch = reply.match(/\[NAVIGATE:(\/[^\]]+)\]/);
            var navUrl = null;
            if (navMatch) {
                navUrl = navMatch[1];
                reply = reply.replace(/\[NAVIGATE:[^\]]+\]/g, "").trim();
            }
            var buttons = [];
            try {
                var td = resp.toolData ? (typeof resp.toolData === "string" ? JSON.parse(resp.toolData) : resp.toolData) : null;
                if (td) buttons = chatProcessor.processToolData(td);
            } catch (e) {
                console.warn("[Chat] toolData 파싱 실패:", e);
            }
            if (navUrl) {
                buttons.unshift({ label: "해당 메뉴로 이동", color1: "#0070F2", color2: "#4CAF50", url: navUrl, msgType: "navigate" });
            }
            var btnHtml = "";
            buttons.forEach(function (b) {
                var bg = "linear-gradient(135deg," + b.color1 + "," + b.color2 + ")";
                btnHtml += '<div class="chatDetailBtn" data-chat-url="' + b.url + '" data-chat-msg="' + b.msgType + '" style="background:' + bg + ';">' + b.label + '</div>';
            });
            this._appendChatMessage("assistant", reply, btnHtml);
            var d = this._oChatModel.getData();
            d.history = (d.history || []).concat([
                { role: "user", content: userMsg },
                { role: "assistant", content: reply }
            ]);
            if (d.history.length > 20) d.history = d.history.slice(-20);
            this._oChatModel.setData(d);
        },

        _ensureChatClickDelegate: function () {
            if (this._chatClickDelegated) return;
            this._chatClickDelegated = true;
            var that = this;
            document.addEventListener("click", function (e) {
                var t = e.target;
                while (t && t !== document.body) {
                    if (t.classList && t.classList.contains("chatDetailBtn")) {
                        var url = t.getAttribute("data-chat-url");
                        var msgType = t.getAttribute("data-chat-msg");
                        if (url) that.navigateAndPostMessage(url, msgType);
                        e.preventDefault();
                        return;
                    }
                    t = t.parentNode;
                }
            }, true);
        },

        // ---------- AI 5앱 라우팅 (외부 iframe 모듈) ----------
        // chatProcessor가 만든 버튼의 msgType(forecastUpdate/recommendationUpdate/...)을
        // pendingFramePost로 큐잉 → Embedded.controller가 iframe load 후 postMessage 전달.

        navigateAndPostMessage: function (sUrl, sMsgType) {
            if (sMsgType === "navigate" || !sMsgType) {
                this._navigateEmbedded(sUrl);
                return;
            }
            this._pendingFramePost = { url: sUrl, msgType: sMsgType };
            this._navigateEmbedded(sUrl);
        },

        consumePendingFramePost: function (sUrl) {
            if (!this._pendingFramePost) return null;
            var a = (this._pendingFramePost.url || "").toLowerCase();
            var b = (sUrl || "").toLowerCase();
            if (a === b) {
                var p = this._pendingFramePost;
                this._pendingFramePost = null;
                return p;
            }
            return null;
        },

        // ---------- 라우팅 / iframe ----------

        _navigateEmbedded: function (sUrl) {
            if (!sUrl) return;
            this._oRouter.navTo("embedded", { appPath: encodeURIComponent(sUrl) });
            // 채팅창/iframe postMessage 등으로 URL 직접 이동 시에도 상단 탭 + 사이드 메뉴
            // 선택 상태를 동기화 (vanilla app/js/app.js의 highlightMenuForUrl과 동일 동작)
            this._highlightMenuForUrl(sUrl);
        },

        // URL과 매칭되는 메뉴 노드를 찾아 상단 탭 + 사이드 메뉴를 active 상태로 갱신.
        // 매칭은 prefix/indexOf 기반 — 메뉴 url은 보통 "/xxx/webapp/index.html" 형태이며,
        // 채팅 버튼이 전달하는 url도 같은 형태라서 그대로 비교 가능.
        _highlightMenuForUrl: function (sUrl) {
            if (!sUrl) return;
            var oData = this._oAppModel.getData();
            var aTree = (oData && oData.menu && oData.menu.allTree) || [];
            if (!aTree.length) return;

            var oMatch = null; // { topId, leafId }
            for (var t = 0; t < aTree.length && !oMatch; t++) {
                var top = aTree[t];
                if (top.url && sUrl.indexOf(top.url) !== -1) {
                    oMatch = { topId: top.ID, leafId: top.ID };
                    break;
                }
                var mids = top.children || [];
                for (var m = 0; m < mids.length && !oMatch; m++) {
                    var mid = mids[m];
                    if (mid.url && sUrl.indexOf(mid.url) !== -1) {
                        oMatch = { topId: top.ID, leafId: mid.ID };
                        break;
                    }
                    var leaves = mid.children || [];
                    for (var l = 0; l < leaves.length; l++) {
                        var leaf = leaves[l];
                        if (leaf.url && sUrl.indexOf(leaf.url) !== -1) {
                            oMatch = { topId: top.ID, leafId: leaf.ID };
                            break;
                        }
                    }
                }
            }
            if (!oMatch) return;

            // 1) 상단 탭 active 갱신 (필요 시 사이드 아이템 목록 재구성)
            if (oData.menu.activeTopId !== oMatch.topId) {
                this._selectTop(oMatch.topId);
            }

            // 2) 사이드 NavigationList selected 상태 갱신
            //    SideNavigation은 selected 갱신용 표준 API가 setSelectedItem(item) 형태이므로
            //    key로 NavigationListItem을 검색해 전달 (sap.tnt.NavigationList의 setSelectedKey도 가능)
            var that = this;
            setTimeout(function () {
                var oSideNav = that.byId("sideNav");
                var oNavList = that.byId("sideNavList");
                if (!oSideNav || !oNavList) return;
                var oTarget = that._findNavItemByKey(oNavList, oMatch.leafId);
                if (oTarget) {
                    try { oSideNav.setSelectedItem(oTarget); }
                    catch (e) { /* 일부 버전 호환 */ }
                }
            }, 50);
        },

        // NavigationList(또는 NavigationListItem) 하위에서 key가 일치하는 NavigationListItem 검색 (DFS)
        _findNavItemByKey: function (oNode, sKey) {
            if (!oNode || !sKey) return null;
            var aItems = (typeof oNode.getItems === "function") ? oNode.getItems() : [];
            for (var i = 0; i < aItems.length; i++) {
                var oChild = aItems[i];
                if (oChild && typeof oChild.getKey === "function" && oChild.getKey() === sKey) {
                    return oChild;
                }
                var oFound = this._findNavItemByKey(oChild, sKey);
                if (oFound) return oFound;
            }
            return null;
        },

        _onWindowMessage: function (oEvent) {
            var data = oEvent && oEvent.data;
            if (!data || typeof data !== "object") return;
            try {
                var sHost = window.location.hostname;
                var bIsLocalDev = (sHost === "localhost" || sHost === "127.0.0.1");
                if (!bIsLocalDev && oEvent.origin && oEvent.origin !== window.location.origin) {
                    return;
                }
            } catch (e) { /* noop */ }
            if (data.type === "navigateTo" && data.url) {
                this._navigateEmbedded(data.url);
            }
        },

        _clearAILocalStorage: function () {
            try {
                localStorage.removeItem("forecastData");
                localStorage.removeItem("orderRecommendationData");
                localStorage.removeItem("churnPredictionData");
                localStorage.removeItem("customerSegmentData");
                localStorage.removeItem("salesAnomalyData");
            } catch (e) { /* noop */ }
        }
    });
});
