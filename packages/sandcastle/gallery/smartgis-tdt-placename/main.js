import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const TDT_TOKEN = "your_tianditu_token_here";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 200000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
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

const samplePlaces = [
  { name: "广州塔", lon: 113.3244, lat: 23.1063, height: 600 },
  { name: "白云山", lon: 113.2985, lat: 23.1837, height: 382 },
  { name: "珠江新城", lon: 113.321, lat: 23.119, height: 50 },
  { name: "天河体育中心", lon: 113.3166, lat: 23.1377, height: 30 },
  { name: "中山纪念堂", lon: 113.2652, lat: 23.1355, height: 25 },
  { name: "广州南站", lon: 113.2688, lat: 22.9895, height: 20 },
  { name: "广州东站", lon: 113.3248, lat: 23.1511, height: 15 },
  { name: "琶洲会展", lon: 113.3589, lat: 23.1052, height: 40 },
];

let annotationLayer = null;
let showLabels = true;

function addTdtAnnotation() {
  if (TDT_TOKEN === "your_tianditu_token_here") {
    showStatus('<b style="color:#f44">天地图 Token 未配置</b>');
    return;
  }
  if (annotationLayer) {
    imageryLayers.remove(annotationLayer);
  }
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: `https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${TDT_TOKEN}`,
    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
    maximumLevel: 18,
    credit: "天地图",
  });
  provider.errorEvent.addEventListener((e) => console.warn("[天地图注记]", e.message || e));
  annotationLayer = imageryLayers.addImageryProvider(provider);
  showStatus("<b>天地图中文地名注记已叠加</b>");
}

function addCesiumLabels() {
  viewer.entities.removeAll();
  for (const p of samplePlaces) {
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.height),
      label: {
        text: p.name,
        font: "14px sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.5),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 500000, 0.3),
      },
      point: {
        pixelSize: 6,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
  }
  showStatus(`<b>Cesium 三维地名标注:</b> ${samplePlaces.length} 个`);
}

Sandcastle.addDefaultToolbarButton("Cesium 三维标注", () => {
  addCesiumLabels();
});

Sandcastle.addToolbarButton("天地图注记叠加", () => {
  addTdtAnnotation();
});

Sandcastle.addToolbarButton("显示/隐藏标注", () => {
  showLabels = !showLabels;
  const entities = viewer.entities.values;
  for (const e of entities) {
    if (e.label) e.show = showLabels;
  }
  showStatus(`标注: ${showLabels ? "显示" : "隐藏"}`);
});

Sandcastle.addToolbarButton("飞到全部", () => {
  viewer.flyTo(viewer.entities, { duration: 1.5 });
});

if (TDT_TOKEN === "your_tianditu_token_here") {
  showStatus(
    '<b>天地图地名标注(三维)</b><br>' +
    'Cesium 标注无需 Token<br>' +
    '<span style="color:#fa0">天地图注记需配置 TDT_TOKEN</span>',
  );
}

Sandcastle.reset = function () {
  viewer.entities.removeAll();
  if (annotationLayer) {
    imageryLayers.remove(annotationLayer);
    annotationLayer = null;
  }
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
