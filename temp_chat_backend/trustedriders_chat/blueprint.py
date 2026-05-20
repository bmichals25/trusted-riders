from __future__ import annotations

import json
import time
from queue import Empty

from flask import Blueprint, Response, jsonify, request, stream_with_context

from .store import ChatValidationError

chat_bp = Blueprint("trustedriders_chat", __name__, url_prefix="/api/chat")


def _store():
    # Import lazily so Suresh can replace trustedriders_chat.chat_store before
    # registering the blueprint if he wants to plug in database storage.
    from . import chat_store

    return chat_store


@chat_bp.get("/rooms")
def list_rooms():
    return jsonify({"rooms": _store().list_rooms()})


@chat_bp.get("/rides/<ride_id>/messages")
def list_messages(ride_id: str):
    after_id = request.args.get("after_id")
    limit_raw = request.args.get("limit", "100")
    try:
        limit = max(1, min(int(limit_raw), 500))
    except ValueError:
        limit = 100

    return jsonify(
        {
            "ride_id": ride_id,
            "messages": _store().list_messages(ride_id, after_id=after_id, limit=limit),
        }
    )


@chat_bp.get("/rides/<ride_id>/status")
def get_chat_status(ride_id: str):
    return jsonify(_store().get_status(ride_id))


@chat_bp.post("/rides/<ride_id>/messages")
def create_message(ride_id: str):
    payload = request.get_json(silent=True) or {}

    try:
        message = _store().create_message(
            ride_id=ride_id,
            text=payload.get("text"),
            sender=payload.get("sender"),
            sender_name=payload.get("sender_name"),
            client_message_id=payload.get("client_message_id"),
            metadata=payload.get("metadata"),
        )
    except ChatValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"message": message}), 201


@chat_bp.post("/rides/<ride_id>/typing")
def set_typing(ride_id: str):
    payload = request.get_json(silent=True) or {}

    try:
        status = _store().set_typing(
            ride_id=ride_id,
            sender=payload.get("sender"),
            sender_name=payload.get("sender_name"),
            is_typing=payload.get("is_typing", True),
        )
    except ChatValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(status)


@chat_bp.post("/rides/<ride_id>/read")
def mark_read(ride_id: str):
    payload = request.get_json(silent=True) or {}

    try:
        status = _store().mark_read(
            ride_id=ride_id,
            sender=payload.get("sender"),
            sender_name=payload.get("sender_name"),
            last_read_message_id=payload.get("last_read_message_id"),
        )
    except ChatValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(status)


@chat_bp.get("/rides/<ride_id>/stream")
def stream_messages(ride_id: str):
    subscriber = _store().subscribe(ride_id)

    def events():
        yield "event: ready\ndata: {}\n\n"
        try:
            while True:
                try:
                    message = subscriber.get(timeout=15)
                except Empty:
                    yield "event: ping\ndata: {}\n\n"
                    continue

                yield f"event: message\ndata: {json.dumps(message)}\n\n"
        finally:
            _store().unsubscribe(ride_id, subscriber)

    return Response(
        stream_with_context(events()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@chat_bp.get("/demo")
def demo_contract():
    now_ms = int(time.time() * 1000)
    return jsonify(
        {
            "send_message": {
                "method": "POST",
                "path": "/api/chat/rides/ride-123/messages",
                "body": {
                    "text": "Hello from dispatch",
                    "sender": "dispatch",
                    "sender_name": "Dispatcher",
                    "client_message_id": f"dispatch-{now_ms}",
                },
            },
            "load_messages": {
                "method": "GET",
                "path": "/api/chat/rides/ride-123/messages",
            },
            "chat_status": {
                "method": "GET",
                "path": "/api/chat/rides/ride-123/status",
            },
            "typing": {
                "method": "POST",
                "path": "/api/chat/rides/ride-123/typing",
                "body": {
                    "sender": "dispatch",
                    "sender_name": "Dispatcher",
                    "is_typing": True,
                },
            },
            "read_receipt": {
                "method": "POST",
                "path": "/api/chat/rides/ride-123/read",
                "body": {
                    "sender": "dispatch",
                    "sender_name": "Dispatcher",
                    "last_read_message_id": "message-id",
                },
            },
            "stream_messages": {
                "method": "GET",
                "path": "/api/chat/rides/ride-123/stream",
                "protocol": "server-sent-events",
            },
        }
    )
