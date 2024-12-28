// dashboard.js
class Dashboard {
    constructor() {
        this.editor = null;
        this.llmSocket = null;
        this.executeSocket = null;
        this.isExecuting = false;
        this.interactiveMode = false;
        this.resourceCache = new Map();
        this.errorDecorations = [];

        // Ensure a container exists
        this.ensureDashboardContainer();

        this.dependencyManager = new DependencyManager(this);

        try {
            this.initializeWebSockets();
            this.initializeMonacoEditor();
            this.initializeUI();
            this.setupInteractiveHandlers();
            this.setupDependencyHandling();
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            this.showInitializationError(error);
        }
    }

    ensureDashboardContainer() {
        // Create a dashboard container if it doesn't exist
        if (!document.getElementById('dashboard')) {
            const dashboardContainer = document.createElement('div');
            dashboardContainer.id = 'dashboard';
            document.body.appendChild(dashboardContainer);
        }
    }

    showInitializationError(error) {
        // Create an error notification
        const errorContainer = document.createElement('div');
        errorContainer.className = 'notification error';
        errorContainer.innerHTML = `
            <h3>Dashboard Initialization Failed</h3>
            <p>${error.message}</p>
        `;
        document.body.appendChild(errorContainer);

        // Remove error after 5 seconds
        setTimeout(() => {
            document.body.removeChild(errorContainer);
        }, 5000);
    }

    setupDependencyHandling() {
        this.dependencyManager = new DependencyManager(this);
    }

    initializeWebSockets() {
        // LLM WebSocket
        this.llmSocket = new WebSocket(`ws://${window.location.host}/ws/llm`);
        this.llmSocket.onmessage = (event) => this.handleLLMMessage(JSON.parse(event.data));
        this.llmSocket.onopen = () => {
            this.updateStatus('LLM service connected', 'success');
            this.updateConnectionIndicator('llm', true);
        };
        this.llmSocket.onclose = (event) => {
            this.updateStatus('LLM service disconnected', 'error');
            this.updateConnectionIndicator('llm', false);
            console.error('LLM WebSocket closed unexpectedly:', event);
        };
        this.llmSocket.onerror = (event) => {
            console.error('LLM WebSocket error:', event);
        };

        // Execute WebSocket
        this.executeSocket = new WebSocket(`ws://${window.location.host}/ws/execute`);
        this.executeSocket.onmessage = (event) => this.handleExecuteMessage(JSON.parse(event.data));
        this.executeSocket.onopen = () => {
            this.updateStatus('Execute service connected', 'success');
            this.updateConnectionIndicator('execute', true);
        };
        this.executeSocket.onclose = () => {
            this.updateStatus('Execute service disconnected', 'error');
            this.updateConnectionIndicator('execute', false);
        };
    }

    async initializeMonacoEditor() {
        await new Promise(resolve => require(['vs/editor/editor.main'], resolve));

        this.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: '# Your code here\n',
            language: 'python',
            theme: 'vs-light',
            minimap: {enabled: true},
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            renderIndentGuides: true,
            folding: true,
            scrollbar: {
                vertical: 'visible',
                horizontal: 'visible'
            },
            suggest: {
                showKeywords: true,
                showSnippets: true,
                showClasses: true,
                showFunctions: true
            }
        });

        // Add error decoration support
        this.errorDecorations = [];
        this.editor.onDidChangeModelContent(() => {
            this.validateCode();
        });
    }

    initializeUI() {
        this.setupMainControls();
        this.setupOutputPanels();
        this.setupDebugControls();
        this.setupInteractiveUI();
        this.setupConnectionStatus();
        this.setupKeyboardShortcuts();
    }

    setupMainControls() {
        // Code Generation
        const generateButton = document.getElementById('generate-code-btn');
        const llmInput = document.getElementById('llm-input');
        if (generateButton && llmInput) {
            generateButton.onclick = () => {
                const prompt = llmInput.value.trim();
                if (prompt) {
                    this.generateCode(prompt);
                }
            };
            // Add enter key support for input
            llmInput.onkeypress = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    generateButton.click();
                }
            };
        }

        // Execute Code
        const executeButton = document.getElementById('execute-code-btn');
        if (executeButton) {
            executeButton.onclick = () => {
                if (!this.isExecuting) {
                    this.executeCode();
                }
            };
        }

        // Debug Code
        const debugButton = document.getElementById('debug-btn');
        if (debugButton) {
            debugButton.onclick = () => this.debugCode();
        }

        // Improve Code
        const improveButton = document.getElementById('improve-btn');
        if (improveButton) {
            improveButton.onclick = () => this.improveCode();
        }

        // Save Code
        const saveButton = document.getElementById('save-btn');
        if (saveButton) {
            saveButton.onclick = () => this.saveCode();
        }

        // Git Operations
        this.setupGitControls();
    }

    setupOutputPanels() {
        // Create output container if not exists
        if (!document.getElementById('output-container')) {
            const container = document.createElement('div');
            container.id = 'output-container';
            container.className = 'output-container';

            // Add panels
            ['execution-output', 'debug-output', 'interactive-output'].forEach(id => {
                const panel = document.createElement('div');
                panel.id = id;
                panel.className = 'output-panel';
                container.appendChild(panel);
            });

            // Find the most appropriate parent element
            const parentElement =
                document.getElementById('main-content') ||
                document.getElementById('dashboard') ||
                document.getElementById('editor-section') ||
                document.body;

            parentElement.appendChild(container);
        }
    }

    setupInteractiveUI() {
        const interactivePanel = document.createElement('div');
        interactivePanel.id = 'interactive-panel';
        interactivePanel.className = 'interactive-panel';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'interactive-input';
        input.placeholder = 'Enter input here...';
        input.style.display = 'none';

        interactivePanel.appendChild(input);
        document.getElementById('output-container').appendChild(interactivePanel);

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendInteractiveInput(input.value);
                input.value = '';
            }
        });
    }

    setupInteractiveHandlers() {
        this.interactiveInputHandler = async (prompt) => {
            const input = document.getElementById('interactive-input');
            input.style.display = 'block';
            input.placeholder = prompt;
            input.focus();

            return new Promise((resolve) => {
                this.resolveInput = resolve;
            });
        };
    }

    setupConnectionStatus() {
        const statusBar = document.createElement('div');
        statusBar.className = 'status-bar';
        statusBar.innerHTML = `
            <div class="connection-status">
                <span id="llm-status-indicator" class="status-indicator"></span>
                <span id="execute-status-indicator" class="status-indicator"></span>
            </div>
            <div class="execution-status"></div>
        `;
        document.body.appendChild(statusBar);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        this.executeCode();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveCode();
                        break;
                    case 'd':
                        e.preventDefault();
                        this.debugCode();
                        break;
                }
            }
        });
    }

    setupGitControls() {
        const commitButton = document.getElementById('git-commit-btn');
        const pushButton = document.getElementById('git-push-btn');
        const pullButton = document.getElementById('git-pull-btn');

        if (commitButton) {
            commitButton.onclick = () => this.gitCommit();
        }
        if (pushButton) {
            pushButton.onclick = () => this.gitPush();
        }
        if (pullButton) {
            pullButton.onclick = () => this.gitPull();
        }
    }

    setupDebugControls() {
        const breakpointButton = document.getElementById('add-breakpoint-btn');
        if (breakpointButton) {
            breakpointButton.onclick = () => this.addBreakpoint();
        }
    }

    generateCode(prompt) {
        if (this.llmSocket && this.llmSocket.readyState === WebSocket.OPEN) {
            this.llmSocket.send(JSON.stringify({
                type: 'generate_code',
                prompt: prompt
            }));
            this.updateStatus('Generating code...', 'info');
        } else {
            this.updateStatus('LLM service not connected', 'error');
            console.error('LLM WebSocket is not open for code generation.');
        }
    }

    executeCode() {
        if (this.isExecuting) return;

        const code = this.editor.getValue();
        if (this.executeSocket && this.executeSocket.readyState === WebSocket.OPEN) {
            this.isExecuting = true;
            this.executeSocket.send(JSON.stringify({
                type: 'execute_code',
                code: code
            }));
            this.updateStatus('Executing code...', 'info');
            this.showExecutionLoader();
        } else {
            this.updateStatus('Execute service not connected', 'error');
        }
    }

    debugCode() {
        const code = this.editor.getValue();
        if (this.executeSocket && this.executeSocket.readyState === WebSocket.OPEN) {
            this.executeSocket.send(JSON.stringify({
                type: 'debug_code',
                code: code
            }));
            this.updateStatus('Debugging code...', 'info');
        } else {
            this.updateStatus('Execute service not connected', 'error');
        }
    }

    improveCode() {
        const code = this.editor.getValue();
        if (this.llmSocket && this.llmSocket.readyState === WebSocket.OPEN) {
            this.llmSocket.send(JSON.stringify({
                type: 'improve_code',
                code: code
            }));
            this.updateStatus('Improving code...', 'info');
        } else {
            this.updateStatus('LLM service not connected', 'error');
        }
    }

    saveCode() {
        const code = this.editor.getValue();
        fetch('/save-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({code: code})
        })
            .then(response => response.json())
            .then(result => {
                this.updateStatus('Code saved successfully', 'success');
            })
            .catch(error => {
                this.updateStatus('Failed to save code', 'error');
                console.error('Save error:', error);
            });
    }

    gitCommit() {
        const commitMessage = prompt('Enter commit message:');
        if (commitMessage) {
            fetch('/git/commit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({message: commitMessage})
            })
                .then(response => response.json())
                .then(result => {
                    this.updateStatus('Commit successful', 'success');
                })
                .catch(error => {
                    this.updateStatus('Commit failed', 'error');
                    console.error('Git commit error:', error);
                });
        }
    }

    gitPush() {
        fetch('/git/push', {method: 'POST'})
            .then(response => response.json())
            .then(result => {
                this.updateStatus('Push successful', 'success');
            })
            .catch(error => {
                this.updateStatus('Push failed', 'error');
                console.error('Git push error:', error);
            });
    }

    gitPull() {
        fetch('/git/pull', {method: 'POST'})
            .then(response => response.json())
            .then(result => {
                this.updateStatus('Pull successful', 'success');
            })
            .catch(error => {
                this.updateStatus('Pull failed', 'error');
                console.error('Git pull error:', error);
            });
    }

    addBreakpoint() {
        const currentLineNumber = this.editor.getPosition().lineNumber;
        this.editor.deltaDecorations([], [{
            range: new monaco.Range(currentLineNumber, 1, currentLineNumber, 1),
            options: {
                isWholeLine: true,
                className: 'breakpoint-decoration',
                glyphMarginClassName: 'breakpoint-glyph'
            }
        }]);
    }

    handleLLMMessage(message) {
        switch (message.type) {
            case 'code_generated':
                this.editor.setValue(message.code);
                this.updateStatus('Code generated successfully', 'success');
                break;
            case 'code_improved':
                this.editor.setValue(message.code);
                this.updateStatus('Code improved successfully', 'success');
                break;
            case 'interactive_prompt':
                this.handleInteractivePrompt(message.prompt);
                break;
            default:
                console.log('Unhandled LLM message:', message);
        }
    }

    handleExecuteMessage(message) {
        const executionOutput = document.getElementById('execution-output');
        const debugOutput = document.getElementById('debug-output');

        switch (message.type) {
            case 'execution_result':
                this.isExecuting = false;
                this.hideExecutionLoader();

                // Update BOTH output panels
                executionOutput.innerHTML = `
                    <pre class="${message.success ? 'success-output' : 'error-output'}">
                        ${message.output}
                    </pre>
                `;
                this.updateInteractiveOutput(message.output);

                this.updateStatus(message.success ? 'Code executed successfully' : 'Code execution failed',
                    message.success ? 'success' : 'error');
                break;
            case 'resource_missing':
                this.handleResourceMissing(message.resource);
                break;
            case 'interactive_input_request':
                this.handleInteractiveInputRequest(message.content);
                break;
            default:
                console.log('Unhandled execute message:', message);
        }
    }

    updateInteractiveOutput(output) {
        const interactiveOutput = document.getElementById('interactive-output');
        if (interactiveOutput) {
            // Make sure the output is properly escaped for HTML
            const escapedOutput = output.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

            interactiveOutput.innerHTML += `<pre>${escapedOutput}</pre>`;
        }
    }

    handleResourceMissing(resource) {
        this.dependencyManager.resolveResourceMissing(resource);
    }

    handleInteractiveInputRequest(prompt) {
        this.interactiveInputHandler(prompt)
            .then(input => {
                // Send the input back to the server
                this.executeSocket.send(JSON.stringify({
                    type: 'input', // Use the correct message type for input
                    value: input
                }));
            });
    }

    handleInteractivePrompt(prompt) {
        this.interactiveInputHandler(prompt)
            .then(input => {
                this.executeSocket.send(JSON.stringify({
                    type: 'interactive_response',
                    input: input
                }));
            });
    }

    sendInteractiveInput(input) {
        if (this.resolveInput) {
            this.resolveInput(input);
            this.resolveInput = null;
            const interactiveInput = document.getElementById('interactive-input');
            interactiveInput.style.display = 'none';
        }
    }

    validateCode() {
        // Basic syntax validation 
        try {
            // Clear previous error decorations
            this.editor.deltaDecorations(this.errorDecorations, []);
            this.errorDecorations = [];

            const model = this.editor.getModel();
            const value = model.getValue();

            // Basic syntax check using Monaco's built-in markers
            monaco.editor.setModelMarkers(model, 'syntax', []);
        } catch (error) {
            console.error('Code validation error:', error);
        }
    }

    updateStatus(message, type = 'info') {
        const statusBar = document.querySelector('.execution-status');
        if (statusBar) {
            statusBar.textContent = message;
            statusBar.className = `execution-status ${type}-status`;
        }
    }

    updateConnectionIndicator(service, isConnected) {
        const indicator = document.getElementById(`${service}-status-indicator`);
        if (indicator) {
            indicator.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
            indicator.title = isConnected ? `${service} connected` : `${service} disconnected`;
        }
    }

    showExecutionLoader() {
        const executionOutput = document.getElementById('execution-output');
        if (executionOutput) {
            executionOutput.innerHTML = `
                <div class="loader-container">
                    <div class="loader"></div>
                    <p>Executing code...</p>
                </div>
            `;
        }
    }

    hideExecutionLoader() {
        const executionOutput = document.getElementById('execution-output');
        if (executionOutput) {
            executionOutput.innerHTML = '';
        }
    }
}

// Dependency Manager Class
class DependencyManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.resourceCache = new Map();
        this.packageCache = new Map();
    }

    resolveResourceMissing(resource) {
        // Handle different types of missing resources
        if (this.isImageResource(resource)) {
            this.handleMissingImage(resource);
        } else if (this.isPythonPackage(resource)) {
            this.handleMissingPackage(resource);
        } else {
            this.handleGenericResourceMissing(resource);
        }
    }

    isImageResource(resource) {
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp', '.webp'];
        return imageExtensions.some(ext => resource.toLowerCase().endsWith(ext));
    }

    isPythonPackage(resource) {
        // Check if resource looks like a Python package name
        return /^[a-zA-Z0-9_-]+$/.test(resource);
    }

    handleMissingImage(imagePath) {
        // Create a placeholder image or provide download instructions
        const placeholderImage = this.createPlaceholderImage(imagePath);

        // Show user notification
        this.showResourceResolutionModal({
            type: 'image',
            resource: imagePath,
            resolution: [
                {
                    label: 'Use Placeholder',
                    action: () => this.usePlaceholderImage(imagePath, placeholderImage)
                },
                {
                    label: 'Download Image',
                    action: () => this.downloadMissingResource(imagePath)
                }
            ]
        });
    }

    createPlaceholderImage(imagePath) {
        // Create a simple SVG placeholder
        const width = 300;
        const height = 200;
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <rect width="100%" height="100%" fill="#f0f0f0"/>
                <text x="50%" y="50%" font-family="Arial, sans-serif" 
                      font-size="18" fill="#888" text-anchor="middle" alignment-baseline="middle">
                    Missing: ${imagePath}
                </text>
            </svg>
        `;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    usePlaceholderImage(imagePath, placeholderImage) {
        // Cache the placeholder
        this.resourceCache.set(imagePath, placeholderImage);

        // Update UI or notify code execution to use placeholder
        this.dashboard.updateStatus(`Using placeholder for ${imagePath}`, 'warning');

        // Trigger code re-execution with placeholder
        this.dashboard.executeCode();
    }

    handleMissingPackage(packageName) {
        // Show installation instructions
        this.showResourceResolutionModal({
            type: 'package',
            resource: packageName,
            resolution: [
                {
                    label: 'Install with pip',
                    action: () => this.installPythonPackage(packageName)
                },
                {
                    label: 'View Installation Instructions',
                    action: () => this.showPackageInstallInstructions(packageName)
                }
            ]
        });
    }

    installPythonPackage(packageName) {
        // Send package install request via WebSocket
        this.dashboard.executeSocket.send(JSON.stringify({
            type: 'install_package',
            package: packageName
        }));

        this.dashboard.updateStatus(`Installing ${packageName}...`, 'info');
    }

    showPackageInstallInstructions(packageName) {
        const instructionModal = document.createElement('div');
        instructionModal.className = 'modal';
        instructionModal.innerHTML = `
            <div class="modal-content">
                <h2>Package Installation Instructions</h2>
                <p>To install ${packageName}, use one of these methods:</p>
                <code>pip install ${packageName}</code>
                <code>conda install ${packageName}</code>
                <button class="close-modal">Close</button>
            </div>
        `;

        document.body.appendChild(instructionModal);

        // Add close functionality
        instructionModal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(instructionModal);
        });
    }

    handleGenericResourceMissing(resource) {
        // Generic resource missing handler
        this.showResourceResolutionModal({
            type: 'generic',
            resource: resource,
            resolution: [
                {
                    label: 'Download Resource',
                    action: () => this.downloadMissingResource(resource)
                },
                {
                    label: 'Ignore',
                    action: () => {
                        this.dashboard.updateStatus(`Ignored missing resource: ${resource}`, 'warning');
                    }
                }
            ]
        });
    }

    downloadMissingResource(resource) {
        // Trigger resource download
        fetch('/download-resource', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({resource: resource})
        })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    this.dashboard.updateStatus(`Downloaded ${resource}`, 'success');
                    // Retry code execution
                    this.dashboard.executeCode();
                } else {
                    this.dashboard.updateStatus(`Failed to download ${resource}`, 'error');
                }
            })
            .catch(error => {
                console.error('Resource download error:', error);
                this.dashboard.updateStatus(`Download failed for ${resource}`, 'error');
            });
    }

    showResourceResolutionModal(options) {
        const modal = document.createElement('div');
        modal.className = 'resource-resolution-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Missing Resource: ${options.resource}</h2>
                <p>The ${options.type} resource is missing. How would you like to proceed?</p>
                <div class="modal-actions">
                    ${options.resolution.map((res, index) => `
                        <button class="resolution-action" data-index="${index}">
                            ${res.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners for resolution actions
        modal.querySelectorAll('.resolution-action').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = e.target.getAttribute('data-index');
                options.resolution[index].action();
                document.body.removeChild(modal);
            });
        });
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});
