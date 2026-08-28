# SouthSmart Cesium 示例覆盖比对

更新时间：2026-08-28  
来源：[SouthSmart Cesium 示例目录](https://southsmart.com/developer-center/#/Web?system=Cesium&menu=example)  
本地范围：`packages/sandcastle/gallery/smartgis-*`

## 结论

当前本地示例尚未覆盖 SouthSmart 目录中的全部功能：

| 指标 | 数量 |
|---|---:|
| SouthSmart 模块 | 23 |
| SouthSmart 示例 | 108 |
| 本地 SmartGIS 示例 | 18 |
| 已体现（按功能名称归一化匹配） | 18 |
| 尚未体现 | 90 |
| 当前覆盖率 | 16.7% |

结论：本地已有示例均能在 SouthSmart 目录中找到对应功能，但 SouthSmart 还有 90 个示例没有在本地 `smartgis-*` 中体现。

名称归一化规则包括去除本地 `SmartGIS - ` 前缀，以及将“雾效果/雨效果/雪效果/播放 MP4 视频”等本地展示名称与目录中的“雾/雨/雪/播放MP4视频文件”按功能语义匹配。该比对只判断功能是否存在，不代表实现方式或效果完全等价。

## 已体现的 18 个示例

| SouthSmart 示例 | 本地示例 |
|---|---|
| 创建视图 | `smartgis-viewer` |
| 顶点拾取 | `smartgis-vertex-picking` |
| 参考椭球体 | `smartgis-ellipsoid` |
| 绘制几何 | `smartgis-draw` |
| 天地图矢量底图 | `smartgis-tianditu-vec` |
| 天地图注记 | `smartgis-tianditu-annotation` |
| 无底图 | `smartgis-no-basemap` |
| 播放MP4视频文件 | `smartgis-video-mp4` |
| 雨 | `smartgis-rain` |
| 雪 | `smartgis-snow` |
| 雾 | `smartgis-fog` |
| 热力图 | `smartgis-heatmap` |
| 抗锯齿 | `smartgis-anti-alias` |
| 绕中心旋转 | `smartgis-camera-rotation` |
| 键盘漫游 | `smartgis-keyboard-roaming` |
| 飞行管理 | `smartgis-fly-management` |
| 模型拾取 | `smartgis-model-picking` |
| HTML标注 | `smartgis-html-label` |

以上本地 18 个示例已经完成本地 Sandcastle 验收：场景均可初始化，最终复测未发现控制台 error；天地图示例使用外部 token 配置，不依赖 SouthSmart SDK。

## 尚未体现的 90 个示例

以下按 SouthSmart 当前目录模块保留，便于后续按个人 profile 难度继续拆解 task。

### 特色功能

- HDR（类虚幻引擎）
- 体积云
- 体积光
- 近地天空盒
- 稳定的级联阴影贴图

### 在线绘制与量测

- 绘制可编辑平面
- 绘制可编辑立方体
- 基础测量

### 在线底图

- 天地图底图
- esri底图
- 百度底图
- 深色底图（可配）
- 天地图地名标注（三维）

### 影像栅格

- SmartImagery影像
- Arcgis MapServer 4490 影像
- WMS 单图加载
- 六边形网格

### 地形

- 公网地形
- ArcGIS地形
- 多地形管理
- 天地图地形
- 自定义地形

### 矢量

- 二维矢量瓦片底图
- 新海量矢量
- pbf矢量样式数据
- kmz全球经济

### 空间查询

- 框选
- 几何拾取

### 空间分析

- 通视分析
- 可视域分析
- 剖面分析
- 立方体截图
- 面裁剪（原剖切分析）
- 天际线分析
- 控高分析
- 日照分析
- 淹没分析
- 淹没分析（贴地）
- entity淹没
- 缓冲分析
- 雷达分析

### 地形分析

- 地形开挖
- 地形抬升
- 填挖方分析
- 等高线分析
- 坡度坡向分析

### 视频相关

- 播放FLV视频流
- 视频流投影
- 视锥视频投放
- 视频投放-自定义

### 环境模拟（特效）

- 粒子特效
- 水面效果
- 水面效果2
- 水体效果
- 流体模拟
- 船闸通航
- 大坝泄水
- 水质污染模型

### 场景展示

- 多光源
- 建筑颜色渐变
- 3DTiles特效
- OD动态线
- 动态材质
- 环形特效
- 向量场特效

### 后期处理

- 景深特效
- 后处理颜色特效
- GTAO

### 显示设置

- 卷帘对比
- 分屏对比
- 立体分屏
- 倾斜压平
- 地下模式

### 相机控制

- 鹰眼地图
- 二三维联动
- 视点漫游

### 内存缓存

- 离线数据(IndexedDB)

### 地质模型

- 拉伸
- 实心剖切
- 炸开

### 模型操作

- 模型展开
- 模型编辑（OBJ模型）
- 位置编辑

### 高级模型材质

- KHR_materials_specular
- KHR_materials_emissive_strength
- KHR_materials_variants

### 基础标绘

- HTML渲染至场景
- HTML标注-碰撞

### 军事标绘

- 军事标绘
- 态势推演

## 后续复刻建议

继续使用“个人 profile 难度优先”排序，并保持以下约束：

1. 仅使用开源 Cesium，不引用 SouthSmart SDK、其内置变量或私有服务实现。
2. 可复用 Cesium 原生能力时优先使用原生 API；缺少能力时优先编写可解释、可测试的自研算法。
3. 每个新增示例文档必须记录：实现原理、核心 Cesium API、关键数学/渲染知识、限制条件、验收步骤和面试考察点。
4. 先补齐基础绘制、量测、查询、底图/影像/地形，再进入空间分析、后处理、模型材质和高级特效。

