let menuTree = [];
// Menu Lucide icon map
var MENU_ICON_COLORS={"MASTER":"#4CAF50","PROCURE":"#FF9800","LOGISTICS":"#0070F2","SALES":"#7B2FF2","AI":"#D93025","SYSTEM":"#556B82"};
var MENU_ICONS={MASTER:"database",PROCURE:"shopping-cart",LOGISTICS:"truck",SALES:"trending-up",AI:"cpu",SYSTEM:"settings"};
var ICON_COLORS={"CATEGORIES":"#4CAF50","PRODUCTS":"#FF9800","MATERIALS":"#7B2FF2","STORES":"#0070F2","STOREPRODUCTS":"#0070F2","SUPPLIERS":"#4CAF50","DC":"#D93025","PURCHASEORDERS":"#FF9800","GOODS-RCPT":"#4CAF50","INVOICES":"#7B2FF2","TRANSFER-ORD":"#0070F2","STORE-RCPT":"#7B2FF2","INVENTORIES":"#FF9800","CUSTOMERS":"#0070F2","CUSTPURCHASES":"#FF9800","DAILYSALES":"#4CAF50","FORECASTS":"#7B2FF2","ORDER-REC":"#FF9800","CHURN":"#D93025","SEGMENTS":"#7B2FF2","ANOMALIES":"#D93025","MENUS":"#556B82","LOGISTICS":"#0070F2","M-PARTNER":"#4CAF50","P-SETTLE":"#556B82"};
var SUB_ICONS={"CATEGORIES":"folder","PRODUCTS":"tag","MATERIALS":"settings","STORES":"home","STOREPRODUCTS":"grid","SUPPLIERS":"users","DC":"warehouse","PURCHASEORDERS":"clipboard","GOODS-RCPT":"check-circle","INVOICES":"file-text","TRANSFER-ORD":"truck","STORE-RCPT":"package","INVENTORIES":"warehouse","CUSTOMERS":"user","CUSTPURCHASES":"shopping-bag","DAILYSALES":"trending-up","DEMAND-FCST":"activity","ORDER-REC":"target","CHURN-PRED":"alert-triangle","CUST-SEG":"pie-chart","SALES-ANOM":"zap","MENUS":"clipboard-list","ANOMALIES":"zap","CHURN":"alert-triangle","FORECASTS":"activity","SEGMENTS":"pie-chart","LOGISTICS":"truck","M-PARTNER":"users","P-SETTLE":"file-text"};
function getMenuIcon(code,sz){var n=MENU_ICONS[code];var c=MENU_ICON_COLORS[code]||"#556B82";if(n)return"<i data-lucide=\""+n+"\" class=\"menu-lucide\" style=\"width:"+(sz||15)+"px;height:"+(sz||15)+"px;color:"+c+"\"></i>";return"";}
function getSubIcon(code,sz){var n=SUB_ICONS[code];var c=ICON_COLORS[code]||"#556B82";if(n)return"<i data-lucide=\""+n+"\" class=\"menu-lucide\" style=\"width:"+(sz||14)+"px;height:"+(sz||14)+"px;color:"+c+"\"></i>";return"";}

let activeTopMenuId = null;
let salesChart, inventoryChart, ordersChart;

// Date display
document.getElementById('dashDate').textContent = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' });

async function loadMenuData() {
    try {
        const res = await fetch('/inventory/MenuItems?$filter=isActive eq true&$orderby=sortOrder asc&$select=ID,code,title,level,url,parent_ID,sortOrder');
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        const items = data.value || [];
        const map = {};
        items.forEach(i => { map[i.ID] = { ...i, children: [] }; });
        const roots = [];
        items.forEach(i => {
            if (i.parent_ID && map[i.parent_ID]) map[i.parent_ID].children.push(map[i.ID]);
            else if (!i.parent_ID) roots.push(map[i.ID]);
        });
        menuTree = roots;
        renderTopMenu();
        if (menuTree.length > 0) selectTopMenu(menuTree[0].ID);
    } catch (e) {
        console.error('메뉴 로드 실패:', e);
        document.getElementById('topMenuBar').innerHTML = '<span style="color:var(--text-tertiary);font-size:0.78rem;">메뉴 로드 실패</span>';
    }
}

function renderTopMenu() {
    const bar = document.getElementById('topMenuBar');
    bar.innerHTML = menuTree.map(i =>
        `<button class="top-menu-item" data-id="${i.ID}" onclick="selectTopMenu('${i.ID}')">${getMenuIcon(i.code)}${i.title}</button>`
    ).join('');
}

function showDashboard() {
    document.getElementById('welcomeView').style.display = '';
    document.getElementById('contentFrameWrap').style.display = 'none';
    document.getElementById('contentFrame').src = '';
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    loadDashboardData();
}

function selectTopMenu(id) {
    activeTopMenuId = id;
    document.querySelectorAll('.top-menu-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    const top = menuTree.find(m => m.ID === id);
    if (!top) return;
    renderSidebar(top.children || []);
    if ((!top.children || top.children.length === 0) && top.url) showContentFrame(top.url);
}

function renderSidebar(mids) {
    const sb = document.getElementById('sidebarMenuContent') || document.getElementById('sidebar');
    if (!mids || !mids.length) { sb.innerHTML = '<div style="padding:1.5rem 1.1rem;color:var(--text-tertiary);font-size:0.8rem;text-align:center;">하위 메뉴가 없습니다</div>'; return; }
    let h = '';
    mids.forEach(m => {
        h += `<div class="nav-group-title">${m.title}</div>`;
        if (m.children && m.children.length) {
            m.children.forEach(s => {
                h += `<a class="nav-item" data-id="${s.ID}" onclick="selectSubMenu('${s.ID}','${(s.url||'').replace(/'/g,"\\'")}')">${getSubIcon(s.code)}<span class="nav-text">${s.title}</span></a>`;
            });
        } else if (m.url) {
            h += `<a class="nav-item" data-id="${m.ID}" onclick="selectSubMenu('${m.ID}','${(m.url||'').replace(/'/g,"\\'")}')"><span class="nav-text">${m.title}</span></a>`;
        }
    });
    sb.innerHTML = h;
    if(window.lucide)lucide.createIcons();
}

function selectSubMenu(id, url) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.id === id));
    if (url) showContentFrame(url);
}

function showContentFrame(url) {
    document.getElementById('welcomeView').style.display = 'none';
    const wrap = document.getElementById('contentFrameWrap');
    const loader = document.getElementById('frameLoader');
    const f = document.getElementById('contentFrame');
    wrap.style.display = 'block'; document.getElementById('main').scrollTop = 0; window.scrollTo(0,0);
    loader.classList.remove('hidden');
    f.src = url;
    f.onload = () => { loader.classList.add('hidden'); };
    highlightMenuForUrl(url);
}

function toggleSidebar() {
    var sb = document.getElementById('sidebar'), mn = document.getElementById('main');
    var isCollapsing = !sb.classList.contains('collapsed');
    if (window.innerWidth <= 768) { sb.classList.toggle('mobile-open'); }
    else { sb.classList.toggle('collapsed'); mn.classList.toggle('expanded'); }
    document.querySelector('.shell-bar').style.left = isCollapsing ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';
}

// 페이지 최초 로드 시 AI 예측 결과 초기화 (새 세션 = 깨끗한 시작)
function clearAILocalStorage() {
    localStorage.removeItem('forecastData');
    localStorage.removeItem('orderRecommendationData');
    localStorage.removeItem('churnPredictionData');
    localStorage.removeItem('customerSegmentData');
    localStorage.removeItem('salesAnomalyData');
}

document.addEventListener("DOMContentLoaded", () => { clearAILocalStorage(); loadMenuData(); loadDashboardData(); });

// iframe에서 오는 navigateTo 메시지 수신
window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "navigateTo" && e.data.url) {
        showContentFrame(e.data.url); highlightMenuForUrl(e.data.url);
    }
});

// URL에 해당하는 메뉴 항목을 active로 표시
function highlightMenuForUrl(url) {
    // 메뉴 트리에서 URL 매칭 → 상단 메뉴 선택 → 사이드바 렌더링 → nav-item active
    for (var t = 0; t < menuTree.length; t++) {
        var top = menuTree[t];
        if (!top.children) continue;
        for (var m = 0; m < top.children.length; m++) {
            var mid = top.children[m];
            // 중메뉴 직접 매칭
            if (mid.url && url.indexOf(mid.url) !== -1) {
                selectTopMenu(top.ID);
                setTimeout(function() {
                    document.querySelectorAll(".nav-item").forEach(function(el) { el.classList.toggle("active", el.dataset.id === mid.ID); });
                }, 50);
                return;
            }
            // 소메뉴 탐색
            if (mid.children) {
                for (var s = 0; s < mid.children.length; s++) {
                    var sub = mid.children[s];
                    if (sub.url && url.indexOf(sub.url) !== -1) {
                        selectTopMenu(top.ID);
                        setTimeout(function() {
                            document.querySelectorAll(".nav-item").forEach(function(el) { el.classList.toggle("active", el.dataset.id === sub.ID); });
                        }, 50);
                        return;
                    }
                }
            }
        }
    }
}