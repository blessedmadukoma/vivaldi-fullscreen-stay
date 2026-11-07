(() => {
  "use strict";
  const ROOT = "data-vfs-active";
  const PLAYER = "data-vfs-player";
  const TITLE_PREFIX = "⛶ YouTube • ";
  const swallowed = new Set();
  let saved = null;

  function editing(target) {
    return target instanceof Element && Boolean(target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
    ));
  }

  function exit() {
    if (!saved) return;
    const old = saved;
    saved = null;
    old.observer.disconnect();
    if (old.player.matches(":popover-open")) old.player.hidePopover();
    if (old.popover === null) old.player.removeAttribute("popover");
    else old.player.setAttribute("popover", old.popover);
    document.documentElement.removeAttribute(ROOT);
    old.player.removeAttribute(PLAYER);
    if (document.title.startsWith(TITLE_PREFIX)) document.title = document.title.slice(TITLE_PREFIX.length);
    if (old.button?.isConnected) {
      for (const [name, value] of old.buttonAttributes) {
        if (value === null) old.button.removeAttribute(name);
        else old.button.setAttribute(name, value);
      }
    }
    window.scrollTo(old.scrollX, old.scrollY);
  }

  function enter() {
    const player = document.querySelector("#movie_player");
    if (!player || !player.querySelector("video") || document.fullscreenElement) return false;
    if (typeof player.showPopover !== "function" || player.matches(":popover-open")) return false;
    const button = player.querySelector(".ytp-fullscreen-button");
    const observer = new MutationObserver(() => {
      if (!player.isConnected) exit();
      else if (!document.title.startsWith(TITLE_PREFIX)) document.title = TITLE_PREFIX + document.title;
    });
    saved = {
      player, button, observer, popover: player.getAttribute("popover"),
      scrollX: window.scrollX, scrollY: window.scrollY,
      buttonAttributes: ["aria-label", "title", "data-title-no-tooltip"].map(name => [name, button?.getAttribute(name) ?? null])
    };
    player.setAttribute(PLAYER, "");
    document.documentElement.setAttribute(ROOT, "");
    player.setAttribute("popover", "manual");
    try {
      player.showPopover();
    } catch {
      exit();
      return false;
    }
    document.title = TITLE_PREFIX + document.title;
    if (button) {
      button.setAttribute("aria-label", "Exit video fullscreen (f)");
      button.setAttribute("title", "Exit video fullscreen (f)");
      button.setAttribute("data-title-no-tooltip", "Exit video fullscreen");
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return true;
  }

  function toggle() {
    if (saved) { exit(); return true; }
    return enter();
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (event.repeat && swallowed.has(key)) {
      consume(event);
      return;
    }
    if (key === "escape" && saved) {
      swallowed.add(key);
      consume(event);
      if (!event.repeat) exit();
      return;
    }
    if (key === "t" && saved && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !editing(event.target)) {
      // Let YouTube receive the original trusted event after restoring its layout.
      if (!event.repeat) exit();
      return;
    }
    if (key !== "f" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editing(event.target)) return;
    if (event.repeat) {
      if (swallowed.has(key)) consume(event);
      return;
    }
    if (toggle()) {
      swallowed.add(key);
      consume(event);
    }
  }, true);

  window.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();
    if (swallowed.delete(key)) consume(event);
  }, true);

  window.addEventListener("click", event => {
    if (event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (saved && event.target instanceof Element && event.target.closest("#movie_player .ytp-size-button")) {
      exit();
      return;
    }
    if (!(event.target instanceof Element) || !event.target.closest("#movie_player .ytp-fullscreen-button")) return;
    if (toggle()) consume(event);
  }, true);

  window.addEventListener("dblclick", event => {
    if (event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof Element) || !event.target.matches("#movie_player video, #movie_player .html5-video-container")) return;
    if (toggle()) consume(event);
  }, true);

  window.addEventListener("blur", () => swallowed.clear());
  window.addEventListener("pagehide", exit);
  window.addEventListener("yt-navigate-start", exit, true);
})();
