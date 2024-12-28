from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from fastapi import FastAPI, WebSocket
import asyncio
import os
import json
import logging
from typing import Dict, Set
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CodeChangeHandler(FileSystemEventHandler):
    def __init__(self, live_updates):
        self.live_updates = live_updates
        self.last_event_time = {}
        self.debounce_seconds = 1.0
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

    def on_modified(self, event):
        if event.is_directory:
            return
        
        current_time = datetime.now()
        last_time = self.last_event_time.get(event.src_path)
        
        if last_time is None or (current_time - last_time).total_seconds() > self.debounce_seconds:
            self.last_event_time[event.src_path] = current_time
            if event.src_path.endswith(('.py', '.js', '.html', '.css')):
                asyncio.run_coroutine_threadsafe(
                    self.live_updates.broadcast_change({
                        'type': 'file_changed',
                        'path': event.src_path,
                        'timestamp': current_time.isoformat()
                    }),
                    self.loop
                )

class LiveUpdates:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.connection_counter = 0
        self.watched_paths: Set[str] = set()
        self.observer = Observer()
        self.event_handler = CodeChangeHandler(self)
        
    def start_watching(self, path: str):
        if path not in self.watched_paths:
            self.observer.schedule(self.event_handler, path, recursive=True)
            self.watched_paths.add(path)
            if not self.observer.is_alive():
                self.observer.start()
                logger.info(f"Started watching directory: {path}")

    async def connect(self, websocket: WebSocket) -> int:
        await websocket.accept()
        self.connection_counter += 1
        self.active_connections[self.connection_counter] = websocket
        return self.connection_counter

    def disconnect(self, connection_id: int):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]

    async def broadcast_change(self, data: dict):
        disconnected = []
        for connection_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(data)
            except Exception as e:
                logger.error(f"Error sending to websocket {connection_id}: {e}")
                disconnected.append(connection_id)
        
        for connection_id in disconnected:
            self.disconnect(connection_id)

# Initialize live updates
live_updates = LiveUpdates()

def setup_routes(app: FastAPI):
    @app.websocket("/ws/updates")
    async def websocket_endpoint(websocket: WebSocket):
        connection_id = await live_updates.connect(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                await websocket.send_json({"status": "received"})
        except Exception as e:
            logger.error(f"WebSocket error: {str(e)}")
        finally:
            live_updates.disconnect(connection_id)
