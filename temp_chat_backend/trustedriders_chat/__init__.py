import os

from .blueprint import chat_bp
from .store import InMemoryChatStore

chat_store = InMemoryChatStore(os.environ.get("TR_CHAT_STORE_PATH"))

__all__ = ["InMemoryChatStore", "chat_bp", "chat_store"]
