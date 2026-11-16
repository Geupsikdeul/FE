// 급식들 API 클라이언트 — 모든 화면은 이 파일로 /api/v1 을 호출해요.
// 토큰: localStorage (access 30분, refresh 14일). 401이면 refresh 한 번 시도 후 로그인 화면으로.
(function () {
  const BASE = "/api/v1";
  const store = {
    get access() { try { return localStorage.getItem("gs_access"); } catch { return null; } },
    get refresh() { try { return localStorage.getItem("gs_refresh"); } catch { return null; } },
    set(t) { try { localStorage.setItem("gs_access", t.access_token); localStorage.setItem("gs_refresh", t.refresh_token); } catch {} },
    clear() { try { localStorage.removeItem("gs_access"); localStorage.removeItem("gs_refresh"); sessionStorage.removeItem("gs_me"); } catch {} },
  };

  class ApiError extends Error {
    constructor(status, body) {
      const e = (body && body.error) || {};
      super(e.message || "일시적인 오류가 발생했습니다.");
      this.status = status; this.code = e.code || "INTERNAL_ERROR"; this.detail = e.detail || null;
    }
  }

  function qs(query) {
    if (!query) return "";
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") p.append(k, v);
    const s = p.toString();
    return s ? "?" + s : "";
  }

  let refreshing = null;
  async function refresh() {
    if (!store.refresh) return false;
    refreshing = refreshing || fetch(BASE + "/auth/refresh", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: store.refresh }),
    }).then(async (r) => { if (!r.ok) return false; store.set(await r.json()); return true; })
      .catch(() => false).finally(() => setTimeout(() => (refreshing = null), 0));
    return refreshing;
  }

  function toLogin() {
    store.clear();
    const next = location.pathname + location.search;
    if (!location.pathname.startsWith("/login")) location.href = "/login?next=" + encodeURIComponent(next);
  }

  // opts: {body, query, form (FormData), auth: true|false|"optional", raw: true(Response 반환)}
  async function request(method, path, opts = {}) {
    const auth = opts.auth === undefined ? true : opts.auth;
    const headers = {};
    let body;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.body); }
    const go = () => {
      const h = { ...headers };
      if (auth && store.access) h["Authorization"] = "Bearer " + store.access;
      return fetch(BASE + path + qs(opts.query), { method, headers: h, body });
    };
    let res = await go();
    let data;
    if (res.status === 401 && auth && store.refresh && path !== "/auth/login") {
      // 토큰 만료(INVALID_TOKEN)일 때만 재발급 후 재시도. 비밀번호 틀림(INVALID_CREDENTIALS) 등은 다시 보내지 않아요.
      data = await res.json().catch(() => null);
      if (((data && data.error) || {}).code === "INVALID_TOKEN" && await refresh()) { res = await go(); data = undefined; }
    }
    if (opts.raw && res.ok) return res;
    if (res.status === 204) return null;
    if (data === undefined) data = await res.json().catch(() => null);
    // FastAPI 기본 422 형식 {detail:[{loc,msg}]}도 명세 에러 형식으로 바꿔 읽어요.
    if (data && !data.error && Array.isArray(data.detail)) {
      const fields = {};
      for (const e of data.detail) fields[(e.loc || []).filter((x) => !["body", "query", "path"].includes(x)).join(".") || "_"] = e.msg;
      data = { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요.", detail: { fields } } };
    }
    if (!res.ok) {
      const err = new ApiError(res.status, data);
      if (res.status === 401 && auth === true && err.code === "INVALID_TOKEN") toLogin();
      throw err;
    }
    return data;
  }

  const API = {
    ApiError, store,
    get: (p, query, o = {}) => request("GET", p, { ...o, query }),
    post: (p, body, o = {}) => request("POST", p, { ...o, body }),
    put: (p, body, o = {}) => request("PUT", p, { ...o, body }),
    patch: (p, body, o = {}) => request("PATCH", p, { ...o, body }),
    del: (p, body, o = {}) => request("DELETE", p, { ...o, body }),
    upload: (p, form) => request("POST", p, { form }),
    request,
    isLoggedIn: () => !!store.access,

    // 백엔드 로그인은 학번 + 비밀번호 (POST /auth/login {student_no, password})
    async login(student_no, password) {
      const t = await request("POST", "/auth/login", { body: { student_no, password }, auth: false });
      store.set(t);
      sessionStorage.removeItem("gs_me");
      return t;
    },
    logout() { store.clear(); location.href = "/login"; },

    // 내 정보 (세션 캐시). force=true면 새로 받아요.
    async me(force) {
      if (!force) { try { const c = sessionStorage.getItem("gs_me"); if (c) return JSON.parse(c); } catch {} }
      const me = await request("GET", "/auth/me");
      try { sessionStorage.setItem("gs_me", JSON.stringify(me)); } catch {}
      return me;
    },

    // 화면 진입 시 호출: 로그인 필요 + 역할 확인. role: "student" | "admin"
    async guard(role) {
      if (!store.access && !store.refresh) { toLogin(); throw new Error("login required"); }
      const me = await API.me();
      if (role === "admin" && me.role !== "admin") { location.href = "/home"; throw new Error("forbidden"); }
      if (role === "student" && me.role === "admin") { location.href = "/admin"; throw new Error("admin"); }
      return me;
    },

    // 파일 다운로드 (CSV/XLSX) — 인증 헤더가 필요해서 fetch로 받아 저장해요.
    async download(path, query, fallbackName) {
      const res = await request("GET", path, { query, raw: true });
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      const name = m ? decodeURIComponent(m[1]) : fallbackName;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
  };
  window.API = API;
})();
