// 급식들 화면 공통 도우미 — 날짜(KST) 포맷, 배너, 탭 바, 아이콘, 알레르기 이름.
(function () {
  const WD = "일월화수목금토"; // JS getDay(): 0=일
  const ALLERGENS = { 1: "난류", 2: "우유", 3: "메밀", 4: "땅콩", 5: "대두", 6: "밀", 7: "고등어", 8: "게", 9: "새우",
    10: "돼지고기", 11: "복숭아", 12: "토마토", 13: "아황산류", 14: "호두", 15: "닭고기", 16: "쇠고기", 17: "오징어", 18: "조개류", 19: "잣" };
  const MEAL = { breakfast: "조식", lunch: "중식", dinner: "석식" };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // "YYYY-MM-DD"(KST 날짜) 다루기 — Date 객체는 UTC 자정으로만 써요 (시간대 혼동 방지)
  const d = (s) => { const [y, m, dd] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
  const ymd = (dt) => dt.toISOString().slice(0, 10);
  const fmt = {
    todayKST() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()); },
    addDays(s, n) { const x = d(s); x.setUTCDate(x.getUTCDate() + n); return ymd(x); },
    wd(s) { return WD[d(s).getUTCDay()]; },
    mmdd(s) { const x = d(s); return `${x.getUTCMonth() + 1}/${x.getUTCDate()}`; },
    kdate(s, withWd = true) { const x = d(s); const t = `${x.getUTCMonth() + 1}월 ${x.getUTCDate()}일`; return withWd ? `${t} (${WD[x.getUTCDay()]})` : t; },
    kdateFull(s) { const x = d(s); return `${x.getUTCMonth() + 1}월 ${x.getUTCDate()}일 ${WD[x.getUTCDay()]}요일`; },
    // UTC ISO("…Z") → KST 표시
    kst(iso) {
      const p = Object.fromEntries(new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
        weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
      return `${p.month}월 ${p.day}일(${p.weekday}) ${p.hour}:${p.minute}`;
    },
    kstTime(iso) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)); },
    kstDate(iso) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso)); },
    // KST 입력값("2026-11-15T18:00") → UTC ISO
    kstInputToUtc(v) { return new Date(v + ":00+09:00").toISOString().replace(".000Z", "Z"); },
    utcToKstInput(iso) { const s = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); return s.replace(" ", "T"); },
    remaining(iso) {
      let ms = new Date(iso) - new Date(); if (ms <= 0) return "마감됨";
      const dd = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
      return dd ? `${dd}일 ${h}시간` : h ? `${h}시간 ${m}분` : `${m}분`;
    },
    pct(n) { return (Math.round(n * 10) / 10).toFixed(1); },
  };

  const ICONS = {
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
    warn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18.5v.01"/></svg>',
    heart: (on) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/></svg>`,
    plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };
  const mark = (size = 36) => `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><path d="M11 19L13 7l5.5 6L24 5l5.5 8L35 7l2 12z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="13" cy="6.5" r="2"/><circle cx="24" cy="4.5" r="2"/><circle cx="35" cy="6.5" r="2"/><rect x="11" y="20.5" width="26" height="3.5" rx="1.75"/><path d="M10 33c0-6 6-7.5 14-7.5S38 27 38 33z" fill="#fff"/><path d="M8 31h32c0 9-6.5 13-16 13S8 40 8 31z"/></svg>`;

  const TABS = [
    ["home", "/home", "홈", '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
    ["menu", "/menu", "식단표", '<path d="M7 3v18M4 3v5a3 3 0 0 0 6 0V3M17 21V3c-2 2-3 5-3 8h3"/>'],
    ["meals", "/meals", "식사 신청", '<path d="M9 4H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-4"/><path d="M9 2h6v4H9z"/><path d="M9 14l2 2 4-4"/>'],
    ["vote", "/vote", "투표", '<path d="M4 13h16v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M7 13V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v9"/><path d="M9.5 8l2 2 3.5-3.5"/>'],
    ["me", "/me", "마이", '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/>'],
  ];
  const tabbar = (active) => `<nav class="k-tabbar" aria-label="주요 메뉴">${TABS.map(([k, href, label, path]) =>
    `<a href="${href}"${k === active ? ' class="is-on" aria-current="page"' : ""}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg><span>${label}</span></a>`).join("")}</nav>`;
  const back = (href, label) => `<nav class="k-nav" aria-label="뒤로"><a href="${href}"><span class="k-chev k-chev--back"></span>${esc(label)}</a></nav>`;

  // 배너: type = "info" | "ok" | "error"
  const bannerHTML = (msg, type = "ok", html = false) =>
    `<div class="k-banner ${type === "error" ? "k-banner--error" : ""}" role="${type === "error" ? "alert" : "status"}">${type === "error" ? ICONS.warn : type === "info" ? ICONS.info : ICONS.check}<span>${html ? msg : esc(msg)}</span></div>`;
  function banner(el, msg, type = "ok") { if (el) el.innerHTML = bannerHTML(msg, type); }
  // 다음 화면에서 보여 줄 메시지
  function flash(msg, type = "ok") { try { sessionStorage.setItem("gs_flash", JSON.stringify([msg, type])); } catch {} }
  function showFlash(el) {
    try { const f = sessionStorage.getItem("gs_flash"); if (!f) return; sessionStorage.removeItem("gs_flash"); const [m, t] = JSON.parse(f); banner(el, m, t); } catch {}
  }
  // API 에러를 배너로
  function showError(el, err) { banner(el, err && err.message ? err.message : "일시적인 오류가 발생했습니다.", "error"); }

  // 버튼을 잠깐 잠그고 비동기 작업 실행
  async function busy(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); } finally { if (btn) btn.disabled = false; }
  }

  const allergenBadges = (list, mine = []) => list && list.length
    ? `<div class="k-badges">${list.map((a) => `<span class="k-badge ${mine.includes(a.no) ? "k-badge--danger" : ""}">${a.no} ${esc(a.name)}</span>`).join("")}</div>`
    : '<div class="k-cap">알레르기 유발 물질 없음</div>';

  window.UI = { $, $$, esc, fmt, ICONS, mark, tabbar, back, bannerHTML, banner, flash, showFlash, showError, busy, allergenBadges, ALLERGENS, MEAL };
})();
