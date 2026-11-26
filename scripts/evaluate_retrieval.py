"""Evaluate retrieval against source IDs reviewed by the operator."""

import argparse
import json
from pathlib import Path
from statistics import mean
from time import perf_counter
from uuid import UUID

from sqlalchemy import text

from backend.app.core.config import Settings
from backend.app.database.connection import Database
from backend.app.knowledge import ModelError, embeddings, retrieve


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace", type=UUID)
    parser.add_argument("labels", type=Path,
                        help="JSON array of question and expected_source_ids records")
    args = parser.parse_args()
    cases = json.loads(args.labels.read_text(encoding="utf-8"))
    if not cases:
        parser.error("The reviewed label file has no questions.")
    try:
        reviewed = [(case["question"].strip(), {str(UUID(value)) for value in case["expected_source_ids"]})
                    for case in cases]
    except (AttributeError, KeyError, TypeError, ValueError):
        parser.error("Use question strings and expected_source_ids arrays of UUID strings.")
    if any(not question for question, _ in reviewed):
        parser.error("Every reviewed case needs a question.")
    settings = Settings()
    database = Database(settings)
    if database.engine is None:
        parser.error("Set NEXUSAI_DATABASE_URL to your authorized benchmark database.")
    strategies = ["keyword"]
    if settings.ollama_url:
        strategies += ["semantic", "hybrid"]
    if settings.rerank_url:
        strategies.append("reranked")
    try:
        expected_ids = sorted(set().union(*(expected for _, expected in reviewed)))
        with database.engine.connect() as connection:
            corpus = connection.execute(text("""
                SELECT count(*) AS chunks,
                    count(*) FILTER (WHERE c.embedding IS NOT NULL AND c.embedding_model = :model) AS embedded,
                    count(*) FILTER (WHERE CAST(c.id AS text) = ANY(:ids)) AS labeled
                FROM nexus_chunks c JOIN nexus_documents d ON d.id = c.document_id
                WHERE c.workspace_id = :workspace AND d.state = 'ready'
            """), {"workspace": args.workspace, "model": settings.embedding_model, "ids": expected_ids}).mappings().one()
        if not corpus["chunks"] or corpus["labeled"] != len(expected_ids):
            parser.error("Use a workspace with indexed documents and review any labels pointing to missing sources.")
        if settings.ollama_url:
            if not corpus["embedded"]:
                parser.error("Re-index the benchmark documents with the configured embedding model first.")
            try:
                embeddings(settings, [reviewed[0][0]])
            except ModelError as error:
                parser.error(str(error))
        for strategy in strategies:
            results = []
            for question, expected in reviewed:
                then = perf_counter()
                passages, mode, _ = retrieve(database.engine, args.workspace, question, settings, strategy)
                actual = [passage["id"] for passage in passages]
                hits = len(expected.intersection(actual))
                first = next((i for i, value in enumerate(actual, 1) if value in expected), None)
                results.append({
                    "observed_mode": mode, "precision_at_4": hits / 4 if expected else None,
                    "recall_at_4": hits / len(expected) if expected else None,
                    "reciprocal_rank": (1 / first if first else 0.0) if expected else None,
                    "abstained": not actual if not expected else None,
                    "milliseconds": (perf_counter() - then) * 1000,
                })
            metrics = {"strategy": strategy, "cases": len(results),
                       "indexed_chunks": corpus["chunks"], "embedded_chunks": corpus["embedded"],
                       "observed_modes": sorted({row["observed_mode"] for row in results})}
            if strategy == "reranked":
                metrics["reranked_cases"] = sum(row["observed_mode"].endswith("+rerank") for row in results)
            for key in ("precision_at_4", "recall_at_4", "reciprocal_rank", "abstained", "milliseconds"):
                actual_values = [row[key] for row in results if row[key] is not None]
                metrics[key] = mean(actual_values) if actual_values else None
            print(json.dumps(metrics))
    finally:
        database.close()


if __name__ == "__main__":
    main()
