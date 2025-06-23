# rrwebdebug.com

A debugging tool for RRWeb recordings with integrated analysis capabilities.

## Features

- **RRWeb Player**: Play and debug RRWeb recordings in the browser
- **Recording Analysis**: Detailed analysis of recording events, sizes, and performance metrics
- Support for multiple input methods (file upload, URL, paste JSON)
- Version selector for different RRWeb player versions

## Recording Analysis

The analysis feature provides detailed insights into your RRWeb recordings, including:

- **Message Type Counts**: Breakdown of different event types (FullSnapshot, IncrementalSnapshot, etc.)
- **Event Source Analysis**: Detailed analysis of incremental snapshot sources (MouseMove, Mutation, Scroll, etc.) with size information
- **Mutation Analysis**: Analysis of DOM mutations including additions, removals, and attribute changes
- **Performance Metrics**: Total event count, recording size, and duration
- **Export Functionality**: Export analysis results as JSON

### How to Use Analysis

1. Load a recording in the player
2. Click the "📊 Analysis" button in the top navigation
3. The analysis will open in a new tab with detailed metrics

The analysis is based on [PostHog's exported-recordings-analyzer](https://github.com/PostHog/exported-recordings-analyzer) but ported to JavaScript for client-side analysis.

## Development

### Adding New RRWeb Versions

Add rrweb-player version number to bottom of `src/versions.json`.
