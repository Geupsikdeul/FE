// /admin/students — 학생 관리 (?tab=accounts|allowed|upload)
// GET /admin/students?grade&class_no&is_active&page&size · PATCH /admin/students/{id}/status {is_active}
// POST /admin/students/{id}/reset-password · GET /admin/allowed-students?grade&class_no&is_used&page&size
// POST /admin/allowed-students (multipart: file, mode=append|replace)
(async () => {
  const { $, $$, esc, fmt } = UI;
  let me = null;
  const SIZE = 20;
  const n = AShell.fmtNum;
  $$("select[data-classes]").forEach((s) => { for (let i = 1; i <= 15; i++) s.insertAdjacentHTML("beforeend", `<option value="${i}">${i}반</option>`); });

  // 탭
  const TABS = ["accounts", "allowed", "upload"];
  let tab = TABS.includes(AShell.q("tab")) ? AShell.q("tab") : "accounts";
  const loaded = {};
  function show(t) {
    tab = t;
    AShell.setQ({ tab: t === "accounts" ? null : t });
    $$("#tabs a").forEach((a) => { const on = a.dataset.tab === t; a.classList.toggle("is-on", on); a.setAttribute("aria-selected", on); });
    TABS.forEach((k) => ($("#t-" + k).hidden = k !== t));
    if (me && !loaded[t]) { loaded[t] = true; if (t === "accounts") loadAccounts(1); if (t === "allowed") loadAllowed(1); }
  }
  $("#tabs").addEventListener("click", (e) => { const a = e.target.closest("a[data-tab]"); if (!a) return; e.preventDefault(); AShell.clear(); show(a.dataset.tab); });

  const params = (f) => Object.fromEntries([...new FormData(f)].filter(([, v]) => v !== ""));

  // 가입 학생
  const af = $("#af");
  let accounts = [], aPage = 1;
  async function loadAccounts(page) {
    aPage = page;
    try {
      const r = await API.get("/admin/students", { ...params(af), role: "student", page, size: SIZE });
      accounts = r.items;
      $("#a-rows").innerHTML = r.items.length ? r.items.map(accountRow).join("")
        : '<tr><td colspan="6" class="k-sec" style="text-align:center;padding:32px">조건에 맞는 가입 학생이 없어요.</td></tr>';
      AShell.pager($("#a-pager"), r, loadAccounts);
    } catch (e) {
      AShell.error(e);
      $("#a-rows").innerHTML = '<tr><td colspan="6" class="k-sec" style="text-align:center;padding:32px">목록을 불러오지 못했어요.</td></tr>';
      $("#a-pager").innerHTML = "";
    }
  }
  function accountRow(s) {
    return `<tr data-id="${s.id}">
      <td class="num" style="text-align:left">${esc(s.student_no)}</td>
      <td class="k-strong">${esc(s.name)}</td>
      <td>${s.grade ?? "–"}학년 ${s.class_no ?? "–"}반</td>
      <td>${s.is_active ? '<span class="k-badge k-badge--soft">활성</span>' : '<span class="k-badge k-badge--danger">비활성</span>'}${s.must_change_password ? ' <span class="k-badge">비밀번호 변경 필요</span>' : ""}</td>
      <td class="k-sec" style="white-space:nowrap">${esc(fmt.kstDate(s.created_at))}</td>
      <td style="white-space:nowrap">
        <button class="k-btn k-btn--tonal k-btn--sm" type="button" data-act="status">${s.is_active ? "비활성화" : "활성화"}</button>
        <button class="k-btn k-btn--plain k-btn--sm" type="button" data-act="reset">임시 비밀번호</button>
      </td></tr>`;
  }
  af.addEventListener("change", () => loadAccounts(1));
  $("#a-rows").addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    const id = Number(btn.closest("tr").dataset.id);
    const s = accounts.find((x) => x.id === id);
    if (!s) return;
    const who = `${s.student_no} ${s.name}`;
    if (btn.dataset.act === "status") {
      const to = !s.is_active;
      if (!confirm(to ? `${who} 학생 계정을 다시 활성화할까요?` : `${who} 학생 계정을 비활성화할까요? 이 학생은 로그인할 수 없게 돼요.`)) return;
      await UI.busy(btn, async () => {
        try {
          const r = await API.patch(`/admin/students/${id}/status`, { is_active: to });
          Object.assign(s, r);
          btn.closest("tr").outerHTML = accountRow(s);
          AShell.ok(`${who} 학생을 ${to ? "활성화" : "비활성화"}했어요.`);
        } catch (e) { AShell.error({ message: AShell.errorText(e) }); }
      });
    } else {
      if (!confirm(`${who} 학생에게 임시 비밀번호를 발급할까요? 지금 비밀번호는 더 이상 쓸 수 없어요.`)) return;
      await UI.busy(btn, async () => {
        try {
          const r = await API.post(`/admin/students/${id}/reset-password`);
          s.must_change_password = !!r.must_change;
          btn.closest("tr").outerHTML = accountRow(s);
          showPassword(s, r);
        } catch (e) { AShell.error({ message: AShell.errorText(e) }); }
      });
    }
  });

  // 임시 비밀번호 결과 모달 — 화면을 닫으면 다시 볼 수 없어요
  const dlg = $("#pw-dlg");
  let lastPw = "";
  function showPassword(s, r) {
    lastPw = r.temporary_password;
    $("#pw-body").innerHTML = `
      <div class="k-sec">${esc(r.student_no)} ${esc(s.name)}</div>
      <div class="a-pw" aria-label="임시 비밀번호">${esc(r.temporary_password)}</div>
      <p class="k-cap" style="margin:0">${r.must_change ? "학생이 이 비밀번호로 로그인하면 바로 새 비밀번호로 바꾸도록 안내돼요." : ""} 이 창을 닫으면 다시 볼 수 없으니 학생에게 직접 전달해 주세요.</p>`;
    $("#pw-copy").textContent = "복사";
    if (dlg.showModal) dlg.showModal(); else alert(`임시 비밀번호: ${lastPw}`);
  }
  $("#pw-copy").onclick = async () => {
    try { await navigator.clipboard.writeText(lastPw); $("#pw-copy").textContent = "복사했어요"; }
    catch { $("#pw-copy").textContent = "직접 적어 주세요"; }
  };
  dlg.addEventListener("close", () => { lastPw = ""; $("#pw-body").innerHTML = ""; });

  // 재학생 명단
  const lf = $("#lf");
  async function loadAllowed(page) {
    try {
      const r = await API.get("/admin/allowed-students", { ...params(lf), page, size: SIZE });
      $("#l-rows").innerHTML = r.items.length ? r.items.map((s) => `<tr>
          <td class="num" style="text-align:left">${esc(s.student_no)}</td><td class="k-strong">${esc(s.name)}</td>
          <td>${s.grade}학년 ${s.class_no}반</td>
          <td>${s.is_used ? '<span class="k-badge k-badge--soft">가입함</span>' : '<span class="k-badge">미가입</span>'}</td></tr>`).join("")
        : '<tr><td colspan="4" class="k-sec" style="text-align:center;padding:32px">조건에 맞는 학생이 없어요. 명단 업로드 탭에서 CSV를 올려 주세요.</td></tr>';
      AShell.pager($("#l-pager"), r, loadAllowed);
    } catch (e) {
      AShell.error(e);
      $("#l-rows").innerHTML = '<tr><td colspan="4" class="k-sec" style="text-align:center;padding:32px">명단을 불러오지 못했어요.</td></tr>';
      $("#l-pager").innerHTML = "";
    }
  }
  lf.addEventListener("change", () => loadAllowed(1));

  // 명단 업로드
  const uf = $("#uf");
  const HELP = {
    append: "기존 명단에 더해요. 이미 있는 학번이나 잘못된 행은 건너뛰고 결과에 알려 줘요.",
    replace: "기존 재학생 명단을 이 파일 내용으로 통째로 바꿔요. 파일에 없는 학번은 새로 가입할 수 없게 돼요.",
  };
  uf.addEventListener("change", (e) => { if (e.target.name === "mode") $("#u-mode-help").textContent = HELP[e.target.value]; });
  $("#u-mode-help").textContent = HELP.append;
  uf.addEventListener("submit", async (e) => {
    e.preventDefault();
    AShell.clear();
    const file = uf.elements.file.files[0];
    const mode = uf.elements.mode.value;
    if (!file) { AShell.error({ message: "CSV 파일을 골라 주세요." }); return; }
    if (mode === "replace" && !confirm("재학생 명단 전체를 이 파일로 바꿀까요? 되돌릴 수 없어요.")) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    await UI.busy(uf.querySelector("button[type=submit]"), async () => {
      try {
        const r = await API.upload("/admin/allowed-students", fd);
        $("#u-result").innerHTML = `
          <section class="a-tiles a-sub" aria-label="업로드 결과">
            <div class="a-tile a-tile--hi"><div class="k-cap" style="color:var(--text)">새로 넣음</div><div class="a-num">${n(r.inserted)}명</div><div style="color:var(--text)">${esc(file.name)} · ${mode === "replace" ? "전체 교체" : "추가"}</div></div>
            <div class="a-tile"><div class="k-cap">건너뜀</div><div class="a-num">${n(r.skipped)}행</div><div class="k-sec">이미 있거나 넣지 않은 행</div></div>
            <div class="a-tile"><div class="k-cap">오류</div><div class="a-num">${n(r.errors.length)}행</div><div class="k-sec">${r.errors.length ? "아래 행을 고쳐 다시 올려 주세요" : "오류가 없어요"}</div></div>
          </section>
          ${r.errors.length ? `<div class="a-tablewrap a-scroll a-sub"><table class="a-table"><thead><tr><th class="num">행</th><th>사유</th></tr></thead><tbody>
            ${r.errors.map((x) => `<tr><td class="num">${x.row}</td><td>${esc(x.reason)}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
        AShell.ok(`명단을 올렸어요. ${n(r.inserted)}명 추가 · ${n(r.skipped)}행 건너뜀 · 오류 ${n(r.errors.length)}행`);
        loaded.allowed = false;
      } catch (err) {
        $("#u-result").innerHTML = "";
        AShell.error({ message: AShell.errorText(err) });
      }
    });
  });

  show(tab); // 탭 모양은 먼저 그리고, 관리자 확인 뒤에 목록을 불러요
  me = await AShell.init("students");
  if (!me) { uf.querySelector("button[type=submit]").disabled = true; return; }
  show(tab);
})();
