import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  selectionIndicator: false,
  infoBox: false,
});
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 10000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

let handler = null;
let activeEntities = [];

showStatus("<b>后处理颜色特效</b><br>核心概念: color grading post-processing effects<br>核心 API: PostProcessStage fragment shader");

Sandcastle.addDefaultToolbarButton("演示 后处理颜色特效", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  showStatus("<b>后处理颜色特效 - 运行中</b><br>核心: color grading post-processing effects");
  
  const stage = scene.postProcessStages.add(new Cesium.PostProcessStage({
    fragmentShader: `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      void main() {
        vec4 color = texture(colorTexture, v_textureCoordinates);
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        out_FragColor = vec4(vec3(gray), color.a);
      }
    `,
  }));
  showStatus("<b>后处理: 黑白效果</b>");
  
});

Sandcastle.addToolbarButton("重置", function () {
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  scene.postProcessStages.removeAll();
  
  showStatus("<b>后处理颜色特效</b><br>已重置");
});

Sandcastle.reset = function () {
  if (handler) { handler.destroy(); handler = null; }
  viewer.entities.removeAll();
  activeEntities = [];
  
  
  scene.postProcessStages.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
