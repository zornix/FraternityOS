from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from api.services.checkin_links import validate_checkin_link
from api.config import settings

router = APIRouter()


@router.get("/{short_code}", response_class=HTMLResponse)
async def checkin_page(short_code: str):
    """
    GET /c/A7x9Kp -> serves a lightweight HTML check-in page.

    The page uses the Supabase JS client to:
    1. Check if the user has an active session
    2. If yes -> auto-submit check-in via API
    3. If no -> redirect to login, then back here
    """
    link_data = await validate_checkin_link(short_code)

    if not link_data:
        return HTMLResponse(
            content="<h1>Link expired</h1><p>This check-in link is no longer valid.</p>",
            status_code=410,
        )

    event = link_data["events"]

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Check In — {event['title']}</title>
        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: -apple-system, sans-serif; background: #0f0f1a;
                    color: #e2e8f0; display: flex; align-items: center;
                    justify-content: center; min-height: 100vh; padding: 20px; }}
            .card {{ background: #1a1a2e; border-radius: 16px; padding: 32px;
                     max-width: 400px; width: 100%; text-align: center;
                     border: 1px solid #2a2a45; }}
            h1 {{ font-size: 20px; margin-bottom: 4px; }}
            .sub {{ color: #94a3b8; font-size: 14px; margin-bottom: 24px; }}
            .status {{ padding: 16px; border-radius: 12px; font-size: 15px;
                       font-weight: 600; }}
            .loading {{ background: #6c5ce722; color: #a29bfe; }}
            .success {{ background: #10b98122; color: #10b981; }}
            .error {{ background: #ef444422; color: #ef4444; }}
            .btn {{ display: inline-block; margin-top: 16px; padding: 10px 24px;
                    background: #6c5ce7; color: white; border: none; border-radius: 8px;
                    font-size: 14px; font-weight: 600; cursor: pointer;
                    text-decoration: none; }}
        </style>
    </head>
    <body>
        <div class="card">
            <h1>{event['title']}</h1>
            <p class="sub">{event['date']} · {event['location']}</p>
            <div id="status" class="status loading">Checking you in...</div>
        </div>
        <script>
            const SUPABASE_URL = '{settings.SUPABASE_URL}';
            const SUPABASE_KEY = '{settings.SUPABASE_ANON_KEY}';
            const SHORT_CODE = '{short_code}';
            const API_BASE = '{settings.BASE_URL}';

            (async () => {{
                const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                const statusEl = document.getElementById('status');

                const {{ data: {{ session }} }} = await sb.auth.getSession();

                if (!session) {{
                    statusEl.className = 'status error';
                    statusEl.innerHTML = 'You need to log in first.<br>'
                        + '<a class="btn" href="' + API_BASE
                        + '/login?redirect=/c/' + SHORT_CODE + '">Log In</a>';
                    return;
                }}

                try {{
                    const res = await fetch(
                        API_BASE + '/api/attendance/checkin/' + SHORT_CODE,
                        {{
                            method: 'POST',
                            headers: {{
                                'Authorization': 'Bearer ' + session.access_token,
                                'Content-Type': 'application/json',
                            }},
                        }}
                    );
                    const data = await res.json();

                    if (res.ok) {{
                        statusEl.className = 'status success';
                        statusEl.textContent = 'You\\'re checked in!';
                    }} else {{
                        statusEl.className = 'status error';
                        statusEl.textContent = data.detail || 'Check-in failed';
                    }}
                }} catch (err) {{
                    statusEl.className = 'status error';
                    statusEl.textContent = 'Network error. Try again.';
                }}
            }})();
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html)
