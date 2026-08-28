import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.globe.enableLighting = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.3, 23.1, 5000),
  orientation: { heading: Cesium.Math.toRadians(30), pitch: Cesium.Math.toRadians(-30), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

let waterEntity = null;
let waterHeight = 10;
let waterColor = new Cesium.Color(0.0, 0.3, 0.6, 0.6);

const waterMaterialSource = `
  uniform vec4 waterColor;
  uniform float time;
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    float wave1 = sin(st.x * 30.0 + time * 2.0) * 0.02;
    float wave2 = sin(st.y * 25.0 + time * 1.5) * 0.015;
    float wave = wave1 + wave2;
    material.diffuse = waterColor.rgb + vec3(wave * 0.5);
    material.alpha = waterColor.a + wave * 0.2;
    material.specular = 0.8;
    material.shininess = 20.0;
    return material;
  }
`;

function createWater(coords, name) {
  if (waterEntity) viewer.entities.remove(waterEntity);

  waterEntity = viewer.entities.add({
    name: name,
    polygon: {
      hierarchy: Cesium.Cartesian3.fromDegreesArray(coords),
      height: waterHeight,
      material: new Cesium.Material({
        fabric: {
          type: "SmartGISWater",
          uniforms: {
            waterColor: waterColor,
            time: 0,
          },
          source: waterMaterialSource,
        },
      }),
      outline: true,
      outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
    },
  });

  showStatus(
    `<b>水面效果:</b> ${name}<br>` +
    `高度: ${waterHeight}m<br>` +
    `颜色: rgba(${(waterColor.red * 255).toFixed(0)}, ${(waterColor.green * 255).toFixed(0)}, ${(waterColor.blue * 255).toFixed(0)}, ${waterColor.alpha.toFixed(1)})`,
  );
}

const lakeCoords = [
  113.29, 23.11,
  113.31, 23.115,
  113.32, 23.11,
  113.315, 23.10,
  113.30, 23.095,
  113.285, 23.10,
];

const riverCoords = [
  113.28, 23.12,
  113.30, 23.125,
  113.32, 23.12,
  113.34, 23.115,
  113.34, 23.11,
  113.32, 23.105,
  113.30, 23.11,
  113.28, 23.115,
];

Sandcastle.addDefaultToolbarButton("湖泊水面", () => createWater(lakeCoords, "湖泊"));
Sandcastle.addToolbarButton("河流水面", () => createWater(riverCoords, "河流"));

Sandcastle.addToolbarButton("升高水面", () => {
  waterHeight += 5;
  if (waterEntity) {
    waterEntity.polygon.height = waterHeight;
  }
  showStatus(`<b>水面高度:</b> ${waterHeight}m`);
});

Sandcastle.addToolbarButton("降低水面", () => {
  waterHeight = Math.max(0, waterHeight - 5);
  if (waterEntity) {
    waterEntity.polygon.height = waterHeight;
  }
  showStatus(`<b>水面高度:</b> ${waterHeight}m`);
});

Sandcastle.addToolbarButton("深蓝色", () => {
  waterColor = new Cesium.Color(0.0, 0.15, 0.4, 0.7);
  if (waterEntity) createWater(lakeCoords, "深蓝湖泊");
});

Sandcastle.addToolbarButton("浅绿色", () => {
  waterColor = new Cesium.Color(0.0, 0.4, 0.3, 0.5);
  if (waterEntity) createWater(lakeCoords, "浅绿湖泊");
});

Sandcastle.addToolbarButton("清除", () => {
  if (waterEntity) {
    viewer.entities.remove(waterEntity);
    waterEntity = null;
  }
  showStatus("<b>水面已清除</b>");
});

showStatus("<b>水面效果</b><br>选择水体类型查看效果");

Sandcastle.reset = function () {
  if (waterEntity) {
    viewer.entities.remove(waterEntity);
    waterEntity = null;
  }
  viewer.entities.removeAll();
  scene.globe.enableLighting = false;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
