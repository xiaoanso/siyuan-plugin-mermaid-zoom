import {
  Plugin,
  showMessage,
  getAllEditor,
  IProtyle,
} from "siyuan";
import "./index.scss";
import { openZoomDialog } from "./zoom-dialog";

/**
 * 支持放大预览的图表类型
 * 思源中的代码块 data-subtype 属性值
 */
const SUPPORTED_SUBTYPES = ["mermaid", "graphviz", "plantuml"];

/**
 * 图表块选择器（用于 closest / 块内匹配，不含 .protyle-wysiwyg 前缀）
 */
const CHART_BLOCK_SELECTOR = SUPPORTED_SUBTYPES.map(
  (t) => `[data-subtype="${t}"]`
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

    const response = await fetch(dataUrl, { credentials: "include" });
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

/**
 * 从图表块打开预览（四条入口共用）
 */
async function openPreviewFromBlock(
  block: Element,
  i18n: Record<string, string>
): Promise<boolean> {
  const svg = findChartSvg(block);
  if (svg) {
    openZoomDialog(svg, i18n);
    return true;
  }

  const objectEl = findChartObject(block);
  if (objectEl) {
    const loadedSvg = await getSvgFromObject(objectEl);
    if (loadedSvg) {
      openZoomDialog(loadedSvg, i18n);
      return true;
    }
    showMessage(i18n.loadFailed || "Failed to load diagram");
    return false;
  }

  return false;
}

/**
 * 查找当前焦点/选中相关的图表块
 */
function findFocusedChartBlock(protyle: IProtyle): Element | null {
  const wysiwyg = protyle.wysiwyg?.element;
  if (!wysiwyg) return null;

  // 1) 多选/框选块
  const selected = wysiwyg.querySelectorAll(".protyle-wysiwyg--select");
  for (const el of Array.from(selected)) {
    if (
      el instanceof HTMLElement &&
      SUPPORTED_SUBTYPES.includes(el.dataset.subtype || "")
    ) {
      return el;
    }
    const nested = el.querySelector(CHART_BLOCK_SELECTOR);
    if (nested) return nested;
  }

  // 2) 光标所在 range
  const range = protyle.toolbar?.range;
  const anchor = range?.startContainer;
  if (anchor) {
    const el =
      anchor.nodeType === Node.TEXT_NODE
        ? (anchor.parentElement as Element | null)
        : (anchor as Element);
    const chart = el?.closest(CHART_BLOCK_SELECTOR);
    if (chart && wysiwyg.contains(chart)) return chart;
  }

  // 3) 当前焦点元素
  const active = document.activeElement;
  if (active && wysiwyg.contains(active)) {
    const chart = active.closest(CHART_BLOCK_SELECTOR);
    if (chart) return chart;
  }

  return null;
}

export default class MermaidZoomPlugin extends Plugin {
  private boundWysiwygs = new WeakSet<HTMLElement>();
  private dblClickHandlers = new WeakMap<HTMLElement, (e: MouseEvent) => void>();
  private injectRetryTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>[]>();

  private handleBlockIcon = ({ detail }: CustomEvent<{
    menu: { addItem: (options: Record<string, unknown>) => void };
    blockElements: HTMLElement[];
  }>) => {
    const { menu, blockElements } = detail;

    const chartBlock = blockElements.find((el) =>
      SUPPORTED_SUBTYPES.includes(el.dataset.subtype || "")
    );

    if (!chartBlock) return;

    menu.addItem({
      icon: "iconMermaidZoom",
      label: this.i18n.openPreview,
      click: async () => {
        await openPreviewFromBlock(chartBlock, this.i18n);
      },
    });
  };

  private handleLoadedProtyle = ({ detail }: CustomEvent<{ protyle: IProtyle }>) => {
    this.bindProtyle(detail.protyle);
  };

  private handleDestroyProtyle = ({ detail }: CustomEvent<{ protyle: IProtyle }>) => {
    this.unbindProtyle(detail.protyle);
  };

  onload() {
    // 注册自定义 SVG 图标
    this.addIcons(`
      <symbol id="iconMermaidZoom" viewBox="0 0 24 24">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
      </symbol>
    `);

    // ---- Protyle 生命周期：注入按钮 + 绑定双击 ----
    this.eventBus.on("loaded-protyle-static", this.handleLoadedProtyle);
    this.eventBus.on("loaded-protyle-dynamic", this.handleLoadedProtyle);
    this.eventBus.on("switch-protyle", this.handleLoadedProtyle);
    this.eventBus.on("destroy-protyle", this.handleDestroyProtyle);

    // 已打开的编辑器
    getAllEditor().forEach((editor) => {
      this.bindProtyle(editor.protyle);
    });

    // ---- 右键菜单集成 ----
    this.eventBus.on("click-blockicon", this.handleBlockIcon);

    // ---- 注册快捷键 ----
    this.addCommand({
      langKey: "openPreview",
      hotkey: "⌥⇧Z",
      editorCallback: async (protyle: IProtyle) => {
        const chartBlock = findFocusedChartBlock(protyle);
        if (!chartBlock) {
          showMessage(this.i18n.dblclickTip || "Double-click a diagram to zoom in");
          return;
        }
        const opened = await openPreviewFromBlock(chartBlock, this.i18n);
        if (!opened) {
          showMessage(this.i18n.dblclickTip || "Double-click a diagram to zoom in");
        }
      },
    });

    console.log(`[mermaid-zoom] Plugin loaded`);
  }

  onunload() {
    this.eventBus.off("loaded-protyle-static", this.handleLoadedProtyle);
    this.eventBus.off("loaded-protyle-dynamic", this.handleLoadedProtyle);
    this.eventBus.off("switch-protyle", this.handleLoadedProtyle);
    this.eventBus.off("destroy-protyle", this.handleDestroyProtyle);
    this.eventBus.off("click-blockicon", this.handleBlockIcon);

    // 解绑已跟踪的 wysiwyg（WeakSet 无法遍历，按当前编辑器清理）
    getAllEditor().forEach((editor) => {
      this.unbindProtyle(editor.protyle);
    });

    // 移除所有已注入的放大按钮
    document.querySelectorAll(".mermaid-zoom-btn").forEach((btn) => btn.remove());

    console.log(`[mermaid-zoom] Plugin unloaded`);
  }

  /**
   * 为指定 Protyle 绑定双击并注入放大按钮
   */
  private bindProtyle(protyle: IProtyle) {
    const wysiwyg = protyle.wysiwyg?.element;
    if (!wysiwyg) return;

    if (!this.boundWysiwygs.has(wysiwyg)) {
      const handler = (e: MouseEvent) => {
        void this.onWysiwygDblClick(e);
      };
      this.dblClickHandlers.set(wysiwyg, handler);
      wysiwyg.addEventListener("dblclick", handler, true);
      this.boundWysiwygs.add(wysiwyg);
    }

    this.injectZoomButtons(wysiwyg);
    // 图表可能异步渲染，短暂重试以免漏注入
    this.scheduleInjectRetries(wysiwyg);
  }

  private unbindProtyle(protyle: IProtyle) {
    const wysiwyg = protyle.wysiwyg?.element;
    if (!wysiwyg) return;

    const handler = this.dblClickHandlers.get(wysiwyg);
    if (handler) {
      wysiwyg.removeEventListener("dblclick", handler, true);
      this.dblClickHandlers.delete(wysiwyg);
    }

    const timers = this.injectRetryTimers.get(wysiwyg);
    if (timers) {
      timers.forEach(clearTimeout);
      this.injectRetryTimers.delete(wysiwyg);
    }

    wysiwyg.querySelectorAll(".mermaid-zoom-btn").forEach((btn) => btn.remove());
  }

  private scheduleInjectRetries(wysiwyg: HTMLElement) {
    const existing = this.injectRetryTimers.get(wysiwyg);
    if (existing) {
      existing.forEach(clearTimeout);
    }
    const timers = [400, 1200].map((ms) =>
      setTimeout(() => this.injectZoomButtons(wysiwyg), ms)
    );
    this.injectRetryTimers.set(wysiwyg, timers);
  }

  private async onWysiwygDblClick(e: MouseEvent) {
    const target = e.target as HTMLElement;

    const chartBlock = target.closest(CHART_BLOCK_SELECTOR);
    if (!chartBlock) return;

    // 排除点击在代码编辑区域上（hljs区域）
    if (target.closest(".hljs") || target.closest(".protyle-action")) return;

    const hasChart = findChartSvg(chartBlock) || findChartObject(chartBlock);
    if (!hasChart) return;

    e.preventDefault();
    e.stopPropagation();
    await openPreviewFromBlock(chartBlock, this.i18n);
  }

  /**
   * 为根节点下的图表块注入放大按钮
   */
  private injectZoomButtons(root: ParentNode) {
    const blocks = root.querySelectorAll(CHART_BLOCK_SELECTOR);
    blocks.forEach((block) => {
      // 避免重复注入
      if (block.querySelector(".mermaid-zoom-btn")) return;

      // 确保有渲染出的图表（排除工具栏图标）
      const svg = findChartSvg(block);
      const objectEl = findChartObject(block);
      if (!svg && !objectEl) return;

      // 创建放大按钮（定位由 CSS position: relative 承担）
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
        await openPreviewFromBlock(block, this.i18n);
      });

      block.appendChild(btn);
    });
  }
}
