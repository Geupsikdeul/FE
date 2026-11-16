// /request-new — 희망 메뉴 신청 (POST /wishes {menu_name, reason}). 작성자는 계정에서 정해지고 "N학년 익명"으로 보여요.
(async function () {
  const { $ } = UI;
  const form = $("#rf"), btn = $("#submit");
  btn.disabled = true;
  const me = await S.boot(null);
  if (!me) return;
  $("#name").value = me.name;
  $("#sid").value = me.student_no;

  const menu = form.menu_name, why = form.reason;
  function check(show) {
    const m = menu.value.trim().length >= 1, w = why.value.trim().length >= 2;
    if (show) {
      menu.classList.toggle("k-input--error", !m); $("#menu-err").hidden = m;
      why.classList.toggle("k-input--error", !w); $("#why-err").hidden = w;
    }
    btn.disabled = !(m && w);
    return m && w;
  }
  form.addEventListener("input", () => check(false));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!check(true)) return;
    await UI.busy(btn, async () => {
      try {
        await API.post("/wishes", { menu_name: menu.value.trim(), reason: why.value.trim() });
        UI.flash("희망 메뉴를 등록했어요.");
        location.href = "/requests";
      } catch (err) { UI.showError($("#flash"), err); }
    });
  });
})();
