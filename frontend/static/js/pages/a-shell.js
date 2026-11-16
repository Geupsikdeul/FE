// 어드민 웹 공통 셸 — 왼쪽 메뉴(a-side), 관리자 확인(API.guard("admin")), 배너, 페이지 나눔, 투표 순위 계산.
// 각 어드민 화면은 맨 먼저 `const me = await AShell.init("<메뉴 키>"); if (!me) return;` 를 불러요.
(function () {
  const { esc } = UI;
  const SVG = (p) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const NAV = [
    ["dashboard", "/admin", "대시보드", '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>'],
    ["meals", "/admin/meals", "희망 여부", '<path d="M9 4H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-4"/><path d="M9 2h6v4H9z"/><path d="M9 14l2 2 4-4"/>'],
    ["votes", "/admin/votes", "메뉴 투표", '<path d="M5 21V10M12 21V3M19 21v-7"/>'],
    ["wishes", "/admin/wishes", "희망 메뉴", '<path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>'],
    ["plan", "/admin/plan", "식단표 추천", '<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'],
    ["calendar", "/admin/calendar", "급식 일정", '<path d="M4 6h16v15H4zM4 10h16M8 3v4M16 3v4"/>'],
    ["students", "/admin/students", "학생 관리", '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'],
  ];

  // 미운영 사유 (UnavailableReason)
  const REASON = { weekend: "주말", holiday: "공휴일", exam_period: "시험 기간", no_service: "미운영" };
  // 투표 상태 (PollStatus) + 공개 여부
  const POLL_STATUS = { scheduled: "시작 전", open: "진행 중", closed: "마감" };

  function side(active, me, failed) {
    const name = me ? me.name : "";
    return `
    <div class="a-logo">
      <div class="k-mark k-mark--sm" style="margin:0">${UI.mark(30)}</div>
      <span class="a-logo__t">급식들</span>
      <span class="k-badge k-badge--soft">관리자</span>
    </div>
    <nav class="a-nav" aria-label="어드민 메뉴">
      ${NAV.map(([k, href, label, p]) => `<a href="${href}"${k === active ? ' class="is-on" aria-current="page"' : ""}>${SVG(p)}${label}</a>`).join("")}
    </nav>
    <div class="a-me">
      <span class="a-avatar" aria-hidden="true">${esc(name ? name[0] : "·")}</span>
      <div class="k-grow"><div class="k-strong">${name ? esc(name) : failed ? "확인 못 함" : "확인 중…"}</div><div class="k-cap">${me ? esc(me.student_no) + " · 관리자" : "관리자"}</div></div>
      <button class="k-btn k-btn--plain k-btn--sm" type="button" id="a-logout" style="padding:0 6px">로그아웃</button>
    </div>`;
  }

  const msgEl = () => document.getElementById("msg");
  function render(active, me, failed) {
    const el = document.getElementById("a-side");
    if (!el) return;
    el.innerHTML = side(active, me, failed);
    el.querySelector("#a-logout").addEventListener("click", () => API.logout());
  }

  // 화면 진입: 셸을 먼저 그리고 관리자 확인. 실패하면 null (로그인 화면으로 이동했거나 오류 배너 표시).
  async function init(active) {
    render(active, null);
    try {
      const me = await API.guard("admin");
      render(active, me);
      UI.showFlash(msgEl());
      return me;
    } catch (e) {
      // 비로그인·토큰 만료 → api.js가 /login?next= 로 보냄. 학생 계정 → /home.
      if (!(e instanceof API.ApiError) || e.code === "INVALID_TOKEN") return null;
      render(active, null, true);
      error(e);
      // 데이터 자리의 "불러오는 중…"을 실패 표시로 바꿔요
      document.querySelectorAll(".a-content p, .a-content td, .a-content .k-sec").forEach((x) => {
        if (x.children.length === 0 && x.textContent.trim() === "불러오는 중…") x.textContent = "불러오지 못했어요.";
      });
      return null;
    }
  }

  function error(e, el) {
    UI.showError(el || msgEl(), e);
    if (!el) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function ok(text, el) { UI.banner(el || msgEl(), text, "ok"); }
  function info(text, el) { UI.banner(el || msgEl(), text, "info"); }
  function clear(el) { const x = el || msgEl(); if (x) x.innerHTML = ""; }

  // 검증 오류(VALIDATION_ERROR)의 필드별 메시지 → "필드: 메시지" 목록
  function fieldErrors(e) {
    const f = e && e.detail && e.detail.fields;
    if (!f) return [];
    return Object.entries(f).map(([k, v]) => `${k}: ${[].concat(v).join(", ")}`);
  }
  function errorText(e) {
    const extra = fieldErrors(e);
    return (e && e.message ? e.message : "일시적인 오류가 발생했습니다.") + (extra.length ? " (" + extra.join(" / ") + ")" : "");
  }

  // 쿼리스트링
  const q = (k) => new URLSearchParams(location.search).get(k);
  function setQ(obj) {
    const p = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(obj)) (v === null || v === undefined || v === "") ? p.delete(k) : p.set(k, v);
    const s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
  }
  const isDate = (s) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
  const int = (s) => (s && /^\d+$/.test(s) ? Number(s) : null);

  // 페이지 나눔 (백엔드 Page{items,total,page,size,pages})
  function pager(el, pg, go, unit = "명") {
    const total = pg.total || 0, size = pg.size || 20, page = pg.page || 1, pages = Math.max(pg.pages || 0, 1);
    const from = total ? (page - 1) * size + 1 : 0, to = Math.min(page * size, total);
    el.innerHTML = `<span>${total}${unit} 중 ${from}–${to}</span>
      <div class="a-actions">
        <button class="k-btn k-btn--tonal k-btn--sm" type="button" data-p="${page - 1}" ${page <= 1 ? "disabled" : ""}>이전</button>
        <span class="k-sec">${page} / ${pages}</span>
        <button class="k-btn k-btn--tonal k-btn--sm" type="button" data-p="${page + 1}" ${page >= pages ? "disabled" : ""}>다음</button>
      </div>`;
    el.onclick = (ev) => { const b = ev.target.closest("button[data-p]"); if (b && !b.disabled) go(Number(b.dataset.p)); };
  }

  // 투표 목록 전체 (GET /admin/polls 는 상태 필터가 없어서 모두 받아 화면에서 걸러요)
  async function allPolls() {
    const out = [];
    for (let page = 1; page <= 20; page++) {
      const r = await API.get("/admin/polls", { page, size: 100 });
      out.push(...r.items);
      if (page >= r.pages) break;
    }
    return out;
  }
  // 상태 키: draft(비공개) | scheduled | open | closed
  const pollKey = (p) => (p.is_published ? p.status : "draft");
  function pollBadge(p) {
    if (!p.is_published) return '<span class="k-badge">비공개</span>';
    if (p.status === "open") return '<span class="k-badge k-badge--primary">진행 중</span>';
    if (p.status === "scheduled") return '<span class="k-badge k-badge--soft">시작 전</span>';
    return '<span class="k-badge">마감</span>';
  }

  // 득표순 정렬 + 공동 순위 (1, 1, 3 …). 참여자가 0명이면 득표·득표율 0, 순위는 매기지 않아요.
  function rankOptions(options, byOption, total) {
    const count = new Map((byOption || []).map((o) => [o.option_id, o.vote_count]));
    const rows = (options || []).map((o) => ({ option_id: o.id, menu_name: o.menu_name, description: o.description, vote_count: count.get(o.id) || 0 }));
    // stats에만 있는 선택지(예: 이름만 온 경우)도 빠뜨리지 않음
    for (const o of byOption || []) if (!rows.some((r) => r.option_id === o.option_id)) rows.push({ option_id: o.option_id, menu_name: o.menu_name, description: null, vote_count: o.vote_count });
    rows.sort((a, b) => b.vote_count - a.vote_count);
    let prev = null, rank = 0;
    rows.forEach((r, i) => {
      if (r.vote_count !== prev) { rank = i + 1; prev = r.vote_count; }
      r.rank = total > 0 ? rank : null;
      r.pct = total > 0 ? (r.vote_count / total) * 100 : 0;
    });
    const n = {};
    rows.forEach((r) => { if (r.rank) n[r.rank] = (n[r.rank] || 0) + 1; });
    rows.forEach((r) => { r.tied = !!r.rank && n[r.rank] > 1; });
    return rows;
  }

  const fmtNum = (n) => Number(n || 0).toLocaleString("ko-KR");

  window.AShell = { init, render, error, ok, info, clear, errorText, fieldErrors, q, setQ, isDate, int, pager, allPolls, pollKey, pollBadge, rankOptions, REASON, POLL_STATUS, fmtNum };
})();
