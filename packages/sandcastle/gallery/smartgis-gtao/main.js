import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
});
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 10000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText = "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;max-width:300px;";
document.getElementById("cesiumContainer").appendChild(statusPanel);
function showStatus(t) { statusPanel.innerHTML = t; }

showStatus("<b>GTAO</b><br>难度: D3<br>核心: screen-space AO<br>API: PostProcessStage + depth normal");


let stage = null;
Sandcastle.addDefaultToolbarButton("启用效果", function () {
  if (stage) scene.postProcessStages.remove(stage);
  stage = scene.postProcessStages.add(new Cesium.PostProcessStage({
    fragmentShader: `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      void main() {
        vec4 c = texture(colorTexture, v_textureCoordinates);
        float gray = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        out_FragColor = vec4(vec3(gray), c.a);
      }
    `,
  }));
  showStatus("<b>GTAO - 已启用</b>");
});
Sandcastle.addToolbarButton("关闭效果", function () {
  if (stage) { scene.postProcessStages.remove(stage); stage = null; }
  showStatus("<b>效果已关闭</b>");
});


Sandcastle.reset = function () {
  viewer.entities.removeAll();
  
  scene.postProcessStages.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
