# 从 `Cesium3DTileset` 到 `Cesium3DTile`：树、文件和逐帧更新

> 基于当前仓库源码（`packages/engine/Source/Scene`）整理。本文中的“Tile 树”指 **3D Tiles 的逻辑层级**，不是 Cesium 地形/影像所使用的 `QuadtreeTile`。

## 先读这一页：三个对象，三种问题

如果第一次接触这部分源码，可以先暂时忽略 SSE、LRU、pass、implicit subtree 等术语，只记住下面的分工：

```text
Cesium3DTileset       管理整套数据：本帧看什么、请求什么、缓存什么
Cesium3DTile          管理一个节点：在哪里、误差多大、父子是谁、状态如何
Cesium3DTileContent   管理文件内容：下载后解析成模型、点云，或继续扩展树
```

用问题来对应对象会更容易：

| 想回答的问题 | 先看哪个对象 |
| --- | --- |
| 为什么这个数据集请求/卸载了某些瓦片？ | `Cesium3DTileset` |
| 为什么当前相机选中了这个节点而不是孩子？ | `Cesium3DTile` 的包围体、`geometricError`、`refine` 和可见性状态 |
| `.b3dm` / `.pnts` 的字节如何变成模型或点云？ | `Cesium3DTileContent` 及其具体实现 |
| 为什么已经下载了但还没有 DrawCommand？ | Tile 仍在 `PROCESSING`，或还没有进入本帧 `selectedTiles` |

建议先读本文第 1～5 节的概念和调用链，再用第 6 节理解内容生命周期；二进制到 GPU 的细节另见[《3D Tiles：从 ArrayBuffer 到 DrawCommand》](./3dtiles-binary-to-draw-command.md)。

## 结论先行

`Cesium3DTileset` 与 `Cesium3DTile` 不是同一层级的两个“瓦片”。前者是一个可加入 `scene.primitives` 的 **整个 3D Tiles 数据集运行时管理器**；后者是该数据集树中的 **一个逻辑节点**。一个 Tileset 有一个根 `Cesium3DTile`，并管理所有已知/已展开 Tile 的遍历、请求、缓存、样式和渲染。

```text
scene.primitives
  └─ Cesium3DTileset                         一个数据集、一个运行时调度器
       ├─ _root: Cesium3DTile                根逻辑节点
       │    ├─ children: Cesium3DTile[]      子逻辑节点
       │    └─ content: Cesium3DTileContent  当前节点的内容运行时对象（可为空）
       ├─ _requestedTiles                    本帧要请求的节点
       ├─ _processingQueue                   已下载、正创建 GPU 资源的节点
       ├─ _selectedTiles                     本帧用于生成绘制命令的节点
       └─ _cache                             可淘汰内容的 LRU 缓存
```

因此，不应把 `Cesium3DTile` 简单等同于“一个 `.b3dm` 文件”，也不能把 `Cesium3DTileset` 理解成“根瓦片文件”。二者分别对应 **调度域** 与 **树节点**；实际文件由 Tile 的 `content.uri`（或 `contents[].uri`）指向，下载后再被解析成不同的 `Cesium3DTileContent` 实现。

## 1. 两个对象各自描述什么

| 对象 | 描述的范围 | 创建方式 | 关键内容 | 是否直接渲染 |
| --- | --- | --- | --- | --- |
| `Cesium3DTileset` | 一个完整的 3D Tiles 数据集及其运行时状态 | 通常 `await Cesium3DTileset.fromUrl(tilesetJsonUrl)` | 根节点、全局 `geometricError`、模型矩阵、SSE 策略、请求/处理/选择队列、缓存、样式、统计与事件 | 作为 primitive 参与 Scene 的 update；自己不持有单个模型几何 |
| `Cesium3DTile` | 层级中的一个空间/LOD 节点 | `loadTileset()`/`makeTile()` 从 tile JSON header 创建；应用代码不应直接构造 | `boundingVolume`、`geometricError`、`refine`、`transform`、`parent`/`children`、可见性/SSE/优先级、本节点内容状态和资源地址 | 被选中时委托 `content.update()` 把本节点的绘制命令加入 `frameState.commandList` |
| `Cesium3DTileContent` | Tile 指向的内容在内存中的可用形式 | 下载字节后按 magic/JSON 类型由工厂创建 | Model、点云、矢量、复合内容、外部 tileset、隐式 subtree 等 | 通常是；但 `Tileset3DTileContent`、`Implicit3DTileContent` 的职责是扩展树，不直接产生几何命令 |

### `Cesium3DTileset` 是容器，也是逐帧调度器

构造函数主要初始化 **数据集级别策略与队列**，例如 `maximumScreenSpaceError`、`cacheBytes`、`skipLevelOfDetail`、样式引擎、`Cesium3DTilesetCache`，以及 `_requestedTiles`、`_processingQueue`、`_selectedTiles`。它不在构造阶段把所有瓦片内容下载完。

入口 `fromUrl()` 先请求并解析顶层 `tileset.json`，保存资源和元数据，再调用 `loadTileset()` 建树；见 [Cesium3DTileset.js:2211](../packages/engine/Source/Scene/Cesium3DTileset.js#L2211) 与 [Cesium3DTileset.js:2334](../packages/engine/Source/Scene/Cesium3DTileset.js#L2334)。

### `Cesium3DTile` 是“描述 + 瞬态状态”，不是内容本身

Tile 构造函数接收 `tileset`、基准 `Resource`、当前节点 JSON `header` 与 `parent`。它把 `header.transform` 和父变换相乘得到 `computedTransform`，构造 tile/content/request 的包围体，记录 `geometricError`、`refine` 和 `children`，并把 `content.uri` 解析为 `_contentResource`。参见 [Cesium3DTile.js:61](../packages/engine/Source/Scene/Cesium3DTile.js#L61) 与 [Cesium3DTile.js:230](../packages/engine/Source/Scene/Cesium3DTile.js#L230)。

一个 Tile 即使没有 `content` 也很有意义：它可作为纯空间层级节点，让遍历继续走到孩子；也可以在下载后发现内容是外部 tileset/subtree，于是成为“扩展树的节点”而不是“可绘制的节点”。

## 2. 它们和 `tileset.json`、瓦片文件如何对应

以最常见的显式 tileset 为例：

```json
{
  "asset": { "version": "1.0" },
  "geometricError": 500,
  "root": {
    "boundingVolume": { "box": [/* ... */] },
    "geometricError": 250,
    "refine": "REPLACE",
    "content": { "uri": "root.b3dm" },
    "children": [
      {
        "boundingVolume": { "box": [/* ... */] },
        "geometricError": 0,
        "content": { "uri": "tiles/leaf.glb" }
      }
    ]
  }
}
```

映射关系为：

```text
顶层 tileset.json
  └─ new Cesium3DTileset(options)
       └─ json.root ──makeTile──> root Cesium3DTile
            ├─ header.children[i] ──makeTile──> child Cesium3DTile
            ├─ header.boundingVolume  ──> tile._boundingVolume
            ├─ header.geometricError  ──> tile.geometricError
            ├─ header.refine          ──> tile.refine (ADD / REPLACE)
            └─ header.content.uri     ──相对 base Resource 解析──> tile._contentResource
                                                               └─ 请求后 -> Cesium3DTileContent
```

`loadTileset()` 用栈遍历 `root.children`，立即为 **显式写在 JSON 中** 的每个 header 创建 `Cesium3DTile`，并连好 `parent.children` 和 `_depth`；这个阶段只创建节点，通常没有下载其 content。见 [Cesium3DTileset.js:2334](../packages/engine/Source/Scene/Cesium3DTileset.js#L2334)。

### 一个 Tile 不只对应一种文件

| JSON / 下载结果 | Tile 的含义和后续行为 |
| --- | --- |
| 无 `content` | 创建 `Empty3DTileContent`，状态直接可用；它是仅用于空间层级/遍历的节点 |
| `content.uri: "x.b3dm"`、`pnts`、`i3dm`、`glb`、`gltf` 等 | URI 解析为 `_contentResource`；需要时下载，内容工厂创建模型或点云等可渲染 content |
| `contents: [...]` | 一个 Tile 有多个内容 URI，由 `Multiple3DTileContent` 分别调度 |
| `content.uri: "sub/tileset.json"` | 下载 JSON 后识别为 `externalTileset`；`Tileset3DTileContent.fromJson()` 以当前 Tile 为 parent 调用 `loadTileset()`，把外部根接入现有树 |
| `implicitTiling` / `3DTILES_implicit_tiling` | 起初只创建 subtree 的占位 Tile；下载 `.subtree` 后按 availability bitstream 懒生成真实的 `Cesium3DTile` 节点及下一层占位节点 |

内容分派由 [Cesium3DTileContentFactory.js](../packages/engine/Source/Scene/Cesium3DTileContentFactory.js) 完成：`b3dm`/`pnts`/`i3dm`、`cmpt`、`glb`/`gltf`、`subt` 和 `externalTileset` 都会落到不同的 Content 类。类型在下载后通过 `preprocess3DTileContent()` 识别，而不是仅凭扩展名；见 [Cesium3DTile.js:1373](../packages/engine/Source/Scene/Cesium3DTile.js#L1373)。

## 3. 能否理解为四叉树？——有条件地可以，但不能当成通用事实

3D Tiles 的规范模型是一般的 **树（tree）**：`children` 是数组，并无“必须四个孩子”或“只能二维平铺”的限制。显式 tileset 的每个节点可以有任意数目的孩子，且包围体可以是 `box`、`region`、`sphere` 或 S2 cell；数据也可以是建筑模型、点云、矢量或高斯 splat，不局限于平面地图瓦片。

```text
不要混淆：

Cesium 地形 / 影像：         QuadtreeTile / QuadtreePrimitive
                             固定二维 4 子节点的地图分片模型

3D Tiles 显式树：            Cesium3DTile.children[]
                             一般树，分支数与空间划分由生产数据决定

3D Tiles 隐式 tiling：       subdivisionScheme = QUADTREE 或 OCTREE
                             规则四叉树（每节点 4 个）或八叉树（每节点 8 个），
                             但 runtime 仍按 availability 懒创建节点
```

所以，只有当数据采用 **隐式四叉树**（或者生产工具恰好让显式节点总有四个子节点）时，才可以从空间划分角度称它为四叉树。即便如此，Cesium 的运行时对象关系仍是 `Cesium3DTileset -> Cesium3DTile.children[]`；没有把它改成 `QuadtreeTile`。隐式展开入口可见 [Implicit3DTileContent.js:260](../packages/engine/Source/Scene/Implicit3DTileContent.js#L260)。

## 4. 从 Scene 到 `Tileset.update` 的逐帧入口

应用将 Tileset 放入 `scene.primitives` 后，Scene 每帧依次调用 collection 的 `prePassesUpdate`、各个 pass 的 `updateForPass`、再调用 `postPassesUpdate`。普通 primitive 更新通过 `PrimitiveCollection.update()` 调用 `primitive.update(frameState)`；对于能处理多 pass 的 Tileset，collection 也会调用 `updateForPass(frameState, passState)`。桥梁见 [PrimitiveCollection.js:442](../packages/engine/Source/Scene/PrimitiveCollection.js#L442)、[PrimitiveCollection.js:449](../packages/engine/Source/Scene/PrimitiveCollection.js#L449) 和 [PrimitiveCollection.js:470](../packages/engine/Source/Scene/PrimitiveCollection.js#L470)。

`Cesium3DTileset.prototype.update(frameState)` 本身只是把默认 `frameState.tilesetPassState` 转交给 `updateForPass()`；真正面向 pass 的入口是后者，见 [Cesium3DTileset.js:3523](../packages/engine/Source/Scene/Cesium3DTileset.js#L3523)。

```text
Scene 本帧
  ├─ primitives.prePassesUpdate(frameState)
  │    └─ tileset.prePassesUpdate()
  │         └─ processTiles(): 上帧已经下载完的内容创建/推进 GPU 资源
  ├─ primitives.updateForPass(frameState, tilesetPassState)
  │    └─ tileset.updateForPass()
  │         └─ update()：选择 -> 请求 -> 更新选中内容/产生 DrawCommand
  └─ primitives.postPassesUpdate(frameState)
       └─ tileset.postPassesUpdate()
            ├─ 取消离屏请求
            ├─ 触发进度事件
            └─ 按缓存预算卸载不需要的内容
```

需要注意，除了 `RENDER`，还有 `PICK`、`SHADOW`、`PRELOAD`、`PRELOAD_FLIGHT`、`MOST_DETAILED_*` 等 pass。不同 pass 对 `requestTiles`、`isRender` 和 `ignoreCommands` 的开关不同；例如 RENDER 会请求也会保留命令，PRELOAD 会请求但丢弃命令。完整配置见 [Cesium3DTilePass.js](../packages/engine/Source/Scene/Cesium3DTilePass.js)。

## 5. 深入 `Tileset.update`：每帧的“三段主线”

核心私有函数 `update(tileset, frameState, passStatistics, passOptions)` 位于 [Cesium3DTileset.js:3418](../packages/engine/Source/Scene/Cesium3DTileset.js#L3418)。它做的并不是“更新所有 Tile”，而是围绕当前相机，在本帧完成选择、启动请求和为已就绪内容生成命令。

### 5.1 前置：本帧状态重置与策略选择

它先跳过 `MORPHING` 或无根节点的情况，清空统计，递增 `_updatedVisibilityFrame`，重置请求优先级归一化所需的 min/max 值，并检测 `modelMatrix` 是否变更。随后按 pass 和配置选择遍历器：

- `Cesium3DTilesetBaseTraversal`：默认逐层 REPLACE；父节点必须等所有必要孩子可用，才被替换。
- `Cesium3DTilesetSkipTraversal`：`skipLevelOfDetail` 时可跨层请求/绘制，降低等待整层加载的内存成本。
- `Cesium3DTilesetMostDetailedTraversal`：most-detailed preload/pick 使用。

选择分支见 [Cesium3DTileset.js:3493](../packages/engine/Source/Scene/Cesium3DTileset.js#L3493)。

### 5.2 阶段 A：遍历树，得到“本帧应该要什么”

遍历并不会直接发请求，而是填充几个结果数组。默认 Base Traversal 的入口在 [Cesium3DTilesetBaseTraversal.js:35](../packages/engine/Source/Scene/Cesium3DTilesetBaseTraversal.js#L35)：

1. 清空 `_requestedTiles`、`_selectedTiles`、`_selectedTilesToStyle`、`_emptyTiles`。
2. 对 root 执行 `updateTile()`；它再调用 `tile.updateVisibility()`，计算变换、到相机距离、SSE、视锥可见性、viewerRequestVolume、渐进分辨率和 foveated 优先级等。见 [Cesium3DTile.js:1021](../packages/engine/Source/Scene/Cesium3DTile.js#L1021)。
3. 若根不可见，结束；若根 SSE 已不超过 `memoryAdjustedScreenSpaceError`，也不需要往下细化。
4. 深度优先走可见孩子，针对每个节点判断能否细化：有孩子且 SSE 仍大于阈值时才继续；外部 tileset/隐式占位节点则在其孩子已出现后继续。
5. 按 `refine` 得到“这一帧显示谁”：`ADD` 的父/子可叠加；默认 `REPLACE` 则在孩子尚未准备好时显示父，等满足条件才由孩子替换，避免出现洞。
6. 需要加载但尚未可用的节点进入 `_requestedTiles`；可绘制节点进入 `_selectedTiles`；空节点进入 `_emptyTiles` 以便继续扩展树及调试。
7. 遍历结束后调用每个待请求 Tile 的 `updatePriority()`，使距离、SSE、深度、foveated 等因素成为请求排序依据。

这里的关键区别是：**selected 不等于 requested**。`_selectedTiles` 是目前可安全画出的 content（可能是较粗的父 Tile）；`_requestedTiles` 是为了改进当前视图而希望开始加载的 content。

### 5.3 阶段 B：按优先级发起内容请求

`requestTiles()` 先以 `tile._priority` 升序排序，再逐个调用内部 `requestContent(tileset, tile)`；见 [Cesium3DTileset.js:2776](../packages/engine/Source/Scene/Cesium3DTileset.js#L2776)。该函数调用 `tile.requestContent()`，请求成功、解析出 Content 后把 Tile 推入 `_processingQueue`，并记录在 `_requestedTilesInFlight`，以便离屏时取消。

实际 HTTP 请求链是：

```text
traversal.loadTile()
  └─ tileset._requestedTiles.push(tile)
       └─ requestTiles()                       Cesium3DTileset.js:2776
            └─ tile.requestContent()           Cesium3DTile.js:1126
                 └─ requestSingleContent()
                      ├─ new Request({
                      │    throttle: true,
                      │    throttleByServer: true,
                      │    type: RequestType.TILES3D,
                      │    priorityFunction: () => tile._priority
                      │  })
                      └─ resource.fetchArrayBuffer()
                           └─ Resource.fetch() -> RequestScheduler.request()
                                └─ 浏览器网络请求
```

请求实现见 [Cesium3DTile.js:1300](../packages/engine/Source/Scene/Cesium3DTile.js#L1300)；调度器入口见 [RequestScheduler.js:387](../packages/engine/Source/Core/RequestScheduler.js#L387)。`RequestScheduler` 会受全局并发上限、按服务器并发上限和优先级堆约束；不能排进本帧队列时返回 `undefined`，节点留待后续帧再尝试。离开视野且仍在 `LOADING` 的请求会在 `postPassesUpdate()` 中取消，见 [Cesium3DTileset.js:2678](../packages/engine/Source/Scene/Cesium3DTileset.js#L2678)。

下载到 `ArrayBuffer` 后，Tile 状态大致流转如下：

```text
UNLOADED
  └─ requestContent() ──> LOADING
       └─ ArrayBuffer 到达 + makeContent() ──> PROCESSING
            └─ tile.process() 创建/推进 WebGL 资源 ──> READY

失败 ──> FAILED
READY + expire 到期 ──> EXPIRED ──> LOADING（旧 content 可暂时继续绘制）
```

状态枚举定义在 [Cesium3DTileContentState.js](../packages/engine/Source/Scene/Cesium3DTileContentState.js)。

### 5.4 阶段 C：处理已选内容并生成 DrawCommand

`updateTiles()` 先应用样式，再遍历 `_selectedTiles`：对每个 Tile 触发 `tileVisible`（render pass）、处理高度回调、调用 `tile.update()`。后者更新 clipping/debug 状态并调用 `tile.content.update(tileset, frameState)`；具体 Content（如 `Model3DTileContent`）把渲染命令压入 `frameState.commandList`。见 [Cesium3DTileset.js:3119](../packages/engine/Source/Scene/Cesium3DTileset.js#L3119) 与 [Cesium3DTile.js:2298](../packages/engine/Source/Scene/Cesium3DTile.js#L2298)。

`_emptyTiles` 也会调用 `tile.update()`，但没有可渲染几何时只是推进外部/隐式树或调试状态。skip LOD 的混合内容场景还会插入 stencil/backface 命令，保证子层级逐步替换父层级时的遮挡正确性。

## 6. `prePassesUpdate` 与 `postPassesUpdate` 为什么不可忽略

只盯住 `update()` 会漏掉内容生命周期中的两个阶段：

- `prePassesUpdate()` 的 `processTiles()` 专门处理 `_processingQueue`。网络 Promise 在帧外完成后只表示字节和 Content 对象已拿到；这里才在渲染循环内调用 `tile.process()`，使模型解码、资源创建等逐步推进到 `READY`，并受缓存内存上限约束。见 [Cesium3DTileset.js:2701](../packages/engine/Source/Scene/Cesium3DTileset.js#L2701) 和 [Cesium3DTileset.js:2898](../packages/engine/Source/Scene/Cesium3DTileset.js#L2898)。
- `postPassesUpdate()` 取消离屏未完成请求、派发加载进度/完成事件，并通过 `_cache.unloadTiles()` 回收不再需要的 READY content。节点对象与整棵显式树通常仍在内存，优先淘汰的是它们的内容/GPU 资源；再次需要时可重新从 `UNLOADED` 请求。

这也解释了为何 “Tile 已创建” 与 “它的文件已下载、可画” 是三个不同层次的事实。

## 7. 推荐的源码阅读顺序

若目标是快速建立正确心智模型，建议按以下顺序断点或阅读：

1. [Cesium3DTileset.js:2211](../packages/engine/Source/Scene/Cesium3DTileset.js#L2211) `fromUrl()`：顶层 JSON 如何成为一个 Tileset。
2. [Cesium3DTileset.js:2334](../packages/engine/Source/Scene/Cesium3DTileset.js#L2334) `loadTileset()` 与 `makeTile()`：显式树、外部树和隐式占位节点如何建立。
3. [Cesium3DTile.js:61](../packages/engine/Source/Scene/Cesium3DTile.js#L61) 构造函数：header 到空间、层级、URI 和内容状态的映射。
4. [Cesium3DTileset.js:3418](../packages/engine/Source/Scene/Cesium3DTileset.js#L3418) 核心 update：选择、请求、命令三段式。
5. [Cesium3DTilesetBaseTraversal.js:35](../packages/engine/Source/Scene/Cesium3DTilesetBaseTraversal.js#L35) 和 [Cesium3DTilesetTraversal.js:77](../packages/engine/Source/Scene/Cesium3DTilesetTraversal.js#L77)：SSE/可见性驱动的选择逻辑。
6. [Cesium3DTile.js:1126](../packages/engine/Source/Scene/Cesium3DTile.js#L1126) 与 [Cesium3DTile.js:1300](../packages/engine/Source/Scene/Cesium3DTile.js#L1300)：实际请求、状态迁移、格式识别。
7. [Cesium3DTile.js:2298](../packages/engine/Source/Scene/Cesium3DTile.js#L2298)：一个选中 Tile 最终怎样把工作交给具体 content。

## 8. 一句话心智模型

把 3D Tiles 看作一棵按空间与误差组织的 **LOD 决策树**：`Cesium3DTileset` 每帧依据相机决定“现在能画什么、下一步要什么”，`Cesium3DTile` 保存树节点和请求/选择状态，`Cesium3DTileContent` 才是该节点某次加载后真正可绘制（或可扩展树）的内容。四叉树只是某些数据集的空间划分方式，不是这两个类之间的关系。
