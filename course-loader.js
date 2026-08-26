/**
 * course-loader.js
 * Fills course specific slots in a page from courses/<id>.json.
 *
 * Which course:
 *   1. ?course=<id> in the URL (also remembered for later pages)
 *   2. previously remembered course (localStorage)
 *   3. data-default-course on <html>, else "aws1"
 *
 * Slots:
 *   <el data-slot="course.short_name"></el>              text slot, filled with textContent
 *   <el data-slot="c2.examples" data-slot-type="carousel"> list slot, rendered by a renderer
 *
 * A course file may declare  "extends": "<base-id>"  — the base course
 * is fetched and deep-merged under it, so the file only needs the keys
 * that differ from the base.
 *
 * The loader also injects the course chooser UI on every page that
 * includes it: a fixed "Course" pill (bottom left) and a modal listing
 * the courses from courses/index.json. The modal opens automatically on
 * a first visit (no remembered course, none in the URL). Opt out per
 * page with  <html data-no-course-ui>.
 *
 * When every slot is filled the loader sets window.AIWISE_COURSE and
 * dispatches "aiwise:course-loaded" on document. Page scripts that
 * depend on slot content (e.g. the carousel) should wait for that.
 */
(function () {
  var STORAGE_KEY = "aiwise-course";
  var DEFAULT_ID = document.documentElement.getAttribute("data-default-course") || "aws1";

  /* ── course id ─────────────────────────────────────────── */
  function resolveCourseId() {
    var fromUrl = null;
    try { fromUrl = new URLSearchParams(window.location.search).get("course"); } catch (e) {}
    if (fromUrl) {
      try { localStorage.setItem(STORAGE_KEY, fromUrl); } catch (e) {}
      return fromUrl;
    }
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch (e) {}
    return DEFAULT_ID;
  }

  /* ── path lookup: "c2.examples" → data.c2.examples ─────── */
  function getPath(obj, path) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  /* ── small DOM helpers (all text goes through textContent) ─ */
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ── renderers by data-slot-type ───────────────────────── */
  var RENDERERS = {

    /* C2 "what you think / what you type / how the model processes" cards */
    carousel: function (container, items) {
      container.innerHTML = "";
      var total = items.length;

      function layer(kind, label, node) {
        var wrap = el("div", "carousel-layer layer-" + kind);
        var lab = el("div", "carousel-layer-label");
        lab.appendChild(el("span", "dot"));
        lab.appendChild(document.createTextNode(label));
        wrap.appendChild(lab);
        wrap.appendChild(node);
        return wrap;
      }

      items.forEach(function (item, i) {
        var slide = el("div", "carousel-slide");
        var card = el("div", "carousel-card");

        var header = el("div", "carousel-card-header");
        header.appendChild(el("span", "card-num", "Example " + (i + 1) + " of " + total));
        header.appendChild(document.createTextNode(" " + (item.title || "")));
        card.appendChild(header);

        var layers = el("div", "carousel-layers");

        layers.appendChild(layer("thinking", "What you are actually thinking",
          el("p", null, item.thinking || "")));

        var typingP = el("p");
        if (item.typing_note) {
          typingP.appendChild(el("em", null, item.typing_note));
          typingP.appendChild(document.createElement("br"));
        }
        typingP.appendChild(document.createTextNode(item.typing || ""));
        layers.appendChild(layer("typing", "What you type", typingP));

        layers.appendChild(layer("processing", "How the model actually processes this",
          el("p", null, item.processing || "")));

        card.appendChild(layers);
        slide.appendChild(card);
        container.appendChild(slide);
      });
    },

    /* C3 technique-panel example: {bad?, good} strings; \n in good becomes <br> */
    "prompt-example": function (container, data) {
      container.innerHTML = "";
      function line(cls, prefix, text) {
        var d = el("div", cls);
        String(prefix + text).split("\n").forEach(function (part, i) {
          if (i) d.appendChild(document.createElement("br"));
          d.appendChild(document.createTextNode(part));
        });
        container.appendChild(d);
      }
      if (data.bad != null) line("ex-bad", "\u2717 ", data.bad);
      if (data.good != null) line("ex-good", "\u2713 ", data.good);
    },

    /* C3 Adopt/Modify/Discard worked example: {title, intro, items:[{text, tag, reason}]} */
    "amd-example": function (container, data) {
      container.innerHTML = "";
      container.appendChild(el("div", "amd-example-title", data.title || ""));
      var intro = el("p", null, data.intro || "");
      intro.setAttribute("style", "font-size:12.5px;color:var(--muted);margin-bottom:14px;line-height:1.6;");
      container.appendChild(intro);
      var TAG_LABELS = { adopt: "Adopt", modify: "Modify", discard: "Discard" };
      (data.items || []).forEach(function (item) {
        var row = el("div", "amd-item");
        row.appendChild(el("div", "amd-item-text", item.text || ""));
        row.appendChild(el("span", "amd-tag amd-tag-" + item.tag, TAG_LABELS[item.tag] || item.tag));
        row.appendChild(el("div", "amd-reason", item.reason || ""));
        container.appendChild(row);
      });
    },

    /* C2 S.A.T worked example: {phases:[{label, steps:[{actor, name, text}]}], note} */
    "sat-example": function (container, data) {
      container.innerHTML = "";
      (data.phases || []).forEach(function (phase) {
        var group = el("div", "sat-phase");
        var kind = /team/i.test(phase.label) ? "selfteam" : "selfai";
        group.appendChild(el("span", "sat-phase-label sat-phase-" + kind, phase.label));
        (phase.steps || []).forEach(function (step) {
          var row = el("div", "sat-step");
          row.appendChild(el("span", "sat-step-badge sat-badge-" + step.actor, step.actor === "ai" ? "AI" : step.actor.charAt(0).toUpperCase() + step.actor.slice(1)));
          var content = el("div", "sat-step-content");
          content.appendChild(el("span", "sat-step-name", step.name));
          content.appendChild(document.createTextNode(step.text || ""));
          row.appendChild(content);
          group.appendChild(row);
        });
        container.appendChild(group);
      });
      if (data.note) container.appendChild(el("div", "sat-example-note", data.note));
    },

    /* C3 Markdown code panel: [{heading, lines:[...]}] */
    "md-panel": function (container, sections) {
      container.innerHTML = "";
      sections.forEach(function (s, i) {
        if (i) container.appendChild(document.createTextNode("\n\n"));
        container.appendChild(el("span", "heading", "# " + s.heading));
        (s.lines || []).forEach(function (lineText) {
          container.appendChild(document.createTextNode("\n"));
          container.appendChild(el("span", "comment", lineText));
        });
      });
    },

    /* C3 XML code panel: [{tag, lines:[...]}] */
    "xml-panel": function (container, sections) {
      container.innerHTML = "";
      sections.forEach(function (s, i) {
        if (i) container.appendChild(document.createTextNode("\n\n"));
        container.appendChild(el("span", "tag", "<" + s.tag + ">"));
        container.appendChild(document.createTextNode("\n"));
        container.appendChild(el("span", "comment", (s.lines || []).join("\n")));
        container.appendChild(document.createTextNode("\n"));
        container.appendChild(el("span", "tag", "</" + s.tag + ">"));
      });
    }
  };

  /* ── fill every slot ───────────────────────────────────── */
  function fillSlots(data) {
    var slots = document.querySelectorAll("[data-slot]");
    slots.forEach(function (node) {
      var path = node.getAttribute("data-slot");
      var value = getPath(data, path);
      var type = node.getAttribute("data-slot-type");

      if (value === undefined) {
        console.warn("[course-loader] no value for slot:", path);
        return;
      }
      if (type && RENDERERS[type]) {
        RENDERERS[type](node, value);
      } else if (typeof value === "string" || typeof value === "number") {
        node.textContent = String(value);
      } else {
        console.warn("[course-loader] slot has no renderer for its value:", path);
      }
    });
  }

  /* elements with data-requires-slot="<path>" are shown only when the
     course JSON actually has a value at that path */
  function toggleRequired(data) {
    document.querySelectorAll("[data-requires-slot]").forEach(function (node) {
      var has = data && getPath(data, node.getAttribute("data-requires-slot")) !== undefined;
      node.hidden = !has;
    });
  }

  function announce(data, id) {
    window.AIWISE_COURSE = data;
    window.AIWISE_COURSE_ID = id;
    window.AIWISE_COURSE_READY = true;
    document.dispatchEvent(new CustomEvent("aiwise:course-loaded", { detail: { id: id, data: data } }));
  }

  /* ── load ──────────────────────────────────────────────── */

  /* plain objects merge key by key; anything else (strings, arrays) is replaced */
  function deepMerge(base, override) {
    var isObj = function (v) { return v !== null && typeof v === "object" && !Array.isArray(v); };
    if (!isObj(override)) return override;
    var out = {};
    if (isObj(base)) Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(override).forEach(function (k) { out[k] = deepMerge(out[k], override[k]); });
    return out;
  }

  function fetchCourse(id, seen) {
    seen = seen || {};
    if (seen[id]) return Promise.reject(new Error("circular extends: " + id));
    seen[id] = true;
    return fetch("courses/" + encodeURIComponent(id) + ".json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data.extends) return data;
        return fetchCourse(data.extends, seen).then(function (base) {
          var merged = deepMerge(base, data);
          delete merged.extends;
          return merged;
        });
      });
  }

  function load(id, isFallback) {
    return fetchCourse(id)
      .then(function (data) {
        fillSlots(data);
        toggleRequired(data);
        announce(data, id);
      })
      .catch(function (err) {
        console.error("[course-loader] could not load course '" + id + "':", err);
        if (!isFallback && id !== DEFAULT_ID) return load(DEFAULT_ID, true);
        /* nothing loaded: still announce so pages do not hang */
        announce(null, null);
      });
  }

  /* ── course chooser UI (identical on every page) ───────── */
  var manifestCache = null;
  function fetchManifest() {
    if (manifestCache) return Promise.resolve(manifestCache);
    return fetch("courses/index.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (list) { manifestCache = list; return list; });
  }

  var UI_CSS = "" +
    ".aiwise-course-switch{position:fixed;left:18px;bottom:18px;z-index:940;" +
      "display:inline-flex;align-items:center;gap:8px;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;" +
      "padding:9px 16px;background:#2e6b4e;color:#fff;border:1px solid rgba(255,255,255,0.16);" +
      "border-radius:999px;box-shadow:0 6px 18px rgba(24,66,46,0.3);cursor:pointer;" +
      "transition:transform .15s ease,box-shadow .15s ease;}" +
    ".aiwise-course-switch:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(24,66,46,0.42);}" +
    ".aiwise-course-switch .acs-label{font-size:9px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#b7e7cd;}" +
    ".aiwise-course-switch .acs-name{font-size:12.5px;font-weight:700;color:#fff;}" +
    ".aiwise-course-switch .acs-change{font-size:11px;font-weight:600;color:#b7e7cd;" +
      "text-decoration:underline;text-underline-offset:2px;margin-left:2px;}" +
    "@media (max-width:640px){.aiwise-course-switch{left:12px;bottom:12px;padding:8px 13px;}}" +
    ".aiwise-course-modal{position:fixed;inset:0;z-index:990;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;}" +
    ".aiwise-course-modal[hidden]{display:none;}" +
    ".aiwise-course-modal .acm-backdrop{position:absolute;inset:0;background:rgba(2,47,53,0.62);backdrop-filter:blur(2px);}" +
    ".aiwise-course-modal .acm-card{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" +
      "width:min(420px,calc(100vw - 40px));background:#fff;border-radius:14px;" +
      "box-shadow:0 24px 60px rgba(2,47,53,0.35);padding:30px 28px 26px;}" +
    ".aiwise-course-modal .acm-title{font-size:19px;font-weight:700;color:#0f2f33;margin:0 0 6px;}" +
    ".aiwise-course-modal .acm-desc{font-size:13px;color:#607375;line-height:1.6;margin:0 0 18px;}" +
    ".aiwise-course-modal .acm-options{display:flex;flex-direction:column;gap:8px;}" +
    ".aiwise-course-modal .acm-option{display:flex;align-items:baseline;gap:10px;width:100%;" +
      "font:inherit;padding:13px 16px;background:#f7faf9;border:1px solid #dce8e7;border-radius:10px;" +
      "cursor:pointer;text-align:left;transition:border-color .15s ease,background .15s ease;}" +
    ".aiwise-course-modal .acm-option:hover{border-color:#2b5d63;background:#fff;}" +
    ".aiwise-course-modal .acm-option strong{font-size:14px;font-weight:700;color:#0f2f33;min-width:52px;}" +
    ".aiwise-course-modal .acm-option span{font-size:12px;color:#607375;}" +
    ".aiwise-course-modal .acm-option.active{border-color:#2b5d63;background:#fff;box-shadow:inset 0 0 0 1px #2b5d63;}" +
    ".aiwise-course-modal .acm-option.active::after{content:'✓';margin-left:auto;color:#2b5d63;font-weight:700;}";

  function buildUI(list, firstVisit) {
    if (document.getElementById("aiwiseCourseSwitch")) return;

    var style = document.createElement("style");
    style.textContent = UI_CSS;
    document.head.appendChild(style);

    var currentId = window.AIWISE_COURSE_ID;
    var entry = null;
    list.forEach(function (c) { if (c.id === currentId) entry = c; });
    var currentName = entry ? entry.short_name
      : (window.AIWISE_COURSE && window.AIWISE_COURSE.course && window.AIWISE_COURSE.course.short_name) || "AWS I";

    /* pill */
    var pill = document.createElement("button");
    pill.type = "button";
    pill.id = "aiwiseCourseSwitch";
    pill.className = "aiwise-course-switch";
    pill.setAttribute("aria-haspopup", "dialog");
    pill.appendChild(el("span", "acs-label", "Course"));
    pill.appendChild(el("span", "acs-name", currentName));
    pill.appendChild(el("span", "acs-change", "Change"));
    document.body.appendChild(pill);

    /* modal */
    var modal = document.createElement("div");
    modal.className = "aiwise-course-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Choose your course");
    modal.hidden = true;

    var backdrop = el("div", "acm-backdrop");
    var card = el("div", "acm-card");
    card.appendChild(el("h2", "acm-title", "Choose your course"));
    card.appendChild(el("p", "acm-desc",
      "AI-Wise adapts its examples, explanations, and prompt templates to your course. You can change this at any time."));
    var options = el("div", "acm-options");
    list.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "acm-option" + (c.id === currentId ? " active" : "");
      btn.appendChild(el("strong", null, c.short_name));
      btn.appendChild(el("span", null, c.full_name));
      btn.addEventListener("click", function () {
        if (c.id === currentId) { close(); return; }
        window.location.href = window.location.pathname + "?course=" + encodeURIComponent(c.id);
      });
      options.appendChild(btn);
    });
    card.appendChild(options);
    modal.appendChild(backdrop);
    modal.appendChild(card);
    document.body.appendChild(modal);

    var lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      var active = modal.querySelector(".acm-option.active") || modal.querySelector(".acm-option");
      if (active) active.focus();
    }
    function close() {
      modal.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    pill.addEventListener("click", open);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) close();
    });

    if (firstVisit) open();
  }

  function initUI(firstVisit) {
    if (document.documentElement.hasAttribute("data-no-course-ui")) return;
    fetchManifest()
      .then(function (list) {
        var build = function () { buildUI(list, firstVisit); };
        if (window.AIWISE_COURSE_READY) build();
        else document.addEventListener("aiwise:course-loaded", build, { once: true });
      })
      .catch(function (err) {
        console.warn("[course-loader] course chooser disabled, no manifest:", err);
      });
  }

  function start() {
    /* read BEFORE resolveCourseId() stores a ?course= value */
    var firstVisit = false;
    try {
      var hasParam = new URLSearchParams(window.location.search).get("course");
      if (!hasParam) firstVisit = !localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    load(resolveCourseId(), false);
    initUI(firstVisit);
  }


  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
