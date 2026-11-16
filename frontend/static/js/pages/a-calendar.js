// /admin/calendar — 급식 일정 (운영 여부·사유·마감·메뉴 문자열)
// GET /admin/meal-calendar?from&to (CalendarEntryList) · POST /admin/meal-calendar (CalendarEntryCreate, 새 날짜)
// PATCH /admin/meal-calendar/{date} (CalendarEntryUpdate, 이미 있는 날짜)
(async () => {
  const { $, $$, esc, fmt } = UI;
  const rf = $("#rf");
  const today = fmt.todayKST();
  const MEALS = ["breakfast", "dinner"];
  const MAX_DAYS = 62;
  rf.from.value = AShell.isDate(AShell.q("from")) ? AShell.q("from") : today;
  rf.to.value = AShell.isDate(AShell.q("to")) ? AShell.q("to") : fmt.addDays(rf.from.value, 13);

  const me = await AShell.init("calendar");
  if (!me) return;

  let entries = new Map(), days = [], editing = null;
  const isWeekend = (d) => ["토", "일"].includes(fmt.wd(d));

  function cell(e, meal) {
    if (!e) return '<span class="k-sec">미등록</span>';
    if (!e[meal + "_available"]) return `<span class="k-badge">미운영 · ${esc(AShell.REASON[e[meal + "_reason"]] || "사유 없음")}</span>`;
    const dl = e[meal + "_deadline"], menu = e[meal + "_menu"];
    return `<span class="k-badge k-badge--soft">운영</span> <span class="k-cap">마감 ${dl ? esc(fmt.kst(dl)) : "미정"}</span>
      <div class="a-menu ${menu ? "" : "k-sec"}">${menu ? esc(menu) : "메뉴 미입력"}</div>`;
  }
  function draw() {
    $("#r-label").textContent = `${fmt.kdate(days[0])} ~ ${fmt.kdate(days[days.length - 1])} · 등록 ${days.filter((d) => entries.has(d)).length}/${days.length}일`;
    $("#rows").innerHTML = days.map((d) => {
      const e = entries.get(d);
      return `<tr class="${d === editing ? "is-sel" : ""}">
        <td style="white-space:nowrap"><span class="k-strong ${d === today ? "k-pt" : ""}">${fmt.mmdd(d)}</span> <span class="${isWeekend(d) ? "k-pt" : "k-sec"}">${fmt.wd(d)}</span>${d === today ? ' <span class="k-badge k-badge--soft">오늘</span>' : ""}</td>
        <td>${cell(e, "breakfast")}</td><td>${cell(e, "dinner")}</td>
        <td style="white-space:nowrap"><button class="k-btn ${e ? "k-btn--tonal" : ""} k-btn--sm" type="button" data-edit="${d}">${e ? "수정" : "등록"}</button></td></tr>`;
    }).join("");
  }

  async function load() {
    const from = rf.from.value, to = rf.to.value;
    AShell.clear();
    if (!AShell.isDate(from) || !AShell.isDate(to)) { AShell.error({ message: "날짜를 확인해 주세요." }); return; }
    if (to < from) { AShell.error({ message: "끝 날짜가 시작 날짜보다 앞이에요." }); return; }
    days = [];
    for (let d = from; d <= to && days.length < MAX_DAYS; d = fmt.addDays(d, 1)) days.push(d);
    if (days[days.length - 1] !== to) AShell.info(`한 번에 ${MAX_DAYS}일까지 보여요. ${fmt.kdate(days[days.length - 1])}까지 표시했어요.`);
    AShell.setQ({ from: from === today ? null : from, to: to === fmt.addDays(from, 13) ? null : to });
    $("#rows").innerHTML = '<tr><td colspan="4" class="k-sec" style="text-align:center;padding:32px">불러오는 중…</td></tr>';
    try {
      const r = await API.get("/admin/meal-calendar", { from: days[0], to: days[days.length - 1] });
      entries = new Map(r.items.map((e) => [e.service_date, e]));
      draw();
    } catch (e) {
      AShell.error({ message: AShell.errorText(e) });
      $("#rows").innerHTML = '<tr><td colspan="4" class="k-sec" style="text-align:center;padding:32px">일정을 불러오지 못했어요.</td></tr>';
    }
  }
  rf.addEventListener("submit", (e) => { e.preventDefault(); load(); });
  $$("[data-range]", rf).forEach((b) => (b.onclick = () => {
    rf.from.value = fmt.addDays(today, Number(b.dataset.range));
    rf.to.value = fmt.addDays(rf.from.value, 13);
    load();
  }));

  // 편집 패널
  const reasonOpts = (sel) => Object.entries(AShell.REASON).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v}</option>`).join("");
  function mealFields(meal, e, d) {
    // 새 날짜 기본값: 주말은 미운영, 평일은 운영 + 마감(조식 전날 18:00, 석식 당일 12:00 — 명세 예시 기준)
    const on = e ? e[meal + "_available"] : !isWeekend(d);
    const dl = e ? e[meal + "_deadline"] : null;
    const dlVal = dl ? fmt.utcToKstInput(dl) : (!e && on ? (meal === "breakfast" ? fmt.addDays(d, -1) + "T18:00" : d + "T12:00") : "");
    const reason = e ? e[meal + "_reason"] : (isWeekend(d) ? "weekend" : null);
    const M = UI.MEAL[meal];
    return `<fieldset class="a-meal" data-meal="${meal}">
      <legend class="k-t k-strong">${M}</legend>
      <div class="k-seg" role="radiogroup" aria-label="${M} 운영 여부">
        <label><input type="radio" name="${meal}_available" value="1" ${on ? "checked" : ""}>운영</label>
        <label class="skip"><input type="radio" name="${meal}_available" value="0" ${on ? "" : "checked"}>미운영</label>
      </div>
      <div class="a-col" data-on ${on ? "" : "hidden"} style="gap:12px">
        <div class="k-field"><label class="k-label" for="${meal}-dl">신청 마감 (한국 시간)</label>
          <input class="a-input a-input--wide" type="datetime-local" id="${meal}-dl" name="${meal}_deadline" value="${esc(dlVal)}"></div>
        <div class="k-field"><label class="k-label" for="${meal}-menu">메뉴 (쉼표로 구분)</label>
          <textarea class="a-textarea" style="min-height:88px" id="${meal}-menu" name="${meal}_menu" placeholder="예: 미역국, 계란말이, 김치, 흰쌀밥">${esc((e && e[meal + "_menu"]) || "")}</textarea></div>
      </div>
      <div class="k-field" data-off ${on ? "hidden" : ""}><label class="k-label" for="${meal}-reason">미운영 사유</label>
        <select class="a-select" id="${meal}-reason" name="${meal}_reason">${reasonOpts(reason || "no_service")}</select></div>
    </fieldset>`;
  }
  function openEditor(d) {
    editing = d;
    const e = entries.get(d);
    $("#ed").innerHTML = `<form class="a-col" id="ef" novalidate>
      <div class="a-panel__head" style="margin:0"><h2>${esc(fmt.kdate(d))}</h2>${e ? '<span class="k-badge k-badge--soft">등록됨</span>' : '<span class="k-badge">새로 등록</span>'}</div>
      <div id="ed-msg" class="a-msg"></div>
      ${mealFields("breakfast", e, d)}
      ${mealFields("dinner", e, d)}
      <div class="a-actions"><button class="k-btn k-btn--sm" type="submit">${e ? "수정 저장" : "등록"}</button><button class="k-btn k-btn--plain k-btn--sm" type="button" id="ed-close">닫기</button></div>
    </form>`;
    draw();
    const ef = $("#ef");
    ef.addEventListener("change", (ev) => {
      const t = ev.target;
      if (!t.name || !t.name.endsWith("_available")) return;
      const fs = t.closest(".a-meal"), on = t.value === "1";
      fs.querySelector("[data-on]").hidden = !on;
      fs.querySelector("[data-off]").hidden = on;
    });
    $("#ed-close").onclick = () => { editing = null; $("#ed").innerHTML = '<div class="a-panel__head"><h2>날짜를 골라 주세요</h2></div><p class="k-sec" style="margin:0">왼쪽 표에서 ‘등록’ 또는 ‘수정’을 누르면 그날의 조식·석식을 편집할 수 있어요.</p>'; draw(); };
    ef.addEventListener("submit", (ev) => { ev.preventDefault(); save(d, ef); });
    if (window.matchMedia("(max-width:820px)").matches) $("#ed").scrollIntoView({ behavior: "smooth" });
  }
  $("#rows").addEventListener("click", (ev) => { const b = ev.target.closest("[data-edit]"); if (b) openEditor(b.dataset.edit); });

  async function save(d, ef) {
    const msg = $("#ed-msg");
    msg.innerHTML = "";
    const F = ef.elements, body = {};
    const errs = [];
    for (const meal of MEALS) {
      const on = F[meal + "_available"].value === "1";
      const dl = F[meal + "_deadline"].value;
      body[meal + "_available"] = on;
      body[meal + "_deadline"] = on && dl ? fmt.kstInputToUtc(dl) : null;
      body[meal + "_menu"] = on ? F[meal + "_menu"].value.trim() || null : null;
      body[meal + "_reason"] = on ? null : F[meal + "_reason"].value;
      F[meal + "_deadline"].classList.toggle("k-input--error", on && !dl);
      if (on && !dl) errs.push(`${UI.MEAL[meal]} 신청 마감 시각을 넣어 주세요.`);
      if (on && dl && new Date(fmt.kstInputToUtc(dl)) > new Date(`${fmt.addDays(d, 1)}T00:00:00+09:00`)) errs.push(`${UI.MEAL[meal]} 마감이 급식 날짜보다 뒤예요.`);
    }
    if (errs.length) { UI.banner(msg, errs.join(" "), "error"); return; }
    const exists = entries.has(d);
    const btn = ef.querySelector("button[type=submit]");
    await UI.busy(btn, async () => {
      try {
        if (exists) {
          const r = await API.patch(`/admin/meal-calendar/${d}`, body);
          entries.set(d, r);
        } else {
          const r = await API.post("/admin/meal-calendar", { service_date: d, ...body });
          for (const it of r.items || []) entries.set(it.service_date, it);
        }
        openEditor(d);
        UI.banner($("#ed-msg"), exists ? "수정했어요." : "등록했어요.", "ok");
      } catch (e) {
        UI.banner(msg, AShell.errorText(e), "error");
      }
    });
  }

  await load();
  const pre = AShell.q("date");
  if (AShell.isDate(pre) && days.includes(pre)) openEditor(pre);
})();
