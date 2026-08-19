# CesiumJS 3D Tiles 核心渲染管线技术说明

> 基于源码的深度分析：从 Scene.render() 到 Tile LOD 选择的完整链路

---

## 1. 全链路调用关系

从浏览器的 `requestAnimationFrame` 到最终某个 3DTile 被选中渲染，完整调用链如下：

```
CesiumWidget._render()
  → Scene.render()                                         // Scene.js:4560
    → render(scene)                                        // Scene.js:4465  ★ 帧渲染入口
      → scene.updateFrameState()                           // 构建 FrameState
      → scene.updateAndExecuteCommands(passState, bg)      // Scene.js:4529
        → executeCommandsInViewport(true, scene, passState) // Scene.js:3638
          → updateAndRenderPrimitives(scene)                // Scene.js:3871
            → scene._primitives.update(frameState)          // PrimitiveCollection.js:432
              → Cesium3DTileset.update(frameState)          // Cesium3DTileset.js:3523
                → updateForPass(frameState, passState)      // Cesium3DTileset.js:3532
                  → update(tileset, frameState, ...)        // Cesium3DTileset.js:3418 ★ 核心
                    → selectTiles()  → requestTiles()  → updateTiles()
          → view.createPotentiallyVisibleSet(scene)         // 视锥体裁剪 + 排序
        → executeCommands(scene, passState)                 // 提交 GPU DrawCommand
```

---

## 2. Scene.render() 做了什么

```
35:292:packages/engine/Source/Scene/Scene.js
function render(scene) {
  // ... scene setup ...
}
```

`render(scene)` 是**每帧真正执行渲染**的核心函数，它按顺序完成以下 7 件事：

| 步骤 | 代码 | 作用 |
|------|------|------|
| 1 | `scene.updateFrameState()` | 构建本帧的 `FrameState`，填入 camera、cullingVolume、frameNumber 等 |
| 2 | `frameState.passes.render = true` | 标记本帧为渲染 pass（区别于 pick/depth） |
| 3 | `uniformState.update(frameState)` | 更新 GPU uniform：视图矩阵、投影矩阵、太阳方向等 |
| 4 | `context.beginFrame()` | 开始 WebGL 帧 |
| 5 | `scene.updateAndExecuteCommands()` | **核心**：更新所有 primitive（含 3DTileset），生成 DrawCommand 并执行 |
| 6 | `scene.resolveFramebuffers()` | 后处理：FXAA、Bloom、HDR 色调映射等 |
| 7 | `context.endFrame()` | 结束 WebGL 帧 |

### updateAndExecuteCommands 到 Tileset 的桥梁

```
updateAndExecuteCommands()
  → executeCommandsInViewport()        // Scene.js:3638
    → updateAndRenderPrimitives()      // Scene.js:3871 ★ 关键桥梁
```

`updateAndRenderPrimitives` 的实现非常简洁：

```javascript
// Scene.js:3871
function updateAndRenderPrimitives(scene) {
  const frameState = scene._frameState;
  scene._groundPrimitives.update(frameState);
  scene._primitives.update(frameState);           // ← 这里触发 Tileset.update
}
```

`scene._primitives` 是一个 `PrimitiveCollection`，它的 `update` 方法遍历所有 primitive 并调用各自的 `update(frameState)`：

```javascript
// PrimitiveCollection.js:432
PrimitiveCollection.prototype.update = function (frameState) {
  const primitives = this._primitives;
  for (let i = 0; i < primitives.length; ++i) {
    primitives[i].update(frameState);  // → Cesium3DTileset.prototype.update
  }
};
```

当 `primitives[i]` 是一个 `Cesium3DTileset` 实例时，就进入了 3DTiles 的 update 链路。

---

## 3. FrameState：帧状态的全量数据

`FrameState` 是**每帧从 Scene 传递给所有 primitive 的上下文对象**，它承载了本帧渲染所需的全部环境信息。

源码位置：`packages/engine/Source/Scene/FrameState.js`

### 3DTiles LOD 决策直接依赖的字段

| 字段 | 类型 | 用途 |
|------|------|------|
| `frameNumber` | `number` | 当前帧编号。用于判重（同一帧不重复更新同一 tile） |
| `camera` | `Camera` | 当前相机。计算 tile 到相机距离、FOV、移动速度 |
| `camera.positionWC` | `Cartesian3` | 相机世界坐标位置 |
| `camera.frustum.sseDenominator` | `number` | `2 × tan(fov/2)`，SSE 计算的除数 |
| `camera.positionWCDeltaMagnitude` | `number` | 相机本帧移动量。用于 `cullRequestsWhileMoving` 优化 |
| `camera.timeSinceMoved` | `number` | 相机停止移动的时长。用于 `foveatedTimeDelay` 优化 |
| `cullingVolume` | `CullingVolume` | 视锥体。用于 tile 的可见性裁剪 |
| `context.drawingBufferWidth/Height` | `number` | 画布像素尺寸。SSE 公式的 `height` 参数 |
| `pixelRatio` | `number` | 设备像素比。最终 SSE 要除以它 |
| `mode` | `SceneMode` | 场景模式（3D/2D/Columbus/Morphing） |
| `commandList` | `DrawCommand[]` | 本帧的渲染命令列表。tile 的 `update()` 往里 push DrawCommand |
| `passes.render` | `boolean` | 是否是渲染 pass |
| `tilesetPassState` | `Cesium3DTilePassState` | 3DTiles 专用 pass 状态 |

### 非直接但重要的字段

| 字段 | 用途 |
|------|------|
| `fog.enabled/density/sse` | 雾效参数，影响远处 tile 的 SSE 修正 |
| `shadowMaps` | 阴影图。影响阴影 pass 的 tile 选择 |
| `maximumScreenSpaceError` | Scene 级别的全局 SSE 阈值（默认 2，但 3DTileset 自己有一个默认 16 的） |
| `afterRender` | 帧结束后的回调队列 |

---

## 4. Cesium3DTileset.update 核心逻辑详解

入口：`Cesium3DTileset.js` 行 3523

```javascript
Cesium3DTileset.prototype.update = function (frameState) {
  this.updateForPass(frameState, frameState.tilesetPassState);
};
```

经过 `updateForPass` 的 pass 判断和环境准备后，最终调用**真正的核心函数**：

### 4.1 `update()` 函数（行 3418）— 三段式处理

```javascript
function update(tileset, frameState, passStatistics, passOptions) {
  // ❶ 前置检查
  if (frameState.mode === SceneMode.MORPHING) return false;
  if (!defined(tileset._root)) return false;

  // ❷ 重置帧状态
  statistics.clear();
  ++tileset._updatedVisibilityFrame;       // 可见性帧计数器，防止同帧重复计算
  resetMinimumMaximum(tileset);            // 重置优先级的 min/max 追踪值
  detectModelMatrixChanged(tileset, frameState); // 检测 tileset 是否被移动过

  // ❸ 三段核心管线
  // —— 阶段 A: 遍历 Tile 树，决定哪些 tile 可见、哪些需要加载
  const ready = tileset
    .getTraversal(passOptions)             // 选择遍历策略
    .selectTiles(tileset, frameState);

  // —— 阶段 B: 对遍历标记的 tile 发起网络请求
  if (passOptions.requestTiles) {
    requestTiles(tileset);
  }

  // —— 阶段 C: 对选中的 tile 生成 DrawCommand
  updateTiles(tileset, frameState, passOptions);

  return ready;
}
```

---

### 4.2 `tileset._root` — Tile 树的根节点

`_root` 是一个 `Cesium3DTile` 实例，在 `Cesium3DTileset.fromUrl()` 中根据 `tileset.json` 的 `root` 字段创建。

#### Cesium3DTile 的核心属性

| 属性 | 类型 | 含义 |
|------|------|------|
| `geometricError` | `number` | 该 tile 的几何误差（米），来自 tileset.json |
| `children` | `Cesium3DTile[]` | 子 tile 数组 |
| `parent` | `Cesium3DTile` | 父 tile |
| `_depth` | `number` | 在 tile 树中的深度 |
| `refine` | `Cesium3DTileRefine` | 细化策略：`ADD`（叠加） 或 `REPLACE`（替换） |
| `_boundingVolume` | `TileBoundingVolume` | 包围体（box/region/sphere） |
| `_contentState` | `Cesium3DTileContentState` | 内容加载状态机 |
| `_content` | `Cesium3DTileContent` | 实际内容（b3dm/glb/pnts 等解析后的 Model） |
| `_screenSpaceError` | `number` | **本帧计算的 SSE**，LOD 判断的核心值 |
| `_distanceToCamera` | `number` | 本帧到相机的距离 |
| `_visible` | `boolean` | 本帧是否在视锥内 |
| `_refines` | `boolean` | 本帧遍历中是否成功细化到了子节点 |
| `_selectedFrame` | `number` | 上一次被选中时的帧号 |
| `contentAvailable` | `boolean` | 内容是否已加载可用 |
| `hasRenderableContent` | `boolean` | 是否有可渲染的内容（非空、非 tileset） |
| `hasUnloadedRenderableContent` | `boolean` | 是否有未加载的可渲染内容 |

#### Tile 内容状态机

```
UNLOADED → LOADING → PROCESSING → READY
                  ↘ FAILED
READY → EXPIRED → LOADING → ...  (过期重新加载)
```

---

### 4.3 阶段 A：selectTiles — 遍历 Tile 树

#### 遍历策略选择

```javascript
// Cesium3DTileset.js:3506
Cesium3DTileset.prototype.getTraversal = function (passOptions) {
  const { pass } = passOptions;
  if (pass === MOST_DETAILED_PRELOAD || pass === MOST_DETAILED_PICK) {
    return Cesium3DTilesetMostDetailedTraversal;
  }
  return this.isSkippingLevelOfDetail
    ? Cesium3DTilesetSkipTraversal       // 跳层策略（skipLevelOfDetail=true）
    : Cesium3DTilesetBaseTraversal;      // 默认策略（逐层替换）
};
```

默认使用 `Cesium3DTilesetBaseTraversal`，这是**传统的逐层替换遍历**。

#### BaseTraversal.selectTiles 入口

```javascript
// Cesium3DTilesetBaseTraversal.js:35
Cesium3DTilesetBaseTraversal.selectTiles = function (tileset, frameState) {
  // 清空上一帧的结果
  tileset._requestedTiles.length = 0;
  tileset._selectedTiles.length = 0;
  tileset._selectedTilesToStyle.length = 0;
  tileset._emptyTiles.length = 0;

  const root = tileset.root;
  Cesium3DTilesetTraversal.updateTile(root, frameState);  // 更新 root 的可见性 + SSE

  if (!root.isVisible) return;                            // root 不可见则全部跳过

  // root 的 SSE 已经满足精度要求，直接用 root 即可
  if (root.getScreenSpaceError(frameState, true) <= tileset.memoryAdjustedScreenSpaceError) {
    return;
  }

  executeTraversal(root, frameState);                     // ★ 深度优先遍历

  // 遍历结束后，更新所有待请求 tile 的优先级
  for (let i = 0; i < tileset._requestedTiles.length; ++i) {
    tileset._requestedTiles[i].updatePriority();
  }
};
```

#### executeTraversal — 深度优先遍历（LOD 核心）

```javascript
// Cesium3DTilesetBaseTraversal.js:189
function executeTraversal(root, frameState) {
  const stack = traversal.stack;
  stack.push(root);

  while (stack.length > 0) {
    const tile = stack.pop();

    const parent = tile.parent;
    const parentRefines = !defined(parent) || parent._refines;

    // ★ LOD 核心判断：canTraverse 决定是否继续向下遍历
    tile._refines = canTraverse(tile)
      ? updateAndPushChildren(tile, stack, frameState) && parentRefines
      : false;

    const stoppedRefining = !tile._refines && parentRefines;

    if (!tile.hasRenderableContent) {
      tileset._emptyTiles.push(tile);
      loadTile(tile, frameState);
      if (stoppedRefining) selectDesiredTile(tile, frameState);
    } else if (tile.refine === Cesium3DTileRefine.ADD) {
      // ADD 模式：始终选中 + 加载（所有层级叠加显示）
      selectDesiredTile(tile, frameState);
      loadTile(tile, frameState);
    } else if (tile.refine === Cesium3DTileRefine.REPLACE) {
      // REPLACE 模式：加载但只在停止细化时选中（子节点替换父节点）
      loadTile(tile, frameState);
      if (stoppedRefining) selectDesiredTile(tile, frameState);
    }

    visitTile(tile, frameState);  // 统计
    touchTile(tile, frameState);  // 更新 LRU 缓存
  }
}
```

#### canTraverse — SSE 驱动的 LOD 判断

这是 **LOD 选择最核心的一行代码**：

```javascript
// Cesium3DTilesetTraversal.js:58
Cesium3DTilesetTraversal.canTraverse = function (tile) {
  if (tile.children.length === 0) return false;        // 叶子节点，不可继续
  if (tile.hasTilesetContent || tile.hasImplicitContent) {
    return !tile.contentExpired;                        // 外部 tileset，只要没过期就继续
  }
  return tile._screenSpaceError > tile.tileset.memoryAdjustedScreenSpaceError;
  //     ↑ 当 SSE > 阈值 → 继续向下遍历子节点（当前精度不够）
  //     ↑ 当 SSE ≤ 阈值 → 停止遍历（当前精度已经足够）
};
```

#### SSE 计算公式

```javascript
// Cesium3DTile.js:911
Cesium3DTile.prototype.getScreenSpaceError = function (frameState, useParentGeometricError, ...) {
  const geometricError = useParentGeometricError ? parentGeometricError : this.geometricError;
  if (geometricError === 0.0) return 0.0;              // 叶子节点

  const distance = Math.max(this._distanceToCamera, CesiumMath.EPSILON7);
  const sseDenominator = frustum.sseDenominator;       // = 2 * tan(fov/2)
  const height = context.drawingBufferHeight;

  let error = (geometricError * height) / (distance * sseDenominator);

  if (tileset.dynamicScreenSpaceError) {
    // 远处 tile 额外减小 SSE（街景优化：远处用粗糙的即可）
    const dynamicError = CesiumMath.fog(distance, density) * factor;
    error -= dynamicError;
  }

  error /= frameState.pixelRatio;                      // HiDPI 修正
  return error;
};
```

**直观理解**：
- `geometricError` 大 → SSE 大 → 精度不够 → 需要加载更精细的子 tile
- `distance` 大 → SSE 小 → 远处不需要那么精细
- `height` 大（屏幕分辨率高）→ SSE 大 → 需要更精细

#### updateAndPushChildren — 子节点处理

```javascript
// Cesium3DTilesetBaseTraversal.js:94
function updateAndPushChildren(tile, stack, frameState) {
  const replace = tile.refine === Cesium3DTileRefine.REPLACE;
  const children = tile.children;

  // 更新每个子节点的可见性和 SSE
  for (let i = 0; i < children.length; ++i) {
    updateTile(children[i], frameState);
  }

  // 按距离排序（远的先入栈 → 近的先出栈处理）
  children.sort(sortChildrenByDistanceToCamera);

  // REPLACE 模式：只有所有子节点都已加载，才能替换父节点
  const checkRefines = replace && tile.hasRenderableContent;
  let refines = true;

  for (let i = 0; i < children.length; ++i) {
    const child = children[i];
    if (child.isVisible) {
      stack.push(child);                      // 可见子节点入栈继续遍历
    } else if (checkRefines || tileset.loadSiblings) {
      loadTile(child, frameState);            // 不可见但需要加载（替换策略需要所有子节点就绪）
      touchTile(child, frameState);
    }
    if (checkRefines) {
      refines = refines && child.contentAvailable;  // 所有子节点都 ready 才算 refines
    }
  }

  return refines;
}
```

#### Tile 可见性更新链

```javascript
// Cesium3DTilesetTraversal.js:190
Cesium3DTilesetTraversal.updateTile = function (tile, frameState) {
  updateTileVisibility(tile, frameState);   // 核心：计算可见性
  tile.updateExpiration();                  // 检查过期
  updateMinimumMaximumPriority(tile);       // 更新优先级追踪
};

// 内部调用：
// Cesium3DTile.js:1021
Cesium3DTile.prototype.updateVisibility = function (frameState) {
  this.updateTransform(parentTransform);
  this._distanceToCamera = this.distanceToTile(frameState);     // 计算到相机距离
  this._centerZDepth = this.distanceToTileCenter(frameState);
  this._screenSpaceError = this.getScreenSpaceError(frameState, false); // ★ 计算 SSE
  this._visibilityPlaneMask = this.visibility(frameState, parentMask); // 视锥裁剪
  this._visible = this._visibilityPlaneMask !== CullingVolume.MASK_OUTSIDE;
  this._inRequestVolume = this.insideViewerRequestVolume(frameState);
};
```

#### loadTile — 标记需要请求的 Tile

```javascript
// Cesium3DTilesetTraversal.js:131
Cesium3DTilesetTraversal.loadTile = function (tile, frameState) {
  // 防重复、已加载跳过
  if (tile._requestedFrame === frameState.frameNumber ||
      (!tile.hasUnloadedRenderableContent && !tile.contentExpired)) {
    return;
  }

  // 相机快速移动时跳过（避免请求马上就不需要的 tile）
  if (!isOnScreenLongEnough(tile, frameState)) return;

  // Foveated 延迟：边缘 tile 在相机停止后才加载
  if (tile.priorityDeferred && camera.timeSinceMoved < tileset.foveatedTimeDelay) return;

  tile._requestedFrame = frameState.frameNumber;
  tileset._requestedTiles.push(tile);  // 加入待请求队列
};
```

---

### 4.4 阶段 B：requestTiles — 网络请求调度

```javascript
// Cesium3DTileset.js:2776
function requestTiles(tileset) {
  const requestedTiles = tileset._requestedTiles;
  requestedTiles.sort(sortTilesByPriority);      // 按优先级排序
  for (let i = 0; i < requestedTiles.length; ++i) {
    requestContent(tileset, requestedTiles[i]);   // 对每个 tile 发起请求
  }
}
```

`requestContent` 调用 `tile.requestContent()` → `requestSingleContent()` → `resource.fetchArrayBuffer()`，HTTP 请求带有节流控制（`throttle: true, throttleByServer: true`）。

---

### 4.5 阶段 C：updateTiles — 生成渲染命令

```javascript
// Cesium3DTileset.js:3119
function updateTiles(tileset, frameState, passOptions) {
  tileset._styleEngine.applyStyle(tileset);           // 先应用 3DTileStyle

  const selectedTiles = tileset._selectedTiles;       // 阶段 A 选出的 tile
  for (let i = 0; i < selectedTiles.length; ++i) {
    const tile = selectedTiles[i];
    tileVisible.raiseEvent(tile);                     // 触发 tileVisible 事件
    tile.update(tileset, frameState, passOptions);    // ★ 每个 tile 生成 DrawCommand
    ++statistics.selected;
  }
}
```

单个 tile 的 `update`：

```javascript
// Cesium3DTile.js:2298
Cesium3DTile.prototype.update = function (tileset, frameState, passOptions) {
  updateClippingPlanes(this, tileset);
  updateClippingPolygons(this, tileset);
  applyDebugSettings(this, tileset, frameState, passOptions);
  updateContent(this, tileset, frameState);     // → content.update() → Model.update() → push DrawCommand
};
```

---

### 4.6 内存自适应 SSE 调节

```javascript
// Cesium3DTileset.js:2898
function processTiles(tileset, frameState) {
  const cacheByteLimit = cacheBytes + maximumCacheOverflowBytes;  // 默认 512MB + 512MB

  for (let i = 0; i < tiles.length; ++i) {
    if (tileset.totalMemoryUsageInBytes > cacheByteLimit) {
      memoryExceeded = true;
      break;                                   // 超出内存上限，停止处理
    }
    tile.process(tileset, frameState);          // PROCESSING → READY
  }

  if (totalMemory < cacheBytes) {
    decreaseScreenSpaceError(tileset);          // 内存充裕 → 降低 SSE（更精细）
    // _memoryAdjustedScreenSpaceError /= 1.02
  } else if (memoryExceeded) {
    increaseScreenSpaceError(tileset);          // 内存超出 → 提高 SSE（更粗糙）
    // _memoryAdjustedScreenSpaceError *= 1.02
  }
}
```

`memoryAdjustedScreenSpaceError` 默认等于 `maximumScreenSpaceError`(16)，但会根据内存压力动态调整。`canTraverse` 使用的正是这个动态调整后的值。

---

## 5. 核心数据结构关系图

```
┌─────────────── Scene ───────────────┐
│  _frameState (FrameState)           │
│    ├─ frameNumber                   │
│    ├─ camera (position, frustum)    │
│    ├─ cullingVolume                 │
│    ├─ commandList []  ←─── tile.update() push DrawCommand
│    └─ tilesetPassState              │
│                                     │
│  _primitives (PrimitiveCollection)  │
│    └─ [0] Cesium3DTileset           │
│         ├─ _root (Cesium3DTile)  ★  │
│         │    ├─ geometricError      │
│         │    ├─ _boundingVolume     │
│         │    ├─ children[]          │
│         │    │   ├─ [0] Tile ──→ children[] ──→ ...
│         │    │   └─ [1] Tile        │
│         │    ├─ _screenSpaceError   │ ← 每帧计算
│         │    ├─ _distanceToCamera   │ ← 每帧计算
│         │    ├─ _visible            │ ← 每帧计算
│         │    └─ _content (Model)    │
│         │                           │
│         ├─ _selectedTiles []        │ ← selectTiles 的输出
│         ├─ _requestedTiles []       │ ← loadTile 的输出
│         ├─ _processingQueue []      │ ← 下载完等待解码
│         ├─ _cache (LRU Cache)       │
│         ├─ _styleEngine             │
│         └─ _memoryAdjustedSSE       │ ← 内存压力反馈
└─────────────────────────────────────┘
```

---

## 6. 遍历选择流程图

```
                    ┌────────────┐
                    │  root tile │
                    └─────┬──────┘
                          │
                   updateTile(root)
                   计算 SSE、可见性
                          │
                  root.isVisible?
                   ╱           ╲
                 No             Yes
               return     SSE > threshold?
                           ╱           ╲
                         No             Yes
                     root 足够         进入 executeTraversal
                     return               │
                                    ┌─────┴──────┐
                                    │ stack.push  │
                                    │   (root)    │
                                    └─────┬──────┘
                                          │
                               ┌──────────┴──────────┐
                               │  while stack > 0    │
                               │  tile = stack.pop() │
                               └──────────┬──────────┘
                                          │
                                  canTraverse(tile)?
                                   ╱           ╲
                                 No             Yes
                          tile._refines=false   updateAndPushChildren()
                                │               │
                        stoppedRefining?    对每个 child:
                         ╱         ╲       - updateTile
                       Yes          No     - 可见 → push stack
                    selectTile    (pass)   - 不可见但 REPLACE → load
                    (渲染此 tile)          - checkRefines
                                          - 返回 refines
                                          │
                                  tile._refines = refines && parentRefines
                                          │
                                   stoppedRefining?
                                    → selectTile (REPLACE)
                                   或 selectTile (ADD, 始终)
```

---

## 7. 断点调试指南

### 断点 1：Scene.render 帧入口

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Scene.js` |
| **行号** | 4465 (`function render(scene)`) |
| **理由** | 确认每帧的起点，观察 `frameState` 的初始构建过程。在此观察 `scene.updateFrameState()` 后 `frameState.camera`、`frameState.frameNumber`、`frameState.cullingVolume` 的值。 |
| **条件断点** | 无需条件，用后立即禁用 |

### 断点 2：updateAndRenderPrimitives — 桥梁位置

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Scene.js` |
| **行号** | 3879 (`scene._primitives.update(frameState)`) |
| **理由** | 确认从 Scene 到 PrimitiveCollection 到 Tileset 的调用链。在 Call Stack 面板中可以清晰看到 `render → updateAndExecuteCommands → executeCommandsInViewport → updateAndRenderPrimitives`。 |
| **条件断点** | 无需条件 |

### 断点 3：Tileset update 核心入口

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Cesium3DTileset.js` |
| **行号** | 3418 (`function update(tileset, frameState, passStatistics, passOptions)`) |
| **理由** | **最核心的断点**。这是 3DTiles 每帧处理的真正入口。在此可以观察 `tileset._root` 是否已构建、`frameState.frameNumber`、以及三阶段调用的顺序。 |
| **条件断点** | `tileset._root !== undefined && tileset._selectedTiles.length === 0`（仅在首次有 root 但还没选中任何 tile 时中断，适合观察初始化） |

### 断点 4：canTraverse — LOD 决策核心

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Cesium3DTilesetTraversal.js` |
| **行号** | 58 (`Cesium3DTilesetTraversal.canTraverse = function (tile)`) |
| **理由** | **LOD 选择的决定性判断点**。在此观察 `tile._screenSpaceError` 和 `tile.tileset.memoryAdjustedScreenSpaceError` 的对比。这决定了遍历是继续深入还是停止。 |
| **条件断点** | `tile._depth === 1`（只观察第二层 tile 的决策，避免被海量调用淹没） |
| **Watch 表达式** | `tile._screenSpaceError`, `tile.tileset.memoryAdjustedScreenSpaceError`, `tile._depth`, `tile.children.length`, `tile.geometricError` |

### 断点 5：getScreenSpaceError — SSE 计算

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Cesium3DTile.js` |
| **行号** | 949 (`error = (geometricError * height) / (distance * sseDenominator)`) |
| **理由** | 直接观察 SSE 的数值计算过程。可以验证你对公式的理解：`geometricError` 是 tile 的原始误差值，`distance` 是到相机的距离，`height` 是屏幕像素高度，`sseDenominator` 是 FOV 相关分母。 |
| **条件断点** | `this._depth <= 2`（只观察前两层） |
| **Watch 表达式** | `geometricError`, `distance`, `height`, `sseDenominator`, `error` |

### 断点 6：updateTileVisibility — 可见性判断

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Cesium3DTile.js` |
| **行号** | 1021 (`Cesium3DTile.prototype.updateVisibility`) |
| **理由** | 这是每个 tile 在遍历中被更新的第一步。在此观察 `_distanceToCamera`、`_screenSpaceError`、`_visible` 如何被计算出来。特别关注视锥裁剪的结果 `_visibilityPlaneMask`。 |
| **条件断点** | `this._depth === 0`（只看 root 的首次更新） |

### 断点 7：executeTraversal — 遍历循环体

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Cesium3DTilesetBaseTraversal.js` |
| **行号** | 203 (`const tile = stack.pop()`) |
| **理由** | 在遍历循环的每次迭代处中断，观察当前处理的 tile 以及 `_refines`、`stoppedRefining` 的值。能看到整个遍历的"决策链"。 |
| **条件断点** | `tile._depth <= 2`（限制深度避免过多中断） |
| **Watch 表达式** | `tile._depth`, `tile._refines`, `stoppedRefining`, `tile.refine`, `tile.hasRenderableContent`, `tile.contentAvailable`, `stack.length` |

### 断点 8：selectDesiredTile — 哪些 tile 被选中渲染

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Cesium3DTilesetBaseTraversal.js` |
| **行号** | 81 (`function selectDesiredTile(tile, frameState)`) |
| **理由** | 追踪最终被选中渲染的 tile。当命中此断点时，这个 tile 将被加入 `_selectedTiles` 并最终生成 DrawCommand。观察 `tile._depth` 和 `tile.contentAvailable` 来理解为什么选中了这一层。 |
| **条件断点** | 无 |

### 断点 9：loadTile — 哪些 tile 被请求加载

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Cesium3DTilesetTraversal.js` |
| **行号** | 131 (`Cesium3DTilesetTraversal.loadTile`) |
| **理由** | 追踪哪些 tile 被标记为需要下载。观察 `isOnScreenLongEnough` 和 `priorityDeferred` 的优化剔除逻辑。 |
| **条件断点** | `tile.hasUnloadedRenderableContent`（只在真正需要加载时中断） |

### 断点 10：内存自适应 SSE 调节

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Cesium3DTileset.js` |
| **行号** | 2943 (`tileset._memoryAdjustedScreenSpaceError *= 1.02`) |
| **理由** | 当内存超出限制时，SSE 阈值被动态提高（每次 ×1.02）。如果你发现 `memoryAdjustedScreenSpaceError` 远大于 `maximumScreenSpaceError`(16)，说明 tileset 遇到了内存压力，正在降低渲染精度。 |
| **条件断点** | 无需条件（触发频率不高） |

### 断点 11：updateTiles — 渲染命令生成

| 项 | 值 |
|---|---|
| **文件** | `packages/engine/Source/Scene/Cesium3DTileset.js` |
| **行号** | 3152 (`const tile = selectedTiles[i]`) |
| **理由** | 观察最终有多少 tile 被选中、每个 tile 生成了多少 DrawCommand。在此断点处对比 `commandList.length` 的前后变化。 |
| **条件断点** | `i === 0`（只看第一个 tile） |

---

## 8. 推荐的调试操作序列

### 第一轮：理解帧调用链（5 分钟）

1. 启用 **断点 1**（Scene.render）和 **断点 2**（updateAndRenderPrimitives）
2. 刷新页面，命中后在 **Call Stack** 中确认完整调用链
3. 验证后禁用这两个断点

### 第二轮：理解 LOD 遍历（15 分钟）

1. 启用 **断点 3**（update 入口），条件 `tileset._root !== undefined`
2. 命中后查看 `tileset._root` 的结构：`geometricError`、`children.length`、`_boundingVolume`
3. 禁用断点 3，启用 **断点 4**（canTraverse），条件 `tile._depth <= 2`
4. 逐步 Continue，观察不同深度 tile 的 SSE 值和遍历决策
5. 同时启用 **断点 8**（selectDesiredTile），观察最终被选中的 tile 在哪一层

### 第三轮：理解 SSE 计算（10 分钟）

1. 启用 **断点 5**（getScreenSpaceError），条件 `this._depth === 0`
2. 在 Watch 中添加 `geometricError`, `distance`, `height`, `sseDenominator`
3. 手动验算：`error = (geometricError × height) / (distance × sseDenominator)`
4. 缩放相机，观察 `distance` 变化如何影响 SSE

### 第四轮：理解渲染命令生成（5 分钟）

1. 启用 **断点 11**（updateTiles 循环）
2. 观察 `selectedTiles.length` — 当前帧选中了多少个 tile
3. 在 Console 中执行 `tileset._statistics` 查看完整统计

### 辅助手段：Console 实时监控

在 Console 中粘贴以下代码，实时观察每帧的 tile 统计：

```javascript
const tileset = viewer.scene.primitives.get(0);
viewer.scene.postRender.addEventListener(() => {
  const s = tileset._statistics;
  console.table({
    visited: s.visited,
    selected: s.selected,
    pending: s.numberOfPendingRequests,
    processing: s.numberOfTilesProcessing,
    ready: s.numberOfTilesWithContentReady,
    memoryMB: (tileset.totalMemoryUsageInBytes / 1048576).toFixed(1),
    adjustedSSE: tileset.memoryAdjustedScreenSpaceError.toFixed(2),
  });
});
```

以及可视化调试开关：

```javascript
const tileset = viewer.scene.primitives.get(0);
tileset.debugShowBoundingVolume = true;        // 显示包围盒
tileset.debugColorizeTiles = true;             // 随机着色
tileset.debugShowGeometricError = true;        // 显示 geometricError 标签
tileset.debugFreezeFrame = true;               // 冻结遍历（停止 LOD 更新）
```
