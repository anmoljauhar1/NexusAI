import hashlib
import hmac
import logging
import secrets
import smtplib
import ssl
from email.message import EmailMessage
from threading import BoundedSemaphore
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import IntegrityError

COOKIE = "nexus_session"
SESSION_SECONDS = 60 * 60 * 12
password_slots = BoundedSemaphore(2)
router = APIRouter(prefix="/api/v1", tags=["account"])
logger = logging.getLogger(__name__)


class Credentials(BaseModel):
    email: str = Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class WorkspaceInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ProfileInput(BaseModel):
    display_name: str = Field(max_length=80)


class PasswordInput(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class ResetRequest(BaseModel):
    email: str = Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class ResetPassword(BaseModel):
    token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    password: str = Field(min_length=12, max_length=128)


def database_engine(request: Request) -> Engine:
    engine = request.app.state.database.engine
    if engine is None:
        raise HTTPException(503, "Set NEXUSAI_DATABASE_URL and apply database migrations.")
    return engine


DatabaseEngine = Annotated[Engine, Depends(database_engine)]


def require_intent(x_nexusai_request: Annotated[str | None, Header()] = None) -> None:
    if x_nexusai_request != "workspace":
        raise HTTPException(403, "The request is missing the workspace intent header.")


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def password_digest(password: str, salt: bytes) -> str:
    if not password_slots.acquire(blocking=False):
        raise HTTPException(429, "Sign-in is busy. Try again shortly.")
    try:
        return hashlib.scrypt(
            password.encode(), salt=salt, n=2**15, r=8, p=1, maxmem=64 * 1024**2,
        ).hex()
    finally:
        password_slots.release()


def new_session(connection: Connection, user_id: UUID, response: Response, request: Request) -> None:
    token = secrets.token_urlsafe(32)
    connection.execute(text("""
        INSERT INTO nexus_sessions (token_hash, user_id, expires_at)
        VALUES (:token, :user_id, now() + make_interval(secs => :seconds))
    """), {"token": token_hash(token), "user_id": user_id, "seconds": SESSION_SECONDS})
    response.set_cookie(
        COOKIE, token, max_age=SESSION_SECONDS, httponly=True, samesite="strict",
        secure=request.app.state.settings.environment == "production",
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    return f"{salt.hex()}:{password_digest(password, salt)}"


def matches_password(password: str, hashed: str | None) -> bool:
    salt, expected = hashed.split(":") if hashed else ("00" * 16, "00" * 64)
    return hmac.compare_digest(password_digest(password, bytes.fromhex(salt)), expected)


def signed_in(engine: DatabaseEngine, token: Annotated[str | None, Cookie(alias=COOKIE)] = None):
    if not token or len(token) != 43:
        raise HTTPException(401, "Sign in to access this workspace.")
    with engine.connect() as connection:
        user = connection.execute(text("""
            SELECT u.id, u.email, u.display_name FROM nexus_sessions s JOIN nexus_users u ON u.id = s.user_id
            WHERE s.token_hash = :token AND s.expires_at > now()
        """), {"token": token_hash(token)}).mappings().first()
    if user is None:
        raise HTTPException(401, "Your session expired. Sign in again.")
    return dict(user)


CurrentUser = Annotated[dict, Depends(signed_in)]


def authorize_workspace(workspace_id: UUID, engine: DatabaseEngine, user: CurrentUser) -> UUID:
    with engine.connect() as connection:
        owns = connection.execute(text("""
            SELECT 1 FROM nexus_workspaces WHERE id = :id AND owner_id = :owner
        """), {"id": workspace_id, "owner": user["id"]}).scalar()
    if not owns:
        raise HTTPException(404, "Workspace not found.")
    return workspace_id


Workspace = Annotated[UUID, Depends(authorize_workspace)]


@router.post("/auth/register", status_code=201, dependencies=[Depends(require_intent)])
def register(data: Credentials, engine: DatabaseEngine, response: Response, request: Request):
    if len(data.password) < 12:
        raise HTTPException(422, "Use a password with at least 12 characters.")
    digest = hash_password(data.password)
    user = {"id": uuid4(), "email": data.email, "display_name": ""}
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                INSERT INTO nexus_users (id, email, password_hash) VALUES (:id, :email, :digest)
            """), {**user, "digest": digest})
            connection.execute(text("""
                INSERT INTO nexus_workspaces (id, owner_id, name) VALUES (:id, :owner, :name)
            """), {"id": uuid4(), "owner": user["id"], "name": "My Workspace"})
            new_session(connection, user["id"], response, request)
    except IntegrityError:
        raise HTTPException(409, "This email is already registered.") from None
    return user


@router.post("/auth/login", dependencies=[Depends(require_intent)])
def login(data: Credentials, engine: DatabaseEngine, response: Response, request: Request):
    with engine.connect() as connection:
        user = connection.execute(text("""
            SELECT id, email, display_name, password_hash FROM nexus_users WHERE email = :email
        """), {"email": data.email}).mappings().first()
    if not matches_password(data.password, user["password_hash"] if user else None) or user is None:
        raise HTTPException(401, "Email or password is incorrect.")
    with engine.begin() as connection:
        active_hash = connection.execute(text("SELECT password_hash FROM nexus_users WHERE id = :id FOR UPDATE"),
                                         {"id": user["id"]}).scalar()
        if active_hash != user["password_hash"]:
            raise HTTPException(401, "Sign in again with your current password.")
        new_session(connection, user["id"], response, request)
    return {"id": user["id"], "email": user["email"], "display_name": user["display_name"]}


@router.get("/auth/session")
def session(user: CurrentUser):
    return user


@router.post("/auth/profile", dependencies=[Depends(require_intent)])
def update_profile(data: ProfileInput, user: CurrentUser, engine: DatabaseEngine):
    name = data.display_name.strip()
    if name and not name.isprintable():
        raise HTTPException(422, "Use printable characters for your display name.")
    with engine.begin() as connection:
        connection.execute(text("UPDATE nexus_users SET display_name = :name WHERE id = :id"),
                           {"name": name, "id": user["id"]})
    return {**user, "display_name": name}


@router.get("/auth/sessions")
def active_sessions(
    user: CurrentUser, engine: DatabaseEngine,
    token: Annotated[str | None, Cookie(alias=COOKIE)] = None,
):
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT id, created_at, expires_at, token_hash = :current AS current
            FROM nexus_sessions WHERE user_id = :id AND expires_at > now()
            ORDER BY current DESC, created_at DESC LIMIT 50
        """), {"id": user["id"], "current": token_hash(token or "")}).mappings()
        return [dict(row) for row in rows]


@router.post("/auth/sessions/{session_id}/revoke", status_code=204, dependencies=[Depends(require_intent)])
def revoke_session(
    session_id: UUID, user: CurrentUser, engine: DatabaseEngine,
    token: Annotated[str | None, Cookie(alias=COOKIE)] = None,
):
    with engine.begin() as connection:
        deleted = connection.execute(text("""
            DELETE FROM nexus_sessions WHERE user_id = :user AND id = :id AND token_hash <> :current
            RETURNING id
        """), {"user": user["id"], "id": session_id, "current": token_hash(token or "")}).scalar()
    if deleted is None:
        raise HTTPException(404, "Session not found. Use Sign out to end this browser session.")
    return Response(status_code=204)


@router.post("/auth/password", dependencies=[Depends(require_intent)])
def change_password(data: PasswordInput, user: CurrentUser, engine: DatabaseEngine, response: Response, request: Request):
    with engine.connect() as connection:
        previous = connection.execute(text("SELECT password_hash FROM nexus_users WHERE id = :id"),
                                      {"id": user["id"]}).scalar()
    if not matches_password(data.current_password, previous) or previous is None:
        raise HTTPException(422, "The current password is incorrect.")
    new_hash = hash_password(data.new_password)
    with engine.begin() as connection:
        saved = connection.execute(text("""
            UPDATE nexus_users SET password_hash = :hash WHERE id = :id AND password_hash = :previous RETURNING id
        """), {"id": user["id"], "hash": new_hash, "previous": previous}).scalar()
        if not saved:
            raise HTTPException(409, "The password changed. Sign in again.")
        connection.execute(text("DELETE FROM nexus_sessions WHERE user_id = :id"), {"id": user["id"]})
        connection.execute(text("DELETE FROM nexus_resets WHERE user_id = :id"), {"id": user["id"]})
        new_session(connection, user["id"], response, request)
    return user


@router.post("/auth/reset-request", status_code=202, dependencies=[Depends(require_intent)])
def request_reset(data: ResetRequest, engine: DatabaseEngine, request: Request, background_tasks: BackgroundTasks):
    settings = request.app.state.settings
    if (not settings.smtp_host or not settings.smtp_sender or not settings.reset_public_origin
            or (settings.environment == "production" and not settings.reset_public_origin.startswith("https://"))):
        raise HTTPException(503, "Password reset email is not configured.")
    message = {"message": "If the account exists, password reset instructions will be sent."}
    email = data.email
    token = secrets.token_urlsafe(32)
    digest = token_hash(token)
    with engine.begin() as connection:
        sent = connection.execute(text("""
            INSERT INTO nexus_resets (user_id, token_hash, expires_at)
            SELECT id, :hash, now() + interval '30 minutes' FROM nexus_users WHERE email = :email
            ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = now(),
                expires_at = EXCLUDED.expires_at WHERE nexus_resets.created_at < now() - interval '2 minutes'
            RETURNING user_id
        """), {"email": email, "hash": digest}).scalar()
    def deliver():
        mail = EmailMessage()
        mail["From"], mail["To"], mail["Subject"] = settings.smtp_sender, email, "Reset your NexusAI password"
        mail.set_content(f"Open this link within 30 minutes to reset your password:\n\n"
                         f"{settings.reset_public_origin}/reset-password#{token}")
        try:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ssl.create_default_context(), timeout=10) as smtp:
                if settings.smtp_username and settings.smtp_password:
                    smtp.login(settings.smtp_username, settings.smtp_password.get_secret_value())
                smtp.send_message(mail)
        except (OSError, smtplib.SMTPException):
            logger.warning("Password reset email delivery failed.")
            with engine.begin() as connection:
                connection.execute(text("DELETE FROM nexus_resets WHERE token_hash = :hash"), {"hash": digest})

    if sent:
        background_tasks.add_task(deliver)
    return message


@router.post("/auth/reset-password", status_code=204, dependencies=[Depends(require_intent)])
def reset_password(data: ResetPassword, engine: DatabaseEngine):
    digest = token_hash(data.token)
    with engine.connect() as connection:
        exists = connection.execute(text("SELECT 1 FROM nexus_resets WHERE token_hash = :hash AND expires_at > now()"),
                                    {"hash": digest}).scalar()
    if not exists:
        raise HTTPException(422, "This reset link is invalid or expired.")
    new_hash = hash_password(data.password)
    with engine.begin() as connection:
        user_id = connection.execute(text("""
            SELECT u.id FROM nexus_users u JOIN nexus_resets r ON r.user_id = u.id
            WHERE r.token_hash = :hash AND r.expires_at > now() FOR UPDATE OF u
        """), {"hash": digest}).scalar()
        if not user_id:
            raise HTTPException(422, "This reset link is invalid or expired.")
        consumed = connection.execute(text("""
            DELETE FROM nexus_resets WHERE user_id = :id AND token_hash = :hash AND expires_at > now()
            RETURNING user_id
        """), {"id": user_id, "hash": digest}).scalar()
        if not consumed:
            raise HTTPException(422, "This reset link is invalid or expired.")
        connection.execute(text("UPDATE nexus_users SET password_hash = :hash WHERE id = :id"),
                           {"id": user_id, "hash": new_hash})
        connection.execute(text("DELETE FROM nexus_sessions WHERE user_id = :id"), {"id": user_id})
    return Response(status_code=204)


@router.post("/auth/logout", status_code=204, dependencies=[Depends(require_intent)])
def logout(engine: DatabaseEngine, request: Request, token: Annotated[str | None, Cookie(alias=COOKIE)] = None):
    if token and len(token) == 43:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM nexus_sessions WHERE token_hash = :token"),
                               {"token": token_hash(token)})
    response = Response(status_code=204)
    response.delete_cookie(COOKIE, httponly=True, samesite="strict",
                           secure=request.app.state.settings.environment == "production")
    return response


@router.get("/workspaces")
def workspaces(engine: DatabaseEngine, user: CurrentUser):
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT id, name FROM nexus_workspaces WHERE owner_id = :owner ORDER BY created_at, id
        """), {"owner": user["id"]}).mappings()
        return [dict(row) for row in rows]


@router.post("/workspaces", status_code=201, dependencies=[Depends(require_intent)])
def create_workspace(data: WorkspaceInput, engine: DatabaseEngine, user: CurrentUser):
    name = data.name.strip()
    if not name:
        raise HTTPException(422, "Enter a workspace name.")
    workspace = {"id": uuid4(), "name": name}
    with engine.begin() as connection:
        connection.execute(text("""
            INSERT INTO nexus_workspaces (id, owner_id, name) VALUES (:id, :owner, :name)
        """), {**workspace, "owner": user["id"]})
    return workspace
