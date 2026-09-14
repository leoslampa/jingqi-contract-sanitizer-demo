// PDF.js and its worker/assets are served with the app; document bytes stay local.
import * as pdfjs from "./vendor/pdfjs/pdf.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.loader.mjs", import.meta.url).href;

export const PDF_SCOPE_NOTICE = "PDF 实验导入：本稿仅包含可提取文字的脱敏结果，不代表原 PDF 已脱敏或全文完整。图片、扫描内容、印章、批注、附件及元数据不纳入输出；隐藏文字层可能与画面不一致，表格与阅读顺序可能变化，请按页码对照原件。";

export function textFromItems(items) {
  let text = "";
  let previous = null;
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    const height = Math.max(Math.abs(item.height || 0), 1);
    const newLine = previous && Math.abs(item.transform[5] - previous.transform[5]) > Math.max(height, Math.abs(previous.height || 0)) * 0.5;
    if (newLine && !text.endsWith("\n")) text += "\n";
    if (previous && !newLine && !/\s$/.test(text) && !/^\s/.test(item.str)) {
      const gap = item.transform[4] - (previous.transform[4] + previous.width);
      const latinWords = /[A-Za-z0-9]$/.test(previous.str) && /^[A-Za-z0-9]/.test(item.str);
      if (gap > height * 0.25 || (latinWords && gap > height * 0.08)) text += " ";
    }
    text += item.str;
    if (item.hasEOL) text += "\n";
    previous = item;
  }
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function parsePdf(arrayBuffer, onProgress = () => {}, signal) {
  if (signal?.aborted) throw new DOMException("导入已取消", "AbortError");
  if (typeof DecompressionStream === "undefined") throw new Error("当前浏览器不支持本地 PDF 组件加载，请更新 Chrome、Edge 或 Safari 后再试。");
  if (arrayBuffer.byteLength > 30 * 1024 * 1024) throw new Error("PDF 实验导入暂限 30 MB。");
  // Own the native worker so a stalled startup/handshake can also be terminated.
  // PDFDocumentLoadingTask.destroy() alone may wait for that handshake forever.
  const worker = new Worker(pdfjs.GlobalWorkerOptions.workerSrc, { type: "module" });
  let task, pdfWorker, timer, onReady, rejectInterruption;
  let stopped = false;
  const ready = new Promise((resolve) => {
    onReady = ({ data }) => {
      if (data?.sourceName === "worker" && data?.targetName === "main" && data?.action === "ready") resolve();
    };
    worker.addEventListener("message", onReady);
  });
  const interruption = new Promise((_, reject) => { rejectInterruption = reject; });
  const stop = (error) => {
    stopped = true;
    worker.terminate();
    rejectInterruption(error);
  };
  const cancel = () => stop(new DOMException("导入已取消", "AbortError"));
  const failed = (event) => {
    event.preventDefault();
    stop(new Error("PDF 本地解析组件无法运行，请刷新页面后重试。"));
  };
  signal?.addEventListener("abort", cancel, { once: true });
  worker.addEventListener("error", failed);
  timer = setTimeout(() => stop(new Error("PDF 读取超时，已停止处理，请分段处理或改用 DOCX。")), 60000);
  try {
    return await Promise.race([
      (async () => {
        await ready;
        if (stopped) throw new DOMException("导入已取消", "AbortError");
        pdfWorker = new pdfjs.PDFWorker({ port: worker });
        task = pdfjs.getDocument({
          worker: pdfWorker,
          data: new Uint8Array(arrayBuffer),
          cMapUrl: new URL("./vendor/pdfjs/cmaps/", import.meta.url).href,
          cMapPacked: true,
          standardFontDataUrl: new URL("./vendor/pdfjs/standard_fonts/", import.meta.url).href,
          isEvalSupported: false,
          useWasm: false,
          stopAtErrors: true,
          verbosity: 0,
        });
        const pdf = await task.promise;
        if (pdf.numPages > 200) throw new Error("PDF 实验导入暂限 200 页，请分段处理。");
        const pages = [];
        const emptyPages = [];
        const sparsePages = [];
        let characters = 0;
        for (let number = 1; number <= pdf.numPages; number += 1) {
          onProgress(number, pdf.numPages);
          const page = await pdf.getPage(number);
          const content = await page.getTextContent();
          const text = textFromItems(content.items);
          const count = text.replace(/\s/g, "").length;
          characters += count;
          if (!count) emptyPages.push(number);
          else if (count < 30) sparsePages.push(number);
          if (text.includes("\uFFFD") || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
            throw new Error(`第 ${number} 页出现无法可靠解码的文字，已停止导入。请改用 DOCX 或经人工校对的文字稿。`);
          }
          if (characters > 1000000) throw new Error("PDF 提取文字过多，请分段处理。");
          pages.push(`## PDF 第 ${number} 页\n\n${text || "【此页未提取到文字，请对照原件补充；可能是扫描页、图片页或空白页。】"}`);
          page.cleanup();
        }
        if (!characters) throw new Error("整份 PDF 未提取到可读取文字，可能是扫描件或图片文件。当前不支持扫描文字识别，请先转换并校对文字，或提供 DOCX。");
        const warnings = [PDF_SCOPE_NOTICE, `共 ${pdf.numPages} 页，其中 ${pdf.numPages - emptyPages.length} 页提取到文字；提取到文字不代表该页内容完整。`];
        if (emptyPages.length) warnings.push(`第 ${emptyPages.join("、")} 页没有提取到文字，已在稿内标记，请勿将缺失内容理解为原文未载明。`);
        if (sparsePages.length) warnings.push(`第 ${sparsePages.join("、")} 页提取文字很少，可能仅有页码或标题，请检查扫描内容是否遗漏。`);
        return { markdown: pages.join("\n\n"), warnings };
      })(),
      interruption,
    ]);
  } catch (error) {
    if (error.name === "PasswordException") throw new Error("PDF 已加密，当前无法读取。请在有权访问的情况下，使用可正常打开的未加密副本。");
    if (["InvalidPDFException", "UnknownErrorException", "FormatError"].includes(error.name)) throw new Error("PDF 无法完整解析，已停止导入。请检查文件是否损坏，或改用 DOCX。");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    worker.removeEventListener("message", onReady);
    worker.removeEventListener("error", failed);
    // Give responsive workers a brief graceful cleanup; never block cancellation
    // on a malformed document or a worker that no longer answers Terminate.
    let cleanupTimer;
    if (task) {
      await Promise.race([
        task.destroy().catch(() => {}),
        new Promise((resolve) => { cleanupTimer = setTimeout(resolve, 250); }),
      ]);
    }
    clearTimeout(cleanupTimer);
    pdfWorker?.destroy();
    worker.terminate();
  }
}
