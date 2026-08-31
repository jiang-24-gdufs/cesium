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
  "position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.78);color:#fff;" +
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
  showWater: true,
  height: 14.6,
  size: 50,
  rf0: 0.7,
  distortionScale: 2.3,
  sigma: 1.9,
  alpha: 0.9,
};

const waterShader = `
  uniform vec4 waterColor;
  uniform float waterAlpha;
  uniform float u_time;
  uniform float waveSize;
  uniform float rf0;
  uniform float distortionScale;
  uniform float blurSigma;

  vec3 getWaterNormal(vec2 st) {
    float frequency = max(waveSize, 1.0) * 0.12;
    float t = u_time * 1.8;
    float x1 = sin(st.x * frequency * 5.0 + t);
    float y1 = sin(st.y * frequency * 4.0 - t * 0.8);
    float x2 = sin((st.x + st.y) * frequency * 3.0 + t * 0.55);
    vec2 gradient = vec2(
      x1 * 0.16 + x2 * 0.10,
      y1 * 0.16 + x2 * 0.08
    ) * distortionScale;
    return normalize(vec3(-gradient.x, -gradient.y, 1.0));
  }

  vec3 getEnvironmentReflection(vec3 reflected, float blurAmount) {
    float horizon = clamp(reflected.z * 0.5 + 0.5, 0.0, 1.0);
    vec3 horizonColor = vec3(0.18, 0.34, 0.48);
    vec3 zenithColor = vec3(0.55, 0.72, 0.86);
    vec3 reflection = mix(horizonColor, zenithColor, horizon);
    float sun = pow(max(dot(reflected, normalize(czm_sunDirectionEC)), 0.0), 48.0);
    reflection += vec3(1.0, 0.86, 0.62) * sun * (1.0 - blurAmount * 0.35);
    return reflection;
  }

  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec3 normal = getWaterNormal(materialInput.st);
    vec3 eyeDirection = normalize(-materialInput.positionToEyeEC);
    float theta = max(dot(eyeDirection, normal), 0.0);
    float fresnel = mix(rf0, 1.0, pow(1.0 - theta, 5.0));
    float blurAmount = clamp(blurSigma / 10.0, 0.0, 1.0);
    vec3 reflected = reflect(-eyeDirection, normal);
    vec3 reflection = getEnvironmentReflection(reflected, blurAmount);
    float shimmer = sin(materialInput.st.x * waveSize * 0.5 + u_time * 2.0) * 0.025;
    vec3 scatter = waterColor.rgb + vec3(shimmer);
    material.diffuse = mix(scatter, reflection, fresnel * (1.0 - blurAmount * 0.45));
    material.alpha = waterAlpha;
    material.normal = normal;
    material.specular = 0.9;
    material.shininess = 30.0;
    return material;
  }
`;

let waterPrimitive = null;
let updateTime = null;

function removeWater() {
  if (updateTime) {
    updateTime();
    updateTime = null;
  }
  if (waterPrimitive) {
    scene.primitives.remove(waterPrimitive);
    waterPrimitive = null;
  }
}

function createWater() {
  removeWater();
  scene.globe.enableLighting = true;

  const geometry = new Cesium.PolygonGeometry({
    polygonHierarchy: new Cesium.PolygonHierarchy(
      waterPositions.map((position) =>
        Cesium.Cartesian3.fromDegrees(position[0], position[1], 0),
      ),
    ),
    height: waterParams.height,
  });

  const material = new Cesium.Material({
    fabric: {
      type: "OpenSourceWaterReflection",
      uniforms: {
        waterColor: Cesium.Color.fromCssColorString("#123e59"),
        waterAlpha: waterParams.alpha,
        u_time: 0,
        waveSize: waterParams.size,
        rf0: waterParams.rf0,
        distortionScale: waterParams.distortionScale,
        blurSigma: waterParams.sigma,
      },
      source: waterShader,
    },
  });

  waterPrimitive = scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({ geometry }),
      appearance: new Cesium.MaterialAppearance({ material }),
      asynchronous: false,
      show: waterParams.showWater,
    }),
  );

  const startTime = Date.now();
  updateTime = scene.preRender.addEventListener(() => {
    if (waterPrimitive?.appearance?.material?.uniforms) {
      waterPrimitive.appearance.material.uniforms.u_time =
        (Date.now() - startTime) / 1000;
    }
  });

  showStatus(
    `<b>水面特效（自研等效实现）</b><br>` +
      `水面显隐: ${waterParams.showWater ? "开启" : "关闭"}<br>` +
      `高度: ${waterParams.height.toFixed(1)}m　波纹尺寸: ${waterParams.size}<br>` +
      `反射率: ${waterParams.rf0.toFixed(2)}　扭曲: ${waterParams.distortionScale.toFixed(1)}<br>` +
      `模糊: ${waterParams.sigma.toFixed(1)}　透明度: ${waterParams.alpha.toFixed(2)}`,
  );
}

function createParameterPanel() {
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:absolute;top:10px;right:10px;width:250px;padding:12px;" +
    "background:rgba(32,38,48,.92);color:#fff;border-radius:6px;z-index:20;" +
    "font:12px sans-serif;box-sizing:border-box;";
  panel.innerHTML = `
    <div style="font-size:14px;font-weight:600;margin-bottom:8px">水面参数调节</div>
    <label><input id="water-show" type="checkbox" checked> 水面显隐</label>
    <label>水面高度 <input id="water-height" type="range" min="0" max="30" step="0.1" value="14.6"></label>
    <label>波纹尺寸 <input id="water-size" type="range" min="0" max="1000" step="1" value="50"></label>
    <label>反射系数 <input id="water-rf0" type="range" min="0" max="1" step="0.01" value="0.7"></label>
    <label>倒影扭曲 <input id="water-distortion" type="range" min="0" max="10" step="0.1" value="2.3"></label>
    <label>倒影模糊 <input id="water-sigma" type="range" min="0" max="10" step="0.1" value="1.9"></label>
    <label>透明度 <input id="water-alpha" type="range" min="0" max="1" step="0.01" value="0.9"></label>`;
  panel.querySelectorAll("label").forEach((label) => {
    label.style.display = "block";
    label.style.margin = "8px 0";
  });
  document.getElementById("cesiumContainer").appendChild(panel);

  panel.querySelector("#water-show").addEventListener("change", (event) => {
    waterParams.showWater = event.target.checked;
    if (waterPrimitive) waterPrimitive.show = waterParams.showWater;
    createWater();
  });
  panel.querySelector("#water-height").addEventListener("input", (event) => {
    waterParams.height = Number(event.target.value);
    createWater();
  });
  panel.querySelector("#water-size").addEventListener("input", (event) => {
    waterParams.size = Number(event.target.value);
    createWater();
  });
  panel.querySelector("#water-rf0").addEventListener("input", (event) => {
    waterParams.rf0 = Number(event.target.value);
    createWater();
  });
  panel.querySelector("#water-distortion").addEventListener("input", (event) => {
    waterParams.distortionScale = Number(event.target.value);
    createWater();
  });
  panel.querySelector("#water-sigma").addEventListener("input", (event) => {
    waterParams.sigma = Number(event.target.value);
    createWater();
  });
  panel.querySelector("#water-alpha").addEventListener("input", (event) => {
    waterParams.alpha = Number(event.target.value);
    createWater();
  });
  return panel;
}

const parameterPanel = createParameterPanel();
createWater();

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
Sandcastle.addToolbarButton("清除", () => {
  removeWater();
  showStatus("<b>水面已清除</b>");
});

Sandcastle.reset = function () {
  removeWater();
};
