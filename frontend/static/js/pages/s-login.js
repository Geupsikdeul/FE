// /login — 학번 + 비밀번호 로그인. ?next= 로 원래 화면 복귀, 관리자는 /admin, 임시 비밀번호면 /me-password.
(function () {
  const { $ } = UI;
  $("#mark").innerHTML = UI.mark(36);
  UI.showFlash($("#flash"));

  const next = S.param("next");
  if (next) $("#signup-link").href = "/signup?next=" + encodeURIComponent(next);

  const form = $("#login"), sid = $("#sid"), pw = $("#pw"), err = $("#login-err"), btn = $("#submit");

  $("#forgot").addEventListener("click", (e) => {
    const box = $("#forgot-help"), open = box.hidden;
    box.hidden = !open; e.currentTarget.setAttribute("aria-expanded", String(open));
  });

  function fieldError(msg) {
    const on = !!msg;
    err.hidden = !on; err.textContent = msg || "";
    for (const i of [sid, pw]) {
      i.classList.toggle("k-input--error", on);
      if (on) i.setAttribute("aria-describedby", "login-err"); else i.removeAttribute("aria-describedby");
    }
  }

  // 로그인 직후 어디로 갈지
  function destination(me) {
    if (me.role === "admin") return next && next.startsWith("/admin") ? S.safeNext(next, "/admin") : "/admin";
    const to = S.safeNext(next, "/home");
    if (me.must_change_password) return "/me-password?next=" + encodeURIComponent(to);
    return to.startsWith("/admin") ? "/home" : to;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    $("#flash").innerHTML = "";
    const no = sid.value.trim();
    if (!no || !pw.value) { fieldError(!no ? "학번을 입력해 주세요." : "비밀번호를 입력해 주세요."); (!no ? sid : pw).focus(); return; }
    fieldError("");
    UI.busy(btn, async () => {
      try {
        await API.login(no, pw.value);
        const me = await API.me(true);
        location.replace(destination(me));
      } catch (ex) {
        if (ex instanceof API.ApiError && ex.code === "INVALID_CREDENTIALS") { fieldError(ex.message); pw.select(); }
        else UI.showError($("#flash"), ex);   // ACCOUNT_DISABLED, TOO_MANY_ATTEMPTS, 서버 연결 실패 등
      }
    });
  });
})();
