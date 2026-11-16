// /me — 내 정보(GET /auth/me), 비밀번호 변경 링크, 로그아웃.
(async function () {
  const { $, esc } = UI;
  const box = $("#account");
  box.innerHTML = S.loading();
  if (!(await S.boot("me"))) { box.innerHTML = ""; return; }
  let me;
  try { me = await API.me(true); } catch (e) { box.innerHTML = ""; UI.showError($("#flash"), e); return; }
  const cls = me.grade != null && me.class_no != null ? `${me.grade}학년 ${me.class_no}반` : me.grade != null ? `${me.grade}학년` : "—";
  box.innerHTML = `
    <div class="k-row"><span class="k-kvl">이름</span><span class="k-t k-strong">${esc(me.name)}</span></div>
    <div class="k-row"><span class="k-kvl">학번</span><span class="k-t k-strong">${esc(me.student_no)}</span></div>
    <div class="k-row"><span class="k-kvl">학년·반</span><span class="k-t k-strong">${esc(cls)}</span></div>`;
  $("#logout").addEventListener("click", () => API.logout());
  API.get("/auth/me/allergies").then((r) => {
    const names = UI.allergenItems(r.allergies).map((a) => a.name);
    $("#allergy-sum").textContent = !r.registered ? "미등록" : names.length ? names.join(", ") : "해당 없음";
  }).catch(() => {});
})();
