let menuTree = [];
let activeTopMenuId = null;
let salesChart, inventoryChart, ordersChart;

// Date display
document.getElementById('dashDate').textContent = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' });

async function loadMenuData() {
    try {
        const res = await fetch('/inventory/MenuItems?$filter=isActive eq true&$orderby=sortOrder asc&$select=ID,code,title,icon,level,url,parent_ID,sortOrder');
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
        `<button class="top-menu-item" data-id="${i.ID}" onclick="selectTopMenu('${i.ID}')">${i.icon||'📁'} ${i.title}</button>`
    ).join('');
}

function showDashboard() {
    document.getElementById('welcomeView').style.display = '';
    document.getElementById('contentFrameWrap').style.display = 'none';
    document.getElementById('contentFrame').src = '';
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.top-menu-item').forEach(i => i.classList.remove('active'));
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
    const sb = document.getElementById('sidebar');
    if (!mids || !mids.length) { sb.innerHTML = '<div style="padding:1.5rem 1.1rem;color:var(--text-tertiary);font-size:0.8rem;text-align:center;">하위 메뉴가 없습니다</div>'; return; }
    let h = '';
    mids.forEach(m => {
        h += `<div class="nav-group-title"><span class="group-icon">${m.icon||'📁'}</span> ${m.title}</div>`;
        if (m.children && m.children.length) {
            m.children.forEach(s => {
                h += `<a class="nav-item" data-id="${s.ID}" onclick="selectSubMenu('${s.ID}','${(s.url||'').replace(/'/g,"\\'")}')"><span class="nav-icon">${s.icon||'📄'}</span><span class="nav-text">${s.title}</span></a>`;
            });
        } else if (m.url) {
            h += `<a class="nav-item" data-id="${m.ID}" onclick="selectSubMenu('${m.ID}','${(m.url||'').replace(/'/g,"\\'")}')"><span class="nav-icon">📄</span><span class="nav-text">${m.title} 열기</span></a>`;
        }
    });
    sb.innerHTML = h;
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
    const sb = document.getElementById('sidebar'), mn = document.getElementById('main');
    if (window.innerWidth <= 768) sb.classList.toggle('mobile-open');
    else { sb.classList.toggle('collapsed'); mn.classList.toggle('expanded'); }
}

document.addEventListener("DOMContentLoaded", () => { loadMenuData(); loadDashboardData(); toggleChat(); });

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
