"""
Deep research — multi-step web research with synthesis.
Port of src/data/research.ts
"""

import asyncio
import json
import re
import logging
from typing import Callable, Awaitable

import llm_client
from groq_web import groq_web

log = logging.getLogger("research")

StatusWriter = Callable[[str, str], Awaitable[None]]


def _parse_json_queries(text: str) -> list[str]:
    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "")
    match = re.search(r"\{[\s\S]*\}", cleaned) or re.search(r"\[[\s\S]*\]", cleaned)
    if not match:
        return []
    try:
        parsed = json.loads(match.group(0))
        arr = parsed if isinstance(parsed, list) else parsed.get("queries", [])
        return [q for q in arr if isinstance(q, str)]
    except (json.JSONDecodeError, TypeError):
        return []


async def deep_research(
    topic: str,
    model: str,
    write_status: StatusWriter,
) -> dict:
    """
    Multi-step research: generate queries → search → analyze → follow-up → synthesize.
    Returns {"title": str, "markdown": str, "summary": str, "sources": [...]}
    """
    all_sources: list[dict] = []
    all_content: list[str] = []

    def add_sources(sources: list[dict]):
        for s in sources:
            if not any(e["url"] == s["url"] for e in all_sources):
                all_sources.append(s)

    # Phase 1: Generate search queries
    await write_status("Generating search queries...", "")
    initial_queries: list[str] = []
    try:
        result = await llm_client.chat(
            [
                {"role": "system", "content": "Generate 4-5 diverse search queries to thoroughly research the given topic. Return ONLY a JSON array of strings. Cover different angles: definitions, latest developments, expert opinions, comparisons, practical applications."},
                {"role": "user", "content": topic},
            ],
            model=model,
        )
        initial_queries = _parse_json_queries(result["content"] or "")
    except Exception:
        pass

    if len(initial_queries) < 2:
        initial_queries = [
            topic,
            f"{topic} latest developments 2025",
            f"{topic} expert analysis",
            f"{topic} pros and cons comparison",
        ]

    # Phase 2: Execute initial searches in parallel
    await write_status("Searching the web...", f"{len(initial_queries)} queries")

    async def search_one(q: str, i: int):
        await write_status("Searching the web...", f"({i+1}/{len(initial_queries)}) {q}")
        return await groq_web(q)

    results = await asyncio.gather(
        *[search_one(q, i) for i, q in enumerate(initial_queries)],
        return_exceptions=True,
    )
    for r in results:
        if isinstance(r, dict):
            all_content.append(r["content"])
            add_sources(r["sources"])

    # Phase 3: Analyze and generate follow-up queries
    await write_status("Analyzing initial findings...", "")
    follow_up_queries: list[str] = []
    try:
        result = await llm_client.chat(
            [
                {"role": "system", "content": "You are a research analyst. Based on the initial findings, identify gaps and generate 2-3 follow-up search queries. Return ONLY a JSON array of query strings."},
                {"role": "user", "content": f"Topic: {topic}\n\nInitial findings:\n" + "\n\n---\n\n".join(all_content)},
            ],
            model=model,
        )
        follow_up_queries = _parse_json_queries(result["content"] or "")
    except Exception:
        pass

    # Phase 4: Follow-up searches
    if follow_up_queries:
        await write_status("Deeper research...", f"{len(follow_up_queries)} follow-up queries")

        async def search_followup(q: str, i: int):
            await write_status("Deeper research...", f"({i+1}/{len(follow_up_queries)}) {q}")
            return await groq_web(q)

        results2 = await asyncio.gather(
            *[search_followup(q, i) for i, q in enumerate(follow_up_queries)],
            return_exceptions=True,
        )
        for r in results2:
            if isinstance(r, dict):
                all_content.append(r["content"])
                add_sources(r["sources"])

    # Phase 5: Synthesize structured document
    await write_status("Synthesizing research document...", "")
    sources_list = "\n".join(f"[{i+1}] {s['title']} - {s['url']}" for i, s in enumerate(all_sources))

    synthesis = await llm_client.chat(
        [
            {"role": "system", "content": f"""You are a research writer. Synthesize the following research findings into a well-structured document.

Requirements:
- Start with a clear title (# Title)
- Include an executive summary section (## Executive Summary)
- Organize into logical sections with ## headings
- Use inline citations referencing source numbers like [1], [2], etc.
- End with a "## Sources" section listing all numbered sources
- Be thorough but concise — aim for 800-1500 words
- Use markdown formatting
- Be factual and objective

Available sources for citation:
{sources_list}"""},
            {"role": "user", "content": f"Topic: {topic}\n\nResearch findings:\n" + "\n\n---\n\n".join(all_content)},
        ],
        model=model,
    )
    markdown = synthesis["content"] or ""

    # Extract title
    title_match = re.match(r"^#\s+(.+)$", markdown, re.MULTILINE)
    title = title_match.group(1) if title_match else f"Research: {topic}"

    # Phase 6: Generate brief summary
    await write_status("Generating summary...", "")
    summary_result = await llm_client.chat(
        [
            {"role": "system", "content": "Summarize this research document in 2-3 sentences. Be concise and highlight the key findings."},
            {"role": "user", "content": markdown},
        ],
        model=model,
    )
    summary = summary_result["content"] or ""

    await write_status("Research complete!", "")
    return {
        "title": title,
        "markdown": markdown,
        "summary": summary,
        "sources": all_sources[:15],
    }
