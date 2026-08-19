# CesiumJS 3D Tiles 渲染原理调试指南

> 基于 Sandcastle 示例 `3d-tiles-feature-styling` 的完整源码级调试路径

---

## 1. 环境准备

开发服务器已启动：

```
http://localhost:8080/
```

打开示例页面：

```
http://localhost:8080/Apps/Sandcastle2/index.html?id=3d-tiles-feature-styling
```

### 浏览器配置建议

- 使用 Chrome / Edge，打开 DevTools (F12)
- 在 **Settings > Preferences** 中取消勾选 `Enable JavaScript source maps`（避免跳到编译后的代码）
- 确保 DevTools 的 **Sources** 面板能看到 `packages/engine/Source/Scene/` 下的原始 ES Module 源文件

---

## 2. 示例代码分析

示例入口文件：`packages/sandcastle/gallery/3d-tiles-feature-styling/main.js`

```javascript
// 核心调用链
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(),
});

// 1️⃣ 创建 Tileset（加载 tileset.json + 构建 Tile 树）
const osmBuildingsTileset = await Cesium.createOsmBuildingsAsync();

// 2️⃣ 添加到场景 primitive 集合（触发每帧 update）
viewer.scene.primitives.add(osmBuildingsTileset);

// 3️⃣ 应用样式
osmBuildingsTileset.style = new Cesium.Cesium3DTileStyle({ ... });
```

这三步分别对应：**Tileset 初始化 → 每帧遍历调度 → 样式引擎**。

---

## 3. 关键源码文件索引

| 职责 | 文件路径 |
|------|---------|
| Tileset 主类（初始化/update/缓存） | `packages/engine/Source/Scene/Cesium3DTileset.js` |
| 单个 Tile 节点（请求/解析/状态机） | `packages/engine/Source/Scene/Cesium3DTile.js` |
| 遍历基类（公共 loadTile/canTraverse） | `packages/engine/Source/Scene/Cesium3DTilesetTraversal.js` |
| 基础遍历策略（Replacement） | `packages/engine/Source/Scene/Cesium3DTilesetBaseTraversal.js` |
| 跳层遍历策略（Skip LOD） | `packages/engine/Source/Scene/Cesium3DTilesetSkipTraversal.js` |
| 内容工厂（根据 magic 分发解析器） | `packages/engine/Source/Scene/Cesium3DTileContentFactory.js` |
| OSM Buildings 快捷创建函数 | `packages/engine/Source/Scene/createOsmBuildingsAsync.js` |
| 3DTileStyle 样式引擎 | `packages/engine/Source/Scene/Cesium3DTileStyleEngine.js` |

---

## 4. 核心渲染管线与断点位置

### 4.1 第一阶段：Tileset 初始化（加载 tileset.json）

**调用链：**

```
createOsmBuildingsAsync()
  → Cesium3DTileset.fromIonAssetId(96188)          // 行 2170
    → IonResource.fromAssetId(assetId)              // 获取 Ion 资源 URL
    → Cesium3DTileset.fromUrl(resource, options)    // 行 2227
      → Cesium3DTileset.loadJson(resource)          // HTTP 请求 tileset.json
      → new Cesium3DTileset(options)                // 行 2248，构造内部状态
      → 解析 JSON, 创建 root Cesium3DTile          // 构建 Tile 树
```

**断点位置 1：** 在 `Cesium3DTileset.fromUrl` 函数（行 2227）打断点，观察：
- `resource.url` — tileset.json 的完整 URL
- `tilesetJson` — 解析后的 tileset.json 结构（含 `root`、`geometricError`、`asset` 等）

```
文件: packages/engine/Source/Scene/Cesium3DTileset.js
行号: 2227 (Cesium3DTileset.fromUrl = async function)
行号: 2242 (const tilesetJson = await Cesium3DTileset.loadJson(resource))
行号: 2248 (const tileset = new Cesium3DTileset(options))
```

### 4.2 第二阶段：每帧更新（Scene 渲染循环驱动）

每一帧，Scene 会调用所有 primitive 的 `update()`，对 Cesium3DTileset 来说：

```
Scene.render()
  → Scene.updateAndExecuteCommands()
    → PrimitiveCollection.update(frameState)
      → Cesium3DTileset.prototype.update(frameState)         // 行 3523
        → Cesium3DTileset.prototype.updateForPass()          // 行 3532
          → update(tileset, frameState, ...)                 // 行 3418，核心逻辑
            → tileset.getTraversal(passOptions).selectTiles() // 遍历 Tile 树
            → requestTiles(tileset)                           // 对选中的 tile 发起网络请求
            → updateTiles(tileset, frameState, passOptions)   // 生成渲染指令
```

**断点位置 2：** 在内部 `update()` 函数打断点（行 3418），这是**每帧**执行的核心入口。

```
文件: packages/engine/Source/Scene/Cesium3DTileset.js
行号: 3418 (function update(tileset, frameState, passStatistics, passOptions))
行号: 3440-3442 (tileset.getTraversal(passOptions).selectTiles(...)) — 遍历选择
行号: 3444-3446 (requestTiles(tileset)) — 发起请求
行号: 3448 (updateTiles(tileset, frameState, passOptions)) — 生成渲染命令
```

> **提示：** 由于 `update` 每帧调用，建议使用**条件断点**，例如 `tileset._requestedTiles.length > 0` 只在有新请求时中断。

### 4.3 第三阶段：Tile 树遍历（深度优先选择可见 Tile）

`Cesium3DTilesetBaseTraversal.selectTiles()` 是默认遍历策略的入口：

```
selectTiles(tileset, frameState)                  // 行 35
  → executeTraversal(root, frameState)            // 行 189, 深度优先遍历
    → while (stack.length > 0)                    // 行 197
      → tile = stack.pop()
      → canTraverse(tile)                         // SSE 判断是否继续细化
      → updateAndPushChildren(tile, stack, ...)   // 将子节点入栈
      → loadTile(tile, frameState)                // 标记需要加载
      → selectDesiredTile(tile, frameState)       // 标记需要渲染
      → visitTile(tile, frameState)               // 统计
      → touchTile(tile, frameState)               // 更新 LRU 缓存
```

**断点位置 3：** `Cesium3DTilesetBaseTraversal.js` 中 `executeTraversal`（行 189）

关键判断逻辑在 `Cesium3DTilesetTraversal.js`：

```javascript
// canTraverse — 是否继续向下遍历（SSE 驱动的 LOD 核心）
// 行 58-68
canTraverse(tile) {
  if (tile.children.length === 0) return false;
  if (tile.hasTilesetContent || tile.hasImplicitContent) return !tile.contentExpired;
  return tile._screenSpaceError > tile.tileset.memoryAdjustedScreenSpaceError;
  //     ↑ SSE > 阈值(默认16) → 需要更细的层级
}
```

**断点位置 4：** `Cesium3DTilesetTraversal.js` 行 58，观察 `tile._screenSpaceError` 值来理解 LOD 决策。

### 4.4 第四阶段：Tile 内容请求（网络 I/O）

```
requestTiles(tileset)                                     // Cesium3DTileset.js 行 2776
  → tiles 按优先级排序
  → requestContent(tileset, tile)                         // 行 2631
    → tile.requestContent()                               // Cesium3DTile.js 行 1126
      → requestSingleContent(tile)                        // 行 1300
        → resource.fetchArrayBuffer()                     // 发起 HTTP GET
        → processArrayBuffer(tile, tileset, ...)          // 行 1207
          → 修改 tile._contentState = LOADING
          → await arrayBuffer
          → preprocess3DTileContent(arrayBuffer)           // 解析 magic bytes
          → Cesium3DTileContentFactory[type](...)          // 根据类型创建 Content
```

**断点位置 5：** `Cesium3DTile.js` 行 1300（`requestSingleContent`），在 Network 面板中同步观察 `.glb` / `.b3dm` 请求。

**断点位置 6：** `Cesium3DTileContentFactory.js` 行 16-134，观察内容被分发到哪个解析器：

| Magic / 类型 | 解析器 | 说明 |
|-------------|--------|------|
| `b3dm` | `Model3DTileContent.fromB3dm` | Batched 3D Model |
| `i3dm` | `Model3DTileContent.fromI3dm` | Instanced 3D Model |
| `pnts` | `Model3DTileContent.fromPnts` | 点云 |
| `cmpt` | `Composite3DTileContent` | 组合内容 |
| `glb` | `Model3DTileContent.fromGltf` | glTF Binary |
| `gltf` | `Model3DTileContent.fromGltf` | glTF JSON |
| `subt` | `Implicit3DTileContent` | 隐式切片子树 |

### 4.5 第五阶段：Tile 内容处理（GPU 资源创建）

Tile 下载完成后进入处理队列：

```
processTiles(tileset, frameState)              // Cesium3DTileset.js 行 2898
  → tile.process(tileset, frameState)          // Cesium3DTile.js 行 2330
    → tile._content.ready 变为 true
    → tile._contentState = READY
    → tileset._cache.add(tile)                 // 加入 LRU 缓存
```

**断点位置 7：** `Cesium3DTile.js` 行 2330（`process`），观察 tile 从 `LOADING → PROCESSING → READY` 的状态转换。

### 4.6 第六阶段：渲染命令生成

```
updateTiles(tileset, frameState, passOptions)      // Cesium3DTileset.js 行 3119
  → tileset._styleEngine.applyStyle(tileset)       // 先应用样式
  → for (selectedTiles) {
      tile.update(tileset, frameState)             // 每个 tile 生成 DrawCommand
      → tile.content.update(tileset, frameState)   // 内部 Model 更新
    }
  → 所有 DrawCommand 被加入 frameState.commandList
```

**断点位置 8：** `Cesium3DTileset.js` 行 3119（`updateTiles`），观察 `selectedTiles.length` 和最终生成的 command 数量。

---

## 5. 推荐调试流程（Step by Step）

### Step 1: 观察 Tileset 加载

1. 打开 DevTools → Sources 面板
2. `Ctrl+P` 搜索 `createOsmBuildingsAsync.js`
3. 在第 61 行打断点：`const tileset = await Cesium3DTileset.fromIonAssetId(96188, options);`
4. 刷新页面，命中断点后 Step Into 进入 `fromIonAssetId` → `fromUrl`
5. 观察 `tilesetJson` 对象结构

### Step 2: 观察 Network 请求

1. 打开 DevTools → Network 面板
2. 筛选 `XHR` 或搜索 `tileset.json`
3. 观察首先请求的 `tileset.json`（Ion API 会先返回一个重定向或 endpoint）
4. 随后观察 `.glb` 文件请求，这些就是各个 Tile 的实际几何数据

### Step 3: 观察遍历决策

1. `Ctrl+P` 搜索 `Cesium3DTilesetBaseTraversal.js`
2. 在 `executeTraversal` 函数（行 189）的 `while` 循环体内打断点（行 203）
3. 在断点处 Watch 以下表达式：
   - `tile._depth` — 当前 tile 在树中的深度
   - `tile._screenSpaceError` — 当前 SSE 值
   - `tile.tileset.memoryAdjustedScreenSpaceError` — SSE 阈值
   - `tile._contentState` — 内容加载状态
   - `tile.children.length` — 子节点数量
4. 观察 `canTraverse(tile)` 返回 `true/false` 来理解 LOD 切换逻辑

### Step 4: 观察内容解析

1. `Ctrl+P` 搜索 `Cesium3DTileContentFactory.js`
2. 在第 89 行（`glb` 分支）打断点
3. 当命中时，观察 `arrayBuffer` 的大小和 `tile._contentResource.url`
4. Step Into 进入 `Model3DTileContent.fromGltf` 观察 glTF 解析过程

### Step 5: 观察样式应用

1. `Ctrl+P` 搜索 `Cesium3DTileStyleEngine.js`
2. 在 `applyStyle` 方法打断点
3. 观察示例中切换下拉菜单时，`tileset.style` 的变化如何触发重新着色

---

## 6. 常用调试技巧

### 6.1 冻结帧（Freeze Frame）

在控制台执行：

```javascript
// 冻结当前帧的 tile 选择，不再更新
viewer.scene.primitives.get(0).debugFreezeFrame = true;
```

这会阻止遍历逻辑执行，方便你静态分析当前 tile 集合。

### 6.2 可视化 Bounding Volume

```javascript
const tileset = viewer.scene.primitives.get(0);
tileset.debugShowBoundingVolume = true;       // 显示每个 tile 的包围盒
tileset.debugShowContentBoundingVolume = true; // 显示内容包围盒
tileset.debugColorizeTiles = true;            // 随机着色每个 tile
tileset.debugShowGeometricError = true;       // 显示 geometric error 标签
tileset.debugShowRenderingStatistics = true;  // 显示三角面/点数统计
tileset.debugShowMemoryUsage = true;          // 显示内存使用量
tileset.debugShowUrl = true;                  // 显示 tile URL
```

### 6.3 监控统计信息

```javascript
const tileset = viewer.scene.primitives.get(0);
viewer.scene.postRender.addEventListener(() => {
  const stats = tileset._statistics;
  console.log(`visited: ${stats.visited}, selected: ${stats.selected}, requested: ${stats.numberOfPendingRequests}, processing: ${stats.numberOfTilesProcessing}, ready: ${stats.numberOfTilesWithContentReady}`);
});
```

### 6.4 Tile 状态枚举

Tile 内容的加载状态机 (`Cesium3DTileContentState`)：

```
UNLOADED → LOADING → PROCESSING → READY
                  ↘ FAILED
                  ↘ EXPIRED → LOADING (重新加载)
```

### 6.5 使用 XHR Breakpoint 追踪网络请求

在 DevTools → Sources → XHR/fetch Breakpoints 中添加：
- URL 包含 `.glb` — 捕获所有 glTF 请求
- URL 包含 `tileset.json` — 捕获 tileset 元数据请求

---

## 7. 核心架构概览图

```
┌──────────────────────────────────────────────────────────────┐
│                        Scene.render()                        │
│                             │                                │
│                    PrimitiveCollection.update()               │
│                             │                                │
│                 Cesium3DTileset.update(frameState)            │
│                             │                                │
│              ┌──────────────┼──────────────┐                 │
│              ▼              ▼              ▼                  │
│        selectTiles     requestTiles   updateTiles            │
│        (遍历 Tile 树)   (发起请求)    (生成渲染指令)            │
│              │              │              │                  │
│     BaseTraversal     Cesium3DTile     StyleEngine            │
│     SkipTraversal    .requestContent   .applyStyle           │
│              │              │              │                  │
│     canTraverse()    ContentFactory   DrawCommand             │
│     (SSE 比较)       (b3dm/glb/...)   → GPU 渲染              │
│              │              │                                │
│     updateTile()     processArrayBuffer                      │
│     (可见性检测)      (解码 → Model)                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. SSE (Screen Space Error) 核心公式

LOD 选择的核心判断依据：

```
screenSpaceError = (geometricError × screenHeight) / (distance × sseDenominator)
```

- `geometricError`: tileset.json 中每个 tile 定义的误差值（米）
- `distance`: tile 包围体到相机的距离
- `sseDenominator`: 由 FOV 计算得出 `2 × tan(fov/2)`
- 当 `screenSpaceError > maximumScreenSpaceError(默认16)` 时，继续向下遍历子节点

**相关源码位置：** `Cesium3DTile.js` 中搜索 `getScreenSpaceError`

---

## 9. 下一步探索方向

| 方向 | 起点文件 |
|------|---------|
| glTF 模型解析与 GPU 上传 | `packages/engine/Source/Scene/Model/Model3DTileContent.js` |
| Implicit Tiling（隐式切片） | `packages/engine/Source/Scene/Implicit3DTileContent.js` |
| 请求调度与优先级 | `packages/engine/Source/Core/RequestScheduler.js` |
| LRU 缓存策略 | `packages/engine/Source/Scene/Cesium3DTilesetCache.js` |
| 样式语言解析 | `packages/engine/Source/Scene/Cesium3DTileStyle.js` |
| 与 SuperMap S3M 对比 | 需单独分析 SuperMap iClient3D 的 S3MTilesLayer |
