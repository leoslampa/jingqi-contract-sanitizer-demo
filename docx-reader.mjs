// Shared limits and a cancellable worker facade; importing this module starts no work.
export const IMPORT_LIMITS = Object.freeze({
  inputBytes: 10 * 1024 * 1024,
  partBytes: 2 * 1024 * 1024,
  totalBytes: 8 * 1024 * 1024,
  entries: 1024,
  textCharacters: 200000,
  timeoutMs: 15000,
});

export function readDocxEntries(buffer, signal) {
  if (buffer.byteLength > IMPORT_LIMITS.inputBytes) return Promise.reject(new Error('DOCX 暂限 10 MB，请分段处理。'));
  if (signal?.aborted) return Promise.reject(new DOMException('导入已取消', 'AbortError'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./docx-worker.mjs', import.meta.url), { type: 'module' });
    let finished = false;
    const finish = (error, entries) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      worker.terminate();
      if (error) reject(error);
      else resolve(new Map(entries));
    };
    const cancel = () => finish(new DOMException('导入已取消', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('DOCX 读取超时，已停止处理，请拆分文件。')), IMPORT_LIMITS.timeoutMs);
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.entries);
    worker.onerror = (event) => {
      event.preventDefault();
      finish(new Error('DOCX 本地解析组件无法运行，请刷新页面或更新浏览器。'));
    };
    try { worker.postMessage(buffer, [buffer]); } catch (error) { finish(error); }
  });
}
