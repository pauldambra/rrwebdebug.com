// RRWeb Recording Analysis
// Ported from PostHog/exported-recordings-analyzer

export class RRWebAnalyzer {
    constructor(events) {
        this.events = events;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KiB', 'MiB', 'GiB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    getStringByteSize(str) {
        return new Blob([str]).size;
    }

    analyzeMessageTypes() {
        const counts = {};

        for (const event of this.events) {
            const type = this.getEventType(event);
            counts[type] = (counts[type] || 0) + 1;
        }

        return counts;
    }

    getEventType(event) {
        // RRWeb event types based on the type field
        const typeMap = {
            0: 'DomContentLoaded',
            1: 'Load',
            2: 'FullSnapshot',
            3: 'IncrementalSnapshot',
            4: 'Meta',
            5: 'Custom',
            6: 'Plugin'
        };

        return typeMap[event.type] || `Unknown(${event.type})`;
    }

    analyzeIncrementalSnapshots() {
        const counts = {};
        const sizeCounts = {};

        for (const event of this.events) {
            if (event.type === 3) { // IncrementalSnapshot
                const source = this.getIncrementalSource(event);
                counts[source] = (counts[source] || 0) + 1;

                const eventSize = this.getStringByteSize(JSON.stringify(event));
                sizeCounts[source] = (sizeCounts[source] || 0) + eventSize;
            }
        }

        // Format with counts and sizes
        const formatted = {};
        for (const [source, count] of Object.entries(counts)) {
            const size = sizeCounts[source] || 0;
            formatted[source] = `${count} (${this.formatBytes(size)})`;
        }

        return formatted;
    }

    getIncrementalSource(event) {
        // RRWeb incremental snapshot sources
        const sourceMap = {
            0: 'Mutation',
            1: 'MouseMove',
            2: 'MouseInteraction',
            3: 'Scroll',
            4: 'ViewportResize',
            5: 'Input',
            6: 'TouchMove',
            7: 'MediaInteraction',
            8: 'StyleSheetRule',
            9: 'CanvasMutation',
            10: 'Font',
            11: 'Log',
            12: 'Drag',
            13: 'StyleDeclaration',
            14: 'Selection',
            15: 'AdoptedStyleSheet'
        };

        return sourceMap[event.data?.source] || `Unknown(${event.data?.source})`;
    }

    analyzeMutations() {
        let removalCount = 0;
        const additionCounts = {};
        const additionSizes = {};

        for (const event of this.events) {
            if (event.type === 3 && event.data?.source === 0) { // Mutation
                const data = event.data;

                // Count removals
                if (data.removes) {
                    removalCount += data.removes.length;
                }

                // Count additions
                if (data.adds) {
                    for (const addition of data.adds) {
                        const type = this.getAdditionType(addition);
                        additionCounts[type] = (additionCounts[type] || 0) + 1;

                        const additionSize = this.getStringByteSize(JSON.stringify(addition));
                        additionSizes[type] = (additionSizes[type] || 0) + additionSize;
                    }
                }

                // Count attribute changes
                if (data.attributes) {
                    for (const attr of data.attributes) {
                        additionCounts['Attribute'] = (additionCounts['Attribute'] || 0) + 1;
                        const attrSize = this.getStringByteSize(JSON.stringify(attr));
                        additionSizes['Attribute'] = (additionSizes['Attribute'] || 0) + attrSize;
                    }
                }

                // Count text changes
                if (data.texts) {
                    for (const text of data.texts) {
                        additionCounts['Text'] = (additionCounts['Text'] || 0) + 1;
                        const textSize = this.getStringByteSize(JSON.stringify(text));
                        additionSizes['Text'] = (additionSizes['Text'] || 0) + textSize;
                    }
                }
            }
        }

        // Format addition counts with sizes
        const formattedAdditions = {};
        for (const [type, count] of Object.entries(additionCounts)) {
            const size = additionSizes[type] || 0;
            formattedAdditions[type] = `${count} (${this.formatBytes(size)})`;
        }

        return {
            removalCount,
            additionCounts: formattedAdditions
        };
    }

    getAdditionType(addition) {
        if (addition.node) {
            if (addition.node.type === 1) return 'Element'; // Element node
            if (addition.node.type === 3) return 'Text'; // Text node
            if (addition.node.type === 8) return 'Comment'; // Comment node
            return 'Node';
        }
        return 'Unknown';
    }

    getTotalSize() {
        const totalSize = this.getStringByteSize(JSON.stringify(this.events));
        return this.formatBytes(totalSize);
    }

    getEventCount() {
        return this.events.length;
    }

    getTimeRange() {
        if (this.events.length === 0) return null;

        const timestamps = this.events.map(e => e.timestamp).filter(t => t);
        if (timestamps.length === 0) return null;

        const start = Math.min(...timestamps);
        const end = Math.max(...timestamps);
        const duration = end - start;

        return {
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            duration: `${(duration / 1000).toFixed(1)}s`
        };
    }

    getFullAnalysis() {
        const messageTypes = this.analyzeMessageTypes();
        const incrementalSnapshots = this.analyzeIncrementalSnapshots();
        const mutations = this.analyzeMutations();
        const timeRange = this.getTimeRange();

        return {
            summary: {
                totalEvents: this.getEventCount(),
                totalSize: this.getTotalSize(),
                timeRange
            },
            messageTypeCounts: messageTypes,
            incrementalSnapshotEventSourceCounts: incrementalSnapshots,
            mutationRemovalCount: mutations.removalCount,
            mutationAdditionCounts: mutations.additionCounts
        };
    }
} 