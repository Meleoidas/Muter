import { GlobalKeyboardListener } from 'node-global-key-listener';
import { OBSWebSocket } from 'obs-websocket-js';
import { ApiClient } from 'vtubestudio';
import WebSocket from 'ws';
import * as fs from 'fs';

const gkl = new GlobalKeyboardListener();
const obs = new OBSWebSocket();
let keysDown = new Set();
let obsConnected = false;
let vtubeConnected = false;
let obsReconnecting = false;
let vtubeReconnecting = false;

const micSourceName = "Mic/Aux";

// ======================= //
function setAuthToken(authenticationToken) {
  fs.writeFileSync("./auth-token.json", JSON.stringify({ authToken: authenticationToken }, null, 2), {
    encoding: "utf-8",
  });
}

function getAuthToken() {
  const { authToken } = JSON.parse(fs.readFileSync("./auth-token.json", "utf-8"));
  if (typeof authToken !== "string") {
    throw new Error("The auth-token.json file must contain a string authToken value.");
  }
  return authToken;
}

const options = {
  authTokenGetter: getAuthToken,
  authTokenSetter: setAuthToken,
  pluginName: "Muter",
  pluginDeveloper: "Meleoidas",
  webSocketFactory: (url) => new WebSocket(url),
};
let apiClient = new ApiClient(options);

// Connection management
async function connectOBS() {
  if (obsConnected) return true;
  if (obsReconnecting) return false;
  
  obsReconnecting = true;
  
  try {
    await obs.connect('ws://localhost:4455');
    obsConnected = true;
    obsReconnecting = false;
    console.log('Connected to OBS WebSocket');
    return true;
  } catch (error) {
    console.log('OBS not available, retrying in 5 seconds...');
    setTimeout(() => {
      obsReconnecting = false;
      connectOBS();
    }, 5000);
    return false;
  }
}

async function connectVTube() {
  if (vtubeConnected) return true;
  if (vtubeReconnecting) return false;
  
  vtubeReconnecting = true;
  
  try {
    apiClient = new ApiClient(options);
    vtubeConnected = true;
    vtubeReconnecting = false;
    console.log('Connected to VTube Studio');
    return true;
  } catch (error) {
    console.log('VTube Studio not available, retrying in 5 seconds...');
    console.log(error);
    setTimeout(() => {
      vtubeReconnecting = false;
      connectVTube();
    }, 5000);
    return false;
  }
}

// Handle disconnections
obs.on('ConnectionClosed', () => {
  obsConnected = false;
  // Only trigger reconnection if it's not already reconnecting
  if (!obsReconnecting) {
    console.log('OBS WebSocket disconnected, attempting to reconnect...');
    setTimeout(() => {
      connectOBS();
    }, 2000);
  }
});

apiClient.on('disconnect', () => {
  vtubeConnected = false;
  // Only trigger reconnection if it's not already reconnecting
  if (!vtubeReconnecting) {
    console.log('VTube Studio disconnected, attempting to reconnect...');
    setTimeout(() => {
      connectVTube();
    }, 2000);
  }
});

// ======================= //

gkl.addListener(async (e) => {
  if (e.state === 'DOWN') keysDown.add(e.name);
  if (e.state === 'UP') keysDown.delete(e.name);

  if (keysDown.has('LEFT SHIFT') && keysDown.has('LEFT ALT') && keysDown.has('X')) {
    try {
      // Ensure OBS is connected before attempting to use it
      if (!obsConnected) {
        console.log('OBS not connected, attempting to connect...');
        const connected = await connectOBS();
        if (!connected) {
          console.error('Could not connect to OBS');
          return;
        }
      }

      await obs.call('ToggleInputMute', {inputName: micSourceName});
      const { inputMuted } = await obs.call('GetInputMute', {inputName: micSourceName});
      
      if(inputMuted) {
        // Ensure VTube Studio is connected before attempting to use it
        if (!vtubeConnected) {
          console.log('VTube Studio not connected, attempting to connect...');
          const connected = await connectVTube();
          if (!connected) {
            console.error('Could not connect to VTube Studio');
            return;
          }
        }

        if (apiClient.isConnected) {
          const item = await apiClient.itemLoad({ fileName: 'mute.png' });
          const model = await apiClient.currentModel();

          if (model && item) {
            await apiClient.itemPin({
              angleRelativeTo: 'RelativeToPinPosition',
              itemInstanceID: item.instanceID,
              pin: true,
              pinInfo: {
                angle: -110,
                size: 0.15,
                artMeshID: 'ArtMesh25'
              },
              sizeRelativeTo: 'RelativeToWorld',
              vertexPinType: 'Center',
            });
          } else {
            console.error('Could not pin item: missing modelID or instanceID');
          }
        } else {
          console.error('Problem connecting to VTube Studio');
        } 
      } else {
        // Ensure VTube Studio is connected before attempting to unload
        if (vtubeConnected && apiClient.isConnected) {
          try {
            await apiClient.itemUnload({
              unloadAllLoadedByThisPlugin: true,
            });
          } catch (error) {
            console.error('Error unloading:', error);
          }
        }
      }
    } catch (err) {
      console.error('Error:', err);
    }
  }
});

// Start connection attempts
console.log('Starting Muter plugin...');
console.log('Press Shift+Alt+X to toggle microphone mute');
connectOBS();
connectVTube();