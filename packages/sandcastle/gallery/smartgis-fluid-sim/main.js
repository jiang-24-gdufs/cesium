import * as Cesium from "cesium";
import Sandcastle from "Sandcastle";

// 本示例不使用 SmartGIS 的 FluidPrimitive。这里用有限差分浅水方程实现一个
// 可交互的二维水深/速度场，再把结果重建为 Cesium Primitive 网格。
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
  shouldAnimate: true,
});

const scene = viewer.scene;
// 水面高度已由 terrain 采样对齐。关闭地形深度遮挡可以避免薄水面在地形 LOD
// 逐步加载时被偶发遮蔽；求解域仍然以采样到的地形为基准。
scene.globe.depthTestAgainstTerrain = false;
scene.globe.enableLighting = true;

const domain = {
  longitude: 113.76587277977714,
  latitude: 24.393383780469794,
  height: 500.0,
  surfaceOffset: 3.0,
  size: 4000.0,
  gridSize: 48,
};

let domainCenter;
let enuToFixed;
let fixedToEnu;
let enuRotation;
const terrainSampleSize = 25;
let terrainHeights;

function updateDomainFrame(height) {
  domain.height = height;
  domainCenter = Cesium.Cartesian3.fromDegrees(
    domain.longitude,
    domain.latitude,
    domain.height,
  );
  enuToFixed = Cesium.Transforms.eastNorthUpToFixedFrame(domainCenter);
  fixedToEnu = Cesium.Matrix4.inverseTransformation(
    enuToFixed,
    new Cesium.Matrix4(),
  );
  enuRotation = Cesium.Matrix4.getMatrix3(enuToFixed, new Cesium.Matrix3());
}

async function alignDomainToTerrain() {
  try {
    const [sample] = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [
      Cesium.Cartographic.fromDegrees(domain.longitude, domain.latitude),
    ]);
    if (Number.isFinite(sample.height)) {
      updateDomainFrame(sample.height + domain.surfaceOffset);
      return;
    }
  } catch {
    // 离线或 token 失效时保留示例坐标的预设高度，流体算法仍可运行。
  }
  updateDomainFrame(domain.height);
}

async function captureTerrainHeights() {
  const cartographics = [];
  const half = domain.size * 0.5;
  for (let y = 0; y < terrainSampleSize; y++) {
    for (let x = 0; x < terrainSampleSize; x++) {
      const localX = -half + (x / (terrainSampleSize - 1)) * domain.size;
      const localY = -half + (y / (terrainSampleSize - 1)) * domain.size;
      cartographics.push(Cesium.Cartographic.fromCartesian(localToWorld(localX, localY)));
    }
  }
  try {
    const samples = await Cesium.sampleTerrainMostDetailed(
      viewer.terrainProvider,
      cartographics,
    );
    terrainHeights = new Float64Array(samples.length);
    for (let index = 0; index < samples.length; index++) {
      terrainHeights[index] = Number.isFinite(samples[index].height)
        ? samples[index].height - domain.height
        : -domain.surfaceOffset;
    }
  } catch {
    terrainHeights = new Float64Array(terrainSampleSize * terrainSampleSize);
    terrainHeights.fill(-domain.surfaceOffset);
  }
}

updateDomainFrame(domain.height);

const statusPanel = document.createElement("div");
statusPanel.style.cssText =
  "position:absolute;top:10px;left:10px;background:rgba(0,0,0,.78);" +
  "color:#fff;padding:9px 13px;border-radius:5px;font:12px monospace;" +
  "pointer-events:none;z-index:10;line-height:1.6;max-width:340px;";
document.getElementById("cesiumContainer").appendChild(statusPanel);

function showStatus(text) {
  statusPanel.innerHTML = text;
}

function localToWorld(x, y, z = 0.0, result = new Cesium.Cartesian3()) {
  return Cesium.Matrix4.multiplyByPoint(
    enuToFixed,
    new Cesium.Cartesian3(x, y, z),
    result,
  );
}

function worldToLocal(position, result = new Cesium.Cartesian3()) {
  return Cesium.Matrix4.multiplyByPoint(fixedToEnu, position, result);
}

const parameters = {
  running: true,
  timeStep: 1.0 / 30.0,
  dropEnabled: true,
  dropRadius: 150.0,
  dropVolume: 1000000.0,
  dropIncrementSpeed: 1.0,
  verticalExaggeration: 6.0,
  shadingType: "水体",
  showDomainBoxOutline: true,
  showFlowArrows: false,
};

const shadingModes = {
  水体: 0.0,
  "简单水面": 1.0,
  "流体流向": 2.0,
  "流体法线": 3.0,
  "流体深度": 4.0,
  "流体速度": 5.0,
  "风格化水体": 6.0,
};

const fluidMaterialSource = `
  uniform float u_time;
  uniform float shadingMode;
  uniform float maxDepth;
  uniform float averageSpeed;

  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    float wave = sin((st.x + st.y) * 80.0 + u_time * 2.0) * 0.025;
    vec3 normal = normalize(materialInput.normalEC + vec3(wave, wave * 0.7, 0.0));
    vec3 water = vec3(0.04, 0.30, 0.48) + vec3(wave * 1.5);

    if (shadingMode == 1.0) {
      water = vec3(0.06, 0.42, 0.64);
    } else if (shadingMode == 2.0) {
      water = vec3(0.02, 0.20, 0.32) + vec3(0.0, 0.45, 0.55) * clamp(averageSpeed * 0.35, 0.0, 1.0);
    } else if (shadingMode == 3.0) {
      water = normal * 0.5 + 0.5;
    } else if (shadingMode == 4.0) {
      water = mix(vec3(0.0, 0.08, 0.22), vec3(0.0, 0.75, 0.95), clamp(maxDepth / 12.0, 0.0, 1.0));
    } else if (shadingMode == 5.0) {
      water = mix(vec3(0.08, 0.1, 0.8), vec3(0.95, 0.3, 0.03), clamp(averageSpeed * 0.35, 0.0, 1.0));
    } else if (shadingMode == 6.0) {
      water = mix(vec3(0.03, 0.12, 0.28), vec3(0.0, 0.85, 0.78), 0.5 + 0.5 * sin(st.x * 42.0 - u_time));
    }

    material.diffuse = water;
    material.normal = normal;
    material.specular = 0.85;
    material.shininess = 48.0;
    material.alpha = 0.82;
    return material;
  }
`;

class ShallowWaterSimulation {
  constructor() {
    this.size = domain.gridSize;
    this.count = this.size * this.size;
    this.cellSize = domain.size / this.size;
    this.depth = new Float32Array(this.count);
    this.nextDepth = new Float32Array(this.count);
    this.velocityX = new Float32Array(this.count);
    this.velocityY = new Float32Array(this.count);
    this.nextVelocityX = new Float32Array(this.count);
    this.nextVelocityY = new Float32Array(this.count);
    this.solid = new Uint8Array(this.count);
    this.drops = [];
    this.totalTime = 0.0;
    this._lastRenderTime = 0.0;
    this._lastStatusTime = 0.0;
    this.primitive = undefined;
    this.retiredPrimitives = [];
    this.retireListeners = [];
    this.flowArrows = undefined;
    this.removePreRender = undefined;
    this.removeInput = undefined;
    this.previewEntity = undefined;
    this.outlineEntity = undefined;
    this.damEntity = undefined;
    this._scratchWorld = new Cesium.Cartesian3();
    this._scratchNormal = new Cesium.Cartesian3();
    this._seedReservoirAndDam();
  }

  index(x, y) {
    return y * this.size + x;
  }

  _seedReservoirAndDam() {
    const half = (this.size - 1) * 0.5;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const dx = (x - half) / half;
        const dy = (y - half) / half;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const index = this.index(x, y);
        if (distance < 0.72) {
          this.depth[index] = Math.max(0.0, (0.72 - distance) * 4.5);
        }

        // 一道带缺口的大坝：水会在缺口和两端绕流，而不是只做水位动画。
        const isDam = Math.abs(x - Math.floor(this.size * 0.52)) <= 1;
        const isGate = Math.abs(y - Math.floor(this.size * 0.52)) <= 3;
        if (isDam && !isGate && y > 4 && y < this.size - 5) {
          this.solid[index] = 1;
          this.depth[index] = 0.0;
        }
      }
    }
  }

  start() {
    this._createStaticScene();
    this._createInputHandlers();
    this.removePreRender = scene.preRender.addEventListener((sceneArg, time) => {
      this.update(time);
    });
    this.render(true);
  }

  _createStaticScene() {
    const half = domain.size * 0.5;
    this.outlineEntity = viewer.entities.add({
      position: domainCenter,
      box: {
        dimensions: new Cesium.Cartesian3(domain.size, domain.size, 2.0),
        fill: false,
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.8),
        show: parameters.showDomainBoxOutline,
      },
    });

    const damPosition = localToWorld(domain.size * 0.02, 0.0, 24.0);
    this.damEntity = viewer.entities.add({
      position: damPosition,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        damPosition,
        new Cesium.HeadingPitchRoll(0.0, 0.0, 0.0),
      ),
      box: {
        dimensions: new Cesium.Cartesian3(150.0, domain.size * 0.78, 48.0),
        material: Cesium.Color.DARKSLATEGRAY.withAlpha(0.92),
        outline: true,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.45),
      },
    });

    viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(domainCenter, Math.sqrt(2.0) * half),
      {
        duration: 0.8,
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(28.0),
          Cesium.Math.toRadians(-48.0),
          domain.size * 1.05,
        ),
      },
    );
  }

  _createInputHandlers() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    handler.setInputAction((movement) => {
      this._updateDropPreview(movement.endPosition);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.setInputAction((movement) => {
      if (!parameters.dropEnabled) return;
      const local = this._pickLocal(movement.position);
      if (!local) return;
      this.addDrop(
        local.x,
        local.y,
        parameters.dropVolume,
        parameters.dropRadius,
        parameters.dropIncrementSpeed,
      );
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    this.removeInput = () => handler.destroy();
  }

  _pickLocal(windowPosition) {
    const ray = viewer.camera.getPickRay(windowPosition);
    if (!ray) return undefined;
    const plane = Cesium.Plane.fromPointNormal(
      domainCenter,
      Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(domainCenter),
    );
    const world = Cesium.IntersectionTests.rayPlane(ray, plane);
    if (!world) return undefined;
    const local = worldToLocal(world);
    const half = domain.size * 0.5;
    if (Math.abs(local.x) > half || Math.abs(local.y) > half) return undefined;
    return local;
  }

  _updateDropPreview(windowPosition) {
    if (!parameters.dropEnabled) {
      if (this.previewEntity) this.previewEntity.show = false;
      return;
    }
    const local = this._pickLocal(windowPosition);
    if (!local) {
      if (this.previewEntity) this.previewEntity.show = false;
      return;
    }
    if (!this.previewEntity) {
      this.previewEntity = viewer.entities.add({
        position: new Cesium.CallbackProperty(() => this._previewPosition, false),
        ellipse: {
          semiMajorAxis: new Cesium.CallbackProperty(() => parameters.dropRadius, false),
          semiMinorAxis: new Cesium.CallbackProperty(() => parameters.dropRadius, false),
          material: Cesium.Color.WHITE.withAlpha(0.18),
          outline: true,
          outlineColor: Cesium.Color.WHITE,
          height: 2.0,
        },
      });
    }
    this._previewPosition = localToWorld(local.x, local.y, 2.0);
    this.previewEntity.show = true;
  }

  addDrop(x, y, volume, radius, incrementSpeed) {
    this.drops.push({
      x,
      y,
      radius,
      remainingDepth: volume / (Math.PI * radius * radius),
      incrementSpeed,
    });
    this.updateStatus();
  }

  _applyDrops(dt) {
    const half = domain.size * 0.5;
    for (let dropIndex = this.drops.length - 1; dropIndex >= 0; dropIndex--) {
      const drop = this.drops[dropIndex];
      const increment = Math.min(drop.remainingDepth, drop.incrementSpeed * dt);
      const radiusSquared = drop.radius * drop.radius;
      let weightSum = 0.0;
      const weights = [];
      for (let y = 0; y < this.size; y++) {
        const localY = -half + (y + 0.5) * this.cellSize;
        for (let x = 0; x < this.size; x++) {
          const localX = -half + (x + 0.5) * this.cellSize;
          const dx = localX - drop.x;
          const dy = localY - drop.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > radiusSquared) continue;
          const index = this.index(x, y);
          if (this.solid[index]) continue;
          const weight = Math.exp((-3.0 * d2) / radiusSquared);
          weights.push([index, weight]);
          weightSum += weight;
        }
      }
      if (weightSum > 0.0) {
        for (const [index, weight] of weights) {
          this.depth[index] += increment * (weight / weightSum) * weights.length;
        }
      }
      drop.remainingDepth -= increment;
      if (drop.remainingDepth <= 0.0001) this.drops.splice(dropIndex, 1);
    }
  }

  step(dt) {
    this._applyDrops(dt);
    const gravity = 9.81;
    const dx = this.cellSize;
    const damping = 0.995;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const index = this.index(x, y);
        if (this.solid[index]) {
          this.nextDepth[index] = 0.0;
          this.nextVelocityX[index] = 0.0;
          this.nextVelocityY[index] = 0.0;
          continue;
        }
        const left = this.index(Math.max(0, x - 1), y);
        const right = this.index(Math.min(this.size - 1, x + 1), y);
        const bottom = this.index(x, Math.max(0, y - 1));
        const top = this.index(x, Math.min(this.size - 1, y + 1));
        const depth = this.depth[index];
        const dhdx = (this.depth[right] - this.depth[left]) / (2.0 * dx);
        const dhdy = (this.depth[top] - this.depth[bottom]) / (2.0 * dx);
        const velocityX = (this.velocityX[index] - gravity * dt * dhdx) * damping;
        const velocityY = (this.velocityY[index] - gravity * dt * dhdy) * damping;
        const fluxX =
          (this.depth[right] * this.velocityX[right] -
            this.depth[left] * this.velocityX[left]) /
          (2.0 * dx);
        const fluxY =
          (this.depth[top] * this.velocityY[top] -
            this.depth[bottom] * this.velocityY[bottom]) /
          (2.0 * dx);
        this.nextDepth[index] = Math.max(0.0, depth - dt * (fluxX + fluxY));
        this.nextVelocityX[index] = velocityX;
        this.nextVelocityY[index] = velocityY;
      }
    }
    [this.depth, this.nextDepth] = [this.nextDepth, this.depth];
    [this.velocityX, this.nextVelocityX] = [this.nextVelocityX, this.velocityX];
    [this.velocityY, this.nextVelocityY] = [this.nextVelocityY, this.velocityY];
    this.totalTime += dt;
  }

  _sampleDepthAtVertex(x, y) {
    let value = 0.0;
    let count = 0;
    for (let oy = -1; oy <= 0; oy++) {
      for (let ox = -1; ox <= 0; ox++) {
        const sx = x + ox;
        const sy = y + oy;
        if (sx < 0 || sy < 0 || sx >= this.size || sy >= this.size) continue;
        value += this.depth[this.index(sx, sy)];
        count++;
      }
    }
    return count ? value / count : 0.0;
  }

  _terrainHeightAtVertex(x, y) {
    if (!terrainHeights) return 0.0;
    const sampleX = (x / this.size) * (terrainSampleSize - 1);
    const sampleY = (y / this.size) * (terrainSampleSize - 1);
    const x0 = Math.floor(sampleX);
    const y0 = Math.floor(sampleY);
    const x1 = Math.min(terrainSampleSize - 1, x0 + 1);
    const y1 = Math.min(terrainSampleSize - 1, y0 + 1);
    const tx = sampleX - x0;
    const ty = sampleY - y0;
    const a = terrainHeights[y0 * terrainSampleSize + x0];
    const b = terrainHeights[y0 * terrainSampleSize + x1];
    const c = terrainHeights[y1 * terrainSampleSize + x0];
    const d = terrainHeights[y1 * terrainSampleSize + x1];
    return Cesium.Math.lerp(Cesium.Math.lerp(a, b, tx), Cesium.Math.lerp(c, d, tx), ty);
  }

  _buildGeometry() {
    const vertexSize = this.size + 1;
    const vertexCount = vertexSize * vertexSize;
    const positions = new Float64Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const st = new Float32Array(vertexCount * 2);
    const indices = [];
    const half = domain.size * 0.5;
    const scale = parameters.verticalExaggeration;

    for (let y = 0; y < vertexSize; y++) {
      for (let x = 0; x < vertexSize; x++) {
        const vertexIndex = y * vertexSize + x;
        const depth = this._sampleDepthAtVertex(x, y);
        const left = this._sampleDepthAtVertex(Math.max(0, x - 1), y);
        const right = this._sampleDepthAtVertex(Math.min(this.size, x + 1), y);
        const bottom = this._sampleDepthAtVertex(x, Math.max(0, y - 1));
        const top = this._sampleDepthAtVertex(x, Math.min(this.size, y + 1));
        const normalLocal = new Cesium.Cartesian3(
          -((right - left) * scale) / (2.0 * this.cellSize),
          -((top - bottom) * scale) / (2.0 * this.cellSize),
          1.0,
        );
        Cesium.Cartesian3.normalize(normalLocal, normalLocal);
        Cesium.Matrix3.multiplyByVector(enuRotation, normalLocal, this._scratchNormal);
        Cesium.Cartesian3.normalize(this._scratchNormal, this._scratchNormal);
        localToWorld(
          -half + x * this.cellSize,
          -half + y * this.cellSize,
          this._terrainHeightAtVertex(x, y) + domain.surfaceOffset + depth * scale,
          this._scratchWorld,
        );
        positions[vertexIndex * 3] = this._scratchWorld.x;
        positions[vertexIndex * 3 + 1] = this._scratchWorld.y;
        positions[vertexIndex * 3 + 2] = this._scratchWorld.z;
        normals[vertexIndex * 3] = this._scratchNormal.x;
        normals[vertexIndex * 3 + 1] = this._scratchNormal.y;
        normals[vertexIndex * 3 + 2] = this._scratchNormal.z;
        st[vertexIndex * 2] = x / this.size;
        st[vertexIndex * 2 + 1] = y / this.size;
      }
    }

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const cell = this.index(x, y);
        const wet =
          this.depth[cell] > 0.005 ||
          (x < this.size - 1 && this.depth[this.index(x + 1, y)] > 0.005) ||
          (y < this.size - 1 && this.depth[this.index(x, y + 1)] > 0.005);
        if (!wet || this.solid[cell]) continue;
        const lowerLeft = y * vertexSize + x;
        const lowerRight = lowerLeft + 1;
        const upperLeft = lowerLeft + vertexSize;
        const upperRight = upperLeft + 1;
        indices.push(lowerLeft, lowerRight, upperLeft, lowerRight, upperRight, upperLeft);
      }
    }

    return new Cesium.Geometry({
      attributes: {
        position: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: positions,
        }),
        normal: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 3,
          values: normals,
        }),
        st: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 2,
          values: st,
        }),
      },
      indices: new Uint16Array(indices),
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
      boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
    });
  }

  _statistics() {
    let maxDepth = 0.0;
    let speedSum = 0.0;
    let wetCells = 0;
    for (let index = 0; index < this.count; index++) {
      const depth = this.depth[index];
      if (depth <= 0.005) continue;
      wetCells++;
      maxDepth = Math.max(maxDepth, depth);
      speedSum += Math.hypot(this.velocityX[index], this.velocityY[index]);
    }
    return {
      maxDepth,
      averageSpeed: wetCells ? speedSum / wetCells : 0.0,
      wetCells,
    };
  }

  _buildAppearance(statistics) {
    return new Cesium.MaterialAppearance({
      material: new Cesium.Material({
        fabric: {
          type: "OpenSourceShallowWater",
          uniforms: {
            u_time: this.totalTime,
            shadingMode: shadingModes[parameters.shadingType],
            maxDepth: statistics.maxDepth,
            averageSpeed: statistics.averageSpeed,
          },
          source: fluidMaterialSource,
        },
      }),
      translucent: true,
      closed: false,
    });
  }

  _renderFlowArrows() {
    if (this.flowArrows) {
      scene.primitives.remove(this.flowArrows);
      this.flowArrows = undefined;
    }
    if (!parameters.showFlowArrows && parameters.shadingType !== "流体流向") return;
    const arrows = new Cesium.PolylineCollection();
    const half = domain.size * 0.5;
    for (let y = 3; y < this.size - 3; y += 5) {
      for (let x = 3; x < this.size - 3; x += 5) {
        const index = this.index(x, y);
        if (this.depth[index] < 0.04 || this.solid[index]) continue;
        const vx = this.velocityX[index];
        const vy = this.velocityY[index];
        const speed = Math.hypot(vx, vy);
        if (speed < 0.02) continue;
        const localX = -half + (x + 0.5) * this.cellSize;
        const localY = -half + (y + 0.5) * this.cellSize;
        const length = Math.min(220.0, 40.0 + speed * 55.0);
        arrows.add({
          positions: [
            localToWorld(
              localX,
              localY,
              this.depth[index] * parameters.verticalExaggeration + 1.0,
            ),
            localToWorld(
              localX + (vx / speed) * length,
              localY + (vy / speed) * length,
              this.depth[index] * parameters.verticalExaggeration + 1.0,
            ),
          ],
          width: 2.0,
          material: Cesium.Material.fromType("Color", {
            color: Cesium.Color.CYAN.withAlpha(0.9),
          }),
        });
      }
    }
    this.flowArrows = scene.primitives.add(arrows);
  }

  render(force = false) {
    // Primitive 初始化要经过一个渲染帧。以旧网格覆盖到新网格 ready 的方式
    // 更新，避免每帧重建时出现闪烁或短暂空白。
    if (!force && this.totalTime - this._lastRenderTime < 1.0) return;
    this._lastRenderTime = this.totalTime;
    const statistics = this._statistics();
    const previousPrimitive = this.primitive;
    const nextPrimitive = scene.primitives.add(
      new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: this._buildGeometry(),
        }),
        appearance: this._buildAppearance(statistics),
        asynchronous: false,
      }),
    );
    this.primitive = nextPrimitive;
    if (previousPrimitive) {
      this.retiredPrimitives.push(previousPrimitive);
      const removeWhenReady = scene.postRender.addEventListener(() => {
        if (!nextPrimitive.ready) return;
        scene.primitives.remove(previousPrimitive);
        this.retiredPrimitives = this.retiredPrimitives.filter(
          (primitive) => primitive !== previousPrimitive,
        );
        removeWhenReady();
        this.retireListeners = this.retireListeners.filter(
          (listener) => listener !== removeWhenReady,
        );
      });
      this.retireListeners.push(removeWhenReady);
    }
    this._renderFlowArrows();
  }

  update(time) {
    const seconds = Cesium.JulianDate.toDate(time).getTime() / 1000.0;
    if (!this._lastUpdateTime) this._lastUpdateTime = seconds;
    const elapsed = Math.min(0.1, Math.max(0.0, seconds - this._lastUpdateTime));
    this._lastUpdateTime = seconds;
    if (parameters.running) {
      let remaining = elapsed;
      while (remaining > 0.0) {
        const step = Math.min(parameters.timeStep, remaining);
        this.step(step);
        remaining -= step;
      }
      this.render();
    }
    if (this.totalTime - this._lastStatusTime > 0.35) {
      this._lastStatusTime = this.totalTime;
      this.updateStatus();
    }
  }

  updateStatus() {
    const statistics = this._statistics();
    showStatus(
      `<b>流体模拟（自研浅水方程）</b><br>` +
        `状态: ${parameters.running ? "运行中" : "已暂停"}　时间: ${this.totalTime.toFixed(1)}s<br>` +
        `最大水深: ${statistics.maxDepth.toFixed(2)}m　平均速度: ${statistics.averageSpeed.toFixed(2)}m/s<br>` +
        `湿润网格: ${statistics.wetCells}/${this.count}　待注入: ${this.drops.length}<br>` +
        `视图: ${parameters.shadingType}　网格: ${this.size}×${this.size}`,
    );
  }

  reset() {
    this.depth.fill(0.0);
    this.velocityX.fill(0.0);
    this.velocityY.fill(0.0);
    this.nextDepth.fill(0.0);
    this.nextVelocityX.fill(0.0);
    this.nextVelocityY.fill(0.0);
    this.drops.length = 0;
    this.totalTime = 0.0;
    this._seedReservoirAndDam();
    this.render(true);
  }

  destroy() {
    if (this.removePreRender) this.removePreRender();
    if (this.removeInput) this.removeInput();
    for (const removeListener of this.retireListeners) removeListener();
    if (this.primitive) scene.primitives.remove(this.primitive);
    for (const primitive of this.retiredPrimitives) scene.primitives.remove(primitive);
    if (this.flowArrows) scene.primitives.remove(this.flowArrows);
    for (const entity of [this.previewEntity, this.outlineEntity, this.damEntity]) {
      if (entity) viewer.entities.remove(entity);
    }
  }
}

let simulation;
let startGeneration = 0;

async function startSimulation() {
  const generation = ++startGeneration;
  if (simulation) simulation.destroy();
  showStatus("<b>流体模拟（自研浅水方程）</b><br>正在采样地形高程并初始化流体网格…");
  await alignDomainToTerrain();
  await captureTerrainHeights();
  if (generation !== startGeneration) return;
  simulation = new ShallowWaterSimulation();
  simulation.start();
  showStatus("<b>流体模拟（自研浅水方程）</b><br>点击水域可注入流体；大坝缺口处将形成绕流。");
}

function createParameterPanel() {
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:absolute;top:10px;right:10px;width:260px;padding:12px;" +
    "background:rgba(32,38,48,.92);color:#fff;border-radius:6px;z-index:20;" +
    "font:12px sans-serif;box-sizing:border-box;";
  panel.innerHTML = `
    <div style="font-size:14px;font-weight:600;margin-bottom:8px">流体参数调节</div>
    <label><input id="fluid-running" type="checkbox" checked> 运行模拟</label>
    <label>时间步长 <input id="fluid-time-step" type="range" min="0.005" max="0.05" step="0.005" value="0.035"></label>
    <label>注入体积 <input id="fluid-volume" type="range" min="10000" max="1000000" step="10000" value="1000000"></label>
    <label>注入半径 <input id="fluid-radius" type="range" min="50" max="600" step="10" value="150"></label>
    <label>注入速度 <input id="fluid-speed" type="range" min="0.1" max="5" step="0.1" value="1"></label>
    <label>竖向夸张 <input id="fluid-exaggeration" type="range" min="1" max="12" step="1" value="6"></label>
    <label>可视化 <select id="fluid-shading">
      <option>水体</option><option>简单水面</option><option>流体流向</option><option>流体法线</option>
      <option>流体深度</option><option>流体速度</option><option>风格化水体</option>
    </select></label>
    <label><input id="fluid-outline" type="checkbox" checked> 显示作用域外框</label>
    <label><input id="fluid-arrows" type="checkbox"> 显示流向箭头</label>`;
  panel.querySelectorAll("label").forEach((label) => {
    label.style.display = "block";
    label.style.margin = "8px 0";
  });
  panel.querySelector("select").style.width = "100%";
  document.getElementById("cesiumContainer").appendChild(panel);

  panel.querySelector("#fluid-running").addEventListener("change", (event) => {
    parameters.running = event.target.checked;
    simulation?.updateStatus();
  });
  panel.querySelector("#fluid-time-step").addEventListener("input", (event) => {
    parameters.timeStep = Number(event.target.value);
  });
  panel.querySelector("#fluid-volume").addEventListener("input", (event) => {
    parameters.dropVolume = Number(event.target.value);
  });
  panel.querySelector("#fluid-radius").addEventListener("input", (event) => {
    parameters.dropRadius = Number(event.target.value);
  });
  panel.querySelector("#fluid-speed").addEventListener("input", (event) => {
    parameters.dropIncrementSpeed = Number(event.target.value);
  });
  panel.querySelector("#fluid-exaggeration").addEventListener("input", (event) => {
    parameters.verticalExaggeration = Number(event.target.value);
    simulation?.render(true);
  });
  panel.querySelector("#fluid-shading").addEventListener("change", (event) => {
    parameters.shadingType = event.target.value;
    simulation?.render(true);
  });
  panel.querySelector("#fluid-outline").addEventListener("change", (event) => {
    parameters.showDomainBoxOutline = event.target.checked;
    if (simulation?.outlineEntity) {
      simulation.outlineEntity.box.show = parameters.showDomainBoxOutline;
    }
  });
  panel.querySelector("#fluid-arrows").addEventListener("change", (event) => {
    parameters.showFlowArrows = event.target.checked;
    simulation?._renderFlowArrows();
  });
  return panel;
}

const parameterPanel = createParameterPanel();

Sandcastle.addDefaultToolbarButton("启动模拟", startSimulation);
Sandcastle.addToolbarButton("中心注水", () => {
  simulation?.addDrop(
    0.0,
    0.0,
    parameters.dropVolume,
    parameters.dropRadius,
    parameters.dropIncrementSpeed,
  );
});
Sandcastle.addToolbarButton("暂停/继续", () => {
  parameters.running = !parameters.running;
  const control = document.getElementById("fluid-running");
  if (control) control.checked = parameters.running;
  simulation?.updateStatus();
});
Sandcastle.addToolbarButton("切换视图", () => {
  const modes = Object.keys(shadingModes);
  const current = modes.indexOf(parameters.shadingType);
  parameters.shadingType = modes[(current + 1) % modes.length];
  document.getElementById("fluid-shading").value = parameters.shadingType;
  simulation?.render(true);
});
Sandcastle.addToolbarButton("重置", () => simulation?.reset());

Sandcastle.reset = function () {
  // Sandcastle 会在每次工具栏按钮回调前执行 reset。流体状态必须跨越
  // “中心注水 / 暂停 / 切换视图”等动作持续存在，因此不能在这里销毁。
  // 页面切换时 iframe 会卸载，Cesium 资源随文档回收。
  scene.globe.enableLighting = true;
  // 初次加载也会调用 reset；不要删除控制面板，否则默认动作后页面会变成占位状态。
  if (!parameterPanel.parentNode) {
    document.getElementById("cesiumContainer").appendChild(parameterPanel);
  }
};
