from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy import text

from backend.app.knowledge import retrieve


class ResearchState(TypedDict, total=False):
    sources: list[dict]
    verified: list[dict]
    steps: list[str]
    body: str


def stream_research(engine, workspace, question, settings, checkpoint: ResearchState | None = None):
    def research(state: ResearchState):
        sources, _, _ = retrieve(engine, workspace, question, settings)
        return {"sources": sources, "steps": [*state["steps"], "Retrieved workspace evidence"]}

    def verify(state: ResearchState):
        checked = []
        with engine.connect() as connection:
            for passage in state["sources"]:
                original = connection.execute(text("""
                    SELECT passage FROM nexus_chunks WHERE id = CAST(:id AS uuid)
                    AND workspace_id = :workspace
                """), {"id": passage["id"], "workspace": workspace}).scalar()
                if original == passage["passage"]:
                    checked.append(passage)
        return {"verified": checked, "steps": [*state["steps"], f"Verified {len(checked)} stored passages"]}

    def report(state: ResearchState):
        sections = [f"# Research report\n\nQuestion: {question}"]
        for source in state["verified"]:
            sections.append(f"## {source['name']} · page {source['page']}\n\n{source['passage']}\n\nSource ID: {source['id']}")
        if not state["verified"]:
            sections.append("No supporting passages were found.")
        sections.append("Verification confirms stored passage text. It does not establish every claim's factual accuracy.")
        return {"body": "\n\n".join(sections), "steps": [*state["steps"], "Assembled Markdown report"]}

    graph = StateGraph(ResearchState)
    graph.add_node("research", research)
    graph.add_node("verify", verify)
    graph.add_node("report", report)
    def next_step(state: ResearchState):
        if "body" in state:
            return "done"
        if "verified" in state:
            return "report"
        if "sources" in state:
            return "verify"
        return "research"

    graph.add_conditional_edges(START, next_step, {
        "research": "research", "verify": "verify", "report": "report", "done": END,
    })
    graph.add_edge("research", "verify")
    graph.add_edge("verify", "report")
    graph.add_edge("report", END)
    return graph.compile().stream(checkpoint or {"steps": []}, config={"recursion_limit": 8}, stream_mode="values")
