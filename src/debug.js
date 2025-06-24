// Debug functionality for step-by-step mutation debugging
export class DebugManager {
  constructor() {
    this.isDebugMode = false;
    this.events = [];
    this.filteredEvents = [];
    this.currentIndex = 0;
    this.player = null;

    // Default filter settings - similar to PostHog
    this.debugSettings = {
      types: [2, 3], // FullSnapshot, IncrementalSnapshot
      incrementalSources: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      ], // All mutation types
    };

    this.snapshotTypes = {
      0: "DomContentLoaded",
      1: "Load",
      2: "FullSnapshot",
      3: "IncrementalSnapshot",
      4: "Meta",
      5: "Custom",
      6: "Plugin",
    };

    this.incrementalSource = {
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
  }

  setPlayer(player) {
    console.log("Setting player for debug manager:", player);
    this.player = player;
  }

  setEvents(events) {
    console.log(
      `Setting events for debug manager: ${events ? events.length : 0} events`,
    );
    this.events = events;
    // Don't filter events immediately - wait until debug mode is activated
  }

  filterEvents() {
    this.filteredEvents = this.events.filter((event) => {
      // Filter by event type
      if (!this.debugSettings.types.includes(event.type)) {
        return false;
      }

      // If it's an incremental snapshot, filter by source
      if (event.type === 3 && event.data && event.data.source !== undefined) {
        return this.debugSettings.incrementalSources.includes(
          event.data.source,
        );
      }

      return true;
    });

    // Reset current index if it's out of bounds
    if (this.currentIndex >= this.filteredEvents.length) {
      this.currentIndex = Math.max(0, this.filteredEvents.length - 1);
    }

    this.updateDebugUI();
  }

  toggleDebugMode() {
    console.log("Toggling debug mode, current state:", this.isDebugMode);
    this.isDebugMode = !this.isDebugMode;
    this._updateDebugMode();
  }

  enterDebugMode() {
    if (!this.isDebugMode) {
      console.log("Entering debug mode...");
      this.isDebugMode = true;
      this._updateDebugMode();
    }
  }

  exitDebugMode() {
    if (this.isDebugMode) {
      console.log("Exiting debug mode...");
      this.isDebugMode = false;
      this._updateDebugMode();
    }
  }

  _updateDebugMode() {
    if (this.isDebugMode) {
      this.pausePlayer();
      this.showDebugPanel();
      this.initializeDebugPanel(); // Initialize panel content when entering debug mode
      this.filterEvents();
    } else {
      this.hideDebugPanel();
    }

    this.updateModeSelector();
  }

  pausePlayer() {
    if (this.player && this.player.pause) {
      this.player.pause();
    }
  }

  seekToEvent(index) {
    if (index < 0 || index >= this.filteredEvents.length) return;

    this.currentIndex = index;
    const event = this.filteredEvents[index];

    if (this.player && event) {
      // Seek to the timestamp of the event
      if (this.player.goto) {
        this.player.goto(event.timestamp);
      } else if (this.player.seekTo) {
        this.player.seekTo(event.timestamp);
      }
    }

    this.updateDebugUI();
  }

  goToPrevious() {
    this.seekToEvent(this.currentIndex - 1);
  }

  goToNext() {
    this.seekToEvent(this.currentIndex + 1);
  }

  updateTypeFilter(newTypes) {
    this.debugSettings.types = newTypes;
    this.filterEvents();
  }

  updateSourceFilter(newSources) {
    this.debugSettings.incrementalSources = newSources;
    this.filterEvents();
  }

  getCurrentEvent() {
    return this.filteredEvents[this.currentIndex] || null;
  }

  getPreviousEvent() {
    return this.currentIndex > 0
      ? this.filteredEvents[this.currentIndex - 1]
      : null;
  }

  getNextEvent() {
    return this.currentIndex < this.filteredEvents.length - 1
      ? this.filteredEvents[this.currentIndex + 1]
      : null;
  }

  showDebugPanel() {
    // Show debug panel column first
    const debugCol = document.querySelector(".debug-col");
    if (debugCol) {
      debugCol.style.display = "block";
    }

    // Adjust main content layout
    const playerCol = document.querySelector(".col-lg-9");
    const jsonCol = document.querySelector(".col-lg-3:not(.debug-col)"); // Make sure we don't select the debug column

    if (playerCol && jsonCol) {
      playerCol.className = "col-lg-6";
      // jsonCol stays as col-lg-3
    }

    // Show debug panel content
    const debugPanel = document.getElementById("debug-panel");
    if (debugPanel) {
      debugPanel.style.display = "block";
    }
  }

  hideDebugPanel() {
    // Hide debug panel content
    const debugPanel = document.getElementById("debug-panel");
    if (debugPanel) {
      debugPanel.style.display = "none";
    }

    // Hide debug panel column
    const debugCol = document.querySelector(".debug-col");
    if (debugCol) {
      debugCol.style.display = "none";
    }

    // Restore original layout
    const playerCol = document.querySelector(".col-lg-6");
    const jsonCol = document.querySelector(".col-lg-3:not(.debug-col)");

    if (playerCol) {
      playerCol.className = "col-lg-9";
    }
    // jsonCol stays as col-lg-3
  }

  updateModeSelector() {
    // Update mode selector to reflect current state
    const debugMode = document.getElementById("debug-mode");
    const playerMode = document.getElementById("player-mode");

    if (debugMode && playerMode) {
      if (this.isDebugMode) {
        debugMode.checked = true;
      } else {
        playerMode.checked = true;
      }
    }
  }

  updateDebugUI() {
    if (!this.isDebugMode) return;

    // Update slider
    const debugSlider = document.getElementById("debug-slider");
    if (debugSlider) {
      debugSlider.max = Math.max(0, this.filteredEvents.length - 1);
      debugSlider.value = this.currentIndex;
    }

    // Update counter
    const debugCounter = document.getElementById("debug-counter");
    if (debugCounter) {
      debugCounter.textContent = `${this.currentIndex} / ${Math.max(0, this.filteredEvents.length - 1)}`;
    }

    // Update buttons
    const prevBtn = document.getElementById("debug-prev");
    const nextBtn = document.getElementById("debug-next");

    if (prevBtn) {
      prevBtn.disabled = this.currentIndex <= 0;
    }

    if (nextBtn) {
      nextBtn.disabled = this.currentIndex >= this.filteredEvents.length - 1;
    }

    // Update event details
    this.updateEventDetails();
  }

  updateEventDetails() {
    const current = this.getCurrentEvent();
    const previous = this.getPreviousEvent();
    const next = this.getNextEvent();

    this.updateEventDisplay("current-event", current, "Current Event");
    this.updateEventDisplay("previous-event", previous, "Previous Event");
    this.updateEventDisplay("next-event", next, "Next Event");
  }

  updateEventDisplay(elementId, event, title) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (!event) {
      element.innerHTML = `<div class="text-muted">No ${title.toLowerCase()}</div>`;
      return;
    }

    const eventSummary = this.createEventSummary(event);

    element.innerHTML = `
      <div class="border-bottom pb-2 mb-2">
        <strong>${title}</strong>
      </div>
      <div class="small">
        <div><strong>Time:</strong> ${new Date(event.timestamp).toISOString()}</div>
        <div><strong>Type:</strong> ${this.snapshotTypes[event.type] || `Unknown(${event.type})`}</div>
        ${eventSummary}
      </div>
      <button class="btn btn-sm btn-outline-secondary mt-2" onclick="debugManager.showEventDetails(${JSON.stringify(event).replace(/"/g, "&quot;")})">
        Show Full Event
      </button>
    `;
  }

  createEventSummary(event) {
    let summary = "";

    if (event.type === 3 && event.data) {
      // IncrementalSnapshot
      const sourceName =
        this.incrementalSource[event.data.source] ||
        `Unknown(${event.data.source})`;
      summary += `<div><strong>Source:</strong> ${sourceName}</div>`;

      if (event.data.source === 0 && event.data) {
        // Mutation
        if (event.data.adds) {
          summary += `<div><strong>Adds:</strong> ${event.data.adds.length}</div>`;
        }
        if (event.data.removes) {
          summary += `<div><strong>Removes:</strong> ${event.data.removes.length}</div>`;
        }
        if (event.data.texts) {
          summary += `<div><strong>Text Changes:</strong> ${event.data.texts.length}</div>`;
        }
        if (event.data.attributes) {
          summary += `<div><strong>Attribute Changes:</strong> ${event.data.attributes.length}</div>`;
        }
      }
    }

    return summary;
  }

  showEventDetails(event) {
    // Create a modal or expand detailed view
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Event Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <pre class="bg-light p-3" style="max-height: 400px; overflow-y: auto;">${JSON.stringify(event, null, 2)}</pre>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Show modal using Bootstrap
    if (window.bootstrap && window.bootstrap.Modal) {
      const bootstrapModal = new window.bootstrap.Modal(modal);
      bootstrapModal.show();
      modal.addEventListener("hidden.bs.modal", () => {
        document.body.removeChild(modal);
      });
    } else {
      // Fallback if Bootstrap modal not available
      modal.style.display = "block";
      modal.style.backgroundColor = "rgba(0,0,0,0.5)";
      modal.style.position = "fixed";
      modal.style.top = "0";
      modal.style.left = "0";
      modal.style.width = "100%";
      modal.style.height = "100%";
      modal.style.zIndex = "9999";

      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
        }
      });

      modal.querySelector(".btn-close").addEventListener("click", () => {
        document.body.removeChild(modal);
      });
    }
  }

  createTypeFilterHTML() {
    return Object.entries(this.snapshotTypes)
      .map(([key, value]) => {
        const checked = this.debugSettings.types.includes(parseInt(key))
          ? "checked"
          : "";
        return `
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="checkbox" id="type-${key}" value="${key}" ${checked}
                 onchange="debugManager.handleTypeFilterChange()">
          <label class="form-check-label small" for="type-${key}">${value}</label>
        </div>
      `;
      })
      .join("");
  }

  createSourceFilterHTML() {
    return Object.entries(this.incrementalSource)
      .map(([key, value]) => {
        const checked = this.debugSettings.incrementalSources.includes(
          parseInt(key),
        )
          ? "checked"
          : "";
        const disabled = !this.debugSettings.types.includes(3)
          ? "disabled"
          : "";
        return `
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="checkbox" id="source-${key}" value="${key}" ${checked} ${disabled}
                 onchange="debugManager.handleSourceFilterChange()">
          <label class="form-check-label small" for="source-${key}">${value}</label>
        </div>
      `;
      })
      .join("");
  }

  handleTypeFilterChange() {
    const checkboxes = document.querySelectorAll(
      '#debug-panel input[id^="type-"]:checked',
    );
    const newTypes = Array.from(checkboxes).map((cb) => parseInt(cb.value));
    this.updateTypeFilter(newTypes);

    // Update source filter UI state
    this.updateSourceFilterState();
    console.log(
      `Debug panel initialized with ${this.events.length} total events, ${this.filteredEvents.length} filtered events`,
    );
  }

  handleSourceFilterChange() {
    const checkboxes = document.querySelectorAll(
      '#debug-panel input[id^="source-"]:checked',
    );
    const newSources = Array.from(checkboxes).map((cb) => parseInt(cb.value));
    this.updateSourceFilter(newSources);
  }

  updateSourceFilterState() {
    const sourceCheckboxes = document.querySelectorAll(
      '#debug-panel input[id^="source-"]',
    );
    const incrementalEnabled = this.debugSettings.types.includes(3);

    sourceCheckboxes.forEach((checkbox) => {
      checkbox.disabled = !incrementalEnabled;
      if (!incrementalEnabled) {
        checkbox.checked = false;
      }
    });

    if (!incrementalEnabled) {
      this.updateSourceFilter([]);
    }
  }

  initializeDebugPanel() {
    console.log("Initializing debug panel...");
    const debugPanel = document.getElementById("debug-panel");
    if (!debugPanel) {
      console.error("Debug panel element not found!");
      return;
    }

    console.log("Debug panel found, populating content...");
    debugPanel.innerHTML = `
      <div class="card-header bg-warning">
        <h6 class="card-title mb-0">🐛 Debug Mode</h6>
      </div>
      <div class="card-body p-2">
        <!-- Type Filters -->
        <div class="mb-3">
          <label class="form-label small fw-bold">Event Types:</label>
          <div class="border rounded p-2 bg-light" style="max-height: 120px; overflow-y: auto;">
            ${this.createTypeFilterHTML()}
          </div>
        </div>
        
        <!-- Source Filters -->
        <div class="mb-3">
          <label class="form-label small fw-bold">Incremental Sources:</label>
          <div class="border rounded p-2 bg-light" style="max-height: 120px; overflow-y: auto;">
            ${this.createSourceFilterHTML()}
          </div>
        </div>
        
        <!-- Navigation -->
        <div class="mb-3">
          <div class="d-flex align-items-center mb-2">
            <input type="range" class="form-range flex-grow-1 me-2" id="debug-slider" 
                   min="0" max="0" value="0" 
                   oninput="debugManager.seekToEvent(parseInt(this.value))">
            <span id="debug-counter" class="small text-muted">0 / 0</span>
          </div>
          <div class="d-flex gap-1">
            <button id="debug-prev" class="btn btn-sm btn-outline-secondary flex-fill" 
                    onclick="debugManager.goToPrevious()">⬅ Previous</button>
            <button id="debug-next" class="btn btn-sm btn-outline-secondary flex-fill" 
                    onclick="debugManager.goToNext()">Next ➡</button>
          </div>
        </div>
        
        <!-- Event Details -->
        <div class="border-top pt-2">
          <div class="accordion accordion-flush" id="debug-accordion">
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                        data-bs-target="#current-collapse">
                  Current Event
                </button>
              </h2>
              <div id="current-collapse" class="accordion-collapse collapse show" 
                   data-bs-parent="#debug-accordion">
                <div class="accordion-body p-2" id="current-event">
                  <!-- Current event details -->
                </div>
              </div>
            </div>
            
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                        data-bs-target="#previous-collapse">
                  Previous Event
                </button>
              </h2>
              <div id="previous-collapse" class="accordion-collapse collapse" 
                   data-bs-parent="#debug-accordion">
                <div class="accordion-body p-2" id="previous-event">
                  <!-- Previous event details -->
                </div>
              </div>
            </div>
            
            <div class="accordion-item">
              <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                        data-bs-target="#next-collapse">
                  Next Event
                </button>
              </h2>
              <div id="next-collapse" class="accordion-collapse collapse" 
                   data-bs-parent="#debug-accordion">
                <div class="accordion-body p-2" id="next-event">
                  <!-- Next event details -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.updateSourceFilterState();
  }
}

// Create global instance
console.log("Creating debug manager instance...");
window.debugManager = new DebugManager();
console.log("Debug manager created:", window.debugManager);
