# S3M 与 Cesium3DTileset：架构对照速查

<!-- markdownlint-disable MD013 MD032 -->

> 本文是 [S3M 与 3D Tiles 详细架构对照](./s3m-rendering-vs-3dtiles-architecture.md) 的精简版。S3M 的配置、Scheduler、PageLOD、S3MB 解析和 RenderEntity 细节以 [S3M 渲染原理主文档](../../s3m-spec/docs/s3m-rendering-guide.md) 为准；本文只保留两种运行时之间真正有帮助的架构差异，不重复展开 S3M 方法实现。

## 结论先行

S3M 和 Cesium `Cesium3DTileset` 共享 Cesium 的帧循环和渲染器，但不是同一种内容插件：

```text
同一个 Cesium Scene / FrameState
        ├─ S3MTilesLayer：S3M 自己完成 Tile、PageLOD、S3MB 和 RenderEntity 管理
        └─ Cesium3DTileset：Cesium 自己完成 Tile traversal、Content Factory 和 Model 管线
```

两者都遵循：

```text
相机判断 → 可见性/LOD 选择 → 请求 → 内容处理 → commandList 提交
```

最重要的区别不是“是否使用 WebGL”，而是三个所有权边界：

1. S3M 的细化关系有一部分藏在 S3MB 的 `groupNode.pageLods` 中；3D Tiles 通常先在 `tileset.json` 的 Tile 树中表达。
2. S3M 的 `S3MContentParser` 和 `RenderEntity` 更接近具体数据格式与 GPU 资源；3D Tiles 通过 `Cesium3DTileContentFactory` 和 Model/Content 管线隔离格式细节。
3. S3M 的 `S3MTilesLayer.update` 在一个入口中顺序推进选择、请求、处理和提交；3D Tiles 将部分 processing 放在 `prePassesUpdate`，并通过 `updateForPass` 处理不同渲染 pass。

## 1. 数据集、节点与内容：不要只做一对一映射

| 关注对象 | S3M CBD | Cesium 3D Tiles |
| --- | --- | --- |
| 数据集运行时 | `S3MTilesLayer` | `Cesium3DTileset` |
| 顶层描述 | `cbd.scp`（本例内容为 JSON） | `tileset.json` |
| 可请求节点 | `S3MTile`，通常对应一个 `.s3mb` | `Cesium3DTile`，可有内容也可只是空间节点 |
| 节点内细化 | `S3MPageLod[]`，来自 S3MB 的 `groupNode.pageLods` | `children[]`、implicit subtree 或外部 tileset |
| 绘制对象 | `RenderEntity` → `DrawCommand` | `Cesium3DTileContent` / `Model` → 一个或多个命令 |

S3M 的运行时关系应记成：

```text
cbd.scp
  └─ root S3MTile（一个 .s3mb）
       └─ pageLods[]（当前文件内的细节分支）
            ├─ renderEntities[]（当前分支的可绘制对象）
            └─ childTile（需要更细时惰性创建的下一份 .s3mb）
```

因此，比较 S3M 与 3D Tiles 时，不应只比较 `S3MTile` 和 `Cesium3DTile`。S3M 的 PageLOD 是理解其 LOD 和父子接管行为的必要中间层。具体对象字段和创建时机见主文档的 [核心对象关系](../../s3m-spec/docs/s3m-rendering-guide.md#2-核心对象关系图) 与 [Scheduler](../../s3m-spec/docs/s3m-rendering-guide.md#6-schedulerlod-调度的完整算法) 章节。

## 2. 每帧链路：相同阶段，不同组织方式

| 阶段 | S3M | Cesium 3D Tiles | 对比结论 |
| --- | --- | --- | --- |
| 帧入口 | `S3MTilesLayer.update(frameState)` | `Cesium3DTileset.updateForPass(...)` | 都从 FrameState 取得相机、视锥和渲染上下文 |
| 选择 | `S3MLayerScheduler.schedule` | traversal 的 `selectTiles` | 都先做可见性和 LOD，再决定请求与绘制候选 |
| 请求 | `requestTiles` → `S3MTile.requestContent` | `requestTiles` → `Cesium3DTile.requestContent` | 都使用 Cesium RequestScheduler 限流 |
| CPU 内容构造 | `S3ModelParser.parseBuffer` + `S3MContentParser.parse` | 内容预处理 + `Cesium3DTileContentFactory` | S3M 解析器更贴近 S3MB；3D Tiles 先按内容类型分派 |
| GPU 处理 | `S3MTile.transformResource` → RenderEntity | `tile.process` → Content/Model update | 都可能跨多帧完成 |
| 命令提交 | `RenderEntity.update` → `frameState.commandList` | `tile.update` / Content update → `commandList` | 最终都由 Cesium 统一执行 DrawCommand |
| 回收 | `S3MLayerCache` / `tile.free()` | Tileset cache / `unloadContent()` | 都按访问情况回收，但 3D Tiles 的生命周期状态更完整 |

主文档已经详细解释 S3M 的四步顺序；这里仅保留一个阅读提示：S3M 的 `_requestTiles`、`_processTiles` 和 `_renderQueue` 是“本帧工作清单”，不是长期缓存。判断一个模型是否真正可绘制，应继续追到 `RenderEntity.ready`、`colorCommand` 和 `commandList`。

## 3. LOD：S3M PageLOD range 与 3D Tiles SSE

| 维度 | S3M | 3D Tiles |
| --- | --- | --- |
| 直接决策对象 | `S3MPageLod` | `Cesium3DTile` traversal |
| 主要输入 | `rangeMode`、`rangeData`、相机距离、包围球、屏幕高度 | `geometricError`、相机距离、屏幕高度、`maximumScreenSpaceError` |
| 典型判断 | Distance / Pixel / GeometryError 三种模式 | 几何误差投影为 SSE，再与阈值比较 |
| 细化动作 | `pageLod.canRefine`，必要时创建 `childTile` | `canTraverse`，结合 `ADD` / `REPLACE` 等 refine 语义 |
| 子内容未就绪时 | Scheduler 保留父 PageLOD 的实体 | traversal 根据 refine 策略保留或替换父内容 |

两者都表达“当前屏幕需要多少细节”，但参数不能直接换算：S3M 的阈值是 PageLOD 自己的 `rangeData`，3D Tiles 的 `geometricError` 是数据集误差模型的一部分。比较画质或性能时，应同时记录相机、屏幕尺寸、选中节点数、请求数和 command 数。

另一个边界是：`canRefine` 决定“是否需要更细”，而 `tile.priority` 只决定“多个请求候选谁先处理”。这两个问题在两套实现中都不能混为一谈。

## 4. 内容与 GPU：格式耦合程度不同

S3M 的内容链较短、格式耦合更强：

```text
S3MB
  → S3ModelParser.parseBuffer
  → S3MContentParser.parse
  → S3MContentFactory
  → S3MCacheFileRenderEntity
  → Buffer / VertexArray / ShaderProgram / DrawCommand
```

3D Tiles 的内容链更通用：

```text
b3dm / i3dm / pnts / glb / cmpt / subtree
  → 内容预处理
  → Cesium3DTileContentFactory
  → Content / Model / glTF 管线
  → DrawCommand
```

这带来直接的调试差异：

- S3M 中看到 `groupNode`、`geoPackage`、`texturePackage` 和 `renderEntities`，就能较早判断格式关联是否正确；但还不能说明 GPU 资源已完成。
- 3D Tiles 的 Tile 调度层通常不直接理解 b3dm 或 glTF 的字段，而是观察 Content/Model 的统一生命周期。
- 两者的最终绘制终点相同，都是 `frameState.commandList`；差异发生在命令生成之前的内容抽象层。

## 5. 最小断点对照表

| 要回答的问题 | S3M 建议断点 | Cesium 3D Tiles 参考点 |
| --- | --- | --- |
| 根节点如何建立 | `S3MTilesLayer.loadConfig` | `Cesium3DTileset.fromUrl` / tileset JSON 加载 |
| 为什么节点不可见 | `S3MTile.updateVisibility` | `Cesium3DTile.updateVisibility` |
| 为什么继续细化 | `S3MPageLod.update` | traversal 的 `canTraverse` / SSE 计算 |
| 请求是否真的发出 | `S3MTile.requestContent` + Network | `Cesium3DTile.requestContent` + Network |
| 字节是否解析成功 | `S3ModelParser.parseBuffer` | 内容预处理和 Content Factory |
| 是否已形成可绘制对象 | `S3MContentParser.parse` 返回后，看 `pageLods` / `renderEntities` | Content/Model 创建完成后的 content 状态 |
| 为什么仍未绘制 | `S3MTile.transformResource`、entity 的资源创建队列 | `Cesium3DTile.process`、Content/Model ready 状态 |
| 是否提交了命令 | `S3MCacheFileRenderEntity.update`、`commandList.length` | Content/Model update、`commandList.length` |

S3M 的每个断点具体应观察哪些字段，以主文档为准；本表只用于快速找到 3D Tiles 中最接近的参照位置。

## 6. 不应强行等价的概念

- `S3MTilesLayer.ready` 与 `Cesium3DTileset.readyPromise` 都更接近“数据集运行时已建立”，不等于本帧已有模型命令。
- S3M 的 `S3MTile` 不等于一个完整的 3D Tiles Tile：前者还需要结合其内部 `PageLOD` 才能解释细化。
- S3M 的 `rangeData` 不等于 3D Tiles 的 `geometricError`；两者都参与 LOD，但误差定义和数据来源不同。
- S3M 的 `contentState` 当前存在 `PARSING` 与源码使用 `LOADED` 的命名不一致。这个问题应按源码缺口记录，不能拿来推导一个理想化的状态机。
- `priority` 只用于请求顺序，不能代替 `canRefine` 或 traversal 规则。

## 7. 推荐阅读顺序

1. 先读 [S3M 渲染原理主文档](../../s3m-spec/docs/s3m-rendering-guide.md) 的“结论先行”和 S3M 主链。
2. 再用本文的四张对照表定位 3D Tiles 中对应的抽象边界。
3. 只有在需要逐方法核对时，再回到 [详细架构对照](./s3m-rendering-vs-3dtiles-architecture.md)。

本文不展开完整 WebGL/GLSL、全部 S3MB 字段、全部 3D Tiles 内容类型或性能基准；这些内容超出“理解 CBD S3M 核心渲染原理并建立 Cesium 对照”的范围。
