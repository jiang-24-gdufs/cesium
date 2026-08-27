import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  selectionIndicator: false,
  infoBox: false,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 50000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-60),
    roll: 0,
  },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
statusPanel.innerHTML = "<b>绘制几何</b><br>选择绘制模式后点击地图";
document.getElementById("cesiumContainer").appendChild(statusPanel);

let handler = null;
let drawMode = null;
let activePositions = [];
let activeEntity = null;
const drawnEntities = [];

function getPickPosition(windowPosition) {
  const ray = viewer.camera.getPickRay(windowPosition);
  if (!ray) return null;
  return scene.globe.pick(ray, scene);
}

function startDraw(mode) {
  stopDraw();
  drawMode = mode;
  activePositions = [];
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  statusPanel.innerHTML =
    `<b>绘制模式: ${mode}</b><br>` +
    `左键: 添加点 | 右键: 完成<br>` +
    `已绘制: ${drawnEntities.length} 个`;

  if (mode === "点") {
    handler.setInputAction(function (click) {
      const cartesian = getPickPosition(click.position);
      if (!cartesian) return;
      const entity = viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 10,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      drawnEntities.push(entity);
      statusPanel.innerHTML =
        `<b>绘制: 点</b><br>已绘制: ${drawnEntities.length} 个`;
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    return;
  }

  handler.setInputAction(function (click) {
    const cartesian = getPickPosition(click.position);
    if (!cartesian) return;
    activePositions.push(cartesian);

    if (activePositions.length === 1 && (mode === "线" || mode === "多边形")) {
      activeEntity = viewer.entities.add({
        polyline:
          mode === "线"
            ? {
                positions: new Cesium.CallbackProperty(function () {
                  return activePositions;
                }, false),
                width: 3,
                material: Cesium.Color.YELLOW,
                clampToGround: true,
              }
            : undefined,
        polygon:
          mode === "多边形"
            ? {
                hierarchy: new Cesium.CallbackProperty(function () {
                  return new Cesium.PolygonHierarchy(activePositions);
                }, false),
                material: Cesium.Color.CYAN.withAlpha(0.4),
                outline: true,
                outlineColor: Cesium.Color.CYAN,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              }
            : undefined,
      });
    }

    if (mode === "矩形" && activePositions.length === 2) {
      finishDraw();
      return;
    }
    if (mode === "圆" && activePositions.length === 2) {
      finishDraw();
      return;
    }

    statusPanel.innerHTML =
      `<b>绘制: ${mode}</b><br>` +
      `点数: ${activePositions.length} | 右键完成<br>` +
      `已绘制: ${drawnEntities.length} 个`;
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(function (movement) {
    if (activePositions.length === 0) return;
    const cartesian = getPickPosition(movement.endPosition);
    if (!cartesian) return;

    if (mode === "线" || mode === "多边形") {
      if (activePositions.length > 0) {
        activePositions[activePositions.length] = cartesian;
        activePositions.length = activePositions.length;
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function () {
    if (activePositions.length >= 2) {
      finishDraw();
    }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function finishDraw() {
  if (!drawMode || activePositions.length < 1) return;

  if (activeEntity) {
    viewer.entities.remove(activeEntity);
    activeEntity = null;
  }

  let entity = null;
  if (drawMode === "线" && activePositions.length >= 2) {
    entity = viewer.entities.add({
      polyline: {
        positions: activePositions.slice(),
        width: 3,
        material: Cesium.Color.YELLOW,
        clampToGround: true,
      },
    });
  } else if (drawMode === "多边形" && activePositions.length >= 3) {
    entity = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(activePositions.slice()),
        material: Cesium.Color.CYAN.withAlpha(0.4),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
  } else if (drawMode === "矩形" && activePositions.length >= 2) {
    const c1 = Cesium.Cartographic.fromCartesian(activePositions[0]);
    const c2 = Cesium.Cartographic.fromCartesian(activePositions[1]);
    entity = viewer.entities.add({
      rectangle: {
        coordinates: Cesium.Rectangle.fromCartographicArray([c1, c2]),
        material: Cesium.Color.GREEN.withAlpha(0.4),
        outline: true,
        outlineColor: Cesium.Color.GREEN,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
  } else if (drawMode === "圆" && activePositions.length >= 2) {
    const center = activePositions[0];
    const edge = activePositions[1];
    const radius = Cesium.Cartesian3.distance(center, edge);
    entity = viewer.entities.add({
      position: center,
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: Cesium.Color.ORANGE.withAlpha(0.4),
        outline: true,
        outlineColor: Cesium.Color.ORANGE,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
  }

  if (entity) {
    drawnEntities.push(entity);
  }

  activePositions = [];
  statusPanel.innerHTML =
    `<b>绘制完成: ${drawMode}</b><br>已绘制: ${drawnEntities.length} 个`;
}

function stopDraw() {
  if (handler) {
    handler.destroy();
    handler = null;
  }
  if (activeEntity) {
    viewer.entities.remove(activeEntity);
    activeEntity = null;
  }
  activePositions = [];
  drawMode = null;
}

Sandcastle.addDefaultToolbarButton("绘制点", function () {
  startDraw("点");
});

Sandcastle.addToolbarButton("绘制线", function () {
  startDraw("线");
});

Sandcastle.addToolbarButton("绘制多边形", function () {
  startDraw("多边形");
});

Sandcastle.addToolbarButton("绘制矩形", function () {
  startDraw("矩形");
});

Sandcastle.addToolbarButton("绘制圆", function () {
  startDraw("圆");
});

Sandcastle.addToolbarButton("清除全部", function () {
  stopDraw();
  for (const e of drawnEntities) {
    viewer.entities.remove(e);
  }
  drawnEntities.length = 0;
  statusPanel.innerHTML = "<b>已清除全部绘制</b>";
});

Sandcastle.addToolbarButton("撤销上一个", function () {
  if (drawnEntities.length === 0) {
    statusPanel.innerHTML = "<b>无可撤销的绘制</b>";
    return;
  }
  const last = drawnEntities.pop();
  viewer.entities.remove(last);
  statusPanel.innerHTML = `<b>已撤销</b><br>剩余: ${drawnEntities.length} 个`;
});

Sandcastle.reset = function () {
  stopDraw();
  viewer.entities.removeAll();
  drawnEntities.length = 0;
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
