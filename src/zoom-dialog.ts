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
  });

  // 如果 Dialog 的 header 存在（SiYuan 的可移动/调整大小 header）
  // 则将标题设置为预览标题，并在右上角插入一个关闭按钮，点击时销毁弹窗
  const headerEl = dialog.element.querySelector('.resize__move.b3-dialog__header') as HTMLElement | null;
  if (headerEl) {
    // 设置标题文本
    headerEl.textContent = i18n.previewTitle || '图表预览';
    // 确保 header 是相对定位以便绝对定位的关闭按钮能放置在右上角
    if (!headerEl.style.position) headerEl.style.position = 'relative';

    const headerClose = document.createElement('button');
    headerClose.className = 'mermaid-zoom-close';
    headerClose.setAttribute('aria-label', i18n.close || 'Close');
    headerClose.title = i18n.close || 'Close';
    // 最小内联样式以保证可见且不依赖外部样式
    headerClose.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:0;padding:6px;cursor:pointer;color:inherit;';
    headerClose.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.41 4.29 19.71 2.88 18.3 9.18 12 2.88 5.71 4.29 4.29 10.59 10.59 16.88 4.29z"/></svg>';
    headerClose.addEventListener('click', (e) => {
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


  // ---- ESC 关闭弹窗 ----
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dialog.destroy();
    }
  };
  document.addEventListener("keydown", handleKeyDown, true);

  // ---- 弹窗销毁时清理 ----
  const originalDestroy = dialog.destroy.bind(dialog);
  dialog.destroy = (options?: any) => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("keydown", handleKeyDown, true);
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
