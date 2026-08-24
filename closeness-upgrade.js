/*
 * Closeness upgrade
 *
 * Load AFTER the existing inline app script and AFTER questions-curated.js:
 *   <script src="questions-curated.js"></script>
 *   <script src="closeness-upgrade.js"></script>
 *
 * Features:
 * - English + Korean by default.
 * - Persistent "Show Korean" toggle. Off hides Korean throughout the DOM.
 * - Removes only the three repetitive generated question template families.
 * - Preserves existing hand-written questions.
 * - Adds the 240 curated bilingual questions.
 * - Adds/infer mechanism + evidenceKey metadata.
 * - Avoids selecting the same mechanism twice in a row when another unused
 *   mechanism is available.
 */
(() => {
  "use strict";

  const PREF_KEY = "closeness_show_korean";
  const HIDE_CLASS = "closeness-hide-korean";
  const HANGUL_RE = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
  const originalText = new WeakMap();

  const REPETITIVE_PATTERNS = [
    /^What is your current perspective on .+ like right now\?$/i,
    /^How has your perspective on .+ changed as you(?:'|’)ve gotten older\?$/i,
    /^What is one lesson .+ has taught you recently\?$/i
  ];

  const EVIDENCE_BY_MECHANISM = {
    self_disclosure: "aron_laurenceau",
    responsiveness: "laurenceau_huang",
    positive_sharing: "gable2004",
    appreciation: "algoe2008",
    shared_history: "aron_laurenceau",
    identity_change: "aron_laurenceau",
    values_in_action: "aron_laurenceau",
    future_connection: "aron_laurenceau"
  };

  function normalize(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[“”"'’]/g, "")
      .replace(/[^a-z0-9가-힣]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isRepetitive(q) {
    const en = String(q?.en || "").trim();
    return REPETITIVE_PATTERNS.some((pattern) => pattern.test(en));
  }

  function inferMechanism(q) {
    if (q?.mechanism) return q.mechanism;
    const text = `${q?.en || ""} ${q?.src || ""}`.toLowerCase();

    if (/thank|grateful|gratitude|appreciat|admire|kindness|kind |proud of (him|her|them)|value about/.test(text)) {
      return "appreciation";
    }
    if (/good news|celebrat|excited|look forward|happy|joy|laugh|proud|win|went better|favorite.*recent/.test(text)) {
      return "positive_sharing";
    }
    if (/support|understood|listen|helpful|apolog|misunderstand|feel heard|stress|advice|comfort/.test(text)) {
      return "responsiveness";
    }
    if (/remember|memory|childhood|used to|tradition|inside joke|growing up|earliest|years ago/.test(text)) {
      return "shared_history";
    }
    if (/changed|change in you|older|younger self|used to be|outgrown|version of you|become/.test(text)) {
      return "identity_change";
    }
    if (/value|principle|honest|fair|loyal|promise|right thing|integrity|kindness|courage/.test(text)) {
      return "values_in_action";
    }
    if (/future|hope|next year|years from now|stay connected|someday|together.*later/.test(text)) {
      return "future_connection";
    }
    return "self_disclosure";
  }

  function ensureMetadata(q) {
    if (!q.mechanism) q.mechanism = inferMechanism(q);
    if (!q.evidenceKey) q.evidenceKey = EVIDENCE_BY_MECHANISM[q.mechanism] || "aron_laurenceau";
    return q;
  }

  function extractUsedEnglish(item) {
    if (!item) return null;
    if (typeof item === "string") return item;
    const candidates = [
      item.en,
      item.question,
      item.questionText,
      item.questionObj?.en,
      item.q?.en,
      item.currentQuestionObj?.en
    ];
    return candidates.find((value) => typeof value === "string") || null;
  }

  function saveStateSafely() {
    try {
      if (typeof saveToLocalStorage === "function") {
        saveToLocalStorage();
      } else if (typeof state !== "undefined" && state) {
        localStorage.setItem("connection_game_state", JSON.stringify(state));
      }
    } catch (error) {
      console.warn("[Closeness] Could not save state:", error);
    }
  }

  function upgradeQuestionBank() {
    if (typeof questions === "undefined" || !Array.isArray(questions)) {
      console.warn("[Closeness] Existing `questions` array was not found. Check script order.");
      return false;
    }

    const curated = Array.isArray(window.CLOSENESS_CURATED_QUESTIONS)
      ? window.CLOSENESS_CURATED_QUESTIONS
      : [];

    const preserved = questions
      .filter((q) => !isRepetitive(q))
      .map(ensureMetadata);

    const seen = new Set();
    const merged = [];

    for (const q of [...preserved, ...curated]) {
      const key = normalize(q?.en);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(ensureMetadata(q));
    }

    const removed = questions.length - preserved.length;
    questions.splice(0, questions.length, ...merged);

    // Rebuild saved unused indices because removing generated prompts changes
    // every later array index. Keep history/current question as "already used"
    // when their English text can be recovered.
    if (typeof state !== "undefined" && state) {
      const used = new Set();

      if (Array.isArray(state.history)) {
        for (const item of state.history) {
          const en = extractUsedEnglish(item);
          if (en) used.add(normalize(en));
        }
      }
      if (state.currentQuestionObj?.en) {
        used.add(normalize(state.currentQuestionObj.en));
      }

      state.unusedIndices = questions
        .map((q, index) => ({ q, index }))
        .filter(({ q }) => !used.has(normalize(q.en)))
        .map(({ index }) => index);

      if (state.unusedIndices.length === 0) {
        state.unusedIndices = questions.map((_, index) => index);
      }
      saveStateSafely();
    }

    console.info(
      `[Closeness] Removed ${removed} repetitive generated prompts. ` +
      `Added ${curated.length} curated prompts. Final bank: ${questions.length}.`
    );
    return true;
  }

  // ---------- Korean toggle ----------

  function showKoreanPreference() {
    const saved = localStorage.getItem(PREF_KEY);
    return saved === null ? true : saved !== "false";
  }

  function stripKorean(text) {
    let out = String(text);

    // Parenthetical/bracketed translations such as "Start (시작)".
    out = out
      .replace(/\s*\([^()]*[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF][^()]*\)/g, "")
      .replace(/\s*\[[^\[\]]*[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF][^\[\]]*\]/g, "");

    // Remove remaining Korean runs. This also handles Korean-only text nodes.
    out = out
      .replace(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]+/g, "")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s+[\/|·]\s*$/g, "")
      .replace(/^\s+[\/|·]\s*/g, "")
      .replace(/\(\s*\)|\[\s*\]/g, "");

    return out;
  }

  function skippedTextNode(node) {
    return !node.parentElement ||
      Boolean(node.parentElement.closest("script,style,noscript,textarea,pre,code"));
  }

  function processTextNode(node, showKorean) {
    if (!node || skippedTextNode(node)) return;

    const current = node.nodeValue || "";

    if (showKorean) {
      if (originalText.has(node)) {
        node.nodeValue = originalText.get(node);
        originalText.delete(node);
      }
      return;
    }

    // If the app rewrote an existing text node while Korean is hidden, keep
    // the new bilingual value as the restore target.
    if (HANGUL_RE.test(current)) {
      originalText.set(node, current);
      const stripped = stripKorean(current);
      if (stripped !== current) node.nodeValue = stripped;
      return;
    }

    // If a previously tracked node was rewritten to new English-only text by
    // the app, discard the stale restore value.
    if (originalText.has(node) && current !== stripKorean(originalText.get(node))) {
      originalText.delete(node);
    }
  }

  function walkText(root, showKorean) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root, showKorean);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) processTextNode(node, showKorean);
  }

  function applyKoreanPreference(showKorean) {
    document.body.classList.toggle(HIDE_CLASS, !showKorean);
    walkText(document.body, showKorean);

    const checkbox = document.getElementById("closeness-show-korean");
    if (checkbox) checkbox.checked = showKorean;
  }

  function installLanguageToggle() {
    if (document.getElementById("closeness-language-control")) return;

    const style = document.createElement("style");
    style.textContent = `
      #closeness-language-control {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: .55rem;
        margin: 0 auto 1rem;
        font: inherit;
      }
      #closeness-language-control label {
        display: inline-flex;
        align-items: center;
        gap: .45rem;
        cursor: pointer;
        font-weight: 600;
      }
      #closeness-language-control input {
        width: auto;
        margin: 0;
      }
      body.${HIDE_CLASS} .ko-q,
      body.${HIDE_CLASS} .h-ko,
      body.${HIDE_CLASS} .ko-ui,
      body.${HIDE_CLASS} .korean,
      body.${HIDE_CLASS} [lang="ko"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    const control = document.createElement("div");
    control.id = "closeness-language-control";

    const label = document.createElement("label");
    label.htmlFor = "closeness-show-korean";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "closeness-show-korean";
    checkbox.checked = showKoreanPreference();

    const labelText = document.createElement("span");
    labelText.textContent = "Show Korean";

    label.append(checkbox, labelText);
    control.appendChild(label);

    const anchor =
      document.getElementById("setup-area") ||
      document.querySelector("main") ||
      document.body.firstElementChild;

    if (anchor?.parentNode) {
      anchor.parentNode.insertBefore(control, anchor);
    } else {
      document.body.prepend(control);
    }

    checkbox.addEventListener("change", () => {
      localStorage.setItem(PREF_KEY, String(checkbox.checked));
      applyKoreanPreference(checkbox.checked);
    });

    applyKoreanPreference(checkbox.checked);
  }

  function installLanguageObserver() {
    const observer = new MutationObserver((mutations) => {
      const showKorean = showKoreanPreference();

      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          processTextNode(mutation.target, showKorean);
        } else {
          for (const added of mutation.addedNodes) {
            walkText(added, showKorean);
          }
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }

  // ---------- No back-to-back mechanism ----------

  let withheld = null;

  function currentMechanism() {
    if (typeof state === "undefined" || !state?.currentQuestionObj) return null;
    return inferMechanism(state.currentQuestionObj);
  }

  function restrictUnusedPool() {
    if (withheld) return;
    if (typeof state === "undefined" || !state || !Array.isArray(state.unusedIndices)) return;
    if (typeof questions === "undefined" || !Array.isArray(questions)) return;

    const last = currentMechanism();
    if (!last || state.unusedIndices.length < 2) return;

    const allowed = [];
    const same = [];

    for (const index of state.unusedIndices) {
      const q = questions[index];
      if (!q) continue;
      (inferMechanism(q) === last ? same : allowed).push(index);
    }

    if (!allowed.length || !same.length) return;

    withheld = same;
    state.unusedIndices.splice(0, state.unusedIndices.length, ...allowed);
  }

  function restoreUnusedPool() {
    if (!withheld) return;

    if (typeof state !== "undefined" && Array.isArray(state?.unusedIndices)) {
      for (const index of withheld) {
        if (!state.unusedIndices.includes(index)) state.unusedIndices.push(index);
      }
      saveStateSafely();
    }
    withheld = null;
  }

  function installMechanismGuard() {
    // The existing app uses #nextBtn for "Next Person" and, on the last person,
    // "New Question". Filter the unused pool only for that new-question click.
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("#nextBtn");
      if (!button) return;

      if (
        typeof state !== "undefined" &&
        state &&
        Number(state.currentPlayer) >= Number(state.numPeople)
      ) {
        restrictUnusedPool();
        setTimeout(restoreUnusedPool, 0);
      }
    }, true);
  }

  function boot() {
    upgradeQuestionBank();
    installLanguageToggle();
    installLanguageObserver();
    installMechanismGuard();
  }

  // The existing app restores `state` from localStorage in window.onload.
  // Run after that handler so we rebuild unused indices from the restored state,
  // not from the initial defaults.
  if (document.readyState === "complete") {
    setTimeout(boot, 0);
  } else {
    window.addEventListener("load", () => setTimeout(boot, 0), { once: true });
  }
})();
