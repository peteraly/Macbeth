from fastapi import WebSocket, WebSocketDisconnect
from anthropic import AsyncAnthropic
import os
import logging
from code_executor import code_executor  # Import the code_executor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMIntegration:
    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            logger.error("ANTHROPIC_API_KEY not found in environment variables")
            self.anthropic = None
        else:
            self.anthropic = AsyncAnthropic(api_key=self.api_key)
        self.connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections.append(websocket)
        logger.info("New LLM WebSocket connection established")

    async def disconnect(self, websocket: WebSocket):
        self.connections.remove(websocket)
        logger.info("LLM WebSocket disconnected")

    async def generate_code(self, prompt: str) -> str: 
        try:
            if not self.anthropic:
                raise ValueError("Anthropic client not initialized")
            response = await self.anthropic.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=1024,
                temperature=0.7,
                messages=[{
                    "role": "user",
                    "content": f"Generate Python code for: {prompt}. Code should be complete, runnable, and include example usage."
                }]
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Error in code generation: {str(e)}")
            raise

llm = LLMIntegration() 

async def websocket_endpoint(websocket: WebSocket):
    await llm.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get('type') == 'generate_code':
                prompt = data.get('prompt', '')
                
                # Generate code
                code = await llm.generate_code(prompt)  
                
                # Send the generated code back to the frontend
                await websocket.send_json({
                    "type": "code_generated",  
                    "code": code
                })
                
                # Trigger code execution on the backend
                await code_executor.execute_code(websocket, code)  

    except WebSocketDisconnect:
        await llm.disconnect(websocket)  
    except Exception as e:
        logger.error(f"LLM WebSocket error: {str(e)}")
        await websocket.send_json({
            "type": "error",
            "error": str(e)
        })