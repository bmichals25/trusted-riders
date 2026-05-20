from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from queue import Queue
from threading import RLock
from typing import Any

ALLOWED_SENDERS = {"driver", "dispatch", "admin", "system"}


class ChatValidationError(ValueError):
    pass


@dataclass
class ChatRoom:
    ride_id: str
    created_at: str
    updated_at: str
    messages: list[dict[str, Any]] = field(default_factory=list)
    typing: dict[str, dict[str, Any]] = field(default_factory=dict)
    read_receipts: dict[str, dict[str, Any]] = field(default_factory=dict)


class InMemoryChatStore:
    def __init__(self, storage_path: str | None = None) -> None:
        self._rooms: dict[str, ChatRoom] = {}
        self._subscribers: dict[str, list[Queue]] = {}
        self._lock = RLock()
        self._storage_path = Path(storage_path) if storage_path else None
        self._load()

    def room_count(self) -> int:
        with self._lock:
            return len(self._rooms)

    def message_count(self) -> int:
        with self._lock:
            return sum(len(room.messages) for room in self._rooms.values())

    def list_rooms(self) -> list[dict[str, Any]]:
        with self._lock:
            return [
                {
                    "ride_id": room.ride_id,
                    "created_at": room.created_at,
                    "updated_at": room.updated_at,
                    "message_count": len(room.messages),
                    "last_message": room.messages[-1] if room.messages else None,
                }
                for room in sorted(
                    self._rooms.values(), key=lambda item: item.updated_at, reverse=True
                )
            ]

    def list_messages(
        self, ride_id: str, after_id: str | None = None, limit: int = 100
    ) -> list[dict[str, Any]]:
        with self._lock:
            room = self._rooms.get(ride_id)
            if room is None:
                return []

            messages = room.messages
            if after_id:
                try:
                    start_index = next(
                        index for index, message in enumerate(messages) if message["id"] == after_id
                    ) + 1
                    messages = messages[start_index:]
                except StopIteration:
                    messages = []

            return [dict(message) for message in messages[-limit:]]

    def create_message(
        self,
        *,
        ride_id: str,
        text: Any,
        sender: Any,
        sender_name: Any = None,
        client_message_id: Any = None,
        metadata: Any = None,
    ) -> dict[str, Any]:
        ride_id = self._clean_text(ride_id)
        text = self._clean_text(text)
        sender = self._clean_text(sender)
        sender_name = self._clean_text(sender_name) if sender_name is not None else None
        client_message_id = (
            self._clean_text(client_message_id) if client_message_id is not None else None
        )

        if not ride_id:
            raise ChatValidationError("ride_id is required")
        if not text:
            raise ChatValidationError("text is required")
        if sender not in ALLOWED_SENDERS:
            allowed = ", ".join(sorted(ALLOWED_SENDERS))
            raise ChatValidationError(f"sender must be one of: {allowed}")
        if metadata is not None and not isinstance(metadata, dict):
            raise ChatValidationError("metadata must be an object when provided")

        timestamp = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        message = {
            "id": uuid.uuid4().hex,
            "ride_id": ride_id,
            "text": text,
            "sender": sender,
            "sender_name": sender_name,
            "client_message_id": client_message_id,
            "metadata": metadata or {},
            "created_at": timestamp,
        }

        with self._lock:
            room = self._rooms.get(ride_id)
            if room is None:
                room = ChatRoom(ride_id=ride_id, created_at=timestamp, updated_at=timestamp)
                self._rooms[ride_id] = room

            room.messages.append(message)
            room.updated_at = timestamp
            subscribers = list(self._subscribers.get(ride_id, []))
            self._save_locked()

        for subscriber in subscribers:
            subscriber.put(dict(message))

        return dict(message)

    def set_typing(
        self,
        *,
        ride_id: str,
        sender: Any,
        sender_name: Any = None,
        is_typing: Any = True,
    ) -> dict[str, Any]:
        ride_id = self._clean_text(ride_id)
        sender = self._clean_text(sender)
        sender_name = self._clean_text(sender_name) if sender_name is not None else None
        typing = bool(is_typing)

        if not ride_id:
            raise ChatValidationError("ride_id is required")
        if sender not in ALLOWED_SENDERS:
            allowed = ", ".join(sorted(ALLOWED_SENDERS))
            raise ChatValidationError(f"sender must be one of: {allowed}")

        now_ms = self._now_ms()
        expires_at_ms = now_ms + 5000
        with self._lock:
            room = self._get_or_create_room(ride_id)
            if typing:
                room.typing[sender] = {
                    "sender": sender,
                    "sender_name": sender_name,
                    "is_typing": True,
                    "updated_at": self._iso_now(),
                    "expires_at_ms": expires_at_ms,
                }
            else:
                room.typing.pop(sender, None)
            return self.get_status(ride_id)

    def mark_read(
        self,
        *,
        ride_id: str,
        sender: Any,
        sender_name: Any = None,
        last_read_message_id: Any = None,
    ) -> dict[str, Any]:
        ride_id = self._clean_text(ride_id)
        sender = self._clean_text(sender)
        sender_name = self._clean_text(sender_name) if sender_name is not None else None
        last_read_message_id = (
            self._clean_text(last_read_message_id) if last_read_message_id is not None else None
        )

        if not ride_id:
            raise ChatValidationError("ride_id is required")
        if sender not in ALLOWED_SENDERS:
            allowed = ", ".join(sorted(ALLOWED_SENDERS))
            raise ChatValidationError(f"sender must be one of: {allowed}")

        with self._lock:
            room = self._get_or_create_room(ride_id)
            if last_read_message_id is None and room.messages:
                last_read_message_id = room.messages[-1]["id"]
            room.read_receipts[sender] = {
                "sender": sender,
                "sender_name": sender_name,
                "last_read_message_id": last_read_message_id,
                "read_at": self._iso_now(),
            }
            self._save_locked()

        return self.get_status(ride_id)

    def get_status(self, ride_id: str) -> dict[str, Any]:
        now_ms = self._now_ms()
        with self._lock:
            room = self._rooms.get(ride_id)
            if room is None:
                return {
                    "ride_id": ride_id,
                    "typing": [],
                    "read_receipts": {},
                }

            expired = [
                sender
                for sender, state in room.typing.items()
                if int(state.get("expires_at_ms", 0)) <= now_ms
            ]
            for sender in expired:
                room.typing.pop(sender, None)

            return {
                "ride_id": ride_id,
                "typing": [dict(state) for state in room.typing.values()],
                "read_receipts": {
                    sender: dict(receipt)
                    for sender, receipt in room.read_receipts.items()
                },
            }

    def subscribe(self, ride_id: str) -> Queue:
        subscriber: Queue = Queue()
        with self._lock:
            self._subscribers.setdefault(ride_id, []).append(subscriber)
        return subscriber

    def unsubscribe(self, ride_id: str, subscriber: Queue) -> None:
        with self._lock:
            subscribers = self._subscribers.get(ride_id)
            if not subscribers:
                return
            if subscriber in subscribers:
                subscribers.remove(subscriber)
            if not subscribers:
                self._subscribers.pop(ride_id, None)

    def _get_or_create_room(self, ride_id: str) -> ChatRoom:
        room = self._rooms.get(ride_id)
        if room is not None:
            return room
        timestamp = self._iso_now()
        room = ChatRoom(ride_id=ride_id, created_at=timestamp, updated_at=timestamp)
        self._rooms[ride_id] = room
        return room

    def _load(self) -> None:
        if not self._storage_path or not self._storage_path.exists():
            return

        try:
            raw = json.loads(self._storage_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return

        rooms = raw.get("rooms", {})
        if not isinstance(rooms, dict):
            return

        with self._lock:
            for ride_id, room_data in rooms.items():
                if not isinstance(room_data, dict):
                    continue
                ride_id = self._clean_text(room_data.get("ride_id") or ride_id)
                if not ride_id:
                    continue
                created_at = self._clean_text(room_data.get("created_at")) or self._iso_now()
                updated_at = self._clean_text(room_data.get("updated_at")) or created_at
                messages = room_data.get("messages")
                read_receipts = room_data.get("read_receipts")
                self._rooms[ride_id] = ChatRoom(
                    ride_id=ride_id,
                    created_at=created_at,
                    updated_at=updated_at,
                    messages=messages if isinstance(messages, list) else [],
                    read_receipts=read_receipts if isinstance(read_receipts, dict) else {},
                )

    def _save_locked(self) -> None:
        if not self._storage_path:
            return

        payload = {
            "rooms": {
                ride_id: {
                    "ride_id": room.ride_id,
                    "created_at": room.created_at,
                    "updated_at": room.updated_at,
                    "messages": room.messages,
                    "read_receipts": room.read_receipts,
                }
                for ride_id, room in self._rooms.items()
            }
        }

        try:
            self._storage_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = self._storage_path.with_suffix(f"{self._storage_path.suffix}.tmp")
            tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
            tmp_path.replace(self._storage_path)
        except OSError:
            # Dev-only persistence should never break chat delivery.
            return

    @staticmethod
    def _iso_now() -> str:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _now_ms() -> int:
        return int(datetime.now(UTC).timestamp() * 1000)

    @staticmethod
    def _clean_text(value: Any) -> str:
        return str(value or "").strip()
