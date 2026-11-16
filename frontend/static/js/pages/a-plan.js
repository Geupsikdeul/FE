// /admin/plan — AI 식단표 추천
// POST /admin/ai/menu-draft {start_date, days} → 초안 + 규칙 위반 목록 (저장 안 함)
// "일정에 반영" → POST /admin/meal-calendar [CalendarEntryCreate…] (이미 있는 날짜는 덮어씀)
(async () => {
  const { $, esc, fmt } = UI;
  const pf = $("#pf");
  const today = fmt.todayKST();
  const wd = new Date(today + "T00:00:00Z").getUTCDay();
  pf.start.value = fmt.addDays(today, ((8 - wd) % 7) || 7); // 다음 주 월요일

  const me = await AShell.init("plan");
  if (!me) { $("#run").disabled = true; return; }

  let draft = null, existing = new Map();
  const byDate = () => {
    const m = new Map();
    for (const x of draft.meals) { if (!m.has(x.service_date)) m.set(x.service_date, {}); m.get(x.service_date)[x.meal_type] = x; }
    return m;
  };
  const cell = (x) => x
    ? `<div class="k-strong">${esc(x.main)}</div><div class="k-cap">${esc(x.details)}</div>
       ${x.allergens_confirmed ? UI.allergenBadges(UI.allergenItems(x.allergens)) : '<span class="k-badge k-badge--danger">알레르기 미확인</span>'}`
    : '<span class="k-sec">—</span>';

  function draw() {
    const m = byDate();
    const dates = [...m.keys()];
    $("#label").textContent = dates.length ? `${fmt.kdate(dates[0])} ~ ${fmt.kdate(dates[dates.length - 1])} · ${draft.meals.length}끼` : "";
    $("#rows").innerHTML = dates.length ? dates.map((d) => `<tr><td style="white-space:nowrap"><span class="k-strong">${fmt.mmdd(d)}</span> <span class="k-sec">${fmt.wd(d)}</span>
        ${existing.has(d) ? '<br><span class="k-badge">기존 일정 있음</span>' : ""}</td><td>${cell(m.get(d).breakfast)}</td><td>${cell(m.get(d).dinner)}</td></tr>`).join("")
      : '<tr><td colspan="3" class="k-sec" style="text-align:center;padding:32px">초안이 비어 있어요.</td></tr>';
    $("#side").innerHTML = `<div class="a-panel__head"><h2>검토 사항</h2></div>
      ${draft.notes ? `<p style="margin:0 0 12px">${esc(draft.notes)}</p>` : ""}
      ${draft.violations.length ? `<ul style="padding-left:18px;color:var(--danger-text);line-height:1.6">${draft.violations.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>` : UI.bannerHTML("규칙 위반이 없어요.", "ok")}
      ${existing.size ? `<p class="k-cap">기존 일정이 있는 ${existing.size}일은 반영하면 덮어써요.</p>` : ""}`;
    $("#apply").disabled = !draft.meals.length;
  }

  pf.addEventListener("submit", async (e) => {
    e.preventDefault();
    AShell.clear();
    const start = pf.start.value, days = Number(pf.days.value);
    if (!AShell.isDate(start)) { AShell.error({ message: "시작 날짜를 확인해 주세요." }); return; }
    $("#rows").innerHTML = '<tr><td colspan="3" class="k-sec" style="text-align:center;padding:32px" role="status">AI가 식단을 짜고 있어요… (최대 1분)</td></tr>';
    $("#apply").disabled = true;
    await UI.busy($("#run"), async () => {
      try {
        const [d, cal] = await Promise.all([
          API.post("/admin/ai/menu-draft", { start_date: start, days }),
          API.get("/admin/meal-calendar", { from: start, to: fmt.addDays(start, days - 1) }),
        ]);
        draft = d;
        existing = new Map(cal.items.map((x) => [x.service_date, x]));
        draw();
      } catch (err) {
        $("#rows").innerHTML = '<tr><td colspan="3" class="k-sec" style="text-align:center;padding:32px">초안을 받지 못했어요.</td></tr>';
        AShell.error({ message: AShell.errorText(err) + (err.code === "AI_NOT_CONFIGURED" ? " 서버 환경변수 ANTHROPIC_API_KEY를 설정해 주세요." : "") });
      }
    });
  });

  // 반영: 마감은 급식 일정 화면 기본값과 같게 (조식 전날 18:00, 석식 당일 12:00 KST)
  $("#apply").onclick = async (ev) => {
    if (existing.size && !confirm(`기존 일정 ${existing.size}일을 덮어써요. 반영할까요?`)) return;
    const entries = [...byDate()].map(([d, m]) => {
      const e = { service_date: d };
      for (const meal of ["breakfast", "dinner"]) {
        const x = m[meal];
        e[meal + "_available"] = !!x;
        if (x) {
          e[meal + "_menu"] = [x.main, ...String(x.details || "").split(/\s*·\s*/)].filter(Boolean).join(", ");
          e[meal + "_allergens"] = x.allergens_confirmed ? x.allergens : null;
          e[meal + "_deadline"] = fmt.kstInputToUtc(meal === "breakfast" ? fmt.addDays(d, -1) + "T18:00" : d + "T12:00");
        } else e[meal + "_reason"] = "no_service";
      }
      return e;
    });
    await UI.busy(ev.currentTarget, async () => {
      try {
        await API.post("/admin/meal-calendar", entries);
        UI.flash(`${entries.length}일치 식단을 급식 일정에 반영했어요.`);
        location.href = `/admin/calendar?from=${entries[0].service_date}`;
      } catch (err) { AShell.error({ message: AShell.errorText(err) }); }
    });
  };
})();
