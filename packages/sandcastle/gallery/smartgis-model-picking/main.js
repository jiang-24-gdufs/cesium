import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  infoBox: true,
  selectionIndicator: true,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

const modelPosition = Cesium.Cartesian3.fromDegrees(-123.0744619, 44.0503706);

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(-123.0744619, 44.0503706, 500),
  orientation: {
    heading: Cesium.Math.toRadians(30),
    pitch: Cesium.Math.toRadians(-30),
    roll: 0,
  },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
statusPanel.textContent = "鼠标移到模型上查看拾取信息";
document.getElementById("cesiumContainer").appendChild(statusPanel);

const milktruck = viewer.entities.add({
  name: "CesiumMilkTruck",
  position: modelPosition,
  model: {
    uri: "../../SampleData/models/CesiumMilkTruck/CesiumMilkTruck.glb",
    minimumPixelSize: 64,
    maximumScale: 200,
  },
  description: "Cesium 牛奶车模型",
});

const airplane = viewer.entities.add({
  name: "Cesium Air",
  position: Cesium.Cartesian3.fromDegrees(-123.073, 44.0506, 100),
  model: {
    uri: "../../SampleData/models/CesiumAir/Cesium_Air.glb",
    minimumPixelSize: 64,
    maximumScale: 5,
  },
  description: "Cesium 飞机模型",
});

const groundVehicle = viewer.entities.add({
  name: "Ground Vehicle",
  position: Cesium.Cartesian3.fromDegrees(-123.076, 44.0504),
  model: {
    uri: "../../SampleData/models/GroundVehicle/GroundVehicle.glb",
    minimumPixelSize: 64,
    maximumScale: 50,
    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
  },
  description: "地面车辆模型",
});

let handler = null;
let highlightedEntity = null;
const originalColors = new Map();

function setupPickHandler() {
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (movement) {
    if (highlightedEntity && highlightedEntity.model) {
      highlightedEntity.model.color = originalColors.get(highlightedEntity) || Cesium.Color.WHITE;
      highlightedEntity.model.silhouetteSize = 0;
    }
    highlightedEntity = null;

    const pickedObject = scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
      const entity = pickedObject.id;
      if (entity.model) {
        highlightedEntity = entity;
        if (!originalColors.has(entity)) {
          originalColors.set(entity, entity.model.color ? entity.model.color.getValue ? entity.model.color.getValue(viewer.clock.currentTime) : Cesium.Color.WHITE : Cesium.Color.WHITE);
        }
        entity.model.color = Cesium.Color.YELLOW.withAlpha(0.8);
        entity.model.silhouetteColor = Cesium.Color.CYAN;
        entity.model.silhouetteSize = 2;

        statusPanel.innerHTML =
          `<b>拾取到模型:</b> ${entity.name}<br>` +
          `描述: ${entity.description?.getValue ? entity.description.getValue(viewer.clock.currentTime) : entity.description || "无"}`;
      }
    } else {
      statusPanel.textContent = "鼠标移到模型上查看拾取信息";
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function (click) {
    const pickedObject = scene.pick(click.position);
    if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
      const entity = pickedObject.id;
      if (entity.position) {
        viewer.flyTo(entity, { duration: 1.0 });
        statusPanel.innerHTML = `<b>已选中:</b> ${entity.name}<br>正在飞行到模型位置...`;
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

setupPickHandler();

Sandcastle.addDefaultToolbarButton("拾取模式", function () {
  if (handler) handler.destroy();
  setupPickHandler();
  statusPanel.textContent = "鼠标移到模型上查看拾取信息";
});

Sandcastle.addToolbarButton("穿透拾取 (drillPick)", function () {
  if (handler) handler.destroy();
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(function (movement) {
    const pickedObjects = scene.drillPick(movement.endPosition);
    if (pickedObjects.length > 0) {
      const names = pickedObjects
        .filter(function (p) { return Cesium.defined(p.id) && p.id.name; })
        .map(function (p) { return p.id.name; });
      statusPanel.innerHTML =
        `<b>穿透拾取 (${pickedObjects.length} 个):</b><br>` +
        names.join("<br>");
    } else {
      statusPanel.textContent = "未拾取到对象";
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
});

Sandcastle.addToolbarButton("飞到全部模型", function () {
  viewer.flyTo(viewer.entities);
});

Sandcastle.reset = function () {
  if (handler) {
    handler.destroy();
    handler = null;
  }
  highlightedEntity = null;
  originalColors.clear();
  viewer.entities.removeAll();
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
