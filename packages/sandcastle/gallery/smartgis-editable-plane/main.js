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
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 5000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
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
let planeEntity = null;
let editHandles = [];
let editMode = false;
const corners = [];

function getPickPosition(windowPos) {
  const ray = viewer.camera.getPickRay(windowPos);
  return ray ? scene.globe.pick(ray, scene) : null;
}

function createPlane() {
  if (planeEntity) viewer.entities.remove(planeEntity);
  editHandles.forEach((h) => viewer.entities.remove(h));
  editHandles = [];
  corners.length = 0;

  showStatus("<b>绘制可编辑平面</b><br>依次点击 4 个角点");

  if (handler) handler.destroy();
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (click) {
    const pos = getPickPosition(click.position);
    if (!pos) return;
    corners.push(pos);

    viewer.entities.add({
      position: pos,
      point: { pixelSize: 8, color: Cesium.Color.RED, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    });

    if (corners.length === 4) {
      handler.destroy();
      handler = null;

      planeEntity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(corners), false),
          material: Cesium.Color.CYAN.withAlpha(0.4),
          outline: true,
          outlineColor: Cesium.Color.CYAN,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });

      createEditHandles();
      showStatus(
        `<b>平面已创建</b><br>拖拽角点编辑<br>` +
        `点击"编辑模式"启用拖拽`,
      );
    } else {
      showStatus(`<b>绘制平面:</b> ${corners.length}/4 个点`);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function createEditHandles() {
  editHandles.forEach((h) => viewer.entities.remove(h));
  editHandles = [];

  for (let i = 0; i < corners.length; i++) {
    const handle = viewer.entities.add({
      position: new Cesium.CallbackProperty(() => corners[i], false),
      point: {
        pixelSize: 12,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    handle._cornerIndex = i;
    editHandles.push(handle);
  }
}

function enableEdit() {
  if (handler) handler.destroy();
  editMode = true;
  let dragIndex = -1;

  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (click) {
    const picked = scene.pick(click.position);
    if (Cesium.defined(picked) && Cesium.defined(picked.id) && picked.id._cornerIndex !== undefined) {
      dragIndex = picked.id._cornerIndex;
      scene.screenSpaceCameraController.enableInputs = false;
      showStatus(`<b>编辑中:</b> 拖拽角点 ${dragIndex + 1}`);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction(function (movement) {
    if (dragIndex < 0) return;
    const pos = getPickPosition(movement.endPosition);
    if (pos) {
      corners[dragIndex] = pos;
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function () {
    dragIndex = -1;
    scene.screenSpaceCameraController.enableInputs = true;
    showStatus("<b>编辑模式:</b> 点击角点拖拽");
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  showStatus("<b>编辑模式:</b> 点击角点拖拽");
}

Sandcastle.addDefaultToolbarButton("绘制平面", () => createPlane());
Sandcastle.addToolbarButton("编辑模式", () => enableEdit());

Sandcastle.addToolbarButton("重置", () => {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  editHandles = [];
  planeEntity = null;
  corners.length = 0;
  editMode = false;
  showStatus("<b>已重置</b>");
});

showStatus('<b>绘制可编辑平面</b><br>点击“绘制平面”开始');

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  editHandles = [];
  planeEntity = null;
  corners.length = 0;
  scene.screenSpaceCameraController.enableInputs = true;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
