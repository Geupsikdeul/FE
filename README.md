# 급식들 프론트엔드

팀 백엔드(`http://192.168.1.44:8000`, FastAPI `/api/v1`)에 연동한 학생 앱(모바일 웹)과 영양사 어드민 웹.
백엔드 코드는 이 저장소에 없음. 실제 API 목록은 `docs/backend-openapi.json`, 연동 표는 `docs/FRONTEND.md`.

## 실행

```bash
cd ~/Developer/Geupsikdeul
.venv/bin/python -m frontend.server                  # http://localhost:3000  (어드민 /admin)
BACKEND_URL=http://다른주소:8000 PORT=3000 .venv/bin/python -m frontend.server
```

`frontend/server.py`가 화면을 주고 `/api/*`를 백엔드로 그대로 넘겨요(프록시). 그래서 백엔드 CORS 설정과 상관없이
휴대폰(같은 와이파이)에서도 `http://<이 컴퓨터 IP>:3000`으로 쓸 수 있어요.

## 화면

| 학생 (`frontend/pages/student`) | 어드민 (`frontend/pages/admin`) |
| --- | --- |
| /login, /signup, /home, /menu, /meals, /vote, /me, /me-password | /admin, /admin/meals, /admin/votes, /admin/poll?id=, /admin/poll-new, /admin/calendar, /admin/students |

공통 코드: `frontend/static/js/api.js`(토큰·재발급·에러), `ui.js`(KST 날짜·탭 바·배너), 화면별 `static/js/pages/s-*.js`, `a-*.js`.

## 추가된 화면 (BE에 API 추가됨)

| 학생 | 어드민 |
| --- | --- |
| /requests 희망 메뉴(좋아요순·최신순, 좋아요, 내 글 삭제, 진행 중 투표 카드), /request-new 신청, /allergy 내 알레르기(19종 + 해당 없음), 식단표·홈에 알레르기 표시 | /admin/wishes 희망 메뉴 + AI 투표 후보·새 메뉴 추천 → 투표 만들기, /admin/plan AI 식단표 추천 → 일정에 반영, 급식 일정에 알레르기 입력 |

탭 바는 디자인대로 홈 · 식단표 · 식사 신청 · 희망 메뉴 · 마이. 투표는 홈 ‘해야 할 일’과 희망 메뉴 위 카드에서 들어가요.
AI 기능은 BE 환경변수 `ANTHROPIC_API_KEY`가 있어야 동작해요(없으면 안내 문구 표시).

아직 없는 기능: 오늘 메뉴 영양·칼로리, 중식, 운영 설정, 이메일 인증·비밀번호 찾기, 정보 수정·탈퇴, 알림 설정.

## 배포 (Vercel)

빌드 없이 `frontend/`를 정적 배포해요. `vercel.json`이 `server.py`와 같은 일을 해요:
`/a` → `pages/student/a.html`, `/admin/a` → `pages/admin/a.html`, `/` → `/home`, `/api/*` → BE 배포 주소로 프록시(CORS 불필요).
로컬 개발은 그대로 `frontend.server`를 쓰면 되고, 로컬 BE에 붙일 땐 `BACKEND_URL=http://localhost:8000`.
