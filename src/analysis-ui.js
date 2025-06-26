import { RRWebAnalyzer } from "./analysis.js";

class AnalysisUI {
  constructor() {
    this.analyzer = null;
    this.analysisData = null;
    this.mutationsChart = null;
    this.init();
  }

  init() {
    // Load analysis when page loads
    this.loadAnalysis();

    // Set up event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    const refreshBtn = document.getElementById("refreshBtn");
    const exportBtn = document.getElementById("exportBtn");
    const retryBtn = document.getElementById("retryBtn");
    const resetZoomBtn = document.getElementById("resetZoomBtn");

    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.loadAnalysis());
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportAnalysis());
    }

    if (retryBtn) {
      retryBtn.addEventListener("click", () => this.loadAnalysis());
    }

    if (resetZoomBtn) {
      resetZoomBtn.addEventListener("click", () => this.resetZoom());
    }
  }

  async loadAnalysis() {
    this.showLoadingState();

    // Cleanup previous chart
    if (this.mutationsChart) {
      this.mutationsChart.destroy();
      this.mutationsChart = null;
    }

    try {
      // Try to get events from various sources
      const events = await this.getEventsData();

      if (!events || !Array.isArray(events) || events.length === 0) {
        throw new Error(
          "No events data found. Please ensure you have loaded a recording first.",
        );
      }

      // Perform analysis
      this.analyzer = new RRWebAnalyzer(events);
      this.analysisData = this.analyzer.getFullAnalysis();

      // Display results
      this.displayAnalysis();
    } catch (error) {
      console.error("Analysis error:", error);
      this.showErrorState(error.message);
    }
  }

  async getEventsData() {
    // Try multiple sources for events data

    // 1. Try IndexedDB first (preferred)
    try {
      const events = await this.getEventsFromIndexedDB();
      if (events) {
        return events;
      }
    } catch (error) {
      console.warn("Failed to load from IndexedDB:", error);
    }

    // 2. Try sessionStorage
    try {
      const storedEvents = sessionStorage.getItem("rrweb-events");
      if (storedEvents) {
        return JSON.parse(storedEvents);
      }
    } catch (error) {
      console.warn("Failed to load from sessionStorage:", error);
    }

    // 3. Try to get from opener window (if opened from play page)
    try {
      if (window.opener && window.opener.events) {
        return window.opener.events;
      }
    } catch (error) {
      console.warn("Failed to load from opener window:", error);
    }

    // 4. Try to get from URL parameter
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const url = urlParams.get("url");
      if (url) {
        const response = await fetch(url);
        return await response.json();
      }
    } catch (error) {
      console.warn("Failed to load from URL:", error);
    }

    return null;
  }

  getEventsFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("rrweb-storage", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["events"], "readonly");
        const store = transaction.objectStore("events");
        const getRequest = store.get("rrweb-events");

        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  showLoadingState() {
    document.getElementById("loadingState").classList.remove("d-none");
    document.getElementById("errorState").classList.add("d-none");
    document.getElementById("analysisResults").classList.add("d-none");
  }

  showErrorState(message) {
    document.getElementById("loadingState").classList.add("d-none");
    document.getElementById("errorState").classList.remove("d-none");
    document.getElementById("analysisResults").classList.add("d-none");
    document.getElementById("errorMessage").textContent = message;
  }

  displayAnalysis() {
    document.getElementById("loadingState").classList.add("d-none");
    document.getElementById("errorState").classList.add("d-none");
    document.getElementById("analysisResults").classList.remove("d-none");

    this.displaySummary();
    this.displayMutationsPerSecondChart();
    this.displayMessageTypeCounts();
    this.displayIncrementalSnapshotCounts();
    this.displayMutationAnalysis();
    this.displayTimeRange();
    this.displayRawData();
  }

  displaySummary() {
    const summary = this.analysisData.summary;

    document.getElementById("totalEvents").textContent =
      summary.totalEvents.toLocaleString();
    document.getElementById("totalSize").textContent = summary.totalSize;

    if (summary.timeRange) {
      document.getElementById("duration").textContent =
        summary.timeRange.duration;
    } else {
      document.getElementById("duration").textContent = "N/A";
    }

    // Calculate mutation events count
    const mutationCount =
      this.analysisData.messageTypeCounts["IncrementalSnapshot"] || 0;
    document.getElementById("mutationEvents").textContent =
      mutationCount.toLocaleString();
  }

  displayMessageTypeCounts() {
    const counts = this.analysisData.messageTypeCounts;
    this.populateTable("messageTypeCountsTable", counts);
  }

  displayIncrementalSnapshotCounts() {
    const counts = this.analysisData.incrementalSnapshotEventSourceCounts;
    this.populateTable("incrementalSnapshotCountsTable", counts);
  }

  displayMutationAnalysis() {
    const removalCount = this.analysisData.mutationRemovalCount;
    const additionCounts = this.analysisData.mutationAdditionCounts;

    document.getElementById("mutationRemovalCount").textContent =
      removalCount.toLocaleString();
    this.populateTable("mutationAdditionCountsTable", additionCounts);
  }

  displayTimeRange() {
    const timeRange = this.analysisData.summary.timeRange;

    if (timeRange) {
      const formatted = `Start: ${timeRange.start}
End: ${timeRange.end}
Duration: ${timeRange.duration}`;
      document.getElementById("timeRange").textContent = formatted;
    } else {
      document.getElementById("timeRange").textContent =
        "No timestamp information available";
      document.getElementById("timeRangeSection").style.display = "none";
    }
  }

  displayRawData() {
    const formatted = JSON.stringify(this.analysisData, null, 2);
    document.getElementById("rawAnalysisData").textContent = formatted;
  }

  displayMutationsPerSecondChart() {
    const mutationsData = this.analysisData.mutationsPerSecond;

    if (!mutationsData || mutationsData.length === 0) {
      document.getElementById("mutationsChart").style.display = "none";
      return;
    }

    const ctx = document.getElementById("mutationsChart").getContext("2d");

    // Destroy existing chart if it exists
    if (this.mutationsChart) {
      this.mutationsChart.destroy();
    }

    const labels = mutationsData.map((item) => {
      const date = new Date(item.timestamp);
      return date.toLocaleTimeString();
    });

    const data = mutationsData.map((item) => item.total);

    this.mutationsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Total Mutations",
            data: data,
            backgroundColor: "rgba(54, 162, 235, 0.6)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Mutations Per Second",
          },
          legend: {
            display: false,
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'xy',
              modifierKey: 'shift',
            },
            zoom: {
              mode: 'xy',
              drag: {
                enabled: true,
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
              },
              wheel: {
                enabled: true,
                speed: 0.1,
              },
              pinch: {
                enabled: true
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Number of Mutations",
            },
          },
          x: {
            title: {
              display: true,
              text: "Time",
            },
          },
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const selectedData = mutationsData[index];
            this.showMutationDetails(
              selectedData.timestamp,
              selectedData.timestamp + 1000,
            );
          }
        },
        onHover: (event, elements) => {
          event.native.target.style.cursor =
            elements.length > 0 ? "pointer" : "default";
        },
      },
    });
  }

  showMutationDetails(startTime, endTime) {
    const details = this.analyzer.getMutationDetailsForTimeRange(
      startTime,
      endTime,
    );

    // Update selected time info
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    document.getElementById("selectedTimeInfo").innerHTML = `
      <strong>Time Period:</strong><br>
      ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}<br>
      <strong>Total Mutations:</strong> ${details.totalMutations}<br>
      <strong>Duration:</strong> ${details.durationSeconds}s
    `;

    // Show the details section
    document.getElementById("mutationDetailsSection").style.display = "block";

    // Populate nodes table
    this.populateNodesTable(details.nodes);

    // Populate types table
    this.populateTypesTable(details.types);

    // Scroll to the details section
    document
      .getElementById("mutationDetailsSection")
      .scrollIntoView({ behavior: "smooth" });
  }

  populateNodesTable(nodes) {
    const table = document.getElementById("nodesMutationsTable");
    const tbody = table.querySelector("tbody");

    tbody.innerHTML = "";

    if (!nodes || nodes.length === 0) {
      const row = tbody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 3;
      cell.className = "text-center text-muted";
      cell.textContent = "No node mutations found";
      return;
    }

    // Show top 20 most active nodes
    const topNodes = nodes.slice(0, 20);

    topNodes.forEach((node) => {
      const row = tbody.insertRow();
      const nodeCell = row.insertCell();
      const totalCell = row.insertCell();
      const rateCell = row.insertCell();

      nodeCell.textContent = `Node ${node.nodeId}`;
      nodeCell.style.fontWeight = "500";

      // Create breakdown tooltip
      const breakdown = [];
      if (node.adds > 0) breakdown.push(`${node.adds} adds`);
      if (node.removes > 0) breakdown.push(`${node.removes} removes`);
      if (node.texts > 0) breakdown.push(`${node.texts} texts`);
      if (node.attributes > 0) breakdown.push(`${node.attributes} attributes`);

      totalCell.textContent = node.total;
      totalCell.title = breakdown.join(", ");

      rateCell.textContent = `${node.rate}/s`;
    });
  }

  populateTypesTable(types) {
    const table = document.getElementById("mutationTypesTable");
    const tbody = table.querySelector("tbody");

    tbody.innerHTML = "";

    if (!types || types.length === 0) {
      const row = tbody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 3;
      cell.className = "text-center text-muted";
      cell.textContent = "No mutation types found";
      return;
    }

    // Sort by count descending
    const sortedTypes = types.sort((a, b) => b.count - a.count);

    sortedTypes.forEach((type) => {
      if (type.count > 0) {
        const row = tbody.insertRow();
        const typeCell = row.insertCell();
        const countCell = row.insertCell();
        const percentCell = row.insertCell();

        typeCell.textContent = type.type;
        typeCell.style.fontWeight = "500";
        countCell.textContent = type.count.toLocaleString();
        percentCell.textContent = type.percentage;
      }
    });
  }

  formatObjectDisplay(obj) {
    if (!obj || typeof obj !== "object") {
      return "No data available";
    }

    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  }

  populateTable(tableId, data) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = "";

    if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
      const row = tbody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 2;
      cell.className = "text-center text-muted";
      cell.textContent = "No data available";
      return;
    }

    // Sort entries by count (if numeric) for better readability
    const entries = Object.entries(data).sort(([, a], [, b]) => {
      // Extract numeric values for sorting
      const getNumericValue = (val) => {
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const match = val.match(/^(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }
        return 0;
      };
      return getNumericValue(b) - getNumericValue(a);
    });

    // Create table rows
    entries.forEach(([key, value]) => {
      const row = tbody.insertRow();
      const keyCell = row.insertCell();
      const valueCell = row.insertCell();

      keyCell.textContent = key;
      valueCell.textContent = value;

      // Add some styling for better readability
      keyCell.style.fontWeight = "500";
    });
  }

  exportAnalysis() {
    if (!this.analysisData) {
      alert("No analysis data to export");
      return;
    }

    const dataStr = JSON.stringify(this.analysisData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rrweb-analysis-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  resetZoom() {
    if (this.mutationsChart) {
      this.mutationsChart.resetZoom();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new AnalysisUI());
} else {
  new AnalysisUI();
}
