import asyncio
import logging
import uuid
from typing import AsyncIterable, Callable, Optional, Type, TypeVar

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from stream_store import SessionManager, SessionState

RequestT = TypeVar("RequestT", bound=BaseModel)


async def run_events_to_session(
    session_id: str,
    state: SessionState,
    event_stream: AsyncIterable[dict],
    *,
    log: logging.Logger,
    error_event_factory: Callable[[str], dict],
    cancelled_event_factory: Optional[Callable[[], dict]] = None,
    drop_event_types: Optional[set[str]] = None,
):
    ignored_types = drop_event_types or {"ping"}
    try:
        async for event in event_stream:
            if event.get("type") in ignored_types:
                continue
            state.append(event)
            if event.get("type") == "done":
                state.mark_done()
                return
    except asyncio.CancelledError:
        if cancelled_event_factory is not None:
            state.append(cancelled_event_factory())
    except Exception as exc:
        log.error(f"[session] stream {session_id} error: {exc}")
        state.append(error_event_factory(str(exc)))
    if not state.done:
        state.append({"type": "done"})
        state.mark_done()


async def serve_resumable_websocket(
    websocket: WebSocket,
    *,
    session_manager: SessionManager,
    request_model: Type[RequestT],
    event_stream_factory: Callable[[RequestT], AsyncIterable[dict]],
    log: logging.Logger,
    stream_label: str,
    error_event_factory: Callable[[str], dict],
    cancelled_event_factory: Optional[Callable[[], dict]] = None,
    drop_event_types: Optional[set[str]] = None,
):
    await websocket.accept()
    session_id = None
    connection_id = uuid.uuid4().hex
    state = None

    try:
        payload = await websocket.receive_json()

        resume_id = payload.get("resume")
        after_seq = payload.get("afterSeq")
        if after_seq is None:
            after_seq = payload.get("lastIndex", 0)
        if not isinstance(after_seq, int) or after_seq < 0:
            after_seq = 0

        if resume_id:
            state = session_manager.get(resume_id)
            if not state:
                await websocket.send_json(error_event_factory("Stream expired or not found"))
                await websocket.send_json({"type": "done"})
                return
            session_id = resume_id
            after_seq = min(after_seq, state.next_seq - 1)
            log.info(f"[{stream_label}] Resuming stream {session_id} after seq {after_seq}")
        else:
            req = request_model(**payload)
            session_id, state = session_manager.create()
            state.task = asyncio.create_task(
                run_events_to_session(
                    session_id,
                    state,
                    event_stream_factory(req),
                    log=log,
                    error_event_factory=error_event_factory,
                    cancelled_event_factory=cancelled_event_factory,
                    drop_event_types=drop_event_types,
                ),
            )
            log.info(f"[{stream_label}] New stream {session_id}")

        state.attach(connection_id)
        await websocket.send_json(
            {
                "type": "stream_id",
                "streamId": session_id,
                "nextSeq": state.next_seq,
            },
        )

        while True:
            if not state.owns_connection(connection_id):
                log.info(f"[{stream_label}] Connection superseded for stream {session_id}")
                try:
                    await websocket.close(code=4001, reason="superseded")
                except Exception:
                    pass
                break

            for event in state.replay_after(after_seq):
                await websocket.send_json(event)
                after_seq = event["seq"]

            if state.done:
                log.info(f"[{stream_label}] Stream {session_id} done at seq {after_seq}")
                break

            await state.wait_for_new(timeout=5)

            if not state.owns_connection(connection_id):
                log.info(
                    f"[{stream_label}] Connection superseded during wait for stream {session_id}",
                )
                try:
                    await websocket.close(code=4001, reason="superseded")
                except Exception:
                    pass
                break

            if state.next_seq == after_seq + 1 and not state.done:
                await websocket.send_json({"type": "ping"})

    except WebSocketDisconnect:
        log.info(f"[{stream_label}] WS disconnected for stream {session_id}")
    except Exception as exc:
        log.error(f"[{stream_label}] WS error: {exc}")
        try:
            await websocket.send_json(error_event_factory(str(exc)))
        except Exception:
            pass
    finally:
        if state is not None:
            state.detach(connection_id)
        try:
            await websocket.close()
        except Exception:
            pass
