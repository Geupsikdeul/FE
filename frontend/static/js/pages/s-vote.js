// /vote — 투표 목록(GET /polls?status=all), /vote?id= — 상세·투표(POST)·변경(PUT), 마감 후 결과(GET result, 공동 순위).
(async function () {
  const { $, esc, fmt } = UI;
  const box = $("#content"), flash = $("#flash");
  const idParam = S.param("id");
  const id = /^\d+$/.test(idParam || "") ? Number(idParam) : null;
  box.innerHTML = S.loading();

  if (id) {
    $("#back").hidden = false;
    $("#header").classList.add("k-large--push");
  }
  if (!(await S.boot(id ? null : "vote"))) { box.innerHTML = ""; return; }

  if (id) await detail(id); else await list();

  // ── 목록 ──
  async function list() {
    $("#lead").textContent = "진행 중인 메뉴 투표에 참여해요. 마감 전에는 메뉴별 득표를 공개하지 않아요.";
    const all = [];
    let page = 1, pages = 1;
    async function load() {
      const r = await API.get("/polls", { status: "all", page, size: 50 });
      all.push(...r.items); pages = r.pages;
    }
    try { await load(); } catch (e) { box.innerHTML = ""; UI.showError(flash, e); return; }

    const row = (p) => {
      let cap, right;
      if (p.status === "open") {
        cap = `${fmt.kst(p.closes_at)} 마감 · ${p.total_votes}명 참여`;
        right = p.has_voted ? '<span class="k-badge k-badge--soft">참여함</span>' : '<span class="k-t k-pt k-strong">투표하기</span>';
      } else if (p.status === "scheduled") {
        cap = `${fmt.kst(p.opens_at)} 시작`;
        right = '<span class="k-badge">예정</span>';
      } else {
        cap = `${fmt.kst(p.closes_at)} 마감 · ${p.total_votes}명 참여`;
        right = '<span class="k-t k-pt k-strong">결과</span>';
      }
      return `<a class="k-row" href="/vote?id=${encodeURIComponent(p.id)}" style="min-height:68px"><div class="k-grow">
        <div class="k-t k-strong">${esc(p.title)}</div><div class="k-cap">${esc(fmt.kdate(p.target_date))} 메뉴 · ${esc(cap)}</div></div>
        ${right}<span class="k-chev"></span></a>`;
    };
    function render() {
      const groups = [["진행 중", "open"], ["예정", "scheduled"], ["끝난 투표", "closed"]]
        .map(([title, st]) => [title, all.filter((p) => p.status === st)]).filter(([, xs]) => xs.length);
      box.innerHTML = groups.length
        ? groups.map(([title, xs], i) => `<h2 class="k-head"${i === 0 ? ' style="margin-top:0"' : ""}>${title}</h2><div class="k-card">${xs.map(row).join("")}</div>`).join("")
        : '<div class="k-card"><div class="k-empty">아직 열린 투표가 없어요.</div></div>';
      if (page < pages) {
        box.insertAdjacentHTML("beforeend", '<div class="k-actions"><button class="k-btn k-btn--tonal k-btn--block" type="button" id="more">더 보기</button></div>');
        $("#more").addEventListener("click", (e) => UI.busy(e.currentTarget, async () => {
          page++;
          try { await load(); render(); } catch (ex) { page--; UI.showError(flash, ex); }
        }));
      }
    }
    render();
  }

  // ── 상세 ──
  async function detail(pid) {
    let p;
    try { p = await API.get(`/polls/${pid}`); }
    catch (e) {
      box.innerHTML = "";
      if (e instanceof API.ApiError && (e.code === "POLL_NOT_FOUND" || e.status === 404)) {
        $("#lead").textContent = "없거나 아직 공개되지 않은 투표예요.";
        box.innerHTML = '<div class="k-actions"><a class="k-btn k-btn--tonal k-btn--block" href="/vote">투표 목록으로</a></div>';
      } else UI.showError(flash, e);
      return;
    }
    document.title = `${p.title} · 급식들`;
    $("#title").textContent = p.title;
    const when = p.status === "scheduled" ? `${fmt.kst(p.opens_at)} 시작` : `${fmt.kst(p.closes_at)} ${p.status === "closed" ? "마감됨" : "마감"}`;
    $("#lead").innerHTML = `${esc(fmt.kdate(p.target_date))} 메뉴 · ${esc(when)}${p.description ? `<br>${esc(p.description)}` : ""}`;

    if (p.status === "closed") return result(p);

    const mine = p.options.find((o) => o.id === p.my_option_id);
    const notes = [];
    if (p.status === "scheduled") notes.push(UI.bannerHTML(`아직 시작 전이에요. ${fmt.kst(p.opens_at)}부터 투표할 수 있어요.`, "info"));
    else if (mine) notes.push(UI.bannerHTML(`<b>${esc(mine.menu_name)}</b>에 투표했어요. 마감 전까지 바꿀 수 있어요.`, "ok", true));
    notes.push(UI.bannerHTML("마감 전에는 메뉴별 득표를 공개하지 않아요. 결과는 마감 후에 볼 수 있어요.", "info"));

    const off = p.status !== "open";
    const img = (u) => /^https?:\/\//i.test(u || "") ? `<img class="s-thumb" src="${esc(u)}" alt="" loading="lazy">` : "";
    box.innerHTML = notes.join("") + `<h2 class="k-head" style="margin-top:0">후보 ${p.options.length}개</h2>
      <form class="k-stack" style="padding:0 16px" id="vote" aria-label="투표 후보" novalidate>
      ${p.options.map((o) => `<label class="k-opt">
        <input class="k-radio" type="radio" name="option" value="${o.id}"${o.id === p.my_option_id ? " checked" : ""}${off ? " disabled" : ""}>
        <span class="k-grow"><span class="k-t k-strong" style="display:block">${esc(o.menu_name)}</span>${o.description ? `<span class="k-cap">${esc(o.description)}</span>` : ""}</span>
        ${o.id === p.my_option_id ? '<span class="k-badge k-badge--primary">내 선택</span>' : ""}${img(o.image_url)}
      </label>`).join("")}</form>`;
    if (off) return;

    const btn = $("#submit"), form = $("#vote");
    $("#savebar").hidden = false;
    const chosen = () => { const c = form.querySelector("input:checked"); return c ? Number(c.value) : null; };
    const sync = () => {
      const c = chosen();
      btn.textContent = p.has_voted ? "투표 바꾸기" : "투표하기";
      btn.disabled = c === null || c === p.my_option_id;
    };
    form.addEventListener("change", sync); sync();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const option_id = chosen();
      if (option_id === null) return;
      flash.innerHTML = "";
      UI.busy(btn, async () => {
        try {
          if (p.has_voted) await API.put(`/polls/${pid}/vote`, { option_id });
          else {
            try { await API.post(`/polls/${pid}/vote`, { option_id }); }
            catch (ex) { if (ex instanceof API.ApiError && ex.code === "VOTE_ALREADY_CAST") await API.put(`/polls/${pid}/vote`, { option_id }); else throw ex; }
          }
          UI.flash(p.has_voted ? "투표를 바꿨어요." : "투표했어요. 마감 전까지 바꿀 수 있어요.");
          location.replace(location.pathname + location.search);
        } catch (ex) {
          UI.showError(flash, ex);
          if (ex instanceof API.ApiError && ex.code === "POLL_NOT_OPEN") { btn.disabled = true; form.querySelectorAll("input").forEach((i) => { i.disabled = true; }); }
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });
  }

  // ── 결과 (마감 후) — 동점이면 공동 순위 ──
  async function result(p) {
    let r;
    try { r = await API.get(`/polls/${p.id}/result`); }
    catch (e) {
      box.innerHTML = "";
      if (e instanceof API.ApiError && e.code === "RESULT_NOT_AVAILABLE") UI.banner(flash, "아직 결과를 볼 수 없어요. 마감 처리가 끝나면 공개돼요.", "info");
      else UI.showError(flash, e);
      return;
    }
    const badge = $("#badge"); badge.textContent = `${r.total_votes}명 참여`; badge.hidden = false;
    const rows = [...r.results].sort((a, b) => b.vote_count - a.vote_count);
    const rankOf = (x) => 1 + rows.filter((y) => y.vote_count > x.vote_count).length;
    const tied = (x) => rows.filter((y) => y.vote_count === x.vote_count).length > 1;
    const top = rows.filter((x) => rankOf(x) === 1 && r.total_votes > 0);

    let head;
    if (!r.total_votes) head = UI.bannerHTML("참여한 학생이 없어 득표가 모두 0이에요.", "info");
    else head = UI.bannerHTML(`투표가 끝났어요. <b>${top.map((x) => esc(x.menu_name)).join(", ")}</b>${top.length > 1 ? " 공동 1위" : " 1위"}예요.`, "ok", true);

    box.innerHTML = head + `<h2 class="k-head" style="margin-top:0">최종 득표율</h2><div class="k-stack" style="padding:0 16px">
      ${rows.map((x) => {
        const rk = r.total_votes ? rankOf(x) : null;
        const pct = fmt.pct(x.percentage || 0);
        const me = x.option_id === p.my_option_id;
        return `<div class="k-opt k-opt--col${me ? " k-opt--sel" : ""}">
          <div class="k-between">
            <span class="k-flex k-grow">${rk ? `<span class="k-rank${rk === 1 ? " k-rank--top" : ""}" aria-label="${tied(x) ? "공동 " : ""}${rk}위">${rk}</span>` : ""}
              <span class="k-t k-strong">${esc(x.menu_name)}</span>
              ${rk && tied(x) ? `<span class="k-badge">공동 ${rk}위</span>` : ""}${me ? '<span class="k-badge k-badge--primary">내 선택</span>' : ""}</span>
            <span class="k-t k-strong" style="white-space:nowrap">${pct}%</span>
          </div>
          <div class="k-bar" role="img" aria-label="${esc(x.menu_name)} ${pct}%, ${x.vote_count}표"><i style="width:${Math.max(0, Math.min(100, x.percentage || 0))}%"></i></div>
          <span class="k-cap">${x.vote_count}표</span>
        </div>`;
      }).join("")}</div>`;
  }
})();
