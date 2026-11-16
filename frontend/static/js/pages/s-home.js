// /home — 오늘 조식·석식 메뉴와 내 신청 상태, 해야 할 일(미응답 식사 신청, 참여 안 한 투표).
(async function () {
  const { $, esc, fmt } = UI;
  const today = fmt.todayKST();
  $("#today").textContent = fmt.kdateFull(today);
  $("#mark").innerHTML = UI.mark(30);
  const box = $("#content");
  box.innerHTML = S.loading();

  const me = await S.boot("home");
  if (!me) { box.innerHTML = ""; return; }

  let win, polls;
  try {
    [win, polls] = await Promise.all([
      S.loadWindow(today, 15),
      API.get("/polls", { status: "open", size: 20 }).catch((e) => ({ error: e })),
    ]);
  } catch (e) { box.innerHTML = ""; UI.showError($("#flash"), e); return; }

  const day = win.days.find((x) => x.service_date === today);

  // 오늘 카드
  const cards = S.MEALS.map(([key, label]) => {
    const slot = day && day[key];
    const su = win.signups.get(`${today}_${key}`);
    let badge = "", body;
    if (!slot || !slot.available) {
      badge = slot ? `<span class="k-badge">${esc(S.REASON[slot.reason] || "운영 안 함")}</span>` : "";
      body = '<p class="k-sec" style="font-weight:500">오늘은 운영하지 않아요.</p>';
    } else {
      badge = su ? (su.will_attend ? '<span class="k-badge k-badge--soft">식사</span>' : '<span class="k-badge">결식</span>')
                 : '<span class="k-badge k-badge--soft">미응답 · 식사로 집계</span>';
      const ds = S.dishes(slot.menu);
      body = ds.length
        ? `<p><a href="/menu?date=${today}&amp;slot=${key}">${ds.map(esc).join(" · ")}</a></p>`
        : '<p class="k-sec" style="font-weight:500">아직 식단이 올라오지 않았어요.</p>';
    }
    return `<section class="k-card k-card--pad k-meal"><div class="k-between"><h2>${label}</h2>${badge}</div>${body}</section>`;
  }).join("");

  // 해야 할 일: 지금 고를 수 있는데 응답 안 한 끼니
  const now = new Date();
  const pending = [];
  for (const d of win.days) for (const [key] of S.MEALS) {
    const su = win.signups.get(`${d.service_date}_${key}`);
    if (!su && S.slotState(d[key], su, today, now).open) pending.push(d.service_date);
  }
  const todo = [];
  if (pending.length) {
    const a = pending[0], b = pending[pending.length - 1];
    todo.push(`<a class="k-row" href="/meals" style="min-height:68px"><div class="k-grow">
      <div class="k-t k-strong">식사 신청 미응답 ${pending.length}끼</div>
      <div class="k-cap">${fmt.mmdd(a)}${a !== b ? " ~ " + fmt.mmdd(b) : ""} · 응답하지 않으면 식사로 집계돼요</div></div>
      <span class="k-t k-pt k-strong">신청하기</span><span class="k-chev"></span></a>`);
  }
  if (polls && !polls.error) {
    for (const p of polls.items.filter((x) => x.status === "open" && !x.has_voted)) {
      todo.push(`<a class="k-row" href="/vote?id=${encodeURIComponent(p.id)}" style="min-height:68px"><div class="k-grow">
        <div class="k-t k-strong">${esc(p.title)}</div>
        <div class="k-cap">${esc(fmt.kst(p.closes_at))} 마감</div></div>
        <span class="k-t k-pt k-strong">투표하기</span><span class="k-chev"></span></a>`);
    }
  }

  box.innerHTML = `<div class="k-stack">${cards}</div>` +
    (todo.length ? `<h2 class="k-head">해야 할 일</h2><div class="k-card">${todo.join("")}</div>`
                 : '<h2 class="k-head">해야 할 일</h2><div class="k-card"><div class="k-empty">지금 할 일이 없어요.</div></div>') +
    (polls && polls.error ? `<p class="k-cap" style="margin:8px 32px 0">투표 목록을 불러오지 못했어요.</p>` : "");
})();
