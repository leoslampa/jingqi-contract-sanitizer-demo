import { IMPORT_LIMITS as limits } from './docx-reader.mjs';

const invalid = () => new Error('DOCX 压缩结构异常，已停止导入，请重新另存为 DOCX。');
const overLimit = () => new Error('DOCX 解压内容超过安全上限，请拆分文件后重试。');

async function expand(bytes, method, maxBytes) {
  if (method === 0) {
    if (bytes.length > maxBytes) throw overLimit();
    return bytes;
  }
  if (method !== 8) throw invalid();
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) {
        await reader.cancel();
        throw overLimit();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function unzip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 22 || bytes.length > limits.inputBytes) throw invalid();
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw invalid();
  const count = view.getUint16(end + 10, true);
  if (count > limits.entries) throw new Error('DOCX 内部文件过多，请拆分文件。');
  if (count !== view.getUint16(end + 8, true)) throw invalid();
  let offset = view.getUint32(end + 16, true);
  const directoryEnd = offset + view.getUint32(end + 12, true);
  if (directoryEnd !== end) throw invalid();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const output = [];
  const names = new Set();
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > directoryEnd || view.getUint32(offset, true) !== 0x02014b50) throw invalid();
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const declared = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const next = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    if (!nameLength || nameLength > 512 || next > directoryEnd || local + 30 > view.getUint32(end + 16, true)) throw invalid();
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (names.has(name)) throw invalid();
    names.add(name);
    offset = next;
    const needed = name === 'word/document.xml' || /^word\/(?:header|footer)\d+\.xml$/.test(name);
    if (!needed) {
      // Record presence for existing warnings without allocating or decoding the content.
      if (name.startsWith('word/media/') || name.startsWith('word/embeddings/') || name === 'word/comments.xml') output.push([name, '']);
      continue;
    }
    if (flags & 1 || view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method) throw invalid();
    const localNameLength = view.getUint16(local + 26, true);
    const start = local + 30 + localNameLength + view.getUint16(local + 28, true);
    if (start + compressed > view.getUint32(end + 16, true) || decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) throw invalid();
    const cap = Math.min(limits.partBytes, limits.totalBytes - total);
    if (declared > cap) throw overLimit();
    const raw = await expand(bytes.subarray(start, start + compressed), method, cap);
    if (raw.length !== declared) throw invalid();
    total += raw.length;
    output.push([name, decoder.decode(raw)]);
  }
  if (offset !== directoryEnd) throw invalid();
  return output;
}

self.onmessage = async ({ data }) => {
  try { self.postMessage({ entries: await unzip(data) }); }
  catch (error) { self.postMessage({ error: error.message || 'DOCX 无法解析，已停止导入。' }); }
};
