import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 500),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-15),
    roll: 0,
  },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

const keysPressed = {};
let moveSpeed = 50;
let rotateSpeed = 1;
let isEnabled = false;
let removeListener = null;

function onKeyDown(e) {
  keysPressed[e.code] = true;
}

function onKeyUp(e) {
  keysPressed[e.code] = false;
}

function updateCamera() {
  const camera = scene.camera;
  const dt = 1 / 60;

  if (keysPressed["KeyW"] || keysPressed["ArrowUp"]) {
    camera.moveForward(moveSpeed * dt);
  }
  if (keysPressed["KeyS"] || keysPressed["ArrowDown"]) {
    camera.moveBackward(moveSpeed * dt);
  }
  if (keysPressed["KeyA"] || keysPressed["ArrowLeft"]) {
    camera.moveLeft(moveSpeed * dt);
  }
  if (keysPressed["KeyD"] || keysPressed["ArrowRight"]) {
    camera.moveRight(moveSpeed * dt);
  }
  if (keysPressed["KeyQ"]) {
    camera.moveUp(moveSpeed * dt);
  }
  if (keysPressed["KeyE"]) {
    camera.moveDown(moveSpeed * dt);
  }
  if (keysPressed["KeyJ"]) {
    camera.lookLeft(Cesium.Math.toRadians(rotateSpeed * dt * 60));
  }
  if (keysPressed["KeyL"]) {
    camera.lookRight(Cesium.Math.toRadians(rotateSpeed * dt * 60));
  }
  if (keysPressed["KeyI"]) {
    camera.lookUp(Cesium.Math.toRadians(rotateSpeed * dt * 60));
  }
  if (keysPressed["KeyK"]) {
    camera.lookDown(Cesium.Math.toRadians(rotateSpeed * dt * 60));
  }

  updateStatus();
}

function updateStatus() {
  const cartographic = Cesium.Cartographic.fromCartesian(
    scene.camera.positionWC,
  );
  const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
  const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
  const height = cartographic.height.toFixed(1);
  const heading = Cesium.Math.toDegrees(scene.camera.heading).toFixed(1);

  statusPanel.innerHTML =
    `<b>键盘漫游</b> <span style="color:${isEnabled ? "#0f0" : "#f44"}">[${isEnabled ? "已启用" : "未启用"}]</span><br>` +
    `移动: WASD / 方向键<br>` +
    `升降: Q / E<br>` +
    `旋转: I J K L<br>` +
    `速度: ${moveSpeed} m/frame<br>` +
    `位置: ${lon}°, ${lat}°<br>` +
    `高度: ${height}m  航向: ${heading}°`;
}

function enableRoaming() {
  if (isEnabled) return;
  isEnabled = true;

  scene.screenSpaceCameraController.enableRotate = false;
  scene.screenSpaceCameraController.enableTranslate = false;
  scene.screenSpaceCameraController.enableZoom = false;
  scene.screenSpaceCameraController.enableTilt = false;
  scene.screenSpaceCameraController.enableLook = false;

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  removeListener = scene.postUpdate.addEventListener(updateCamera);
  updateStatus();
}

function disableRoaming() {
  if (!isEnabled) return;
  isEnabled = false;

  scene.screenSpaceCameraController.enableRotate = true;
  scene.screenSpaceCameraController.enableTranslate = true;
  scene.screenSpaceCameraController.enableZoom = true;
  scene.screenSpaceCameraController.enableTilt = true;
  scene.screenSpaceCameraController.enableLook = true;

  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("keyup", onKeyUp);
  if (removeListener) {
    removeListener();
    removeListener = null;
  }
  Object.keys(keysPressed).forEach(function (k) {
    keysPressed[k] = false;
  });
  updateStatus();
}

Sandcastle.addDefaultToolbarButton("启用漫游", function () {
  if (isEnabled) {
    disableRoaming();
  } else {
    enableRoaming();
  }
});

Sandcastle.addToolbarButton("加速 (×2)", function () {
  moveSpeed = Math.min(moveSpeed * 2, 10000);
  updateStatus();
});

Sandcastle.addToolbarButton("减速 (÷2)", function () {
  moveSpeed = Math.max(moveSpeed / 2, 1);
  updateStatus();
});

Sandcastle.addToolbarButton("重置位置", function () {
  disableRoaming();
  scene.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 500),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-15),
      roll: 0,
    },
  });
  updateStatus();
});

updateStatus();

Sandcastle.reset = function () {
  disableRoaming();
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
