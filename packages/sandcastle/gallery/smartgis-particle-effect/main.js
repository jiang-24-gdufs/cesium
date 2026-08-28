import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  shouldAnimate: true,
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 2000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

const particleSystems = [];

function addFireEffect(position, name) {
  const ps = scene.primitives.add(
    new Cesium.ParticleSystem({
      image: "../../SampleData/fire.png",
      startColor: new Cesium.Color(1, 0.6, 0, 0.7),
      endColor: new Cesium.Color(0.8, 0.2, 0, 0.0),
      startScale: 1.0,
      endScale: 4.0,
      minimumParticleLife: 1.0,
      maximumParticleLife: 3.0,
      minimumSpeed: 1.0,
      maximumSpeed: 5.0,
      imageSize: new Cesium.Cartesian2(20, 20),
      emissionRate: 50,
      lifetime: 16.0,
      emitter: new Cesium.ConeEmitter(Cesium.Math.toRadians(30)),
      modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(position),
    }),
  );
  particleSystems.push({ system: ps, name: name });
  return ps;
}

function addSmokeEffect(position, name) {
  const ps = scene.primitives.add(
    new Cesium.ParticleSystem({
      image: "../../SampleData/smoke.png",
      startColor: new Cesium.Color(0.5, 0.5, 0.5, 0.6),
      endColor: new Cesium.Color(0.8, 0.8, 0.8, 0.0),
      startScale: 1.0,
      endScale: 6.0,
      minimumParticleLife: 2.0,
      maximumParticleLife: 5.0,
      minimumSpeed: 2.0,
      maximumSpeed: 8.0,
      imageSize: new Cesium.Cartesian2(25, 25),
      emissionRate: 30,
      lifetime: 16.0,
      emitter: new Cesium.ConeEmitter(Cesium.Math.toRadians(20)),
      modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(position),
    }),
  );
  particleSystems.push({ system: ps, name: name });
  return ps;
}

function addSparkEffect(position, name) {
  const ps = scene.primitives.add(
    new Cesium.ParticleSystem({
      image: "../../SampleData/circular_particle.png",
      startColor: Cesium.Color.YELLOW,
      endColor: Cesium.Color.RED.withAlpha(0),
      startScale: 0.5,
      endScale: 0.1,
      minimumParticleLife: 0.5,
      maximumParticleLife: 1.5,
      minimumSpeed: 10.0,
      maximumSpeed: 30.0,
      imageSize: new Cesium.Cartesian2(5, 5),
      emissionRate: 100,
      lifetime: 16.0,
      emitter: new Cesium.SphereEmitter(2.0),
      modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(position),
    }),
  );
  particleSystems.push({ system: ps, name: name });
  return ps;
}

function clearAll() {
  for (const p of particleSystems) {
    scene.primitives.remove(p.system);
  }
  particleSystems.length = 0;
}

function updateStatus() {
  const names = particleSystems.map((p) => p.name).join(", ");
  showStatus(
    `<b>粒子特效</b><br>` +
    `活跃系统: ${particleSystems.length}<br>` +
    `${names || "无"}`,
  );
}

Sandcastle.addDefaultToolbarButton("火焰", () => {
  addFireEffect(Cesium.Cartesian3.fromDegrees(113.30, 23.10, 50), "火焰");
  updateStatus();
});

Sandcastle.addToolbarButton("烟雾", () => {
  addSmokeEffect(Cesium.Cartesian3.fromDegrees(113.31, 23.10, 50), "烟雾");
  updateStatus();
});

Sandcastle.addToolbarButton("火花", () => {
  addSparkEffect(Cesium.Cartesian3.fromDegrees(113.32, 23.10, 50), "火花");
  updateStatus();
});

Sandcastle.addToolbarButton("全部特效", () => {
  clearAll();
  addFireEffect(Cesium.Cartesian3.fromDegrees(113.30, 23.10, 50), "火焰");
  addSmokeEffect(Cesium.Cartesian3.fromDegrees(113.31, 23.10, 80), "烟雾");
  addSparkEffect(Cesium.Cartesian3.fromDegrees(113.32, 23.10, 50), "火花");
  updateStatus();
});

Sandcastle.addToolbarButton("清除全部", () => {
  clearAll();
  updateStatus();
});

showStatus("<b>粒子特效</b><br>选择效果类型");

Sandcastle.reset = function () {
  clearAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
