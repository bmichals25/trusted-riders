from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS

os.environ.setdefault(
    "TR_CHAT_STORE_PATH",
    str(Path(__file__).resolve().with_name("chat_store.json")),
)

from trustedriders_chat import chat_bp, chat_store


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})
    app.register_blueprint(chat_bp)

    @app.get("/")
    def index():
        return jsonify(
            {
                "status": "ok",
                "service": "trustedriders-temp-chat",
                "health": "/health",
                "messages": "/api/chat/rides/<ride_id>/messages",
                "stream": "/api/chat/rides/<ride_id>/stream",
            }
        )

    @app.get("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "service": "trustedriders-temp-chat",
                "rooms": chat_store.room_count(),
                "messages": chat_store.message_count(),
            }
        )

    return app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5055"))
    create_app().run(host="0.0.0.0", port=port, debug=False, threaded=True)
