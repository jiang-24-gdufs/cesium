import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer");

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.globe.enableLighting = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(-112.0, 36.1, 50000),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-30),
    roll: 0,
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

function setupHeightProbe() {
  if (handler) handler.destroy();
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction(function (movement) {
    const ray = viewer.camera.getPickRay(movement.endPosition);
    if (!ray) return;
    const pos = scene.globe.pick(ray, scene);
    if (pos) {
      const c = Cesium.Cartographic.fromCartesian(pos);
      showStatus(
        `<b>ArcGIS 地形</b><br>` +
        `经: ${Cesium.Math.toDegrees(c.longitude).toFixed(5)}°<br>` +
        `纬: ${Cesium.Math.toDegrees(c.latitude).toFixed(5)}°<br>` +
        `高: ${c.height.toFixed(1)}m`,
      );
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

Sandcastle.addDefaultToolbarButton("ArcGIS 地形", function () {
  viewer.scene.setTerrain(
    new Cesium.Terrain(
      Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
        "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
      ),
    ),
  );
  showStatus("<b>已加载:</b> ArcGIS WorldElevation3D");
  setupHeightProbe();
});

Sandcastle.addToolbarButton("Cesium World Terrain", function () {
  viewer.scene.setTerrain(
    Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true }),
  );
  showStatus("<b>已加载:</b> Cesium World Terrain");
  setupHeightProbe();
});

Sandcastle.addToolbarButton("无地形", function () {
  viewer.scene.setTerrain(new Cesium.Terrain(new Cesium.EllipsoidTerrainProvider()));
  showStatus("<b>已加载:</b> 平坦椭球面");
  setupHeightProbe();
});

Sandcastle.addToolbarButton("地形夸张 ×3", function () {
  scene.globe.terrainExaggeration = 3.0;
  showStatus("<b>地形夸张: ×3</b>");
});

Sandcastle.addToolbarButton("地形夸张 ×1", function () {
  scene.globe.terrainExaggeration = 1.0;
  showStatus("<b>地形夸张: ×1</b>");
});

Sandcastle.addToolbarButton("飞到大峡谷", function () {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-112.0, 36.1, 15000),
    orientation: {
      heading: Cesium.Math.toRadians(30),
      pitch: Cesium.Math.toRadians(-20),
      roll: 0,
    },
    duration: 2,
  });
});

setupHeightProbe();
showStatus("<b>ArcGIS 地形</b><br>移动鼠标查看地形高度");

Sandcastle.reset = function () {
  if (handler) {
    handler.destroy();
    handler = null;
  }
  scene.globe.terrainExaggeration = 1.0;
  scene.globe.enableLighting = false;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
