// RRWeb Recording Analysis
// Ported from PostHog/exported-recordings-analyzer

export class RRWebAnalyzer {
  constructor(events) {
    this.events = events;
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KiB", "MiB", "GiB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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
      0: "DomContentLoaded",
      1: "Load",
      2: "FullSnapshot",
      3: "IncrementalSnapshot",
      4: "Meta",
      5: "Custom",
      6: "Plugin",
    };

    return typeMap[event.type] || `Unknown(${event.type})`;
  }

  analyzeIncrementalSnapshots() {
    const counts = {};
    const sizeCounts = {};

    for (const event of this.events) {
      if (event.type === 3) {
        // IncrementalSnapshot
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
      0: "Mutation",
      1: "MouseMove",
      2: "MouseInteraction",
      3: "Scroll",
      4: "ViewportResize",
      5: "Input",
      6: "TouchMove",
      7: "MediaInteraction",
      8: "StyleSheetRule",
      9: "CanvasMutation",
      10: "Font",
      11: "Log",
      12: "Drag",
      13: "StyleDeclaration",
      14: "Selection",
      15: "AdoptedStyleSheet",
    };

    return sourceMap[event.data?.source] || `Unknown(${event.data?.source})`;
  }

  analyzeMutations() {
    let removalCount = 0;
    const additionCounts = {};
    const additionSizes = {};

    for (const event of this.events) {
      if (event.type === 3 && event.data?.source === 0) {
        // Mutation
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

            const additionSize = this.getStringByteSize(
              JSON.stringify(addition),
            );
            additionSizes[type] = (additionSizes[type] || 0) + additionSize;
          }
        }

        // Count attribute changes
        if (data.attributes) {
          for (const attr of data.attributes) {
            additionCounts["Attribute"] =
              (additionCounts["Attribute"] || 0) + 1;
            const attrSize = this.getStringByteSize(JSON.stringify(attr));
            additionSizes["Attribute"] =
              (additionSizes["Attribute"] || 0) + attrSize;
          }
        }

        // Count text changes
        if (data.texts) {
          for (const text of data.texts) {
            additionCounts["Text"] = (additionCounts["Text"] || 0) + 1;
            const textSize = this.getStringByteSize(JSON.stringify(text));
            additionSizes["Text"] = (additionSizes["Text"] || 0) + textSize;
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
      additionCounts: formattedAdditions,
    };
  }

  getAdditionType(addition) {
    if (addition.node) {
      if (addition.node.type === 1) return "Element"; // Element node
      if (addition.node.type === 3) return "Text"; // Text node
      if (addition.node.type === 8) return "Comment"; // Comment node
      return "Node";
    }
    return "Unknown";
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

    const timestamps = this.events.map((e) => e.timestamp).filter((t) => t);
    if (timestamps.length === 0) return null;

    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);
    const duration = end - start;

    return {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      duration: `${(duration / 1000).toFixed(1)}s`,
    };
  }

  analyzeMutationsPerSecond() {
    const mutationsPerSecond = new Map();
    const nodesMutationData = new Map();

    for (const event of this.events) {
      if (event.type === 3 && event.data?.source === 0 && event.timestamp) {
        // Round timestamp to seconds
        const second = Math.floor(event.timestamp / 1000) * 1000;

        if (!mutationsPerSecond.has(second)) {
          mutationsPerSecond.set(second, {
            adds: 0,
            removes: 0,
            texts: 0,
            attributes: 0,
            total: 0,
            nodes: new Map(),
          });
        }

        const secondData = mutationsPerSecond.get(second);
        const data = event.data;

        // Count mutations by type
        if (data.adds) {
          secondData.adds += data.adds.length;
          secondData.total += data.adds.length;

          // Track per node
          data.adds.forEach((add) => {
            if (add.parentId) {
              const nodeKey = `${add.parentId}`;
              if (!secondData.nodes.has(nodeKey)) {
                secondData.nodes.set(nodeKey, {
                  adds: 0,
                  removes: 0,
                  texts: 0,
                  attributes: 0,
                  total: 0,
                });
              }
              secondData.nodes.get(nodeKey).adds++;
              secondData.nodes.get(nodeKey).total++;
            }
          });
        }

        if (data.removes) {
          secondData.removes += data.removes.length;
          secondData.total += data.removes.length;

          // Track per node
          data.removes.forEach((remove) => {
            if (remove.parentId) {
              const nodeKey = `${remove.parentId}`;
              if (!secondData.nodes.has(nodeKey)) {
                secondData.nodes.set(nodeKey, {
                  adds: 0,
                  removes: 0,
                  texts: 0,
                  attributes: 0,
                  total: 0,
                });
              }
              secondData.nodes.get(nodeKey).removes++;
              secondData.nodes.get(nodeKey).total++;
            }
          });
        }

        if (data.texts) {
          secondData.texts += data.texts.length;
          secondData.total += data.texts.length;

          // Track per node
          data.texts.forEach((text) => {
            if (text.id) {
              const nodeKey = `${text.id}`;
              if (!secondData.nodes.has(nodeKey)) {
                secondData.nodes.set(nodeKey, {
                  adds: 0,
                  removes: 0,
                  texts: 0,
                  attributes: 0,
                  total: 0,
                });
              }
              secondData.nodes.get(nodeKey).texts++;
              secondData.nodes.get(nodeKey).total++;
            }
          });
        }

        if (data.attributes) {
          secondData.attributes += data.attributes.length;
          secondData.total += data.attributes.length;

          // Track per node
          data.attributes.forEach((attr) => {
            if (attr.id) {
              const nodeKey = `${attr.id}`;
              if (!secondData.nodes.has(nodeKey)) {
                secondData.nodes.set(nodeKey, {
                  adds: 0,
                  removes: 0,
                  texts: 0,
                  attributes: 0,
                  total: 0,
                });
              }
              secondData.nodes.get(nodeKey).attributes++;
              secondData.nodes.get(nodeKey).total++;
            }
          });
        }
      }
    }

    // Convert to array and sort by timestamp
    const sortedData = Array.from(mutationsPerSecond.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        ...data,
        nodes: Array.from(data.nodes.entries()).map(([nodeId, nodeData]) => ({
          nodeId,
          ...nodeData,
        })),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return sortedData;
  }

  getMutationDetailsForTimeRange(startTime, endTime) {
    const mutationsInRange = this.events.filter(
      (event) =>
        event.type === 3 &&
        event.data?.source === 0 &&
        event.timestamp >= startTime &&
        event.timestamp < endTime,
    );

    const nodesMutations = new Map();
    const typeCounts = { adds: 0, removes: 0, texts: 0, attributes: 0 };

    for (const event of mutationsInRange) {
      const data = event.data;

      // Process adds
      if (data.adds) {
        typeCounts.adds += data.adds.length;
        data.adds.forEach((add) => {
          if (add.parentId) {
            const nodeId = `${add.parentId}`;
            if (!nodesMutations.has(nodeId)) {
              nodesMutations.set(nodeId, {
                adds: 0,
                removes: 0,
                texts: 0,
                attributes: 0,
                total: 0,
              });
            }
            nodesMutations.get(nodeId).adds++;
            nodesMutations.get(nodeId).total++;
          }
        });
      }

      // Process removes
      if (data.removes) {
        typeCounts.removes += data.removes.length;
        data.removes.forEach((remove) => {
          if (remove.parentId) {
            const nodeId = `${remove.parentId}`;
            if (!nodesMutations.has(nodeId)) {
              nodesMutations.set(nodeId, {
                adds: 0,
                removes: 0,
                texts: 0,
                attributes: 0,
                total: 0,
              });
            }
            nodesMutations.get(nodeId).removes++;
            nodesMutations.get(nodeId).total++;
          }
        });
      }

      // Process texts
      if (data.texts) {
        typeCounts.texts += data.texts.length;
        data.texts.forEach((text) => {
          if (text.id) {
            const nodeId = `${text.id}`;
            if (!nodesMutations.has(nodeId)) {
              nodesMutations.set(nodeId, {
                adds: 0,
                removes: 0,
                texts: 0,
                attributes: 0,
                total: 0,
              });
            }
            nodesMutations.get(nodeId).texts++;
            nodesMutations.get(nodeId).total++;
          }
        });
      }

      // Process attributes
      if (data.attributes) {
        typeCounts.attributes += data.attributes.length;
        data.attributes.forEach((attr) => {
          if (attr.id) {
            const nodeId = `${attr.id}`;
            if (!nodesMutations.has(nodeId)) {
              nodesMutations.set(nodeId, {
                adds: 0,
                removes: 0,
                texts: 0,
                attributes: 0,
                total: 0,
              });
            }
            nodesMutations.get(nodeId).attributes++;
            nodesMutations.get(nodeId).total++;
          }
        });
      }
    }

    const totalMutations = Object.values(typeCounts).reduce((a, b) => a + b, 0);
    const durationSeconds = (endTime - startTime) / 1000;

    // Convert nodes map to sorted array
    const nodesList = Array.from(nodesMutations.entries())
      .map(([nodeId, data]) => ({
        nodeId,
        ...data,
        rate:
          durationSeconds > 0
            ? (data.total / durationSeconds).toFixed(2)
            : "0.00",
      }))
      .sort((a, b) => b.total - a.total);

    // Calculate percentages for types
    const typesWithPercentages = Object.entries(typeCounts).map(
      ([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
        percentage:
          totalMutations > 0
            ? ((count / totalMutations) * 100).toFixed(1) + "%"
            : "0%",
      }),
    );

    return {
      nodes: nodesList,
      types: typesWithPercentages,
      totalMutations,
      durationSeconds: durationSeconds.toFixed(1),
    };
  }

  getSnapshotsForNode(nodeId, startTime, endTime) {
    const snapshots = [];

    for (const event of this.events) {
      if (
        event.type === 3 && // IncrementalSnapshot
        event.data?.source === 0 && // Mutation
        event.timestamp >= startTime &&
        event.timestamp < endTime
      ) {
        const data = event.data;
        let relevantToNode = false;
        let snapshotData = {};

        // Check if this event affects the target node
        if (data.adds) {
          const nodeAdds = data.adds.filter(add =>
            add.parentId === parseInt(nodeId) || add.node?.id === parseInt(nodeId)
          );
          if (nodeAdds.length > 0) {
            relevantToNode = true;
            snapshotData.adds = nodeAdds;
          }
        }

        if (data.removes) {
          const nodeRemoves = data.removes.filter(remove =>
            remove.parentId === parseInt(nodeId) || remove.id === parseInt(nodeId)
          );
          if (nodeRemoves.length > 0) {
            relevantToNode = true;
            snapshotData.removes = nodeRemoves;
          }
        }

        if (data.texts) {
          const nodeTexts = data.texts.filter(text => text.id === parseInt(nodeId));
          if (nodeTexts.length > 0) {
            relevantToNode = true;
            snapshotData.texts = nodeTexts;
          }
        }

        if (data.attributes) {
          const nodeAttributes = data.attributes.filter(attr => attr.id === parseInt(nodeId));
          if (nodeAttributes.length > 0) {
            relevantToNode = true;
            snapshotData.attributes = nodeAttributes;
          }
        }

        if (relevantToNode) {
          // Determine the type of mutation
          let type = [];
          if (snapshotData.adds) type.push(`${snapshotData.adds.length} add${snapshotData.adds.length > 1 ? 's' : ''}`);
          if (snapshotData.removes) type.push(`${snapshotData.removes.length} remove${snapshotData.removes.length > 1 ? 's' : ''}`);
          if (snapshotData.texts) type.push(`${snapshotData.texts.length} text change${snapshotData.texts.length > 1 ? 's' : ''}`);
          if (snapshotData.attributes) type.push(`${snapshotData.attributes.length} attribute change${snapshotData.attributes.length > 1 ? 's' : ''}`);

          snapshots.push({
            timestamp: event.timestamp,
            type: type.join(', '),
            data: snapshotData
          });
        }
      }
    }

    return snapshots.sort((a, b) => a.timestamp - b.timestamp);
  }

  getFullAnalysis() {
    const messageTypes = this.analyzeMessageTypes();
    const incrementalSnapshots = this.analyzeIncrementalSnapshots();
    const mutations = this.analyzeMutations();
    const timeRange = this.getTimeRange();
    const mutationsPerSecond = this.analyzeMutationsPerSecond();

    return {
      summary: {
        totalEvents: this.getEventCount(),
        totalSize: this.getTotalSize(),
        timeRange,
      },
      messageTypeCounts: messageTypes,
      incrementalSnapshotEventSourceCounts: incrementalSnapshots,
      mutationRemovalCount: mutations.removalCount,
      mutationAdditionCounts: mutations.additionCounts,
      mutationsPerSecond,
    };
  }
}
