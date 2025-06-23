import { RRWebAnalyzer } from './analysis.js';

class AnalysisUI {
    constructor() {
        this.analyzer = null;
        this.analysisData = null;
        this.init();
    }

    init() {
        // Load analysis when page loads
        this.loadAnalysis();

        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshBtn');
        const exportBtn = document.getElementById('exportBtn');
        const retryBtn = document.getElementById('retryBtn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadAnalysis());
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportAnalysis());
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.loadAnalysis());
        }
    }

    async loadAnalysis() {
        this.showLoadingState();

        try {
            // Try to get events from various sources
            const events = await this.getEventsData();

            if (!events || !Array.isArray(events) || events.length === 0) {
                throw new Error('No events data found. Please ensure you have loaded a recording first.');
            }

            // Perform analysis
            this.analyzer = new RRWebAnalyzer(events);
            this.analysisData = this.analyzer.getFullAnalysis();

            // Display results
            this.displayAnalysis();

        } catch (error) {
            console.error('Analysis error:', error);
            this.showErrorState(error.message);
        }
    }

    async getEventsData() {
        // Try multiple sources for events data

        // 1. Try IndexedDB first (preferred)
        try {
            const events = await this.getEventsFromIndexedDB();
            if (events) {
                console.log('Loaded events from IndexedDB');
                return events;
            }
        } catch (error) {
            console.warn('Failed to load from IndexedDB:', error);
        }

        // 2. Try sessionStorage
        try {
            const storedEvents = sessionStorage.getItem('rrweb-events');
            if (storedEvents) {
                console.log('Loaded events from sessionStorage');
                return JSON.parse(storedEvents);
            }
        } catch (error) {
            console.warn('Failed to load from sessionStorage:', error);
        }

        // 3. Try to get from opener window (if opened from play page)
        try {
            if (window.opener && window.opener.events) {
                console.log('Loaded events from opener window');
                return window.opener.events;
            }
        } catch (error) {
            console.warn('Failed to load from opener window:', error);
        }

        // 4. Try to get from URL parameter
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const url = urlParams.get('url');
            if (url) {
                console.log('Loading events from URL');
                const response = await fetch(url);
                return await response.json();
            }
        } catch (error) {
            console.warn('Failed to load from URL:', error);
        }

        return null;
    }

    getEventsFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('rrweb-storage', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['events'], 'readonly');
                const store = transaction.objectStore('events');
                const getRequest = store.get('rrweb-events');

                getRequest.onsuccess = () => resolve(getRequest.result);
                getRequest.onerror = () => reject(getRequest.error);
            };
        });
    }

    showLoadingState() {
        document.getElementById('loadingState').classList.remove('d-none');
        document.getElementById('errorState').classList.add('d-none');
        document.getElementById('analysisResults').classList.add('d-none');
    }

    showErrorState(message) {
        document.getElementById('loadingState').classList.add('d-none');
        document.getElementById('errorState').classList.remove('d-none');
        document.getElementById('analysisResults').classList.add('d-none');
        document.getElementById('errorMessage').textContent = message;
    }

    displayAnalysis() {
        document.getElementById('loadingState').classList.add('d-none');
        document.getElementById('errorState').classList.add('d-none');
        document.getElementById('analysisResults').classList.remove('d-none');

        this.displaySummary();
        this.displayMessageTypeCounts();
        this.displayIncrementalSnapshotCounts();
        this.displayMutationAnalysis();
        this.displayTimeRange();
        this.displayRawData();
    }

    displaySummary() {
        const summary = this.analysisData.summary;

        document.getElementById('totalEvents').textContent = summary.totalEvents.toLocaleString();
        document.getElementById('totalSize').textContent = summary.totalSize;

        if (summary.timeRange) {
            document.getElementById('duration').textContent = summary.timeRange.duration;
        } else {
            document.getElementById('duration').textContent = 'N/A';
        }

        // Calculate mutation events count
        const mutationCount = this.analysisData.messageTypeCounts['IncrementalSnapshot'] || 0;
        document.getElementById('mutationEvents').textContent = mutationCount.toLocaleString();
    }

    displayMessageTypeCounts() {
        const counts = this.analysisData.messageTypeCounts;
        const formatted = this.formatObjectDisplay(counts);
        document.getElementById('messageTypeCounts').textContent = formatted;
    }

    displayIncrementalSnapshotCounts() {
        const counts = this.analysisData.incrementalSnapshotEventSourceCounts;
        const formatted = this.formatObjectDisplay(counts);
        document.getElementById('incrementalSnapshotCounts').textContent = formatted;
    }

    displayMutationAnalysis() {
        const removalCount = this.analysisData.mutationRemovalCount;
        const additionCounts = this.analysisData.mutationAdditionCounts;

        document.getElementById('mutationRemovalCount').textContent = removalCount.toLocaleString();
        document.getElementById('mutationAdditionCounts').textContent = this.formatObjectDisplay(additionCounts);
    }

    displayTimeRange() {
        const timeRange = this.analysisData.summary.timeRange;

        if (timeRange) {
            const formatted = `Start: ${timeRange.start}
End: ${timeRange.end}
Duration: ${timeRange.duration}`;
            document.getElementById('timeRange').textContent = formatted;
        } else {
            document.getElementById('timeRange').textContent = 'No timestamp information available';
            document.getElementById('timeRangeSection').style.display = 'none';
        }
    }

    displayRawData() {
        const formatted = JSON.stringify(this.analysisData, null, 2);
        document.getElementById('rawAnalysisData').textContent = formatted;
    }

    formatObjectDisplay(obj) {
        if (!obj || typeof obj !== 'object') {
            return 'No data available';
        }

        return Object.entries(obj)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
    }

    exportAnalysis() {
        if (!this.analysisData) {
            alert('No analysis data to export');
            return;
        }

        const dataStr = JSON.stringify(this.analysisData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rrweb-analysis-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AnalysisUI());
} else {
    new AnalysisUI();
} 