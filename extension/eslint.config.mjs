// The extension has no build step, so nothing was checking it: three separate
// runtime faults reached the browser this way, including a variable read above
// its own `let` that made Scrape Details a no-op with no error anywhere.
// `node --check` only parses; these rules are what catch that class.
const BROWSER_GLOBALS = [
  "window", "document", "console", "location", "navigator", "fetch",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "URL", "Blob", "MutationObserver", "getComputedStyle", "TextDecoder",
  "AbortSignal", "structuredClone", "chrome",
];

export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: Object.fromEntries(BROWSER_GLOBALS.map((g) => [g, "readonly"])),
    },
    rules: {
      "no-use-before-define": ["error", { functions: false, variables: true }],
      "no-undef": "error",
      "no-const-assign": "error",
      "no-unused-vars": ["warn", { args: "none" }],
    },
  },
];
