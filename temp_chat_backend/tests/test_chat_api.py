from server import create_app
from trustedriders_chat import chat_store
from trustedriders_chat.store import InMemoryChatStore


def setup_function():
    chat_store._rooms.clear()
    chat_store._subscribers.clear()


def test_create_and_list_message():
    client = create_app().test_client()

    response = client.post(
        "/api/chat/rides/ride-123/messages",
        json={"text": "Hello", "sender": "dispatch", "sender_name": "Ops"},
    )

    assert response.status_code == 201
    message = response.get_json()["message"]
    assert message["ride_id"] == "ride-123"
    assert message["text"] == "Hello"
    assert message["sender"] == "dispatch"

    response = client.get("/api/chat/rides/ride-123/messages")

    assert response.status_code == 200
    assert response.get_json()["messages"] == [message]


def test_after_id_filters_older_messages():
    client = create_app().test_client()
    first = client.post(
        "/api/chat/rides/ride-123/messages",
        json={"text": "First", "sender": "driver"},
    ).get_json()["message"]
    second = client.post(
        "/api/chat/rides/ride-123/messages",
        json={"text": "Second", "sender": "dispatch"},
    ).get_json()["message"]

    response = client.get(f"/api/chat/rides/ride-123/messages?after_id={first['id']}")

    assert response.status_code == 200
    assert response.get_json()["messages"] == [second]


def test_rejects_invalid_sender():
    client = create_app().test_client()

    response = client.post(
        "/api/chat/rides/ride-123/messages",
        json={"text": "Hello", "sender": "rider"},
    )

    assert response.status_code == 400
    assert "sender must be one of" in response.get_json()["error"]


def test_messages_persist_to_disk(tmp_path):
    store_path = tmp_path / "chat_store.json"
    store = InMemoryChatStore(str(store_path))
    message = store.create_message(
        ride_id="ride-123",
        text="Persistent hello",
        sender="driver",
    )

    restored = InMemoryChatStore(str(store_path))

    assert restored.list_messages("ride-123") == [message]
