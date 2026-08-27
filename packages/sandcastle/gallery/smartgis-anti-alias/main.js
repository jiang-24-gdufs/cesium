import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

const defaultCamera = {
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 2000),
  orientation: {
    heading: Cesium.Math.toRadians(30),
    pitch: Cesium.Math.toRadians(-25),
    roll: 0,
  },
};
scene.camera.setView(defaultCamera);

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:10px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function addTestGeometry() {
  viewer.entities.add({
    name: "box",
    position: Cesium.Cartesian3.fromDegrees(113.3, 23.1),
    box: {
      dimensions: new Cesium.Cartesian3(200, 200, 400),
      material: Cesium.Color.CORNFLOWERBLUE.withAlpha(0.8),
      outline: true,
      outlineColor: Cesium.Color.WHITE,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  });

  viewer.entities.add({
    name: "polyline",
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([
        113.298, 23.1, 100, 113.299, 23.101, 200, 113.3, 23.102, 300,
        113.301, 23.101, 250, 113.302, 23.1, 150,
      ]),
      width: 3,
      material: Cesium.Color.YELLOW,
      clampToGround: false,
    },
  });

  viewer.entities.add({
    name: "sphere",
    position: Cesium.Cartesian3.fromDegrees(113.301, 23.099),
    ellipsoid: {
      radii: new Cesium.Cartesian3(100, 100, 100),
      material: Cesium.Color.RED.withAlpha(0.7),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  });

  for (let i = 0; i < 5; i++) {
    viewer.entities.add({
      name: `cylinder_${i}`,
      position: Cesium.Cartesian3.fromDegrees(
        113.298 + i * 0.001,
        23.098,
      ),
      cylinder: {
        length: 100 + i * 50,
        topRadius: 20,
        bottomRadius: 40,
        material: Cesium.Color.fromHsl(i / 5, 0.8, 0.5, 0.9),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
  }
}

addTestGeometry();

const fxaaStage = scene.postProcessStages.fxaa;
fxaaStage.enabled = false;

const msaaLevels = [1, 2, 4, 8];
let currentMsaaIndex = 0;
scene.msaaSamples = msaaLevels[currentMsaaIndex];

function updateStatus() {
  const msaa = scene.msaaSamples;
  const fxaa = fxaaStage.enabled;
  const entityCount = viewer.entities.values.length;

  let quality = "无抗锯齿";
  if (msaa >= 4 && fxaa) quality = "最高 (MSAA+FXAA)";
  else if (msaa >= 8) quality = "高 (MSAA 8x)";
  else if (msaa >= 4) quality = "中高 (MSAA 4x)";
  else if (msaa >= 2) quality = "中 (MSAA 2x)";
  else if (fxaa) quality = "中 (FXAA)";

  statusPanel.innerHTML =
    `<b>抗锯齿状态</b><br>` +
    `MSAA: <span style="color:${msaa > 1 ? "#0f0" : "#f44"}">${msaa}x</span><br>` +
    `FXAA: <span style="color:${fxaa ? "#0f0" : "#f44"}">${fxaa ? "开启" : "关闭"}</span><br>` +
    `质量评级: ${quality}<br>` +
    `测试几何体: ${entityCount}`;
}

Sandcastle.addDefaultToolbarButton("切换 MSAA", function () {
  currentMsaaIndex = (currentMsaaIndex + 1) % msaaLevels.length;
  scene.msaaSamples = msaaLevels[currentMsaaIndex];
  updateStatus();
});

Sandcastle.addToolbarButton("切换 FXAA", function () {
  fxaaStage.enabled = !fxaaStage.enabled;
  updateStatus();
});

Sandcastle.addToolbarButton("全部关闭", function () {
  scene.msaaSamples = 1;
  currentMsaaIndex = 0;
  fxaaStage.enabled = false;
  updateStatus();
});

Sandcastle.addToolbarButton("MSAA 4x + FXAA", function () {
  scene.msaaSamples = 4;
  currentMsaaIndex = 2;
  fxaaStage.enabled = true;
  updateStatus();
});

Sandcastle.addToolbarButton("MSAA 8x", function () {
  scene.msaaSamples = 8;
  currentMsaaIndex = 3;
  fxaaStage.enabled = false;
  updateStatus();
});

Sandcastle.addToolbarButton("重置视角", function () {
  scene.camera.flyTo(defaultCamera);
});

updateStatus();

Sandcastle.reset = function () {
  viewer.entities.removeAll();
  scene.msaaSamples = 1;
  currentMsaaIndex = 0;
  fxaaStage.enabled = false;
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
