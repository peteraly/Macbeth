from github import Github
from fastapi import FastAPI, WebSocket
import os
import base64
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GitHubIntegration:
    def __init__(self):
        self.github = Github(os.getenv("GITHUB_TOKEN"))
        self.repo_name = os.getenv("GITHUB_REPO")
        self.repo = self.github.get_repo(self.repo_name)
        
    async def get_file(self, path: str) -> dict:
        try:
            content = self.repo.get_contents(path)
            return {
                "content": base64.b64decode(content.content).decode(),
                "sha": content.sha
            }
        except Exception as e:
            logger.error(f"Error getting file: {str(e)}")
            raise

    async def save_file(self, path: str, content: str, message: str, sha: str = None) -> dict:
        try:
            if sha:
                # Update existing file
                response = self.repo.update_file(
                    path=path,
                    message=message,
                    content=content,
                    sha=sha
                )
            else:
                # Create new file
                response = self.repo.create_file(
                    path=path,
                    message=message,
                    content=content
                )
            return {"sha": response["content"].sha}
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise

    async def list_files(self, path: str = "") -> list:
        try:
            contents = self.repo.get_contents(path)
            return [{
                "name": item.name,
                "path": item.path,
                "type": "file" if item.type == "file" else "directory",
                "sha": item.sha
            } for item in contents]
        except Exception as e:
            logger.error(f"Error listing files: {str(e)}")
            raise

    async def delete_file(self, path: str, sha: str, message: str) -> bool:
        try:
            self.repo.delete_file(
                path=path,
                message=message,
                sha=sha
            )
            return True
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            raise

github = GitHubIntegration()

def setup_routes(app: FastAPI):
    @app.websocket("/ws/github")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        try:
            while True:
                data = await websocket.receive_json()
                try:
                    operation = data.get('operation')
                    if operation == 'list':
                        files = await github.list_files(data.get('path', ''))
                        await websocket.send_json({
                            "type": "files",
                            "content": files
                        })
                    elif operation == 'get':
                        file = await github.get_file(data.get('path'))
                        await websocket.send_json({
                            "type": "file",
                            "content": file
                        })
                    elif operation == 'save':
                        result = await github.save_file(
                            data.get('path'),
                            data.get('content'),
                            data.get('message', 'Update from dashboard'),
                            data.get('sha')
                        )
                        await websocket.send_json({
                            "type": "save",
                            "content": result
                        })
                    elif operation == 'delete':
                        result = await github.delete_file(
                            data.get('path'),
                            data.get('sha'),
                            data.get('message', 'Delete from dashboard')
                        )
                        await websocket.send_json({
                            "type": "delete",
                            "content": {"success": result}
                        })
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "content": str(e)
                    })
        except Exception as e:
            logger.error(f"WebSocket error: {str(e)}")
