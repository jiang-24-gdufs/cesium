import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

const defaultCamera = {
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 5000000),
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
};

scene.camera.setView(defaultCamera);

viewer.scene.globe.tileLoadProgressEvent.addEventListener(function (
  queueLength,
) {
  if (queueLength === 0) {
    document.getElementById("loadingOverlay").style.display = "none";
  }
});

const statusEntity = viewer.entities.add({
  label: {
    show: false,
    showBackground: true,
    font: "14px monospace",
    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
    verticalOrigin: Cesium.VerticalOrigin.TOP,
    pixelOffset: new Cesium.Cartesian2(0, 10),
    backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  },
});

function showStatus(text) {
  const camera = viewer.camera;
  statusEntity.position = camera.positionWC;
  statusEntity.label.show = true;
  statusEntity.label.text = text;
  setTimeout(function () {
    statusEntity.label.show = false;
  }, 3000);
}

function showViewerInfo() {
  const camera = viewer.camera;
  const cartographic = Cesium.Cartographic.fromCartesian(camera.positionWC);
  const lon = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
  const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
  const height = cartographic.height.toFixed(2);
  const heading = Cesium.Math.toDegrees(camera.heading).toFixed(2);
  const pitch = Cesium.Math.toDegrees(camera.pitch).toFixed(2);

  const info =
    `经度: ${lon}°\n纬度: ${lat}°\n高度: ${height}m` +
    `\n航向: ${heading}°\n俯仰: ${pitch}°` +
    `\n场景模式: ${scene.mode === Cesium.SceneMode.SCENE3D ? "3D" : scene.mode === Cesium.SceneMode.SCENE2D ? "2D" : "哥伦布"}` +
    `\n深度检测: ${scene.globe.depthTestAgainstTerrain ? "开启" : "关闭"}` +
    `\n光照: ${scene.globe.enableLighting ? "开启" : "关闭"}`;

  showStatus(info);
  console.log(info.replace(/\n/g, ", "));
}

Sandcastle.addDefaultToolbarButton("默认视角", function () {
  scene.camera.flyTo(defaultCamera);
});

Sandcastle.addToolbarButton("打印相机信息", showViewerInfo);

Sandcastle.addToolbarButton("2D 模式", function () {
  scene.morphTo2D(1.0);
  showStatus("已切换到 2D 模式");
});

Sandcastle.addToolbarButton("哥伦布视图", function () {
  scene.morphToColumbusView(1.0);
  showStatus("已切换到哥伦布视图");
});

Sandcastle.addToolbarButton("3D 模式", function () {
  scene.morphTo3D(1.0);
  showStatus("已切换到 3D 模式");
});

Sandcastle.addToolbarButton("切换深度检测", function () {
  scene.globe.depthTestAgainstTerrain =
    !scene.globe.depthTestAgainstTerrain;
  showStatus(
    `深度检测: ${scene.globe.depthTestAgainstTerrain ? "开启" : "关闭"}`,
  );
});

Sandcastle.addToolbarButton("切换光照", function () {
  scene.globe.enableLighting = !scene.globe.enableLighting;
  showStatus(`光照: ${scene.globe.enableLighting ? "开启" : "关闭"}`);
});

Sandcastle.reset = function () {
  viewer.entities.removeAll();
  scene.morphTo3D(0);
  scene.camera.setView(defaultCamera);
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.enableLighting = false;
};
