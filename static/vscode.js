class VSCodeWatcher {
    constructor() {
        this.currentFile = null;
        this.initializeFileSystem();
    }

    initializeFileSystem() {
        this.refreshFileList();
        this.setupFileWatcher();
    }

    async refreshFileList() {
        const fileList = document.getElementById('file-list');
        if (!fileList) return;
        
        try {
            const response = await fetch('/api/files');
            const files = await response.json();
            fileList.innerHTML = '';
            files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'file-item';
                item.textContent = file;
                item.onclick = () => this.openFile(file);
                fileList.appendChild(item);
            });
        } catch (error) {
            console.error('Error refreshing file list:', error);
        }
    }

    async openFile(filename) {
        try {
            const response = await fetch(`/api/files/${filename}`);
            const content = await response.text();
            this.currentFile = filename;
            this.updateEditor(content);
        } catch (error) {
            console.error('Error opening file:', error);
        }
    }

    updateEditor(content) {
        const editor = document.getElementById('editor');
        if (editor) {
            editor.value = content;
        }
    }

    setupFileWatcher() {
        const ws = new WebSocket(`ws://${window.location.host}/ws/updates`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'file_changed') {
                this.refreshFileList();
                if (data.path === this.currentFile) {
                    this.openFile(this.currentFile);
                }
            }
        };
    }
}
