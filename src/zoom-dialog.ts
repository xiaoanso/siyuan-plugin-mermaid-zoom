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

  const cleanups: Array<() => void> = [];

  // 创建弹窗（清理走官方 destroyCallback）
  const dialog = new Dialog({
    title: i18n.previewTitle || "Diagram Preview",
    content: `
      <div class="mermaid-zoom-overlay">
        <div class="mermaid-zoom-toolbar">
          <button class="toolbar-btn icon-only" data-action="zoom-in" title="${i18n.zoomIn}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <button class="toolbar-btn icon-only" data-action="zoom-out" title="${i18n.zoomOut}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
          </button>
          <span class="zoom-level">100%</span>
          <button class="toolbar-btn icon-only" data-action="reset" title="${i18n.resetZoom}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          </button>
          <button class="toolbar-btn icon-only" data-action="export-png" title="${i18n.exportPng}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          </button>
        </div>
        <div class="mermaid-zoom-container">
          <div class="mermaid-zoom-svg-wrapper"></div>
        </div>
      </div>
    `,
    width: "90vw",
    height: "85vh",
    destroyCallback: () => {
      cleanups.forEach((fn) => fn());
    },
  });

  // 桌面端官方 .b3-dialog__close 默认隐藏，在表头右上角补关闭按钮（不覆盖 title 文本）
  const headerEl = dialog.element.querySelector(
    ".b3-dialog__header"
  ) as HTMLElement | null;
  if (headerEl) {
    headerEl.classList.add("mermaid-zoom-dialog-header");
    const headerClose = document.createElement("button");
    headerClose.type = "button";
    headerClose.className = "mermaid-zoom-header-close";
    headerClose.title = i18n.close || "Close";
    headerClose.setAttribute("aria-label", i18n.close || "Close");
    headerClose.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    headerClose.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dialog.destroy();
    });
    headerEl.appendChild(headerClose);
  }

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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dialog.destroy();
    }
  };

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

  // 监听 document 级别以处理鼠标移出容器的情况
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  cleanups.push(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  });

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

  // ---- ESC 关闭（挂在 dialog.element，并聚焦以便接收键盘事件）----
  dialog.element.tabIndex = -1;
  dialog.element.addEventListener("keydown", handleKeyDown);
  cleanups.push(() => {
    dialog.element.removeEventListener("keydown", handleKeyDown);
  });
  dialog.element.focus();
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
