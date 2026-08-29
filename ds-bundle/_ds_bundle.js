/* @ds-bundle: {"namespace":"Chapa","components":[{"name":"BitbucketIcon","sourcePath":"components/icons/BitbucketIcon/BitbucketIcon.jsx"},{"name":"ClaudeCodeStar","sourcePath":"components/general/ClaudeCodeStar/ClaudeCodeStar.jsx"},{"name":"CodebergIcon","sourcePath":"components/icons/CodebergIcon/CodebergIcon.jsx"},{"name":"ConfirmDialog","sourcePath":"components/general/ConfirmDialog/ConfirmDialog.jsx"},{"name":"CopyIcon","sourcePath":"components/icons/CopyIcon/CopyIcon.jsx"},{"name":"GitHubIcon","sourcePath":"components/icons/GitHubIcon/GitHubIcon.jsx"},{"name":"GitlabIcon","sourcePath":"components/icons/GitlabIcon/GitlabIcon.jsx"},{"name":"InsightCard","sourcePath":"components/dashboard/InsightCard/InsightCard.jsx"},{"name":"LiteYouTubeEmbed","sourcePath":"components/general/LiteYouTubeEmbed/LiteYouTubeEmbed.jsx"},{"name":"LoginCtaButton","sourcePath":"components/general/LoginCtaButton/LoginCtaButton.jsx"},{"name":"Sparkline","sourcePath":"components/dashboard/Sparkline/Sparkline.jsx"},{"name":"StatusCallout","sourcePath":"components/general/StatusCallout/StatusCallout.jsx"}],"sourceHashes":{"components/icons/BitbucketIcon/BitbucketIcon.jsx":"186c125f8573","components/icons/BitbucketIcon/BitbucketIcon.d.ts":"5eb92126d804","components/icons/BitbucketIcon/BitbucketIcon.prompt.md":"30915c5715a6","components/general/ClaudeCodeStar/ClaudeCodeStar.jsx":"51e123b4e68b","components/general/ClaudeCodeStar/ClaudeCodeStar.d.ts":"dcac39c13ca9","components/general/ClaudeCodeStar/ClaudeCodeStar.prompt.md":"fb294190fe6e","components/icons/CodebergIcon/CodebergIcon.jsx":"eacb15777da9","components/icons/CodebergIcon/CodebergIcon.d.ts":"f90342a1c737","components/icons/CodebergIcon/CodebergIcon.prompt.md":"14cf59f1cfc3","components/general/ConfirmDialog/ConfirmDialog.jsx":"71b560bac6dc","components/general/ConfirmDialog/ConfirmDialog.d.ts":"f2f467336898","components/general/ConfirmDialog/ConfirmDialog.prompt.md":"a1ca6f0e9ffe","components/icons/CopyIcon/CopyIcon.jsx":"4e6c90ece840","components/icons/CopyIcon/CopyIcon.d.ts":"7afaf5f40723","components/icons/CopyIcon/CopyIcon.prompt.md":"5e1ad5b72ca8","components/icons/GitHubIcon/GitHubIcon.jsx":"7668febd7c12","components/icons/GitHubIcon/GitHubIcon.d.ts":"8753d39c669c","components/icons/GitHubIcon/GitHubIcon.prompt.md":"f9343b0322cb","components/icons/GitlabIcon/GitlabIcon.jsx":"73dc32743588","components/icons/GitlabIcon/GitlabIcon.d.ts":"2662bccb94ff","components/icons/GitlabIcon/GitlabIcon.prompt.md":"315789f5b64e","components/dashboard/InsightCard/InsightCard.jsx":"f103c9a76872","components/dashboard/InsightCard/InsightCard.d.ts":"50b6e69b95e4","components/dashboard/InsightCard/InsightCard.prompt.md":"5fbc45eb2489","components/general/LiteYouTubeEmbed/LiteYouTubeEmbed.jsx":"07e5071d3e17","components/general/LiteYouTubeEmbed/LiteYouTubeEmbed.d.ts":"b129cb501436","components/general/LiteYouTubeEmbed/LiteYouTubeEmbed.prompt.md":"9a0cb9855d2b","components/general/LoginCtaButton/LoginCtaButton.jsx":"75c9aea71d49","components/general/LoginCtaButton/LoginCtaButton.d.ts":"9ceafa4e1305","components/general/LoginCtaButton/LoginCtaButton.prompt.md":"9eb660a97070","components/dashboard/Sparkline/Sparkline.jsx":"255e5015b515","components/dashboard/Sparkline/Sparkline.d.ts":"e82ef550210a","components/dashboard/Sparkline/Sparkline.prompt.md":"0dbd4e8ad437","components/general/StatusCallout/StatusCallout.jsx":"8143a25ae855","components/general/StatusCallout/StatusCallout.d.ts":"22d7d4ad7dd0","components/general/StatusCallout/StatusCallout.prompt.md":"404b52efb19e"},"inlinedExternals":[],"builtBy":"cc-design-sync"} */
"use strict";
var Chapa = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx13(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs8(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx13;
      module.exports.jsxs = jsxs8;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs8 : jsx13)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // apps/web/.ds-entry.tsx
  var ds_entry_exports = {};
  __export(ds_entry_exports, {
    BitbucketIcon: () => BitbucketIcon,
    ClaudeCodeStar: () => ClaudeCodeStar,
    CodebergIcon: () => CodebergIcon,
    ConfirmDialog: () => ConfirmDialog,
    CopyIcon: () => CopyIcon,
    GitHubIcon: () => GitHubIcon2,
    GitlabIcon: () => GitlabIcon,
    InsightCard: () => InsightCard,
    LiteYouTubeEmbed: () => LiteYouTubeEmbed,
    LoginCtaButton: () => LoginCtaButton,
    Sparkline: () => Sparkline,
    StatusCallout: () => StatusCallout
  });
  init_define_import_meta_env();

  // apps/web/components/StatusCallout.tsx
  init_define_import_meta_env();
  var import_jsx_runtime = __toESM(require_react_shim());
  var STATUS_STYLES = {
    success: {
      container: "border-terminal-green/30 bg-terminal-green/10",
      iconBg: "bg-terminal-green/15",
      iconText: "text-terminal-green",
      title: "text-terminal-green",
      icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 6L9 17l-5-5" })
    },
    error: {
      container: "border-terminal-red/30 bg-terminal-red/10",
      iconBg: "bg-terminal-red/15",
      iconText: "text-terminal-red",
      title: "text-terminal-red",
      icon: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "10" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 9l-6 6m0-6l6 6" })
      ] })
    },
    warning: {
      container: "border-terminal-yellow/30 bg-terminal-yellow/10",
      iconBg: "bg-terminal-yellow/15",
      iconText: "text-terminal-yellow",
      title: "text-terminal-yellow",
      icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 9v4m0 4h.01M12 2L2 20h20L12 2z" })
    },
    verification: {
      container: "border-complement/30 bg-complement/10",
      iconBg: "bg-complement/15",
      // #1189 — text-complement (base --color-complement) fails AA contrast
      // as text/icon-stroke on light-theme backgrounds (~2.54:1); the fill
      // classes above are unaffected and keep the base teal token.
      iconText: "text-complement-text",
      title: "text-complement-text",
      icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 6L9 17l-5-5" })
    }
  };
  function StatusCallout({
    variant,
    title,
    description,
    children,
    className = "",
    titleAs: Title = "h2"
  }) {
    const styles = STATUS_STYLES[variant];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "section",
      {
        role: variant === "error" ? "alert" : "status",
        className: `rounded-xl border p-8 ${styles.container} ${className}`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "mb-4 flex items-center gap-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.iconBg}`,
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "svg",
                  {
                    className: `h-5 w-5 ${styles.iconText}`,
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: "2",
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    "aria-hidden": "true",
                    children: styles.icon
                  }
                )
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Title, { className: `font-heading text-xl font-bold ${styles.title}`, children: title }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-sm text-text-secondary", children: description })
            ] })
          ] }),
          children
        ]
      }
    );
  }

  // apps/web/components/ConfirmDialog.tsx
  init_define_import_meta_env();
  var import_react = __toESM(require_react_shim());
  var import_jsx_runtime2 = __toESM(require_react_shim());
  function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "destructive",
    loading = false,
    onConfirm,
    onCancel
  }) {
    const dialogRef = (0, import_react.useRef)(null);
    const cancelRef = (0, import_react.useRef)(null);
    (0, import_react.useEffect)(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (open && !dialog.open) {
        dialog.showModal();
        cancelRef.current?.focus();
      }
    }, [open]);
    if (!open) return null;
    const titleId = "confirm-dialog-title";
    const descId = "confirm-dialog-desc";
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "dialog",
      {
        ref: dialogRef,
        role: "alertdialog",
        "aria-labelledby": titleId,
        "aria-describedby": descId,
        onClose: onCancel,
        className: "m-auto max-w-sm w-full rounded-2xl border border-stroke bg-card p-6 shadow-xl backdrop:bg-black/50",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "h2",
            {
              id: titleId,
              className: "font-heading text-base font-semibold text-text-primary",
              children: title
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "p",
            {
              id: descId,
              className: "mt-2 font-body text-sm leading-relaxed text-text-secondary",
              children: description
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "mt-6 flex justify-end gap-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                ref: cancelRef,
                type: "button",
                disabled: loading,
                onClick: onCancel,
                className: "rounded-lg border border-stroke px-4 py-2 text-sm text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary disabled:opacity-50",
                children: cancelLabel
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                disabled: loading,
                onClick: onConfirm,
                className: `rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${variant === "destructive" ? "bg-terminal-red hover:bg-terminal-red/80" : "bg-amber hover:bg-amber-light"}`,
                children: loading ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "svg",
                    {
                      className: "h-4 w-4 animate-spin",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      "aria-hidden": "true",
                      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "circle",
                        {
                          cx: "12",
                          cy: "12",
                          r: "10",
                          stroke: "currentColor",
                          strokeWidth: "3",
                          strokeDasharray: "31.4 31.4",
                          strokeLinecap: "round"
                        }
                      )
                    }
                  ),
                  confirmLabel
                ] }) : confirmLabel
              }
            )
          ] })
        ]
      }
    );
  }

  // apps/web/components/LoginCtaButton.tsx
  init_define_import_meta_env();
  var import_react2 = __toESM(require_react_shim());
  var import_jsx_runtime3 = __toESM(require_react_shim());
  function GitHubIcon({ className }) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { className, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" }) });
  }
  function ArrowRightIcon({ className }) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "svg",
      {
        className,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M5 12h14" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M12 5l7 7-7 7" })
        ]
      }
    );
  }
  function SpinnerIcon({ className }) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "svg",
      {
        className,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2.5",
        strokeLinecap: "round",
        "aria-hidden": "true",
        "data-spinner": true,
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M21 12a9 9 0 1 1-6.219-8.56" })
      }
    );
  }
  var SIZE_STYLES = {
    sm: { wrapper: "pl-6 pr-5 py-3 text-sm", icon: "w-4 h-4" },
    lg: { wrapper: "pl-8 pr-7 py-3.5 text-base", icon: "w-5 h-5" }
  };
  function LoginCtaButton({
    label,
    pendingLabel,
    size = "sm"
  }) {
    const [pending, setPending] = (0, import_react2.useState)(false);
    const styles = SIZE_STYLES[size];
    const handleClick = (e) => {
      if (pending) {
        e.preventDefault();
        return;
      }
      setPending(true);
    };
    return (
      // Intentional native <a> for a server-redirect API route (GitHub OAuth),
      // not a client-side page navigation. The #1023 top-level app/[locale]
      // dynamic segment makes this lint rule's page-path heuristic
      // false-positive on any /api/* href (see
      // docs/decisions/2026-07-15-i18n-middleware-carve-out.md).
      // eslint-disable-next-line @next/next/no-html-link-for-pages
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "a",
        {
          href: "/api/auth/login",
          onClick: handleClick,
          "aria-busy": pending,
          "aria-disabled": pending,
          tabIndex: pending ? -1 : void 0,
          className: `group inline-flex items-center gap-2.5 rounded-lg bg-amber-dark font-semibold text-white transition-all hover:bg-amber hover:shadow-xl hover:shadow-amber/25 ${styles.wrapper} ${pending ? "cursor-wait opacity-90" : ""}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { "aria-live": "polite", className: "sr-only", children: pending ? pendingLabel : "" }),
            pending ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SpinnerIcon, { className: `${styles.icon} animate-spin motion-reduce:animate-none` }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GitHubIcon, { className: styles.icon }),
            pending ? pendingLabel : label,
            !pending && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ArrowRightIcon, { className: `${styles.icon} transition-transform group-hover:translate-x-1` })
          ]
        }
      )
    );
  }

  // apps/web/components/ClaudeCodeStar.tsx
  init_define_import_meta_env();
  var import_react3 = __toESM(require_react_shim());
  var import_jsx_runtime4 = __toESM(require_react_shim());
  var FRAMES = ["*", "\u2736", "\xB7", "\u2726"];
  var INTERVAL_MS = 400;
  function ClaudeCodeStar() {
    const [frame, setFrame] = (0, import_react3.useState)(0);
    (0, import_react3.useEffect)(() => {
      if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
      const id = setInterval(() => {
        setFrame((f) => (f + 1) % FRAMES.length);
      }, INTERVAL_MS);
      return () => clearInterval(id);
    }, []);
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: FRAMES[frame] });
  }

  // apps/web/components/LiteYouTubeEmbed.tsx
  init_define_import_meta_env();
  var import_react4 = __toESM(require_react_shim());
  var import_jsx_runtime5 = __toESM(require_react_shim());
  function LiteYouTubeEmbed({ videoId, title }) {
    const [activated, setActivated] = (0, import_react4.useState)(false);
    const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : void 0;
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "aspect-video w-full overflow-hidden rounded-xl border border-stroke bg-card", children: activated ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "iframe",
      {
        src: embedUrl,
        title,
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        allowFullScreen: true,
        className: "h-full w-full"
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        "aria-label": `Play ${title}`,
        onClick: () => setActivated(true),
        className: "group relative h-full w-full cursor-pointer",
        children: [
          thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnail, shown briefly before iframe loads */
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "img",
              {
                src: thumbnailUrl,
                alt: title,
                width: 480,
                height: 270,
                className: "h-full w-full object-cover",
                loading: "lazy"
              }
            )
          ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "flex h-full w-full items-center justify-center bg-dark-section", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "font-heading text-sm text-text-secondary", children: "Video coming soon" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-amber/90 shadow-lg shadow-amber/25 transition-transform group-hover:scale-110", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "svg",
            {
              viewBox: "0 0 24 24",
              fill: "white",
              className: "ml-1 h-7 w-7",
              "aria-hidden": "true",
              children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M8 5v14l11-7z" })
            }
          ) }) })
        ]
      }
    ) });
  }

  // apps/web/components/dashboard/InsightCard.tsx
  init_define_import_meta_env();
  var import_jsx_runtime6 = __toESM(require_react_shim());
  function TrendingUpIcon({ size = 18 }) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 20 20",
        fill: "none",
        "aria-hidden": "true",
        stroke: "currentColor",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M2 17L8 11L12 15L18 3",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "polyline",
            {
              points: "18 3 18 9",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              fill: "none"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "polyline",
            {
              points: "18 3 12 3",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              fill: "none"
            }
          )
        ]
      }
    );
  }
  function TrendingDownIcon({ size = 18 }) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 20 20",
        fill: "none",
        "aria-hidden": "true",
        stroke: "currentColor",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M2 3L8 9L12 5L18 17",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "polyline",
            {
              points: "18 17 18 11",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              fill: "none"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "polyline",
            {
              points: "18 17 12 17",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              fill: "none"
            }
          )
        ]
      }
    );
  }
  function TargetIcon({ size = 18 }) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 20 20",
        fill: "none",
        "aria-hidden": "true",
        stroke: "currentColor",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "10", cy: "10", r: "8", strokeWidth: "1.5" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "10", cy: "10", r: "3", strokeWidth: "1.5" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "10", cy: "10", r: "1", fill: "currentColor", stroke: "none" })
        ]
      }
    );
  }
  function TrophyIcon({ size = 22 }) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 20 20",
        fill: "none",
        "aria-hidden": "true",
        stroke: "currentColor",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M6 2H14V8C14 11.3 12.2 13 10 13C7.8 13 6 11.3 6 8V2Z",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M4 2H6", strokeWidth: "1.5", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M14 2H16", strokeWidth: "1.5", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M4 2C4 4 5 5 6 5",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              fill: "none"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M16 2C16 4 15 5 14 5",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              fill: "none"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M8 13V15", strokeWidth: "1.5", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M12 13V15", strokeWidth: "1.5", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M6 15H14", strokeWidth: "1.5", strokeLinecap: "round" })
        ]
      }
    );
  }
  function LightbulbIcon({ size = 18 }) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 20 20",
        fill: "none",
        "aria-hidden": "true",
        stroke: "currentColor",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M9 18H11", strokeWidth: "1.5", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M10 2V3", strokeWidth: "1.5", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M3 10H4", strokeWidth: "1.5", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M16 10H17", strokeWidth: "1.5", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M5.6 5.6L6.3 6.3",
              strokeWidth: "1.5",
              strokeLinecap: "round"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M14.4 5.6L13.7 6.3",
              strokeWidth: "1.5",
              strokeLinecap: "round"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M8 14C6.3 13 5 11.2 5 9A5 5 0 1110 4A5 5 0 0115 9C15 11.2 13.7 13 12 14V15H8V14Z",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          )
        ]
      }
    );
  }
  function ArrowUpIcon({ size = 18 }) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 20 20",
        fill: "none",
        "aria-hidden": "true",
        stroke: "currentColor",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M10 18V2",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "path",
            {
              d: "M3 9L10 2L17 9",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          )
        ]
      }
    );
  }
  var ARCHETYPE_COLOR_MAP = {
    Builder: "var(--color-archetype-builder)",
    "Quality Champion": "var(--color-archetype-guardian)",
    Marathoner: "var(--color-archetype-marathoner)",
    Polymath: "var(--color-archetype-polymath)",
    Balanced: "var(--color-archetype-balanced)",
    Emerging: "var(--color-archetype-emerging)",
    Artificer: "var(--color-archetype-artificer)"
  };
  function resolveArchetypeColor(archetypeName) {
    if (archetypeName) {
      return ARCHETYPE_COLOR_MAP[archetypeName] ?? "var(--color-amber)";
    }
    return "var(--color-amber)";
  }
  var TIER_LIST_EN = ["Emerging", "Solid", "High", "Elite"];
  function AchievementCard({ insight, animationDelay = 0 }) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "div",
      {
        role: "article",
        className: "relative rounded-xl border border-terminal-green/20 bg-terminal-green/[0.04] p-5 animate-fade-in-up overflow-hidden",
        style: { animationDelay: `${animationDelay}ms` },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-terminal-green/10 to-transparent pointer-events-none" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "relative flex items-center gap-4", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "flex-shrink-0 w-10 h-10 rounded-lg bg-terminal-green/10 flex items-center justify-center text-terminal-green", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TrophyIcon, { size: 22 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "min-w-0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "font-heading text-base font-bold text-terminal-green", children: insight.headline }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "mt-1 text-sm text-text-secondary leading-relaxed", children: insight.body })
            ] })
          ] })
        ]
      }
    );
  }
  function TrendCard({ insight, animationDelay = 0 }) {
    const dimColor = insight.dimension ? `var(--color-dimension-${insight.dimension})` : void 0;
    const isUp = insight.icon === "trending-up";
    const accentColor = dimColor ?? (isUp ? "var(--color-terminal-green)" : "var(--color-terminal-yellow)");
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        role: "article",
        className: "rounded-xl border border-stroke bg-card p-4 animate-fade-in-up",
        style: { animationDelay: `${animationDelay}ms` },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
            "div",
            {
              className: "relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden",
              "data-testid": "trend-icon",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                  "div",
                  {
                    className: "absolute inset-0 opacity-15 rounded-lg",
                    style: { backgroundColor: accentColor }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { color: accentColor }, children: isUp ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TrendingUpIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TrendingDownIcon, {}) })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "min-w-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "font-heading text-sm font-semibold text-text-primary", children: insight.headline }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "mt-1 text-xs text-text-secondary leading-relaxed", children: insight.body })
          ] })
        ] })
      }
    );
  }
  function NextTierCard({ insight, animationDelay = 0 }) {
    const tierInfo = insight.nextTierMeta ?? null;
    const tierLabels = tierInfo?.tierLabels ?? TIER_LIST_EN;
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        role: "article",
        className: "rounded-xl border border-stroke bg-card p-4 animate-fade-in-up",
        style: { animationDelay: `${animationDelay}ms` },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "flex-shrink-0 mt-0.5 text-amber", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ArrowUpIcon, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "font-heading text-sm font-semibold text-text-primary", children: insight.headline }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "mt-1 text-xs text-text-secondary leading-relaxed", children: insight.body }),
            tierInfo && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "div",
              {
                className: "flex items-center gap-1.5 mt-3",
                "aria-hidden": "true",
                children: tierLabels.map((tierLabel, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
                  "div",
                  {
                    className: "flex-1 flex flex-col items-center gap-1",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                        "div",
                        {
                          className: `h-1.5 w-full rounded-full ${i <= tierInfo.currentIndex ? "bg-amber" : i === tierInfo.nextIndex ? "bg-amber/20" : "bg-track"}`
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                        "span",
                        {
                          className: `text-[10px] font-heading leading-none ${i === tierInfo.currentIndex ? "text-amber font-semibold" : i === tierInfo.nextIndex ? "text-text-secondary" : "text-text-secondary/40"}`,
                          children: tierLabel
                        }
                      )
                    ]
                  },
                  tierLabel
                ))
              }
            )
          ] })
        ] })
      }
    );
  }
  function CoachingTipCard({ insight, animationDelay = 0 }) {
    const dimColor = insight.dimension ? `var(--color-dimension-${insight.dimension})` : "var(--color-amber)";
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        role: "article",
        className: "rounded-lg border border-stroke/50 bg-card/50 px-4 py-3 animate-fade-in-up",
        style: { animationDelay: `${animationDelay}ms` },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "flex-shrink-0 mt-0.5", style: { color: dimColor }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(LightbulbIcon, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "min-w-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "font-heading text-sm font-medium text-text-primary", children: insight.headline }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "mt-1 text-xs text-text-secondary leading-relaxed", children: insight.body })
          ] })
        ] })
      }
    );
  }
  function ArchetypeCard({ insight, animationDelay = 0 }) {
    const archetypeColor = resolveArchetypeColor(insight.archetypeName);
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        role: "article",
        className: "rounded-xl border border-stroke bg-card p-4 animate-fade-in-up overflow-hidden",
        style: { animationDelay: `${animationDelay}ms` },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
            "div",
            {
              className: "relative flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden",
              "data-testid": "archetype-icon",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                  "div",
                  {
                    className: "absolute inset-0 opacity-15 rounded-lg",
                    style: { backgroundColor: archetypeColor }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { color: archetypeColor }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TargetIcon, { size: 18 }) })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "min-w-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "p",
              {
                className: "font-heading text-sm font-bold",
                style: { color: archetypeColor },
                children: insight.headline
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "mt-1 text-xs text-text-secondary leading-relaxed", children: insight.body })
          ] })
        ] })
      }
    );
  }
  function InsightCard({
    insight,
    animationDelay = 0
  }) {
    switch (insight.type) {
      case "achievement":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(AchievementCard, { insight, animationDelay });
      case "trend":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TrendCard, { insight, animationDelay });
      case "next-tier":
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(NextTierCard, { insight, animationDelay });
      case "tip":
        if (insight.id === "tip-archetype") {
          return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ArchetypeCard, { insight, animationDelay });
        }
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(CoachingTipCard, { insight, animationDelay });
    }
  }

  // apps/web/components/dashboard/Sparkline.tsx
  init_define_import_meta_env();
  var import_jsx_runtime7 = __toESM(require_react_shim());
  function Sparkline({
    values,
    width = 80,
    height = 24,
    color,
    className
  }) {
    if (values.length < 2) return null;
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const nums = values.map((v) => v.value);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min;
    function mapY(value) {
      if (range === 0) return height / 2;
      return padding + chartHeight - (value - min) / range * chartHeight;
    }
    const points = values.map((v, i) => {
      const x = padding + i / (values.length - 1) * chartWidth;
      const y = mapY(v.value);
      return `${x},${y}`;
    });
    const polylinePoints = points.join(" ");
    const bottomY = height - padding;
    const lastX = padding + chartWidth;
    const firstX = padding;
    const polygonPoints = `${polylinePoints} ${lastX},${bottomY} ${firstX},${bottomY}`;
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "svg",
      {
        width,
        height,
        viewBox: `0 0 ${width} ${height}`,
        "aria-hidden": "true",
        className,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "polygon",
            {
              points: polygonPoints,
              fill: color,
              opacity: "0.1",
              stroke: "none"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "polyline",
            {
              points: polylinePoints,
              stroke: color,
              strokeWidth: 1.5,
              fill: "none",
              strokeLinejoin: "round",
              strokeLinecap: "round"
            }
          )
        ]
      }
    );
  }

  // apps/web/components/icons/GitHubIcon.tsx
  init_define_import_meta_env();
  var import_jsx_runtime8 = __toESM(require_react_shim());
  function GitHubIcon2({ className }) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "svg",
      {
        className,
        viewBox: "0 0 24 24",
        fill: "currentColor",
        "aria-hidden": "true",
        children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" })
      }
    );
  }

  // apps/web/components/icons/GitlabIcon.tsx
  init_define_import_meta_env();
  var import_jsx_runtime9 = __toESM(require_react_shim());
  function GitlabIcon({ className }) {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("svg", { className, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0539.8585.8585 0 0 0-.3362.405L.4332 9.5065l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.0301.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.462-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z" }) });
  }

  // apps/web/components/icons/BitbucketIcon.tsx
  init_define_import_meta_env();
  var import_jsx_runtime10 = __toESM(require_react_shim());
  function BitbucketIcon(props) {
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", ...props, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" }) });
  }

  // apps/web/components/icons/CodebergIcon.tsx
  init_define_import_meta_env();
  var import_jsx_runtime11 = __toESM(require_react_shim());
  function CodebergIcon({ className }) {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("svg", { className, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("path", { d: "M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.187 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 5.774-4.416 3.252-4.416-3.252z" }) });
  }

  // apps/web/components/icons/CopyIcon.tsx
  init_define_import_meta_env();
  var import_jsx_runtime12 = __toESM(require_react_shim());
  function CopyIcon(props) {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
      "svg",
      {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        ...props,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
        ]
      }
    );
  }
  return __toCommonJS(ds_entry_exports);
})();
window.Chapa=Chapa.__dsMainNs?Object.assign({},Chapa,Chapa.__dsMainNs,{__dsMainNs:undefined}):Chapa;
