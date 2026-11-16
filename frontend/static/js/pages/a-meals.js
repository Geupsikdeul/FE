// /admin/meals — 희망 여부 모아보기
// GET /admin/meal-signups/summary?date&meal_type · GET /admin/meal-calendar?from&to (그날 운영 여부·마감·메뉴)
// GET /admin/students?is_active=true&size=1 (참고용 활성 학생 수) · GET /admin/meal-signups/export (API.download)
(async () => {
  const { $, esc, fmt } = UI;
  const form = $("#f");
  const today = fmt.todayKST();
  form.date.value = AShell.isDate(AShell.q("date")) ? AShell.q("date") : today;
  form.meal.value = AShell.q("meal") === "dinner" ? "dinner" : "breakfast";

  const me = await AShell.init("meals");
  if (!me) return;

  // 활성 학생 계정 수 (한 번만) — 집계 대상 수와 비교하는 참고값
  const activeP = API.get("/admin/students", { is_active: true, role: "student", size: 1 }).then((r) => r.total).catch(() => null);

  let seq = 0;
  async function load() {
    const date = form.date.value, meal = form.meal.value, my = ++seq;
    if (!AShell.isDate(date)) return;
    AShell.setQ({ date: date === today ? null : date, meal: meal === "breakfast" ? null : meal });
    AShell.clear();
    const [sum, cal] = await Promise.all([
      API.get("/admin/meal-signups/summary", { date, meal_type: meal }).catch((e) => ({ error: e })),
      API.get("/admin/meal-calendar", { from: date, to: date }).catch(() => null),
    ]);
    if (my !== seq) return;
    const M = UI.MEAL[meal];

    // 그날 운영 정보
    const ce = cal && (cal.items || []).find((c) => c.service_date === date);
    let op;
    if (!cal) op = "";
    else if (!ce) op = UI.bannerHTML(`${fmt.kdate(date)}은 급식 일정이 등록되지 않았어요. 급식 일정에서 등록할 수 있어요.`, "info");
    else if (!ce[meal + "_available"]) op = UI.bannerHTML(`${fmt.kdate(date)} ${M}은 운영하지 않아요 · ${AShell.REASON[ce[meal + "_reason"]] || "미운영"}`, "info");
    else {
      const dl = ce[meal + "_deadline"], menu = ce[meal + "_menu"];
      op = UI.bannerHTML(`<b>${esc(fmt.kdate(date))} ${M}</b> · 마감 ${dl ? esc(fmt.kst(dl)) : "미정"}${menu ? " · " + esc(menu) : ""}`, "info", true);
    }
    $("#op").innerHTML = op ? `<div class="a-msg">${op}</div>` : "";

    // 집계가 없거나 실패하면 이전 날짜·끼니 숫자가 남지 않게 타일을 빈 상태로 되돌려요
    const emptyTiles = () => {
      $("#tiles").innerHTML = `
      <div class="a-tile a-tile--hi"><div class="k-cap" style="color:var(--text)">예상 식사 인원 · ${M}</div><div class="a-num">–</div><div style="color:var(--text)">식사 + 미응답</div></div>
      <div class="a-tile"><div class="k-cap">식사 · ${M}</div><div class="a-num">–</div><div class="k-sec">직접 식사를 선택했어요</div></div>
      <div class="a-tile"><div class="k-cap">미응답 · ${M}</div><div class="a-num">–</div><div class="k-sec">식사로 집계돼요</div></div>
      <div class="a-tile"><div class="k-cap">결식 · ${M}</div><div class="a-num">–</div><div class="k-sec">식사하지 않아요</div></div>`;
    };
    if (sum.error) {
      AShell.error(sum.error);
      emptyTiles();
      $("#check").innerHTML = '<p class="k-sec" style="margin:0">집계를 불러오지 못했어요.</p>';
      $("#grades").innerHTML = ""; $("#final").innerHTML = "";
      return;
    }
    const m = sum[meal];
    if (!m) {
      emptyTiles();
      $("#check").innerHTML = `<p class="k-sec" style="margin:0">${fmt.kdate(date)} ${M}은 집계가 없어요. 운영하지 않거나 일정이 등록되지 않은 끼니예요.</p>`;
      $("#grades").innerHTML = ""; $("#final").innerHTML = "";
      return;
    }
    const exp = m.attending + m.no_response, total = exp + m.not_attending;
    const n = AShell.fmtNum;
    $("#tiles").innerHTML = `
      <div class="a-tile a-tile--hi"><div class="k-cap" style="color:var(--text)">예상 식사 인원 · ${M}</div><div class="a-num">${n(exp)}명</div><div style="color:var(--text)">식사 ${n(m.attending)} + 미응답 ${n(m.no_response)}</div></div>
      <div class="a-tile"><div class="k-cap">식사 · ${M}</div><div class="a-num">${n(m.attending)}명</div><div class="k-sec">직접 식사를 선택했어요</div></div>
      <div class="a-tile"><div class="k-cap">미응답 · ${M}</div><div class="a-num">${n(m.no_response)}명</div><div class="k-sec">응답하지 않아 식사로 집계돼요</div></div>
      <div class="a-tile"><div class="k-cap">결식 · ${M}</div><div class="a-num">${n(m.not_attending)}명</div><div class="k-sec">식사하지 않아요</div></div>`;

    $("#final").innerHTML = m.is_finalized
      ? `<span class="k-badge k-badge--soft">마감 확정${m.finalized_at ? " · " + esc(fmt.kst(m.finalized_at)) : ""}</span>`
      : '<span class="k-badge">마감 전 · 실시간 집계</span>';

    const active = await activeP;
    if (my !== seq) return;
    const activeLine = active === null ? ""
      : active === total
        ? `<p class="k-cap" style="margin:12px 0 0">참고: 활성 학생 계정 ${n(active)}명과 같아요.</p>`
        : `<p class="k-cap" style="margin:12px 0 0">참고: 지금 활성 학생 계정은 ${n(active)}명이에요.${m.is_finalized ? " 마감 시점 스냅샷이라 이후 가입·비활성화는 반영되지 않아요." : " 집계 대상 기준이 계정 수와 다를 수 있어요."}</p>`;
    $("#check").innerHTML = `
      <div class="a-tablewrap"><table class="a-table">
        <thead><tr><th>구분</th><th class="num">인원</th><th>설명</th></tr></thead>
        <tbody>
          <tr><td class="k-strong">식사</td><td class="num">${n(m.attending)}</td><td class="k-sec">직접 식사 선택</td></tr>
          <tr class="is-sel"><td class="k-strong">미응답</td><td class="num">${n(m.no_response)}</td><td class="k-sec">식사로 집계 (별도 표시)</td></tr>
          <tr><td class="k-strong">예상 식사 인원</td><td class="num">${n(exp)}</td><td class="k-sec">식사 + 미응답</td></tr>
          <tr><td class="k-strong">결식</td><td class="num">${n(m.not_attending)}</td><td class="k-sec">비희망</td></tr>
          <tr><td class="k-strong">합계 (집계 대상)</td><td class="num">${n(total)}</td><td><span class="k-badge k-badge--soft">예상 ${n(exp)} + 결식 ${n(m.not_attending)} = ${n(total)} ✓</span></td></tr>
        </tbody></table></div>${activeLine}`;

    const gs = [...(m.by_grade || [])].sort((a, z) => a.grade - z.grade);
    const gmax = Math.max(1, ...gs.map((g) => g.attending));
    $("#grades").innerHTML = gs.length
      ? gs.map((g) => `<div class="a-line"><div class="k-between"><span class="k-strong">${g.grade}학년</span><span class="k-strong">${n(g.attending)}명</span></div><div class="k-bar" role="img" aria-label="${g.grade}학년 ${g.attending}명"><i style="width:${Math.round(g.attending / gmax * 100)}%"></i></div></div>`).join("")
        + `<p class="k-cap" style="margin:0">학년별 식사 합 ${n(gs.reduce((s, g) => s + g.attending, 0))}명 (미응답 제외)</p>`
      : '<p class="k-sec" style="margin:0">학년별 집계가 없어요.</p>';
  }

  form.addEventListener("change", load);
  form.addEventListener("submit", (e) => { e.preventDefault(); load(); });
  const shift = (n) => { form.date.value = fmt.addDays(AShell.isDate(form.date.value) ? form.date.value : today, n); load(); };
  $("#f-prev").onclick = () => shift(-1);
  $("#f-next").onclick = () => shift(1);
  $("#f-today").onclick = () => { form.date.value = today; load(); };

  async function exportAs(format, btn) {
    const date = form.date.value, meal = form.meal.value;
    await UI.busy(btn, async () => {
      try {
        await API.download("/admin/meal-signups/export", { date, meal_type: meal, format }, `${meal}_${date.replaceAll("-", "")}.${format}`);
      } catch (e) { AShell.error(e); }
    });
  }
  $("#x-csv").onclick = (e) => exportAs("csv", e.currentTarget);
  $("#x-xlsx").onclick = (e) => exportAs("xlsx", e.currentTarget);

  load();
})();
