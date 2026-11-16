// /signup — 학번 확인(GET check-student-no) → 실명·비밀번호 → 개인정보 동의 → POST signup → 바로 로그인.
(function () {
  const { $, esc } = UI;
  const next = S.safeNext(S.param("next"), "/home");
  const flash = $("#flash");
  const sid = $("#sid"), name = $("#name"), pw = $("#pw"), pw2 = $("#pw2"), agree = $("#agree");
  const submit = $("#submit");
  let checked = null; // 확인된 학번 정보 (StudentNoCheck)

  // 도움말/에러 문구: 기본 문구를 기억해 두고 에러가 사라지면 되돌려요.
  const helps = {};
  function setHelp(input, helpId, msg) {
    const h = $("#" + helpId);
    if (!(helpId in helps)) helps[helpId] = { text: h.textContent, hidden: h.hidden };
    input.classList.toggle("k-input--error", !!msg);
    h.classList.toggle("k-help--error", !!msg);
    h.classList.remove("k-help--ok");
    if (msg) { h.textContent = msg; h.hidden = false; }
    else { h.textContent = helps[helpId].text; h.hidden = helps[helpId].hidden; }
  }
  const setOk = (helpId, msg) => { const h = $("#" + helpId); h.textContent = msg; h.hidden = false; h.classList.add("k-help--ok"); h.classList.remove("k-help--error"); };

  function refreshSubmit() {
    submit.disabled = !checked;
    $("#submit-help").textContent = !checked ? "학번 확인을 마쳐야 가입할 수 있어요." : agree.checked ? "" : "개인정보 수집·이용에 동의해야 가입할 수 있어요.";
  }

  function reset() {
    checked = null;
    $("#who").hidden = true; $("#step2").hidden = true;
    refreshSubmit();
  }

  async function check() {
    flash.innerHTML = "";
    const no = sid.value.trim();
    if (!no) { setHelp(sid, "sid-help", "학번을 입력해 주세요."); sid.focus(); return; }
    setHelp(sid, "sid-help", "");
    await UI.busy($("#check"), async () => {
      try {
        const r = await API.get("/auth/check-student-no", { student_no: no }, { auth: false });
        if (!r.available) { reset(); setHelp(sid, "sid-help", "이미 가입된 학번이에요. 로그인해 주세요."); return; }
        checked = r;
        setOk("sid-help", "재학생 명단에서 확인했어요.");
        const who = $("#who");
        who.innerHTML = `<div class="k-banner" style="margin:0">${UI.ICONS.check}<span><b>${esc(r.name)}</b> · ${esc(r.grade)}학년 ${esc(r.class_no)}반<br>본인이 맞다면 아래에 실명과 비밀번호를 입력해 주세요.</span></div>`;
        who.hidden = false; $("#step2").hidden = false;
        refreshSubmit();
        name.focus();
      } catch (e) {
        reset();
        if (e instanceof API.ApiError && ["STUDENT_NOT_ALLOWED", "STUDENT_ALREADY_REGISTERED", "VALIDATION_ERROR"].includes(e.code)) {
          setHelp(sid, "sid-help", e.code === "STUDENT_ALREADY_REGISTERED" ? "이미 가입된 학번이에요. 로그인해 주세요." : e.code === "STUDENT_NOT_ALLOWED" ? "재학생 명단에 없는 학번이에요. 담당 선생님께 확인해 주세요." : e.message);
        } else UI.showError(flash, e);
      }
    });
  }

  $("#check").addEventListener("click", check);
  sid.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
  sid.addEventListener("input", () => { if (checked && sid.value.trim() !== checked.student_no) { reset(); setHelp(sid, "sid-help", ""); } });
  agree.addEventListener("change", () => { setHelp(agree, "agree-help", ""); refreshSubmit(); });
  name.addEventListener("input", () => setHelp(name, "name-help", ""));
  pw.addEventListener("input", () => setHelp(pw, "pw-help", ""));
  pw2.addEventListener("input", () => setHelp(pw2, "pw2-help", ""));

  const pwProblem = (v) => v.length < 8 ? "8자 이상으로 입력해 주세요." : !/[A-Za-z]/.test(v) || !/[0-9]/.test(v) ? "영문과 숫자를 모두 넣어 주세요." : "";

  const FIELD = { student_no: [sid, "sid-help"], name: [name, "name-help"], password: [pw, "pw-help"], privacy_agreed: [agree, "agree-help"] };

  $("#signup").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!checked) return;
    flash.innerHTML = "";
    let first = null;
    const bad = (input, id, msg) => { setHelp(input, id, msg); first = first || input; };
    if (!name.value.trim()) bad(name, "name-help", "실명을 입력해 주세요.");
    const p = pwProblem(pw.value); if (p) bad(pw, "pw-help", p);
    if (!p && pw.value !== pw2.value) bad(pw2, "pw2-help", "비밀번호가 서로 달라요.");
    if (!agree.checked) bad(agree, "agree-help", "개인정보 수집·이용에 동의해야 가입할 수 있어요.");
    if (first) { first.focus(); return; }

    UI.busy(submit, async () => {
      const body = { student_no: checked.student_no, name: name.value.trim(), password: pw.value, privacy_agreed: true };
      try {
        await API.post("/auth/signup", body, { auth: false });
      } catch (ex) {
        if (!(ex instanceof API.ApiError)) return UI.showError(flash, ex);
        const map = { STUDENT_NOT_ALLOWED: "student_no", STUDENT_ALREADY_REGISTERED: "student_no", STUDENT_NAME_MISMATCH: "name", WEAK_PASSWORD: "password", PRIVACY_NOT_AGREED: "privacy_agreed" };
        const msgs = {
          STUDENT_NAME_MISMATCH: "재학생 명단의 이름과 달라요. 띄어쓰기까지 똑같이 적어 주세요.",
          STUDENT_ALREADY_REGISTERED: "이미 가입된 학번이에요. 로그인해 주세요.",
          WEAK_PASSWORD: "8자 이상, 영문과 숫자를 모두 넣어 주세요.",
        };
        const fields = ex.code === "VALIDATION_ERROR" && ex.detail && ex.detail.fields;
        if (fields) {
          for (const [k, v] of Object.entries(fields)) if (FIELD[k]) setHelp(FIELD[k][0], FIELD[k][1], ex.message + (Array.isArray(v) && v[0] ? ` (${v[0]})` : ""));
          UI.showError(flash, ex);
        } else if (map[ex.code]) {
          const [input, id] = FIELD[map[ex.code]];
          setHelp(input, id, msgs[ex.code] || ex.message); input.focus();
        } else UI.showError(flash, ex);
        return;
      }
      // 가입 성공 → 같은 학번·비밀번호로 바로 로그인
      try {
        await API.login(body.student_no, body.password);
        UI.flash("가입했어요. 환영해요!");
        location.replace(next);
      } catch {
        UI.flash("가입했어요. 학번과 비밀번호로 로그인해 주세요.");
        location.replace("/login?next=" + encodeURIComponent(next));
      }
    });
  });

  refreshSubmit();
})();
