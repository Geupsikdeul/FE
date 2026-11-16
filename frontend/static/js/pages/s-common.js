// 학생 앱 공통 — 화면 진입(로그인 확인·탭 바), 급식 일정·신청 불러오기, 에러 코드 한국어.
(function () {
  const { $, esc, fmt } = UI;

  const MEALS = [["breakfast", "조식"], ["dinner", "석식"]];
  const REASON = { weekend: "주말", holiday: "공휴일", exam_period: "시험 기간", no_service: "운영 안 함" };

  // 백엔드 에러 코드 → 화면 문구 (bulk 결과처럼 message 없이 code만 오는 경우에 씀)
  const CODES = {
    SIGNUP_DEADLINE_PASSED: "마감 시간이 지나 바꿀 수 없어요.",
    MEAL_NOT_AVAILABLE: "운영하지 않는 급식이에요.",
    DATE_OUT_OF_RANGE: "아직 선택할 수 없는 날짜예요. 급식일 14일 전부터 선택할 수 있어요.",
    VALIDATION_ERROR: "입력값을 확인해 주세요.",
    INVALID_TOKEN: "로그인이 만료되었어요. 다시 로그인해 주세요.",
    INTERNAL_ERROR: "일시적인 오류가 발생했어요.",
  };
  const codeMsg = (code) => CODES[code] || `저장하지 못했어요. (${code || "알 수 없는 오류"})`;

  // ?next= 는 같은 사이트 경로만 허용 ("//evil.com" 같은 외부 주소 차단)
  // 브라우저가 탭·줄바꿈을 지우고 \ 를 / 로 바꾸므로("/\t/evil.com" → "//evil.com") URL로 풀어서 출처를 확인해요.
  function safeNext(v, fallback = "/home") {
    if (typeof v !== "string" || !v.startsWith("/")) return fallback;
    let u;
    try { u = new URL(v, location.origin); } catch { return fallback; }
    if (u.origin !== location.origin) return fallback;
    const path = u.pathname + u.search + u.hash;
    if (path.startsWith("//") || path.startsWith("/login") || path.startsWith("/signup")) return fallback;
    return path;
  }
  const param = (k) => new URLSearchParams(location.search).get(k);

  // 로그인 필요한 화면 진입. 성공하면 me, 이동 중이거나 실패하면 null.
  async function boot(active) {
    if (active) { const dock = $("#dock"); if (dock) dock.innerHTML = UI.tabbar(active); }
    const flash = $("#flash");
    let me;
    try {
      me = await API.guard("student");
    } catch (e) {
      if (e instanceof API.ApiError && e.code !== "INVALID_TOKEN") UI.showError(flash, e);
      // fetch 자체가 실패(오프라인·프론트 서버 꺼짐)하면 TypeError — 빈 화면 대신 안내
      else if (e instanceof TypeError) UI.banner(flash, "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.", "error");
      return null;
    }
    if (me.must_change_password && location.pathname !== "/me-password") {
      location.replace("/me-password?next=" + encodeURIComponent(location.pathname + location.search));
      return null;
    }
    UI.showFlash(flash);
    return me;
  }

  // from~to(최대 14일) 범위 GET. 범위가 거절(400/422)되면 14일 이하로 나눠 다시 불러 items를 합쳐요.
  async function getRange(path, from, to) {
    try {
      return (await API.get(path, { from, to })).items;
    } catch (e) {
      if (!(e instanceof API.ApiError) || (e.status !== 400 && e.status !== 422) || from === to) throw e;
      const items = [];
      for (let a = from; a <= to; a = fmt.addDays(a, 14)) {
        const b = fmt.addDays(a, 13) < to ? fmt.addDays(a, 13) : to;
        items.push(...(await API.get(path, { from: a, to: b })).items);
      }
      return items;
    }
  }

  // 오늘~14일 후(15일치) 급식 일정 + 내 신청. signups: "YYYY-MM-DD_breakfast" → SignupItem
  async function loadWindow(from, days = 15) {
    const to = fmt.addDays(from, days - 1);
    const [cal, sig] = await Promise.all([getRange("/meal-calendar", from, to), getRange("/meal-signups", from, to)]);
    const signups = new Map(sig.map((s) => [`${s.service_date}_${s.meal_type}`, s]));
    const list = [...new Map(cal.map((d) => [d.service_date, d])).values()]
      .sort((a, b) => (a.service_date < b.service_date ? -1 : 1));
    return { from, to, days: list, signups };
  }

  // 한 끼의 선택 가능 여부와 사유
  function slotState(slot, signup, today = fmt.todayKST(), now = new Date()) {
    if (!slot || !slot.available) return { open: false, kind: "off", label: REASON[slot && slot.reason] || "운영 안 함" };
    if (slot.selectable_from && today < slot.selectable_from)
      return { open: false, kind: "before", label: `${fmt.kdate(slot.selectable_from)}부터 선택할 수 있어요` };
    if ((slot.deadline && now >= new Date(slot.deadline)) || (signup && signup.is_locked))
      return { open: false, kind: "closed", label: slot.deadline ? `마감됨 · ${fmt.kst(slot.deadline)}` : "마감됨" };
    return { open: true, kind: "open", label: slot.deadline ? `${fmt.kst(slot.deadline)} 마감` : "마감 전까지 바꿀 수 있어요" };
  }

  // "미역국, 계란말이, 김치" → ["미역국", "계란말이", "김치"]
  const dishes = (menu) => String(menu || "").split(/\s*(?:,|\n)\s*/).map((x) => x.trim()).filter(Boolean);

  const loading = (msg = "불러오는 중…") => `<div class="k-empty" role="status">${esc(msg)}</div>`;

  window.S = { MEALS, REASON, CODES, codeMsg, safeNext, param, boot, getRange, loadWindow, slotState, dishes, loading };
})();
