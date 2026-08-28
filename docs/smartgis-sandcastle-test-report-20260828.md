# SmartGIS Sandcastle 全量测试报告

测试日期：2026-08-28  
测试范围：`packages/sandcastle/gallery/smartgis-*` 及本地 Sandcastle Gallery  
参考目录：[SouthSmart Cesium 示例](https://southsmart.com/developer-center/#/Web?system=Cesium&menu=example)

## 结论摘要

本地新增示例已经全部进入 Gallery 索引，但“进入索引”不等于“功能已经实现”。本次检查发现：

| 检查项 | 结果 | 结论 |
|---|---:|---|
| SmartGIS 示例目录 | 107 | 全部存在 `sandcastle.yaml`、`index.html`、`main.js` |
| Gallery 索引 | 107/107 | 全部已进入 `Apps/Sandcastle2/gallery/list.json` |
| JavaScript 语法 | 107/107 | 全量通过 `node --check` |
| 浏览器重点复核 | 2/2 | 修复后的可编辑平面/立方体最终能创建 Cesium canvas |
| ion token 注入复核 | 1/1 | 新会话中无默认 token warning、无 console error |
| 明确占位实现 | 4 | FLV、视频投影、视锥投放、自定义视频投放仍是占位面 |
| 高风险功能完整性 | 待整改 | 多个示例只有状态面板/标记实体，没有实现对应 SDK 功能 |

因此，当前项目的主要问题不是 Gallery 入口，而是部分示例的实现深度不足，不能直接宣称已经完成与 SmartGIS SDK 的功能等价复刻。

## 本次发现并修复的问题

### 1. 两个示例存在 JavaScript 解析错误

以下字符串中的中文引号结束了外层字符串，导致示例无法执行：

- `smartgis-editable-cube/main.js`
- `smartgis-editable-plane/main.js`

已改为使用中文弯引号文本，修复后两个文件均通过语法检查，并在浏览器中最终渲染出 Cesium canvas，工具栏按钮可见。

### 2. 四个视频示例仍为占位实现

以下示例的代码明确显示“视频占位面已创建”，没有真实视频源、解码器或投影算法：

- `smartgis-flv-video`
- `smartgis-video-projection`
- `smartgis-frustum-video`
- `smartgis-video-custom`

这四项应标记为 `PARTIAL`，不能标记为 `PASS`。其中 FLV 播放还需要外部解码库或后端转码方案；如果坚持只使用开源 Cesium，则应把视频解码和纹理更新链路作为独立自研/开源依赖任务说明清楚。

### 3. ion token 加载顺序已修复

原先 `ion-config.js` 以模块脚本加载，且部分示例没有主动设置 `Cesium.Ion.defaultAccessToken`，会在 Viewer 初始化时触发默认 token warning。现在由 Sandcastle bucket-client 在执行每个示例代码前，用内部别名统一注入 token，避免与示例自身的 `Cesium` 变量冲突。

浏览器新会话复核 `smartgis-editable-cube`：Cesium canvas 数量为 2，无默认 token warning，无 console error。

## 与 SmartGIS SDK 的功能完整性判断

当前 107 个示例能够按目录名称映射到 SmartGIS 的对应主题，但从实现代码看，部分示例只是“功能说明 + Viewer + 状态面板 + 一个标记实体”。例如，3DTiles 特效示例的默认按钮只添加点和文字标注，并未加载 `Cesium3DTileset` 或设置 `CustomShader`；多光源示例只启用 `scene.globe.enableLighting` 并添加椭球体，也没有实现多点光源/聚光灯渲染。

静态审计结果：

- 54 个 `main.js` 不超过 60 行，属于高概率需要重点复核的短实现；短代码本身不是失败证据，但与复杂 SDK 功能不匹配时应判为 `PARTIAL`。
- `Cesium3DTileset` 在 SmartGIS 示例中出现次数为 0；涉及建筑颜色渐变、3DTiles 特效、模型展开等主题时尤其需要复核。
- `ShadowMode`、`PlaneGeometry`、`CustomDataSource` 未在这些示例中出现；级联阴影、可编辑平面、离线/数据源类能力需要重点复核实现路径。
- `CustomShader` 和 `PostProcessStage` 各只出现在少量示例中，不能据此证明所有对应特效已实现。

这些指标用于定位风险，不把 API 名称出现与功能正确性混为一谈；最终功能验收必须结合默认按钮、交互操作和视觉结果。

## 验收判定规则

后续每个示例按以下状态记录：

- `PASS`：页面无控制台 error，Cesium 场景完成初始化，对应核心 API 被实际调用，默认操作能看到目标效果。
- `PARTIAL`：场景可初始化，但只有占位面、标记实体、状态提示，或需要外部服务/视频源才能看到目标效果。
- `FAIL`：JavaScript 解析失败、运行时异常、场景未初始化或核心交互不可用。
- `BLOCKED`：依赖 token、外部数据服务、浏览器权限或缺少测试数据，无法判定功能本身。

## 当前需要优先整改的任务

1. 为 4 个视频示例补充真实开源链路，至少完成 MP4/MediaStream → VideoTexture → Primitive/材质更新；其余投影效果分别实现视锥体投影和 UV 映射。
2. 为所有 3DTiles 主题加载真实 tileset，并使用 `Cesium3DTileset`、`CustomShader` 或 `Cesium3DTileStyle` 完成颜色渐变、特效和模型展开。
3. 为多光源、级联阴影、体积云、体积光、GTAO 等示例补充真正的渲染实现，不能只修改 Viewer/Scene 开关。
4. 为测量、通视、可视域、剖面、控高、填挖方等分析示例补充输入数据、算法流程、结果可视化和边界条件测试。
5. 为每个示例增加统一验收元数据：`coreApis`、`expectedEffect`、`interactionSteps`、`knownLimitations`，便于自动化回归和面试复盘。

## 可重复执行的检查命令

```sh
# 检查所有 SmartGIS 示例的 JavaScript 语法
node -e 'const fs=require("fs"),cp=require("child_process");const ds=fs.readdirSync("packages/sandcastle/gallery").filter(x=>x.startsWith("smartgis-"));let bad=[];for(const d of ds){const r=cp.spawnSync(process.execPath,["--check",`packages/sandcastle/gallery/${d}/main.js`]);if(r.status!==0)bad.push(d)};console.log({total:ds.length,syntaxOk:ds.length-bad.length,syntaxBad:bad})'

# 更新 Gallery 索引
SANDCASTLE_NO_EMBEDDINGS=1 npm run build-sandcastle -- --no-embeddings
```
