// /me-password — PATCH /auth/password {current_password, new_password}. 임시 비밀번호(must_change_password)면 로그인 직후 여기로 와요.
(async function () {
  const { $ } = UI;
  const next = S.safeNext(S.param("next"), "/me");
  const me = await S.boot(null);
  if (!me) return;
  const forced = me.must_change_password;
  if (forced) {
    $("#back").innerHTML = "";
    $("#back").style.minHeight = "8px";
    UI.banner($("#flash"), "임시 비밀번호로 로그인했어요. 계속하려면 새 비밀번호로 바꿔 주세요.", "info");
  }

  const f = { cur: $("#cur"), new: $("#new"), again: $("#again") };
  function err(k, msg) {
    const h = $(`#${k}-err`);
    f[k].classList.toggle("k-input--error", !!msg);
    h.hidden = !msg; h.textContent = msg || "";
    if (msg) f[k].setAttribute("aria-describedby", `${k}-err`); else f[k].removeAttribute("aria-describedby");
  }
  for (const k of Object.keys(f)) f[k].addEventListener("input", () => err(k, ""));

  $("#pwform").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!forced) $("#flash").innerHTML = "";
    const cur = f.cur.value, nw = f.new.value;
    let first = null;
    const bad = (k, m) => { err(k, m); first = first || f[k]; };
    if (!cur) bad("cur", "현재 비밀번호를 입력해 주세요.");
    if (nw.length < 8) bad("new", "8자 이상으로 입력해 주세요.");
    else if (!/[A-Za-z]/.test(nw) || !/[0-9]/.test(nw)) bad("new", "영문과 숫자를 모두 넣어 주세요.");
    else if (cur && nw === cur) bad("new", "현재 비밀번호와 다르게 정해 주세요.");
    else if (nw !== f.again.value) bad("again", "새 비밀번호가 서로 달라요.");
    if (first) { first.focus(); return; }

    UI.busy($("#submit"), async () => {
      try {
        await API.patch("/auth/password", { current_password: cur, new_password: nw });
      } catch (ex) {
        if (ex instanceof API.ApiError && ex.code === "INVALID_CREDENTIALS") { err("cur", "현재 비밀번호가 맞지 않아요."); f.cur.focus(); }
        else if (ex instanceof API.ApiError && ex.code === "WEAK_PASSWORD") { err("new", ex.message || "8자 이상, 영문과 숫자를 모두 넣어 주세요."); f.new.focus(); }
        else if (ex instanceof API.ApiError && ex.code === "VALIDATION_ERROR" && ex.detail && ex.detail.fields) {
          const m = { current_password: "cur", new_password: "new" };
          for (const k of Object.keys(ex.detail.fields)) if (m[k]) err(m[k], ex.message);
        } else UI.showError($("#flash"), ex);
        return;
      }
      try { await API.me(true); } catch {}
      UI.flash("비밀번호를 바꿨어요.");
      location.replace(forced ? S.safeNext(S.param("next"), "/home") : next);
    });
  });
})();
