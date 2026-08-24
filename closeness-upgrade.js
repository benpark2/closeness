/*
 * Closeness upgrade v2
 *
 * Load AFTER the existing inline app script and AFTER questions-curated.js:
 *   <script src="questions-curated.js"></script>
 *   <script src="closeness-upgrade.js"></script>
 *
 * Features:
 * - English + Korean by default.
 * - Persistent "Show Korean" toggle; off hides Korean throughout the rendered UI.
 * - Removes the three repetitive generated template families, preserving hand-written prompts.
 * - Adds the 240 curated bilingual prompts.
 * - Keeps the default layout compact: only a collapsed follow-up affordance is shown.
 * - Expanding it reveals source, connection mechanism, listening cue, and three suggestions.
 * - Avoids back-to-back main questions from the same mechanism when alternatives remain.
 * - Also avoids the same broad opening style back-to-back when the pool allows it.
 */
(() => {
  "use strict";

  const VERSION = "2.1.0";
  if (window.__CLOSENESS_UPGRADE_VERSION === VERSION) return;
  window.__CLOSENESS_UPGRADE_VERSION = VERSION;

  const PREF_KEY = "closeness_show_korean";
  const HIDE_CLASS = "closeness-hide-korean";
  const HANGUL_RE = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();

  const REPETITIVE_PATTERNS = [
    /^What is your current perspective on .+ like right now\?$/i,
    /^How has your perspective on .+ changed as you(?:'|’)ve gotten older\?$/i,
    /^What is one lesson .+ has taught you recently\?$/i
  ];

  // These were topic/category labels in the previous bank, not actual sources.
  const GENERIC_SOURCE_LABELS = new Set([
    "deep reflection",
    "values",
    "growth"
  ]);

  const EVIDENCE_BY_MECHANISM = {
    self_disclosure: "aron_laurenceau",
    responsiveness: "responsiveness_listening",
    positive_sharing: "gable_capitalization",
    appreciation: "algoe_gratitude",
    shared_history: "aron_laurenceau",
    identity_change: "aron_laurenceau",
    values_in_action: "aron_laurenceau",
    future_connection: "aron_laurenceau"
  };

  const EVIDENCE_KEY_MIGRATIONS = {
    laurenceau_huang: "responsiveness_listening",
    gable2004: "gable_capitalization",
    algoe2008: "algoe_gratitude"
  };

  const MECHANISMS = {
    self_disclosure: {
      labelEn: "Self-disclosure",
      labelKo: "자기개방",
      cueEn: "Show that you heard the meaning or feeling before asking for more detail.",
      cueKo: "더 자세히 묻기 전에 상대의 의미나 감정을 들었다는 것을 먼저 보여 주세요.",
      followUps: [
        ["What feels most important about that to you?", "그 이야기에서 당신에게 가장 중요한 부분은 무엇인가요?"],
        ["What do you think shaped that?", "무엇이 그런 생각이나 감정을 만들었다고 생각하나요?"],
        ["Has that changed over time?", "그 부분은 시간이 지나면서 달라졌나요?"],
        ["What do you wish people understood about that?", "그 점에 대해 사람들이 무엇을 더 이해했으면 하나요?"],
        ["How does that show up in your day-to-day life?", "그게 일상에서는 어떻게 드러나나요?"],
        ["What part of that is hardest to explain?", "그중 설명하기 가장 어려운 부분은 무엇인가요?"],
        ["When did you first start noticing that?", "그걸 처음 알아차리기 시작한 건 언제인가요?"],
        ["What would make that easier or better right now?", "지금 그게 좀 더 쉬워지거나 나아지려면 무엇이 도움이 될까요?"]
      ]
    },
    responsiveness: {
      labelEn: "Feeling understood",
      labelKo: "이해받는 느낌",
      cueEn: "Reflect or validate first. If they are describing a problem, resist jumping straight to fixing it.",
      cueKo: "먼저 상대의 말을 되짚거나 인정해 주세요. 문제를 이야기하더라도 바로 해결책부터 제시하지 않는 것이 좋습니다.",
      followUps: [
        ["What would a helpful response sound like in that situation?", "그 상황에서 도움이 되는 반응은 어떤 말이나 행동일까요?"],
        ["Can you think of a time someone got that right?", "누군가 그런 반응을 정말 잘해 준 때가 떠오르나요?"],
        ["What usually makes you feel misunderstood there?", "그런 상황에서 어떤 반응이 보통 당신을 이해받지 못한 느낌이 들게 하나요?"],
        ["How could someone tell what you need without guessing?", "상대가 추측만 하지 않고 당신에게 필요한 것을 어떻게 알 수 있을까요?"],
        ["Does what helps you change depending on who you're with?", "누구와 함께 있느냐에 따라 도움이 되는 방식도 달라지나요?"],
        ["What do you wish people would do first?", "사람들이 가장 먼저 무엇을 해 주었으면 하나요?"],
        ["Is there a small response that makes a surprisingly big difference?", "작아 보이지만 의외로 큰 도움이 되는 반응이 있나요?"],
        ["How did you learn this about yourself?", "자신에게 이런 방식이 필요하다는 것을 어떻게 알게 되었나요?"]
      ]
    },
    positive_sharing: {
      labelEn: "Sharing good things",
      labelKo: "좋은 일 함께 나누기",
      cueEn: "Match the good news with genuine interest or enthusiasm before asking more. Let the positive moment get bigger, not smaller.",
      cueKo: "더 묻기 전에 진심 어린 관심이나 기쁨으로 좋은 소식에 반응해 주세요. 좋은 순간을 축소하지 말고 더 크게 함께 느껴 주세요.",
      followUps: [
        ["What made that especially good for you?", "그 일이 특히 좋았던 이유는 무엇인가요?"],
        ["Who did you most want to tell, and why?", "가장 먼저 누구에게 말하고 싶었고, 그 이유는 무엇인가요?"],
        ["What part of it are you still enjoying?", "그 일 중에서 아직도 즐겁게 느껴지는 부분은 무엇인가요?"],
        ["What are you hoping happens next?", "다음에는 어떤 일이 이어지기를 바라나요?"],
        ["What did you do that helped make that possible?", "그 일이 가능하도록 당신이 한 일은 무엇이었나요?"],
        ["What surprised you most about it?", "그 일에서 가장 놀라웠던 점은 무엇인가요?"],
        ["How should we celebrate that?", "그 일을 어떻게 함께 축하하면 좋을까요?"],
        ["What would make more moments like that possible?", "그런 순간이 더 많아지려면 무엇이 도움이 될까요?"]
      ]
    },
    appreciation: {
      labelEn: "Appreciation and gratitude",
      labelKo: "감사와 고마움",
      cueEn: "Let the appreciation land. If it is directed at you, try receiving it without minimizing or deflecting it.",
      cueKo: "감사의 말을 충분히 받아들일 시간을 주세요. 그 말이 자신을 향한 것이라면 축소하거나 넘기지 말고 그대로 받아들여 보세요.",
      followUps: [
        ["What specific moment made you notice that?", "어떤 구체적인 순간에 그 점을 느꼈나요?"],
        ["What do you think that says about them?", "그 점은 그 사람에 대해 무엇을 보여 준다고 생각하나요?"],
        ["Have you ever told them that before?", "그 사람에게 이 이야기를 전에 해 본 적이 있나요?"],
        ["Why does that matter to you personally?", "그 점이 당신에게 개인적으로 왜 중요한가요?"],
        ["How has that affected your relationship?", "그 점이 두 사람의 관계에 어떤 영향을 주었나요?"],
        ["What's another example that comes to mind?", "또 떠오르는 다른 예가 있나요?"],
        ["What do you hope they understand from hearing this?", "이 말을 듣고 그 사람이 무엇을 알았으면 하나요?"],
        ["When did you first start appreciating that?", "그 점에 고마움을 느끼기 시작한 건 언제부터인가요?"]
      ]
    },
    shared_history: {
      labelEn: "Shared history",
      labelKo: "함께한 기억",
      cueEn: "Invite details and feelings without correcting their version of the memory. Different memories can both be meaningful.",
      cueKo: "기억의 세부사항과 감정을 더 들으면서 상대의 기억을 바로잡으려 하지 마세요. 서로 다른 기억도 모두 의미가 있을 수 있습니다.",
      followUps: [
        ["What detail from that moment do you remember most clearly?", "그 순간에서 가장 또렷하게 기억나는 세부사항은 무엇인가요?"],
        ["How do you think that experience changed your relationship?", "그 경험이 관계를 어떻게 바꾸었다고 생각하나요?"],
        ["What do you understand differently about it now?", "지금은 그 일을 어떻게 다르게 이해하나요?"],
        ["What feeling comes back when you think about it?", "그 일을 생각하면 어떤 감정이 다시 떠오르나요?"],
        ["What happened right before or right after that?", "그 일 바로 전이나 바로 뒤에는 무슨 일이 있었나요?"],
        ["Why do you think that memory stuck with you?", "왜 그 기억이 오래 남았다고 생각하나요?"],
        ["What would you tell your past selves about it now?", "지금의 당신이라면 그때의 우리에게 어떤 말을 해 주고 싶나요?"],
        ["Is there a part of that story you think others here remember differently?", "여기 있는 다른 사람이 다르게 기억할 것 같은 부분이 있나요?"]
      ]
    },
    identity_change: {
      labelEn: "Identity and change",
      labelKo: "정체성과 변화",
      cueEn: "Stay curious about what changed without judging the old or new version of them.",
      cueKo: "예전 모습이나 지금 모습을 평가하기보다 무엇이 달라졌는지 호기심을 가지고 들어 주세요.",
      followUps: [
        ["What do you think drove that change?", "무엇이 그 변화를 이끌었다고 생각하나요?"],
        ["Did anyone around you notice before you did?", "당신보다 먼저 주변 사람이 그 변화를 알아차린 적이 있나요?"],
        ["What part of the old version of you is still there?", "예전의 당신 모습 중 지금도 남아 있는 부분은 무엇인가요?"],
        ["How has that change affected your relationships?", "그 변화가 당신의 관계들에 어떤 영향을 주었나요?"],
        ["Was the change gradual, or was there a turning point?", "그 변화는 서서히 일어났나요, 아니면 뚜렷한 계기가 있었나요?"],
        ["What are you still figuring out about it?", "그 변화에 대해 아직 알아가고 있는 부분은 무엇인가요?"],
        ["What do you like most about that change?", "그 변화에서 가장 마음에 드는 점은 무엇인가요?"],
        ["What surprised you about becoming this version of yourself?", "지금의 모습이 되어 가면서 가장 놀라웠던 점은 무엇인가요?"]
      ]
    },
    values_in_action: {
      labelEn: "Values in action",
      labelKo: "행동으로 드러나는 가치",
      cueEn: "Stay with the person's lived example rather than turning it into a debate about the value itself.",
      cueKo: "그 가치 자체를 토론하기보다 그 사람이 실제로 겪은 구체적인 경험에 머물러 주세요.",
      followUps: [
        ["Can you think of a specific time that value cost you something?", "그 가치를 지키느라 무언가를 포기해야 했던 구체적인 때가 있나요?"],
        ["Where do you think you learned that value?", "그 가치를 어디에서 배웠다고 생각하나요?"],
        ["When is that value hardest to live by?", "그 가치를 지키기 가장 어려운 때는 언제인가요?"],
        ["Has that value ever conflicted with another value you hold?", "그 가치가 당신의 다른 가치와 충돌한 적이 있나요?"],
        ["Who has influenced how you think about that?", "그 점에 대한 생각에 영향을 준 사람은 누구인가요?"],
        ["How would someone see that value in your everyday behavior?", "일상 행동에서 다른 사람이 그 가치를 어떻게 알아볼 수 있을까요?"],
        ["Has your view of that changed over time?", "그에 대한 생각은 시간이 지나면서 달라졌나요?"],
        ["What would make you rethink it?", "어떤 일이 생기면 그 생각을 다시 검토하게 될까요?"]
      ]
    },
    future_connection: {
      labelEn: "Future connection",
      labelKo: "앞으로의 관계",
      cueEn: "Explore the idea without turning it into an obligation. Specificity can help, but agreement is not required.",
      cueKo: "아이디어를 곧바로 의무나 약속으로 만들지 말고 함께 살펴보세요. 구체적으로 이야기해도 꼭 합의할 필요는 없습니다.",
      followUps: [
        ["What would make that realistic instead of just a nice idea?", "좋은 생각에 그치지 않고 실제로 가능하게 하려면 무엇이 필요할까요?"],
        ["What would the smallest first step look like?", "가장 작은 첫걸음은 어떤 모습일까요?"],
        ["What part of that feels most exciting?", "그중 가장 기대되는 부분은 무엇인가요?"],
        ["What might get in the way?", "무엇이 방해가 될 수 있을까요?"],
        ["How could the people here support that?", "여기 있는 사람들이 어떤 방식으로 도울 수 있을까요?"],
        ["When would be a good time to revisit that?", "언제 다시 이 이야기를 꺼내 보면 좋을까요?"],
        ["What would success look like a year from now?", "1년 뒤 잘 되어 있다면 어떤 모습일까요?"],
        ["Is there a version of that we could actually do soon?", "그 아이디어 중 가까운 시일 내에 실제로 해 볼 수 있는 버전이 있을까요?"]
      ]
    }
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
    if (q?.mechanism && MECHANISMS[q.mechanism]) return q.mechanism;
    const text = `${q?.en || ""} ${q?.src || ""}`.toLowerCase();

    if (/thank|grateful|gratitude|appreciat|admire|kindness|proud of (him|her|them)|value about/.test(text)) {
      return "appreciation";
    }
    if (/good news|celebrat|excited|look forward|happy|joy|laugh|proud|win|went better|favorite.*recent/.test(text)) {
      return "positive_sharing";
    }
    if (/support|understood|listen|helpful|apolog|misunderstand|feel heard|stress|advice|comfort|reassur|check-in|check in/.test(text)) {
      return "responsiveness";
    }
    if (/remember|memory|childhood|used to|tradition|inside joke|growing up|earliest|years ago|shared history/.test(text)) {
      return "shared_history";
    }
    if (/changed|change in you|older|younger self|used to be|outgrown|version of you|become|identity/.test(text)) {
      return "identity_change";
    }
    if (/value|principle|honest|fair|loyal|promise|right thing|integrity|courage|dependable/.test(text)) {
      return "values_in_action";
    }
    if (/future|hope|next year|years from now|stay connected|someday|together.*later|ten years/.test(text)) {
      return "future_connection";
    }
    return "self_disclosure";
  }

  function normalizeSource(q) {
    const raw = String(q?.src || "").trim();
    if (!raw) {
      q.src = "Evidence-informed";
      return;
    }

    if (GENERIC_SOURCE_LABELS.has(raw.toLowerCase())) {
      if (!q.legacyCategory) q.legacyCategory = raw;
      q.src = "Evidence-informed";
    }
  }

  function ensureMetadata(q) {
    if (!q || typeof q !== "object") return q;
    q.mechanism = inferMechanism(q);
    normalizeSource(q);

    if (q.evidenceKey && EVIDENCE_KEY_MIGRATIONS[q.evidenceKey]) {
      q.evidenceKey = EVIDENCE_KEY_MIGRATIONS[q.evidenceKey];
    }
    const evidenceMap = window.CLOSENESS_EVIDENCE || {};
    if (!q.evidenceKey || !evidenceMap[q.evidenceKey]) {
      q.evidenceKey = EVIDENCE_BY_MECHANISM[q.mechanism] || "aron_laurenceau";
    }
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

  function canonicalQuestion(q) {
    if (!q || typeof questions === "undefined" || !Array.isArray(questions)) return q;
    if (q.id) {
      const byId = questions.find((candidate) => candidate?.id === q.id);
      if (byId) return byId;
    }
    const key = normalize(q.en);
    return questions.find((candidate) => normalize(candidate?.en) === key) || q;
  }

  function upgradeQuestionBank() {
    if (typeof questions === "undefined" || !Array.isArray(questions)) {
      console.warn("[Closeness] Existing `questions` array was not found. Check script order.");
      return false;
    }

    const curated = Array.isArray(window.CLOSENESS_CURATED_QUESTIONS)
      ? window.CLOSENESS_CURATED_QUESTIONS
      : [];

    const originalCount = questions.length;
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

    const removed = originalCount - preserved.length;
    questions.splice(0, questions.length, ...merged);

    // Removing generated prompts changes later indices. Rebuild the unused pool
    // by question text so existing saved sessions remain usable.
    if (typeof state !== "undefined" && state) {
      const used = new Set();

      if (Array.isArray(state.history)) {
        for (const item of state.history) {
          const en = extractUsedEnglish(item);
          if (en) used.add(normalize(en));
        }
      }

      if (state.currentQuestionObj?.en) {
        const canonical = canonicalQuestion(state.currentQuestionObj);
        state.currentQuestionObj = ensureMetadata(canonical);
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
      `[Closeness] Upgrade ${VERSION}: removed ${removed} repetitive generated prompts; ` +
      `curated bank ${curated.length}; final bank ${questions.length}.`
    );
    return true;
  }

  // ---------- Korean visibility ----------

  function showKoreanPreference() {
    const saved = localStorage.getItem(PREF_KEY);
    return saved === null ? true : saved !== "false";
  }

  function stripKorean(text) {
    let out = String(text ?? "");

    // Remove parenthetical/bracketed translations such as "Start (시작)" first.
    out = out
      .replace(/\s*\([^()]*[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF][^()]*\)/g, "")
      .replace(/\s*\[[^\[\]]*[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF][^\[\]]*\]/g, "");

    out = out
      .replace(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]+/g, "")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s+[\/|·]\s*$/g, "")
      .replace(/^\s*[\/|·]\s*/g, "")
      .replace(/\(\s*\)|\[\s*\]/g, "");

    return out.trimEnd();
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

    if (HANGUL_RE.test(current)) {
      originalText.set(node, current);
      const stripped = stripKorean(current);
      if (stripped !== current) node.nodeValue = stripped;
      return;
    }

    if (originalText.has(node) && current !== stripKorean(originalText.get(node))) {
      originalText.delete(node);
    }
  }

  function visibleAttributesFor(el) {
    const attrs = ["placeholder", "title", "aria-label", "alt"];
    if (el?.matches?.('input[type="button"],input[type="submit"],input[type="reset"]')) {
      attrs.push("value");
    }
    return attrs;
  }

  function processAttribute(el, attr, showKorean) {
    if (!el?.hasAttribute?.(attr)) return;
    if (!visibleAttributesFor(el).includes(attr)) return;
    let saved = originalAttributes.get(el);
    if (!saved) {
      saved = new Map();
      originalAttributes.set(el, saved);
    }

    const current = el.getAttribute(attr) || "";

    if (showKorean) {
      if (saved.has(attr)) {
        el.setAttribute(attr, saved.get(attr));
        saved.delete(attr);
      }
      return;
    }

    if (HANGUL_RE.test(current)) {
      saved.set(attr, current);
      const stripped = stripKorean(current);
      if (stripped !== current) el.setAttribute(attr, stripped);
      return;
    }

    if (saved.has(attr) && current !== stripKorean(saved.get(attr))) {
      saved.delete(attr);
    }
  }

  function processElementAttributes(el, showKorean) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    for (const attr of visibleAttributesFor(el)) processAttribute(el, attr, showKorean);
  }

  function walkLanguage(root, showKorean) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root, showKorean);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    if (root.nodeType === Node.ELEMENT_NODE) processElementAttributes(root, showKorean);

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) processTextNode(node, showKorean);
      else processElementAttributes(node, showKorean);
    }
  }

  function applyKoreanPreference(showKorean) {
    document.body.classList.toggle(HIDE_CLASS, !showKorean);
    walkLanguage(document.body, showKorean);

    const checkbox = document.getElementById("closeness-show-korean");
    if (checkbox) checkbox.checked = showKorean;
  }

  // ---------- Injected UI ----------

  function installStyles() {
    if (document.getElementById("closeness-upgrade-styles")) return;
    const style = document.createElement("style");
    style.id = "closeness-upgrade-styles";
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
      body.${HIDE_CLASS} .closeness-ko,
      body.${HIDE_CLASS} [lang="ko"] {
        display: none !important;
      }

      #closeness-conversation-aids {
        margin: .45rem 0 .75rem;
        width: 100%;
      }
      .closeness-followup-card {
        box-sizing: border-box;
        width: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        line-height: 1.42;
      }
      .closeness-followup-card > summary {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: .25rem;
        padding: .2rem 0;
        font-weight: 700;
        font-size: .95rem;
        line-height: 1.25;
        user-select: none;
      }
      .closeness-followup-card > summary::-webkit-details-marker {
        display: none;
      }
      .closeness-followup-card > summary::before {
        content: "›";
        display: inline-block;
        font-size: 1.1em;
        transform: translateY(-.02em);
      }
      .closeness-followup-card[open] > summary::before {
        transform: rotate(90deg);
      }
      .closeness-followup-expanded {
        margin-top: .4rem;
        border: 1px solid rgba(127, 127, 127, .24);
        border-radius: 10px;
        padding: .7rem .8rem;
        background: rgba(127, 127, 127, .05);
      }
      .closeness-listening-cue {
        margin: 0 0 .55rem;
      }
      .closeness-followup-label {
        font-weight: 700;
        margin-bottom: .2rem;
      }
      .closeness-followup-list {
        margin: .2rem 0 .55rem 1.15rem;
        padding: 0;
      }
      .closeness-followup-list li {
        margin: .25rem 0;
      }
      .closeness-meta-line {
        margin-top: .55rem;
        padding-top: .5rem;
        border-top: 1px solid rgba(127, 127, 127, .18);
        font-size: .82rem;
        line-height: 1.35;
        opacity: .78;
      }
      .closeness-evidence-details {
        margin-top: .4rem;
        font-size: .84rem;
      }
      .closeness-evidence-details summary {
        cursor: pointer;
        font-weight: 600;
      }
      .closeness-evidence-details p {
        margin: .4rem 0;
      }
      .closeness-evidence-details ul {
        margin: .35rem 0 .05rem 1.1rem;
        padding: 0;
      }
      .closeness-evidence-details li {
        margin: .3rem 0;
      }
      .closeness-evidence-details a {
        overflow-wrap: anywhere;
      }
      .closeness-evidence-note {
        opacity: .82;
        font-size: .9em;
      }
    `;
    document.head.appendChild(style);
  }

  function makeKoSpan(text, leadingSpace = true) {
    const span = document.createElement("span");
    span.className = "closeness-ko";
    span.lang = "ko";
    span.textContent = `${leadingSpace ? " " : ""}${text}`;
    return span;
  }

  function installLanguageToggle() {
    if (document.getElementById("closeness-language-control")) return;

    const control = document.createElement("div");
    control.id = "closeness-language-control";

    const label = document.createElement("label");
    label.htmlFor = "closeness-show-korean";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "closeness-show-korean";
    checkbox.checked = showKoreanPreference();

    const labelText = document.createElement("span");
    labelText.append("Show Korean", makeKoSpan("(한국어 표시)"));

    label.append(checkbox, labelText);
    control.appendChild(label);

    const anchor =
      document.getElementById("setup-area") ||
      document.querySelector("main") ||
      document.body.firstElementChild;

    if (anchor?.parentNode) anchor.parentNode.insertBefore(control, anchor);
    else document.body.prepend(control);

    checkbox.addEventListener("change", () => {
      localStorage.setItem(PREF_KEY, String(checkbox.checked));
      applyKoreanPreference(checkbox.checked);
    });
  }

  function mechanismInfo(q) {
    const key = inferMechanism(q);
    return { key, ...(MECHANISMS[key] || MECHANISMS.self_disclosure) };
  }

  function sourceDisplay(q) {
    const raw = String(q?.src || "").trim();
    const src = !raw || GENERIC_SOURCE_LABELS.has(raw.toLowerCase())
      ? "Evidence-informed"
      : raw;
    return {
      en: src,
      ko: src.toLowerCase() === "evidence-informed" ? "(연구 기반)" : null
    };
  }

  function buildEvidenceDetails(q) {
    const evidence = window.CLOSENESS_EVIDENCE?.[q?.evidenceKey];
    if (!evidence) return null;

    const details = document.createElement("details");
    details.className = "closeness-evidence-details";

    const summary = document.createElement("summary");
    summary.append("Why this may help", makeKoSpan("(왜 도움이 될 수 있나요?)"));
    details.appendChild(summary);

    const basis = document.createElement("p");
    basis.append(document.createTextNode(`Related evidence: ${evidence.labelEn || "Relationship research"}`));
    if (evidence.labelKo) basis.append(makeKoSpan(`관련 근거: ${evidence.labelKo}`));
    details.appendChild(basis);

    const disclaimer = document.createElement("p");
    disclaimer.className = "closeness-evidence-note";
    disclaimer.append(
      "This prompt is informed by the research below; this exact wording is not itself a validated scale item.",
      makeKoSpan("아래 연구를 바탕으로 만든 질문이며, 이 문장 자체가 별도로 검증된 척도 문항이라는 뜻은 아닙니다.")
    );
    details.appendChild(disclaimer);

    if (Array.isArray(evidence.citations) && evidence.citations.length) {
      const list = document.createElement("ul");
      for (const citation of evidence.citations) {
        const li = document.createElement("li");
        const main = `${citation.authors} (${citation.year}). ${citation.title}. ${citation.journal}. `;
        li.append(document.createTextNode(main));
        if (citation.doi) {
          const link = document.createElement("a");
          link.href = `https://doi.org/${citation.doi}`;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = `doi:${citation.doi}`;
          li.appendChild(link);
        }
        if (citation.noteEn) {
          const note = document.createElement("div");
          note.className = "closeness-evidence-note";
          note.append(citation.noteEn);
          if (citation.noteKo) note.append(makeKoSpan(citation.noteKo));
          li.appendChild(note);
        }
        list.appendChild(li);
      }
      details.appendChild(list);
    }

    return details;
  }

  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function followUpChoices(q, player) {
    const info = mechanismInfo(q);
    const choices = info.followUps || [];
    if (choices.length <= 3) return choices;

    const seed = `${q?.id || q?.en || "question"}|${player || 1}`;
    const start = hashString(seed) % choices.length;
    return [0, 1, 2].map((offset) => choices[(start + offset) % choices.length]);
  }

  function ensureConversationAids() {
    let panel = document.getElementById("closeness-conversation-aids");
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = "closeness-conversation-aids";
    panel.setAttribute("aria-live", "polite");
    panel.style.display = "none";

    const followup = document.createElement("details");
    followup.className = "closeness-followup-card";
    followup.id = "closeness-followup-card";

    panel.appendChild(followup);
    document.body.appendChild(panel);
    return panel;
  }

  function placeConversationAids(panel) {
    const currentPlayer = document.getElementById("current-player");
    if (currentPlayer?.parentNode) {
      if (panel.parentNode !== currentPlayer.parentNode || panel.nextSibling !== currentPlayer) {
        currentPlayer.parentNode.insertBefore(panel, currentPlayer);
      }
      return;
    }

    const currentQuestion =
      document.querySelector(".ko-q") ||
      document.querySelector(".en-q") ||
      document.getElementById("question-ko") ||
      document.getElementById("question-en") ||
      document.getElementById("question");

    if (currentQuestion?.parentNode) {
      currentQuestion.insertAdjacentElement("afterend", panel);
    }
  }

  let lastAidSignature = "";

  function renderConversationAids(force = false) {
    const panel = ensureConversationAids();
    placeConversationAids(panel);

    if (
      typeof state === "undefined" ||
      !state ||
      state.isStarted === false ||
      !state.currentQuestionObj?.en
    ) {
      panel.style.display = "none";
      lastAidSignature = "";
      return;
    }

    const q = ensureMetadata(canonicalQuestion(state.currentQuestionObj));
    if (q !== state.currentQuestionObj) state.currentQuestionObj = q;

    const player = Number(state.currentPlayer) || 1;
    const signature = `${normalize(q.en)}|${player}|${q.src}|${q.mechanism}|${q.evidenceKey}`;
    if (!force && signature === lastAidSignature) {
      panel.style.display = "";
      return;
    }
    lastAidSignature = signature;

    const followupCard = document.getElementById("closeness-followup-card");
    followupCard.replaceChildren();
    // Re-rendering on every speaker/question intentionally resets this closed.
    followupCard.open = false;

    const info = mechanismInfo(q);
    const src = sourceDisplay(q);

    const summary = document.createElement("summary");
    summary.append(
      "Listen, then follow up — optional",
      makeKoSpan("(먼저 듣고, 후속 질문 — 선택사항)")
    );

    const expanded = document.createElement("div");
    expanded.className = "closeness-followup-expanded";

    const cue = document.createElement("p");
    cue.className = "closeness-listening-cue";
    cue.append(info.cueEn, makeKoSpan(info.cueKo));

    const label = document.createElement("div");
    label.className = "closeness-followup-label";
    label.append("Try one if it fits:", makeKoSpan("어울리면 하나만 물어보세요:"));

    const list = document.createElement("ul");
    list.className = "closeness-followup-list";
    for (const [en, ko] of followUpChoices(q, player)) {
      const li = document.createElement("li");
      li.append(`“${en}”`, makeKoSpan(`“${ko}”`));
      list.appendChild(li);
    }

    const meta = document.createElement("div");
    meta.className = "closeness-meta-line";
    meta.append("Source: ");
    const sourceStrong = document.createElement("strong");
    sourceStrong.append(src.en);
    if (src.ko) sourceStrong.append(makeKoSpan(src.ko));
    meta.append(sourceStrong, " · Focus: ");
    const focusStrong = document.createElement("strong");
    focusStrong.append(info.labelEn, makeKoSpan(`(${info.labelKo})`));
    meta.appendChild(focusStrong);

    expanded.append(cue, label, list, meta);

    const evidenceDetails = buildEvidenceDetails(q);
    if (evidenceDetails) expanded.appendChild(evidenceDetails);

    followupCard.append(summary, expanded);
    panel.style.display = "";

    // Avoid a Korean flash if the preference is currently off.
    walkLanguage(panel, showKoreanPreference());
  }

  let aidRefreshScheduled = false;
  function scheduleAidRefresh(force = false) {
    if (aidRefreshScheduled && !force) return;
    aidRefreshScheduled = true;
    setTimeout(() => {
      aidRefreshScheduled = false;
      renderConversationAids(force);
    }, 0);
  }

  // ---------- Selection variety guard ----------

  function openingFamily(q) {
    const en = String(q?.en || "").trim().toLowerCase();
    if (!en) return "other";
    if (/^(tell|think|remember|describe)\b/.test(en)) return "prompt";
    if (/^(when|where|who|whose|which)\b/.test(en)) return en.split(/\s+/)[0];
    if (/^how\b/.test(en)) return "how";
    if (/^if\b/.test(en)) return "if";
    if (/^do\b|^is\b|^has\b|^are\b/.test(en)) return "yes-no-open";
    if (/^what\s+is\b/.test(en)) return "what-is";
    if (/^what\s+(do|does|did|have|has|are|were|would|can)\b/.test(en)) return `what-${RegExp.$1}`;
    if (/^what\s+kind\b/.test(en)) return "what-kind";
    return en.split(/\s+/).slice(0, 2).join(" ");
  }

  let withheldSelection = null;

  function currentQuestionKey() {
    if (typeof state === "undefined" || !state?.currentQuestionObj?.en) return "";
    return normalize(state.currentQuestionObj.en);
  }

  function restrictUnusedPool() {
    if (withheldSelection) return;
    if (typeof state === "undefined" || !state || !Array.isArray(state.unusedIndices)) return;
    if (typeof questions === "undefined" || !Array.isArray(questions)) return;

    const current = ensureMetadata(state.currentQuestionObj);
    if (!current?.en || state.unusedIndices.length < 2) return;

    const lastMechanism = inferMechanism(current);
    const lastOpening = openingFamily(current);
    const all = state.unusedIndices.filter((index) => questions[index]);
    const differentMechanism = all.filter((index) => inferMechanism(questions[index]) !== lastMechanism);
    const ideal = differentMechanism.filter((index) => openingFamily(questions[index]) !== lastOpening);

    const allowed = ideal.length ? ideal : (differentMechanism.length ? differentMechanism : all);
    if (allowed.length === all.length) return;

    const allowedSet = new Set(allowed);
    const withheld = all.filter((index) => !allowedSet.has(index));
    if (!withheld.length) return;

    withheldSelection = {
      indices: withheld,
      previousQuestionKey: currentQuestionKey(),
      startedAt: performance.now()
    };
    state.unusedIndices.splice(0, state.unusedIndices.length, ...allowed);
  }

  function restoreUnusedPool() {
    if (!withheldSelection) return;
    const withheld = withheldSelection.indices;

    if (typeof state !== "undefined" && Array.isArray(state?.unusedIndices)) {
      for (const index of withheld) {
        if (!state.unusedIndices.includes(index)) state.unusedIndices.push(index);
      }
      saveStateSafely();
    }
    withheldSelection = null;
  }

  function restoreAfterQuestionChanges() {
    if (!withheldSelection) return;
    const check = () => {
      if (!withheldSelection) return;
      const changed = currentQuestionKey() !== withheldSelection.previousQuestionKey;
      const timedOut = performance.now() - withheldSelection.startedAt > 750;
      if (changed || timedOut) {
        restoreUnusedPool();
        scheduleAidRefresh(true);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  function installSelectionGuard() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("#nextBtn");
      if (!button) return;

      if (
        typeof state !== "undefined" &&
        state &&
        Number(state.currentPlayer) >= Number(state.numPeople)
      ) {
        restrictUnusedPool();
        restoreAfterQuestionChanges();
      }
    }, true);

    document.addEventListener("click", (event) => {
      if (event.target.closest?.("#nextBtn")) scheduleAidRefresh(true);
    });
  }

  // ---------- Mutation observer ----------

  function installObserver() {
    const observer = new MutationObserver((mutations) => {
      const showKorean = showKoreanPreference();
      let shouldRefreshAids = false;

      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          processTextNode(mutation.target, showKorean);
        } else if (mutation.type === "attributes") {
          processAttribute(mutation.target, mutation.attributeName, showKorean);
        } else {
          for (const added of mutation.addedNodes) walkLanguage(added, showKorean);
        }

        const elementTarget = mutation.target.nodeType === Node.ELEMENT_NODE
          ? mutation.target
          : mutation.target.parentElement;
        if (
          !elementTarget?.closest?.("#closeness-conversation-aids, #closeness-language-control")
        ) {
          shouldRefreshAids = true;
        }
      }

      if (shouldRefreshAids) scheduleAidRefresh();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt", "value"]
    });
  }

  function diagnostics() {
    let counts = {};
    if (typeof questions !== "undefined" && Array.isArray(questions)) {
      counts = questions.reduce((acc, q) => {
        const key = inferMechanism(q);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    }
    return {
      version: VERSION,
      finalQuestionCount: typeof questions !== "undefined" && Array.isArray(questions) ? questions.length : null,
      curatedQuestionCount: Array.isArray(window.CLOSENESS_CURATED_QUESTIONS) ? window.CLOSENESS_CURATED_QUESTIONS.length : 0,
      mechanismCounts: counts,
      showKorean: showKoreanPreference(),
      currentMechanism: typeof state !== "undefined" && state?.currentQuestionObj ? inferMechanism(state.currentQuestionObj) : null
    };
  }

  function boot() {
    installStyles();
    upgradeQuestionBank();
    installLanguageToggle();
    ensureConversationAids();
    installSelectionGuard();
    installObserver();
    applyKoreanPreference(showKoreanPreference());
    renderConversationAids(true);

    window.CLOSENESS_UPGRADE = {
      version: VERSION,
      diagnostics,
      refresh: () => renderConversationAids(true)
    };
  }

  // The existing app restores state in window.onload. Run just after that so
  // saved state is migrated before this upgrade renders its own UI.
  if (document.readyState === "complete") {
    setTimeout(boot, 0);
  } else {
    window.addEventListener("load", () => setTimeout(boot, 0), { once: true });
  }
})();
