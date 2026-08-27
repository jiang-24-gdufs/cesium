import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  shouldAnimate: true,
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: new Cesium.Cartesian3(
    277096.634865404,
    5647834.481964232,
    2985563.7039122293,
  ),
  orientation: {
    heading: 4.731089976107251,
    pitch: -0.32003481981370063,
  },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

let rainSystem = null;
let emissionRate = 9000;
let rainSpeed = 1050;

const rainParticleSize = 15.0;
const rainRadius = 100000.0;
const rainImageSize = new Cesium.Cartesian2(
  rainParticleSize,
  rainParticleSize * 2.0,
);

let gravityScratch = new Cesium.Cartesian3();

function rainUpdate(particle) {
  gravityScratch = Cesium.Cartesian3.normalize(
    particle.position,
    gravityScratch,
  );
  gravityScratch = Cesium.Cartesian3.multiplyByScalar(
    gravityScratch,
    -rainSpeed,
    gravityScratch,
  );
  particle.position = Cesium.Cartesian3.add(
    particle.position,
    gravityScratch,
    particle.position,
  );

  const distance = Cesium.Cartesian3.distance(
    scene.camera.position,
    particle.position,
  );
  if (distance > rainRadius) {
    particle.endColor.alpha = 0.0;
  } else {
    particle.endColor.alpha =
      Cesium.Color.BLUE.alpha / (distance / rainRadius + 0.1);
  }
}

function updateStatus() {
  statusPanel.innerHTML =
    `<b>雨效果</b><br>` +
    `状态: <span style="color:${rainSystem ? "#0f0" : "#f44"}">${rainSystem ? "下雨中" : "已停止"}</span><br>` +
    `发射率: ${emissionRate}/s<br>` +
    `雨滴速度: ${rainSpeed}`;
}

function startRain() {
  stopRain();

  scene.skyAtmosphere.hueShift = -0.97;
  scene.skyAtmosphere.saturationShift = 0.25;
  scene.skyAtmosphere.brightnessShift = -0.4;
  scene.fog.density = 0.00025;
  scene.fog.minimumBrightness = 0.01;

  rainSystem = scene.primitives.add(
    new Cesium.ParticleSystem({
      modelMatrix: Cesium.Matrix4.fromTranslation(scene.camera.position),
      speed: -1.0,
      lifetime: 15.0,
      emitter: new Cesium.SphereEmitter(rainRadius),
      startScale: 1.0,
      endScale: 0.0,
      image: "../../SampleData/circular_particle.png",
      emissionRate: emissionRate,
      startColor: new Cesium.Color(0.27, 0.5, 0.7, 0.0),
      endColor: new Cesium.Color(0.27, 0.5, 0.7, 0.98),
      imageSize: rainImageSize,
      updateCallback: rainUpdate,
    }),
  );

  updateStatus();
}

function stopRain() {
  if (rainSystem) {
    scene.primitives.remove(rainSystem);
    rainSystem = null;
  }
  scene.skyAtmosphere.hueShift = 0;
  scene.skyAtmosphere.saturationShift = 0;
  scene.skyAtmosphere.brightnessShift = 0;
  scene.fog.density = 2.0e-4;
  scene.fog.minimumBrightness = 0.03;
  updateStatus();
}

Sandcastle.addDefaultToolbarButton("开始下雨", function () {
  if (rainSystem) {
    stopRain();
  } else {
    startRain();
  }
});

Sandcastle.addToolbarButton("小雨", function () {
  emissionRate = 3000;
  rainSpeed = 500;
  startRain();
});

Sandcastle.addToolbarButton("中雨", function () {
  emissionRate = 9000;
  rainSpeed = 1050;
  startRain();
});

Sandcastle.addToolbarButton("暴雨", function () {
  emissionRate = 20000;
  rainSpeed = 2000;
  startRain();
});

Sandcastle.addToolbarButton("重置相机", function () {
  scene.camera.setView({
    destination: new Cesium.Cartesian3(
      277096.634865404,
      5647834.481964232,
      2985563.7039122293,
    ),
    orientation: {
      heading: 4.731089976107251,
      pitch: -0.32003481981370063,
    },
  });
});

updateStatus();

Sandcastle.reset = function () {
  stopRain();
  scene.primitives.removeAll();
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
