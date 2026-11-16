// /admin — 대시보드
// GET /admin/meal-signups/summary?date= (선택 날짜 −5 ~ +2, 8번) · GET /admin/meal-calendar?from&to · GET /admin/polls
(async () => {
  const { $, esc, fmt } = UI;
  const today = fmt.todayKST();
  const date = AShell.isDate(AShell.q("date")) ? AShell.q("date") : today;
  const href = (d) => (d === today ? "/admin" : "/admin?date=" + d);

  $("#d-prev").href = href(fmt.addDays(date, -1));
  $("#d-next").href = href(fmt.addDays(date, 1));
  $("#d-label").textContent = fmt.kdate(date) + (date === today ? " · 오늘" : "");

  const days = Array.from({ length: 8 }, (_, i) => fmt.addDays(date, i - 5));
  $("#chart-range").textContent = `${fmt.mmdd(days[0])} ~ ${fmt.mmdd(days[7])}`;

  const me = await AShell.init("dashboard");
  if (!me) return;

  // 막대그래프용 8일 집계 + 운영 일정을 함께 받아요. 날짜 하나가 실패해도 나머지는 그려요.
  const [sums, cal] = await Promise.all([
    Promise.all(days.map((d) => API.get("/admin/meal-signups/summary", { date: d }).catch((e) => ({ service_date: d, error: e })))),
    API.get("/admin/meal-calendar", { from: days[0], to: days[7] }).catch((e) => ({ items: [], error: e })),
  ]);
  const calMap = new Map((cal.items || []).map((c) => [c.service_date, c]));
  const sel = sums[5];
  if (sel.error) AShell.error(sel.error);
  else if (cal.error) AShell.error(cal.error);

  // 끼니 하나의 상태: {m: MealSummary|null, off: "사유"|null}
  function slot(i, meal) {
    const s = sums[i], ce = calMap.get(days[i]);
    if (ce && ce[meal + "_available"] === false) return { m: null, off: AShell.REASON[ce[meal + "_reason"]] || "운영 안 함" };
    const m = s.error ? null : s[meal];
    if (!m) return { m: null, off: s.error ? "불러오지 못함" : ce ? "운영 안 함" : "일정 미등록" };
    return { m, off: null };
  }
  const expected = (m) => m.attending + m.no_response;

  // 1) 타일
  function tile(meal) {
    const { m, off } = slot(5, meal);
    if (!m) return `<div class="a-tile"><div class="k-cap">${UI.MEAL[meal]} 예상 인원</div><div class="a-num">–</div><div class="k-sec">${esc(off)}</div></div>`;
    return `<div class="a-tile"><div class="k-cap">${UI.MEAL[meal]} 예상 인원 ${m.is_finalized ? '<span class="k-badge k-badge--soft">마감 확정</span>' : ""}</div>
      <div class="a-num">${AShell.fmtNum(expected(m))}명</div>
      <div class="k-sec">식사 ${m.attending} · 미응답 ${m.no_response} · 결식 ${m.not_attending}</div></div>`;
  }
  const b = slot(5, "breakfast").m, dn = slot(5, "dinner").m;
  const ub = b ? b.no_response : 0, ud = dn ? dn.no_response : 0;
  $("#tiles").innerHTML = tile("breakfast") + tile("dinner") +
    `<div class="a-tile a-tile--hi"><div class="k-cap" style="color:var(--text)">미응답</div>
      <div class="a-num">${b || dn ? AShell.fmtNum(ub + ud) + "명" : "–"}</div>
      <div style="color:var(--text)">조식 ${b ? ub : "–"} · 석식 ${dn ? ud : "–"} · 식사로 집계돼요</div></div>`;

  // 2) 막대그래프 — 높이 기준은 8일 중 가장 큰 집계 대상 수(식사+결식+미응답)
  const vals = days.map((_, i) => ["breakfast", "dinner"].map((meal) => slot(i, meal)));
  let max = 1;
  vals.forEach((pair) => pair.forEach(({ m }) => { if (m) max = Math.max(max, m.attending + m.not_attending + m.no_response); }));
  $("#chart").innerHTML = days.map((d, i) => {
    const [bs, ds] = vals[i];
    const bar = (s, cls, label) => s.m ? `<div class="a-b ${cls}" style="height:${Math.round(expected(s.m) / max * 190)}px" title="${label} 예상 ${expected(s.m)}명"></div>` : "";
    const inner = !bs.m && !ds.m
      ? `<span class="a-off">${esc(bs.off === ds.off ? bs.off : bs.off + " · " + ds.off)}</span>`
      : bar(bs, "a-b--m", "조식") + bar(ds, "a-b--d", "석식");
    const v = (s) => (s.m ? expected(s.m) : "–");
    return `<a class="a-day" href="${href(d)}" aria-label="${fmt.kdate(d)} 조식 ${v(bs)} 석식 ${v(ds)}"${d === date ? ' aria-current="date"' : ""}>
      <div class="a-bars">${inner}</div>
      <div class="a-dlab ${d === date ? "a-dlab--sel" : ""}">${fmt.mmdd(d)} <span ${d !== date ? 'class="k-sec"' : ""} style="font-weight:400">${fmt.wd(d)}</span></div>
      <div class="a-vals">${v(bs)} · ${v(ds)}</div></a>`;
  }).join("");
  $("#chart-cap").textContent = `막대 아래 숫자는 조식 · 석식 순서예요. 예상 = 식사 + 미응답, 높이는 집계 대상 ${max}명 기준이에요.`;

  // 3) 학년별 식사 인원 (by_grade.attending = 식사를 고른 학생)
  $("#grade-cap").textContent = `${fmt.mmdd(date)} 식사 선택 기준`;
  const grades = new Map();
  for (const [meal, m] of [["breakfast", b], ["dinner", dn]]) for (const g of (m && m.by_grade) || []) {
    const x = grades.get(g.grade) || { breakfast: null, dinner: null };
    x[meal] = g.attending; grades.set(g.grade, x);
  }
  if (!grades.size) {
    $("#grades").innerHTML = `<p class="k-sec" style="margin:0">${b || dn ? "학년별 집계가 아직 없어요." : "이날은 집계할 끼니가 없어요."}</p>`;
  } else {
    const gmax = Math.max(1, ...[...grades.values()].flatMap((x) => [x.breakfast || 0, x.dinner || 0]));
    $("#grades").innerHTML = [...grades.entries()].sort((a, z) => a[0] - z[0]).map(([g, x]) => `
      <div class="a-line">
        <div class="k-between"><span class="k-strong">${g}학년</span><span class="k-strong">조식 ${x.breakfast ?? "–"} · 석식 ${x.dinner ?? "–"}</span></div>
        <div class="k-bar" role="img" aria-label="${g}학년 조식 ${x.breakfast ?? 0}명"><i style="width:${Math.round((x.breakfast || 0) / gmax * 100)}%"></i></div>
        <div class="k-bar a-bar--d" role="img" aria-label="${g}학년 석식 ${x.dinner ?? 0}명"><i style="width:${Math.round((x.dinner || 0) / gmax * 100)}%"></i></div>
      </div>`).join("");
  }

  // 4) 진행 중인 투표
  try {
    const open = (await AShell.allPolls()).filter((p) => p.is_published && p.status === "open")
      .sort((a, z) => new Date(a.closes_at) - new Date(z.closes_at));
    $("#polls").innerHTML = open.length
      ? open.map((p) => `<a class="a-link" href="/admin/poll?id=${p.id}">
          <div class="k-grow"><div class="k-strong">${esc(p.title)}</div><div class="k-cap">${fmt.kst(p.closes_at)} 마감 · ${p.total_votes}명 참여 · 남은 시간 ${fmt.remaining(p.closes_at)}</div></div>
          <span class="k-badge k-badge--primary">진행 중</span><span class="k-chev"></span></a>`).join("")
      : '<p class="k-sec" style="margin:0 0 12px">진행 중인 투표가 없어요.</p><a class="k-btn k-btn--tonal k-btn--sm" href="/admin/poll-new">새 투표 만들기</a>';
  } catch (e) {
    UI.showError($("#polls"), e);
  }
})();
