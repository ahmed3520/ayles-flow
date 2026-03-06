import time
import unittest

from stream_store import SessionManager, SessionState


class SessionManagerTest(unittest.TestCase):
    def test_append_assigns_monotonic_sequence_numbers(self):
        state = SessionState("session-1")

        first = state.append({"type": "text_delta", "content": "a"})
        second = state.append({"type": "text_delta", "content": "b"})

        self.assertEqual(first["seq"], 1)
        self.assertEqual(second["seq"], 2)
        self.assertEqual(state.next_seq, 3)

    def test_replay_after_returns_only_newer_events(self):
        state = SessionState("session-1")
        state.append({"type": "text_delta", "content": "a"})
        state.append({"type": "text_delta", "content": "b"})
        state.append({"type": "done"})

        replay = state.replay_after(1)

        self.assertEqual([event["seq"] for event in replay], [2, 3])

    def test_stale_disconnect_does_not_drop_new_connection(self):
        state = SessionState("session-1")

        state.attach("conn-old")
        state.attach("conn-new")
        state.detach("conn-old")

        self.assertTrue(state.connected)
        self.assertTrue(state.owns_connection("conn-new"))

    def test_cleanup_uses_finished_time(self):
        manager = SessionManager(ttl=1)
        session_id, state = manager.create()
        state.mark_done()
        state.finished_at = time.time() - 10

        self.assertIsNone(manager.get(session_id))


if __name__ == "__main__":
    unittest.main()
