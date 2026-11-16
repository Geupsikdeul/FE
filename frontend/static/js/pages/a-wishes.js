// /admin/wishes — 희망 메뉴 (GET /wishes, DELETE /admin/wishes/{id})
// AI: POST /admin/ai/poll-candidates, POST /admin/ai/poll-recommendations → "이 후보로 투표 만들기"(poll-new로 전달)
(async () => {
  const { $, esc } = UI;
  const me = await AShell.init("wishes");
  if (!me) return;

  let wishes = [];
  function draw() {
    $("#count").textContent = `${wishes.length}개`;
    $("#rows").innerHTML = wishes.length ? wishes.map((w, i) => `<tr>
      <td class="num"><span class="k-rank ${i < 5 ? "k-rank--top" : ""}">${i + 1}</span></td>
      <td class="k-strong">${esc(w.menu_name)}</td><td>${esc(w.reason)}</td><td class="k-sec">${esc(w.author)}</td>
      <td class="num">${AShell.fmtNum(w.likes)}</td>
      <td><button class="k-btn k-btn--plain k-btn--sm" type="button" data-del="${w.id}">삭제</button></td></tr>`).join("")
      : '<tr><td colspan="6" class="k-sec" style="text-align:center;padding:32px">아직 신청된 메뉴가 없어요.</td></tr>';
  }
  async function load() {
    try {
      wishes = (await API.get("/wishes")).items.sort((a, b) => b.likes - a.likes || b.id - a.id);
      draw();
    } catch (e) { AShell.error(e); }
  }
  $("#rows").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    const w = wishes.find((x) => x.id === Number(b.dataset.del));
    if (!confirm(`‘${w.menu_name}’을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
    await UI.busy(b, async () => {
      try { await API.del(`/admin/wishes/${w.id}`); AShell.ok("삭제했어요."); await load(); }
      catch (err) { AShell.error(err); }
    });
  });

  // ---- AI ----
  const ai = $("#ai");
  let picked = [];
  const head = (t) => `<div class="a-panel__head"><h2>${t}</h2></div>`;
  const toPoll = () => picked.length
    ? `<button class="k-btn k-btn--sm" type="button" id="to-poll" style="margin-top:12px">이 후보로 투표 만들기</button>` : "";

  async function run(btn, title, fn) {
    ai.innerHTML = head(title) + '<p class="k-sec" style="margin:0" role="status">AI가 분석하고 있어요… (10~30초)</p>';
    await UI.busy(btn, async () => {
      try { ai.innerHTML = head(title) + (await fn()) + toPoll(); }
      catch (e) {
        ai.innerHTML = head(title) + UI.bannerHTML(AShell.errorText(e), "error") +
          (e.code === "AI_NOT_CONFIGURED" ? '<p class="k-cap">서버 환경변수 ANTHROPIC_API_KEY를 설정해야 AI 기능을 쓸 수 있어요.</p>' : "");
      }
    });
    if (window.matchMedia("(max-width:820px)").matches) ai.scrollIntoView({ behavior: "smooth" });
  }

  $("#ai-cand").onclick = (ev) => run(ev.currentTarget, "AI 투표 후보", async () => {
    const r = await API.post("/admin/ai/poll-candidates");
    picked = r.candidates.map((c) => ({ menu_name: c.name, description: null }));  // 점수 설명은 학생에게 보일 구성 문구가 아니라서 비워 둠
    if (!r.candidates.length) return '<p class="k-sec">분석할 희망 메뉴가 없어요.</p>';
    return `<p class="k-cap">${esc(r.analysis.overall_summary)} · 희망 메뉴 ${r.analysis.analyzed_count}건 분석</p>
      <ol style="padding-left:20px;line-height:1.7">${r.candidates.map((c) => `<li><b>${esc(c.name)}</b> <span class="k-badge">${esc(c.category)}</span><br><span class="k-cap">${esc(c.reason)} · 점수 ${c.score}${c.recently_served ? " · 최근 식단과 겹침" : ""}</span></li>`).join("")}</ol>
      <details><summary class="k-cap">메뉴 묶음 ${r.analysis.groups.length}개</summary><ul style="padding-left:20px">${r.analysis.groups.map((g) => `<li>${esc(g.name)} — 신청 ${g.wish_count} · 좋아요 ${g.total_likes}<br><span class="k-cap">${esc(g.summary)}</span></li>`).join("")}</ul></details>`;
  });

  $("#ai-rec").onclick = (ev) => run(ev.currentTarget, "AI 새 메뉴 추천", async () => {
    const r = await API.post("/admin/ai/poll-recommendations");
    picked = r.recommendations.map((x) => ({ menu_name: x.name, description: x.description }));
    if (!r.recommendations.length) return '<p class="k-sec">추천할 메뉴가 없어요. 희망 메뉴가 더 쌓이면 다시 시도해 주세요.</p>';
    return `<p class="k-cap">알레르기를 등록한 학생 ${r.students_counted}명 기준. 알레르기 성분은 AI 추정이라 확정 전 확인이 필요해요.</p>
      <ol style="padding-left:20px;line-height:1.6">${r.recommendations.map((x) => `<li><b>${esc(x.name)}</b> <span class="k-badge">${esc(x.category)}</span>
        <div class="k-cap">${esc(x.description)}</div>
        <div class="k-cap">먹을 수 있는 학생 ${x.safe_ratio == null ? "—" : Math.round(x.safe_ratio * 100) + "%"} · 근거: ${esc(x.based_on_groups.join(", "))}</div>
        ${UI.allergenBadges(UI.allergenItems(x.estimated_allergens))}</li>`).join("")}</ol>`;
  });

  ai.addEventListener("click", (e) => {
    if (!e.target.closest("#to-poll")) return;
    try { sessionStorage.setItem("gs_poll_prefill", JSON.stringify({ options: picked })); } catch {}
    location.href = "/admin/poll-new";
  });

  await load();
})();
