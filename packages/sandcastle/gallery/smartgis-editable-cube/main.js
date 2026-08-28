import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  selectionIndicator: false,
  infoBox: false,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 3000),
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

let cubeEntity = null;
let handler = null;
let cubeParams = { lon: 113.32, lat: 23.11, width: 200, depth: 200, height: 100 };

function createCube() {
  if (cubeEntity) viewer.entities.remove(cubeEntity);

  cubeEntity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(cubeParams.lon, cubeParams.lat, cubeParams.height / 2),
    box: {
      dimensions: new Cesium.Cartesian3(cubeParams.width, cubeParams.depth, cubeParams.height),
      material: Cesium.Color.CYAN.withAlpha(0.5),
      outline: true,
      outlineColor: Cesium.Color.WHITE,
    },
  });

  showStatus(
    `<b>立方体参数</b><br>` +
    `位置: ${cubeParams.lon.toFixed(4)}°, ${cubeParams.lat.toFixed(4)}°<br>` +
    `宽×深×高: ${cubeParams.width}×${cubeParams.depth}×${cubeParams.height}m`,
  );
}

function enableDrag() {
  if (handler) handler.destroy();
  let isDragging = false;

  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (click) {
    const picked = scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id === cubeEntity) {
      isDragging = true;
      scene.screenSpaceCameraController.enableInputs = false;
      showStatus("<b>拖拽中...</b>");
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction(function (movement) {
    if (!isDragging) return;
    const ray = viewer.camera.getPickRay(movement.endPosition);
    if (!ray) return;
    const pos = scene.globe.pick(ray, scene);
    if (pos) {
      const carto = Cesium.Cartographic.fromCartesian(pos);
      cubeParams.lon = Cesium.Math.toDegrees(carto.longitude);
      cubeParams.lat = Cesium.Math.toDegrees(carto.latitude);
      cubeEntity.position = Cesium.Cartesian3.fromDegrees(
        cubeParams.lon, cubeParams.lat, cubeParams.height / 2,
      );
      showStatus(
        `<b>拖拽移动中</b><br>` +
        `位置: ${cubeParams.lon.toFixed(4)}°, ${cubeParams.lat.toFixed(4)}°`,
      );
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function () {
    isDragging = false;
    scene.screenSpaceCameraController.enableInputs = true;
    showStatus(
      `<b>立方体参数</b><br>` +
      `位置: ${cubeParams.lon.toFixed(4)}°, ${cubeParams.lat.toFixed(4)}°<br>` +
      `宽×深×高: ${cubeParams.width}×${cubeParams.depth}×${cubeParams.height}m`,
    );
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  showStatus("<b>编辑模式:</b> 拖拽立方体移动位置");
}

Sandcastle.addDefaultToolbarButton("创建立方体", () => createCube());
Sandcastle.addToolbarButton("编辑模式 (拖拽)", () => enableDrag());

Sandcastle.addToolbarButton("增大", () => {
  cubeParams.width *= 1.5;
  cubeParams.depth *= 1.5;
  cubeParams.height *= 1.5;
  createCube();
});

Sandcastle.addToolbarButton("缩小", () => {
  cubeParams.width /= 1.5;
  cubeParams.depth /= 1.5;
  cubeParams.height /= 1.5;
  createCube();
});

Sandcastle.addToolbarButton("增高", () => {
  cubeParams.height *= 2;
  createCube();
});

Sandcastle.addToolbarButton("重置", () => {
  if (handler) { handler.destroy(); handler = null; }
  cubeParams = { lon: 113.32, lat: 23.11, width: 200, depth: 200, height: 100 };
  createCube();
});

showStatus('<b>绘制可编辑立方体</b><br>点击“创建立方体”开始');

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  cubeEntity = null;
  scene.screenSpaceCameraController.enableInputs = true;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
