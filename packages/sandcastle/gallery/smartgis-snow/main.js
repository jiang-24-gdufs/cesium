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

let snowSystem = null;
let emissionRate = 7000;

const snowParticleSize = 12.0;
const snowRadius = 100000.0;
const minimumSnowImageSize = new Cesium.Cartesian2(
  snowParticleSize,
  snowParticleSize,
);
const maximumSnowImageSize = new Cesium.Cartesian2(
  snowParticleSize * 2.0,
  snowParticleSize * 2.0,
);

let gravityScratch = new Cesium.Cartesian3();

function snowUpdate(particle) {
  gravityScratch = Cesium.Cartesian3.normalize(
    particle.position,
    gravityScratch,
  );
  Cesium.Cartesian3.multiplyByScalar(
    gravityScratch,
    Cesium.Math.randomBetween(-30.0, -300.0),
    gravityScratch,
  );
  particle.velocity = Cesium.Cartesian3.add(
    particle.velocity,
    gravityScratch,
    particle.velocity,
  );
  const distance = Cesium.Cartesian3.distance(
    scene.camera.position,
    particle.position,
  );
  if (distance > snowRadius) {
    particle.endColor.alpha = 0.0;
  } else {
    particle.endColor.alpha = 1.0 / (distance / snowRadius + 0.1);
  }
}

function updateStatus() {
  statusPanel.innerHTML =
    `<b>雪效果</b><br>` +
    `状态: <span style="color:${snowSystem ? "#0f0" : "#f44"}">${snowSystem ? "下雪中" : "已停止"}</span><br>` +
    `发射率: ${emissionRate}/s`;
}

function startSnow() {
  stopSnow();

  scene.skyAtmosphere.hueShift = -0.8;
  scene.skyAtmosphere.saturationShift = -0.7;
  scene.skyAtmosphere.brightnessShift = -0.33;
  scene.fog.density = 0.001;
  scene.fog.minimumBrightness = 0.8;

  snowSystem = scene.primitives.add(
    new Cesium.ParticleSystem({
      modelMatrix: Cesium.Matrix4.fromTranslation(scene.camera.position),
      minimumSpeed: -1.0,
      maximumSpeed: 0.0,
      lifetime: 15.0,
      emitter: new Cesium.SphereEmitter(snowRadius),
      startScale: 0.5,
      endScale: 1.0,
      image: "../../SampleData/snowflake_particle.png",
      emissionRate: emissionRate,
      startColor: Cesium.Color.WHITE.withAlpha(0.0),
      endColor: Cesium.Color.WHITE.withAlpha(1.0),
      minimumImageSize: minimumSnowImageSize,
      maximumImageSize: maximumSnowImageSize,
      updateCallback: snowUpdate,
    }),
  );

  updateStatus();
}

function stopSnow() {
  if (snowSystem) {
    scene.primitives.remove(snowSystem);
    snowSystem = null;
  }
  scene.skyAtmosphere.hueShift = 0;
  scene.skyAtmosphere.saturationShift = 0;
  scene.skyAtmosphere.brightnessShift = 0;
  scene.fog.density = 2.0e-4;
  scene.fog.minimumBrightness = 0.03;
  updateStatus();
}

Sandcastle.addDefaultToolbarButton("开始下雪", function () {
  if (snowSystem) {
    stopSnow();
  } else {
    startSnow();
  }
});

Sandcastle.addToolbarButton("小雪", function () {
  emissionRate = 2000;
  startSnow();
});

Sandcastle.addToolbarButton("中雪", function () {
  emissionRate = 7000;
  startSnow();
});

Sandcastle.addToolbarButton("暴雪", function () {
  emissionRate = 20000;
  startSnow();
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
  stopSnow();
  scene.primitives.removeAll();
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
