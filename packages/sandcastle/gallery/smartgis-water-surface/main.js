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

let waterPrimitive = null;
let removeUpdateListener = null;
let waterHeight = 10;
let waterColor = new Cesium.Color(0.0, 0.3, 0.6, 0.6);
let activeCoords = null;
let activeName = "";

const waterMaterialSource = `
  uniform vec4 waterColor;
  uniform float u_time;
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    float wave1 = sin(st.x * 30.0 + u_time * 2.0) * 0.02;
    float wave2 = sin(st.y * 25.0 + u_time * 1.5) * 0.015;
    float wave = wave1 + wave2;
    material.diffuse = waterColor.rgb + vec3(wave * 0.5);
    material.alpha = waterColor.a + wave * 0.2;
    material.specular = 0.8;
    material.shininess = 20.0;
    return material;
  }
`;

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

function createWater(coords, name) {
  removeWater();
  activeCoords = coords;
  activeName = name;

  const appearance = new Cesium.MaterialAppearance({
    material: new Cesium.Material({
      fabric: {
        type: "SmartGISWater",
        uniforms: {
          waterColor: waterColor,
          u_time: 0,
        },
        source: waterMaterialSource,
      },
    }),
    translucent: true,
    closed: false,
  });

  waterPrimitive = scene.primitives.add(new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(
          Cesium.Cartesian3.fromDegreesArray(coords),
        ),
        height: waterHeight,
      }),
    }),
    appearance: appearance,
    asynchronous: false,
  }));

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(113.302, 23.106, 1800),
    orientation: {
      heading: Cesium.Math.toRadians(30),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0,
    },
  });

  const startTime = Date.now();
  removeUpdateListener = scene.preRender.addEventListener(() => {
    if (waterPrimitive?.appearance?.material?.uniforms) {
      waterPrimitive.appearance.material.uniforms.u_time =
        (Date.now() - startTime) / 1000;
    }
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
  if (activeCoords) {
    createWater(activeCoords, activeName);
  }
  showStatus(`<b>水面高度:</b> ${waterHeight}m`);
});

Sandcastle.addToolbarButton("降低水面", () => {
  waterHeight = Math.max(0, waterHeight - 5);
  if (activeCoords) {
    createWater(activeCoords, activeName);
  }
  showStatus(`<b>水面高度:</b> ${waterHeight}m`);
});

Sandcastle.addToolbarButton("深蓝色", () => {
  waterColor = new Cesium.Color(0.0, 0.15, 0.4, 0.7);
  if (activeCoords) createWater(activeCoords, "深蓝" + activeName);
});

Sandcastle.addToolbarButton("浅绿色", () => {
  waterColor = new Cesium.Color(0.0, 0.4, 0.3, 0.5);
  if (activeCoords) createWater(activeCoords, "浅绿" + activeName);
});

Sandcastle.addToolbarButton("清除", () => {
  removeWater();
  activeCoords = null;
  activeName = "";
  showStatus("<b>水面已清除</b>");
});

showStatus("<b>水面效果</b><br>选择水体类型查看效果");

Sandcastle.reset = function () {
  removeWater();
  activeCoords = null;
  activeName = "";
  viewer.entities.removeAll();
  scene.globe.enableLighting = false;
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
