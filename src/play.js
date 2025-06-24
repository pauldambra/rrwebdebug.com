import versionsJson from "./versions.json";
import populateVersions from "./populate-versions";
import { createJSONEditor } from "vanilla-jsoneditor";
import "./debug.js";

function allowedVersion(version) {
  const allVersions = Object.keys(versionsJson);
  return allVersions.includes(version);
}

function defaultVersion() {
  const defaultVersion = Object.entries(versionsJson).find(
    ([_version, { default: isDefault }]) => {
      if (isDefault) return true;
    },
  );
  return defaultVersion?.[0];
}

function scriptSRC(version, type = "cjs") {
  switch (type) {
    case "legacy":
      return `https://cdn.jsdelivr.net/npm/rrweb-player@${version}/dist/index.js`;
    case "js":
      return `https://unpkg.dev/rrweb-player@${version}/dist/rrweb.js`;
    case "cjs":
      // return `https://cdn.jsdelivr.net/npm/rrweb-player@${version}/dist/rrweb-player.umd.cjs`; // <= https://github.com/jsdelivr/jsdelivr/issues/18584
      return `https://unpkg.dev/rrweb-player@${version}/dist/rrweb-player.umd.cjs`;
    case "posthog":
      return `https://unpkg.dev/@posthog/rrweb-player@${version}/dist/rrweb-player.umd.cjs`;
    default:
      console.error("Unknown type: " + type);
  }
}

function styleHref(version) {
  return `https://cdn.jsdelivr.net/npm/rrweb-player@${version}/dist/style.css`;
}

function setupVersionSelector(version) {
  populateVersions(version);
  const versions = document.getElementById("versions");
  versions.addEventListener("change", (e) => {
    const newVersion = e.target.value;
    // reload page with selected version, preserving all other parameters
    const location = new URL(document.location);
    location.searchParams.set("version", newVersion);

    // For local data, make sure we preserve the source parameter
    if (location.searchParams.get("source") === "local") {
      // Verify sessionStorage still has the data before reloading
      const storedEvents = sessionStorage.getItem("rrweb-events");
      if (!storedEvents) {
        alert("Local data was lost. Please go back and reload your events.");
        return;
      }
    }

    document.location.href = location.href;
  });
}

function setupModeSelector() {
  // Get mode radio buttons
  const playerMode = document.getElementById("player-mode");
  const debugMode = document.getElementById("debug-mode");

  if (playerMode && debugMode) {
    // Check URL for initial debug mode state
    const location = new URL(document.location);
    const debugParam = location.searchParams.get("debug");

    if (debugParam === "true") {
      debugMode.checked = true;
      playerMode.checked = false;
      // Activate debug mode after everything is loaded
      setTimeout(() => {
        if (window.debugManager) {
          window.debugManager.enterDebugMode();
        }
      }, 100);
    }

    // Player mode handler
    playerMode.addEventListener("change", () => {
      if (playerMode.checked) {
        exitAllModes();
        updateURLForMode(false);
      }
    });

    // Debug mode handler
    debugMode.addEventListener("change", () => {
      if (debugMode.checked) {
        exitAllModes();
        if (window.debugManager) {
          window.debugManager.enterDebugMode();
        } else {
          console.error("Debug manager not available!");
        }
        updateURLForMode(true);
      }
    });
  } else {
    console.error("Mode selector buttons not found!");
  }
}

function updateURLForMode(isDebugMode) {
  const location = new URL(document.location);

  if (isDebugMode) {
    location.searchParams.set("debug", "true");
  } else {
    location.searchParams.delete("debug");
  }

  // Update URL without reloading the page
  window.history.replaceState({}, document.title, location.href);
}

// Make the function available globally for the debug manager
window.updateURLForMode = updateURLForMode;

function setupAnalysisButton() {
  const analysisBtn = document.getElementById("analysisBtn");

  if (analysisBtn) {
    analysisBtn.addEventListener("click", () => {
      openAnalysisPage();
    });
  } else {
    console.error("Analysis button not found!");
  }
}

function exitAllModes() {
  // Exit debug mode if active
  if (window.debugManager && window.debugManager.isDebugMode) {
    window.debugManager.exitDebugMode();
  }
}

function openAnalysisPage() {
  // Open analysis page in new tab
  const analysisUrl = new URL(window.location.origin + "/analysis/");

  // If we have a URL source, pass it to the analysis page
  const location = new URL(document.location);
  const url = location.searchParams.get("url");
  if (url) {
    analysisUrl.searchParams.set("url", url);
  }

  window.open(analysisUrl.href, "_blank");
}

async function playVideo(events, config) {
  const Player = window.rrwebPlayer.Player || window.rrwebPlayer; // for legacy version
  const component = new Player({
    target: document.getElementById("player"),
    data: {
      events,
      skipInactive: true,
      showDebug: true,
      showWarning: true,
      autoPlay: config.autoPlay,
      useVirtualDom: config.useVirtualDom,
      UNSAFE_replayCanvas: config.canvas,
      mouseTail: {
        strokeStyle: "yellow",
      },
    },
  });
  window.$c = component;
  window.events = events;
  document.querySelector(".loading").style.display = "none";
  component.addEventListener("finish", () => console.log("finish"));

  // Initialize debug functionality
  window.debugManager.setPlayer(component);
  window.debugManager.setEvents(events);
}

function showJSON(json) {
  const container = document.getElementById("jsoneditor");

  const editor = createJSONEditor({
    target: container,
    props: {
      content: { json },
      mode: "view",
      mainMenuBar: false,
      navigationBar: false,
    },
  });

  // Store editor globally for debug access
  window.jsonEditor = editor;
  window.events = json;
}

function getGistId(url) {
  const match = /gist.github(?:usercontent)?.com\/[^/]+\/(\w+)/.exec(url);
  return match?.[1] || false;
}

function getJSONBlobId(url) {
  const match = /https?:\/\/jsonblob.com\/([\w\-]+)/.exec(url);
  return match?.[1] || false;
}

// Add IndexedDB helper functions at the top
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("rrweb-storage", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("events")) {
        db.createObjectStore("events");
      }
    };
  });
}

function getEventsFromIndexedDB() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(["events"], "readonly");
      const store = transaction.objectStore("events");
      const request = store.get("rrweb-events");

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

async function startPlayer() {
  const location = new URL(document.location);
  const url = location.searchParams.get("url");
  const source = location.searchParams.get("source");
  let version = location.searchParams.get("version");

  console.log("Starting player with:", { url, source, version });

  if (!allowedVersion(version)) version = defaultVersion();
  const type = versionsJson[version].type;
  const canvas = Boolean(location.searchParams.get("canvas"));
  const autoPlay = Boolean(location.searchParams.get("play"));
  const useVirtualDom = Boolean(location.searchParams.get("virtual-dom"));
  let events;

  if (source === "local") {
    // Load events from IndexedDB first, then fallback to sessionStorage
    try {
      console.log("Trying to load from IndexedDB...");
      events = await getEventsFromIndexedDB();

      if (events) {
        console.log("Loaded events from IndexedDB:", events.length, "events");
      } else {
        console.log("No IndexedDB data, trying sessionStorage...");
        const storedEvents = sessionStorage.getItem("rrweb-events");

        if (!storedEvents) {
          alert("No events data found. Please go back and select your events.");
          return;
        }

        events = JSON.parse(storedEvents);
        console.log(
          "Loaded events from sessionStorage:",
          events.length,
          "events",
        );
      }

      // Update the JSON source display to show it's local data
      document.getElementById("json-source").innerText =
        "Local data (file upload or paste)";
    } catch (error) {
      console.error("Error loading local events data:", error);
      alert("Error loading local events data: " + error.message);
      return;
    }
  } else {
    // Existing URL-based loading logic
    const gistId = getGistId(url);
    const jsonBlobId = getJSONBlobId(url);
    if (gistId) {
      try {
        const gistApiRequest = await fetch(
          `https://api.github.com/gists/${gistId}`,
        );
        const apiResponse = await gistApiRequest.json();
        const files = Object.values(apiResponse.files);
        if (files[0].truncated) {
          const eventsRequest = await fetch(files[0].raw_url);
          events = await eventsRequest.json();
        } else {
          events = JSON.parse(files[0].content);
        }
      } catch (error) {
        alert("something went wrong, please check the console");
        console.error(error);
      }
    } else if (jsonBlobId) {
      try {
        const jsonBlobApiRequest = await fetch(
          `https://jsonblob.com/api/v1/get/${jsonBlobId}`,
        );
        events = await jsonBlobApiRequest.json();
      } catch (error) {
        alert("something went wrong, please check the console");
        console.error(error);
      }
    } else {
      try {
        const eventsRequest = await fetch(url);
        events = await eventsRequest.json();
      } catch (error) {
        alert("something went wrong, please check the console");
        console.error(error);
      }
    }

    document.getElementById("json-source").innerText = url;
  }

  const styleEl = document.createElement("link");
  styleEl.setAttribute("rel", "stylesheet");
  styleEl.setAttribute("href", styleHref(version));
  document.head.appendChild(styleEl);

  const scriptEl = document.createElement("script");
  scriptEl.setAttribute("src", scriptSRC(version, type));
  scriptEl.setAttribute("type", "application/javascript");
  scriptEl.addEventListener("load", function () {
    playVideo(events, {
      canvas,
      autoPlay,
      useVirtualDom,
    });
    showJSON(events);
  });

  setupVersionSelector(version);
  setupModeSelector();
  setupAnalysisButton();
  document.head.appendChild(scriptEl);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startPlayer);
} else {
  startPlayer();
}
