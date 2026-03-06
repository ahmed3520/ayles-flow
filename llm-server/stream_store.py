"""
Session store for resumable agent streams.

The goal is to make the stream lifecycle explicit:
- agent work runs independently from any one socket
- every event gets a monotonic server-assigned sequence number
- reconnects resume from the last acknowledged sequence
- connection ownership is tracked with a lease so stale disconnects do not
  tear down a newer connection
"""

import asyncio
import logging
import time
import uuid
from typing import Optional

log = logging.getLogger("stream-store")

GRACE_SECONDS = 60


class SessionState:
    __slots__ = (
        "session_id",
        "events",
        "done",
        "created_at",
        "finished_at",
        "last_activity_at",
        "task",
        "_waiters",
        "_grace_handle",
        "_next_seq",
        "_active_connection_id",
        "_connected_at",
    )

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.events: list[dict] = []
        self.done = False
        self.created_at = time.time()
        self.finished_at: Optional[float] = None
        self.last_activity_at = self.created_at
        self.task: Optional[asyncio.Task] = None
        self._waiters: list[asyncio.Future] = []
        self._grace_handle: Optional[asyncio.TimerHandle] = None
        self._next_seq = 1
        self._active_connection_id: Optional[str] = None
        self._connected_at: Optional[float] = None

    @property
    def connected(self) -> bool:
        return self._active_connection_id is not None

    @property
    def next_seq(self) -> int:
        return self._next_seq

    def append(self, event: dict) -> dict:
        stored = dict(event)
        stored["seq"] = self._next_seq
        self._next_seq += 1
        self.events.append(stored)
        self.last_activity_at = time.time()
        self._notify()
        return stored

    def mark_done(self):
        if self.done:
            return
        self.done = True
        self.finished_at = time.time()
        self.last_activity_at = self.finished_at
        self._cancel_grace()
        self._notify()

    def cancel(self):
        self._cancel_grace()
        if self.task and not self.task.done():
            self.task.cancel()
        self._notify()

    def attach(self, connection_id: str):
        self._active_connection_id = connection_id
        self._connected_at = time.time()
        self.last_activity_at = self._connected_at
        self._cancel_grace()
        self._notify()

    def owns_connection(self, connection_id: str) -> bool:
        return self._active_connection_id == connection_id

    def detach(self, connection_id: str):
        if self._active_connection_id != connection_id:
            return
        self._active_connection_id = None
        self._connected_at = None
        self.last_activity_at = time.time()
        if self.done:
            self._notify()
            return
        self._cancel_grace()
        try:
            loop = asyncio.get_running_loop()
            self._grace_handle = loop.call_later(GRACE_SECONDS, self._grace_expired)
            log.info(f"Grace timer started for session {self.session_id} ({GRACE_SECONDS}s)")
        except RuntimeError:
            pass
        self._notify()

    def replay_after(self, after_seq: int) -> list[dict]:
        if after_seq < 0:
            after_seq = 0
        return list(self.events[after_seq:])

    async def wait_for_new(self, timeout: float = 5):
        if self.done:
            return
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        self._waiters.append(fut)
        try:
            await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            pass
        finally:
            try:
                self._waiters.remove(fut)
            except ValueError:
                pass

    def _grace_expired(self):
        self._grace_handle = None
        if self.connected or self.done:
            return
        log.info(f"Grace period expired, cancelling agent task for session {self.session_id}")
        self.cancel()

    def _cancel_grace(self):
        if self._grace_handle:
            self._grace_handle.cancel()
            self._grace_handle = None

    def _notify(self):
        for fut in self._waiters:
            if not fut.done():
                fut.set_result(None)
        self._waiters.clear()


class SessionManager:
    def __init__(self, ttl: int = 600):
        self._sessions: dict[str, SessionState] = {}
        self._ttl = ttl

    def create(self) -> tuple[str, SessionState]:
        self._cleanup()
        session_id = uuid.uuid4().hex[:16]
        state = SessionState(session_id)
        self._sessions[session_id] = state
        log.info(f"Created session {session_id} (active={len(self._sessions)})")
        return session_id, state

    def get(self, session_id: str) -> Optional[SessionState]:
        self._cleanup()
        return self._sessions.get(session_id)

    def _cleanup(self):
        now = time.time()
        expired = [
            session_id
            for session_id, state in self._sessions.items()
            if state.done
            and state.finished_at is not None
            and now - state.finished_at > self._ttl
        ]
        for session_id in expired:
            del self._sessions[session_id]
        if expired:
            log.info(f"Cleaned up {len(expired)} expired sessions")


# Backward-compatible aliases while the rest of the code migrates.
StreamState = SessionState
StreamStore = SessionManager
