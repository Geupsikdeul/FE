# 학교 급식 서비스 API 명세서 (원문)

**Version** 0.1.0 · **Base URL** `https://api.example.com/api/v1` · **인증 방식** Bearer Token (JWT)

## 1. 공통 규약

### 1.1 요청 헤더
| 헤더 | 필수 | 설명 |
| --- | --- | --- |
| `Content-Type` | 조건부 | 요청 본문이 있을 때 `application/json` |
| `Authorization` | 조건부 | 인증 필요 시 `Bearer {access_token}` |

### 1.2 시간대 규칙
- 모든 `datetime` 값은 **UTC ISO 8601** 형식으로 주고받습니다. 예: `2026-09-10T05:30:00Z`
- 모든 `date` 값은 **KST 기준 날짜**입니다. 예: `2026-09-11`
- 마감 시간 검증은 서버에서 KST(`Asia/Seoul`) 기준으로 수행합니다.
> `service_date`는 "급식이 제공되는 날짜"이며 시간 정보를 갖지 않습니다.

### 1.3 성공 응답
성공 시 데이터 객체를 그대로 반환합니다. 별도 래퍼(`{"data": ...}`)를 두지 않습니다.
| 상태 코드 | 사용 시점 |
| --- | --- |
| `200 OK` | 조회, 수정 성공 |
| `201 Created` | 리소스 생성 성공 |
| `204 No Content` | 삭제 성공 |

### 1.4 에러 응답
```json
{ "error": { "code": "VOTE_ALREADY_CAST", "message": "이미 투표에 참여했습니다.", "detail": null } }
```
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `code` | string | 클라이언트 분기용 고정 문자열 |
| `message` | string | 사용자에게 노출 가능한 한국어 메시지 |
| `detail` | object \| null | 검증 실패 시 필드별 상세 |

### 1.5 페이지네이션
요청: `page`(int, 기본 1, 1부터), `size`(int, 기본 20, 최대 100)
```json
{ "items": [], "total": 137, "page": 1, "size": 20, "pages": 7 }
```

## 2. 인증 (Auth)

### 2.1 학번 확인 — `GET /auth/check-student-no`
회원가입 화면에서 학번 입력 직후 호출. Query: `student_no`(string, 필수, 5자리)
**200**
```json
{ "student_no": "10312", "name": "김*수", "grade": 1, "class_no": 3, "available": true }
```
> `name`은 개인정보 보호를 위해 가운데 글자를 마스킹해 반환합니다.

에러: `STUDENT_NOT_ALLOWED` 404 재학생 명단에 없는 학번 · `STUDENT_ALREADY_REGISTERED` 409 이미 가입 완료

### 2.2 회원가입 — `POST /auth/signup`
```json
{ "student_no": "10312", "name": "김철수", "password": "Secure1234!", "privacy_agreed": true }
```
| 필드 | 제약 |
| --- | --- |
| `student_no` | 화이트리스트에 존재해야 함 |
| `name` | 화이트리스트의 이름과 **정확히 일치** |
| `password` | 8자 이상, 영문+숫자 포함 |
| `privacy_agreed` | `true`가 아니면 거부 |
> 학년·반은 화이트리스트에서 자동으로 채워집니다. 클라이언트가 보내는 값은 무시합니다.

**201**
```json
{ "id": 42, "student_no": "10312", "name": "김철수", "grade": 1, "class_no": 3, "role": "student", "created_at": "2026-09-10T05:30:00Z" }
```
에러: `STUDENT_NOT_ALLOWED` 404 · `STUDENT_NAME_MISMATCH` 400 · `STUDENT_ALREADY_REGISTERED` 409 · `WEAK_PASSWORD` 422 · `PRIVACY_NOT_AGREED` 400

### 2.3 로그인 — `POST /auth/login`
```json
{ "student_no": "10312", "password": "Secure1234!" }
```
**200**
```json
{ "access_token": "eyJ...", "refresh_token": "eyJ...", "token_type": "bearer", "expires_in": 1800 }
```
Access 30분, Refresh 14일.
에러: `INVALID_CREDENTIALS` 401 · `ACCOUNT_DISABLED` 403 (졸업·전학 등) · `TOO_MANY_ATTEMPTS` 429 (5회 연속 실패, 10분 잠금)
> 학번이 없는 경우와 비밀번호가 틀린 경우 모두 `INVALID_CREDENTIALS`.

### 2.4 토큰 재발급 — `POST /auth/refresh`
`{ "refresh_token": "..." }` → 200 로그인과 동일. 에러: `INVALID_TOKEN` 401

### 2.5 내 정보 조회 — `GET /auth/me` 🔒
```json
{ "id": 42, "student_no": "10312", "name": "김철수", "grade": 1, "class_no": 3, "role": "student" }
```

### 2.6 비밀번호 변경 — `PATCH /auth/password` 🔒
`{ "current_password": "...", "new_password": "..." }` → **204**. 에러: `INVALID_CREDENTIALS` 401 · `WEAK_PASSWORD` 422

## 3. 급식 메뉴 투표 (Polls)

### 3.1 투표 목록 — `GET /polls` 🔒
Query: `status` = `open`(기본) | `closed` | `all`, `page`, `size`
```json
{ "items": [ { "id": 7, "title": "10월 3주차 중식 메뉴 투표", "target_date": "2026-10-16",
  "opens_at": "2026-10-08T00:00:00Z", "closes_at": "2026-10-13T05:00:00Z", "status": "open",
  "has_voted": false, "total_votes": 218 } ], "total": 1, "page": 1, "size": 20, "pages": 1 }
```
`status`: `scheduled`(시작 전) | `open` | `closed`. `total_votes`: 총 참여 인원. 선택지별 득표는 마감 전 비공개.

### 3.2 투표 상세 — `GET /polls/{poll_id}` 🔒
```json
{ "id": 7, "title": "...", "description": "가장 먹고 싶은 메뉴 하나를 골라주세요.", "target_date": "2026-10-16",
  "opens_at": "...", "closes_at": "...", "status": "open", "has_voted": false, "my_option_id": null,
  "options": [ { "id": 21, "menu_name": "돈까스", "description": "돈까스, 우동, 단무지, 흰쌀밥", "image_url": "https://..." } ] }
```
> 마감 전에는 선택지별 `vote_count`를 포함하지 않습니다.
에러: `POLL_NOT_FOUND` 404 (없거나 미공개)

### 3.3 투표하기 — `POST /polls/{poll_id}/vote` 🔒
`{ "option_id": 21 }` → **201** `{ "poll_id": 7, "option_id": 21, "voted_at": "2026-09-10T06:12:00Z" }`
에러: `POLL_NOT_FOUND` 404 · `POLL_NOT_OPEN` 403 · `INVALID_OPTION` 400 · `VOTE_ALREADY_CAST` 409
> 중복 투표는 `UNIQUE(poll_id, student_id)`로 막고 `IntegrityError`를 409로 변환. 조회 후 삽입은 동시 요청에서 뚫림.

### 3.4 투표 변경 — `PUT /polls/{poll_id}/vote` 🔒
마감 전까지 선택지를 바꿀 수 있음. `{ "option_id": 22 }` → **200** 3.3과 동일. 에러 3.3과 동일 (`VOTE_ALREADY_CAST` 없음)

### 3.5 투표 결과 — `GET /polls/{poll_id}/result` 🔒
```json
{ "poll_id": 7, "title": "...", "target_date": "2026-10-16", "closed_at": "2026-10-13T05:00:00Z", "total_votes": 412,
  "results": [ { "option_id": 21, "menu_name": "돈까스", "vote_count": 245, "percentage": 59.5, "is_winner": true } ] }
```
에러: `POLL_NOT_FOUND` 404 · `RESULT_NOT_AVAILABLE` 403 (아직 마감 안 됨)
> 집계는 `GROUP BY option_id` 단일 쿼리 (N+1 금지).

## 4. 조식·석식 신청 (Meal Signups)

### 4.1 급식 일정 — `GET /meal-calendar` 🔒
학생은 급식 제공일 14일 전부터 조식·석식별로 식사/결식 선택, 마감 전까지 변경 가능. KST 현재 날짜 ≥ `selectable_from`(= service_date − 14일) 그리고 `deadline` 이전일 때만 등록·변경. 미응답은 식사 희망으로 집계.
Query: `from`(date, 필수), `to`(date, 필수, from부터 최대 14일)
```json
{ "items": [
  { "service_date": "2026-09-14",
    "breakfast": { "available": true, "selectable_from": "2026-08-31", "deadline": "2026-09-13T09:00:00Z", "menu": "미역국, 계란말이, 김치, 흰쌀밥" },
    "dinner":    { "available": true, "selectable_from": "2026-08-31", "deadline": "2026-09-14T03:00:00Z", "menu": "치킨마요덮밥, 유부장국, 단무지" } },
  { "service_date": "2026-09-19",
    "breakfast": { "available": false, "reason": "weekend", "deadline": null, "menu": null },
    "dinner":    { "available": false, "reason": "weekend", "deadline": null, "menu": null } } ] }
```
`reason`: `weekend` | `holiday` | `exam_period` | `no_service`

### 4.2 내 신청 현황 — `GET /meal-signups` 🔒
Query: `from`, `to` (최대 14일)
```json
{ "items": [ { "service_date": "2026-09-14", "meal_type": "breakfast", "will_attend": true, "is_locked": false, "updated_at": "2026-09-12T11:20:00Z" } ] }
```
> 응답하지 않은 항목은 `items`에 없음 → 클라이언트는 미응답으로 처리.

### 4.3 신청 등록·변경 — `PUT /meal-signups` 🔒 (upsert)
`{ "service_date": "2026-09-14", "meal_type": "breakfast", "will_attend": true }` → **200** `{ service_date, meal_type, will_attend, is_locked, updated_at }`
에러: `SIGNUP_DEADLINE_PASSED` 403 · `MEAL_NOT_AVAILABLE` 400 · `DATE_OUT_OF_RANGE` 400 (14일 전이 아님)
> 선택 시작일·마감 검증은 서버에서 KST로. `UNIQUE(student_id, service_date, meal_type)` + ON CONFLICT DO UPDATE / merge.

### 4.4 일괄 등록 — `PUT /meal-signups/bulk` 🔒
`{ "signups": [ { "service_date", "meal_type", "will_attend" }, ... ] }` → **200**
```json
{ "succeeded": 2, "failed": 1, "results": [
  { "service_date": "2026-09-14", "meal_type": "breakfast", "status": "ok" },
  { "service_date": "2026-09-15", "meal_type": "breakfast", "status": "error", "code": "SIGNUP_DEADLINE_PASSED" } ] }
```
부분 성공 허용.

## 5. 관리자 (Admin) — 모든 `/admin/*`는 `role == "admin"` (라우터 레벨 일괄 적용)

### 5.1 재학생 명단 등록 — `POST /admin/allowed-students` (multipart)
`file`: CSV 헤더 `student_no,name,grade,class_no` · `mode`: `append` | `replace`
**200** `{ "inserted": 412, "skipped": 3, "errors": [ { "row": 15, "reason": "학번 형식 오류: '1O312'" } ] }`

### 5.2 재학생 명단 조회 — `GET /admin/allowed-students`
Query: `grade`, `class_no`, `is_used`(bool), `page`, `size`

### 5.3 학생 계정 관리
| `GET /admin/students` | 가입 학생 목록 (학년·반 필터) |
| `PATCH /admin/students/{id}/status` | 활성/비활성 전환 |
| `POST /admin/students/{id}/reset-password` | 임시 비밀번호 발급 → `{ "student_no": "10312", "temporary_password": "Xk7m2Qp9", "must_change": true }` |

### 5.4 투표 관리
`POST /admin/polls`
```json
{ "title": "...", "description": "...", "target_date": "2026-10-16", "opens_at": "2026-10-08T00:00:00Z", "closes_at": "2026-10-13T05:00:00Z",
  "options": [ { "menu_name": "돈까스", "description": "돈까스, 우동, 단무지, 흰쌀밥" } ] }
```
**201** 생성된 투표 객체 (`is_published: false`). 에러: `INVALID_PERIOD` 400 · `TOO_FEW_OPTIONS` 400
| `PATCH /admin/polls/{id}` | 수정. 투표 시작 후에는 선택지 변경 불가 |
| `POST /admin/polls/{id}/publish` | 공개 전환 |
| `POST /admin/polls/{id}/close` | 즉시 마감 |
| `DELETE /admin/polls/{id}` | 삭제. 투표 기록이 있으면 `409 POLL_HAS_VOTES` |

### 5.5 투표 통계 — `GET /admin/polls/{poll_id}/stats`
```json
{ "poll_id": 7, "total_votes": 412, "eligible_students": 480, "participation_rate": 85.8,
  "by_option": [ { "option_id": 21, "menu_name": "돈까스", "vote_count": 245 } ],
  "by_grade": [ { "grade": 1, "voted": 142, "eligible": 160, "rate": 88.8 } ] }
```
> 관리자도 개별 학생의 선택을 조회할 수 없음. `(학생, 선택지)` 쌍을 반환하는 API 금지. 참여 여부만 조회 가능.

### 5.6 미참여자 — `GET /admin/polls/{poll_id}/non-voters`
`{ "items": [ { "student_no": "10315", "name": "이영희", "grade": 1, "class_no": 3 } ], "total": 68 }`

### 5.7 조식·석식 집계 — `GET /admin/meal-signups/summary`
Query: `date`(필수), `meal_type`(생략 시 둘 다)
```json
{ "service_date": "2026-09-14",
  "breakfast": { "attending": 87, "not_attending": 302, "no_response": 91, "is_finalized": true, "finalized_at": "2026-09-13T09:00:00Z",
                 "by_grade": [ { "grade": 1, "attending": 31 } ] },
  "dinner": { "attending": 214, "not_attending": 178, "no_response": 88, "is_finalized": false, "finalized_at": null, "by_grade": [] } }
```
> 스냅샷: 마감 시각에 `meal_signup_snapshots`에 저장, 이후 조회는 저장된 값.

### 5.8 명단 다운로드 — `GET /admin/meal-signups/export`
Query: `date`(필수), `meal_type`(필수), `format` = `csv`(기본) | `xlsx`
`Content-Type: text/csv; charset=utf-8-sig`, `Content-Disposition: attachment; filename="breakfast_20260914.csv"` (BOM 필수)

### 5.9 급식 일정 관리
| `POST /admin/meal-calendar` | 운영일 등록 (단건/일괄) |
| `PATCH /admin/meal-calendar/{date}` | 운영 여부·마감시각·메뉴 수정 |
```json
{ "service_date": "2026-09-14", "breakfast_available": true, "breakfast_deadline": "2026-09-13T09:00:00Z",
  "breakfast_menu": "미역국, 계란말이, 김치, 흰쌀밥", "dinner_available": true, "dinner_deadline": "2026-09-14T03:00:00Z",
  "dinner_menu": "치킨마요덮밥, 유부장국, 단무지" }
```

## 6. 데이터 모델 — 제약
| `students` | `UNIQUE(student_no)` |
| `votes` | `UNIQUE(poll_id, student_id)` (필수) |
| `meal_signups` | `UNIQUE(student_id, service_date, meal_type)` (필수) |
| `meal_calendar` | `PRIMARY KEY(service_date)` |
Enum: Role `student`,`admin` · MealType `breakfast`,`dinner` · PollStatus `scheduled`,`open`,`closed` · UnavailableReason `weekend`,`holiday`,`exam_period`,`no_service`

## 7. 에러 코드 — `app/core/errors.py`의 ERRORS 표가 원문 그대로 반영돼 있음

## 부록 A. 구현 체크리스트
- `votes`, `meal_signups`에 UNIQUE 제약 · IntegrityError → 409 변환 · 마감 검증에 aware UTC (naive now 금지)
- `service_date`는 Date · `/polls/{id}/result`에 마감 검사 · `/admin/*` 라우터 레벨 `require_admin`
- 투표 집계 GROUP BY 단일 쿼리 · CORS `["*"]` 금지 · bcrypt/argon2 · 응답에 `password_hash` 누출 금지 · CSV `utf-8-sig`

## 부록 B. 개인정보 처리 원칙
1. 최소 수집 — 학번, 이름, 학년, 반만 (연락처·생년월일·주소 X)
2. 투표 비밀 — `(학생, 선택지)` 쌍 반환 API 금지, 참여 여부까지만
3. 보존 기간 — 투표·신청 기록은 학년도 종료 후 3개월 내 삭제/익명화
4. 접근 통제 — 관리자 계정은 담당 교사에게만, 부여 이력 기록
5. 동의 — 가입 시 수집 항목·목적·보존 기간 고지 후 동의
