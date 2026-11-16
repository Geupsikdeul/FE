# 프론트 연동 가이드

백엔드는 팀이 배포한 것: `http://192.168.1.44:8000` (FastAPI, `/api/v1`). **백엔드 코드는 만들지도 고치지도 않는다.**
실제 엔드포인트·필드 = `docs/backend-openapi.json` (배포 서버의 /openapi.json 사본). 명세 원문 `docs/API_SPEC.md`, 기능명세 `docs/FEATURE_SPEC.md`.

## 구조
- `frontend/server.py` — FastAPI 정적 서버 + `/api/*`를 백엔드로 그대로 전달하는 프록시 (CORS 회피). 실행: `.venv/bin/python -m frontend.server` (PORT, BACKEND_URL 환경 변수)
- 화면: `/a/b` → `frontend/pages/student/a-b.html`, `/admin/a/b` → `frontend/pages/admin/a-b.html`, `/admin` → `admin/dashboard.html`. id는 쿼리스트링.
- 공통: `frontend/static/js/api.js` (API 클라이언트: 토큰, refresh, 에러 → `ApiError{status, code, message, detail}`, `API.login(student_no, pw)`, `API.me()`, `API.guard("student"|"admin")`, `API.download`), `frontend/static/js/ui.js` (KST 날짜 포맷, 배너, 탭 바, 아이콘), CSS `frontend/static/css/{app,admin,web}.css` (디자인 그대로).
- 디자인 원본 `design/*.dc.html`, 이전 Flask 판 마크업 `_legacy_flask/geupsik/templates/**` (재사용하면 빠름).

## 백엔드에 있는 것 → 연동할 화면
| 영역 | 엔드포인트 | 화면 |
| --- | --- | --- |
| 인증 | check-student-no, signup, login(**학번**+비번), refresh, me, PATCH password | /login, /signup(학번 확인→이름 확인→비번→개인정보 동의), /me, /me-password (must_change_password면 로그인 직후 여기로) |
| 일정·신청 | GET meal-calendar(from,to ≤14일; 조식·석식 `{available, reason, selectable_from, deadline, menu}`), GET/PUT meal-signups, PUT meal-signups/bulk | /home(오늘 조식·석식 메뉴·내 신청 상태, 해야 할 일), /menu(날짜별 조식·석식 메뉴 문자열), /meals(오늘~14일 후 한 목록, 식사/결식, 선택 시작 전·마감·미운영 비활성, 미응답 = 식사로 집계 안내, bulk 저장 후 항목별 결과 표시) |
| 투표 | GET polls(status), GET polls/{id}, POST/PUT vote, GET result(마감 후만) | /vote(목록·상세·투표·변경, 마감 전 득표 비공개 안내, 마감 후 결과 — 동점이면 공동 순위) |
| 관리자 학생 | allowed-students(POST CSV multipart `file`,`mode` / GET), students(GET, PATCH status, POST reset-password) | /admin/students |
| 관리자 투표 | admin/polls(GET 목록, POST, GET, PATCH, DELETE, publish, close, stats, non-voters) | /admin/votes, /admin/poll?id=, /admin/poll-new(?id=) |
| 관리자 집계 | admin/meal-signups/summary(date, meal_type?), export(date, meal_type, format csv|xlsx) | /admin (대시보드: 선택 날짜 + 앞뒤 8일 summary 호출로 막대그래프), /admin/meals(희망 여부: 식사·결식·미응답 별도, 예상 = 식사+미응답, 합계 = 대상 수 표시, 학년별, 내보내기) |
| 관리자 일정 | admin/meal-calendar(GET, POST upsert, PATCH {date}) — 운영 여부·사유·마감·메뉴 문자열 | /admin/calendar (식단 입력도 여기서: 조식·석식 메뉴 문자열) |

## BE에 새로 추가된 것 → 연동한 화면
| 영역 | 엔드포인트 | 화면 |
| --- | --- | --- |
| 희망 메뉴 | GET/POST /wishes, POST /wishes/{id}/like(토글), DELETE /wishes/{id}(본인), DELETE /admin/wishes/{id} | /requests, /request-new, /admin/wishes |
| 알레르기 | GET/PUT /auth/me/allergies `{allergies: ["달걀", …], registered}` — 이름 문자열 19종(1번은 "달걀"=난류, `UI.ALLERGEN_KEY`) | /allergy, /me 요약, /menu·/home 경고 |
| 식단 알레르기 | meal-calendar 끼니마다 `allergens`, admin/meal-calendar `breakfast_allergens`/`dinner_allergens` | /menu, /admin/calendar |
| AI (관리자) | POST /admin/ai/poll-candidates, /poll-recommendations, /menu-draft, GET /admin/ai/menu-catalog | /admin/wishes, /admin/plan |

## 아직 없는 것 → 화면을 만들지 않음 (가짜 데이터·임시 백엔드 금지)
오늘 메뉴 영양·칼로리, 중식 식단, 운영 설정, 이메일 인증·비밀번호 찾기(이메일), 정보 수정·탈퇴, 알림 설정.
- 탭 바: 홈 · 식단표 · 식사 신청 · **희망 메뉴** · 마이 (디자인대로). 투표는 홈 ‘해야 할 일’과 희망 메뉴 상단 카드에서 진입.
- 로그인 화면 "비밀번호 찾기"는 "담당 선생님께 임시 비밀번호를 받으세요" 안내로.

## 규칙
- 배포된 백엔드는 팀 공용 데이터다. **상태를 바꾸는 요청(POST/PUT/PATCH/DELETE) 금지** — 단, 틀린 비밀번호 로그인처럼 아무것도 바뀌지 않는 요청은 허용. 계정이 없으므로 로그인 후 화면은 OpenAPI 스키마와 대조해 검증.
- 서버 데이터는 `UI.esc`로 이스케이프. 에러는 `UI.showError`. datetime은 UTC ISO → 화면은 KST(`UI.fmt.kst`), date는 KST 날짜 그대로.
- 모든 JS는 `node --check` 통과. 공개 화면(/login, /signup)은 헤드리스 Chrome 스크린샷으로 확인.
