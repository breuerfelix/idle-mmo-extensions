# IdleMMO Market Helper Extension

A Chrome browser extension that adds market value information to IdleMMO inventory items.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension` folder
4. The extension should now appear in your extensions list

## Usage

1. Click the extension icon in your browser toolbar
2. Enter your IdleMMO API key in the popup
3. Navigate to `https://web.idle-mmo.com/inventory`
4. When you select an item to inspect, the extension will add a "Market Value" field

## Features

- Persistent API key storage using Chrome's sync storage
- Automatic injection of market value information
- Clean UI integration with IdleMMO's existing design
- Dynamic content monitoring for single-page application compatibility

## Development

The extension consists of:

- `manifest.json` - Extension configuration
- `popup.html/js` - Settings popup for API key entry
- `content.js` - Main script that injects market data
- Icon files (placeholder for now)
