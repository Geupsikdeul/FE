"""급식들 프론트 서버 (FastAPI).

- 화면: /a/b → pages/student/a-b.html, /admin/a/b → pages/admin/a-b.html (id 등은 쿼리스트링)
- /api/* 는 배포된 백엔드(BACKEND_URL)로 그대로 전달 → 브라우저는 같은 출처만 부르므로 CORS 문제 없음
실행: BACKEND_URL=http://192.168.1.44:8000 .venv/bin/python -m frontend.server
"""
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

BACKEND_URL = os.environ.get("BACKEND_URL", "http://192.168.1.44:8000").rstrip("/")
HERE = Path(__file__).parent
PAGES = HERE / "pages"
HOP = {"host", "connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade",
       "proxy-authorization", "proxy-authenticate", "content-length", "content-encoding"}

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
client = httpx.AsyncClient(base_url=BACKEND_URL, timeout=30.0)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(path: str, request: Request):
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP and k.lower() != "origin"}
    try:
        r = await client.request(request.method, f"/api/{path}", params=request.query_params,
                                 content=await request.body(), headers=headers)
    except httpx.HTTPError:
        return JSONResponse({"error": {"code": "BACKEND_UNREACHABLE",
                                       "message": "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
                                       "detail": None}}, status_code=502)
    out = {k: v for k, v in r.headers.items() if k.lower() not in HOP and not k.lower().startswith("access-control")}
    return Response(r.content, status_code=r.status_code, headers=out)


app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")


def _page(folder: str, path: str) -> Response:
    name = path.strip("/").replace("/", "-") or ("dashboard" if folder == "admin" else "home")
    f = (PAGES / folder / name).with_suffix(".html")
    if f.parent == PAGES / folder and f.is_file():
        return FileResponse(f)
    nf = PAGES / "student" / "404.html"
    return FileResponse(nf, status_code=404) if nf.is_file() else Response("404", status_code=404)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/home")


@app.get("/admin", include_in_schema=False)
@app.get("/admin/{path:path}", include_in_schema=False)
def admin_pages(path: str = ""):
    return _page("admin", path)


@app.get("/{path:path}", include_in_schema=False)
def student_pages(path: str):
    return _page("student", path)


if __name__ == "__main__":
    import socket

    import uvicorn
    port = int(os.environ.get("PORT", "3000"))
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("10.255.255.255", 1)); lan = s.getsockname()[0]; s.close()
    except OSError:
        lan = "127.0.0.1"
    print(f"\n  백엔드    {BACKEND_URL}\n  학생 앱   http://localhost:{port}/   (휴대폰: http://{lan}:{port}/)\n  어드민 웹 http://localhost:{port}/admin\n")
    uvicorn.run(app, host=os.environ.get("HOST", "0.0.0.0"), port=port)
