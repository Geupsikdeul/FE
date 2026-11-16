// /requests — 희망 메뉴 목록 (GET /wishes), 좋아요 토글 (POST /wishes/{id}/like), 내 글 삭제 (DELETE /wishes/{id}).
// 위쪽 카드: 진행 중 투표 (GET /polls?status=open).
(async function () {
  const { $, esc, fmt, ICONS } = UI;
  const list = $("#list");
  $("#fab").innerHTML = `${ICONS.plus}메뉴 신청하기`;
  list.innerHTML = S.loading();
  if (!(await S.boot("requests"))) { list.innerHTML = ""; return; }

  let wishes = [], sort = "likes";

  const sorted = () => [...wishes].sort(sort === "likes"
    ? (a, b) => b.likes - a.likes || b.id - a.id
    : (a, b) => (a.created_at < b.created_at ? 1 : -1));

  function draw() {
    $("#count").textContent = `신청된 메뉴 ${wishes.length}개`;
    if (!wishes.length) { list.innerHTML = '<div class="k-empty">아직 신청된 메뉴가 없어요. 첫 번째로 신청해 보세요!</div>'; return; }
    // 순위는 항상 좋아요 기준 (상위 5개 = 투표 후보)
    const rank = new Map([...wishes].sort((a, b) => b.likes - a.likes || b.id - a.id).map((w, i) => [w.id, i + 1]));
    list.innerHTML = sorted().map((w) => {
      const r = rank.get(w.id);
      return `<div class="k-row" style="min-height:72px">
        <span class="k-rank ${r <= 5 ? "k-rank--top" : ""}">${r}</span>
        <div class="k-grow"><div class="k-t k-strong">${esc(w.menu_name)}</div>
          <div class="k-cap">${esc(w.reason)}</div>
          <div class="k-cap">${esc(w.author)}${w.is_mine ? ` · <button type="button" class="k-btn k-btn--plain k-btn--sm" style="height:auto;padding:0;min-width:0" data-del="${w.id}">삭제</button>` : ""}</div></div>
        <button class="k-like ${w.liked ? "is-on" : ""}" type="button" data-like="${w.id}" aria-pressed="${w.liked}" aria-label="좋아요 ${w.likes}${w.liked ? ", 내가 누름" : ""}">${ICONS.heart(w.liked)}${w.likes}</button>
      </div>`;
    }).join("");
  }

  $("#sort").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sort]");
    if (!b) return;
    sort = b.dataset.sort;
    for (const x of $("#sort").children) { const on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on); }
    draw();
  });

  list.addEventListener("click", async (e) => {
    const like = e.target.closest("[data-like]");
    const del = e.target.closest("[data-del]");
    if (like) {
      await UI.busy(like, async () => {
        try {
          const r = await API.post(`/wishes/${like.dataset.like}/like`);
          Object.assign(wishes.find((w) => w.id === r.id), { likes: r.likes, liked: r.liked });
          draw();
        } catch (err) { UI.showError($("#flash"), err); }
      });
    } else if (del) {
      if (!confirm("이 희망 메뉴를 삭제할까요?")) return;
      try {
        await API.del(`/wishes/${del.dataset.del}`);
        wishes = wishes.filter((w) => w.id !== Number(del.dataset.del));
        draw();
        UI.banner($("#flash"), "삭제했어요.");
      } catch (err) { UI.showError($("#flash"), err); }
    }
  });

  try {
    const [w, polls] = await Promise.all([
      API.get("/wishes"),
      API.get("/polls", { status: "open", size: 5 }).catch(() => ({ items: [] })),
    ]);
    wishes = w.items;
    const p = polls.items.find((x) => x.status === "open");
    if (p) {
      $("#poll").innerHTML = `<div class="k-card k-card--soft"><a class="k-row" href="/vote?id=${encodeURIComponent(p.id)}" style="min-height:64px">
        <div class="k-grow"><div class="k-t k-strong">${esc(p.title)}</div>
        <div class="k-cap" style="color:var(--text)">${esc(fmt.kst(p.closes_at))} 마감 · ${Number(p.total_votes)}명 참여</div></div>
        <span class="k-t k-pt k-strong">${p.has_voted ? "내 선택 보기" : "투표하기"}</span><span class="k-chev"></span></a></div>`;
    }
    UI.showFlash($("#flash"));
    draw();
  } catch (e) { list.innerHTML = ""; UI.showError($("#flash"), e); }
})();
