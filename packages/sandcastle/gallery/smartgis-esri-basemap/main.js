import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(104.06, 30.67, 8000000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
});

const imageryLayers = viewer.imageryLayers;

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

const esriLayers = {
  "World Street Map": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
  "World Imagery": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
  "World Topo Map": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer",
  "NatGeo World Map": "https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer",
  "World Terrain Base": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer",
  "Canvas Dark Gray": "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
};

function loadEsriLayer(name) {
  const url = esriLayers[name];
  imageryLayers.removeAll();
  const provider = new Cesium.ArcGisMapServerImageryProvider({ url });
  provider.errorEvent.addEventListener((e) => console.warn(`[Esri ${name}]`, e.message || e));
  imageryLayers.addImageryProvider(provider);
  showStatus(`<b>Esri:</b> ${name}`);
}

Sandcastle.addDefaultToolbarButton("World Street Map", () => loadEsriLayer("World Street Map"));
Sandcastle.addToolbarButton("World Imagery", () => loadEsriLayer("World Imagery"));
Sandcastle.addToolbarButton("World Topo", () => loadEsriLayer("World Topo Map"));
Sandcastle.addToolbarButton("NatGeo", () => loadEsriLayer("NatGeo World Map"));
Sandcastle.addToolbarButton("Terrain Base", () => loadEsriLayer("World Terrain Base"));
Sandcastle.addToolbarButton("Dark Gray", () => loadEsriLayer("Canvas Dark Gray"));

Sandcastle.reset = function () {
  imageryLayers.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
