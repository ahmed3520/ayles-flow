import asyncio
import logging
import unittest

from session_runtime import run_events_to_session
from stream_store import SessionState


class SessionRuntimeTest(unittest.IsolatedAsyncioTestCase):
    async def test_run_events_to_session_drops_ping_and_appends_done(self):
        async def events():
            yield {"type": "ping"}
            yield {"type": "text_delta", "content": "hello"}

        state = SessionState("session-1")

        await run_events_to_session(
            "session-1",
            state,
            events(),
            log=logging.getLogger("test"),
            error_event_factory=lambda message: {"type": "error", "message": message},
        )

        self.assertEqual(
            [(event["type"], event["seq"]) for event in state.events],
            [("text_delta", 1), ("done", 2)],
        )

    async def test_run_events_to_session_emits_cancelled_event(self):
        async def cancelled_events():
            if False:
                yield {"type": "text_delta", "content": "never"}
            raise asyncio.CancelledError

        state = SessionState("session-2")

        await run_events_to_session(
            "session-2",
            state,
            cancelled_events(),
            log=logging.getLogger("test"),
            error_event_factory=lambda message: {"type": "error", "message": message},
            cancelled_event_factory=lambda: {"type": "error", "message": "cancelled"},
        )

        self.assertEqual(
            [(event["type"], event.get("message")) for event in state.events],
            [("error", "cancelled"), ("done", None)],
        )


if __name__ == "__main__":
    unittest.main()
