// /meals — 오늘~14일 후(15일치) 조식·석식 식사/결식 선택. 바뀐 것만 PUT /meal-signups/bulk 로 저장하고 항목별 결과 표시.
(async function () {
  const { $, $$, esc, fmt } = UI;
  const today = fmt.todayKST();
  const box = $("#content"), save = $("#save"), result = $("#result"), flash = $("#flash");
  box.innerHTML = S.loading();
  $("#range").textContent = `${fmt.mmdd(today)} ~ ${fmt.mmdd(fmt.addDays(today, 14))} · 조식·석식만 신청해요.`;

  if (!(await S.boot("meals"))) { box.innerHTML = ""; return; }

  let win;
  try { win = await S.loadWindow(today, 15); }
  catch (e) { box.innerHTML = ""; UI.showError(flash, e); return; }

  const now = new Date();
  // key → { date, meal, open, saved: true|false|null }
  const slots = new Map();

  const radio = (name, value, label, checked, disabled, cls = "") =>
    `<label${cls ? ` class="${cls}"` : ""}><input type="radio" name="${name}" value="${value}"${checked ? " checked" : ""}${disabled ? " disabled" : ""}>${label}</label>`;

  function rowHTML(d, meal, label) {
    const date = d.service_date, slot = d[meal], key = `${date}_${meal}`;
    const su = win.signups.get(key);
    const st = S.slotState(slot, su, today, now);
    const saved = su ? su.will_attend : null;
    slots.set(key, { date, meal, open: st.open, saved });
    const off = !st.open;
    let cap = st.label;
    if (st.kind === "off") cap = `운영하지 않아요 · ${st.label}`;
    else if (st.kind === "closed" && saved === null) cap += " · 응답 없음 → 식사로 집계";
    else if (st.kind === "open" && saved === null) cap += " · 아직 응답 안 함";
    // 마감·잠김 상태에서 응답이 없으면 식사로 집계되므로 '식사'를 표시
    const eat = saved === true || (st.kind === "closed" && saved === null);
    const menu = slot && slot.available ? S.dishes(slot.menu).join(" · ") : "";
    return `<div class="k-row${st.open && saved === null ? " k-row--sel" : ""}" data-key="${key}">
      <div class="k-grow"><div class="k-strong">${label}</div><div class="k-cap">${esc(cap)}</div>
        ${menu ? `<div class="k-cap s-menu-line">${esc(menu)}</div>` : ""}
        <span class="k-help k-help--error" data-err hidden></span></div>
      <div class="k-seg${off ? " is-disabled" : ""}" role="radiogroup" aria-label="${fmt.mmdd(date)} ${label}">
        ${radio(key, "eat", "식사", eat, off)}${radio(key, "skip", "결식", saved === false, off, "skip")}
      </div></div>`;
  }

  function dayHTML(d) {
    const date = d.service_date;
    const allOff = S.MEALS.every(([m]) => !d[m] || !d[m].available);
    const rows = S.MEALS.map(([m, label]) => rowHTML(d, m, label)).join("");
    const why = allOff ? S.REASON[(d.breakfast && d.breakfast.reason) || (d.dinner && d.dinner.reason)] || "운영 안 함" : "";
    return `<section class="k-card" aria-label="${fmt.kdate(date, false)}">
      <div class="k-row" style="min-height:48px">
        <h2 class="k-grow k-t k-strong" style="margin:0">${fmt.mmdd(date)} <span class="k-sec" style="font-weight:400">(${fmt.wd(date)}${date === today ? " · 오늘" : ""})</span></h2>
        <span data-badge>${allOff ? `<span class="k-badge">${esc(why)}</span>` : ""}</span>
      </div>${rows}</section>`;
  }

  box.innerHTML = win.days.length ? win.days.map(dayHTML).join("") : '<div class="k-card"><div class="k-empty">급식 일정이 아직 없어요.</div></div>';

  const current = (key) => { const c = $(`input[name="${CSS.escape(key)}"]:checked`, box); return c ? c.value === "eat" : null; };
  const changes = () => [...slots.entries()].filter(([k, s]) => s.open && current(k) !== null && current(k) !== s.saved);

  function refresh() {
    const n = changes().length;
    save.disabled = n === 0;
    save.textContent = n ? `신청 저장 (${n}끼)` : "신청 저장";
    let pending = 0;
    for (const [k, s] of slots) {
      const un = s.open && s.saved === null && current(k) === null;
      if (un) pending++;
      const row = box.querySelector(`[data-key="${CSS.escape(k)}"]`);
      if (row) row.classList.toggle("k-row--sel", un);
    }
    for (const sec of $$("section", box)) {
      const b = $("[data-badge]", sec);
      const n2 = $$(".k-row--sel", sec).length;
      if (b && !b.querySelector(".k-badge:not(.s-pending)")) b.innerHTML = n2 ? `<span class="k-badge k-badge--soft s-pending">미응답 ${n2}</span>` : "";
    }
    $("#pending").textContent = pending ? `미응답 ${pending}끼` : "";
  }
  box.addEventListener("change", (e) => {
    const row = e.target.closest("[data-key]");
    if (row) { const er = $("[data-err]", row); er.hidden = true; er.textContent = ""; }
    result.innerHTML = "";
    refresh();
  });
  refresh();

  $("#meals").addEventListener("submit", (e) => {
    e.preventDefault();
    const list = changes();
    if (!list.length) return;
    flash.innerHTML = ""; result.innerHTML = "";
    UI.busy(save, async () => {
      const signups = list.map(([k, s]) => ({ service_date: s.date, meal_type: s.meal, will_attend: current(k) }));
      let res;
      try { res = await API.put("/meal-signups/bulk", { signups }); }
      catch (ex) { UI.showError(flash, ex); return; }
      const fails = [];
      for (const r of res.results || []) {
        const key = `${r.service_date}_${r.meal_type}`, s = slots.get(key);
        const row = box.querySelector(`[data-key="${CSS.escape(key)}"]`);
        if (!s) continue;
        if (r.status === "ok") {
          s.saved = signups.find((x) => x.service_date === r.service_date && x.meal_type === r.meal_type).will_attend;
          const cap = row && row.querySelector(".k-cap");
          if (cap) cap.textContent = cap.textContent.replace(" · 아직 응답 안 함", "");
        } else {
          const msg = S.codeMsg(r.code);
          fails.push(`${fmt.mmdd(r.service_date)} ${r.meal_type === "breakfast" ? "조식" : "석식"}: ${msg}`);
          if (row) { const er = $("[data-err]", row); er.textContent = msg; er.hidden = false; }
          if (r.code === "SIGNUP_DEADLINE_PASSED" || r.code === "MEAL_NOT_AVAILABLE" || r.code === "DATE_OUT_OF_RANGE") {
            s.open = false;
            if (row) { $(".k-seg", row).classList.add("is-disabled"); $$("input", row).forEach((i) => { i.disabled = true; }); }
          }
        }
      }
      refresh();
      const ok = res.succeeded, bad = res.failed;
      result.innerHTML = bad
        ? `<p class="k-help k-help--error k-center" style="margin:0">${ok}끼 저장, ${bad}끼 실패 — 표시된 항목을 확인해 주세요.</p>`
        : `<p class="k-help k-help--ok k-center" style="margin:0">${ok}끼 저장했어요.</p>`;
      if (bad) flash.innerHTML = UI.bannerHTML(`<b>저장하지 못한 항목 ${bad}끼</b><br>${fails.map(esc).join("<br>")}`, "error", true);
      else UI.banner(flash, `${ok}끼 신청을 저장했어요.`, "ok");
    });
  });
})();
