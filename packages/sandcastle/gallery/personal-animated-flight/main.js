import * as Cesium from "cesium";

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayer: false,
  baseLayerPicker: false,
  animation: true,
  timeline: true,
  scene3DOnly: true,
  infoBox: false,
  selectionIndicator: false,
});

const start = Cesium.JulianDate.fromIso8601("2025-01-01T00:00:00Z");
const stop = Cesium.JulianDate.addHours(start, 1, new Cesium.JulianDate());
const route = [
  [-122.4194, 37.7749, 120],
  [-121.8863, 37.3382, 280],
  [-120.7401, 35.2828, 520],
  [-119.4179, 36.7783, 760],
  [-118.2437, 34.0522, 420],
].map(([longitude, latitude, height]) =>
  Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
);

const position = new Cesium.SampledPositionProperty();
route.forEach((point, index) => {
  const time = Cesium.JulianDate.addSeconds(
    start,
    (index * 3600) / (route.length - 1),
    new Cesium.JulianDate(),
  );
  position.addSample(time, point);
});

viewer.clock.startTime = start.clone();
viewer.clock.stopTime = stop.clone();
viewer.clock.currentTime = start.clone();
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
viewer.clock.multiplier = 45;
viewer.timeline.zoomTo(start, stop);

viewer.entities.add({
  name: "Personal flight",
  position,
  orientation: new Cesium.VelocityOrientationProperty(position),
  model: {
    uri: "../../SampleData/models/CesiumAir/Cesium_Air.glb",
    minimumPixelSize: 48,
    maximumScale: 200,
  },
  path: {
    resolution: 1,
    material: new Cesium.PolylineGlowMaterialProperty({
      glowPower: 0.2,
      color: Cesium.Color.CYAN,
    }),
    width: 8,
  },
  label: {
    text: "Personal flight",
    font: "14px sans-serif",
    fillColor: Cesium.Color.WHITE,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    outlineWidth: 3,
    pixelOffset: new Cesium.Cartesian2(0, -36),
  },
});

viewer.entities.add({
  name: "Route waypoints",
  polyline: {
    positions: route,
    width: 2,
    material: Cesium.Color.CYAN.withAlpha(0.35),
    clampToGround: false,
  },
});

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(-120.8, 36.2, 850000),
  orientation: {
    heading: Cesium.Math.toRadians(20),
    pitch: Cesium.Math.toRadians(-55),
    roll: 0,
  },
});
