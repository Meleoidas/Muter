# Muter

A small Node.js utility that toggles the OBS microphone mute state from a global keyboard shortcut and shows/removes a mute indicator in VTube Studio.

Press **Shift+Alt+X** to toggle the microphone. When the microphone is muted, Muter loads and pins `mute.png` to the current model (specific mesh specified in server.js); when unmuted, it unloads items loaded by the plugin.

## Requirements

- Node.js and npm
- OBS Studio with its WebSocket server enabled (the default connection is `ws://localhost:4455`)
- A microphone input in OBS named `Mic/Aux`, or update `micSourceName` in `server.js` to match your input
- VTube Studio running with its API available
- The `mute.png` item available in VTube Studio's item library

## `auth-token.json` Content:
   ```json
   {
     "authToken": VTUBE_STUDIO_AUTH_TOKEN
   }
   ```