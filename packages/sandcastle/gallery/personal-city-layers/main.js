import * as Cesium from "cesium";

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
  baseLayerPicker: false,
  scene3DOnly: true,
  infoBox: false,
  selectionIndicator: false,
});

const districts = [
  { name: "North", color: Cesium.Color.fromCssColorString("#4cc9f0") },
  { name: "Central", color: Cesium.Color.fromCssColorString("#f72585") },
  { name: "South", color: Cesium.Color.fromCssColorString("#fca311") },
];
const buildings = [];
const centerLongitude = -73.9857;
const centerLatitude = 40.7484;

for (let row = 0; row < 4; row += 1) {
  for (let column = 0; column < 5; column += 1) {
    const height = 80 + ((row * 5 + column) % 7) * 55;
    const district = districts[row < 1 ? 0 : row > 2 ? 2 : 1];
    const longitude = centerLongitude + (column - 2) * 0.006;
    const latitude = centerLatitude + (row - 1.5) * 0.006;
    const entity = viewer.entities.add({
      name: `Building ${row + 1}-${column + 1}`,
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height / 2),
      box: {
        dimensions: new Cesium.Cartesian3(360, 260, height),
        material: district.color.withAlpha(0.85),
        outline: true,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
      },
      properties: {
        district: district.name,
        floors: Math.round(height / 3.5),
        height,
      },
    });
    buildings.push({ entity, height, district });
  }
}

function applyLayer(mode) {
  buildings.forEach(({ entity, height, district }) => {
    if (mode === "height") {
      const hue = 0.62 - (height - 80) / 900;
      entity.box.material = Cesium.Color.fromHsl(hue, 0.85, 0.58, 0.88);
    } else if (mode === "district") {
      entity.box.material = district.color.withAlpha(0.88);
    } else {
      entity.box.material = Cesium.Color.WHITE.withAlpha(0.8);
    }
  });
}

document.getElementById("layerSelect").addEventListener("change", (event) => {
  applyLayer(event.target.value);
});

const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.position);
  if (Cesium.defined(picked?.id?.properties)) {
    const properties = picked.id.properties;
    const district = properties.district.getValue(viewer.clock.currentTime);
    const floors = properties.floors.getValue(viewer.clock.currentTime);
    const height = properties.height.getValue(viewer.clock.currentTime);
    document.querySelector(".infoPanel").textContent =
      `${picked.id.name} · ${district} district · ${floors} floors · ${height} m`;
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

applyLayer("height");
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(centerLongitude, centerLatitude, 2800),
  orientation: {
    heading: Cesium.Math.toRadians(12),
    pitch: Cesium.Math.toRadians(-58),
    roll: 0,
  },
});
