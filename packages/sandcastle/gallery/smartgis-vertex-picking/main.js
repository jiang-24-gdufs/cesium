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

const defaultCamera = {
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 800000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-60),
    roll: 0,
  },
};
scene.camera.setView(defaultCamera);

const modePanel = document.createElement("div");
modePanel.style.cssText =
  "position:absolute;bottom:40px;left:50%;transform:translateX(-50%);" +
  "background:rgba(0,0,0,0.75);color:#0f0;padding:6px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;";
modePanel.textContent = "请选择拾取模式";
document.getElementById("cesiumContainer").appendChild(modePanel);

const countPanel = document.createElement("div");
countPanel.style.cssText =
  "position:absolute;bottom:40px;right:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:6px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;";
countPanel.textContent = "已标记: 0";
document.getElementById("cesiumContainer").appendChild(countPanel);

const pickedPoints = [];
let handler = null;
let coordLabel = null;
let currentMode = "";

function createCoordLabel() {
  return viewer.entities.add({
    label: {
      show: false,
      showBackground: true,
      font: "13px monospace",
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(15, -15),
      backgroundColor: new Cesium.Color(0, 0, 0, 0.75),
      fillColor: Cesium.Color.WHITE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
}

function formatCoord(cartographic) {
  const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
  const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
  const height = cartographic.height.toFixed(2);
  return `经度: ${lon}°\n纬度: ${lat}°\n高度: ${height}m`;
}

function addPickedPoint(cartesian) {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const entity = viewer.entities.add({
    position: cartesian,
    point: {
      pixelSize: 10,
      color: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: Cesium.HeightReference.NONE,
    },
    label: {
      text: `#${pickedPoints.length + 1}\n${formatCoord(cartographic)}`,
      font: "12px monospace",
      showBackground: true,
      backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(15, -15),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  pickedPoints.push(entity);
  countPanel.textContent = `已标记: ${pickedPoints.length}`;
}

function switchMode(modeName) {
  if (handler) {
    handler.destroy();
    handler = null;
  }
  if (coordLabel) {
    viewer.entities.remove(coordLabel);
    coordLabel = null;
  }
  currentMode = modeName;
  modePanel.textContent = `当前模式: ${modeName}`;
  modePanel.style.color = "#0f0";

  coordLabel = createCoordLabel();
  handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
}

Sandcastle.addDefaultToolbarButton("椭球面拾取", function () {
  switchMode("椭球面拾取");

  handler.setInputAction(function (movement) {
    const cartesian = viewer.camera.pickEllipsoid(
      movement.endPosition,
      scene.globe.ellipsoid,
    );
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      coordLabel.position = cartesian;
      coordLabel.label.show = true;
      coordLabel.label.text = formatCoord(cartographic);
    } else {
      coordLabel.label.show = false;
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function (click) {
    const cartesian = viewer.camera.pickEllipsoid(
      click.position,
      scene.globe.ellipsoid,
    );
    if (cartesian) {
      addPickedPoint(cartesian);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
});

Sandcastle.addToolbarButton("地形拾取", function () {
  switchMode("地形拾取");

  handler.setInputAction(function (movement) {
    const ray = viewer.camera.getPickRay(movement.endPosition);
    if (!ray) return;
    const cartesian = viewer.scene.globe.pick(ray, scene);
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      coordLabel.position = cartesian;
      coordLabel.label.show = true;
      coordLabel.label.text = `[地形] ${formatCoord(cartographic)}`;
    } else {
      coordLabel.label.show = false;
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function (click) {
    const ray = viewer.camera.getPickRay(click.position);
    if (!ray) return;
    const cartesian = viewer.scene.globe.pick(ray, scene);
    if (cartesian) {
      addPickedPoint(cartesian);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
});

Sandcastle.addToolbarButton("场景拾取 (pickPosition)", function () {
  if (!scene.pickPositionSupported) {
    modePanel.textContent = "当前浏览器不支持 pickPosition";
    modePanel.style.color = "#f44";
    return;
  }

  switchMode("场景拾取");

  handler.setInputAction(function (movement) {
    if (scene.mode === Cesium.SceneMode.MORPHING) return;
    const cartesian = scene.pickPosition(movement.endPosition);
    if (Cesium.defined(cartesian)) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      if (cartographic.height < -500 || cartographic.height > 100000000) {
        coordLabel.label.show = false;
        return;
      }
      coordLabel.position = cartesian;
      coordLabel.label.show = true;
      coordLabel.label.text = `[场景] ${formatCoord(cartographic)}`;
    } else {
      coordLabel.label.show = false;
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function (click) {
    if (scene.mode === Cesium.SceneMode.MORPHING) return;
    const cartesian = scene.pickPosition(click.position);
    if (Cesium.defined(cartesian)) {
      addPickedPoint(cartesian);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
});

Sandcastle.addToolbarButton("清除标记点", function () {
  for (let i = 0; i < pickedPoints.length; i++) {
    viewer.entities.remove(pickedPoints[i]);
  }
  pickedPoints.length = 0;
  countPanel.textContent = "已标记: 0";
});

Sandcastle.reset = function () {
  if (handler) {
    handler.destroy();
    handler = null;
  }
  viewer.entities.removeAll();
  pickedPoints.length = 0;
  coordLabel = null;
  currentMode = "";
  if (modePanel.parentNode) {
    modePanel.parentNode.removeChild(modePanel);
  }
  if (countPanel.parentNode) {
    countPanel.parentNode.removeChild(countPanel);
  }
};
