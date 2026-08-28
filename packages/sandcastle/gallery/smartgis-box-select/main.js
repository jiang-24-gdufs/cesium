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
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 30000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-60), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

const sampleEntities = [];
for (let i = 0; i < 50; i++) {
  const lon = 113.1 + Math.random() * 0.4;
  const lat = 23.0 + Math.random() * 0.2;
  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    point: {
      pixelSize: 8,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: `P${i + 1}`,
      font: "11px sans-serif",
      showBackground: true,
      backgroundColor: new Cesium.Color(0, 0, 0, 0.5),
      pixelOffset: new Cesium.Cartesian2(0, -15),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scale: 0.8,
    },
    properties: { id: i + 1 },
  });
  sampleEntities.push(entity);
}

let handler = null;
let selectBox = null;
let startPos = null;

const selectDiv = document.createElement("div");
selectDiv.style.cssText =
  "position:absolute;border:2px dashed #0ff;background:rgba(0,255,255,0.1);" +
  "pointer-events:none;display:none;z-index:20;";
document.getElementById("cesiumContainer").appendChild(selectDiv);

function startBoxSelect() {
  if (handler) handler.destroy();
  resetSelection();

  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (click) {
    startPos = click.position.clone();
    selectDiv.style.display = "block";
    scene.screenSpaceCameraController.enableInputs = false;
    showStatus("<b>框选中...</b> 拖拽绘制选择框");
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction(function (movement) {
    if (!startPos) return;
    const endPos = movement.endPosition;
    const x = Math.min(startPos.x, endPos.x);
    const y = Math.min(startPos.y, endPos.y);
    const w = Math.abs(endPos.x - startPos.x);
    const h = Math.abs(endPos.y - startPos.y);
    selectDiv.style.left = `${x}px`;
    selectDiv.style.top = `${y}px`;
    selectDiv.style.width = `${w}px`;
    selectDiv.style.height = `${h}px`;
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function (click) {
    if (!startPos) return;
    const endPos = click.position;
    scene.screenSpaceCameraController.enableInputs = true;
    selectDiv.style.display = "none";

    const minX = Math.min(startPos.x, endPos.x);
    const maxX = Math.max(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxY = Math.max(startPos.y, endPos.y);

    let selected = 0;
    for (const entity of sampleEntities) {
      const pos = entity.position.getValue(viewer.clock.currentTime);
      const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(scene, pos);
      if (screenPos && screenPos.x >= minX && screenPos.x <= maxX && screenPos.y >= minY && screenPos.y <= maxY) {
        entity.point.color = Cesium.Color.YELLOW;
        entity.point.pixelSize = 12;
        selected++;
      } else {
        entity.point.color = Cesium.Color.CYAN;
        entity.point.pixelSize = 8;
      }
    }

    startPos = null;
    showStatus(`<b>框选结果:</b> ${selected} / ${sampleEntities.length} 个实体`);
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  showStatus("<b>框选模式:</b> 按住左键拖拽绘制选择框");
}

function resetSelection() {
  for (const e of sampleEntities) {
    e.point.color = Cesium.Color.CYAN;
    e.point.pixelSize = 8;
  }
  selectDiv.style.display = "none";
  startPos = null;
}

Sandcastle.addDefaultToolbarButton("框选", () => startBoxSelect());

Sandcastle.addToolbarButton("重置选择", () => {
  resetSelection();
  showStatus("<b>选择已重置</b>");
});

Sandcastle.addToolbarButton("全选", () => {
  for (const e of sampleEntities) {
    e.point.color = Cesium.Color.YELLOW;
    e.point.pixelSize = 12;
  }
  showStatus(`<b>全选:</b> ${sampleEntities.length} 个实体`);
});

showStatus(`<b>框选</b><br>${sampleEntities.length} 个样本点已生成<br>点击"框选"开始`);

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  sampleEntities.length = 0;
  scene.screenSpaceCameraController.enableInputs = true;
  if (selectDiv.parentNode) selectDiv.parentNode.removeChild(selectDiv);
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
