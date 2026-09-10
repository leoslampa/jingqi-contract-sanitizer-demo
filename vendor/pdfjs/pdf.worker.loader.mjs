// Loads the unchanged, gzip-packed PDF.js 6.3.289 worker locally.
// PDF.js license: Apache-2.0; see LICENSE in this directory.
const parts = await Promise.all(["00", "01", "02", "03"].map(async (part) => {
  const response = await fetch(new URL(`./pdf.worker.part-${part}`, import.meta.url));
  if (!response.ok) throw new Error("PDF 组件加载失败，请刷新页面后重试。");
  return response.arrayBuffer();
}));
const source = await new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
let WorkerMessageHandler;
try {
  ({ WorkerMessageHandler } = await import(moduleUrl));
} finally {
  URL.revokeObjectURL(moduleUrl);
}
export { WorkerMessageHandler };
