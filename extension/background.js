"use strict";

// The worker relays layout within the sender's tab and changes its own badge. Messages
// contain layout state and a random activation ID, never page or account data.
const pendingByTab = new Map();

function valid(message, sender) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return false;
  if (Object.keys(message).length !== 3 || message.type !== "vfs:state" || typeof message.expanded !== "boolean") return false;
  if (typeof message.activation !== "string" || (message.expanded ? !/^[a-f0-9]{32}$/.test(message.activation) : message.activation !== "")) return false;
  if (sender.id !== chrome.runtime.id || !Number.isInteger(sender.frameId) || sender.frameId < 0) return false;
  if (!Number.isInteger(sender.tab?.id) || sender.tab.id < 0 || typeof sender.documentId !== "string") return false;
  if (sender.documentLifecycle !== "active") return false;
  try {
    const page = new URL(sender.url);
    if ((page.protocol !== "https:" && page.protocol !== "http:") || page.origin !== sender.origin) return false;
    // Always permit a clear from the same valid document, including after SPA
    // navigation. Private X routes can never activate the browser indicator.
    return !message.expanded || sender.origin !== "https://x.com" || !/^\/(?:i\/(?:chat|calls|flow)|messages|settings|compose|account|login|logout|oauth)(?:\/|$)/.test(page.pathname);
  } catch { return false; }
}

function badge(tabId, expanded, activation = "") {
  // Serialise writes so a slow activation cannot overwrite a later clear.
  const previous = pendingByTab.get(tabId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    await chrome.tabs.sendMessage(tabId, { type: "vfs:relay", expanded, activation }).catch(() => {});
    try {
      await chrome.action.setBadgeText({ tabId, text: expanded ? "FS" : "" });
    } catch (error) {
      if (expanded) {
        await chrome.tabs.sendMessage(tabId, { type: "vfs:relay", expanded: false, activation: "" }).catch(() => {});
        await chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
      }
      throw error;
    }
  });
  pendingByTab.set(tabId, next);
  next.finally(() => { if (pendingByTab.get(tabId) === next) pendingByTab.delete(tabId); }).catch(() => {});
  return next;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!valid(message, sender)) return false;
  badge(sender.tab.id, message.expanded, message.activation).then(() => respond({ ok: true })).catch(() => respond({ ok: false }));
  return true;
});

// Reset on navigation even when pagehide did not run. These events need no
// tabs permission. This code does not read tab URLs or browsing history.
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "loading") badge(tabId, false).catch(() => {});
});
chrome.tabs.onRemoved.addListener(tabId => { pendingByTab.delete(tabId); });
