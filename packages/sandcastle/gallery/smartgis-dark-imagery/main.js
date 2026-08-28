import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.globe.enableLighting = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 3000000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-60), roll: 0 },
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

const darkStyles = {
  "Esri Dark Gray": {
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
    type: "arcgis",
  },
  "CartoDB Dark Matter": {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    type: "url",
    subdomains: ["a", "b", "c", "d"],
    credit: "CartoDB",
  },
  "CartoDB Voyager": {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    type: "url",
    subdomains: ["a", "b", "c", "d"],
    credit: "CartoDB",
  },
  "Stamen Toner": {
    url: "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png",
    type: "url",
    credit: "Stamen/Stadia",
  },
  "自定义深色 (globe tint)": {
    type: "custom",
  },
};

function loadDarkStyle(name) {
  const config = darkStyles[name];
  imageryLayers.removeAll();
  scene.globe.baseColor = Cesium.Color.BLACK;

  if (config.type === "arcgis") {
    const p = new Cesium.ArcGisMapServerImageryProvider({ url: config.url });
    p.errorEvent.addEventListener((e) => console.warn(`[${name}]`, e.message || e));
    imageryLayers.addImageryProvider(p);
  } else if (config.type === "url") {
    const p = new Cesium.UrlTemplateImageryProvider({
      url: config.url,
      subdomains: config.subdomains,
      maximumLevel: 18,
      credit: config.credit || "",
    });
    p.errorEvent.addEventListener((e) => console.warn(`[${name}]`, e.message || e));
    imageryLayers.addImageryProvider(p);
  } else if (config.type === "custom") {
    scene.globe.baseColor = Cesium.Color.fromCssColorString("#0a0a1a");
    const layer = imageryLayers.addImageryProvider(
      new Cesium.TileMapServiceImageryProvider({
        url: Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
      }),
    );
    layer.brightness = 0.3;
    layer.contrast = 1.5;
    layer.saturation = 0.1;
  }

  showStatus(`<b>深色底图:</b> ${name}`);
}

Sandcastle.addDefaultToolbarButton("CartoDB Dark", () => loadDarkStyle("CartoDB Dark Matter"));
Sandcastle.addToolbarButton("Esri Dark Gray", () => loadDarkStyle("Esri Dark Gray"));
Sandcastle.addToolbarButton("CartoDB Voyager", () => loadDarkStyle("CartoDB Voyager"));
Sandcastle.addToolbarButton("Stamen Toner", () => loadDarkStyle("Stamen Toner"));
Sandcastle.addToolbarButton("自定义深色 (tint)", () => loadDarkStyle("自定义深色 (globe tint)"));

Sandcastle.addToolbarButton("切换光照", () => {
  scene.globe.enableLighting = !scene.globe.enableLighting;
  showStatus(`光照: ${scene.globe.enableLighting ? "开" : "关"}`);
});

Sandcastle.reset = function () {
  imageryLayers.removeAll();
  scene.globe.baseColor = Cesium.Color.BLACK;
  scene.globe.enableLighting = false;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
