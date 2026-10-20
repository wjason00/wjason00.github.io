/*
 * Portfolio behaviour. Deferred, dependency-free, and strictly an enhancement:
 * with scripting off the page still reads, the videos keep native controls and
 * the demo remains available through a normal full-page link.
 *
 * theme.js has already run synchronously in <head>; it applied any stored theme
 * and added the `js` class. This file owns everything that can wait.
 */

const root = document.documentElement;
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

/* ----------------------------------------------------------------- theme -- */

const themeToggle = document.querySelector(".theme-toggle");

function resolvedTheme() {
  return root.dataset.theme || (darkQuery.matches ? "dark" : "light");
}

/* The document ships two media-scoped theme-color metas, which are correct
   while the visitor is following their system. An explicit choice has to
   override both, so they collapse into one unscoped meta. */
function setThemeColor() {
  const colour = getComputedStyle(root).getPropertyValue("--paper").trim();
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (!metas.length) return;

  metas.forEach((meta, index) => {
    if (index === 0) {
      meta.removeAttribute("media");
      meta.content = colour;
    } else {
      meta.remove();
    }
  });
}

function describeToggle(theme) {
  if (!themeToggle) return;
  const next = theme === "dark" ? "light" : "dark";
  themeToggle.setAttribute(
    "aria-label",
    `Switch to ${next} colour theme (currently ${theme})`,
  );
  themeToggle.setAttribute("title", `Switch to ${next} theme`);
}

function applyTheme(theme, persist) {
  root.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem("portfolio-theme", theme);
    } catch (error) {
      /* Private mode or blocked storage: the choice just will not survive. */
    }
  }
  setThemeColor(theme);
  describeToggle(theme);
}

describeToggle(resolvedTheme());
setThemeColor();

themeToggle?.addEventListener("click", () => {
  applyTheme(resolvedTheme() === "dark" ? "light" : "dark", true);
});

/* Follow the system while the visitor has not made an explicit choice. */
darkQuery.addEventListener("change", () => {
  if (!root.dataset.theme) {
    describeToggle(resolvedTheme());
    setThemeColor();
  }
});

/* Saved-image comparison, operable with touch, pointer or arrow keys. */
document.querySelectorAll(".comparison").forEach((comparison) => {
  const range = comparison.querySelector("input");
  if (!range) return;
  const update = () => {
    comparison.style.setProperty("--position", `${range.value}%`);
    range.setAttribute(
      "aria-valuetext",
      `${range.value}% concentration view, ${100 - Number(range.value)}% positional readout`,
    );
  };
  range.addEventListener("input", update);
  update();
});

/* Load only recordings the visitor has chosen; never autoplay them. */
function prepareVideo(video) {
  if (!video || video.dataset.prepared) return;
  video.dataset.prepared = "true";
  video.preload = "metadata";
  video.load();
}

const gallery = document.querySelector(".gallery");
const projectTabs = [...document.querySelectorAll(".gallery-tab")];
const panels = [...document.querySelectorAll(".gallery-panel")];
function selectProject(name, focus = false) {
  const selected = projectTabs.find((tab) => tab.dataset.project === name);
  if (!selected) return;
  projectTabs.forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab === selected));
    tab.tabIndex = tab === selected ? 0 : -1;
  });
  panels.forEach((panel) => {
    panel.hidden = panel.id !== `preview-${name}`;
    panel.querySelectorAll("video").forEach((video) => {
      if (panel.hidden) video.pause();
      else if (!video.closest("[hidden]")) prepareVideo(video);
    });
  });
  if (focus) selected.focus();
}

if (gallery && projectTabs.length) {
  gallery.classList.add("is-enhanced");
  gallery.querySelector(".gallery-tabs").setAttribute("role", "tablist");
  projectTabs.forEach((tab, index) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `preview-${tab.dataset.project}`);
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      selectProject(tab.dataset.project);
      history.replaceState(null, "", tab.hash);
    });
    tab.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === " ") {
        event.preventDefault();
        selectProject(tab.dataset.project);
        history.replaceState(null, "", tab.hash);
        return;
      }
      const next =
        event.key === "ArrowRight"
          ? (index + 1) % projectTabs.length
          : event.key === "ArrowLeft"
            ? (index + projectTabs.length - 1) % projectTabs.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? projectTabs.length - 1
                : null;
      if (next === null) return;
      event.preventDefault();
      selectProject(projectTabs[next].dataset.project, true);
      history.replaceState(null, "", projectTabs[next].hash);
    });
  });
  panels.forEach((panel) => {
    panel.setAttribute("role", "tabpanel");
    panel.tabIndex = 0;
  });
}

/* Each showcase stays where the visitor opened it. The demo and editor are
   two views of the Trainer project; the product render is a separate scene. */
document.querySelectorAll("[data-morphliner-showcase]").forEach((showcase) => {
  const views = [...showcase.querySelectorAll("[data-morphliner-panel]")];
  const buttons = [...showcase.querySelectorAll("[data-morphliner-view]")];
  function selectView(mode, prepare = true) {
    views.forEach((view) => {
      view.hidden = view.dataset.morphlinerPanel !== mode;
      view.querySelectorAll("video").forEach((video) => {
        if (view.hidden) video.pause();
        else if (prepare) prepareVideo(video);
      });
    });
    buttons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.morphlinerView === mode)),
    );
  }
  buttons.forEach((button) => button.addEventListener("click", () => selectView(button.dataset.morphlinerView)));
  selectView("recording", false);
});

function selectFromHash() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); }
  catch { return; }
  const target = document.getElementById(id);
  const panel = target?.closest(".gallery-panel");
  const name = panel ? panel.id.replace(/^preview-/, "") : id.replace(/^preview-/, "");
  if (projectTabs.some((tab) => tab.dataset.project === name))
    selectProject(name);
  if (target && panel) {
    for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    }
    if (target instanceof HTMLDetailsElement) target.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }
}
if (gallery) {
  selectProject("morphbrain");
  selectFromHash();
  window.addEventListener("hashchange", selectFromHash);
}

/* The real model is a separate runtime, mounted only during an explicit visit. */
const demoDialog = document.querySelector(".demo-dialog");
let demoOpener;
if (demoDialog && typeof demoDialog.showModal === "function") {
  const mount = demoDialog.querySelector(".demo-dialog__mount");
  const status = demoDialog.querySelector(".demo-dialog__status");
  const message = status.querySelector("[data-demo-message]");
  const recovery = status.querySelector("[data-demo-recovery]");
  let currentURL;
  let timeout;
  let readinessObserver;
  function releaseReadiness() {
    clearTimeout(timeout);
    readinessObserver?.disconnect();
    readinessObserver = null;
  }
  function showRecovery() {
    status.hidden = false;
    message.textContent = "The model interface is taking longer to load. Retry or open it full page.";
    recovery.hidden = false;
    status.dataset.state = "slow";
  }
  function mountModel() {
    releaseReadiness();
    status.hidden = false;
    status.dataset.state = "loading";
    message.textContent = "Loading the model interface…";
    recovery.hidden = true;
    recovery.querySelector("a").href = currentURL;
    const iframe = document.createElement("iframe");
    iframe.title = "MorphBrain interactive illustrative model";
    iframe.src = currentURL;
    iframe.addEventListener("error", () => {
      if (demoDialog.open && mount.firstElementChild === iframe) showRecovery();
    });
    iframe.addEventListener("load", () => {
      if (!demoDialog.open || mount.firstElementChild !== iframe) return;
      try {
        const child = iframe.contentDocument;
        child?.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && demoDialog.open) {
            event.preventDefault();
            demoDialog.close();
          }
        }, { capture: true });
        const app = child?.getElementById("root");
        // The frame's load event can precede the React interface, or occur even
        // when a bundle failed. A rendered interface is the readiness signal.
        function checkReady() {
          if (!app?.childElementCount || !app.textContent.trim()) return;
          releaseReadiness();
          status.dataset.state = "ready";
          status.hidden = true;
        }
        if (app) {
          readinessObserver = new MutationObserver(checkReady);
          readinessObserver.observe(app, { childList: true, subtree: true });
          checkReady();
        }
      } catch {
        showRecovery();
      }
    });
    timeout = setTimeout(showRecovery, 15_000);
    mount.replaceChildren(iframe);
  }
  document.querySelectorAll("[data-launch-demo]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || link.origin !== location.origin)
        return;
      event.preventDefault();
      document.querySelectorAll("video").forEach((video) => video.pause());
      demoOpener = link;
      currentURL = link.href;
      demoDialog.showModal();
      document.body.classList.add("demo-is-open");
      mountModel();
    });
  });
  demoDialog
    .querySelector(".demo-close")
    .addEventListener("click", () => demoDialog.close());
  demoDialog.querySelector(".demo-retry").addEventListener("click", mountModel);
  demoDialog.addEventListener("close", () => {
    releaseReadiness();
    mount.replaceChildren();
    status.hidden = true;
    document.body.classList.remove("demo-is-open");
    demoOpener?.focus();
  });
}

/* ------------------------------------------------------- video enhancement -- */

function formatTime(value) {
  if (!Number.isFinite(value)) return "0:00";
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

document.querySelectorAll(".video-demo").forEach((demo) => {
  const video = demo.querySelector("video");
  const playButton = demo.querySelector(".video-play");
  const range = demo.querySelector(".video-range");
  const output = demo.querySelector(".video-time");
  const recordingLabel = demo.dataset.recordingLabel || "recorded result";
  if (!video || !playButton || !range || !output) return;

  const placeholderTime = output.textContent;
  const chapters = [...demo.querySelectorAll("[data-video-seek]")];
  let startButton;
  if (demo.classList.contains("morphliner-demo")) {
    startButton = document.createElement("button");
    startButton.type = "button";
    startButton.className = "video-start";
    startButton.textContent = "▶ Watch demo";
    startButton.setAttribute("aria-label", `Watch ${recordingLabel}`);
    startButton.addEventListener("click", () => {
      if (video.ended) video.currentTime = 0;
      video.play().catch(() => updateVideoControls());
      playButton.focus({ preventScroll: true });
    });
    demo.querySelector(".video-stage").append(startButton);
  }
  chapters.forEach((chapter) => chapter.addEventListener("click", () => {
    const seek = () => {
      video.pause();
      video.currentTime = Number(chapter.dataset.videoSeek);
    };
    if (video.readyState >= 1) seek();
    else {
      video.addEventListener("loadedmetadata", seek, { once: true });
      prepareVideo(video);
    }
  }));
  // Seeking has its own accessible value; avoid announcing every video frame.
  output.setAttribute("aria-live", "off");

  if (typeof demo.requestFullscreen === "function") {
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "video-expand";
    expand.textContent = "Expand";
    expand.setAttribute(
      "aria-label",
      `Expand ${recordingLabel} to full screen`,
    );
    expand.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement === demo)
          await document.exitFullscreen();
        else await demo.requestFullscreen();
      } catch {
        // Fullscreen may be unavailable in an embedded browser; native playback remains usable.
      }
    });
    document.addEventListener("fullscreenchange", () => {
      const expanded = document.fullscreenElement === demo;
      expand.textContent = expanded ? "Minimise" : "Expand";
      expand.setAttribute(
        "aria-label",
        expanded
          ? `Exit full screen for ${recordingLabel}`
          : `Expand ${recordingLabel} to full screen`,
      );
    });
    output.after(expand);
  }

  demo.classList.add("is-enhanced");
  video.controls = false;

  /* Videos are preload="none", so duration is unknown until the first play.
     Keep the authored placeholder and park the scrubber until it is real. */
  range.disabled = true;
  range.setAttribute(
    "aria-label",
    `Scrub ${recordingLabel} — loading metadata`,
  );

  function hasDuration() {
    return Number.isFinite(video.duration) && video.duration > 0;
  }

  function updateVideoControls() {
    if (startButton) {
      startButton.hidden = !video.paused || (video.currentTime > 0 && !video.ended);
      startButton.textContent = video.ended ? "↺ Replay demo" : "▶ Watch demo";
      startButton.setAttribute("aria-label", `${video.ended ? "Replay" : "Watch"} ${recordingLabel}`);
    }
    chapters.forEach((chapter, index) => {
      const next = chapters[index + 1];
      const active = video.currentTime >= Number(chapter.dataset.videoSeek) &&
        (!next || video.currentTime < Number(next.dataset.videoSeek));
      chapter.setAttribute("aria-pressed", String(active));
    });
    // Retain the complete recording frame when paused or scrubbed after first play.
    if (!video.paused || video.currentTime > 0)
      demo.classList.add("has-played");
    playButton.textContent = video.paused ? "Play" : "Pause";
    playButton.setAttribute(
      "aria-label",
      `${video.paused ? "Play" : "Pause"} ${recordingLabel}`,
    );

    if (!hasDuration()) {
      output.textContent = placeholderTime;
      return;
    }

    if (range.disabled) {
      range.disabled = false;
      range.setAttribute("aria-label", `Scrub ${recordingLabel}`);
    }
    range.value = String((video.currentTime / video.duration) * 100);
    range.setAttribute(
      "aria-valuetext",
      `${formatTime(video.currentTime)} of ${formatTime(video.duration)}`,
    );
    output.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  }

  playButton.addEventListener("click", () => {
    if (video.paused) {
      video.play().catch(() => updateVideoControls());
    } else {
      video.pause();
    }
  });

  range.addEventListener("input", () => {
    if (!hasDuration()) return;
    video.pause();
    video.currentTime = (Number(range.value) / 100) * video.duration;
    updateVideoControls();
  });

  [
    "loadedmetadata",
    "durationchange",
    "timeupdate",
    "seeked",
    "play",
    "pause",
    "ended",
  ].forEach((name) => {
    video.addEventListener(name, updateVideoControls);
  });
  video.addEventListener("error", () => {
    video.controls = true;
    demo.classList.remove("is-enhanced");
  });
  updateVideoControls();
});

/* Native and enhanced recordings share the same playback policy. */
document.querySelectorAll("video").forEach((video) => {
  video.addEventListener("play", () => {
    document.querySelectorAll("video").forEach((other) => {
      if (other !== video) other.pause();
    });
  });
});

/* Do not leave a recording playing after its preview leaves the screen. */
if ("IntersectionObserver" in window) {
  const mediaObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) target.pause();
      else if (target.hasAttribute("data-prepare-when-visible"))
        prepareVideo(target);
    });
  });
  document
    .querySelectorAll("video")
    .forEach((video) => mediaObserver.observe(video));
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden)
    document.querySelectorAll("video").forEach((video) => video.pause());
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
});

/* --------------------------------------------------------------- scrollspy -- */

/* Marks the nav link for whichever section currently owns the viewport, so a
   long single-page document still tells you where you are. */
const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
const watched = navLinks
  .map((link) => ({
    link,
    section: document.getElementById(link.hash.slice(1)),
  }))
  .filter((entry) => entry.section);

if (watched.length && "IntersectionObserver" in window) {
  const visible = new Set();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });

      const current = watched.find((entry) => visible.has(entry.section));
      watched.forEach(({ link }) => {
        if (current && link === current.link)
          link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
  );

  watched.forEach(({ section }) => observer.observe(section));
}
