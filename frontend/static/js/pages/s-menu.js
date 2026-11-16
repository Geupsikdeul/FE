// /menu?date=YYYY-MM-DD&slot=breakfast|dinner — 날짜별 조식·석식 메뉴 (meal-calendar의 menu 문자열).
(async function () {
  const { $, esc, fmt } = UI;
  const today = fmt.todayKST();
  const qd = S.param("date");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(qd || "") && !isNaN(Date.parse(qd)) ? qd : today;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const qs = S.param("slot");
  const slot = qs === "breakfast" || qs === "dinner" ? qs : date === today && hour >= 9 ? "dinner" : "breakfast";
  const url = (d, s) => `/menu?date=${d}&slot=${s}`;

  $("#prev").href = url(fmt.addDays(date, -1), slot);
  $("#next").href = url(fmt.addDays(date, 1), slot);
  $("#day").href = url(today, slot);
  $("#day").textContent = fmt.kdate(date) + (date === today ? " · 오늘" : "");
  $("#slots").innerHTML = S.MEALS.map(([k, label]) =>
    `<a href="${url(date, k)}"${k === slot ? ' class="is-on" aria-current="true"' : ""}>${label}</a>`).join("");
  const box = $("#content");
  box.innerHTML = S.loading();

  if (!(await S.boot("menu"))) { box.innerHTML = ""; return; }

  let day, mine = [];
  try {
    const [items, al] = await Promise.all([
      S.getRange("/meal-calendar", date, date),
      API.get("/auth/me/allergies").catch(() => ({ allergies: [] })),
    ]);
    day = items.find((x) => x.service_date === date);
    mine = UI.allergenItems(al.allergies).map((a) => a.no);
  } catch (e) { box.innerHTML = ""; UI.showError($("#flash"), e); return; }

  const label = slot === "breakfast" ? "조식" : "석식";
  const s = day && day[slot];
  if (!s || !s.available) {
    const why = s && S.REASON[s.reason];
    box.innerHTML = `<div class="k-empty">${why ? esc(why) + " · " : ""}${label}을 운영하지 않는 날이에요.</div>`;
  } else {
    const ds = S.dishes(s.menu);
    box.innerHTML = ds.length
      ? ds.map((n) => `<div class="k-row"><div class="k-t k-strong">${esc(n)}</div></div>`).join("")
      : '<div class="k-empty">아직 확정된 식단이 없어요.</div>';
    // 알레르기 유발 물질 (끼니 단위). 내 알레르기와 겹치면 빨간 배지 + 안내
    const items = UI.allergenItems(s.allergens);
    const hit = items.filter((a) => mine.includes(a.no));
    if (ds.length) box.innerHTML += `<div class="k-row k-row--col" style="align-items:flex-start;gap:8px">
      <div class="k-cap">알레르기 유발 물질</div>${UI.allergenBadges(items, mine)}
      ${hit.length ? `<div class="k-cap" style="color:var(--danger-text);font-weight:600">내 알레르기(${hit.map((a) => esc(a.name)).join(", ")})가 들어 있어요. 배식 때 한 번 더 확인해 주세요.</div>` : ""}</div>`;
    if (s.deadline) $("#note").innerHTML = `${label} 신청 마감: ${esc(fmt.kst(s.deadline))} · <a class="k-pt k-strong" href="/meals">식사 신청</a>`;
  }
})();
