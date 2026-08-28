import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  selectionIndicator: false,
  infoBox: false,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

const modelPos = { lon: -123.0744619, lat: 44.0503706, height: 0 };

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(modelPos.lon, modelPos.lat, 500),
  orientation: { heading: Cesium.Math.toRadians(30), pitch: Cesium.Math.toRadians(-30), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

const modelEntity = viewer.entities.add({
  name: "可编辑模型",
  position: new Cesium.CallbackProperty(() =>
    Cesium.Cartesian3.fromDegrees(modelPos.lon, modelPos.lat, modelPos.height), false),
  model: {
    uri: "../../SampleData/models/CesiumMilkTruck/CesiumMilkTruck.glb",
    minimumPixelSize: 64,
    maximumScale: 200,
  },
});

let handler = null;
let isDragging = false;

function updateStatus() {
  showStatus(
    `<b>位置编辑</b><br>` +
    `经度: ${modelPos.lon.toFixed(6)}°<br>` +
    `纬度: ${modelPos.lat.toFixed(6)}°<br>` +
    `高度: ${modelPos.height.toFixed(1)}m<br>` +
    `<br>拖拽模型移动位置<br>` +
    `按钮调整高度`,
  );
}

function enableDrag() {
  if (handler) handler.destroy();

  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (click) {
    const picked = scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id === modelEntity) {
      isDragging = true;
      scene.screenSpaceCameraController.enableInputs = false;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction(function (movement) {
    if (!isDragging) return;
    const ray = viewer.camera.getPickRay(movement.endPosition);
    if (!ray) return;
    const pos = scene.globe.pick(ray, scene);
    if (pos) {
      const carto = Cesium.Cartographic.fromCartesian(pos);
      modelPos.lon = Cesium.Math.toDegrees(carto.longitude);
      modelPos.lat = Cesium.Math.toDegrees(carto.latitude);
      updateStatus();
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function () {
    isDragging = false;
    scene.screenSpaceCameraController.enableInputs = true;
  }, Cesium.ScreenSpaceEventType.LEFT_UP);
}

enableDrag();
updateStatus();

Sandcastle.addDefaultToolbarButton("编辑模式", () => {
  enableDrag();
  showStatus("<b>编辑模式已启用</b><br>拖拽模型移动");
});

Sandcastle.addToolbarButton("升高 +50m", () => {
  modelPos.height += 50;
  updateStatus();
});

Sandcastle.addToolbarButton("降低 -50m", () => {
  modelPos.height = Math.max(0, modelPos.height - 50);
  updateStatus();
});

Sandcastle.addToolbarButton("重置位置", () => {
  modelPos.lon = -123.0744619;
  modelPos.lat = 44.0503706;
  modelPos.height = 0;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(modelPos.lon, modelPos.lat, 500),
    orientation: { heading: Cesium.Math.toRadians(30), pitch: Cesium.Math.toRadians(-30), roll: 0 },
    duration: 1,
  });
  updateStatus();
});

Sandcastle.addToolbarButton("飞到模型", () => {
  viewer.flyTo(modelEntity, { duration: 1 });
});

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  isDragging = false;
  viewer.entities.removeAll();
  scene.screenSpaceCameraController.enableInputs = true;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
