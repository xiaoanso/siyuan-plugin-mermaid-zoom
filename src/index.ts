import {
  Plugin,
  showMessage,
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
 *     └── div.protyle-icons (工具栏)
 *     └── div[spin="1"] (渲染后的图表容器)
 *         └── svg (Mermaid/Graphviz 渲染出来的 SVG)
 *         └── object[type="image/svg+xml"] (PlantUML 渲染出来的 object)
 */
const CHART_BLOCK_SELECTOR = SUPPORTED_SUBTYPES.map(
  (t) => `.protyle-wysiwyg [data-subtype="${t}"]`
).join(", ");

/**
 * 图表渲染结果的容器选择器
 * 优先查找 div[spin="1"]，如果找不到则在整个块内查找
 */
const RENDER_CONTAINER_SELECTOR = 'div[spin="1"]';

/**
 * 从图表块中查找真正的图表 SVG 或 object（排除工具栏中的图标 SVG）
 * 思源的图表渲染结果在 div[spin="1"] 容器内，
 * Mermaid/Graphviz 返回 <svg>，PlantUML 返回 <object type="image/svg+xml">
 */
function findChartSvg(block: Element): SVGElement | null {
  // 优先从渲染容器 div[spin="1"] 中查找
  const renderContainer = block.querySelector(RENDER_CONTAINER_SELECTOR);
  if (renderContainer) {
    // 查找 SVG
    const svg = renderContainer.querySelector("svg");
    if (svg) return svg;
    // 查找 PlantUML 的 object 标签
    const object = renderContainer.querySelector('object[type="image/svg+xml"]');
    if (object) return null; // object 需要特殊处理，返回 null 交由调用方处理
  }
  // 兜底：遍历所有 SVG，排除 .protyle-action 和 .mermaid-zoom-btn 内的
  const allSvgs = block.querySelectorAll("svg");
  for (const svg of allSvgs) {
    if (!svg.closest(".protyle-action") && !svg.closest(".mermaid-zoom-btn")) {
      return svg;
    }
  }
  return null;
}

/**
 * 从图表块中查找 PlantUML 的 object 标签
 * PlantUML 使用 <object type="image/svg+xml"> 标签嵌入 SVG
 */
function findChartObject(block: Element): HTMLObjectElement | null {
  const renderContainer = block.querySelector(RENDER_CONTAINER_SELECTOR);
  if (renderContainer) {
    const object = renderContainer.querySelector('object[type="image/svg+xml"]');
    if (object) return object as HTMLObjectElement;
  }
  // 兜底
  const objects = block.querySelectorAll('object[type="image/svg+xml"]');
  for (const obj of objects) {
    if (!obj.closest(".protyle-action") && !obj.closest(".mermaid-zoom-btn")) {
      return obj as HTMLObjectElement;
    }
  }
  return null;
}

/**
 * 从 object 标签获取 SVG 元素
 * PlantUML 返回的 data URL 是 SVG XML，需要解析
 */
async function getSvgFromObject(objectEl: HTMLObjectElement): Promise<SVGElement | null> {
  try {
    const dataUrl = objectEl.data;
    if (!dataUrl) return null;

    const response = await fetch(dataUrl, { credentials: 'include' });
    if (!response.ok) return null;

    const svgText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");

    if (svg) {
      // 复制 SVG 并设置尺寸
      const newSvg = svg.cloneNode(true) as SVGElement;
      // 从 object 标签继承尺寸
      if (objectEl.width) newSvg.setAttribute("width", String(objectEl.width));
      if (objectEl.height) newSvg.setAttribute("height", String(objectEl.height));
      return newSvg;
    }
    return null;
  } catch (error) {
    console.error("[mermaid-zoom] Failed to load SVG from object:", error);
    return null;
  }
}

export default class MermaidZoomPlugin extends Plugin {
  private handleDblClick!: (e: MouseEvent) => void;
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  onload() {
    // 注册自定义 SVG 图标
    this.addIcons(`
      <symbol id="iconMermaidZoom" viewBox="0 0 24 24">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
      </symbol>
    `);

    // ---- 方式1: 双击打开预览 ----
    this.handleDblClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 判断双击目标是否在图表渲染区域内
      const chartBlock = target.closest(CHART_BLOCK_SELECTOR);
      if (!chartBlock) return;

      // 排除点击在代码编辑区域上（hljs区域）
      if (target.closest(".hljs") || target.closest(".protyle-action")) return;

      // 先尝试找 SVG
      const svg = findChartSvg(chartBlock);
      if (svg) {
        e.preventDefault();
        e.stopPropagation();
        openZoomDialog(svg, this.i18n);
        return;
      }

      // 再尝试找 PlantUML 的 object 标签
      const objectEl = findChartObject(chartBlock);
      if (objectEl) {
        e.preventDefault();
        e.stopPropagation();
        // 异步加载 SVG
        const loadedSvg = await getSvgFromObject(objectEl);
        if (loadedSvg) {
          openZoomDialog(loadedSvg, this.i18n);
        } else {
          showMessage(this.i18n.loadFailed || "Failed to load diagram");
        }
        return;
      }
    };
    document.addEventListener("dblclick", this.handleDblClick, true);

    // ---- 方式2: 注入放大按钮到图表块 ----
    this.setupObserver();

    // ---- 右键菜单集成 ----
    this.eventBus.on("click-blockicon", async ({ detail }: any) => {
      const { menu, blockElements } = detail;

      // 判断是否包含图表块
      const chartBlock = blockElements.find((el: HTMLElement) =>
        SUPPORTED_SUBTYPES.includes(el.dataset.subtype || "")
      );

      if (chartBlock) {
        menu.addItem({
          icon: "iconMermaidZoom",
          label: this.i18n.openPreview,
          click: async () => {
            const svg = findChartSvg(chartBlock);
            if (svg) {
              openZoomDialog(svg, this.i18n);
              return;
            }
            const objectEl = findChartObject(chartBlock);
            if (objectEl) {
              const loadedSvg = await getSvgFromObject(objectEl);
              if (loadedSvg) {
                openZoomDialog(loadedSvg, this.i18n);
              } else {
                showMessage(this.i18n.loadFailed || "Failed to load diagram");
              }
            }
          },
        });
      }
    });

    // ---- 注册快捷键 ----
    this.addCommand({
      langKey: "openPreview",
      hotkey: "⌥⇧Z",
      editorCallback: async (protyle: any) => {
        // 找到当前聚焦的图表块
        const chartBlocks = protyle.wysiwyg.element.querySelectorAll(
          SUPPORTED_SUBTYPES.map(
            (t) => `[data-subtype="${t}"]`
          ).join(", ")
        );
        
        for (const block of chartBlocks) {
          const svg = findChartSvg(block);
          if (svg) {
            openZoomDialog(svg, this.i18n);
            return;
          }
          const objectEl = findChartObject(block);
          if (objectEl) {
            const loadedSvg = await getSvgFromObject(objectEl);
            if (loadedSvg) {
              openZoomDialog(loadedSvg, this.i18n);
              return;
            }
          }
        }
        showMessage(this.i18n.dblclickTip || "Double-click a diagram to zoom in");
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
    // 清除防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
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

    // 监听 DOM 变化（带防抖）
    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.injectZoomButtons();
      }, 300);
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

      // 确保有渲染出的图表（排除工具栏图标）
      const svg = findChartSvg(block);
      const objectEl = findChartObject(block);
      if (!svg && !objectEl) return;

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

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const currentSvg = findChartSvg(block);
        if (currentSvg) {
          openZoomDialog(currentSvg, this.i18n);
          return;
        }
        
        const currentObject = findChartObject(block);
        if (currentObject) {
          const loadedSvg = await getSvgFromObject(currentObject);
          if (loadedSvg) {
            openZoomDialog(loadedSvg, this.i18n);
          } else {
            showMessage(this.i18n.loadFailed || "Failed to load diagram");
          }
        }
      });

      el.appendChild(btn);
    });
  }
}