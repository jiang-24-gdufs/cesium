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
  "<b>ArcGIS MapServer 4490 影像</b><br><br>" +
  "EPSG:4490 为 CGCS2000 大地坐标系<br>" +
  "与 WGS84 (EPSG:4326) 几乎一致<br>" +
  "差异在厘米级，多数场景可直接使用",
);

function loadArcGISLayer(url, name, tileScheme) {
  imageryLayers.removeAll();
  const options = { url };
  if (tileScheme === "geographic") {
    options.tilingScheme = new Cesium.GeographicTilingScheme();
  }

  const provider = new Cesium.ArcGisMapServerImageryProvider(options);
  provider.errorEvent.addEventListener((e) => {
    console.warn(`[ArcGIS ${name}]`, e.message || e);
    showStatus(`<b style="color:#f44">${name} 加载失败</b><br>服务可能不可达`);
  });
  imageryLayers.addImageryProvider(provider);
  showStatus(
    `<b>ArcGIS:</b> ${name}<br>` +
    `坐标系: ${tileScheme === "geographic" ? "EPSG:4490/4326 (Geographic)" : "Web Mercator"}<br>` +
    `切片方案: ${tileScheme === "geographic" ? "GeographicTilingScheme" : "WebMercatorTilingScheme"}`,
  );
}

Sandcastle.addDefaultToolbarButton("World Imagery (3857)", () => {
  loadArcGISLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    "World Imagery",
    "mercator",
  );
});

Sandcastle.addToolbarButton("World Topo (3857)", () => {
  loadArcGISLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer",
    "World Topo Map",
    "mercator",
  );
});

Sandcastle.addToolbarButton("模拟 4490 (Geographic)", () => {
  loadArcGISLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    "World Imagery (Geographic 切片)",
    "geographic",
  );
});

Sandcastle.addToolbarButton("坐标系说明", () => {
  showStatus(
    "<b>EPSG:4490 与 4326 对比</b><br><br>" +
    "EPSG:4326 (WGS84):<br>  GPS 全球标准椭球<br><br>" +
    "EPSG:4490 (CGCS2000):<br>  中国国家大地坐标系<br>  椭球参数与 WGS84 几乎一致<br>  差异 < 1cm<br><br>" +
    "ArcGIS MapServer 4490 切片:<br>  使用 GeographicTilingScheme<br>  经纬度直接映射",
  );
});

Sandcastle.reset = function () {
  imageryLayers.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
