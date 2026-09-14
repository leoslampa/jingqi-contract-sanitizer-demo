"use strict";

function createSummaryHistory(categories) {
  const key = "jingqi.summary-history.v1";
  const lifetime = 30 * 24 * 60 * 60 * 1000;
  const checkbox = document.getElementById("persistHistory");
  const list = document.getElementById("historyList");
  const status = document.getElementById("historyStatus");
  let enabled = false;
  let records = [];

  // Only fixed category keys and numeric totals cross the persistence boundary.
  function clean(input) {
    if (!Array.isArray(input)) return [];
    const now = Date.now();
    const seen = new Set();
    return input.filter((item) => item && /^JQ-[a-f0-9-]{36}$/.test(item.id)
      && Number.isFinite(item.createdAt) && item.createdAt > now - lifetime && item.createdAt <= now
      && /^\d{4}\.\d{2}\.\d{2}\.\d+\+[a-f0-9]{10}$/.test(item.version)
      && Array.isArray(item.counts))
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((item) => !seen.has(item.id) && seen.add(item.id)).slice(0, 100)
      .map((item) => ({
        id: item.id, createdAt: item.createdAt, version: item.version,
        counts: Object.keys(categories).flatMap((category) => {
          const count = item.counts.find((entry) => entry && entry.category === category);
          return count && Number.isSafeInteger(count.replaced) && count.replaced >= 0
            && Number.isSafeInteger(count.kept) && count.kept >= 0
            ? [{ category, replaced: count.replaced, kept: count.kept }] : [];
        }),
      }));
  }

  function readSaved() {
    const raw = localStorage.getItem(key);
    if (raw === null) return { enabled: false, records: [] };
    let saved;
    try { saved = JSON.parse(raw); } catch { saved = null; }
    if (!saved || saved.enabled !== true || !Array.isArray(saved.records)) {
      localStorage.removeItem(key);
      status.textContent = "无法读取原有摘要，已清除无效记录；可以继续处理文档。";
      return { enabled: false, records: [] };
    }
    const safe = { enabled: true, records: clean(saved.records) };
    if (JSON.stringify(saved) !== JSON.stringify(safe)) localStorage.setItem(key, JSON.stringify(safe));
    return safe;
  }

  function sync() {
    try {
      const saved = readSaved();
      if (saved.enabled || enabled) records = saved.records;
      enabled = saved.enabled;
    } catch {
      status.textContent = "浏览器存储不可用，无法核验或更新已保存的摘要。当前操作不会上传文件；可在浏览器设置中清除此站点数据。";
    }
    records = clean(records);
  }

  function save(next) {
    if (enabled) localStorage.setItem(key, JSON.stringify({ enabled: true, records: next }));
    records = next;
  }

  function node(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function render() {
    checkbox.checked = enabled;
    document.getElementById("historyCount").textContent = `${records.length} 条 · ${enabled ? "本机保存" : "本次打开"}`;
    document.getElementById("historyEmpty").hidden = records.length > 0;
    document.getElementById("clearHistoryButton").disabled = records.length === 0;
    list.replaceChildren();
    for (const item of records) {
      const row = node("li", "", "history-row");
      const content = node("div", "", "history-content");
      const time = new Date(item.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
      content.append(node("strong", `${time}（UTC+8）`));
      const replaced = item.counts.reduce((total, count) => total + count.replaced, 0);
      const kept = item.counts.reduce((total, count) => total + count.kept, 0);
      content.append(node("p", `替换 ${replaced} 处 · 保留 ${kept} 处`, "history-totals"));
      content.append(node("p", "点击完成复核 · 已生成导出内容", "history-meta"));
      const detail = node("details", "");
      detail.append(node("summary", "查看摘要明细"));
      detail.append(node("p", `任务编号：${item.id}`, "history-meta"));
      detail.append(node("p", `工具版本：${item.version}`, "history-meta"));
      const counts = node("ul", "");
      item.counts.forEach((count) => counts.append(node("li", `${categories[count.category].label}：替换 ${count.replaced} 处，保留 ${count.kept} 处`)));
      if (!item.counts.length) counts.append(node("li", "未发现候选信息，仍需人工检查。"));
      detail.append(counts);
      content.append(detail);
      const remove = node("button", "删除", "quiet-button");
      remove.type = "button";
      remove.setAttribute("aria-label", `删除摘要 ${item.id}`);
      remove.addEventListener("click", () => {
        sync();
        try {
          save(records.filter((entry) => entry.id !== item.id));
          status.textContent = "已删除这条摘要。";
        } catch { status.textContent = "删除失败，已保存的摘要可能仍在；请重试或在浏览器设置中清除此站点数据。"; }
        render();
      });
      row.append(content, remove);
      list.append(row);
    }
  }

  checkbox.addEventListener("change", () => {
    const requested = checkbox.checked;
    sync();
    try {
      if (requested) localStorage.setItem(key, JSON.stringify({ enabled: true, records }));
      else localStorage.removeItem(key);
      enabled = requested;
      if (!enabled) records = [];
      status.textContent = enabled ? "已开启：当前及后续摘要只保存在此浏览器。" : "已关闭保存，并清除全部摘要历史。";
    } catch { status.textContent = "保存设置失败，原设置未更改；请检查浏览器存储权限或可用空间。"; }
    render();
  });

  document.getElementById("clearHistoryButton").addEventListener("click", () => {
    sync();
    try {
      save([]);
      status.textContent = "已清空摘要历史，当前文档内容不受影响。";
    } catch { status.textContent = "清空失败，已保存的摘要可能仍在；请重试或在浏览器设置中清除此站点数据。"; }
    render();
  });

  const refresh = () => { sync(); render(); };
  window.addEventListener("storage", (event) => { if (event.key === key || event.key === null) refresh(); });
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  document.getElementById("summaryHistory").addEventListener("toggle", refresh);
  setInterval(refresh, 60000);
  refresh();

  return {
    record(matches) {
      sync();
      const grouped = Object.keys(categories).flatMap((category) => {
        const items = matches.filter((match) => match.category === category);
        return items.length ? [{ category, replaced: items.filter((match) => match.selected).length,
          kept: items.filter((match) => !match.selected).length }] : [];
      });
      // Random IDs do not fingerprint a contract or encode its filename.
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
      const id = `JQ-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      const item = { id, createdAt: Date.now(),
        version: document.querySelector(".product-version strong").textContent.trim(), counts: grouped };
      try {
        save(clean([item, ...records]));
        status.textContent = enabled ? "本次摘要已保存在此浏览器。" : "本次摘要已生成，仅本次打开可见。";
      } catch {
        status.textContent = "本次摘要保存失败，导出不受影响；可下载脱敏报告自行保留。";
      }
      render();
      return item;
    },
  };
}
