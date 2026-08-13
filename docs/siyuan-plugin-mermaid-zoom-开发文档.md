# 思源笔记 Mermaid 图表放大预览插件 — 开发文档

## 一、项目概述

### 1.1 插件名称
`siyuan-plugin-mermaid-zoom`

### 1.2 功能描述
为思源笔记中的 Mermaid / Graphviz / PlantUML 等图表块添加**点击放大预览**功能，支持：
- 双击图表 → 全屏弹窗查看大图
- 鼠标滚轮缩放
- 拖拽平移
- 重置缩放按钮
- 导出为 PNG 图片
- 快捷键打开/关闭预览

### 1.3 这个 Issue 的背景
GitHub Issue [#12691](https://github.com/siyuan-note/siyuan/issues/12691)：官方已认可该需求（Enhancement），但放在了 backlog 中尚未实现。社区呼声很高。

---

## 二、开发环境搭建

### 2.1 前置要求

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 18 | 运行环境 |
| pnpm | >= 8 | 包管理器（官方推荐） |
| 思源笔记 | >= 3.5.3 | 运行插件的宿主应用 |
| Git | 任意 | 版本控制 |

### 2.2 初始化项目

```bash
# 1. 创建项目目录（建议在思源工作空间的 plugins 目录下）
# 思源工作空间目录通常在: ~/SiYuan/data/plugins/
mkdir siyuan-plugin-mermaid-zoom
cd siyuan-plugin-mermaid-zoom

# 2. 初始化 git
git init

# 3. 初始化 npm
pnpm init
```

### 2.3 安装依赖

```bash
pnpm add -D \
  siyuan@latest \
  typescript@4.8.4 \
  tslib@2.4.0 \
  webpack@^5.76.0 \
  webpack-cli@^5.0.2 \
  esbuild-loader@^3.0.1 \
  css-loader@^6.7.1 \
  sass@^1.62.1 \
  sass-loader@^12.6.0 \
  mini-css-extract-plugin@2.3.0 \
  copy-webpack-plugin@^11.0.0 \
  zip-webpack-plugin@^4.0.1
```

> `siyuan` 这个 npm 包只提供 TypeScript 类型声明（d.ts），不包含实际运行时代码。

---

## 三、项目目录结构

创建完整的目录结构如下：

```
siyuan-plugin-mermaid-zoom/
├── src/
│   ├── index.ts              # 插件主入口
│   ├── index.scss            # 插件样式
│   ├── zoom-dialog.ts        # 放大弹窗逻辑（缩放、拖拽）
│   └── i18n/
│       ├── en_US.json        # 英文国际化
│       └── zh_CN.json        # 中文国际化
├── icon.png                  # 插件图标 160x160, ≤20KB
├── preview.png               # 预览图 1024x768, ≤200KB
├── plugin.json               # 插件元信息
├── package.json              # npm 配置
├── tsconfig.json             # TypeScript 配置
├── webpack.config.js         # 构建配置
├── README.md                 # 英文说明
├── README_zh_CN.md           # 中文说明
├── CHANGELOG.md              # 变更日志
├── LICENSE                   # 开源协议
└── .gitignore
```

---

## 四、各文件详细内容

### 4.1 `plugin.json` — 插件元信息

```json
{
  "name": "siyuan-plugin-mermaid-zoom",
  "author": "你的名字",
  "url": "https://github.com/你的用户名/siyuan-plugin-mermaid-zoom",
  "version": "0.1.0",
  "minAppVersion": "3.5.3",
  "backends": ["all"],
  "frontends": ["desktop", "browser-desktop"],
  "disabledInPublish": false,
  "displayName": {
    "default": "Mermaid Zoom",
    "zh_CN": "Mermaid 图表放大预览"
  },
  "description": {
    "default": "Double-click to zoom and pan Mermaid/Graphviz/PlantUML diagrams in a fullscreen dialog",
    "zh_CN": "双击 Mermaid/Graphviz/PlantUML 图表即可全屏放大查看，支持缩放和拖拽"
  },
  "readme": {
    "default": "README.md",
    "zh_CN": "README_zh_CN.md"
  },
  "funding": {
    "custom": []
  },
  "keywords": [
    "mermaid",
    "zoom",
    "preview",
    "图表",
    "放大",
    "全屏",
    "graphviz",
    "plantuml"
  ]
}
```

### 4.2 `tsconfig.json`

```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "module": "commonjs",
    "target": "es6",
    "strict": true,
    "esModuleInterop": true,
    "sourceMap": true
  },
  "include": [
    "src/**/*.ts"
  ]
}
```

### 4.3 `webpack.config.js`

```javascript
const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const { EsbuildPlugin } = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (env, argv) => {
  const isPro = argv.mode === "production";
  const plugins = [
    new MiniCssExtractPlugin({
      filename: isPro ? "dist/index.css" : "index.css",
    }),
  ];
  let entry = {
    index: "./src/index.ts",
  };
  if (isPro) {
    entry = {
      "dist/index": "./src/index.ts",
    };
    plugins.push(
      new webpack.BannerPlugin({
        banner: () => {
          return fs.readFileSync("LICENSE").toString();
        },
      })
    );
    plugins.push(
      new CopyPlugin({
        patterns: [
          { from: "preview.png", to: "./dist/" },
          { from: "icon.png", to: "./dist/" },
          { from: "README*.md", to: "./dist/" },
          { from: "plugin.json", to: "./dist/" },
          { from: "src/i18n/", to: "./dist/i18n/" },
        ],
      })
    );
    plugins.push(
      new ZipPlugin({
        filename: "package.zip",
        algorithm: "gzip",
        include: [/dist/],
        pathMapper: (assetPath) => {
          return assetPath.replace("dist/", "");
        },
      })
    );
  } else {
    plugins.push(
      new CopyPlugin({
        patterns: [{ from: "src/i18n/", to: "./i18n/" }],
      })
    );
  }
  return {
    mode: argv.mode || "development",
    watch: !isPro,
    devtool: isPro ? false : "eval",
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname),
      libraryTarget: "commonjs2",
      library: {
        type: "commonjs2",
      },
    },
    externals: {
      siyuan: "siyuan",
    },
    entry,
    optimization: {
      minimize: true,
      minimizer: [new EsbuildPlugin()],
    },
    resolve: {
      extensions: [".ts", ".scss", ".js", ".json"],
    },
    module: {
      rules: [
        {
          test: /\.ts(x?)$/,
          include: [path.resolve(__dirname, "src")],
          use: [
            {
              loader: "esbuild-loader",
              options: {
                target: "es6",
              },
            },
          ],
        },
        {
          test: /\.scss$/,
          include: [path.resolve(__dirname, "src")],
          use: [
            MiniCssExtractPlugin.loader,
            { loader: "css-loader" },
            { loader: "sass-loader" },
          ],
        },
      ],
    },
    plugins,
  };
};
```

### 4.4 `package.json`

在 `pnpm init` 生成的基础上修改为：

```json
{
  "name": "siyuan-plugin-mermaid-zoom",
  "version": "0.1.0",
  "description": "Zoom and pan Mermaid/Graphviz/PlantUML diagrams in SiYuan Note",
  "main": "./src/index.js",
  "scripts": {
    "dev": "webpack --mode development",
    "build": "webpack --mode production"
  },
  "keywords": ["siyuan", "plugin", "mermaid", "zoom"],
  "author": "你的名字",
  "license": "MIT",
  "devDependencies": {
    "// 依赖由 pnpm add -D 安装，此处省略": ""
  }
}
```

> 注意：`devDependencies` 会在 `pnpm add -D` 时自动写入，不需要手动填。

### 4.5 `.gitignore`

```
node_modules/
dist/
*.js
*.css
*.js.map
!webpack.config.js
package.zip
```

---

## 五、核心源码实现

### 5.1 `src/i18n/zh_CN.json`

```json
{
  "pluginName": "Mermaid 图表放大预览",
  "zoomIn": "放大",
  "zoomOut": "缩小",
  "resetZoom": "重置缩放",
  "exportPng": "导出 PNG",
  "close": "关闭",
  "previewTitle": "图表预览",
  "dblclickTip": "双击图表可放大查看",
  "openPreview": "打开图表预览"
}
```

### 5.2 `src/i18n/en_US.json`

```json
{
  "pluginName": "Mermaid Diagram Zoom",
  "zoomIn": "Zoom In",
  "zoomOut": "Zoom Out",
  "resetZoom": "Reset Zoom",
  "exportPng": "Export PNG",
  "close": "Close",
  "previewTitle": "Diagram Preview",
  "dblclickTip": "Double-click a diagram to zoom in",
  "openPreview": "Open Diagram Preview"
}
```

### 5.3 `src/index.scss` — 插件样式

```scss
/* ========== 放大按钮（悬浮在图表右上角） ========== */
.mermaid-zoom-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 5;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: none;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: auto;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
}

/* 鼠标悬浮在图表块上时显示放大按钮 */
.protyle-wysiwyg [data-subtype="mermaid"],
.protyle-wysiwyg [data-subtype="graphviz"],
.protyle-wysiwyg [data-subtype="plantuml"] {
  &:hover .mermaid-zoom-btn {
    opacity: 1;
  }
}

/* ========== 全屏预览弹窗 ========== */
.mermaid-zoom-overlay {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 工具栏 */
.mermaid-zoom-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;

  .toolbar-btn {
    padding: 4px 12px;
    border-radius: 4px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: background 0.15s ease;

    &:hover {
      background: var(--b3-theme-primary-lightest);
    }

    svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
  }

  .toolbar-separator {
    width: 1px;
    height: 20px;
    background: var(--b3-border-color);
    margin: 0 4px;
  }

  .zoom-level {
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    min-width: 48px;
    text-align: center;
    user-select: none;
  }
}

/* SVG 容器 */
.mermaid-zoom-container {
  flex: 1;
  overflow: hidden;
  cursor: grab;
  background:
    radial-gradient(circle, var(--b3-border-color) 1px, transparent 1px);
  background-size: 20px 20px;
  position: relative;

  &.is-grabbing {
    cursor: grabbing;
  }

  .mermaid-zoom-svg-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center center;
    transition: none;

    svg {
      max-width: none;
      max-height: none;
    }
  }
}
```

### 5.4 `src/zoom-dialog.ts` — 放大弹窗核心逻辑

```typescript
import { Dialog } from "siyuan";

interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
  isDragging: boolean;
  startX: number;
  startY: number;
}

/**
 * 打开全屏放大预览弹窗
 */
export function openZoomDialog(svgElement: SVGElement, i18n: Record<string, string>) {
  // 克隆 SVG
  const svgClone = svgElement.cloneNode(true) as SVGElement;

  // 移除可能的尺寸限制，使其可自由缩放
  svgClone.removeAttribute("width");
  svgClone.removeAttribute("height");
  svgClone.style.width = "auto";
  svgClone.style.height = "auto";
  svgClone.style.maxWidth = "none";
  svgClone.style.maxHeight = "none";

  // 创建弹窗
  const dialog = new Dialog({
    title: i18n.previewTitle || "Diagram Preview",
    content: `
      <div class="mermaid-zoom-overlay">
        <div class="mermaid-zoom-toolbar">
          <button class="toolbar-btn" data-action="zoom-in" title="${i18n.zoomIn}">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            ${i18n.zoomIn}
          </button>
          <button class="toolbar-btn" data-action="zoom-out" title="${i18n.zoomOut}">
            <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
            ${i18n.zoomOut}
          </button>
          <span class="zoom-level">100%</span>
          <button class="toolbar-btn" data-action="reset" title="${i18n.resetZoom}">
            <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
            ${i18n.resetZoom}
          </button>
          <div class="toolbar-separator"></div>
          <button class="toolbar-btn" data-action="export-png" title="${i18n.exportPng}">
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            ${i18n.exportPng}
          </button>
        </div>
        <div class="mermaid-zoom-container">
          <div class="mermaid-zoom-svg-wrapper"></div>
        </div>
      </div>
    `,
    width: "90vw",
    height: "85vh",
  });

  // 将 SVG 放入容器
  const wrapper = dialog.element.querySelector(".mermaid-zoom-svg-wrapper") as HTMLElement;
  const container = dialog.element.querySelector(".mermaid-zoom-container") as HTMLElement;
  const zoomLevelEl = dialog.element.querySelector(".zoom-level") as HTMLElement;
  wrapper.appendChild(svgClone);

  // 缩放/拖拽状态
  const state: ZoomState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
  };

  // ---- 更新变换 ----
  function applyTransform() {
    wrapper.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    zoomLevelEl.textContent = `${Math.round(state.scale * 100)}%`;
  }

  // ---- 缩放 ----
  function zoom(delta: number, centerX?: number, centerY?: number) {
    const oldScale = state.scale;
    state.scale = Math.max(0.1, Math.min(10, state.scale + delta));

    // 如果提供了缩放中心点，保持该点位置不变
    if (centerX !== undefined && centerY !== undefined) {
      const rect = container.getBoundingClientRect();
      const offsetX = centerX - rect.left - rect.width / 2;
      const offsetY = centerY - rect.top - rect.height / 2;
      const ratio = 1 - state.scale / oldScale;
      state.translateX += (offsetX - state.translateX) * ratio;
      state.translateY += (offsetY - state.translateY) * ratio;
    }

    applyTransform();
  }

  // ---- 鼠标滚轮缩放 ----
  container.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom(delta, e.clientX, e.clientY);
  }, { passive: false });

  // ---- 拖拽平移 ----
  container.addEventListener("mousedown", (e: MouseEvent) => {
    if (e.button !== 0) return; // 只响应左键
    state.isDragging = true;
    state.startX = e.clientX - state.translateX;
    state.startY = e.clientY - state.translateY;
    container.classList.add("is-grabbing");
    e.preventDefault();
  });

  const handleMouseMove = (e: MouseEvent) => {
    if (!state.isDragging) return;
    state.translateX = e.clientX - state.startX;
    state.translateY = e.clientY - state.startY;
    applyTransform();
  };

  const handleMouseUp = () => {
    state.isDragging = false;
    container.classList.remove("is-grabbing");
  };

  // 监听 document 级别以处理鼠标移出容器的情况
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  // ---- 工具栏按钮 ----
  dialog.element.querySelectorAll(".toolbar-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = (btn as HTMLElement).dataset.action;
      switch (action) {
        case "zoom-in":
          zoom(0.2);
          break;
        case "zoom-out":
          zoom(-0.2);
          break;
        case "reset":
          state.scale = 1;
          state.translateX = 0;
          state.translateY = 0;
          applyTransform();
          break;
        case "export-png":
          exportSvgAsPng(svgClone);
          break;
      }
    });
  });

  // ---- 弹窗销毁时清理 ----
  const originalDestroy = dialog.destroy.bind(dialog);
  dialog.destroy = (options?: any) => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    originalDestroy(options);
  };
}

/**
 * 将 SVG 导出为 PNG 并下载
 */
function exportSvgAsPng(svgElement: SVGElement) {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    // 2倍分辨率以保证清晰度
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `diagram-${Date.now()}.png`;
      a.click();

      URL.revokeObjectURL(pngUrl);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.src = url;
}
```

### 5.5 `src/index.ts` — 插件主入口

```typescript
import {
  Plugin,
  showMessage,
  getFrontend,
} from "siyuan";
import "./index.scss";
import { openZoomDialog } from "./zoom-dialog";

/**
 * 支持放大预览的图表类型
 * 思源中的代码块 data-subtype 属性值
 */
const SUPPORTED_SUBTYPES = ["mermaid", "graphviz", "plantuml"];

/**
 * 用于匹配图表渲染容器的 CSS 选择器
 * 思源渲染后的 DOM 结构：
 *   div[data-node-id][data-type="NodeCodeBlock"][data-subtype="mermaid"]
 *     └── div.protyle-action (工具栏)
 *     └── div.hljs (代码高亮区域，编辑时可见)
 *     └── div[spin="1"] (渲染后的图表容器)
 *         └── svg (Mermaid 渲染出来的 SVG)
 */
const CHART_BLOCK_SELECTOR = SUPPORTED_SUBTYPES.map(
  (t) => `.protyle-wysiwyg [data-subtype="${t}"]`
).join(", ");

export default class MermaidZoomPlugin extends Plugin {
  private handleDblClick: (e: MouseEvent) => void;
  private observer: MutationObserver | null = null;
  private isMobile: boolean = false;

  onload() {
    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

    // 注册自定义 SVG 图标
    this.addIcons(`
      <symbol id="iconMermaidZoom" viewBox="0 0 24 24">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
      </symbol>
    `);

    // ---- 方式1: 双击打开预览 ----
    this.handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 判断双击目标是否在图表渲染区域内
      const chartBlock = target.closest(CHART_BLOCK_SELECTOR);
      if (!chartBlock) return;

      // 排除点击在代码编辑区域上（hljs区域）
      if (target.closest(".hljs") || target.closest(".protyle-action")) return;

      const svg = chartBlock.querySelector("svg");
      if (!svg) return;

      e.preventDefault();
      e.stopPropagation();
      openZoomDialog(svg, this.i18n);
    };
    document.addEventListener("dblclick", this.handleDblClick, true);

    // ---- 方式2: 注入放大按钮到图表块 ----
    this.setupObserver();

    // ---- 注册快捷键 ----
    this.addCommand({
      langKey: "openPreview",
      hotkey: "⌥⇧Z",
      editorCallback: (protyle) => {
        // 找到当前聚焦的图表块
        const focusedBlock = protyle.wysiwyg.element.querySelector(
          SUPPORTED_SUBTYPES.map(
            (t) => `[data-subtype="${t}"] svg`
          ).join(", ")
        );
        if (focusedBlock) {
          openZoomDialog(focusedBlock as SVGElement, this.i18n);
        } else {
          showMessage(this.i18n.dblclickTip || "Double-click a diagram to zoom in");
        }
      },
    });

    console.log(`[mermaid-zoom] Plugin loaded`);
  }

  onunload() {
    // 移除双击事件
    if (this.handleDblClick) {
      document.removeEventListener("dblclick", this.handleDblClick, true);
    }
    // 断开 Observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    // 移除所有已注入的放大按钮
    document.querySelectorAll(".mermaid-zoom-btn").forEach((btn) => btn.remove());

    console.log(`[mermaid-zoom] Plugin unloaded`);
  }

  /**
   * 使用 MutationObserver 监听 DOM 变化，
   * 当新的图表块渲染出来时，自动注入放大按钮
   */
  private setupObserver() {
    // 初始化：为已有的图表块注入按钮
    this.injectZoomButtons();

    // 监听 DOM 变化
    this.observer = new MutationObserver(() => {
      this.injectZoomButtons();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * 为所有图表块注入放大按钮
   */
  private injectZoomButtons() {
    const blocks = document.querySelectorAll(CHART_BLOCK_SELECTOR);
    blocks.forEach((block) => {
      // 避免重复注入
      if (block.querySelector(".mermaid-zoom-btn")) return;

      // 确保有渲染出的 SVG
      const svg = block.querySelector("svg");
      if (!svg) return;

      // 确保图表块有 position: relative
      const el = block as HTMLElement;
      const computedPos = window.getComputedStyle(el).position;
      if (computedPos === "static") {
        el.style.position = "relative";
      }

      // 创建放大按钮
      const btn = document.createElement("button");
      btn.className = "mermaid-zoom-btn";
      btn.title = this.i18n.zoomIn || "Zoom In";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
        </svg>
      `;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentSvg = block.querySelector("svg");
        if (currentSvg) {
          openZoomDialog(currentSvg, this.i18n);
        }
      });

      el.appendChild(btn);
    });
  }
}
```

---

## 六、开发调试流程

### 6.1 开发环境运行

```bash
# 方法一：直接在思源 plugins 目录下开发
# 将项目 clone/link 到 {思源工作空间}/data/plugins/siyuan-plugin-mermaid-zoom/

# 启动开发模式（自动监听文件变化并重新编译）
pnpm run dev
```

编译产物 `index.js` 和 `index.css` 会输出到项目根目录。

### 6.2 在思源中加载插件

1. 打开思源笔记
2. 进入 **设置 → 集市 → 已下载**
3. 找到你的插件并启用
4. 如果看不到，确保项目目录在 `{workspace}/data/plugins/` 下，且 `plugin.json` 中的 `name` 和目录名一致

### 6.3 调试技巧

- **打开 DevTools**: 在思源桌面端按 `F12` 或 `Ctrl+Shift+I`
- **查看 Mermaid DOM 结构**: 在 DevTools 中选择一个 Mermaid 图表，观察其 DOM 层级
- **修改代码后**: `pnpm run dev` 会自动重新编译，但需要在思源中**禁用再启用插件**才能看到变化（或刷新页面 `Ctrl+Shift+R`）

### 6.4 Mermaid 块的 DOM 结构参考

在思源笔记中，一个 Mermaid 代码块渲染后的 DOM 大致如下：

```html
<div data-node-id="20240101120000-abcdefg"
     data-type="NodeCodeBlock"
     data-subtype="mermaid"
     class="render-node"
     style="position: relative;">

  <!-- 工具栏（编辑、复制、菜单等） -->
  <div class="protyle-action">
    <!-- 各种操作按钮 -->
  </div>

  <!-- 代码内容（编辑时可见） -->
  <div class="hljs" contenteditable="true" spellcheck="false">
    graph TD; A-->B; B-->C;
  </div>

  <!-- ★ 渲染后的图表容器 — 这是我们要操作的目标 ★ -->
  <div spin="1">
    <svg id="mermaid-xxx" ...>
      <!-- Mermaid 渲染出的 SVG 图形 -->
    </svg>
  </div>

  <div class="protyle-attr"></div>
</div>
```

**关键选择器**：
- 图表块：`[data-subtype="mermaid"]` / `[data-subtype="graphviz"]` / `[data-subtype="plantuml"]`
- SVG 元素：`[data-subtype="mermaid"] svg`

---

## 七、打包与发布

### 7.1 构建

```bash
pnpm run build
```

这会生成 `package.zip`，其中包含：

```
package.zip
├── index.js
├── index.css
├── icon.png
├── preview.png
├── plugin.json
├── README.md
├── README_zh_CN.md
└── i18n/
    ├── en_US.json
    └── zh_CN.json
```

### 7.2 发布到思源集市

1. **创建 GitHub 仓库**：仓库名必须为 `siyuan-plugin-mermaid-zoom`（与 plugin.json 的 name 一致），默认分支为 `main`

2. **创建 GitHub Release**：
   - Tag 用版本号（如 `v0.1.0`）
   - 将 `package.zip` 作为 Release 附件上传

3. **提交 PR 到集市索引**：
   - Fork [siyuan-note/bazaar](https://github.com/siyuan-note/bazaar)
   - 在 `plugins.json` 中加入 `"你的用户名/siyuan-plugin-mermaid-zoom"`
   - 提交 PR

4. PR 合并后，集市会在约 1 小时内自动索引更新

---

## 八、进阶功能扩展（可选）

### 8.1 右键菜单集成

利用 `click-blockicon` eventBus 事件，在图表块的右键菜单中添加"放大预览"选项：

```typescript
// 在 onload() 中添加
this.eventBus.on("click-blockicon", ({ detail }) => {
  const { menu, blockElements } = detail;
  
  // 判断是否包含图表块
  const chartBlock = blockElements.find((el: HTMLElement) =>
    SUPPORTED_SUBTYPES.includes(el.dataset.subtype || "")
  );
  
  if (chartBlock) {
    menu.addItem({
      icon: "iconMermaidZoom",
      label: this.i18n.openPreview,
      click: () => {
        const svg = chartBlock.querySelector("svg");
        if (svg) openZoomDialog(svg, this.i18n);
      },
    });
  }
});
```

### 8.2 设置面板

允许用户自定义触发方式（双击/单击/按钮）和默认缩放级别：

```typescript
// 在 onload() 中
const selectElement = document.createElement("select");
selectElement.innerHTML = `
  <option value="dblclick">双击打开</option>
  <option value="button">仅按钮</option>
`;

this.setting = new Setting({
  confirmCallback: () => {
    this.saveData("config", { trigger: selectElement.value });
  },
});

this.setting.addItem({
  title: "触发方式",
  description: "选择如何触发图表放大预览",
  actionElement: selectElement,
});
```

### 8.3 触屏支持

为移动端添加双指缩放和触摸拖拽：

```typescript
// 在 zoom-dialog.ts 中添加
container.addEventListener("touchstart", handleTouchStart, { passive: false });
container.addEventListener("touchmove", handleTouchMove, { passive: false });
container.addEventListener("touchend", handleTouchEnd);
```

---

## 九、注意事项与常见问题

### 9.1 开发规范

1. **不要直接操作文件系统** — 如需读写 `data/` 目录下的文件，使用 `/api/file/*` 接口
2. **插件卸载时必须清理** — 在 `onunload()` 中移除所有事件监听器、Observer、DOM 元素
3. **性能** — MutationObserver 的回调可能频繁触发，建议加防抖（debounce）

### 9.2 常见问题

**Q: 为什么放大按钮不出现？**
A: 可能是 Mermaid 块尚未渲染完成。确保 SVG 元素已经存在于 DOM 中。

**Q: 弹窗中 SVG 显示不全？**
A: 检查 SVG 的 `viewBox` 属性是否正确。克隆 SVG 时需要保留 `viewBox`，并移除固定的 `width`/`height`。

**Q: 如何支持更多图表类型？**
A: 在 `SUPPORTED_SUBTYPES` 数组中添加新的 `data-subtype` 值即可。

**Q: 移动端不生效？**
A: 当前 `plugin.json` 的 `frontends` 仅配置了桌面端。如需移动端支持，添加 `"mobile"` 和 `"browser-mobile"`，并实现触摸事件。

---

## 十、参考资源

| 资源 | 链接 |
|------|------|
| 官方插件模板 | https://github.com/siyuan-note/plugin-sample |
| 前端 Plugin API (petal) | https://github.com/siyuan-note/petal |
| 后端 Kernel API | https://github.com/siyuan-note/siyuan/blob/master/API.md |
| 社区文档 | https://docs.siyuan-note.club/ |
| 相关 Issue | https://github.com/siyuan-note/siyuan/issues/12691 |
| 社区 SDK | https://github.com/siyuan-community/siyuan-sdk |

---

## 十一、快速开发清单

- [ ] 1. 创建空目录 `siyuan-plugin-mermaid-zoom`
- [ ] 2. 初始化 `git init && pnpm init`
- [ ] 3. 安装依赖 `pnpm add -D ...`（见第 2.3 节）
- [ ] 4. 创建所有配置文件：`plugin.json`、`tsconfig.json`、`webpack.config.js`、`.gitignore`
- [ ] 5. 创建 `src/i18n/` 下的 i18n 文件
- [ ] 6. 创建 `src/index.scss`
- [ ] 7. 创建 `src/zoom-dialog.ts`
- [ ] 8. 创建 `src/index.ts`
- [ ] 9. 准备 `icon.png`（160x160）和 `preview.png`（1024x768）
- [ ] 10. 创建 `README.md` 和 `README_zh_CN.md` 和 `LICENSE`
- [ ] 11. 将目录放到（或链接到）`{思源工作空间}/data/plugins/` 下
- [ ] 12. 运行 `pnpm run dev`
- [ ] 13. 在思源中启用插件并测试
- [ ] 14. 测试通过后 `pnpm run build` 打包
- [ ] 15. 发布到 GitHub Release 并提交集市 PR
