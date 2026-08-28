import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.globe.enableLighting = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 3000),
  orientation: { heading: Cesium.Math.toRadians(30), pitch: Cesium.Math.toRadians(-25), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

let waterPrimitive = null;
let removeUpdateListener = null;
let waterParams = {
  height: 10,
  waveSpeed: 1.0,
  waveAmplitude: 0.03,
  baseColor: [0.0, 0.3, 0.6],
  alpha: 0.6,
};

const waterShader = `
  uniform vec4 u_waterColor;
  uniform float u_time;
  uniform float u_waveAmp;

  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;

    float w1 = sin(st.x * 40.0 + u_time * 3.0) * u_waveAmp;
    float w2 = sin(st.y * 35.0 - u_time * 2.5) * u_waveAmp * 0.8;
    float w3 = sin((st.x + st.y) * 20.0 + u_time * 1.8) * u_waveAmp * 0.5;
    float wave = w1 + w2 + w3;

    vec3 normal = normalize(vec3(-dFdx(wave) * 10.0, -dFdy(wave) * 10.0, 1.0));

    material.diffuse = u_waterColor.rgb + vec3(wave);
    material.alpha = u_waterColor.a;
    material.specular = 0.9;
    material.shininess = 50.0;
    material.normal = normal;

    return material;
  }
`;

function createWaterPrimitive(rect) {
  removeWater();

  const appearance = new Cesium.MaterialAppearance({
    material: new Cesium.Material({
      fabric: {
        type: "SmartGISWater2",
        uniforms: {
          u_waterColor: new Cesium.Color(
            waterParams.baseColor[0], waterParams.baseColor[1], waterParams.baseColor[2], waterParams.alpha,
          ),
          u_time: 0.0,
          u_waveAmp: waterParams.waveAmplitude,
        },
        source: waterShader,
      },
    }),
  });

  waterPrimitive = scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.RectangleGeometry({
          rectangle: Cesium.Rectangle.fromDegrees(rect[0], rect[1], rect[2], rect[3]),
          height: waterParams.height,
        }),
      }),
      appearance: appearance,
    }),
  );

  let startTime = Date.now();
  removeUpdateListener = scene.preRender.addEventListener(function () {
    const elapsed = (Date.now() - startTime) / 1000 * waterParams.waveSpeed;
    if (waterPrimitive && waterPrimitive.appearance && waterPrimitive.appearance.material) {
      waterPrimitive.appearance.material.uniforms.u_time = elapsed;
    }
  });

  showStatus(
    `<b>水面效果 2 (Primitive)</b><br>` +
    `高度: ${waterParams.height}m<br>` +
    `波速: ${waterParams.waveSpeed}x<br>` +
    `波幅: ${waterParams.waveAmplitude}`,
  );
}

function removeWater() {
  if (removeUpdateListener) {
    removeUpdateListener();
    removeUpdateListener = null;
  }
  if (waterPrimitive) {
    scene.primitives.remove(waterPrimitive);
    waterPrimitive = null;
  }
}

const defaultRect = [113.27, 23.08, 113.33, 23.12];

Sandcastle.addDefaultToolbarButton("创建水面", () => createWaterPrimitive(defaultRect));

Sandcastle.addToolbarButton("加速波浪", () => {
  waterParams.waveSpeed = Math.min(waterParams.waveSpeed + 0.5, 5.0);
  createWaterPrimitive(defaultRect);
});

Sandcastle.addToolbarButton("减速波浪", () => {
  waterParams.waveSpeed = Math.max(waterParams.waveSpeed - 0.5, 0.1);
  createWaterPrimitive(defaultRect);
});

Sandcastle.addToolbarButton("增大波幅", () => {
  waterParams.waveAmplitude = Math.min(waterParams.waveAmplitude + 0.01, 0.1);
  createWaterPrimitive(defaultRect);
});

Sandcastle.addToolbarButton("减小波幅", () => {
  waterParams.waveAmplitude = Math.max(waterParams.waveAmplitude - 0.01, 0.005);
  createWaterPrimitive(defaultRect);
});

Sandcastle.addToolbarButton("清除", () => {
  removeWater();
  showStatus("<b>水面已清除</b>");
});

showStatus("<b>水面效果 2</b><br>基于 Primitive + 自研 GLSL 着色器<br>多层正弦波叠加 + 法线扰动");

Sandcastle.reset = function () {
  removeWater();
  scene.globe.enableLighting = false;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
