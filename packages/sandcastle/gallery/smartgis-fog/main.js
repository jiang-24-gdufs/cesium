import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || Cesium.Ion.defaultAccessToken;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: new Cesium.Cartesian3(
    1216356.033078094,
    -4736402.278325668,
    4081270.375520902,
  ),
  orientation: new Cesium.HeadingPitchRoll(
    0.08033365594766728,
    -0.29519015695063455,
    0.00027759141518046704,
  ),
  endTransform: Cesium.Matrix4.IDENTITY,
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;" +
  "background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;" +
  "font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

if (!scene.context.depthTexture) {
  statusPanel.innerHTML =
    '<b style="color:#f44">当前浏览器不支持深度纹理</b><br>雾效果需要 depth texture 支持';
}

let fogStage = null;
let nearDist = 10;
let farDist = 200;
let fogColor = Cesium.Color.WHITE;

const fogShader = `
  float getDistance(sampler2D depthTexture, vec2 texCoords) {
    float depth = czm_unpackDepth(texture(depthTexture, texCoords));
    if (depth == 0.0) return czm_infinity;
    vec4 eyeCoordinate = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
    return -eyeCoordinate.z / eyeCoordinate.w;
  }
  float interpolateByDistance(vec4 nearFarScalar, float distance) {
    float startDistance = nearFarScalar.x;
    float startValue = nearFarScalar.y;
    float endDistance = nearFarScalar.z;
    float endValue = nearFarScalar.w;
    float t = clamp((distance - startDistance) / (endDistance - startDistance), 0.0, 1.0);
    return mix(startValue, endValue, t);
  }
  vec4 alphaBlend(vec4 sourceColor, vec4 destinationColor) {
    return sourceColor * vec4(sourceColor.aaa, 1.0) + destinationColor * (1.0 - sourceColor.a);
  }
  uniform sampler2D colorTexture;
  uniform sampler2D depthTexture;
  uniform vec4 fogByDistance;
  uniform vec4 fogColor;
  in vec2 v_textureCoordinates;
  void main(void) {
    float distance = getDistance(depthTexture, v_textureCoordinates);
    vec4 sceneColor = texture(colorTexture, v_textureCoordinates);
    float blendAmount = interpolateByDistance(fogByDistance, distance);
    vec4 finalFogColor = vec4(fogColor.rgb, fogColor.a * blendAmount);
    out_FragColor = alphaBlend(finalFogColor, sceneColor);
  }
`;

function updateStatus() {
  const colorName =
    fogColor === Cesium.Color.WHITE
      ? "白色"
      : fogColor === Cesium.Color.BLACK
        ? "黑色"
        : fogColor.toCssHexString();
  statusPanel.innerHTML =
    `<b>雾效果</b><br>` +
    `状态: <span style="color:${fogStage ? "#0f0" : "#f44"}">${fogStage ? "已启用" : "已关闭"}</span><br>` +
    `近距离: ${nearDist}m<br>` +
    `远距离: ${farDist}m<br>` +
    `雾颜色: ${colorName}`;
}

function applyFog() {
  removeFog();
  fogStage = scene.postProcessStages.add(
    new Cesium.PostProcessStage({
      fragmentShader: fogShader,
      uniforms: {
        fogByDistance: new Cesium.Cartesian4(nearDist, 0.0, farDist, 1.0),
        fogColor: fogColor,
      },
    }),
  );
  updateStatus();
}

function removeFog() {
  if (fogStage) {
    scene.postProcessStages.remove(fogStage);
    fogStage = null;
  }
  updateStatus();
}

Sandcastle.addDefaultToolbarButton("白雾", function () {
  fogColor = Cesium.Color.WHITE;
  nearDist = 10;
  farDist = 200;
  applyFog();
});

Sandcastle.addToolbarButton("黑雾 (夜间)", function () {
  fogColor = Cesium.Color.BLACK;
  nearDist = 10;
  farDist = 200;
  applyFog();
});

Sandcastle.addToolbarButton("浓雾", function () {
  fogColor = Cesium.Color.WHITE;
  nearDist = 5;
  farDist = 50;
  applyFog();
});

Sandcastle.addToolbarButton("薄雾", function () {
  fogColor = Cesium.Color.WHITE;
  nearDist = 50;
  farDist = 500;
  applyFog();
});

Sandcastle.addToolbarButton("关闭雾", function () {
  removeFog();
});

updateStatus();

Sandcastle.reset = function () {
  removeFog();
  if (statusPanel.parentNode) {
    statusPanel.parentNode.removeChild(statusPanel);
  }
};
