import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const TDT_TOKEN = "your_tianditu_token_here";

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

function createTdtProvider(layer) {
  return new Cesium.UrlTemplateImageryProvider({
    url: `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${TDT_TOKEN}`,
    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
    maximumLevel: 18,
    credit: "天地图",
  });
}

function loadLayers(layers, label) {
  if (TDT_TOKEN === "your_tianditu_token_here") {
    showStatus('<b style="color:#f44">天地图 Token 未配置</b><br>修改代码顶部 TDT_TOKEN');
    return;
  }
  imageryLayers.removeAll();
  for (const l of layers) {
    const p = createTdtProvider(l);
    p.errorEvent.addEventListener((e) => console.warn(`[天地图 ${l}]`, e.message || e));
    imageryLayers.addImageryProvider(p);
  }
  showStatus(`<b>当前:</b> ${label}<br>图层数: ${layers.length}`);
}

Sandcastle.addDefaultToolbarButton("矢量 + 注记", () => loadLayers(["vec", "cva"], "矢量底图 + 中文注记"));
Sandcastle.addToolbarButton("影像 + 注记", () => loadLayers(["img", "cia"], "影像底图 + 中文注记"));
Sandcastle.addToolbarButton("地形晕渲 + 注记", () => loadLayers(["ter", "cta"], "地形晕渲 + 中文注记"));
Sandcastle.addToolbarButton("仅矢量", () => loadLayers(["vec"], "仅矢量底图"));
Sandcastle.addToolbarButton("仅影像", () => loadLayers(["img"], "仅影像底图"));
Sandcastle.addToolbarButton("仅地形", () => loadLayers(["ter"], "仅地形晕渲"));

if (TDT_TOKEN === "your_tianditu_token_here") {
  showStatus('<b style="color:#f44">天地图 Token 未配置</b><br>修改代码顶部 TDT_TOKEN<br>申请: lbs.tianditu.gov.cn');
}

Sandcastle.reset = function () {
  imageryLayers.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
