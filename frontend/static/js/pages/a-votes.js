// /admin/votes — 투표 목록 (GET /admin/polls, 상태 필터는 화면에서: 비공개 = is_published false)
(async () => {
  const me = await AShell.init("votes");
  if (!me) return;
  const { $, $$, esc, fmt } = UI;
  const KEYS = ["all", "draft", "scheduled", "open", "closed"];
  let st = KEYS.includes(AShell.q("status")) ? AShell.q("status") : "all";
  $$('#st input').forEach((r) => (r.checked = r.value === st));

  let polls = [];
  try {
    polls = await AShell.allPolls();
  } catch (e) {
    AShell.error(e);
    $("#rows").innerHTML = '<tr><td colspan="7" class="k-sec" style="text-align:center;padding:32px">목록을 불러오지 못했어요.</td></tr>';
    return;
  }
  // 진행 중 → 시작 전 → 비공개 → 마감, 같은 상태끼리는 마감 시각 순
  const ORDER = { open: 0, scheduled: 1, draft: 2, closed: 3 };
  polls.sort((a, z) => ORDER[AShell.pollKey(a)] - ORDER[AShell.pollKey(z)] || new Date(z.closes_at) - new Date(a.closes_at));

  function draw() {
    AShell.setQ({ status: st === "all" ? null : st });
    const list = st === "all" ? polls : polls.filter((p) => AShell.pollKey(p) === st);
    const counts = {};
    polls.forEach((p) => { const k = AShell.pollKey(p); counts[k] = (counts[k] || 0) + 1; });
    $("#count").textContent = `전체 ${polls.length}개 · 진행 중 ${counts.open || 0} · 시작 전 ${counts.scheduled || 0} · 비공개 ${counts.draft || 0} · 마감 ${counts.closed || 0}`;
    $("#rows").innerHTML = list.length ? list.map((p) => `
      <tr>
        <td><a class="k-strong" href="/admin/poll?id=${p.id}">${esc(p.title)}</a>${p.description ? `<div class="k-cap">${esc(p.description)}</div>` : ""}</td>
        <td style="white-space:nowrap">${esc(fmt.kdate(p.target_date))}</td>
        <td style="white-space:nowrap">${esc(fmt.kst(p.opens_at))}<br><span class="k-sec">~ ${esc(fmt.kst(p.closes_at))}</span></td>
        <td>${AShell.pollBadge(p)}</td>
        <td class="num">${AShell.fmtNum(p.total_votes)}명</td>
        <td class="num">${p.options.length}개</td>
        <td style="white-space:nowrap"><a class="k-btn k-btn--tonal k-btn--sm" href="/admin/poll?id=${p.id}">현황</a></td>
      </tr>`).join("")
      : `<tr><td colspan="7" class="k-sec" style="text-align:center;padding:32px">${polls.length ? "이 상태의 투표가 없어요." : '아직 만든 투표가 없어요. <a class="k-pt k-strong" href="/admin/poll-new">새 투표 만들기</a>'}</td></tr>`;
  }
  $("#st").addEventListener("change", (e) => { st = e.target.value; draw(); });
  draw();
})();
