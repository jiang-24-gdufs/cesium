import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(-77.0, 38.9, 50000),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
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

async function loadGeoJsonAsVector(url, name, style) {
  if (currentDataSource) {
    viewer.dataSources.remove(currentDataSource, true);
    currentDataSource = null;
  }
  viewer.entities.removeAll();

  showStatus(`<b>加载中:</b> ${name}...`);

  try {
    const ds = await Cesium.GeoJsonDataSource.load(url, {
      stroke: style.stroke,
      fill: style.fill,
      strokeWidth: style.strokeWidth || 2,
      clampToGround: true,
    });

    currentDataSource = ds;
    viewer.dataSources.add(ds);

    const count = ds.entities.values.length;
    showStatus(
      `<b>矢量数据:</b> ${name}<br>` +
      `要素数: ${count}<br>` +
      `渲染方式: Entity (GroundPrimitive)`,
    );

    viewer.flyTo(ds, { duration: 1.5 });
  } catch (err) {
    showStatus(`<b style="color:#f44">加载失败</b><br>${err.message}`);
  }
}

showStatus(
  "<b>PBF 矢量样式数据</b><br><br>" +
  "PBF (Protocol Buffers) 矢量瓦片<br>" +
  "需要服务端提供 .pbf 瓦片<br><br>" +
  "本示例使用 GeoJSON 替代演示<br>" +
  "展示矢量数据的加载与样式化",
);

Sandcastle.addDefaultToolbarButton("美国州界", () => {
  loadGeoJsonAsVector(
    "../../SampleData/ne_10m_us_states.topojson",
    "美国州界",
    { stroke: Cesium.Color.LIME, fill: Cesium.Color.LIME.withAlpha(0.15), strokeWidth: 2 },
  );
});

Sandcastle.addToolbarButton("SimpleStyles", () => {
  loadGeoJsonAsVector(
    "../../SampleData/simplestyles.geojson",
    "SimpleStyles",
    { stroke: Cesium.Color.CYAN, fill: Cesium.Color.CYAN.withAlpha(0.3) },
  );
});

Sandcastle.addToolbarButton("随机着色", () => {
  if (!currentDataSource) {
    showStatus("请先加载数据");
    return;
  }
  const entities = currentDataSource.entities.values;
  for (const e of entities) {
    if (e.polygon) {
      e.polygon.material = Cesium.Color.fromRandom({ alpha: 0.5 });
    }
    if (e.polyline) {
      e.polyline.material = Cesium.Color.fromRandom({ alpha: 0.8 });
    }
  }
  showStatus(`<b>随机着色:</b> ${entities.length} 个要素`);
});

Sandcastle.addToolbarButton("PBF 接入说明", () => {
  showStatus(
    "<b>PBF 矢量瓦片接入</b><br><br>" +
    "1. 服务端生成 .pbf 瓦片<br>" +
    "   (如 Martin, t-rex, GeoServer)<br><br>" +
    "2. 客户端解码 PBF:<br>" +
    "   pbf / protobuf.js 库<br><br>" +
    "3. 解码后转为 GeoJSON<br>" +
    "   再用 GeoJsonDataSource 加载<br><br>" +
    "4. 大数据量使用 Primitive<br>" +
    "   BatchTable 批量渲染",
  );
});

Sandcastle.addToolbarButton("清除", () => {
  if (currentDataSource) {
    viewer.dataSources.remove(currentDataSource, true);
    currentDataSource = null;
  }
  viewer.entities.removeAll();
  showStatus("<b>已清除</b>");
});

Sandcastle.reset = function () {
  if (currentDataSource) {
    viewer.dataSources.remove(currentDataSource, true);
    currentDataSource = null;
  }
  viewer.entities.removeAll();
  if (statusPanel.parentNode) statusPanel.parentNode.removeChild(statusPanel);
};
