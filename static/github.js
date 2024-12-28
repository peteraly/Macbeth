class GitHubManager {
    constructor() {
        this.ws = null;
        this.currentFile = null;
        this.files = [];
        this.initializeWebSocket();
    }

    initializeWebSocket() {
        this.ws = new WebSocket(`ws://${window.location.host}/ws/github`);
        this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
        this.ws.onopen = () => this.loadFiles();
    }

    async loadFiles(path = "") {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                operation: 'list',
                path: path
            }));
        }
    }

    async getFile(path) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                operation: 'get',
                path: path
            }));
        }
    }

    async saveFile(path, content, message = "", sha = null) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                operation: 'save',
                path: path,
                content: content,
                message: message,
                sha: sha
            }));
        }
    }

    async deleteFile(path, sha, message = "") {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                operation: 'delete',
                path: path,
                sha: sha,
                message: message
            }));
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'files':
                this.updateFileTree(data.content);
                break;
            case 'file':
                this.loadFileContent(data.content);
                break;
            case 'save':
                this.handleSaveResponse(data.content);
                break;
            case 'delete':
                this.handleDeleteResponse(data.content);
                break;
            case 'error':
                this.handleError(data.content);
                break;
        }
    }

    updateFileTree(files) {
        this.files = files;
        const fileTree = document.getElementById('file-tree');
        fileTree.innerHTML = '';
        
        files.forEach(file => {
            const fileElement = document.createElement('div');
            fileElement.className = `file-item ${file.type}`;
            fileElement.innerHTML = `
                <span class="file-icon">${file.type === 'directory' ? '📁' : '📄'}</span>
                <span class="file-name">${file.name}</span>
            `;
            fileElement.onclick = () => {
                if (file.type === 'file') {
                    this.getFile(file.path);
                } else {
                    this.loadFiles(file.path);
                }
            };
            fileTree.appendChild(fileElement);
        });
    }

    loadFileContent(fileData) {
        this.currentFile = fileData;
        window.dashboard.editor.setValue(fileData.content);
        document.querySelector('.current-file').textContent = this.currentFile.path;
    }

    handleSaveResponse(response) {
        if (this.currentFile) {
            this.currentFile.sha = response.sha;
        }
        this.showNotification('File saved successfully!', 'success');
    }

    handleDeleteResponse(response) {
        if (response.success) {
            this.loadFiles();
            this.showNotification('File deleted successfully!', 'success');
        }
    }

    handleError(error) {
        this.showNotification(`Error: ${error}`, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}
