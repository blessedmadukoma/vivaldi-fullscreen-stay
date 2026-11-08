"use strict";

// The worker can only change this extension's own per-tab badge. Messages
// contain a boolean, never page content, account data or a requested URL.
const pendingByTab = new Map();
const origins = new Set(["https://www.youtube.com", "https://x.com"]);

function valid(message, sender) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return false;
  if (Object.keys(message).length !== 2 || message.type !== "vfs:state" || typeof message.expanded !== "boolean") return false;
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0) return false;
  if (!Number.isInteger(sender.tab?.id) || sender.tab.id < 0 || typeof sender.documentId !== "string") return false;
  if (sender.documentLifecycle !== "active" || !origins.has(sender.origin)) return false;
  try {
    const page = new URL(sender.url);
    if (page.origin !== sender.origin) return false;
    // Always permit a clear from the same valid document, including after SPA
    // navigation. Private X routes can never activate the browser indicator.
    return !message.expanded || sender.origin !== "https://x.com" || !/^\/(?:i\/(?:chat|calls|flow)|messages|settings|compose|account|login|logout|oauth)(?:\/|$)/.test(page.pathname);
  } catch { return false; }
}

function badge(tabId, expanded) {
  // Serialise writes so a slow activation cannot overwrite a later clear.
  const previous = pendingByTab.get(tabId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => chrome.action.setBadgeText({ tabId, text: expanded ? "FS" : "" }));
  pendingByTab.set(tabId, next);
  next.finally(() => { if (pendingByTab.get(tabId) === next) pendingByTab.delete(tabId); }).catch(() => {});
  return next;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!valid(message, sender)) return false;
  badge(sender.tab.id, message.expanded).then(() => respond({ ok: true })).catch(() => respond({ ok: false }));
  return true;
});

// Reset on navigation even when pagehide did not run. These events need no
// tabs permission. This code does not read tab URLs or browsing history.
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "loading") badge(tabId, false).catch(() => {});
});
chrome.tabs.onRemoved.addListener(tabId => { pendingByTab.delete(tabId); });
