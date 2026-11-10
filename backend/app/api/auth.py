from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.core.database import get_db
from backend.app.models.models import User, AuditLog
from backend.app.core.security import (
    hash_password,
    verify_password,
    check_login_rate_limit,
    create_session_token,
    verify_session_token,
    generate_csrf_token,
)
from backend.app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    username: str
    authenticated: bool
    csrf_token: str

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    username = verify_session_token(token)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    stmt = select(User).where(User.username == username)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    check_login_rate_limit(client_ip)

    stmt = select(User).where(User.username == req.username)
    user = (await db.execute(stmt)).scalar_one_or_none()

    # If first run and no users exist, seed default admin user
    count_stmt = select(User)
    all_users = (await db.execute(count_stmt)).scalars().all()
    if not all_users and req.username == "admin":
        user = User(username="admin", password_hash=hash_password(req.password))
        db.add(user)
        await db.commit()
    elif not user or not verify_password(user.password_hash, req.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    user.last_login = datetime.utcnow()
    audit = AuditLog(action="USER_LOGIN", actor=user.username, details_json=f'{{"ip": "{client_ip}"}}')
    db.add(audit)
    await db.commit()

    session_token = create_session_token(user.username)
    csrf_token = generate_csrf_token()

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False, # True in HTTPS/production proxy
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=False, # Accessible to frontend to send in X-CSRF-Token header
        samesite="lax",
        secure=False,
    )

    return {"ok": True, "username": user.username, "csrf_token": csrf_token}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session_token")
    response.delete_cookie("csrf_token")
    return {"ok": True}

@router.get("/me", response_model=UserResponse)
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("session_token")
    csrf_token = request.cookies.get("csrf_token") or generate_csrf_token()
    if not token:
        return UserResponse(username="", authenticated=False, csrf_token=csrf_token)
    username = verify_session_token(token)
    if not username:
        return UserResponse(username="", authenticated=False, csrf_token=csrf_token)
    return UserResponse(username=username, authenticated=True, csrf_token=csrf_token)
