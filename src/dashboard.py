from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

# Import websocket_endpoint directly
from llm_integration import websocket_endpoint as llm_websocket_endpoint 
from code_executor import websocket_endpoint as executor_websocket_endpoint

# Load environment variables
load_dotenv(os.path.join("config", ".env"))

app = FastAPI(title="Development Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

# Use websocket_endpoint in your router
app.websocket("/ws/llm")(llm_websocket_endpoint)  
app.websocket("/ws/execute")(executor_websocket_endpoint)

@app.get("/", response_class=HTMLResponse)
async def get_index():
    with open("static/index.html") as f:
        return f.read()

if __name__ == "__main__":
    uvicorn.run("dashboard:app", host="0.0.0.0", port=8000, reload=True)