import csv
import hashlib
import importlib.util
import json
import math
from io import StringIO
from pathlib import PurePosixPath
from statistics import linear_regression, mean, median
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from backend.app.api.accounts import DatabaseEngine, Workspace, require_intent
from backend.app.knowledge import ALLOWED_EXTENSIONS, MAX_BYTES, grounded_answer, retrieve
from backend.app.runs import RunLeaseLost, report_events

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["workspace"])
intent = [Depends(require_intent)]


class Question(BaseModel):
    question: str = Field(min_length=3, max_length=1000)


class ReportRequest(Question):
    approved: bool = False


class AnalysisRequest(BaseModel):
    document_id: UUID
    column: str = Field(min_length=1, max_length=150)
    chronological: bool = False


@router.get("/documents")
def documents(engine: DatabaseEngine, workspace_id: Workspace):
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT id, name, state, error, created_at FROM nexus_documents
            WHERE workspace_id = :workspace ORDER BY created_at DESC, id LIMIT 100
        """), {"workspace": workspace_id}).mappings()
        return [dict(row) for row in rows]


@router.get("/documents/catalog")
def catalog(
    engine: DatabaseEngine, workspace_id: Workspace,
    q: str = Query(default="", max_length=150), state: str = Query(default="", pattern="^(|queued|processing|ready|failed)$"),
    page: int = Query(default=1, ge=1, le=10000),
):
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT id, name, state, error, created_at FROM nexus_documents
            WHERE workspace_id = :workspace AND (:state = '' OR state = :state)
              AND strpos(lower(name), lower(:query)) > 0
            ORDER BY created_at DESC, id LIMIT 21 OFFSET :offset
        """), {"workspace": workspace_id, "state": state, "query": q.strip(), "offset": (page - 1) * 20}).mappings().all()
    return {"items": [dict(row) for row in rows[:20]], "has_more": len(rows) > 20}


@router.get("/documents/{document_id}/file")
def document_file(document_id: UUID, engine: DatabaseEngine, workspace_id: Workspace):
    with engine.connect() as connection:
        row = connection.execute(text("""
            SELECT name, content FROM nexus_documents WHERE id = :id AND workspace_id = :workspace
        """), {"id": document_id, "workspace": workspace_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Document not found in this workspace.")
    media = "application/pdf" if PurePosixPath(row["name"]).suffix.lower() == ".pdf" else "text/plain"
    return Response(bytes(row["content"]), media_type=media, headers={
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline; filename*=UTF-8''" + quote(row["name"], safe=""),
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
    })


@router.delete("/documents/{document_id}", status_code=204, dependencies=intent)
def delete_document(document_id: UUID, engine: DatabaseEngine, workspace_id: Workspace):
    with engine.begin() as connection:
        removed = connection.execute(text("""
            DELETE FROM nexus_documents WHERE id = :id AND workspace_id = :workspace RETURNING id
        """), {"id": document_id, "workspace": workspace_id}).scalar()
        if removed is None:
            raise HTTPException(404, "Document not found in this workspace.")
    return Response(status_code=204)


@router.post("/documents/{document_id}/reindex", status_code=202, dependencies=intent)
def reindex_document(document_id: UUID, engine: DatabaseEngine, workspace_id: Workspace):
    with engine.begin() as connection:
        updated = connection.execute(text("""
            UPDATE nexus_documents SET state = 'queued', attempts = 0, error = NULL,
                lease_until = NULL, lease_token = NULL
            WHERE id = :id AND workspace_id = :workspace AND state = 'ready'
            RETURNING id, state
        """), {"id": document_id, "workspace": workspace_id}).mappings().first()
    if updated is None:
        raise HTTPException(409, "Only a ready document in this workspace can be re-indexed.")
    return dict(updated)


@router.post("/documents", status_code=202, dependencies=intent)
async def upload_document(
    engine: DatabaseEngine, workspace_id: Workspace, request: Request,
    name: str = Query(min_length=1, max_length=150),
):
    if not name.isprintable() or "/" in name or "\\" in name:
        raise HTTPException(422, "Use a filename without directory separators.")
    suffix = PurePosixPath(name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(415, "Use PDF, UTF-8 TXT, Markdown or CSV.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Files are limited to 5 MiB.")
        data.extend(chunk)
    if not data or (suffix == ".pdf" and not data.startswith(b"%PDF-")):
        raise HTTPException(422, "Upload a non-empty file in the selected format.")

    def store():
        payload = {"id": uuid4(), "workspace": workspace_id, "name": name,
                   "digest": hashlib.sha256(data).hexdigest(), "content": bytes(data)}
        with engine.begin() as connection:
            row = connection.execute(text("""
                INSERT INTO nexus_documents (id, workspace_id, name, digest, content)
                VALUES (:id, :workspace, :name, :digest, :content)
                ON CONFLICT (workspace_id, digest) DO NOTHING RETURNING id, name, state
            """), payload).mappings().first()
            duplicate = row is None
            if row is None:
                row = connection.execute(text("""
                    SELECT id, name, state FROM nexus_documents
                    WHERE workspace_id = :workspace AND digest = :digest
                """), payload).mappings().one()
            return {**row, "duplicate": duplicate}

    return await run_in_threadpool(store)


@router.post("/documents/{document_id}/retry", status_code=202, dependencies=intent)
def retry_document(document_id: UUID, engine: DatabaseEngine, workspace_id: Workspace):
    with engine.begin() as connection:
        updated = connection.execute(text("""
            UPDATE nexus_documents SET state = 'queued', attempts = 0, error = NULL,
                lease_until = NULL, lease_token = NULL
            WHERE id = :id AND workspace_id = :workspace AND state = 'failed'
            RETURNING id, state
        """), {"id": document_id, "workspace": workspace_id}).mappings().first()
    if updated is None:
        raise HTTPException(404, "No failed document with this ID exists in the workspace.")
    return dict(updated)


@router.get("/sources/{source_id}")
def source(source_id: UUID, engine: DatabaseEngine, workspace_id: Workspace):
    with engine.connect() as connection:
        row = connection.execute(text("""
            SELECT c.id, c.document_id, c.source_page AS page, c.passage, d.name
            FROM nexus_chunks c JOIN nexus_documents d ON d.id = c.document_id
            WHERE c.id = :id AND c.workspace_id = :workspace AND d.state = 'ready'
        """), {"id": source_id, "workspace": workspace_id}).mappings().first()
    if row is None:
        raise HTTPException(404, "Source not found in this workspace.")
    return dict(row)


@router.get("/chat")
def history(engine: DatabaseEngine, workspace_id: Workspace):
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT id, question, result, created_at FROM nexus_exchanges
            WHERE workspace_id = :workspace ORDER BY created_at DESC, id LIMIT 30
        """), {"workspace": workspace_id}).mappings()
        return [dict(row) for row in rows]


@router.post("/chat", dependencies=intent)
def ask(data: Question, engine: DatabaseEngine, workspace_id: Workspace, request: Request):
    question = data.question.strip()
    if len(question) < 3:
        raise HTTPException(422, "Enter a question with at least three characters.")
    settings = request.app.state.settings
    passages, mode, indexed = retrieve(engine, workspace_id, question, settings)
    result = grounded_answer(question, passages, mode, settings)
    result["indexed_chunks"] = indexed
    exchange_id = uuid4()
    with engine.begin() as connection:
        connection.execute(text("""
            INSERT INTO nexus_exchanges (id, workspace_id, question, result)
            VALUES (:id, :workspace, :question, CAST(:result AS jsonb))
        """), {"id": exchange_id, "workspace": workspace_id, "question": question,
               "result": json.dumps(result)})
    exchange = {"id": str(exchange_id), "question": question, "result": result}
    if request.headers.get("accept") == "text/event-stream":
        def events():
            answer = result["answer"]
            for offset in range(0, len(answer), 140):
                yield "event: passage\ndata: " + json.dumps(answer[offset:offset + 140]) + "\n\n"
            yield "event: result\ndata: " + json.dumps(exchange) + "\n\n"
        return StreamingResponse(events(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
    return exchange


@router.get("/overview")
def overview(engine: DatabaseEngine, workspace_id: Workspace):
    with engine.connect() as connection:
        row = connection.execute(text("""
            SELECT (SELECT count(*) FROM nexus_documents WHERE workspace_id = :id) AS documents,
                   (SELECT count(*) FROM nexus_chunks WHERE workspace_id = :id) AS chunks,
                   (SELECT count(*) FROM nexus_exchanges WHERE workspace_id = :id) AS questions,
                   (SELECT count(*) FROM nexus_reports WHERE workspace_id = :id) AS reports
        """), {"id": workspace_id}).mappings().one()
    return dict(row)


@router.post("/sql", dependencies=intent)
def query_workspace(data: Question, engine: DatabaseEngine, workspace_id: Workspace):
    query = data.question.strip().lower().rstrip("?")
    templates = {
        "count documents": (
            "SELECT state, count(*) AS count FROM nexus_documents WHERE workspace_id = :id "
            "GROUP BY state ORDER BY state"
        ),
        "list recent reports": (
            "SELECT title, created_at FROM nexus_reports WHERE workspace_id = :id "
            "ORDER BY created_at DESC LIMIT 20"
        ),
        "count chunks": "SELECT count(*) AS chunks FROM nexus_chunks WHERE workspace_id = :id",
    }
    if query not in templates:
        raise HTTPException(422, "Supported requests: count documents, count chunks, list recent reports.")
    with engine.begin() as connection:
        connection.execute(text("SET TRANSACTION READ ONLY"))
        rows = connection.execute(text(templates[query]), {"id": workspace_id}).mappings().all()
    return {"query": templates[query], "rows": [dict(row) for row in rows]}


@router.post("/analytics", dependencies=intent)
def analyze(data: AnalysisRequest, engine: DatabaseEngine, workspace_id: Workspace):
    with engine.connect() as connection:
        document = connection.execute(text("""
            SELECT name, content FROM nexus_documents WHERE id = :id AND workspace_id = :workspace
        """), {"id": data.document_id, "workspace": workspace_id}).mappings().first()
    if not document or PurePosixPath(document["name"]).suffix.lower() != ".csv":
        raise HTTPException(404, "CSV document not found in this workspace.")
    try:
        reader = csv.DictReader(StringIO(bytes(document["content"]).decode("utf-8-sig")))
        if not reader.fieldnames or data.column not in reader.fieldnames:
            raise HTTPException(422, "CSV headers: " + ", ".join(reader.fieldnames or [])[:400])
        if len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise HTTPException(422, "CSV headers must be unique.")
        values = []
        skipped = 0
        for index, row in enumerate(reader, start=1):
            if index > 10_000:
                raise HTTPException(422, "Analyze a CSV containing no more than 10,000 data rows.")
            try:
                value = float((row.get(data.column) or "").strip())
                if not math.isfinite(value) or abs(value) > 1e100:
                    raise ValueError()
            except ValueError:
                skipped += 1
                continue
            values.append((index, value))
    except (UnicodeError, csv.Error) as exc:
        raise HTTPException(422, "Use a valid UTF-8 CSV.") from exc
    if not values:
        raise HTTPException(422, "The selected column has no supported numeric values.")
    numbers = [value for _, value in values]
    middle = median(numbers)
    deviation = median(abs(value - middle) for value in numbers)
    anomalies = [{"row": i, "value": value} for i, value in values
                 if deviation and abs(value - middle) / deviation > 5.2]
    forecast = None
    if data.chronological and skipped == 0 and len(numbers) >= 20:
        split = len(numbers) * 4 // 5
        seen, held_out = numbers[:split], numbers[split:]
        slope, intercept = linear_regression(range(split), seen)
        candidate_error = mean(abs(slope * index + intercept - observed)
                               for index, observed in enumerate(held_out, start=split))
        baseline_error = mean(abs(seen[-1] - observed) for observed in held_out)
        method = "last_observed"
        next_value = numbers[-1]
        if candidate_error < baseline_error:
            method = "linear_trend"
            full_slope, full_intercept = linear_regression(range(len(numbers)), numbers)
            next_value = full_slope * len(numbers) + full_intercept
        forecast = {"method": method, "next_value": next_value, "validation_rows": len(held_out),
                    "linear_mae": candidate_error, "baseline_mae": baseline_error}
    return {"column": data.column, "count": len(numbers), "skipped": skipped,
            "min": min(numbers), "max": max(numbers), "mean": mean(numbers), "median": middle,
            "anomalies": anomalies[:50], "anomaly_count": len(anomalies), "mad": deviation,
            "forecast": forecast}


@router.get("/reports")
def reports(engine: DatabaseEngine, workspace_id: Workspace):
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT id, title, body, created_at, evidence -> 'steps' AS steps FROM nexus_reports
            WHERE workspace_id = :workspace ORDER BY created_at DESC, id LIMIT 30
        """), {"workspace": workspace_id}).mappings()
        return [dict(row) for row in rows]


@router.post("/reports", status_code=201, dependencies=intent)
def create_report(data: ReportRequest, engine: DatabaseEngine, workspace_id: Workspace, request: Request):
    if not data.approved:
        raise HTTPException(422, "Approve the workflow before it runs.")
    if importlib.util.find_spec("langgraph") is None:
        raise HTTPException(503, "Install the optional agents dependency group to run workflows.")
    question = data.question.strip()
    if len(question) < 3:
        raise HTTPException(422, "Enter a research question with at least three characters.")
    run_id, lease = uuid4(), uuid4()
    with engine.begin() as connection:
        connection.execute(text("""
            INSERT INTO nexus_runs (id, workspace_id, question, status, lease_token, lease_until)
            VALUES (:id, :workspace, :question, 'running', :lease, now() + interval '2 minutes')
        """), {"id": run_id, "workspace": workspace_id, "question": question, "lease": lease})
    return send_report(request, report_events(engine, workspace_id, run_id, lease, question,
                                              {"steps": []}, request.app.state.settings))


@router.get("/runs")
def runs(engine: DatabaseEngine, workspace_id: Workspace):
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT id, question, report_id, checkpoint -> 'steps' AS steps,
                CASE WHEN status = 'running' AND lease_until <= now() THEN 'interrupted'
                    ELSE status END AS status
            FROM nexus_runs WHERE workspace_id = :workspace ORDER BY created_at DESC, id LIMIT 30
        """), {"workspace": workspace_id}).mappings()
        return [dict(row) for row in rows]


@router.post("/runs/{run_id}/resume", status_code=201, dependencies=intent)
def resume_run(run_id: UUID, engine: DatabaseEngine, workspace_id: Workspace, request: Request):
    if importlib.util.find_spec("langgraph") is None:
        raise HTTPException(503, "Install the optional agents dependency group to run workflows.")
    lease = uuid4()
    with engine.begin() as connection:
        row = connection.execute(text("""
            UPDATE nexus_runs SET status = 'running', lease_token = :lease,
                lease_until = now() + interval '2 minutes', updated_at = now()
            WHERE id = :id AND workspace_id = :workspace
              AND (status = 'failed' OR (status = 'running' AND lease_until <= now()))
            RETURNING question, checkpoint
        """), {"id": run_id, "workspace": workspace_id, "lease": lease}).mappings().first()
    if row is None:
        raise HTTPException(409, "This run is missing or cannot be resumed.")
    return send_report(request, report_events(engine, workspace_id, run_id, lease, row["question"],
                                              row["checkpoint"], request.app.state.settings))


def send_report(request: Request, execution):
    if request.headers.get("accept") == "text/event-stream":
        def events():
            try:
                for event, payload in execution:
                    yield f"event: {event}\ndata: {json.dumps(payload)}\n\n"
            except (SQLAlchemyError, RunLeaseLost):
                yield 'event: error\ndata: "The report could not be saved or its sources could not be read."\n\n'
            finally:
                execution.close()
        return StreamingResponse(events(), status_code=201, media_type="text/event-stream",
                                 headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
    for _, payload in execution:
        result = payload
    return result
