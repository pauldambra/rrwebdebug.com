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
    this.player = player;
  }

  setEvents(events) {
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
    this.isDebugMode = !this.isDebugMode;
    this._updateDebugMode();
  }

  enterDebugMode() {
    if (!this.isDebugMode) {
      this.isDebugMode = true;
      this._updateDebugMode();
    }
  }

  exitDebugMode() {
    if (this.isDebugMode) {
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
    if (this.player) {
      if (this.player.pause) {
        this.player.pause();
      } else if (this.player.stop) {
        this.player.stop();
      } else if (this.player.togglePlay) {
        this.player.togglePlay();
      } else {
        console.warn("No pause method found on player");
      }
    }
  }

  seekToEvent(index) {
    if (index < 0 || index >= this.filteredEvents.length) return;

    this.currentIndex = index;
    const event = this.filteredEvents[index];

    if (this.player && event) {
      // Calculate relative timestamp from the start of the recording
      const startTime = this.events.length > 0 ? this.events[0].timestamp : 0;
      const relativeTime = event.timestamp - startTime;

      // Seek to the relative timestamp
      if (this.player.goto) {
        this.player.goto(relativeTime);
      } else if (this.player.seekTo) {
        this.player.seekTo(relativeTime);
      } else if (this.player.play) {
        // Fallback: try to use play with timestamp
        this.player.play(relativeTime);
      } else {
        console.warn(
          "No suitable seek method found on player:",
          Object.keys(this.player),
        );
      }
    }

    this.updateDebugUI();

    // Automatically scroll to and highlight the current event in JSON panel
    this.highlightCurrentEventInJSON(event);
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

  getUnfilteredIndex(event) {
    if (!event) return -1;
    return this.events.findIndex(
      (e) =>
        e.timestamp === event.timestamp &&
        e.type === event.type &&
        JSON.stringify(e.data) === JSON.stringify(event.data),
    );
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

    // Update counter with unfiltered index and total events
    const debugCounter = document.getElementById("debug-counter");
    if (debugCounter) {
      const currentEvent = this.filteredEvents[this.currentIndex];
      const unfilteredIndex = this.getUnfilteredIndex(currentEvent);

      if (unfilteredIndex >= 0) {
        debugCounter.innerHTML = `<div class="small">${unfilteredIndex} / ${this.events.length - 1}</div>`;
      } else {
        debugCounter.innerHTML = `<div class="small text-muted">? / ${this.events.length - 1}</div>`;
      }
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

    // Find the unfiltered index for this event
    const unfilteredIndex = this.getUnfilteredIndex(event);

    const eventSummary = this.createEventSummary(event);

    element.innerHTML = `
      <div class="border-bottom pb-2 mb-2">
        <strong>${title}</strong>
        ${unfilteredIndex >= 0 ? `<small class="text-muted ms-2">(Event #${unfilteredIndex})</small>` : ""}
      </div>
      <div class="small">
        <div><strong>Time:</strong> ${new Date(event.timestamp).toISOString()}</div>
        <div><strong>Type:</strong> ${this.snapshotTypes[event.type] || `Unknown(${event.type})`}</div>
        ${eventSummary}
      </div>

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

  highlightCurrentEventInJSON(event) {
    if (!event) return;

    const unfilteredIndex = this.getUnfilteredIndex(event);
    if (unfilteredIndex === -1) {
      return;
    }

    // Add visual feedback to JSON panel border
    this.highlightJSONPanel();

    // Clear any previous highlights
    this.clearPreviousHighlights();

    // Try multiple approaches to find and highlight the event
    let highlighted = false;

    // Approach 1: Try JSON editor API first
    if (window.jsonEditor) {
      try {
        const pathFormats = [
          [unfilteredIndex],
          [unfilteredIndex.toString()],
          unfilteredIndex.toString(),
          unfilteredIndex,
        ];

        for (const pathFormat of pathFormats) {
          try {
            window.jsonEditor.select({ path: pathFormat });
            if (window.jsonEditor.scrollTo) {
              window.jsonEditor.scrollTo(pathFormat);
            }
            console.log(`JSON editor API worked with format:`, pathFormat);
            // Still try DOM highlighting even if API works, since API might not be visually obvious
            break;
          } catch (err) {
            console.log(
              `JSON editor path format failed:`,
              pathFormat,
              err.message,
            );
          }
        }
      } catch (error) {
        console.log("JSON editor API failed:", error.message);
      }
    }

    // Approach 2: DOM-based highlighting (more reliable visual feedback)
    highlighted = this.highlightEventInDOM(unfilteredIndex);

    if (!highlighted) {
      console.log("Could not highlight event, using basic scroll");
      this.scrollToEventFallback(unfilteredIndex);
    }
  }

  clearPreviousHighlights() {
    // Remove any existing highlights
    const jsonContainer = document.getElementById("jsoneditor");
    if (jsonContainer) {
      const highlighted = jsonContainer.querySelectorAll(
        '[data-debug-highlight="true"]',
      );
      highlighted.forEach((el) => {
        el.style.backgroundColor = "";
        el.style.boxShadow = "";
        el.removeAttribute("data-debug-highlight");
      });
    }
  }

  highlightEventInDOM(eventIndex) {
    const jsonContainer = document.getElementById("jsoneditor");
    if (!jsonContainer) {
      console.log("JSON container not found");
      return false;
    }

    console.log(
      `Attempting to highlight event ${eventIndex} in JSON container`,
    );

    // Debug: Log the actual DOM structure to understand what we're working with
    console.log(
      "JSON container HTML:",
      jsonContainer.innerHTML.substring(0, 500),
    );
    console.log(
      "Available classes in container:",
      Array.from(jsonContainer.querySelectorAll("*"))
        .slice(0, 10)
        .map((el) => el.className),
    );

    // Strategy 1: Simple approach - just highlight the entire JSON area with a message
    this.addSimpleHighlight(jsonContainer, `Looking for Event #${eventIndex}`);

    // Strategy 2: Look specifically for JSON array elements in vanilla-jsoneditor
    let targetElement = null;

    // Look for array items in the JSON structure
    // Vanilla-jsoneditor creates nodes with specific structure
    const arrayElements = jsonContainer.querySelectorAll(".jse-json-node");
    console.log(`Found ${arrayElements.length} JSON nodes`);

    // Look through the array elements for our target index
    for (let i = 0; i < arrayElements.length; i++) {
      const node = arrayElements[i];

      // Look for the key that might match our event index
      const keyElement = node.querySelector(".jse-key");
      if (keyElement) {
        const keyText = keyElement.textContent.trim().replace(/"/g, "");
        console.log(`Checking node ${i}: key="${keyText}"`);

        if (keyText === eventIndex.toString()) {
          targetElement = node;
          console.log(
            `Found target element for event ${eventIndex} at node ${i}`,
          );
          break;
        }
      }
    }

    // If no exact match, try to find array items by counting
    if (!targetElement) {
      console.log("No exact key match, looking for array structure");

      // Look for the root array container
      const rootNode = jsonContainer.querySelector(".jse-json-node.jse-root");
      if (rootNode) {
        console.log("Found root node, looking for array children");

        // Look for child nodes that might represent array items
        const childNodes = rootNode.querySelectorAll(
          ":scope > .jse-content .jse-json-node",
        );
        console.log(`Found ${childNodes.length} child nodes`);

        if (eventIndex < childNodes.length) {
          targetElement = childNodes[eventIndex];
          console.log(`Using array child node at index ${eventIndex}`);
        } else {
          // Try to find any child with a key that looks like a number
          for (const child of childNodes) {
            const keyEl = child.querySelector(".jse-key");
            if (keyEl) {
              const keyText = keyEl.textContent.trim().replace(/"/g, "");
              if (keyText === eventIndex.toString()) {
                targetElement = child;
                console.log(`Found child with matching key: ${keyText}`);
                break;
              }
            }
          }
        }
      }
    }

    // Strategy 3: Look for array item containers
    if (!targetElement) {
      console.log("Looking for array item containers");

      // In vanilla-jsoneditor, array items might be grouped differently
      // Try to find elements that represent whole events (not just properties)

      // Look for nodes that might be event containers (objects with multiple properties)
      const allNodes = Array.from(
        jsonContainer.querySelectorAll(".jse-json-node:not(.jse-root)"),
      );
      console.log(`Found ${allNodes.length} non-root JSON nodes`);

      // Group nodes by their parent to find event objects
      const nodesByParent = new Map();
      allNodes.forEach((node) => {
        const parent = node.parentElement;
        if (!nodesByParent.has(parent)) {
          nodesByParent.set(parent, []);
        }
        nodesByParent.get(parent).push(node);
      });

      console.log(`Found ${nodesByParent.size} parent groups`);

      // Look for a parent that has multiple children (likely an event object)
      const eventContainers = [];
      nodesByParent.forEach((children, parent) => {
        if (children.length > 3) {
          // Events typically have multiple properties
          eventContainers.push(parent);
          console.log(
            `Found potential event container with ${children.length} properties`,
          );
        }
      });

      // If we found event containers, try to use the one at our index
      if (eventContainers.length > eventIndex) {
        targetElement = eventContainers[eventIndex];
        console.log(`Using event container at index ${eventIndex}`);
      } else {
        // Fallback: just use a calculated position based on the number of nodes
        const approximateNodeIndex = Math.floor(
          (eventIndex / this.events.length) * allNodes.length,
        );
        if (approximateNodeIndex < allNodes.length) {
          targetElement = allNodes[approximateNodeIndex];
          console.log(
            `Using approximate node at position ${approximateNodeIndex} for event ${eventIndex}`,
          );
        }
      }
    }

    // Strategy 4: Look for timestamp value in the DOM
    if (!targetElement) {
      console.log("Looking for timestamp value in DOM");
      const currentEvent = this.events[eventIndex];
      if (currentEvent && currentEvent.timestamp) {
        // Convert timestamp to string and look for it in the DOM
        const timestampStr = currentEvent.timestamp.toString();
        const timestampElements = Array.from(
          jsonContainer.querySelectorAll(".jse-value"),
        ).filter((el) => el.textContent?.trim() === timestampStr);

        if (timestampElements.length > 0) {
          targetElement =
            timestampElements[0].closest(".jse-json-node") ||
            timestampElements[0];
          console.log(`Found timestamp element for value ${timestampStr}`);
        }
      }
    }

    // Strategy 5: Calculate scroll position and highlight area around it
    if (!targetElement) {
      console.log("No specific element found, trying positional approach");

      // Calculate approximate scroll position
      const totalHeight = jsonContainer.scrollHeight;
      const eventsCount = this.events.length;
      const estimatedPosition = eventIndex * (totalHeight / eventsCount);

      console.log(
        `Scrolling to estimated position ${estimatedPosition} (${eventIndex}/${eventsCount} * ${totalHeight})`,
      );

      // Scroll to approximate position
      jsonContainer.scrollTo({
        top: estimatedPosition,
        behavior: "smooth",
      });

      // Add a visible indicator at the scroll position
      setTimeout(() => {
        this.addScrollPositionIndicator(
          jsonContainer,
          `Event #${eventIndex} (approx)`,
        );
      }, 300);

      return true;
    }

    // Strategy 6: If we found a specific element, highlight it
    if (targetElement) {
      this.addHighlightToElement(targetElement, `Event #${eventIndex}`);

      // Scroll to the element
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      console.log(
        `Successfully highlighted and scrolled to event ${eventIndex}`,
      );
      return true;
    }

    return false;
  }

  addSimpleHighlight(container, message) {
    // Add a simple border highlight to the entire container
    container.style.transition = "border 0.3s ease";
    container.style.border = "3px solid rgba(255, 193, 7, 0.8)";

    // Add a floating message
    const messageEl = document.createElement("div");
    messageEl.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 193, 7, 0.9);
      color: black;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      pointer-events: none;
    `;
    messageEl.textContent = message;

    container.style.position = "relative";
    container.appendChild(messageEl);

    // Remove after 3 seconds
    setTimeout(() => {
      container.style.border = "";
      if (messageEl.parentElement) {
        messageEl.remove();
      }
    }, 3000);
  }

  addScrollPositionIndicator(container, message) {
    // Add a visible line or indicator at the current scroll position
    const indicator = document.createElement("div");
    indicator.style.cssText = `
      position: absolute;
      top: ${container.scrollTop + container.clientHeight / 2}px;
      left: 0;
      right: 0;
      height: 3px;
      background: rgba(255, 193, 7, 0.8);
      z-index: 1000;
      pointer-events: none;
    `;

    const label = document.createElement("div");
    label.style.cssText = `
      position: absolute;
      top: -25px;
      right: 10px;
      background: rgba(255, 193, 7, 0.9);
      color: black;
      padding: 4px 8px;
      border-radius: 2px;
      font-size: 11px;
    `;
    label.textContent = message;

    indicator.appendChild(label);
    container.style.position = "relative";
    container.appendChild(indicator);

    // Remove after 4 seconds
    setTimeout(() => {
      if (indicator.parentElement) {
        indicator.remove();
      }
    }, 4000);
  }

  addHighlightToElement(element, label) {
    // Add visual highlight
    element.style.transition = "all 0.3s ease";
    element.style.backgroundColor = "rgba(255, 193, 7, 0.2)";
    element.style.boxShadow = "0 0 0 2px rgba(255, 193, 7, 0.5)";
    element.style.borderRadius = "3px";
    element.setAttribute("data-debug-highlight", "true");

    // Add a small label if there's space
    if (!element.querySelector(".debug-label")) {
      const labelEl = document.createElement("span");
      labelEl.className = "debug-label";
      labelEl.style.cssText = `
        position: absolute;
        top: -20px;
        left: 0;
        background: rgba(255, 193, 7, 0.9);
        color: #000;
        padding: 2px 6px;
        font-size: 10px;
        border-radius: 2px;
        z-index: 1000;
        pointer-events: none;
      `;
      labelEl.textContent = label;

      element.style.position = "relative";
      element.appendChild(labelEl);

      // Remove label after 3 seconds
      setTimeout(() => {
        if (labelEl.parentElement) {
          labelEl.remove();
        }
      }, 3000);
    }

    // Remove highlight after 5 seconds
    setTimeout(() => {
      if (element.getAttribute("data-debug-highlight") === "true") {
        element.style.backgroundColor = "";
        element.style.boxShadow = "";
        element.removeAttribute("data-debug-highlight");
      }
    }, 5000);
  }

  highlightJSONPanel() {
    const jsonPanel = document.querySelector(".col-lg-3:not(.debug-col) .card");
    if (jsonPanel) {
      // Add a brief highlight effect
      jsonPanel.style.transition = "box-shadow 0.3s ease";
      jsonPanel.style.boxShadow = "0 0 15px rgba(13, 110, 253, 0.5)";

      // Remove highlight after a delay
      setTimeout(() => {
        jsonPanel.style.boxShadow = "";
      }, 1000);
    }
  }

  scrollToEventFallback(eventIndex) {
    console.log(`Using fallback scroll for event index ${eventIndex}`);

    // Try DOM-based approach first
    const jsonContainer = document.getElementById("jsoneditor");
    if (jsonContainer) {
      // Look for elements that might represent array indices
      const possibleSelectors = [
        `[data-path="${eventIndex}"]`,
        `[data-index="${eventIndex}"]`,
        `.json-item:nth-child(${eventIndex + 1})`,
        `.array-item:nth-child(${eventIndex + 1})`,
      ];

      let foundElement = null;
      for (const selector of possibleSelectors) {
        try {
          foundElement = jsonContainer.querySelector(selector);
          if (foundElement) {
            console.log(`Found event element using selector: ${selector}`);
            break;
          }
        } catch (err) {
          // Invalid selector, continue
        }
      }

      if (foundElement) {
        // Scroll to the found element
        foundElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Add temporary highlight
        foundElement.style.transition = "background-color 0.5s ease";
        foundElement.style.backgroundColor = "rgba(255, 193, 7, 0.3)";
        setTimeout(() => {
          foundElement.style.backgroundColor = "";
        }, 1500);

        console.log(`Scrolled to and highlighted event element`);
      } else {
        // Fallback to approximate scroll position
        const totalHeight = jsonContainer.scrollHeight;
        const eventsCount = this.events.length;
        const approximatePosition = eventIndex * (totalHeight / eventsCount);

        jsonContainer.scrollTo({
          top: approximatePosition,
          behavior: "smooth",
        });

        console.log(
          `Fallback scroll to approximate position ${approximatePosition}px of ${totalHeight}px total`,
        );
      }
    } else {
      console.warn("JSON editor container not found for fallback scroll");
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
