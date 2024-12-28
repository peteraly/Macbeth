from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import traceback
from io import StringIO
import sys
import contextlib
import logging
import time
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class InteractiveBuffer:
    def __init__(self, websocket):
        self.websocket = websocket
        self.buffer = StringIO()

    async def write(self, text):
        self.buffer.write(text)
        # Send real-time output to the dashboard
        await self.websocket.send_json({
            "type": "interactive_output",
            "content": text
        })

    def flush(self):
        self.buffer.flush()

    def getvalue(self):
        return self.buffer.getvalue()


class CodeExecutor:
    def __init__(self):
        self.output_buffer = StringIO()
        self.interactive_mode = False
        self.current_websocket = None
        self.running_tasks = {}

    @contextlib.contextmanager
    def capture_output(self, websocket=None):
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        if websocket and self.interactive_mode:
            interactive_buffer = InteractiveBuffer(websocket)
            sys.stdout = sys.stderr = interactive_buffer
        else:
            sys.stdout = sys.stderr = self.output_buffer
        try:
            yield
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

    def extract_python_code(self, content: str) -> str:
        """Extract and clean Python code from various formats."""
        # Remove markdown code block syntax
        code = re.sub(r'```python\n', '', content)
        code = re.sub(r'```\n?', '', code)

        # Fix indentation
        lines = code.split('\n')
        cleaned_lines = []
        base_indent = None

        for line in lines:
            if line.strip():
                # Detect base indentation from first non-empty line
                current_indent = len(line) - len(line.lstrip())
                if base_indent is None:
                    base_indent = current_indent

                # Remove base indentation from all lines
                if current_indent >= base_indent:
                    cleaned_lines.append(line[base_indent:])
                else:
                    cleaned_lines.append(line)
            else:
                cleaned_lines.append(line)

        return '\n'.join(cleaned_lines)

    def wrap_interactive_code(self, code: str) -> str:
        """Wrap code to handle interactive features within the dashboard."""
        wrapped_code = f"""
import asyncio
from contextlib import contextmanager

class DashboardIO:
    def __init__(self, websocket):
        self.websocket = websocket
        self.input_buffer = asyncio.Queue()
        self.output_buffer = []

    async def ainput(self, prompt=''):
        # Send prompt to the dashboard
        await self.websocket.send_json({{
            "type": "interactive_input_request",
            "content": prompt
        }})
        # Wait for input from the dashboard
        data = await self.websocket.receive_json()
        return data.get('value', '')

    async def print(self, *args, **kwargs):
        output = ' '.join(str(arg) for arg in args)
        self.output_buffer.append(output)

        # Send output to the dashboard
        await self.websocket.send_json({{
            "type": "interactive_output",
            "content": output + kwargs.get('end', '\\n')
        }})

dashboard_io = DashboardIO(websocket)  # Pass websocket to DashboardIO

async def run_interactive():
    try:
{self.indent_code(code, 8)}
    except Exception as e:
        await dashboard_io.print(f"Error: {{str(e)}}")

# Create event loop and run the code
asyncio.run(run_interactive())
"""
        return wrapped_code

    def indent_code(self, code: str, spaces: int) -> str:
        """Indent code by specified number of spaces."""
        return '\n'.join(' ' * spaces + line if line.strip() else line
                         for line in code.split('\n'))

    async def execute_code(self, websocket: WebSocket, code: str) -> dict:
        """Execute code with interactive support."""
        self.output_buffer = StringIO()
        self.current_websocket = websocket
        start_time = time.time()

        try:
            # Clean and prepare code
            cleaned_code = self.extract_python_code(code)

            # Check for syntax errors
            try:
                compile(cleaned_code, '<string>', 'exec')
            except SyntaxError as e:
                return {
                    "status": "error",
                    "error": f"Syntax Error: {str(e)}",
                    "line": e.lineno,
                    "suggestion": self.get_error_suggestion(e)
                }

            # Detect if code is interactive
            self.interactive_mode = 'input(' in cleaned_code or 'while True' in cleaned_code

            if self.interactive_mode:
                wrapped_code = self.wrap_interactive_code(cleaned_code)
            else:
                wrapped_code = cleaned_code

            # Execute the code
            local_vars = {}
            with self.capture_output(websocket):
                if self.interactive_mode:
                    exec(wrapped_code, {
                        "print": print,
                        "websocket": websocket
                    }, local_vars)
                else:
                    # If the code is NOT a single expression, use exec()
                    if cleaned_code.endswith('\n'):  
                        exec(wrapped_code, {
                            "print": print,
                            "websocket": websocket
                        }, local_vars)
                    else:
                        result = eval(cleaned_code, {}, local_vars)
                        print(result)  # Print the result of the expression

            execution_time = time.time() - start_time
            output = self.output_buffer.getvalue()

            # Send an execution complete message (only if websocket is available)
            if websocket:
                await websocket.send_json({
                    "type": "execution_result",
                    "output": output,
                    "execution_time": f"{execution_time:.3f}s",
                    "success": True
                })

            return {
                "status": "success",
                "output": output,
                "execution_time": f"{execution_time:.3f}s",
                "interactive": self.interactive_mode,
                "variables": {
                    k: str(v)
                    for k, v in local_vars.items() if not k.startswith('_')
                }
            }

        except Exception as e:
            return {
                "status": "error",
                "error_type": type(e).__name__,
                "error": str(e),
                "traceback": traceback.format_exc(),
                "suggestion": self.get_error_suggestion(e)
            }
        finally:
            self.current_websocket = None
            self.interactive_mode = False

    def get_error_suggestion(self, error: Exception) -> str:
        """Generate helpful suggestions for common errors."""
        error_str = str(error)

        suggestions = {
            "NameError": "Make sure all variables are defined before use. Check for typos in variable names.",
            "TypeError": "Check that you're using compatible types and correct number of arguments.",
            "IndentationError": "Fix the indentation of your code. Use consistent spaces or tabs.",
            "SyntaxError": "Check for missing colons, parentheses, or quotes.",
            "ZeroDivisionError": "Avoid dividing by zero. Add a check for zero before division.",
            "IndexError": "Make sure you're not trying to access list indices that don't exist.",
            "KeyError": "Verify that the dictionary key exists before accessing it.",
            "AttributeError": "Check that the object has the attribute or method you're trying to use.",
            "ImportError": "Ensure the module is installed and imported correctly."
        }

        error_type = type(error).__name__
        base_suggestion = suggestions.get(
            error_type, "Review the error message and check your code logic.")

        return f"{base_suggestion}\nError details: {error_str}"


code_executor = CodeExecutor()


async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("New execution WebSocket connection established")
    try:
        while True:
            data = await websocket.receive_json()
            code = data.get('code', '')

            if data.get('type') == 'input':
                # Handle interactive input
                if code_executor.current_websocket and code_executor.interactive_mode:
                    await code_executor.current_websocket.send_json({
                        "type": "interactive_input",
                        "value": data.get('value', '')
                    })
            else:
                # Execute code
                result = await code_executor.execute_code(websocket, code)
                await websocket.send_json(result)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.send_json({
            "type": "error",
            "error": str(e)
        })