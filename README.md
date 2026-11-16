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

## 백엔드에 없어서 화면이 없는 기능

희망 메뉴·좋아요, 알레르기, 오늘 메뉴 영양·칼로리(비로그인 조회 포함), 중식 식단, AI 후보 추천, 식단표 AI 추천,
운영 설정, 이메일 인증·비밀번호 찾기, 정보 수정·탈퇴, 알림 설정.

이전 Flask 판(자체 서버, 위 기능 포함)은 이 저장소에 포함하지 않았어요.
