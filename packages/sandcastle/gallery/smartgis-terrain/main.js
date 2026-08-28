import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain({
    requestVertexNormals: true,
    requestWaterMask: true,
  }),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.globe.enableLighting = true;

scene.camera.setView({
  destination: new Cesium.Cartesian3(
    -2489625.0836225147,
    -4393941.44443024,
    3882535.913856459,
  ),
  orientation: {
    heading: 6.0,
    pitch: -0.6,
  },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

let handler = null;

function setupHeightSampling() {
  if (handler) handler.destroy();
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (movement) {
    const ray = viewer.camera.getPickRay(movement.endPosition);
    if (!ray) return;
    const position = scene.globe.pick(ray, scene);
    if (position) {
      const carto = Cesium.Cartographic.fromCartesian(position);
      const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(5);
      const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(5);
      const height = carto.height.toFixed(1);
      showStatus(
        `<b>公网地形</b><br>` +
        `经度: ${lon}°<br>` +
        `纬度: ${lat}°<br>` +
        `地形高: ${height}m<br>` +
        `光照: ${scene.globe.enableLighting ? "开" : "关"}<br>` +
        `法线: ${scene.globe.terrainProvider.hasVertexNormals ? "有" : "无"}<br>` +
        `水面: ${scene.globe.terrainProvider.hasWaterMask ? "有" : "无"}`,
      );
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

setupHeightSampling();

Sandcastle.addDefaultToolbarButton("Cesium World Terrain", function () {
  viewer.scene.setTerrain(
    Cesium.Terrain.fromWorldTerrain({
      requestVertexNormals: true,
      requestWaterMask: true,
    }),
  );
  showStatus("<b>已加载:</b> Cesium World Terrain");
});

Sandcastle.addToolbarButton("无地形 (椭球面)", function () {
  viewer.scene.setTerrain(new Cesium.Terrain(new Cesium.EllipsoidTerrainProvider()));
  showStatus("<b>已加载:</b> EllipsoidTerrainProvider (平坦椭球)");
});

Sandcastle.addToolbarButton("地形夸张 ×2", function () {
  scene.globe.terrainExaggeration = 2.0;
  showStatus("<b>地形夸张:</b> ×2");
});

Sandcastle.addToolbarButton("地形夸张 ×5", function () {
  scene.globe.terrainExaggeration = 5.0;
  showStatus("<b>地形夸张:</b> ×5");
});

Sandcastle.addToolbarButton("地形夸张 ×1 (还原)", function () {
  scene.globe.terrainExaggeration = 1.0;
  showStatus("<b>地形夸张:</b> ×1 (正常)");
});

Sandcastle.addToolbarButton("切换光照", function () {
  scene.globe.enableLighting = !scene.globe.enableLighting;
  showStatus(`光照: ${scene.globe.enableLighting ? "开" : "关"}`);
});

Sandcastle.addToolbarButton("飞到珠峰", function () {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(86.925, 27.988, 12000),
    orientation: {
      heading: Cesium.Math.toRadians(-20),
      pitch: Cesium.Math.toRadians(-15),
      roll: 0,
    },
    duration: 2,
  });
});

Sandcastle.reset = function () {
  if (handler) {
    handler.destroy();
    handler = null;
  }
  scene.globe.terrainExaggeration = 1.0;
  scene.globe.enableLighting = false;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
