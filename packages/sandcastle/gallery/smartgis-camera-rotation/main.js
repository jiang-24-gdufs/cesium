import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

const centerPosition = Cesium.Cartesian3.fromDegrees(113.3244, 23.1063, 0);
const initialRange = 5000;

scene.camera.lookAt(
  centerPosition,
  new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-30), initialRange),
);

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

let isRotating = false;
let rotationSpeed = 0.5;
let rotationDirection = 1;
let removeListener = null;

function updateStatus() {
  const heading = Cesium.Math.toDegrees(scene.camera.heading).toFixed(1);
  const pitch = Cesium.Math.toDegrees(scene.camera.pitch).toFixed(1);
  const range = Cesium.Cartesian3.distance(
    scene.camera.positionWC,
    centerPosition,
  );

  statusPanel.innerHTML =
    `<b>绕中心旋转</b><br>` +
    `状态: <span style="color:${isRotating ? "#0f0" : "#f44"}">${isRotating ? "旋转中" : "已停止"}</span><br>` +
    `航向: ${heading}°<br>` +
    `俯仰: ${pitch}°<br>` +
    `距离: ${(range / 1000).toFixed(2)} km<br>` +
    `速度: ${rotationSpeed.toFixed(1)}°/s`;
}

function startRotation() {
  if (removeListener) return;
  isRotating = true;

  scene.camera.lookAt(
    centerPosition,
    new Cesium.HeadingPitchRange(
      scene.camera.heading,
      scene.camera.pitch,
      Cesium.Cartesian3.distance(scene.camera.positionWC, centerPosition),
    ),
  );

  removeListener = scene.postUpdate.addEventListener(function (scene, time) {
    const heading =
      scene.camera.heading +
      Cesium.Math.toRadians(rotationSpeed * rotationDirection) * 0.016;
    const pitch = scene.camera.pitch;
    const range = Cesium.Cartesian3.distance(
      scene.camera.positionWC,
      centerPosition,
    );

    scene.camera.lookAt(
      centerPosition,
      new Cesium.HeadingPitchRange(heading, pitch, range),
    );
    updateStatus();
  });
}

function stopRotation() {
  if (removeListener) {
    removeListener();
    removeListener = null;
  }
  isRotating = false;
  scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  updateStatus();
}

Sandcastle.addDefaultToolbarButton("开始旋转", function () {
  if (isRotating) {
    stopRotation();
  } else {
    startRotation();
  }
});

Sandcastle.addToolbarButton("加速", function () {
  rotationSpeed = Math.min(rotationSpeed + 0.5, 10);
  updateStatus();
});

Sandcastle.addToolbarButton("减速", function () {
  rotationSpeed = Math.max(rotationSpeed - 0.5, 0.1);
  updateStatus();
});

Sandcastle.addToolbarButton("反向", function () {
  rotationDirection *= -1;
  updateStatus();
});

Sandcastle.addToolbarButton("重置视角", function () {
  stopRotation();
  scene.camera.lookAt(
    centerPosition,
    new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-30), initialRange),
  );
  scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  updateStatus();
});

updateStatus();

Sandcastle.reset = function () {
  stopRotation();
  scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
