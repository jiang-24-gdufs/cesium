import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

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

showStatus(
  "<b>SmartImagery 影像</b><br><br>" +
  "SmartImagery 为私有影像服务<br>" +
  "此处演示公开影像替代方案:<br>" +
  "• Cesium Ion 默认影像<br>" +
  "• ArcGIS World Imagery<br>" +
  "• OpenStreetMap<br>" +
  "• 自定义 TMS/WMTS/WMS 接入模式",
);

function loadLayer(providerPromise, name) {
  imageryLayers.removeAll();
  if (providerPromise instanceof Cesium.ImageryProvider || (providerPromise && providerPromise.then === undefined)) {
    const p = providerPromise;
    p.errorEvent.addEventListener((e) => console.warn(`[${name}]`, e.message || e));
    imageryLayers.addImageryProvider(p);
  } else {
    imageryLayers.addImageryProvider(providerPromise);
  }
  showStatus(`<b>影像图层:</b> ${name}`);
}

Sandcastle.addDefaultToolbarButton("Cesium Ion 默认", () => {
  imageryLayers.removeAll();
  imageryLayers.addImageryProvider(
    new Cesium.IonImageryProvider({ assetId: 2 }),
  );
  showStatus("<b>Cesium Ion 默认影像</b>");
});

Sandcastle.addToolbarButton("ArcGIS Imagery", () => {
  loadLayer(
    new Cesium.ArcGisMapServerImageryProvider({
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    }),
    "ArcGIS World Imagery",
  );
});

Sandcastle.addToolbarButton("OpenStreetMap", () => {
  loadLayer(
    new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
    "OpenStreetMap",
  );
});

Sandcastle.addToolbarButton("NaturalEarth II", () => {
  loadLayer(
    new Cesium.TileMapServiceImageryProvider({
      url: Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
    }),
    "NaturalEarth II (内置)",
  );
});

Sandcastle.addToolbarButton("自定义 TMS 模板", () => {
  showStatus(
    "<b>自定义 TMS/WMTS 接入</b><br><br>" +
    "const provider = new Cesium.UrlTemplateImageryProvider({<br>" +
    '&nbsp;&nbsp;url: "https://your-server/{z}/{x}/{y}.png",<br>' +
    "&nbsp;&nbsp;maximumLevel: 18,<br>" +
    "});<br>" +
    "viewer.imageryLayers.addImageryProvider(provider);",
  );
});

Sandcastle.addToolbarButton("调整透明度", () => {
  if (imageryLayers.length > 0) {
    const layer = imageryLayers.get(0);
    layer.alpha = layer.alpha === 1.0 ? 0.5 : 1.0;
    showStatus(`图层透明度: ${(layer.alpha * 100).toFixed(0)}%`);
  }
});

Sandcastle.reset = function () {
  imageryLayers.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
