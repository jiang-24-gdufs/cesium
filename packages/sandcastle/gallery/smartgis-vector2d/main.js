import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(0, 30, 15000000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
});

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:50px;left:10px;background:rgba(0,0,0,0.75);color:#fff;" +
  "padding:8px 14px;border-radius:4px;font:13px monospace;pointer-events:none;z-index:10;line-height:1.6;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

let currentDataSource = null;

async function loadGeoJson(url, name, style) {
  if (currentDataSource) {
    viewer.dataSources.remove(currentDataSource, true);
    currentDataSource = null;
  }

  showStatus(`<b>加载中:</b> ${name}...`);

  try {
    const ds = await Cesium.GeoJsonDataSource.load(url, {
      stroke: style.stroke || Cesium.Color.CYAN,
      fill: style.fill || Cesium.Color.CYAN.withAlpha(0.3),
      strokeWidth: style.strokeWidth || 2,
      clampToGround: true,
    });

    currentDataSource = ds;
    viewer.dataSources.add(ds);

    showStatus(
      `<b>已加载:</b> ${name}<br>` +
      `要素数: ${ds.entities.values.length}<br>` +
      `贴地: 是`,
    );

    viewer.flyTo(ds, { duration: 1.5 });
  } catch (err) {
    showStatus(`<b style="color:#f44">加载失败:</b> ${name}<br>${err.message}`);
    console.error("[GeoJSON]", err);
  }
}

Sandcastle.addDefaultToolbarButton("世界国界", () => {
  loadGeoJson(
    "../../SampleData/ne_10m_us_states.topojson",
    "美国州界 (TopoJSON)",
    { stroke: Cesium.Color.YELLOW, fill: Cesium.Color.YELLOW.withAlpha(0.1), strokeWidth: 2 },
  );
});

Sandcastle.addToolbarButton("简单 GeoJSON", () => {
  loadGeoJson(
    "../../SampleData/simplestyles.geojson",
    "SimpleStyles GeoJSON",
    { stroke: Cesium.Color.CYAN, fill: Cesium.Color.CYAN.withAlpha(0.3) },
  );
});

Sandcastle.addToolbarButton("生成矢量网格", () => {
  if (currentDataSource) {
    viewer.dataSources.remove(currentDataSource, true);
    currentDataSource = null;
  }

  const entities = [];
  const gridSize = 10;
  for (let lon = -180; lon < 180; lon += gridSize) {
    for (let lat = -60; lat < 60; lat += gridSize) {
      entities.push(
        viewer.entities.add({
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(lon, lat, lon + gridSize, lat + gridSize),
            material: Cesium.Color.fromRandom({ alpha: 0.2 }),
            outline: true,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
            height: 0,
          },
        }),
      );
    }
  }
  showStatus(`<b>矢量网格:</b> ${entities.length} 个矩形<br>网格大小: ${gridSize}°`);
});

Sandcastle.addToolbarButton("清除", () => {
  if (currentDataSource) {
    viewer.dataSources.remove(currentDataSource, true);
    currentDataSource = null;
  }
  viewer.entities.removeAll();
  showStatus("<b>已清除</b>");
});

showStatus("<b>二维矢量瓦片底图</b><br>选择数据源加载");

Sandcastle.reset = function () {
  if (currentDataSource) {
    viewer.dataSources.remove(currentDataSource, true);
    currentDataSource = null;
  }
  viewer.entities.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
