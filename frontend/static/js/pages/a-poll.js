// /admin/poll?id= — 투표 현황
// GET /admin/polls/{id} · GET /admin/polls/{id}/stats · GET /admin/polls/{id}/non-voters?grade&class_no
// POST /admin/polls/{id}/publish · POST /admin/polls/{id}/close · DELETE /admin/polls/{id} (409 POLL_HAS_VOTES)
(async () => {
  const me = await AShell.init("votes");
  if (!me) return;
  const { $, esc, fmt } = UI;
  const id = AShell.int(AShell.q("id"));
  if (!id) {
    AShell.error({ message: "투표 번호가 없어요. 투표 목록에서 골라 주세요." }); $("#p-sub").textContent = "";
    $("#opts").innerHTML = $("#grades").innerHTML = "";
    $("#nv").innerHTML = '<tr><td colspan="3" class="k-sec" style="text-align:center;padding:32px">투표를 고르지 않았어요.</td></tr>';
    return;
  }
  const P = `/admin/polls/${id}`;
  const n = AShell.fmtNum;

  const cls = $("#nv-c");
  for (let i = 1; i <= 15; i++) cls.insertAdjacentHTML("beforeend", `<option value="${i}">${i}반</option>`);

  let poll;
  async function load() {
    let stats;
    try {
      [poll, stats] = await Promise.all([API.get(P), API.get(P + "/stats").catch((e) => ({ error: e }))]);
    } catch (e) {
      AShell.error(e);
      $("#p-sub").textContent = "투표를 불러오지 못했어요.";
      if (!poll) {
        const failed = '<p class="k-sec" style="margin:0">불러오지 못했어요.</p>';
        $("#opts").innerHTML = failed; $("#grades").innerHTML = failed;
        $("#nv").innerHTML = '<tr><td colspan="3" class="k-sec" style="text-align:center;padding:32px">불러오지 못했어요.</td></tr>';
      }
      return;
    }
    document.title = `${poll.title} · 급식들 어드민`;
    $("#p-title").textContent = poll.title;
    $("#p-sub").innerHTML = `${esc(fmt.kdate(poll.target_date))} 급식 · ${esc(fmt.kst(poll.opens_at))} ~ ${esc(fmt.kst(poll.closes_at))} ${AShell.pollBadge(poll)}`
      + (poll.description ? `<br>${esc(poll.description)}` : "");
    actions();

    if (stats.error) {
      UI.showError($("#opts"), stats.error);
      $("#grades").innerHTML = "";
      loadNonVoters(); // 통계가 실패해도 미참여 학생 목록은 따로 불러요
      return;
    }
    const total = stats.total_votes;
    const rows = AShell.rankOptions(poll.options, stats.by_option, total);

    // 타일
    let timeNum, timeSub;
    if (!poll.is_published) { timeNum = "비공개"; timeSub = "공개해야 학생이 볼 수 있어요"; }
    else if (poll.status === "scheduled") { timeNum = "시작 전"; timeSub = `${fmt.kst(poll.opens_at)}에 시작해요`; }
    else if (poll.status === "open") { timeNum = fmt.remaining(poll.closes_at); timeSub = `${fmt.kst(poll.closes_at)} 마감 · 마감 전에는 학생이 선택을 바꿀 수 있어요`; }
    else { timeNum = "마감"; timeSub = `${fmt.kst(poll.closes_at)} 마감됐어요`; }
    const top = rows.filter((r) => r.rank === 1);
    $("#tiles").innerHTML = `
      <div class="a-tile"><div class="k-cap">참여</div><div class="a-num">${n(total)}명</div><div class="k-sec">대상 ${n(stats.eligible_students)}명 중 ${fmt.pct(stats.participation_rate || 0)}%</div></div>
      <div class="a-tile"><div class="k-cap">마감까지</div><div class="a-num">${esc(timeNum)}</div><div class="k-sec">${esc(timeSub)}</div></div>
      <div class="a-tile a-tile--hi"><div class="k-cap" style="color:var(--text)">${poll.status === "closed" ? "최종 1위" : "현재 1위"}${top.length > 1 ? " (공동)" : ""}</div>
        ${top.length ? `<div class="a-num">${esc(top.map((r) => r.menu_name).join(" · "))}</div><div style="color:var(--text)">${n(top[0].vote_count)}표 · ${fmt.pct(top[0].pct)}%</div>`
          : '<div class="a-num">–</div><div style="color:var(--text)">아직 참여자가 없어요 · 모두 0표 0.0%</div>'}</div>`;

    // 선택지별 득표 (득표수·득표율·순위, 동점 공동 순위, 0표면 0)
    $("#opts").innerHTML = rows.length ? rows.map((r) => `
      <div class="a-line">
        <div class="k-between">
          <span class="k-flex"><span class="k-rank ${r.rank && r.rank <= 3 ? "k-rank--top" : ""}" style="width:auto">${r.rank ? r.rank + "위" : "–"}</span>
            <span class="k-t k-strong">${esc(r.menu_name)}</span>${r.tied ? '<span class="k-badge k-badge--soft">공동</span>' : ""}</span>
          <span class="k-t k-strong" style="white-space:nowrap">${n(r.vote_count)}표 · ${fmt.pct(r.pct)}%</span>
        </div>
        ${r.description ? `<div class="k-cap">${esc(r.description)}</div>` : ""}
        <div class="k-bar" role="img" aria-label="${esc(r.menu_name)} ${fmt.pct(r.pct)}%"><i style="width:${r.pct.toFixed(1)}%"></i></div>
      </div>`).join("") + (total === 0 ? '<p class="k-cap" style="margin:0">아직 참여자가 없어 모든 선택지를 0표 · 0.0%로 표시해요.</p>' : "")
      : '<p class="k-sec" style="margin:0">선택지가 없어요.</p>';

    // 학년별 참여
    const gs = [...(stats.by_grade || [])].sort((a, z) => a.grade - z.grade);
    $("#grades").innerHTML = gs.length ? gs.map((g) => `
      <div class="a-line"><div class="k-between"><span class="k-strong">${g.grade}학년</span><span class="k-strong">${n(g.voted)} / ${n(g.eligible)}명 · ${fmt.pct(g.rate || 0)}%</span></div>
        <div class="k-bar" role="img" aria-label="${g.grade}학년 ${fmt.pct(g.rate || 0)}%"><i style="width:${Math.min(100, g.rate || 0).toFixed(1)}%"></i></div></div>`).join("")
      : '<p class="k-sec" style="margin:0">학년별 집계가 없어요.</p>';

    loadNonVoters();
  }

  function actions() {
    const b = [];
    if (poll.status !== "closed") b.push(`<a class="k-btn k-btn--tonal k-btn--sm" href="/admin/poll-new?id=${poll.id}">수정</a>`);
    if (!poll.is_published) b.push('<button class="k-btn k-btn--sm" type="button" data-act="publish">공개하기</button>');
    if (poll.is_published && poll.status !== "closed") b.push('<button class="k-btn k-btn--sm" type="button" data-act="close">지금 마감하기</button>');
    b.push('<button class="k-btn k-btn--danger k-btn--sm" type="button" data-act="delete">삭제</button>');
    $("#p-actions").innerHTML = b.join("");
  }

  $("#p-actions").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    const ask = {
      publish: `‘${poll.title}’을 공개할까요? 학생 화면 투표 목록에 나타나요.`,
      close: `‘${poll.title}’을 지금 마감할까요? 마감하면 학생이 더 이상 투표할 수 없어요.`,
      delete: `‘${poll.title}’을 삭제할까요? 되돌릴 수 없어요.`,
    }[act];
    if (!confirm(ask)) return;
    await UI.busy(btn, async () => {
      try {
        if (act === "delete") {
          await API.del(P);
          UI.flash("투표를 삭제했어요.");
          location.href = "/admin/votes";
          return;
        }
        await API.post(`${P}/${act}`);
        await load();
        AShell.ok(act === "publish" ? "투표를 공개했어요." : "투표를 마감했어요.");
      } catch (e) {
        if (e.code === "POLL_HAS_VOTES") {
          AShell.error({ message: "이미 투표한 학생이 있어서 삭제할 수 없어요. 더 받지 않으려면 ‘지금 마감하기’를 눌러 주세요." });
        } else AShell.error({ message: AShell.errorText(e) });
      }
    });
  });

  // 미참여 학생 — 공개된 투표만 의미가 있어요
  const nvF = $("#nv-f");
  async function loadNonVoters() {
    if (!poll.is_published) {
      $("#nv-count").textContent = "";
      $("#nv").innerHTML = '<tr><td colspan="3" class="k-sec" style="text-align:center;padding:32px">공개 전 투표예요. 공개한 뒤 미참여 학생을 확인할 수 있어요.</td></tr>';
      return;
    }
    try {
      const r = await API.get(P + "/non-voters", { grade: nvF.grade.value, class_no: nvF.class_no.value });
      $("#nv-count").textContent = `${n(r.total)}명`;
      $("#nv").innerHTML = r.items.length ? r.items.map((s) => `<tr><td class="num" style="text-align:left">${esc(s.student_no)}</td><td class="k-strong">${esc(s.name)}</td><td>${s.grade ?? "–"}학년 ${s.class_no ?? "–"}반</td></tr>`).join("")
        : '<tr><td colspan="3" class="k-sec" style="text-align:center;padding:32px">조건에 맞는 미참여 학생이 없어요.</td></tr>';
    } catch (e) {
      $("#nv").innerHTML = `<tr><td colspan="3" style="padding:16px">${UI.bannerHTML(e.message, "error")}</td></tr>`;
    }
  }
  nvF.addEventListener("change", loadNonVoters);

  load();
})();
