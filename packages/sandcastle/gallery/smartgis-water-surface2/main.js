import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.globe.enableLighting = true;

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

const waterPositions = [
  [120.60065115783391, 30.004961428607423],
  [120.60078615073238, 30.005928090960985],
  [120.60054615017066, 30.005968890471863],
  [120.60030200406126, 30.005993164672226],
  [120.60007379651816, 30.006039826423557],
  [120.59992936336847, 30.00594702587555],
  [120.59983900854532, 30.00552740794912],
  [120.59974257542459, 30.005052026091487],
  [120.60002362058049, 30.004937565066534],
];

const waterParams = {
  height: 13.61,
  frequency: 5000,
  animationSpeed: 0.01,
  amplitude: 1.0,
  specularIntensity: 0.5,
  baseWaterColor: Cesium.Color.fromCssColorString("#123e5980"),
  blendColor: Cesium.Color.fromCssColorString("#123e59"),
};

let waterPrimitive = null;

function removeWater() {
  if (waterPrimitive) {
    scene.primitives.remove(waterPrimitive);
    waterPrimitive = null;
  }
}

function createWater() {
  removeWater();
  scene.globe.enableLighting = true;

  const polygon = new Cesium.PolygonGeometry({
    polygonHierarchy: new Cesium.PolygonHierarchy(
      waterPositions.map((position) =>
        Cesium.Cartesian3.fromDegrees(position[0], position[1], 0),
      ),
    ),
    height: waterParams.height,
  });

  const material = Cesium.Material.fromType("Water", {
    baseWaterColor: waterParams.baseWaterColor,
    blendColor: waterParams.blendColor,
    frequency: waterParams.frequency,
    animationSpeed: waterParams.animationSpeed,
    amplitude: waterParams.amplitude,
    specularIntensity: waterParams.specularIntensity,
    fadeFactor: 1.0,
  });

  waterPrimitive = scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({ geometry: polygon }),
      appearance: new Cesium.MaterialAppearance({ material }),
      asynchronous: false,
    }),
  );

  showStatus(
    `<b>水面效果 2</b><br>` +
      `Cesium Water 材质 + PolygonGeometry<br>` +
      `高度: ${waterParams.height.toFixed(2)}m<br>` +
      `频率: ${waterParams.frequency}`,
  );
}

viewer.camera.position = new Cesium.Cartesian3(
  -2813965.4114616895,
  4758200.791138136,
  3170870.696838925,
);
viewer.camera.direction = new Cesium.Cartesian3(
  -0.20065659246034429,
  -0.8615893954094931,
  0.466262421411063,
);
viewer.camera.up = new Cesium.Cartesian3(
  -0.5332985380679847,
  0.4953083868123803,
  0.6857567143294098,
);
viewer.camera.right = new Cesium.Cartesian3(
  -0.8217844006774245,
  -0.11105546214041737,
  -0.5588712581015638,
);

Sandcastle.addDefaultToolbarButton("创建水面", createWater);

Sandcastle.addToolbarButton("增大频率", () => {
  waterParams.frequency = Math.min(waterParams.frequency + 1000, 10000);
  createWater();
});

Sandcastle.addToolbarButton("减小频率", () => {
  waterParams.frequency = Math.max(waterParams.frequency - 1000, 100);
  createWater();
});

Sandcastle.addToolbarButton("增大波幅", () => {
  waterParams.amplitude = Math.min(waterParams.amplitude + 0.1, 3.0);
  createWater();
});

Sandcastle.addToolbarButton("减小波幅", () => {
  waterParams.amplitude = Math.max(waterParams.amplitude - 0.1, 0.1);
  createWater();
});

Sandcastle.addToolbarButton("清除", () => {
  removeWater();
  showStatus("<b>水面已清除</b>");
});

showStatus("<b>水面效果 2</b><br>基于 Cesium Water 材质创建水面");

Sandcastle.reset = function () {
  removeWater();
};
