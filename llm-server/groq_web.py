"""
Web search via Groq compound model.
Port of src/data/groq.ts
"""

import os
import logging
from typing import Optional

from openai import AsyncOpenAI

log = logging.getLogger("groq-web")

_groq_client: Optional[AsyncOpenAI] = None


def _get_groq_client() -> AsyncOpenAI:
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        _groq_client = AsyncOpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=api_key,
            default_headers={"Groq-Model-Version": "latest"},
        )
    return _groq_client


async def groq_web(query: str) -> dict:
    """
    Web search via Groq compound-mini model.
    Returns {"content": str, "sources": [{"title": str, "url": str}]}
    """
    client = _get_groq_client()

    response = await client.chat.completions.create(
        model="groq/compound-mini",
        messages=[{"role": "user", "content": query}],
    )

    message = response.choices[0].message
    content = message.content or ""

    sources = []
    # Groq returns executed_tools in model_extra (not in base SDK types)
    extras = getattr(message, "model_extra", None) or {}
    executed_tools = extras.get("executed_tools", [])
    if executed_tools:
        for tool in executed_tools:
            results = (tool.get("search_results") or {}).get("results", [])
            for r in results:
                if r.get("title") and r.get("url"):
                    sources.append({"title": r["title"], "url": r["url"]})

    return {"content": content, "sources": sources[:5]}
