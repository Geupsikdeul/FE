// /admin/poll-new (새 투표) · /admin/poll-new?id= (수정)
// GET /admin/polls/{id} · POST /admin/polls (PollCreate) · PATCH /admin/polls/{id} (PollUpdate)
// 시각 입력은 한국 시간(datetime-local) → UTC ISO 로 보내요 (UI.fmt.kstInputToUtc).
(async () => {
  const { $, $$, esc, fmt } = UI;
  const form = $("#pf"), F = form.elements;
  const id = AShell.int(AShell.q("id"));
  let poll = null, optionsLocked = false, origOptions = "[]";

  function optRow(o = {}) {
    const div = document.createElement("div");
    div.className = "a-opt";
    div.innerHTML = `
      <span class="k-rank" data-no></span>
      <div class="a-opt__f">
        <input class="k-input a-in" name="menu_name" maxlength="100" placeholder="메뉴 이름 (예: 돈까스)" aria-label="메뉴 이름" value="${esc(o.menu_name || "")}">
        <input class="k-input a-in" name="description" placeholder="구성 (선택, 예: 돈까스, 우동, 단무지)" aria-label="구성" value="${esc(o.description || "")}">
        <input class="k-input a-in" name="image_url" maxlength="500" placeholder="이미지 주소 (선택)" aria-label="이미지 주소" value="${esc(o.image_url || "")}">
      </div>
      <button class="k-btn k-btn--plain k-btn--sm" type="button" data-del>삭제</button>`;
    return div;
  }
  function renumber() {
    const rows = $$("#opts .a-opt");
    rows.forEach((r, i) => {
      r.querySelector("[data-no]").textContent = i + 1;
      r.querySelector("[data-del]").disabled = optionsLocked || rows.length <= 2;
    });
    $("#opt-count").textContent = `${rows.length}개`;
    $("#add-opt").disabled = optionsLocked;
  }
  function addOpt(o) { $("#opts").appendChild(optRow(o)); renumber(); }
  $("#add-opt").onclick = () => { addOpt(); $$("#opts .a-opt").at(-1).querySelector("input").focus(); };
  $("#opts").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b || b.disabled) return;
    if ($$("#opts .a-opt").length <= 2) return;
    b.closest(".a-opt").remove();
    renumber();
  });

  const readOptions = () => $$("#opts .a-opt").map((r) => {
    const v = (n) => r.querySelector(`[name=${n}]`).value.trim();
    return { menu_name: v("menu_name"), description: v("description") || null, image_url: v("image_url") || null };
  }).filter((o) => o.menu_name || o.description || o.image_url);

  // 새 투표 기본값: 내일 08:00 ~ 사흘 뒤 18:00 (한국 시간), 급식 날짜는 1주 뒤
  if (!id) {
    const t = fmt.todayKST();
    F.target_date.value = fmt.addDays(t, 7);
    F.opens_at.value = fmt.addDays(t, 1) + "T08:00";
    F.closes_at.value = fmt.addDays(t, 3) + "T18:00";
    addOpt(); addOpt();
  }

  const me = await AShell.init("votes");
  if (!me) { $$("button[type=submit]").forEach((b) => (b.disabled = true)); return; }

  // 수정 모드
  if (id) {
    $("#h").textContent = "투표 수정";
    $("#back").href = $("#cancel").href = `/admin/poll?id=${id}`;
    $("#back").lastChild.textContent = "투표 현황";
    try {
      poll = await API.get(`/admin/polls/${id}`);
    } catch (e) { AShell.error(e); form.hidden = true; return; }
    document.title = `${poll.title} 수정 · 급식들 어드민`;
    $("#hp").innerHTML = `${AShell.pollBadge(poll)} ${poll.is_published ? "공개된 투표예요." : "비공개 투표예요."} 바꾼 내용은 저장하면 바로 반영돼요.`;
    F.title.value = poll.title;
    F.description.value = poll.description || "";
    F.target_date.value = poll.target_date;
    F.opens_at.value = fmt.utcToKstInput(poll.opens_at);
    F.closes_at.value = fmt.utcToKstInput(poll.closes_at);
    // 투표가 시작된 뒤(진행 중·마감)에는 선택지를 바꿀 수 없어요
    optionsLocked = poll.status !== "scheduled";
    poll.options.forEach((o) => addOpt(o));
    origOptions = JSON.stringify(readOptions());
    if (optionsLocked) {
      $("#opt-lock").innerHTML = `<div class="a-msg">${UI.bannerHTML(poll.status === "closed" ? "마감된 투표라 선택지를 바꿀 수 없어요." : "투표가 시작된 뒤에는 선택지를 바꿀 수 없어요. 제목·설명·기간은 고칠 수 있어요.", "info")}</div>`;
      $$("#opts input").forEach((i) => (i.disabled = true));
    }
    if (poll.status === "closed") AShell.info("마감된 투표예요. 수정이 거절될 수 있어요.");
    renumber();
  }

  function mark(el, msgEl, text) {
    if (el) el.classList.add("k-input--error");
    if (msgEl) { msgEl.textContent = text || (msgEl.id === "period-msg" ? "마감은 시작보다 뒤여야 해요." : ""); msgEl.classList.toggle("k-help--error", !!text); }
  }
  function clearMarks() {
    $$(".k-input--error", form).forEach((x) => x.classList.remove("k-input--error"));
    mark(null, $("#period-msg"), ""); mark(null, $("#opt-msg"), "");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMarks(); AShell.clear();
    const title = F.title.value.trim();
    const errs = [];
    if (!title) { mark(F.title); errs.push("제목을 입력해 주세요."); }
    if (!AShell.isDate(F.target_date.value)) { mark(F.target_date); errs.push("급식 날짜를 골라 주세요."); }
    if (!F.opens_at.value) { mark(F.opens_at); errs.push("투표 시작 시각을 넣어 주세요."); }
    if (!F.closes_at.value) { mark(F.closes_at); errs.push("투표 마감 시각을 넣어 주세요."); }
    let opens_at, closes_at;
    if (F.opens_at.value && F.closes_at.value) {
      opens_at = fmt.kstInputToUtc(F.opens_at.value);
      closes_at = fmt.kstInputToUtc(F.closes_at.value);
      if (new Date(closes_at) <= new Date(opens_at)) { mark(F.closes_at, $("#period-msg"), "마감은 시작보다 뒤여야 해요."); errs.push("투표 기간을 확인해 주세요."); }
    }
    const options = readOptions();
    const optsChanged = JSON.stringify(options) !== origOptions;
    if (!optionsLocked) {
      $$("#opts .a-opt").forEach((r) => {
        const nm = r.querySelector("[name=menu_name]");
        const any = [...r.querySelectorAll("input")].some((i) => i.value.trim());
        if (any && !nm.value.trim()) mark(nm);
      });
      if (options.some((o) => !o.menu_name)) errs.push("메뉴 이름이 빈 선택지가 있어요.");
      if (options.filter((o) => o.menu_name).length < 2) { mark(null, $("#opt-msg"), "선택지는 2개 이상이어야 해요."); errs.push("선택지를 2개 이상 넣어 주세요."); }
    }
    if (errs.length) { AShell.error({ message: errs.join(" ") }); return; }

    const body = { title, description: F.description.value.trim() || null, target_date: F.target_date.value, opens_at, closes_at };
    if (!id) body.options = options;
    else if (!optionsLocked && optsChanged) body.options = options;

    const btns = $$('button[type=submit]');
    btns.forEach((b) => (b.disabled = true));
    try {
      const saved = id ? await API.patch(`/admin/polls/${id}`, body) : await API.post("/admin/polls", body);
      UI.flash(id ? "투표를 수정했어요." : "투표를 만들었어요. 아직 비공개예요. ‘공개하기’를 누르면 학생에게 보여요.");
      location.href = `/admin/poll?id=${saved.id}`;
    } catch (err) {
      if (err.code === "INVALID_PERIOD") { mark(F.closes_at, $("#period-msg"), err.message || "투표 기간이 올바르지 않아요."); mark(F.opens_at); }
      if (err.code === "TOO_FEW_OPTIONS") mark(null, $("#opt-msg"), err.message || "선택지는 2개 이상이어야 해요.");
      const f = err.detail && err.detail.fields;
      if (f) for (const k of Object.keys(f)) { const el = form.elements[k.split(".").pop()]; if (el && el.classList) mark(el); }
      AShell.error({ message: AShell.errorText(err) });
    } finally {
      btns.forEach((b) => (b.disabled = false));
    }
  });
})();
