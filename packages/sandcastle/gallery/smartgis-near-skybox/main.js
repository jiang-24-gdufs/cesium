import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 200),
  orientation: { heading: Cesium.Math.toRadians(30), pitch: Cesium.Math.toRadians(5), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

const defaultSkyBox = scene.skyBox;
let customSkyBox = null;
let removeListener = null;

function createNearGroundSkybox() {
  const skyboxSize = 1000;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  function createFaceTexture(topColor, bottomColor, label) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(0.4, bottomColor);
    gradient.addColorStop(1, "#aabbcc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 256;
      const r = Math.random() * 30 + 10;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas.toDataURL();
  }

  const px = createFaceTexture("#87CEEB", "#B0E0E6", "+X");
  const nx = createFaceTexture("#87CEEB", "#B0E0E6", "-X");
  const py = createFaceTexture("#4A90D9", "#6BB3E0", "+Y");
  const ny = createFaceTexture("#D4E6F1", "#E8F0FE", "-Y");
  const pz = createFaceTexture("#87CEEB", "#B0E0E6", "+Z");
  const nz = createFaceTexture("#87CEEB", "#B0E0E6", "-Z");

  return new Cesium.SkyBox({
    sources: {
      positiveX: px,
      negativeX: nx,
      positiveY: py,
      negativeY: ny,
      positiveZ: pz,
      negativeZ: nz,
    },
  });
}

function enableNearGroundSkybox() {
  if (removeListener) {
    removeListener();
    removeListener = null;
  }

  customSkyBox = createNearGroundSkybox();

  removeListener = scene.preUpdate.addEventListener(function () {
    const cameraHeight = scene.camera.positionCartographic.height;
    if (cameraHeight < 5000) {
      if (scene.skyBox !== customSkyBox) {
        scene.skyBox = customSkyBox;
      }
    } else {
      if (scene.skyBox !== defaultSkyBox) {
        scene.skyBox = defaultSkyBox;
      }
    }
  });

  showStatus(
    "<b>近地天空盒已启用</b><br>" +
    "高度 < 5000m: 自定义天空<br>" +
    "高度 ≥ 5000m: 默认天空<br><br>" +
    "降低相机高度观看效果",
  );
}

function disableNearGroundSkybox() {
  if (removeListener) {
    removeListener();
    removeListener = null;
  }
  scene.skyBox = defaultSkyBox;
  customSkyBox = null;
  showStatus("<b>近地天空盒已关闭</b>");
}

Sandcastle.addDefaultToolbarButton("启用近地天空盒", () => enableNearGroundSkybox());
Sandcastle.addToolbarButton("关闭近地天空盒", () => disableNearGroundSkybox());

Sandcastle.addToolbarButton("飞到近地 (200m)", () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 200),
    orientation: { heading: Cesium.Math.toRadians(30), pitch: Cesium.Math.toRadians(5), roll: 0 },
    duration: 1,
  });
});

Sandcastle.addToolbarButton("飞到高空 (10km)", () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 10000),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
    duration: 1,
  });
});

showStatus("<b>近地天空盒</b><br>点击启用查看效果");

Sandcastle.reset = function () {
  disableNearGroundSkybox();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
