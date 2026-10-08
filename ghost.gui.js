(() => {
  // lifecycle.js
  function createLifecycle(options = {}) {
    const native = globalThis;
    const clock = options.clock || { now: () => Date.now(), setTimeout: (f, ms) => native.setTimeout(f, ms), clearTimeout: (id) => native.clearTimeout(id) };
    let active = false, disposed = false;
    const pending = /* @__PURE__ */ new Map();
    const abort = () => Object.assign(new Error("Operation stopped"), { name: "AbortError" });
    const emit = (name, data) => {
      try {
        options[name]?.(data);
      } catch {
      }
    };
    return {
      clock,
      emit,
      get active() {
        return active;
      },
      begin() {
        if (disposed) throw Error("Engine disposed");
        active = true;
      },
      check() {
        if (!active) throw abort();
      },
      sleep(ms) {
        if (!active) return Promise.reject(abort());
        return new Promise((resolve, reject) => {
          const id = clock.setTimeout(() => {
            pending.delete(id);
            if (active) resolve();
            else reject(abort());
          }, Math.max(0, ms));
          pending.set(id, reject);
        });
      },
      stop() {
        active = false;
        for (const [id, reject] of pending) {
          clock.clearTimeout(id);
          reject(abort());
        }
        pending.clear();
      },
      dispose() {
        this.stop();
        disposed = true;
      },
      error(e) {
        if (e?.name !== "AbortError") emit("onError", { message: e.message });
      }
    };
  }
  function requireDocument(options) {
    const document2 = options.document || globalThis.document;
    if (!document2?.defaultView) throw Error("A browser document with defaultView is required");
    return document2;
  }

  // patterns.js
  function createPatternFinder(document2, options = {}) {
    const window2 = document2.defaultView;
    const { Element, HTMLElement, Node, XPathResult } = window2;
    const getComputedStyle = window2.getComputedStyle.bind(window2);
    const Date2 = { now: options.now || (() => globalThis.Date.now()) };
    const console = { log() {
    }, debug() {
    }, warn(...args) {
      options.onDiagnostic?.({ level: "warning", message: args.map(String).join(" ") });
    }, error(...args) {
      options.onDiagnostic?.({ level: "error", message: args.map(String).join(" ") });
    } };
    class ElementFingerprinter {
      constructor() {
        this.fingerprintCache = /* @__PURE__ */ new Map();
      }
      createElementFingerprint(element) {
        if (!element) return null;
        const fingerprint = {
          // High stability attributes
          textContent: this.normalizeText(element.textContent),
          innerText: this.normalizeText(element.innerText),
          ariaLabel: element.getAttribute("aria-label"),
          role: element.getAttribute("role"),
          ariaDescribedBy: element.getAttribute("aria-describedby"),
          title: element.getAttribute("title"),
          placeholder: element.getAttribute("placeholder"),
          alt: element.getAttribute("alt"),
          dataAttributes: this.getDataAttributes(element),
          name: element.getAttribute("name"),
          type: element.getAttribute("type"),
          // Medium stability attributes
          tagName: element.tagName.toLowerCase(),
          elementType: this.getElementType(element),
          parentTag: element.parentElement ? element.parentElement.tagName.toLowerCase() : null,
          siblingIndex: this.getSiblingIndex(element),
          childrenCount: element.children.length,
          isVisible: this.isElementVisible(element),
          // Low stability attributes (used as fallbacks)
          id: element.id,
          className: element.className,
          classList: Array.from(element.classList),
          // Structural context
          parentClasses: element.parentElement ? Array.from(element.parentElement.classList) : [],
          nearestButtonText: this.getNearestButtonText(element),
          nearestLabelText: this.getNearestLabelText(element),
          // Visual indicators
          hasIcon: this.hasIcon(element),
          iconType: this.getIconType(element),
          // Form-specific
          isSubmitButton: element.type === "submit" || element.getAttribute("type") === "submit",
          formId: element.form ? element.form.id : null,
          // Position in list
          listContext: this.getListContext(element),
          // Timestamp for cache validation
          timestamp: Date2.now()
        };
        return fingerprint;
      }
      normalizeText(text) {
        if (!text) return "";
        return text.trim().toLowerCase().replace(/\s+/g, " ");
      }
      getDataAttributes(element) {
        const dataAttrs = {};
        for (let attr of element.attributes) {
          if (attr.name.startsWith("data-")) {
            dataAttrs[attr.name] = attr.value;
          }
        }
        return dataAttrs;
      }
      getElementType(element) {
        if (element.tagName === "BUTTON") return "button";
        if (element.tagName === "A") return "link";
        if (element.tagName === "INPUT") return element.type || "input";
        if (element.tagName === "DIV" && element.getAttribute("role") === "button") return "div-button";
        if (element.tagName === "SPAN" && element.parent && element.parent.tagName === "BUTTON") return "button-text";
        return element.tagName.toLowerCase();
      }
      getSiblingIndex(element) {
        if (!element.parentElement) return 0;
        const siblings = Array.from(element.parentElement.children);
        return siblings.indexOf(element);
      }
      isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window2.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      }
      getNearestButtonText(element, maxLevels = 3) {
        let current = element;
        let level = 0;
        while (current && level < maxLevels) {
          const buttons = current.querySelectorAll("button");
          if (buttons.length > 0) {
            return this.normalizeText(buttons[0].textContent);
          }
          current = current.parentElement;
          level++;
        }
        return null;
      }
      getNearestLabelText(element, maxLevels = 3) {
        if (element.id) {
          const label = document2.querySelector(`label[for="${element.id}"]`);
          if (label) return this.normalizeText(label.textContent);
        }
        let current = element;
        let level = 0;
        while (current && level < maxLevels) {
          if (current.tagName === "LABEL") {
            return this.normalizeText(current.textContent);
          }
          const labels = current.querySelectorAll("label");
          if (labels.length > 0) {
            return this.normalizeText(labels[0].textContent);
          }
          current = current.parentElement;
          level++;
        }
        return null;
      }
      hasIcon(element) {
        return element.querySelector("svg") !== null || element.querySelector("img") !== null || element.querySelector("i") !== null;
      }
      getIconType(element) {
        if (element.querySelector("svg")) return "svg";
        if (element.querySelector("img")) return "img";
        if (element.querySelector("i")) return "icon-font";
        return null;
      }
      getListContext(element) {
        const listItem = element.closest("li");
        if (!listItem) return null;
        const list = listItem.parentElement;
        if (!list || list.tagName !== "UL" && list.tagName !== "OL") return null;
        const items = Array.from(list.children);
        const index = items.indexOf(listItem);
        return {
          listTag: list.tagName.toLowerCase(),
          itemIndex: index,
          totalItems: items.length,
          listClasses: Array.from(list.classList),
          isFirst: index === 0,
          isLast: index === items.length - 1
        };
      }
      compareFingerprints(fp1, fp2) {
        if (!fp1 || !fp2) return 0;
        const weights = {
          textContent: 0.25,
          innerText: 0.15,
          ariaLabel: 0.15,
          role: 0.1,
          tagName: 0.08,
          elementType: 0.07,
          title: 0.05,
          dataAttributes: 0.05,
          classList: 0.03,
          parentClasses: 0.03,
          nearestButtonText: 0.02,
          nearestLabelText: 0.02
        };
        let totalScore = 0;
        let totalWeight = 0;
        for (const [key, weight] of Object.entries(weights)) {
          let score = 0;
          if (key === "textContent" || key === "innerText") {
            score = this.textSimilarity(fp1[key], fp2[key]);
          } else if (key === "classList" || key === "parentClasses") {
            score = this.arraySimilarity(fp1[key], fp2[key]);
          } else if (key === "dataAttributes") {
            score = this.objectSimilarity(fp1[key], fp2[key]);
          } else {
            score = fp1[key] === fp2[key] ? 1 : 0;
          }
          totalScore += score * weight;
          totalWeight += weight;
        }
        return totalWeight > 0 ? totalScore / totalWeight : 0;
      }
      textSimilarity(text1, text2) {
        if (!text1 && !text2) return 1;
        if (!text1 || !text2) return 0;
        const normalized1 = this.normalizeText(text1);
        const normalized2 = this.normalizeText(text2);
        if (normalized1 === normalized2) return 1;
        if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
          return 0.8;
        }
        const distance = this.levenshteinDistance(normalized1, normalized2);
        const maxLength = Math.max(normalized1.length, normalized2.length);
        return maxLength > 0 ? 1 - distance / maxLength : 0;
      }
      levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
          matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
          matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
          for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[str2.length][str1.length];
      }
      arraySimilarity(arr1, arr2) {
        if (!arr1 && !arr2) return 1;
        if (!arr1 || !arr2) return 0;
        if (arr1.length === 0 && arr2.length === 0) return 1;
        if (arr1.length === 0 || arr2.length === 0) return 0;
        const set1 = new Set(arr1);
        const set2 = new Set(arr2);
        const intersection = new Set([...set1].filter((x) => set2.has(x)));
        const union = /* @__PURE__ */ new Set([...set1, ...set2]);
        return union.size > 0 ? intersection.size / union.size : 0;
      }
      objectSimilarity(obj1, obj2) {
        if (!obj1 && !obj2) return 1;
        if (!obj1 || !obj2) return 0;
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (keys1.length === 0 && keys2.length === 0) return 1;
        if (keys1.length === 0 || keys2.length === 0) return 0;
        let matches = 0;
        const allKeys = /* @__PURE__ */ new Set([...keys1, ...keys2]);
        for (const key of allKeys) {
          if (obj1[key] === obj2[key]) {
            matches++;
          }
        }
        return matches / allKeys.size;
      }
    }
    class SimilarityCalculator {
      constructor() {
        this.weights = {
          textContent: 0.4,
          structure: 0.3,
          semantic: 0.2,
          other: 0.1
        };
      }
      calculateSimilarity(element, fingerprint, options2 = {}) {
        if (!element || !fingerprint) return 0;
        const elementFingerprint = new ElementFingerprinter().createElementFingerprint(element);
        if (!elementFingerprint) return 0;
        const scores = {
          text: this.calculateTextSimilarity(elementFingerprint, fingerprint),
          structure: this.calculateStructuralSimilarity(elementFingerprint, fingerprint),
          semantic: this.calculateSemanticSimilarity(elementFingerprint, fingerprint),
          other: this.calculateOtherSimilarity(elementFingerprint, fingerprint)
        };
        const weights = { ...this.weights, ...options2.weights };
        const weightedScore = scores.text * weights.textContent + scores.structure * weights.structure + scores.semantic * weights.semantic + scores.other * weights.other;
        const threshold = options2.threshold || 0.7;
        return {
          score: weightedScore,
          meets_threshold: weightedScore >= threshold,
          breakdown: scores,
          confidence: this.calculateConfidence(scores, weightedScore)
        };
      }
      calculateTextSimilarity(fp1, fp2) {
        const textFields = ["textContent", "innerText", "title", "placeholder", "alt"];
        let totalScore = 0;
        let validFields = 0;
        for (const field of textFields) {
          if (fp1[field] || fp2[field]) {
            validFields++;
            totalScore += this.fuzzyTextMatch(fp1[field], fp2[field]);
          }
        }
        if (fp1.nearestButtonText || fp2.nearestButtonText) {
          validFields++;
          totalScore += this.fuzzyTextMatch(fp1.nearestButtonText, fp2.nearestButtonText) * 0.5;
        }
        if (fp1.nearestLabelText || fp2.nearestLabelText) {
          validFields++;
          totalScore += this.fuzzyTextMatch(fp1.nearestLabelText, fp2.nearestLabelText) * 0.5;
        }
        return validFields > 0 ? totalScore / validFields : 0;
      }
      calculateStructuralSimilarity(fp1, fp2) {
        const scores = [];
        scores.push(fp1.tagName === fp2.tagName ? 1 : 0);
        scores.push(fp1.elementType === fp2.elementType ? 1 : 0);
        scores.push(fp1.parentTag === fp2.parentTag ? 0.8 : 0);
        if (fp1.siblingIndex !== null && fp2.siblingIndex !== null) {
          const indexDiff = Math.abs(fp1.siblingIndex - fp2.siblingIndex);
          scores.push(indexDiff === 0 ? 1 : indexDiff === 1 ? 0.5 : 0);
        }
        if (fp1.listContext && fp2.listContext) {
          scores.push(this.compareListContext(fp1.listContext, fp2.listContext));
        }
        const classSimilarity = this.calculateArraySimilarity(fp1.classList, fp2.classList);
        scores.push(classSimilarity);
        const parentClassSimilarity = this.calculateArraySimilarity(fp1.parentClasses, fp2.parentClasses);
        scores.push(parentClassSimilarity * 0.5);
        return scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      calculateSemanticSimilarity(fp1, fp2) {
        const scores = [];
        if (fp1.ariaLabel || fp2.ariaLabel) {
          scores.push(this.fuzzyTextMatch(fp1.ariaLabel, fp2.ariaLabel));
        }
        if (fp1.role === fp2.role && fp1.role) {
          scores.push(1);
        } else if (fp1.role || fp2.role) {
          scores.push(0);
        }
        if (fp1.type === fp2.type && fp1.type) {
          scores.push(1);
        }
        if (fp1.name === fp2.name && fp1.name) {
          scores.push(1);
        }
        if (fp1.isSubmitButton === fp2.isSubmitButton) {
          scores.push(1);
        }
        const dataAttrScore = this.compareDataAttributes(fp1.dataAttributes, fp2.dataAttributes);
        if (dataAttrScore !== null) {
          scores.push(dataAttrScore);
        }
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;
      }
      calculateOtherSimilarity(fp1, fp2) {
        const scores = [];
        if (fp1.isVisible === fp2.isVisible) {
          scores.push(1);
        }
        if (fp1.hasIcon === fp2.hasIcon) {
          scores.push(0.8);
          if (fp1.hasIcon && fp1.iconType === fp2.iconType) {
            scores.push(1);
          }
        }
        if (fp1.id && fp2.id && fp1.id === fp2.id) {
          scores.push(1);
        }
        if (fp1.childrenCount !== void 0 && fp2.childrenCount !== void 0) {
          const diff = Math.abs(fp1.childrenCount - fp2.childrenCount);
          scores.push(diff === 0 ? 1 : diff === 1 ? 0.5 : 0);
        }
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;
      }
      fuzzyTextMatch(text1, text2) {
        if (!text1 && !text2) return 1;
        if (!text1 || !text2) return 0;
        const normalized1 = this.normalizeText(text1);
        const normalized2 = this.normalizeText(text2);
        if (normalized1 === normalized2) return 1;
        if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
          const ratio = Math.min(normalized1.length, normalized2.length) / Math.max(normalized1.length, normalized2.length);
          return 0.5 + ratio * 0.5;
        }
        const distance = this.levenshteinDistance(normalized1, normalized2);
        const maxLength = Math.max(normalized1.length, normalized2.length);
        const similarity = 1 - distance / maxLength;
        const tokens1 = normalized1.split(" ");
        const tokens2 = normalized2.split(" ");
        const tokenSimilarity = this.calculateArraySimilarity(tokens1, tokens2);
        return similarity * 0.7 + tokenSimilarity * 0.3;
      }
      normalizeText(text) {
        if (!text) return "";
        return text.toString().trim().toLowerCase().replace(/\s+/g, " ");
      }
      levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
          matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
          matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
          for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[str2.length][str1.length];
      }
      calculateArraySimilarity(arr1, arr2) {
        if (!arr1 && !arr2) return 1;
        if (!arr1 || !arr2) return 0;
        if (arr1.length === 0 && arr2.length === 0) return 1;
        if (arr1.length === 0 || arr2.length === 0) return 0.2;
        const set1 = new Set(arr1);
        const set2 = new Set(arr2);
        const intersection = new Set([...set1].filter((x) => set2.has(x)));
        const union = /* @__PURE__ */ new Set([...set1, ...set2]);
        return union.size > 0 ? intersection.size / union.size : 0;
      }
      compareListContext(context1, context2) {
        if (!context1 || !context2) return 0;
        let score = 0;
        let factors = 0;
        if (context1.listTag === context2.listTag) {
          score += 1;
          factors++;
        }
        if (context1.isFirst === context2.isFirst) {
          score += 1;
          factors++;
        }
        if (context1.isLast === context2.isLast) {
          score += 1;
          factors++;
        }
        if (context1.totalItems > 0 && context2.totalItems > 0) {
          const relPos1 = context1.itemIndex / context1.totalItems;
          const relPos2 = context2.itemIndex / context2.totalItems;
          const posDiff = Math.abs(relPos1 - relPos2);
          score += 1 - posDiff;
          factors++;
        }
        return factors > 0 ? score / factors : 0;
      }
      compareDataAttributes(data1, data2) {
        if (!data1 && !data2) return null;
        if (!data1 || !data2) return 0;
        const keys1 = Object.keys(data1);
        const keys2 = Object.keys(data2);
        if (keys1.length === 0 && keys2.length === 0) return null;
        if (keys1.length === 0 || keys2.length === 0) return 0;
        let matches = 0;
        let total = 0;
        const allKeys = /* @__PURE__ */ new Set([...keys1, ...keys2]);
        for (const key of allKeys) {
          total++;
          if (data1[key] === data2[key] && data1[key] !== void 0) {
            matches++;
          } else if (data1[key] && data2[key]) {
            matches += 0.3;
          }
        }
        return total > 0 ? matches / total : 0;
      }
      calculateConfidence(scores, weightedScore) {
        const values = Object.values(scores);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const consistencyScore = 1 - Math.min(stdDev, 1);
        return {
          level: weightedScore >= 0.9 ? "high" : weightedScore >= 0.7 ? "medium" : "low",
          score: (weightedScore + consistencyScore) / 2,
          consistency: consistencyScore
        };
      }
    }
    class SmartElementFinder {
      constructor() {
        this.fingerprinter = new ElementFingerprinter();
        this.similarityCalculator = new SimilarityCalculator();
        this.cache = /* @__PURE__ */ new Map();
        this.cacheTimeout = 5 * 60 * 1e3;
        this.searchStrategies = [
          "cached",
          "exactMatch",
          "textBased",
          "ariaBased",
          "structuralBased",
          "fuzzyMatch"
        ];
      }
      async findElement(targetFingerprint, options2 = {}) {
        const {
          fallbackSelectors = [],
          threshold = 0.7,
          useCache = true,
          maxCandidates = 50,
          timeout = 5e3
        } = options2;
        const startTime = Date2.now();
        if (useCache) {
          const cachedResult = this.getCachedElement(targetFingerprint);
          if (cachedResult && this.validateCachedElement(cachedResult.element, targetFingerprint)) {
            return {
              element: cachedResult.element,
              confidence: 1,
              method: "cached",
              timeMs: Date2.now() - startTime
            };
          }
        }
        for (const selector of fallbackSelectors) {
          try {
            const elements = document2.querySelectorAll(selector);
            for (const element of elements) {
              const similarity = this.similarityCalculator.calculateSimilarity(element, targetFingerprint, { threshold });
              if (similarity.meets_threshold) {
                if (useCache) {
                  this.cacheElement(targetFingerprint, element, selector);
                }
                return {
                  element,
                  confidence: similarity.score,
                  method: "fallback",
                  selector,
                  timeMs: Date2.now() - startTime
                };
              }
            }
          } catch (e) {
            console.warn("Invalid fallback selector:", selector, e);
          }
        }
        let candidates = [];
        for (const strategy of this.searchStrategies) {
          if (Date2.now() - startTime > timeout) {
            console.warn("Element search timeout exceeded");
            break;
          }
          const strategyCandidates = this.findCandidatesByStrategy(strategy, targetFingerprint, maxCandidates);
          candidates = this.mergeCandidates(candidates, strategyCandidates);
          const highConfidenceMatch = candidates.find((c) => c.similarity.score >= 0.9);
          if (highConfidenceMatch) {
            if (useCache) {
              this.cacheElement(targetFingerprint, highConfidenceMatch.element);
            }
            return {
              element: highConfidenceMatch.element,
              confidence: highConfidenceMatch.similarity.score,
              method: `pattern-${strategy}`,
              timeMs: Date2.now() - startTime
            };
          }
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.similarity.score - a.similarity.score);
          const best = candidates[0];
          if (best.similarity.meets_threshold) {
            if (useCache) {
              this.cacheElement(targetFingerprint, best.element);
            }
            return {
              element: best.element,
              confidence: best.similarity.score,
              method: "pattern-best",
              breakdown: best.similarity.breakdown,
              timeMs: Date2.now() - startTime
            };
          }
        }
        return {
          element: null,
          confidence: 0,
          method: "none",
          timeMs: Date2.now() - startTime,
          candidatesEvaluated: candidates.length
        };
      }
      findCandidatesByStrategy(strategy, targetFingerprint, maxCandidates) {
        const candidates = [];
        switch (strategy) {
          case "textBased":
            if (targetFingerprint.textContent) {
              candidates.push(...this.findByText(targetFingerprint.textContent, targetFingerprint.tagName));
            }
            if (targetFingerprint.ariaLabel) {
              candidates.push(...this.findByAriaLabel(targetFingerprint.ariaLabel));
            }
            break;
          case "ariaBased":
            if (targetFingerprint.role) {
              candidates.push(...this.findByRole(targetFingerprint.role, targetFingerprint.tagName));
            }
            if (targetFingerprint.ariaDescribedBy) {
              candidates.push(...this.findByAriaDescribedBy(targetFingerprint.ariaDescribedBy));
            }
            break;
          case "structuralBased":
            candidates.push(...this.findByStructure(targetFingerprint));
            break;
          case "exactMatch":
            candidates.push(...this.findByExactAttributes(targetFingerprint));
            break;
          case "fuzzyMatch":
            candidates.push(...this.findByFuzzyMatch(targetFingerprint, maxCandidates));
            break;
        }
        return candidates.slice(0, maxCandidates).map((element) => ({
          element,
          similarity: this.similarityCalculator.calculateSimilarity(element, targetFingerprint)
        })).filter((candidate) => candidate.similarity.score > 0.3);
      }
      findByText(text, preferredTag = null) {
        const normalizedText = this.fingerprinter.normalizeText(text);
        const candidates = [];
        const xpathExact = `//*[normalize-space(text())='${normalizedText}']`;
        candidates.push(...this.evaluateXPath(xpathExact));
        const xpathContains = `//*[contains(normalize-space(text()), '${normalizedText}')]`;
        candidates.push(...this.evaluateXPath(xpathContains));
        const textSelectors = [
          "button",
          "a",
          "label",
          "span",
          "div",
          "p",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6"
        ];
        for (const selector of textSelectors) {
          if (!preferredTag || selector === preferredTag) {
            const elements = document2.querySelectorAll(selector);
            for (const element of elements) {
              const elementText = this.fingerprinter.normalizeText(element.textContent);
              if (elementText.includes(normalizedText) || normalizedText.includes(elementText)) {
                candidates.push(element);
              }
            }
          }
        }
        return [...new Set(candidates)];
      }
      findByAriaLabel(ariaLabel) {
        return Array.from(document2.querySelectorAll(`[aria-label="${ariaLabel}"]`));
      }
      findByRole(role, preferredTag = null) {
        const elements = document2.querySelectorAll(`[role="${role}"]`);
        if (!preferredTag) {
          return Array.from(elements);
        }
        return Array.from(elements).filter((el) => el.tagName.toLowerCase() === preferredTag);
      }
      findByAriaDescribedBy(ariaDescribedBy) {
        return Array.from(document2.querySelectorAll(`[aria-describedby="${ariaDescribedBy}"]`));
      }
      findByStructure(fingerprint) {
        const candidates = [];
        if (fingerprint.tagName && fingerprint.parentTag) {
          const selector = `${fingerprint.parentTag} > ${fingerprint.tagName}`;
          candidates.push(...document2.querySelectorAll(selector));
        }
        if (fingerprint.tagName && fingerprint.classList && fingerprint.classList.length > 0) {
          const classSelector = fingerprint.classList.map((c) => `.${c}`).join("");
          const selector = `${fingerprint.tagName}${classSelector}`;
          try {
            candidates.push(...document2.querySelectorAll(selector));
          } catch (e) {
          }
        }
        if (fingerprint.listContext) {
          const lists = document2.querySelectorAll(fingerprint.listContext.listTag);
          for (const list of lists) {
            if (fingerprint.listContext.isFirst) {
              const firstItem = list.firstElementChild;
              if (firstItem) {
                candidates.push(...firstItem.querySelectorAll(fingerprint.tagName));
              }
            } else if (fingerprint.listContext.isLast) {
              const lastItem = list.lastElementChild;
              if (lastItem) {
                candidates.push(...lastItem.querySelectorAll(fingerprint.tagName));
              }
            }
          }
        }
        return [...new Set(candidates)];
      }
      findByExactAttributes(fingerprint) {
        const candidates = [];
        const attributeSelectors = [];
        if (fingerprint.id) {
          attributeSelectors.push(`#${CSS.escape(fingerprint.id)}`);
        }
        if (fingerprint.name) {
          attributeSelectors.push(`[name="${fingerprint.name}"]`);
        }
        if (fingerprint.type) {
          attributeSelectors.push(`[type="${fingerprint.type}"]`);
        }
        if (fingerprint.title) {
          attributeSelectors.push(`[title="${fingerprint.title}"]`);
        }
        if (fingerprint.placeholder) {
          attributeSelectors.push(`[placeholder="${fingerprint.placeholder}"]`);
        }
        for (const selector of attributeSelectors) {
          try {
            candidates.push(...document2.querySelectorAll(selector));
          } catch (e) {
            console.warn("Invalid attribute selector:", selector);
          }
        }
        if (fingerprint.dataAttributes) {
          for (const [key, value] of Object.entries(fingerprint.dataAttributes)) {
            try {
              candidates.push(...document2.querySelectorAll(`[${key}="${value}"]`));
            } catch (e) {
              console.warn("Invalid data attribute selector:", key, value);
            }
          }
        }
        return [...new Set(candidates)];
      }
      findByFuzzyMatch(fingerprint, maxCandidates) {
        const candidates = [];
        const tagName = fingerprint.tagName || "*";
        const elements = document2.querySelectorAll(tagName);
        const scoredElements = [];
        for (const element of elements) {
          const similarity = this.similarityCalculator.calculateSimilarity(element, fingerprint);
          if (similarity.score > 0.3) {
            scoredElements.push({ element, score: similarity.score });
          }
        }
        scoredElements.sort((a, b) => b.score - a.score);
        return scoredElements.slice(0, maxCandidates).map((item) => item.element);
      }
      evaluateXPath(xpath) {
        try {
          const result = document2.evaluate(
            xpath,
            document2,
            null,
            XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          const elements = [];
          for (let i = 0; i < result.snapshotLength; i++) {
            elements.push(result.snapshotItem(i));
          }
          return elements;
        } catch (e) {
          console.warn("XPath evaluation failed:", xpath, e);
          return [];
        }
      }
      mergeCandidates(existing, newCandidates) {
        const elementSet = new Set(existing.map((c) => c.element));
        const merged = [...existing];
        for (const candidate of newCandidates) {
          if (!elementSet.has(candidate.element)) {
            merged.push(candidate);
            elementSet.add(candidate.element);
          }
        }
        return merged;
      }
      getCachedElement(fingerprint) {
        const cacheKey = this.generateCacheKey(fingerprint);
        const cached = this.cache.get(cacheKey);
        if (cached && Date2.now() - cached.timestamp < this.cacheTimeout) {
          return cached;
        }
        if (cached) {
          this.cache.delete(cacheKey);
        }
        return null;
      }
      validateCachedElement(element, fingerprint) {
        if (!document2.contains(element)) {
          return false;
        }
        const currentFingerprint = this.fingerprinter.createElementFingerprint(element);
        if (fingerprint.textContent && currentFingerprint.textContent !== fingerprint.textContent) {
          return false;
        }
        if (fingerprint.role && currentFingerprint.role !== fingerprint.role) {
          return false;
        }
        if (currentFingerprint.tagName !== fingerprint.tagName) {
          return false;
        }
        return true;
      }
      cacheElement(fingerprint, element, selector = null) {
        const cacheKey = this.generateCacheKey(fingerprint);
        this.cache.set(cacheKey, {
          element,
          selector,
          fingerprint,
          timestamp: Date2.now()
        });
        this.cleanCache();
      }
      generateCacheKey(fingerprint) {
        const keyParts = [
          fingerprint.textContent,
          fingerprint.ariaLabel,
          fingerprint.role,
          fingerprint.tagName,
          fingerprint.name
        ].filter(Boolean);
        return keyParts.join("|");
      }
      cleanCache() {
        const now = Date2.now();
        const keysToDelete = [];
        for (const [key, value] of this.cache.entries()) {
          if (now - value.timestamp > this.cacheTimeout) {
            keysToDelete.push(key);
          }
        }
        for (const key of keysToDelete) {
          this.cache.delete(key);
        }
      }
      clearCache() {
        this.cache.clear();
      }
      generateStableSelector(element) {
        const selectors = [];
        if (element.id && this.isStableIdentifier(element.id)) {
          selectors.push(`#${CSS.escape(element.id)}`);
        }
        const ariaLabel = element.getAttribute("aria-label");
        if (ariaLabel) {
          selectors.push(`[aria-label="${ariaLabel}"]`);
        }
        const role = element.getAttribute("role");
        if (role) {
          selectors.push(`${element.tagName.toLowerCase()}[role="${role}"]`);
        }
        for (const attr of element.attributes) {
          if (attr.name.startsWith("data-") && this.isStableIdentifier(attr.value)) {
            selectors.push(`[${attr.name}="${attr.value}"]`);
          }
        }
        for (const selector of selectors) {
          try {
            const matches = document2.querySelectorAll(selector);
            if (matches.length === 1 && matches[0] === element) {
              return selector;
            }
          } catch (e) {
          }
        }
        return null;
      }
      isStableIdentifier(value) {
        if (!value) return false;
        const unstablePatterns = [
          /\d{10,}/,
          // Long numbers
          /[a-f0-9]{8,}/i,
          // Hex strings
          /uuid/i,
          /temp/i,
          /random/i,
          /-\d+$/
          // Ends with numbers
        ];
        for (const pattern of unstablePatterns) {
          if (pattern.test(value)) {
            return false;
          }
        }
        return true;
      }
    }
    const ELEMENT_FINGERPRINTS = {
      // Element 1: Camera button to open snap creation
      cameraButton: {
        fingerprint: {
          tagName: "button",
          elementType: "button",
          parentTag: "div",
          classList: ["qJKfS"],
          parentClasses: ["Jq_5_"],
          textContent: "",
          innerText: "",
          ariaLabel: null,
          role: null,
          hasIcon: true,
          iconType: "svg",
          childrenCount: 2,
          isVisible: true,
          nearestLabelText: "click the camera to send snaps",
          title: null,
          type: "button"
        },
        fallbackSelectors: [
          "button.qJKfS",
          ".Jq_5_ > button:has(svg)",
          'button:has(svg[viewBox="0 0 121 120"])',
          "div.BN1L1 button:first-child"
        ],
        description: "Camera button to initiate snap sending"
      },
      // Element 2: Take picture button (first button in the camera interface)
      takePictureButton: {
        fingerprint: {
          tagName: "button",
          elementType: "button",
          parentTag: "div",
          classList: ["fE2D5", "FBYjn"],
          // Support both class variations
          parentClasses: ["VLm6Y", "i0KT7"],
          // Support both parent variations
          textContent: "",
          innerText: "",
          ariaLabel: null,
          role: null,
          hasIcon: false,
          title: null,
          type: "button",
          siblingIndex: 0,
          isVisible: true,
          // Has a child div with role="button" (newer version)
          hasChildWithRole: "button",
          childAriaDisabled: "true",
          childAriaRoledescription: "draggable",
          // Additional attributes for better matching
          childrenCount: 1,
          // Usually has one child div
          isFirstChild: true
          // Usually the first button in the container
        },
        fallbackSelectors: [
          // New version selectors (with inner div)
          "button.fE2D5",
          ".VLm6Y > button.fE2D5",
          'div.VLm6Y button[type="button"]:first-child',
          'button:has(div[role="button"][aria-roledescription="draggable"])',
          "button.fE2D5:has(div[aria-disabled])",
          '.VLm6Y button:has(div[tabindex="0"])',
          // Old version selectors
          "button.FBYjn.gK0xL.W5dIq",
          "button.FBYjn.gK0xL.A7Cr_.m3ODJ",
          ".i0KT7 > button:first-child",
          // Generic selectors for both
          'button[type="button"]:has(div[role="button"])',
          'div[class*="VLm6Y"] button:first-of-type',
          'div[class*="i0KT7"] button:first-of-type'
        ],
        description: "Take picture/snap button"
      },
      // Element 3: Send To button
      sendToButton: {
        fingerprint: {
          tagName: "button",
          elementType: "button",
          parentTag: "div",
          classList: ["YatIx", "fGS78", "eKaL7", "Bnaur"],
          parentClasses: ["_C4ta", "FHYMJ"],
          textContent: "send to",
          innerText: "send to",
          ariaLabel: null,
          role: null,
          hasIcon: true,
          iconType: "svg",
          type: "button",
          isVisible: true,
          childrenCount: 2,
          // span and svg
          nearestButtonText: "download"
        },
        fallbackSelectors: [
          "button.YatIx.fGS78.eKaL7.Bnaur",
          "button.YatIx.q5eEJ.eKaL7.Bnaur",
          "button.YatIx.bkJA0.eKaL7.Bnaur"
        ],
        description: "Send To button to open recipient selection"
      },
      // Element 4: Friend/recipient selection
      friendSelector: {
        // This is a template for finding friends in the list
        fingerprint: {
          tagName: "div",
          elementType: "div",
          parentTag: "li",
          classList: ["L7aBq"],
          parentClasses: ["Ewflr"],
          hasIcon: true,
          iconType: "svg",
          role: null,
          isVisible: true,
          // The actual friend name will be in a sibling element
          nearestLabelText: null
          // Will be populated dynamically
        },
        fallbackSelectors: [
          ".L7aBq",
          "li.Ewflr .L7aBq",
          "div.L7aBq:has(svg)"
        ],
        // Special handling for friend selection
        friendNameSelector: ".RBx9s.nonIntl",
        groupNameSelector: ".mYSR9.nonIntl",
        groupClickSelector: ".JwhOC",
        description: "Friend/recipient selection clickable area"
      },
      // Element 4B: Shortcut selector button (emoji or text labels)
      shortcutSelector: {
        fingerprint: {
          tagName: "button",
          elementType: "button",
          parentTag: "div",
          classList: ["c47Sk"],
          parentClasses: ["THeKv"],
          textContent: null,
          innerText: null,
          ariaLabel: null,
          role: null,
          type: "button",
          isVisible: true
        },
        fallbackSelectors: [
          "div.THeKv > button.c47Sk",
          "button.c47Sk"
        ],
        description: "Shortcut selection button"
      },
      // Element 4C: Shortcut "Select" confirmation button
      shortcutSelectButton: {
        fingerprint: {
          tagName: "button",
          elementType: "button",
          classList: ["Y7u8A"],
          textContent: "select",
          innerText: "select",
          type: "button",
          isVisible: true
        },
        fallbackSelectors: [
          "button.Y7u8A",
          "button.Y7u8A span.nonIntl",
          "button:has(span.nonIntl)"
        ],
        description: "Select button used after clicking a shortcut"
      },
      // Element 5: Final send button
      sendButton: {
        fingerprint: {
          tagName: "button",
          elementType: "button",
          parentTag: "div",
          classList: ["TYX6O", "eKaL7", "Bnaur"],
          parentClasses: ["OzZgU"],
          textContent: "send",
          innerText: "send",
          ariaLabel: null,
          role: null,
          hasIcon: true,
          iconType: "svg",
          type: "submit",
          isSubmitButton: true,
          isVisible: true,
          childrenCount: 1,
          // div with content
          nearestLabelText: null
        },
        fallbackSelectors: [
          'button.TYX6O.eKaL7.Bnaur[type="submit"]',
          '.OzZgU button[type="submit"]',
          'button[type="submit"]:has(.s53_U)',
          "button.TYX6O.eKaL7.Bnaur",
          ".s53_U"
          // Old selector - targets inner div
        ],
        description: "Final send button to send the snap"
      }
    };
    function getElementFingerprint(elementName) {
      return ELEMENT_FINGERPRINTS[elementName];
    }
    function getAllElementNames() {
      return Object.keys(ELEMENT_FINGERPRINTS);
    }
    function createFriendFingerprint(friendName) {
      const baseFingerprint = { ...ELEMENT_FINGERPRINTS.friendSelector.fingerprint };
      baseFingerprint.nearestLabelText = friendName.toLowerCase();
      return baseFingerprint;
    }
    function createGroupFingerprint(groupName) {
      const baseFingerprint = { ...ELEMENT_FINGERPRINTS.friendSelector.fingerprint };
      baseFingerprint.nearestLabelText = groupName.toLowerCase();
      baseFingerprint.classList = ["JwhOC"];
      return baseFingerprint;
    }
    return { finder: new SmartElementFinder(), configs: ELEMENT_FINGERPRINTS };
  }

  // sender.js
  function createSender(options = {}) {
    const document2 = requireDocument(options), window2 = document2.defaultView;
    const { Element, HTMLElement, Node, MouseEvent, PointerEvent, TouchEvent, Touch, Event, HTMLCanvasElement } = window2;
    const lifecycle = createLifecycle(options);
    const Date2 = { now: () => lifecycle.clock.now() };
    const random = options.random || Math.random;
    const console = { log() {
    }, debug() {
    }, warn(...a) {
      lifecycle.emit("onDiagnostic", { level: "warning", message: a.map(String).join(" ") });
    }, error(...a) {
      lifecycle.emit("onError", { message: a.map(String).join(" ") });
    } };
    const config = { actionDelay: 100, loopDelay: 50, targetSnapCount: 0, snapThreshold: 2e3, ...options };
    const { finder: smartFinder, configs: elementConfigs } = createPatternFinder(document2, { now: () => lifecycle.clock.now(), onDiagnostic: (data) => lifecycle.emit("onDiagnostic", data) });
    let loopPromise = null, errorHandlers = null, releaseCanvas = () => {
    };
    function installCanvas() {
      if (config.patchCanvas === false) return;
      const native = HTMLCanvasElement.prototype.toBlob;
      if (!native) return;
      if (native._gmCoreCanvasLease) {
        native._gmCoreCanvasLease.references++;
        let released2 = false;
        releaseCanvas = () => {
          if (released2) return;
          released2 = true;
          const lease2 = native._gmCoreCanvasLease;
          if (--lease2.references === 0 && HTMLCanvasElement.prototype.toBlob === native) HTMLCanvasElement.prototype.toBlob = lease2.original;
        };
        return;
      }
      if (native._snapPatch) return;
      const dataURLtoBlob = (url) => {
        const [meta, b64] = url.split(",");
        const mime = (/^data:(.*?);/i.exec(meta) || [, "application/octet-stream"])[1];
        const bin = atob(b64);
        const len = bin.length;
        const u8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
        return new Blob([u8], { type: mime });
      };
      HTMLCanvasElement.prototype.toBlob = function patched(cb, type = "image/jpeg", quality = 0.95) {
        let settled = false;
        const safe = (blob) => {
          if (!settled) {
            settled = true;
            try {
              cb(blob);
            } catch {
            }
          }
        };
        try {
          native.call(this, (b) => {
            if (b) return safe(b);
            const quals = [0.9, 0.85, 0.8, 0.75, 0.7];
            let i = 0;
            const tryNext = () => {
              if (i >= quals.length) {
                try {
                  return safe(dataURLtoBlob(this.toDataURL(type)));
                } catch {
                }
                try {
                  return safe(dataURLtoBlob(this.toDataURL("image/png")));
                } catch {
                }
                return safe(null);
              }
              try {
                native.call(this, (b2) => b2 ? safe(b2) : tryNext(), type, quals[i++]);
              } catch {
                tryNext();
              }
            };
            tryNext();
          }, type, quality);
        } catch {
          try {
            return safe(dataURLtoBlob(this.toDataURL(type)));
          } catch {
          }
          try {
            return safe(dataURLtoBlob(this.toDataURL("image/png")));
          } catch {
          }
          safe(null);
        }
      };
      Object.defineProperty(HTMLCanvasElement.prototype.toBlob, "_snapPatch", { value: true });
      const installed = HTMLCanvasElement.prototype.toBlob;
      const lease = { references: 1, original: native };
      Object.defineProperty(installed, "_gmCoreCanvasLease", { value: lease });
      let released = false;
      releaseCanvas = () => {
        if (released) return;
        released = true;
        if (--lease.references === 0 && HTMLCanvasElement.prototype.toBlob === installed) HTMLCanvasElement.prototype.toBlob = native;
      };
    }
    "use strict";
    let People = [];
    let Shortcuts = [];
    let recipientMode = "nickname";
    let snapsSent = 0;
    let actionInProgress = false;
    let stopRequested = false;
    let currentState = "searching";
    let peopleClickIndex = 0;
    let stateStartTime = Date2.now();
    let lastClickedElement = null;
    let lastClickTime = 0;
    let sendButtonAttempts = 0;
    let recipientSelectionAttempts = 0;
    let recipientsPreparedForSend = false;
    let selectedCycleId = 0;
    let selectedRecipientCount = 0;
    let commitStartedAt = 0;
    let ackStartedAt = 0;
    let sendHardTimeoutStartedAt = 0;
    let finalSendClickIssued = false;
    let currentStateId = "searching";
    let statePointer = "searching";
    let stateFailCount = 0;
    let lastResyncAt = 0;
    let strictSendCycle = null;
    let diagnosticsTick = 0;
    let totalSendClicks = 0;
    let cycleSendClicks = 0;
    let cycleMembers = [];
    const SEND_ACK_WINDOW_MS = 1200;
    const SEND_ACK_POLL_MS = 45;
    const SEND_HARD_TIMEOUT_MS = 4500;
    const STATE_RESYNC_MISS_THRESHOLD = 2;
    const STATE_RESYNC_CONFIDENCE_THRESHOLD = 0.62;
    const STATE_RESYNC_MIN_INTERVAL_MS = 120;
    const SEND_STATE_GRAPH = {
      searching: { id: "searching", prev: "waitingForLoop", next: "takePicture" },
      takePicture: { id: "takePicture", prev: "searching", next: "sendTo" },
      sendTo: { id: "sendTo", prev: "takePicture", next: "selectRecipients" },
      selectRecipients: { id: "selectRecipients", prev: "sendTo", next: "prepareFinalSend" },
      prepareFinalSend: { id: "prepareFinalSend", prev: "selectRecipients", next: "commitFinalSend" },
      commitFinalSend: { id: "commitFinalSend", prev: "prepareFinalSend", next: "awaitSendAck" },
      awaitSendAck: { id: "awaitSendAck", prev: "commitFinalSend", next: "waitingForLoop" },
      waitingForLoop: { id: "waitingForLoop", prev: "awaitSendAck", next: "searching" }
    };
    let isPageVisible = !document2.hidden;
    let backgroundExecutionMode = false;
    function robustDelay(ms) {
      return lifecycle.sleep(ms);
    }
    function normalizeRecipientLabel(value) {
      return String(value || "").normalize("NFKC").replace(/\u00A0/g, " ").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
    }
    function getActiveRecipients() {
      return recipientMode === "shortcut" ? Shortcuts : People;
    }
    function isDuplicateRecipient(list, value) {
      const normalizedValue = normalizeRecipientLabel(value);
      return list.some((entry) => normalizeRecipientLabel(entry) === normalizedValue);
    }
    function setRecipientMode(mode) {
      recipientMode = mode === "shortcut" ? "shortcut" : "nickname";
    }
    function startSendAutomation() {
      if (actionInProgress) return;
      actionInProgress = true;
      stopRequested = false;
      const ACTION_DELAY = config.actionDelay;
      const LOOP_DELAY = config.loopDelay;
      currentState = "searching";
      currentStateId = "searching";
      statePointer = "searching";
      stateFailCount = 0;
      lastResyncAt = 0;
      strictSendCycle = null;
      peopleClickIndex = 0;
      recipientSelectionAttempts = 0;
      recipientsPreparedForSend = false;
      selectedCycleId = 0;
      selectedRecipientCount = 0;
      commitStartedAt = 0;
      ackStartedAt = 0;
      sendHardTimeoutStartedAt = 0;
      finalSendClickIssued = false;
      diagnosticsTick = 0;
      totalSendClicks = 0;
      stateStartTime = Date2.now();
      lastClickedElement = null;
      lastClickTime = 0;
      sendButtonAttempts = 0;
      let cameraErrorCount = 0;
      let takePictureAttempts = 0;
      const errorHandler = (event) => {
        if (event.message && event.message.includes("Failed to create image/jpeg image Blob")) {
          console.warn("[snapx] toBlob error detected (should be rare with patch):", event.message);
          cameraErrorCount++;
          if (cameraErrorCount >= 5) {
            console.error("Multiple camera errors despite patch. Attempting recovery...");
            const closeButton = document2.querySelector('button[aria-label="Close"]') || document2.querySelector("button.close") || document2.querySelector('[role="button"][aria-label*="close"]');
            if (closeButton) {
              console.log("Clicking close button to reset camera state");
              closeButton.click();
              cameraErrorCount = 0;
              setAutomationState("searching", "camera_error_recovery");
              lastClickedElement = null;
              return;
            }
            console.error("Could not recover from repeated camera errors. Refreshing page...");
            actionInProgress = false;
            lifecycle.emit("onReloadRequested", getState());
            stop();
          }
          return true;
        }
      };
      errorHandlers = { error: errorHandler };
      window2.addEventListener("error", errorHandler);
      const activeRecipientsAtStart = getActiveRecipients();
      console.log("Starting automation with recipient mode:", recipientMode);
      console.log("Nickname recipients:", People);
      console.log("Shortcut recipients:", Shortcuts);
      console.log("Active recipients count:", activeRecipientsAtStart.length);
      if (activeRecipientsAtStart.length === 0) {
        console.error("ERROR: Active recipient array is empty. Cannot send snaps without recipients.");
        console.error(`Please add at least one ${recipientMode === "shortcut" ? "shortcut" : "nickname"} before starting automation.`);
        actionInProgress = false;
        window2.removeEventListener("error", errorHandler);
        return;
      }
      function logSendDiagnostic(event, extra = {}, force = false) {
        diagnosticsTick += 1;
        if (!force && diagnosticsTick % 8 !== 0) return;
        console.log("[SendDiag]", {
          event,
          cycleId: selectedCycleId,
          state: currentState,
          statePointer,
          recipientMode,
          peopleClickIndex,
          sendAttempt: sendButtonAttempts,
          ackResult: extra.ackResult || null,
          ...extra
        });
      }
      function setAutomationState(nextState, reason = "transition") {
        if (!SEND_STATE_GRAPH[nextState]) return;
        if (currentState === nextState) return;
        const previousState = currentState;
        currentState = nextState;
        currentStateId = nextState;
        statePointer = nextState;
        stateStartTime = Date2.now();
        stateFailCount = 0;
        lifecycle.emit("onState", { state: nextState, previous: previousState, reason });
        logSendDiagnostic("state_jump", { from: previousState, to: nextState, reason }, true);
      }
      function resetStrictCycle(reason = "reset") {
        if (strictSendCycle) {
          logSendDiagnostic("strict_cycle_reset", { reason, cycleId: strictSendCycle.cycleId });
        }
        strictSendCycle = null;
        recipientsPreparedForSend = false;
        selectedRecipientCount = 0;
        commitStartedAt = 0;
        ackStartedAt = 0;
        sendHardTimeoutStartedAt = 0;
        finalSendClickIssued = false;
        sendButtonAttempts = 0;
        recipientSelectionAttempts = 0;
      }
      function createStrictCycle(recipientCount) {
        selectedCycleId += 1;
        strictSendCycle = {
          cycleId: selectedCycleId,
          recipientsLocked: true,
          selectedRecipientCount: recipientCount,
          finalSendClickedAt: null,
          postSendTransitionAt: null,
          ackReason: null
        };
        selectedRecipientCount = recipientCount;
      }
      function markFinalSendClicked() {
        if (!strictSendCycle) return;
        strictSendCycle.finalSendClickedAt = Date2.now();
        finalSendClickIssued = true;
      }
      function markPostSendTransition(reason) {
        if (!strictSendCycle) return;
        strictSendCycle.postSendTransitionAt = Date2.now();
        strictSendCycle.ackReason = reason;
      }
      function hasStrictSendProof() {
        return Boolean(
          strictSendCycle && strictSendCycle.finalSendClickedAt && strictSendCycle.postSendTransitionAt
        );
      }
      function isElementInteractable(element) {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const style = window2.getComputedStyle(element);
        if (!style) return false;
        if (style.display === "none") return false;
        if (style.visibility === "hidden") return false;
        if (style.pointerEvents === "none") return false;
        if (Number.parseFloat(style.opacity || "1") === 0) return false;
        if (element.disabled) return false;
        if (element.getAttribute("aria-disabled") === "true") return false;
        return true;
      }
      async function findInteractableSendButton({ preferFast = true, silent = false } = {}) {
        const directSelectors = [
          'button.TYX6O.eKaL7.Bnaur[type="submit"]',
          '.OzZgU button[type="submit"]',
          'button[type="submit"]',
          "button:has(.s53_U)"
        ];
        for (const selector of directSelectors) {
          const candidate = document2.querySelector(selector);
          if (isElementInteractable(candidate)) {
            return candidate;
          }
        }
        if (preferFast && sendButtonAttempts % 4 !== 0) {
          return null;
        }
        const sendButton = await findElementQuick("sendButton", { silent });
        if (!isElementInteractable(sendButton)) return null;
        return sendButton;
      }
      function isCameraOrCaptureViewVisible() {
        const cameraBtn = document2.querySelector("button.qJKfS");
        if (isElementInteractable(cameraBtn)) return true;
        const takePicBtn = document2.querySelector("button.fE2D5, button.FBYjn");
        return isElementInteractable(takePicBtn);
      }
      function isElementVisible(element) {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }
      function isSendToViewVisible() {
        const byClass = document2.querySelector("button.YatIx");
        if (isElementVisible(byClass)) return true;
        const byText = Array.from(document2.querySelectorAll("button")).find((button) => {
          const label = normalizeRecipientLabel(button.textContent || button.innerText);
          return label.includes("send to") && isElementVisible(button);
        });
        if (byText) return true;
        const hasDownloadButton = Array.from(document2.querySelectorAll("button")).some((button) => {
          const label = normalizeRecipientLabel(button.textContent || button.innerText);
          return label.includes("download") && isElementVisible(button);
        });
        return hasDownloadButton;
      }
      function isRecipientSelectionViewVisible() {
        const selectionSelectors = [
          "li.Ewflr",
          "li.RbA83",
          ".L7aBq",
          ".JwhOC",
          "div.THeKv",
          "button.c47Sk",
          "button.Y7u8A"
        ];
        return selectionSelectors.some(
          (selector) => Array.from(document2.querySelectorAll(selector)).some((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
        );
      }
      async function hasExpectedMarkerForState(stateId) {
        switch (stateId) {
          case "searching":
            return Boolean(
              document2.querySelector("button.qJKfS") || document2.querySelector("button.fE2D5, button.FBYjn")
            );
          case "takePicture":
            return Boolean(document2.querySelector("button.fE2D5, button.FBYjn"));
          case "sendTo":
            return isSendToViewVisible();
          case "selectRecipients":
            return isRecipientSelectionViewVisible();
          case "prepareFinalSend":
            return recipientsPreparedForSend;
          case "commitFinalSend":
            return Boolean(await findInteractableSendButton({ preferFast: true, silent: true }));
          case "awaitSendAck":
            return Boolean(ackStartedAt > 0);
          case "waitingForLoop":
            return true;
          default:
            return false;
        }
      }
      async function classifyCurrentScreen() {
        const markers = {};
        const sendButton = await findInteractableSendButton({ preferFast: true, silent: true });
        markers.commitFinalSend = Boolean(sendButton);
        if (markers.commitFinalSend) {
          return { screenId: "commitFinalSend", confidence: 0.95, markers };
        }
        markers.selectRecipients = isRecipientSelectionViewVisible();
        if (markers.selectRecipients) {
          return { screenId: "selectRecipients", confidence: 0.9, markers };
        }
        markers.sendTo = isSendToViewVisible();
        if (markers.sendTo) {
          return { screenId: "sendTo", confidence: 0.86, markers };
        }
        markers.takePicture = Boolean(document2.querySelector("button.fE2D5, button.FBYjn"));
        if (markers.takePicture) {
          return { screenId: "takePicture", confidence: 0.82, markers };
        }
        markers.cameraHome = Boolean(document2.querySelector("button.qJKfS"));
        if (markers.cameraHome) {
          return { screenId: "searching", confidence: 0.76, markers };
        }
        return { screenId: "unknown", confidence: 0, markers };
      }
      async function resyncStateFromClassifier(expectedState, reason) {
        stateFailCount += 1;
        logSendDiagnostic("state_miss_expected", {
          expectedState,
          failCount: stateFailCount,
          reason
        });
        if (stateFailCount < STATE_RESYNC_MISS_THRESHOLD) {
          return false;
        }
        if (Date2.now() - lastResyncAt < STATE_RESYNC_MIN_INTERVAL_MS) {
          return false;
        }
        lastResyncAt = Date2.now();
        const classification = await classifyCurrentScreen();
        logSendDiagnostic("state_classifier_result", {
          expectedState,
          classifiedState: classification.screenId,
          confidence: classification.confidence,
          markers: classification.markers
        }, true);
        if (classification.screenId !== "unknown" && classification.confidence >= STATE_RESYNC_CONFIDENCE_THRESHOLD) {
          if (classification.screenId !== currentState) {
            setAutomationState(classification.screenId, `classifier:${reason}`);
            return true;
          }
          stateFailCount = 0;
          return false;
        }
        const graphNode = SEND_STATE_GRAPH[currentState];
        const neighborStates = [graphNode?.prev, graphNode?.next].filter(Boolean);
        for (const candidateState of neighborStates) {
          if (await hasExpectedMarkerForState(candidateState)) {
            setAutomationState(candidateState, `neighbor_probe:${reason}`);
            return true;
          }
        }
        logSendDiagnostic("state_jump_rejected_low_conf", {
          expectedState,
          confidence: classification.confidence
        }, true);
        return false;
      }
      async function isSendAcknowledged() {
        const hasFinalClickProof = Boolean(strictSendCycle && strictSendCycle.finalSendClickedAt);
        if (!hasFinalClickProof) {
          return { confirmed: false, reason: "no_final_send_click_proof" };
        }
        if (isCameraOrCaptureViewVisible()) {
          return { confirmed: true, reason: "camera_or_capture_visible" };
        }
        if (isSendToViewVisible()) {
          return { confirmed: true, reason: "send_to_visible_after_send" };
        }
        const recipientViewVisible = isRecipientSelectionViewVisible();
        const interactableSendButton = await findInteractableSendButton({ preferFast: true, silent: true });
        if (!recipientViewVisible && !interactableSendButton) {
          return { confirmed: true, reason: "selection_view_exited" };
        }
        return { confirmed: false, reason: "pending" };
      }
      async function waitForSendAcknowledgement({ timeoutMs = SEND_ACK_WINDOW_MS, pollMs = SEND_ACK_POLL_MS } = {}) {
        const startedAt = Date2.now();
        while (actionInProgress && Date2.now() - startedAt < timeoutMs) {
          const ack = await isSendAcknowledged();
          if (ack.confirmed) return ack;
          await robustDelay(pollMs);
        }
        return { confirmed: false, reason: "ack_timeout" };
      }
      async function clickSpecificButton() {
        const button = await findElementQuick("cameraButton");
        if (button) {
          button.click();
        } else {
          console.error("Camera button not found");
        }
      }
      async function clickPersonByName(name) {
        const normalizedTargetName = normalizeRecipientLabel(name);
        if (!normalizedTargetName) {
          console.warn("Nickname recipient not found: empty target name");
          return false;
        }
        if (Boolean(smartFinder) && smartFinder) {
          try {
            const listItems = document2.querySelectorAll("li.Ewflr, li.RbA83");
            for (const listItem of listItems) {
              const nameElement = listItem.querySelector(".RBx9s.nonIntl, .mYSR9.nonIntl");
              const candidateName = normalizeRecipientLabel(nameElement?.textContent || nameElement?.innerText);
              if (!nameElement || candidateName !== normalizedTargetName) {
                continue;
              }
              const isGroup = listItem.querySelector(".mYSR9.nonIntl") !== null;
              const clickTargets = isGroup ? listItem.querySelectorAll(".JwhOC") : listItem.querySelectorAll(".L7aBq");
              for (const target of clickTargets) {
                const rect = target.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  await simulateClick(target);
                  console.log(`Clicked on ${isGroup ? "group" : "person"}: ${name} (pattern recognition)`);
                  return true;
                }
              }
            }
          } catch (e) {
            console.warn("Pattern recognition failed for person selection:", e);
          }
        }
        const nameElements = document2.querySelectorAll(".RBx9s.nonIntl");
        const groupchatElements = document2.querySelectorAll(".mYSR9.nonIntl");
        for (const groupElement of groupchatElements) {
          const candidateName = normalizeRecipientLabel(groupElement.textContent || groupElement.innerText);
          if (candidateName === normalizedTargetName) {
            const listItem = groupElement.closest("li");
            if (listItem) {
              const groupchatElement = listItem.querySelector(".JwhOC");
              if (groupchatElement) {
                await simulateClick(groupchatElement);
                console.log(`Clicked on Groupchat: ${name} (fallback)`);
                return true;
              }
            }
          }
        }
        for (const nameElement of nameElements) {
          const candidateName = normalizeRecipientLabel(nameElement.textContent || nameElement.innerText);
          if (candidateName === normalizedTargetName) {
            const listItem = nameElement.closest("li");
            if (listItem) {
              const clickableElement = listItem.querySelector(".L7aBq");
              if (clickableElement) {
                await simulateClick(clickableElement);
                console.log(`Clicked on person: ${name} (fallback)`);
                return true;
              }
            }
          }
        }
        console.warn(`Nickname recipient not found: ${name}`);
        return false;
      }
      async function findShortcutSelectButton() {
        const patternButton = await findElementQuick("shortcutSelectButton");
        if (patternButton && patternButton.offsetWidth > 0 && patternButton.offsetHeight > 0) {
          return patternButton;
        }
        const byClass = Array.from(document2.querySelectorAll("button.Y7u8A"));
        const visibleClassMatch = byClass.find((button) => button.offsetWidth > 0 && button.offsetHeight > 0);
        if (visibleClassMatch) {
          return visibleClassMatch;
        }
        const byText = Array.from(document2.querySelectorAll("button")).find((button) => {
          const text = normalizeRecipientLabel(button.textContent || button.innerText);
          return text === "select" && button.offsetWidth > 0 && button.offsetHeight > 0;
        });
        return byText || null;
      }
      async function clickShortcutSelectButton(shortcutLabel) {
        const timeoutMs = 900;
        const pollMs = 50;
        const maxClickAttempts = 2;
        let clickAttempts = 0;
        let clickedAtLeastOnce = false;
        const start2 = Date2.now();
        while (Date2.now() - start2 < timeoutMs) {
          const selectButton = await findShortcutSelectButton();
          if (!selectButton || !isElementInteractable(selectButton)) {
            await robustDelay(pollMs);
            continue;
          }
          const beforeText = normalizeRecipientLabel(selectButton.textContent || selectButton.innerText);
          const beforeDisabled = selectButton.disabled || selectButton.getAttribute("aria-disabled") === "true";
          try {
            selectButton.click();
          } catch (error) {
            console.warn("Native Select click failed, falling back to simulateClick:", error);
            await simulateClick(selectButton);
          }
          clickedAtLeastOnce = true;
          clickAttempts += 1;
          await robustDelay(70);
          const sendReady = await findInteractableSendButton({ preferFast: true, silent: true });
          if (sendReady) {
            console.log(`Shortcut Select acknowledged by send readiness for: ${shortcutLabel}`);
            return true;
          }
          const postClickSelectButton = await findShortcutSelectButton();
          const afterDisabled = postClickSelectButton ? postClickSelectButton.disabled || postClickSelectButton.getAttribute("aria-disabled") === "true" : false;
          const afterText = postClickSelectButton ? normalizeRecipientLabel(postClickSelectButton.textContent || postClickSelectButton.innerText) : "";
          const transitioned = !postClickSelectButton || postClickSelectButton !== selectButton || !beforeDisabled && afterDisabled || afterText !== beforeText;
          if (transitioned) {
            console.log(`Clicked shortcut Select button for: ${shortcutLabel}`);
            return true;
          }
          if (clickAttempts >= maxClickAttempts) {
            console.warn(`Select transition ambiguous for "${shortcutLabel}" after ${maxClickAttempts} attempts; continuing with send commit.`);
            return true;
          }
          await robustDelay(90);
        }
        if (clickedAtLeastOnce) {
          console.warn(`Select transition timed out for "${shortcutLabel}" after click; continuing with send commit.`);
          return true;
        }
        console.warn(`Select button not found after choosing shortcut: ${shortcutLabel}`);
        return false;
      }
      async function clickShortcutByName(shortcutLabel) {
        const normalizedTarget = normalizeRecipientLabel(shortcutLabel);
        if (!normalizedTarget) return false;
        const tryMatchInCandidates = (candidates) => {
          for (const candidate of candidates) {
            if (!candidate) continue;
            const label = normalizeRecipientLabel(candidate.textContent || candidate.innerText);
            if (label !== normalizedTarget) continue;
            if (candidate.offsetWidth <= 0 || candidate.offsetHeight <= 0) continue;
            return candidate;
          }
          return null;
        };
        if (Boolean(smartFinder) && smartFinder && elementConfigs?.shortcutSelector) {
          try {
            const config2 = elementConfigs.shortcutSelector;
            const result = await smartFinder.findElement(config2.fingerprint, {
              fallbackSelectors: config2.fallbackSelectors,
              threshold: 0.5,
              useCache: true,
              timeout: 150
            });
            if (result?.element) {
              const buttons = Array.from(document2.querySelectorAll("div.THeKv > button.c47Sk, button.c47Sk"));
              const matched = tryMatchInCandidates(buttons);
              if (matched) {
                await simulateClick(matched);
                console.log(`Clicked shortcut: ${shortcutLabel} (pattern-assisted)`);
                return clickShortcutSelectButton(shortcutLabel);
              }
            }
          } catch (error) {
            console.warn("Pattern recognition failed for shortcut selection:", error);
          }
        }
        const fallbackButtons = Array.from(document2.querySelectorAll("div.THeKv > button.c47Sk, button.c47Sk"));
        const fallbackMatch = tryMatchInCandidates(fallbackButtons);
        if (fallbackMatch) {
          await simulateClick(fallbackMatch);
          console.log(`Clicked shortcut: ${shortcutLabel} (fallback)`);
          return clickShortcutSelectButton(shortcutLabel);
        }
        console.warn(`Shortcut not found: ${shortcutLabel}`);
        return false;
      }
      function findScrollParent(row) {
        for (let node = row.parentElement; node && node !== document2.body; node = node.parentElement) {
          if (node.scrollHeight > node.clientHeight + 4) return node;
        }
        return null;
      }
      function collectSelectedRows(into) {
        for (const row of document2.querySelectorAll("li.Ewflr, li.RbA83")) {
          const label = rowLabel(row);
          if (label && isRowSelected(row) && !isDuplicateRecipient(into, label)) into.push(label);
        }
      }
      async function harvestShortcutMembers(shortcutLabel) {
        await robustDelay(Math.max(60, config.actionDelay));
        const names = [];
        collectSelectedRows(names);
        const firstRow = document2.querySelector("li.Ewflr, li.RbA83");
        const scroller = firstRow ? findScrollParent(firstRow) : null;
        if (scroller) {
          const original = scroller.scrollTop;
          const step = Math.max(80, scroller.clientHeight - 20);
          for (let i = 0; i < 40 && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2; i++) {
            scroller.scrollTop += step;
            await robustDelay(60);
            collectSelectedRows(names);
          }
          scroller.scrollTop = original;
        }
        lifecycle.emit("onDiagnostic", {
          level: names.length ? "info" : "warning",
          event: "shortcut_members",
          message: names.length ? `Shortcut "${shortcutLabel}": ${names.length} selected member(s) read` : `Shortcut "${shortcutLabel}": no selected rows recognised; use inspectRows() or pass isRowSelected`
        });
        return names;
      }
      function updateSnapsSent(count) {
        snapsSent += count;
        lifecycle.emit("onProgress", getState());
        managePatternCache();
        if (config.targetSnapCount > 0 && snapsSent >= config.targetSnapCount) {
          stop();
          return;
        }
        if (config.snapThreshold > 0 && snapsSent % config.snapThreshold === 0) {
          lifecycle.emit("onReloadRequested", getState());
          stop();
        }
      }
      function isSameElementClicked(element) {
        return lastClickedElement === element && Date2.now() - lastClickTime < 500;
      }
      async function simulateClick(element, opts = {}) {
        lifecycle.check();
        element.scrollIntoView({ behavior: "instant", block: "center" });
        if (typeof element.focus === "function") {
          element.focus();
        }
        const isShortcutSelectButton = element.classList?.contains("Y7u8A") || normalizeRecipientLabel(element.textContent || element.innerText) === "select";
        const isFinalSendButton = Boolean(config.singleSendClick) && (element.classList?.contains("TYX6O") || element.type === "submit" && normalizeRecipientLabel(element.textContent || element.innerText) === "send");
        if (isShortcutSelectButton || isFinalSendButton || opts.single === true) {
          try {
            element.click();
          } catch (e) {
            console.log("Single-click shortcut Select failed:", e);
          }
          const actionDelay2 = config.actionDelay;
          await robustDelay(Math.max(40, Math.min(actionDelay2, 120)));
          return;
        }
        try {
          element.click();
          console.log("Primary native click executed");
        } catch (e) {
          console.log("Primary native click failed:", e);
        }
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        try {
          const pointerDownEvent = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            view: window2,
            button: 0,
            buttons: 1,
            clientX: centerX,
            clientY: centerY,
            pointerId: 1,
            pointerType: "mouse"
          });
          const pointerUpEvent = new PointerEvent("pointerup", {
            bubbles: true,
            cancelable: true,
            view: window2,
            button: 0,
            buttons: 0,
            clientX: centerX,
            clientY: centerY,
            pointerId: 1,
            pointerType: "mouse"
          });
          element.dispatchEvent(pointerDownEvent);
          element.dispatchEvent(pointerUpEvent);
        } catch (e) {
          console.log("Pointer events failed:", e);
        }
        const mousedownEvent = new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window2,
          button: 0,
          buttons: 1,
          clientX: centerX,
          clientY: centerY
        });
        const mouseupEvent = new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window2,
          button: 0,
          buttons: 0,
          clientX: centerX,
          clientY: centerY
        });
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window2,
          button: 0,
          clientX: centerX,
          clientY: centerY
        });
        element.dispatchEvent(mousedownEvent);
        element.dispatchEvent(mouseupEvent);
        element.dispatchEvent(clickEvent);
        try {
          element.click();
          console.log("Secondary native click executed");
        } catch (e) {
          console.log("Secondary native click failed:", e);
        }
        const actionDelay = config.actionDelay;
        await robustDelay(actionDelay);
      }
      async function findElementQuick(elementType, options2 = {}) {
        const { silent = false, skipPattern = false } = options2;
        let element = null;
        if (!skipPattern && Boolean(smartFinder) && smartFinder && elementConfigs && elementConfigs[elementType]) {
          try {
            const config2 = elementConfigs[elementType];
            if (!silent && (elementType !== "sendToButton" || !element)) {
              console.log(`Using pattern recognition for ${elementType}`);
            }
            const result = await smartFinder.findElement(config2.fingerprint, {
              fallbackSelectors: config2.fallbackSelectors,
              threshold: elementType === "sendButton" ? 0.6 : 0.5,
              // Lower threshold for better matching
              useCache: true,
              // Enable caching for better performance
              timeout: 100
              // Slightly longer timeout
            });
            if (result.element) {
              if (result.method === "cached") {
                if (!silent) console.log(`Found ${elementType} from cache (confidence: ${result.confidence})`);
              } else {
                if (!silent) console.log(`Pattern recognition found ${elementType} via ${result.method} with confidence ${result.confidence}`);
              }
              element = result.element;
              return element;
            } else if (elementType !== "sendToButton") {
              if (!silent) console.log(`Pattern recognition failed for ${elementType}: confidence too low or no match`);
            }
          } catch (e) {
            if (!silent) console.error("Pattern recognition error:", e);
          }
        }
        switch (elementType) {
          case "cameraButton":
            element = document2.querySelector("button.qJKfS");
            break;
          case "takePictureButton":
            const takePictureSelectors = [
              // New selectors based on actual HTML
              "button.fE2D5",
              ".VLm6Y > button.fE2D5",
              'div.VLm6Y button[type="button"]:first-child',
              // Old selectors as fallback
              "button.FBYjn.gK0xL.W5dIq",
              "button.FBYjn.gK0xL.A7Cr_.m3ODJ",
              ".i0KT7 > button:first-child",
              ".O7Nhq button.FBYjn:first-child",
              "button.FBYjn",
              "div.i0KT7 button",
              "div.O7Nhq button"
            ];
            for (const selector of takePictureSelectors) {
              element = document2.querySelector(selector);
              if (element) {
                console.log(`Found take picture button with selector: ${selector}`);
                const isVisible = element.offsetWidth > 0 && element.offsetHeight > 0;
                const isEnabled = !element.disabled;
                console.log(`Button state - Visible: ${isVisible}, Enabled: ${isEnabled}`);
                if (isVisible && isEnabled) {
                  break;
                }
              }
            }
            break;
          case "sendToButton":
            const buttons = Array.from(document2.querySelectorAll("button"));
            element = buttons.find((btn) => btn.textContent && btn.textContent.includes("Send To"));
            if (!element) {
              element = buttons.find((btn) => {
                const cl = btn.classList;
                return cl.contains("YatIx") && cl.contains("eKaL7") && cl.contains("Bnaur") && (cl.contains("q5eEJ") || cl.contains("fGS78") || cl.contains("bkJA0"));
              });
            }
            break;
          case "sendButton":
            const sendButtonSelectors = [
              'button.TYX6O.eKaL7.Bnaur[type="submit"]',
              '.OzZgU button[type="submit"]',
              'button[type="submit"]',
              ".s53_U"
              // Inner div fallback
            ];
            for (const selector of sendButtonSelectors) {
              element = document2.querySelector(selector);
              if (element) {
                if (element.classList.contains("s53_U") && element.parentElement?.tagName === "BUTTON") {
                  element = element.parentElement;
                }
                if (!silent) console.log(`Found send button with selector: ${selector}`);
                break;
              }
            }
            break;
        }
        return element;
      }
      async function performSinglePass() {
        lifecycle.check();
        const passStart = Date2.now();
        switch (currentState) {
          case "waitingForLoop":
            if (Date2.now() - stateStartTime >= LOOP_DELAY) {
              resetStrictCycle("loop_cycle_complete");
              setAutomationState("searching", "loop_wait_elapsed");
            }
            break;
          case "selectRecipients":
            if (recipientsPreparedForSend) {
              setAutomationState("prepareFinalSend", "selection_already_prepared");
              break;
            }
            const activeRecipients = getActiveRecipients();
            console.log(`In selectRecipients state. peopleClickIndex: ${peopleClickIndex}, activeRecipients.length: ${activeRecipients.length}, mode: ${recipientMode}`);
            if (peopleClickIndex < activeRecipients.length) {
              const timeForThisPerson = peopleClickIndex * ACTION_DELAY;
              const timeSinceStart = Date2.now() - stateStartTime;
              if (timeSinceStart >= timeForThisPerson) {
                const currentRecipient = activeRecipients[peopleClickIndex];
                if (peopleClickIndex === 0 && recipientSelectionAttempts === 0) cycleMembers = [];
                console.log(`Attempting to click recipient: ${currentRecipient} (${recipientMode})`);
                let recipientSelected = true;
                if (recipientMode === "shortcut") {
                  recipientSelected = await clickShortcutByName(currentRecipient);
                } else {
                  recipientSelected = await clickPersonByName(currentRecipient);
                }
                if (recipientSelected) {
                  if (recipientMode === "shortcut" && config.expandShortcuts) {
                    for (const member of await harvestShortcutMembers(currentRecipient)) {
                      if (!isDuplicateRecipient(cycleMembers, member)) cycleMembers.push(member);
                    }
                  }
                  peopleClickIndex++;
                  recipientSelectionAttempts = 0;
                } else {
                  recipientSelectionAttempts++;
                  console.warn(`Failed selecting recipient "${currentRecipient}" attempt ${recipientSelectionAttempts}/3`);
                  if (recipientSelectionAttempts >= 3) {
                    console.warn(`Skipping recipient "${currentRecipient}" after 3 failed attempts`);
                    peopleClickIndex++;
                    recipientSelectionAttempts = 0;
                  }
                }
              }
            } else {
              console.log("All recipients selected, moving to send commit");
              recipientsPreparedForSend = true;
              setAutomationState("prepareFinalSend", "all_recipients_selected");
            }
            break;
          case "prepareFinalSend":
            if (!recipientsPreparedForSend) {
              setAutomationState("selectRecipients", "selection_lock_missing");
              break;
            }
            const expanded = Boolean(config.expandShortcuts && recipientMode === "shortcut" && cycleMembers.length);
            if (expanded) lifecycle.emit("onShortcutMembers", { members: [...cycleMembers] });
            createStrictCycle(Math.max(1, expanded ? cycleMembers.length : getActiveRecipients().length));
            sendButtonAttempts = 0;
            commitStartedAt = Date2.now();
            ackStartedAt = 0;
            sendHardTimeoutStartedAt = Date2.now();
            finalSendClickIssued = false;
            cycleSendClicks = 0;
            setAutomationState("commitFinalSend", "prepared_for_commit");
            logSendDiagnostic("prepare_final_send", { selectedRecipientCount: strictSendCycle?.selectedRecipientCount || selectedRecipientCount }, true);
            break;
          case "commitFinalSend": {
            if (!recipientsPreparedForSend) {
              setAutomationState("selectRecipients", "selection_lock_missing_during_commit");
              break;
            }
            if (strictSendCycle?.finalSendClickedAt && isSendToViewVisible()) {
              markPostSendTransition("send_to_visible_after_send");
              if (hasStrictSendProof()) {
                updateSnapsSent(strictSendCycle.selectedRecipientCount || selectedRecipientCount);
              } else {
                logSendDiagnostic("count_blocked_no_strict_proof", { reason: "commit_sendto_without_strict_proof" }, true);
              }
              resetStrictCycle("commit_sendto_ack");
              setAutomationState("waitingForLoop", "post_send_compose_visible");
              break;
            }
            const hardElapsed = Date2.now() - sendHardTimeoutStartedAt;
            if (hardElapsed >= SEND_HARD_TIMEOUT_MS) {
              console.warn(`Hard timeout waiting for final send (${SEND_HARD_TIMEOUT_MS}ms). Resetting cycle.`);
              logSendDiagnostic("hard_timeout_recovery", { hardElapsed, ackResult: "hard_timeout" }, true);
              peopleClickIndex = 0;
              resetStrictCycle("commit_hard_timeout");
              setAutomationState("searching", "commit_hard_timeout");
              break;
            }
            const sendBtn = await findInteractableSendButton({ preferFast: true, silent: true });
            if (!sendBtn || isSameElementClicked(sendBtn)) {
              if (strictSendCycle?.finalSendClickedAt && isSendToViewVisible()) {
                markPostSendTransition("send_to_visible_after_send");
                if (hasStrictSendProof()) {
                  updateSnapsSent(strictSendCycle.selectedRecipientCount || selectedRecipientCount);
                } else {
                  logSendDiagnostic("count_blocked_no_strict_proof", { reason: "no_strict_proof_sendto_path" }, true);
                }
                resetStrictCycle("commit_sendto_after_click");
                setAutomationState("waitingForLoop", "compose_detected_after_click");
                break;
              }
              sendButtonAttempts++;
              logSendDiagnostic("waiting_send_interactable", { sendAttempt: sendButtonAttempts, stateFailCount: stateFailCount + 1 });
              const resynced = await resyncStateFromClassifier("commitFinalSend", "send_button_missing");
              if (resynced) {
                if (currentState !== "commitFinalSend" && currentState !== "awaitSendAck") {
                  resetStrictCycle("state_resync_from_commit");
                  peopleClickIndex = 0;
                  if (currentState === "sendTo") {
                    setAutomationState("selectRecipients", "resynced_to_sendto_then_select");
                  }
                }
                return;
              }
              break;
            }
            if (config.maxSendClicks > 0 && cycleSendClicks >= config.maxSendClicks) {
              logSendDiagnostic("send_click_limit_reached", { cycleSendClicks, limit: config.maxSendClicks }, true);
              await robustDelay(SEND_ACK_POLL_MS);
              break;
            }
            if (config.maxTotalSendClicks > 0 && totalSendClicks >= config.maxTotalSendClicks) {
              logSendDiagnostic("total_send_limit_reached", { totalSendClicks, limit: config.maxTotalSendClicks }, true);
              stop();
              break;
            }
            cycleSendClicks++;
            totalSendClicks++;
            await simulateClick(sendBtn, { single: Boolean(config.singleSendClick) });
            if (config.maxTotalSendClicks > 0 && totalSendClicks >= config.maxTotalSendClicks) stopRequested = true;
            lastClickedElement = sendBtn;
            lastClickTime = Date2.now();
            sendButtonAttempts++;
            markFinalSendClicked();
            ackStartedAt = Date2.now();
            setAutomationState("awaitSendAck", "final_send_clicked");
            logSendDiagnostic("send_clicked", { sendAttempt: sendButtonAttempts, cycleId: selectedCycleId }, true);
            break;
          }
          case "awaitSendAck": {
            const ack = await waitForSendAcknowledgement({
              timeoutMs: SEND_ACK_WINDOW_MS,
              pollMs: SEND_ACK_POLL_MS
            });
            if (ack.confirmed) {
              markPostSendTransition(ack.reason);
              if (hasStrictSendProof()) {
                updateSnapsSent(strictSendCycle.selectedRecipientCount || selectedRecipientCount);
              } else {
                logSendDiagnostic("count_blocked_no_strict_proof", { reason: ack.reason }, true);
              }
              resetStrictCycle("await_ack_confirmed");
              setAutomationState("waitingForLoop", "await_ack_confirmed");
              logSendDiagnostic("send_ack_confirmed", { ackResult: ack.reason }, true);
              break;
            }
            const hardElapsed = Date2.now() - sendHardTimeoutStartedAt;
            if (hardElapsed >= SEND_HARD_TIMEOUT_MS) {
              console.warn(`Hard timeout after send click (${SEND_HARD_TIMEOUT_MS}ms). Resetting cycle.`);
              logSendDiagnostic("ack_hard_timeout_recovery", { hardElapsed, ackResult: ack.reason }, true);
              peopleClickIndex = 0;
              resetStrictCycle("await_ack_hard_timeout");
              setAutomationState("searching", "await_ack_hard_timeout");
              break;
            }
            setAutomationState("commitFinalSend", "await_ack_retry_send_only");
            logSendDiagnostic("ack_retry_send_only", { ackResult: ack.reason });
            break;
          }
          default:
            if (currentState === "searching") {
              const cameraBtn = await findElementQuick("cameraButton");
              if (cameraBtn && !isSameElementClicked(cameraBtn)) {
                console.log("Found camera button, clicking to open camera interface");
                await simulateClick(cameraBtn);
                lastClickedElement = cameraBtn;
                lastClickTime = Date2.now();
                console.log("Clicked camera button");
                setAutomationState("takePicture", "camera_button_clicked");
                return;
              }
            }
            if (currentState === "searching" || currentState === "takePicture") {
              const takePicBtn = await findElementQuick("takePictureButton");
              if (takePicBtn && !isSameElementClicked(takePicBtn)) {
                const hasInnerDiv = takePicBtn.querySelector('div[role="button"]') !== null;
                const buttonVersion = takePicBtn.classList.contains("fE2D5") ? "new" : "old";
                console.log("Take picture button found:", {
                  version: buttonVersion,
                  hasInnerDiv,
                  tagName: takePicBtn.tagName,
                  classes: takePicBtn.className
                });
                console.log("Attempting to click take picture button...");
                const video = document2.querySelector("video");
                if (video && video.paused && typeof video.play === "function") {
                  console.log("Video is paused, attempting to play");
                  video.play().catch((e) => console.log("Could not play video:", e));
                }
                const innerButton = takePicBtn.querySelector('div[role="button"]');
                console.log("Clicking take picture button");
                if (innerButton) {
                  await simulateClick(takePicBtn);
                  await simulateClick(innerButton);
                } else {
                  await simulateClick(takePicBtn);
                }
                if (!innerButton && takePicBtn.classList.contains("FBYjn")) {
                  console.log("Detected older button version (FBYjn class), using standard clicks");
                  takePicBtn.click();
                  const customClick = new CustomEvent("customclick", { bubbles: true });
                  takePicBtn.dispatchEvent(customClick);
                }
                try {
                  const rect = takePicBtn.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const touchStart = new TouchEvent("touchstart", {
                    bubbles: true,
                    cancelable: true,
                    view: window2,
                    touches: [new Touch({
                      identifier: Date2.now(),
                      target: takePicBtn,
                      clientX: centerX,
                      clientY: centerY,
                      radiusX: 2.5,
                      radiusY: 2.5,
                      rotationAngle: 0,
                      force: 1
                    })]
                  });
                  const touchEnd = new TouchEvent("touchend", {
                    bubbles: true,
                    cancelable: true,
                    view: window2,
                    changedTouches: [new Touch({
                      identifier: Date2.now(),
                      target: takePicBtn,
                      clientX: centerX,
                      clientY: centerY,
                      radiusX: 2.5,
                      radiusY: 2.5,
                      rotationAngle: 0,
                      force: 0
                    })]
                  });
                  takePicBtn.dispatchEvent(touchStart);
                  takePicBtn.dispatchEvent(touchEnd);
                  console.log("Dispatched touch events");
                } catch (e) {
                  console.log("Touch events not supported or failed:", e);
                }
                lastClickedElement = takePicBtn;
                lastClickTime = Date2.now();
                console.log("Completed all click attempts on take picture button");
                setAutomationState("sendTo", "picture_taken");
                return;
              }
            }
            if (currentState === "searching" || currentState === "sendTo") {
              const sendToBtn = await findElementQuick("sendToButton");
              if (sendToBtn && !isSameElementClicked(sendToBtn)) {
                await simulateClick(sendToBtn);
                lastClickedElement = sendToBtn;
                lastClickTime = Date2.now();
                console.log("Clicked Send To button");
                setAutomationState("selectRecipients", "send_to_clicked");
                peopleClickIndex = 0;
                recipientSelectionAttempts = 0;
                recipientsPreparedForSend = false;
                selectedRecipientCount = 0;
                commitStartedAt = 0;
                ackStartedAt = 0;
                sendHardTimeoutStartedAt = 0;
                finalSendClickIssued = false;
                return;
              }
            }
            break;
        }
        if (["takePicture", "sendTo", "selectRecipients", "commitFinalSend", "awaitSendAck"].includes(currentState)) {
          const expectedMarkerPresent = await hasExpectedMarkerForState(currentState);
          if (!expectedMarkerPresent) {
            const resynced = await resyncStateFromClassifier(currentState, "expected_marker_missing_post_pass");
            if (resynced) {
              return;
            }
          } else {
            stateFailCount = 0;
          }
        }
        if (currentState !== "searching" && currentState !== "selectRecipients" && currentState !== "prepareFinalSend" && currentState !== "commitFinalSend" && currentState !== "awaitSendAck" && currentState !== "waitingForLoop") {
          if (Date2.now() - stateStartTime > 5e3) {
            console.log(`Stuck in state ${currentState} for too long (>5s), resetting to searching`);
            currentState = "searching";
            currentStateId = "searching";
            statePointer = "searching";
            stateFailCount = 0;
            lastResyncAt = 0;
            strictSendCycle = null;
            lastClickedElement = null;
            peopleClickIndex = 0;
            recipientSelectionAttempts = 0;
            recipientsPreparedForSend = false;
            selectedRecipientCount = 0;
            commitStartedAt = 0;
            ackStartedAt = 0;
            sendHardTimeoutStartedAt = 0;
            finalSendClickIssued = false;
            sendButtonAttempts = 0;
            stateStartTime = Date2.now();
          }
        }
        const passTime = Date2.now() - passStart;
        if (random() < 1e-3) {
          console.log(`Pass completed in ${passTime}ms, state: ${currentState}`);
        }
      }
      async function performActions() {
        while (actionInProgress) {
          if (stopRequested) {
            let cameraFound = false;
            let takePicFound = false;
            if (Boolean(smartFinder) && smartFinder) {
              try {
                const cameraResult = await smartFinder.findElement(elementConfigs.cameraButton.fingerprint, {
                  fallbackSelectors: elementConfigs.cameraButton.fallbackSelectors,
                  threshold: 0.7,
                  useCache: true,
                  maxCandidates: 50,
                  timeout: 100
                });
                cameraFound = !!(cameraResult && cameraResult.element && cameraResult.confidence > 0.7);
              } catch (e) {
                console.log("Error finding camera button:", e);
                cameraFound = false;
              }
            }
            if (!cameraFound && Boolean(smartFinder) && smartFinder) {
              try {
                const takePicResult = await smartFinder.findElement(elementConfigs.takePictureButton.fingerprint, {
                  fallbackSelectors: elementConfigs.takePictureButton.fallbackSelectors,
                  threshold: 0.7,
                  useCache: true,
                  maxCandidates: 50,
                  timeout: 100
                });
                takePicFound = !!(takePicResult && takePicResult.element && takePicResult.confidence > 0.7);
              } catch (e) {
                console.log("Error finding take picture button:", e);
                takePicFound = false;
              }
            }
            if (!cameraFound && !takePicFound) {
              const takePicBtn = document2.querySelector("button.fE2D5");
              if (takePicBtn && takePicBtn.offsetWidth > 0 && takePicBtn.offsetHeight > 0) {
                takePicFound = true;
              }
            }
            const sendToButton = document2.querySelector("button.YatIx");
            const peopleList = document2.querySelector('ul[role="list"] li.Ewflr') || document2.querySelector(".L7aBq");
            const sendButton = document2.querySelector('button[type="submit"].TYX6O');
            let hasSendToText = false;
            const buttons = document2.querySelectorAll("button span");
            for (const span of buttons) {
              if (span.textContent && span.textContent.toLowerCase().includes("send to")) {
                hasSendToText = true;
                break;
              }
            }
            const onSendScreens = !!(sendToButton || peopleList || sendButton || hasSendToText);
            const inWaitingLoopLongEnough = currentState === "waitingForLoop" && Date2.now() - stateStartTime > 1e3;
            if ((cameraFound || takePicFound) && !onSendScreens || inWaitingLoopLongEnough && !onSendScreens) {
              console.log("Stop requested and VERIFIED at home state, stopping now", {
                cameraFound,
                takePicFound,
                currentState,
                onSendScreens,
                inWaitingLoopLongEnough,
                timeInState: Date2.now() - stateStartTime
              });
              stopRequested = false;
              actuallyStopAutomation();
              break;
            } else {
              console.log("Stop requested but NOT at home state yet, continuing...", {
                currentState,
                cameraFound,
                takePicFound,
                onSendScreens,
                inWaitingLoopLongEnough,
                timeInState: Date2.now() - stateStartTime,
                hasElements: {
                  sendToButton: !!sendToButton,
                  peopleList: !!peopleList,
                  sendButton: !!sendButton,
                  hasSendToText
                }
              });
            }
          }
          await performSinglePass();
          const loopDelay = config.loopDelay;
          await robustDelay(loopDelay);
          if (random() < 0.1) {
            await robustDelay(16);
          }
        }
        console.log("performActions loop ended");
      }
      function managePatternCache() {
        if (smartFinder) {
          if (snapsSent % 100 === 0) {
            const cacheSize = smartFinder.cache.size;
            console.log(`Pattern recognition cache size: ${cacheSize} elements`);
            console.log(`Total snaps sent: ${snapsSent}`);
          }
          if (smartFinder.cache.size > 50) {
            console.log("Clearing pattern recognition cache (size exceeded 50)");
            smartFinder.cleanCache();
          }
        }
      }
      loopPromise = performActions().catch((e) => lifecycle.error(e)).finally(() => {
        actuallyStopAutomation();
        loopPromise = null;
        releaseCanvas();
      });
    }
    function stopSendAutomation() {
      stop();
    }
    function actuallyStopAutomation() {
      actionInProgress = false;
      stopRequested = false;
      if (errorHandlers) {
        window2.removeEventListener("error", errorHandlers.error);
        errorHandlers = null;
      }
      lifecycle.stop();
    }
    function rowLabel(row) {
      const nameEl = row.querySelector(".RBx9s.nonIntl, .mYSR9.nonIntl");
      return String(nameEl?.textContent || "").normalize("NFKC").replace(/\s+/g, " ").trim();
    }
    function isRowSelected(row) {
      if (typeof config.isRowSelected === "function") {
        try {
          return Boolean(config.isRowSelected(row));
        } catch {
          return false;
        }
      }
      if (["aria-selected", "aria-checked", "aria-pressed"].some((a) => row.getAttribute(a) === "true")) return true;
      if (row.querySelector('input[type="checkbox"]:checked, [aria-checked="true"], [aria-pressed="true"], [aria-selected="true"]')) return true;
      return /(^|[\s_-])(selected|checked)([\s_-]|$)/i.test(String(row.className || ""));
    }
    function inspectRows() {
      return Array.from(document2.querySelectorAll("li.Ewflr, li.RbA83")).map((row) => ({
        name: rowLabel(row),
        selected: isRowSelected(row),
        html: row.outerHTML.slice(0, 600)
      }));
    }
    function addPerson(name) {
      if (!normalizeRecipientLabel(name) || isDuplicateRecipient(People, name)) return false;
      People.push(String(name).trim());
      return true;
    }
    function addShortcut(name) {
      if (!normalizeRecipientLabel(name) || isDuplicateRecipient(Shortcuts, name)) return false;
      Shortcuts.push(String(name).trim());
      return true;
    }
    function getState() {
      return { running: actionInProgress, state: currentState, snapsSent, recipientMode, userNames: [...People], shortcutNames: [...Shortcuts], shortcutMembers: [...cycleMembers] };
    }
    function stop() {
      actuallyStopAutomation();
      releaseCanvas();
      return loopPromise || Promise.resolve();
    }
    function start() {
      if (loopPromise || actionInProgress) return loopPromise;
      if (!getActiveRecipients().length) throw Error("At least one recipient is required");
      lifecycle.begin();
      installCanvas();
      startSendAutomation();
      return loopPromise;
    }
    setRecipientMode(options.recipientMode);
    for (const n of options.recipients || []) (recipientMode === "shortcut" ? addShortcut : addPerson)(n);
    return { start, stop, getState, inspectRows, dispose() {
      const p = stop();
      lifecycle.dispose();
      smartFinder.clearCache?.();
      return p;
    } };
  }

  // gui.js
  var SENDER_DEFAULTS = {
    targetSnapCount: 1,
    actionDelay: 400,
    singleSendClick: true,
    maxSendClicks: 1,
    maxTotalSendClicks: 1,
    patchCanvas: false
  };
  var STORE = "ghostmessage.panel.v1";
  var DEFAULTS = { tab: "shortcut", shortcut: "", names: "", count: 1, forever: false, gap: 0, members: false, minimized: false, x: null, y: null };
  var CYCLE_WATCHDOG_MS = 45e3;
  var MAX_FAILURES_IN_A_ROW = 3;
  var MIN_GAP_SECONDS = 0;
  var load = () => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) || "{}") };
    } catch {
      return { ...DEFAULTS };
    }
  };
  var save = (v) => {
    try {
      localStorage.setItem(STORE, JSON.stringify(v));
    } catch {
    }
  };
  var CSS2 = `
:host{all:initial}
*{box-sizing:border-box}
[hidden]{display:none!important}
.panel{width:300px;font:13px/1.4 ui-sans-serif,"Segoe UI",system-ui,sans-serif;color:#1c2433;background:#eef1f5;border:1px solid #cfd6e0;border-radius:10px;box-shadow:0 10px 30px rgba(20,30,50,.28);overflow:hidden}
.bar{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 8px 12px;background:#1c2433;color:#eef1f5;cursor:grab;user-select:none;touch-action:none}
.bar:active{cursor:grabbing}
.title{font-weight:600;letter-spacing:.01em}
.body{padding:12px;display:grid;gap:10px}
.readout{display:flex;align-items:baseline;gap:8px}
.done{font-size:44px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums}
.of{font-size:16px;color:#5b6678;font-variant-numeric:tabular-nums}
.status{margin:0;min-height:1.4em;color:#5b6678}
.status.bad{color:#c7372f}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:3px;background:#dfe4ec;border-radius:8px}
.tabs button{border:0;border-radius:6px;padding:6px;background:transparent;color:#5b6678;font:inherit;cursor:pointer}
.tabs button[aria-selected="true"]{background:#fff;color:#1c2433;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.12)}
label{display:grid;gap:4px;color:#3a4558}
input[type=text],input[type=number],textarea,select{width:100%;font:inherit;color:#1c2433;background:#fff;border:1px solid #cfd6e0;border-radius:6px;padding:6px 8px}
textarea{resize:vertical}
.row{display:grid;grid-template-columns:1fr auto;gap:6px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.check{display:flex;align-items:center;gap:8px}
.hint{margin:0;font-size:12px;color:#6a7588}
button{font:inherit}
.quiet{border:1px solid #cfd6e0;background:#fff;color:#1c2433;border-radius:6px;padding:6px 10px;cursor:pointer}
.ghost{border:0;background:transparent;color:inherit;font-size:16px;line-height:1;padding:2px 6px;cursor:pointer;border-radius:4px}
.go{border:0;border-radius:8px;padding:10px;background:#0e8f7e;color:#fff;font-weight:600;cursor:pointer}
.go.stop{background:#c7372f}
.log{list-style:none;margin:0;padding:8px;background:#fff;border:1px solid #d9dfe8;border-radius:6px;max-height:112px;overflow:auto;font-size:12px;color:#3a4558}
.log li{padding:1px 0}
.log time{color:#8a94a6;margin-right:6px;font-variant-numeric:tabular-nums}
input:disabled,textarea:disabled,select:disabled{opacity:.6}
button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #0e8f7e;outline-offset:1px}
@media (prefers-reduced-motion:no-preference){.go{transition:background .15s}}
`;
  var HTML = `
<style>${CSS2}</style>
<section class="panel">
  <header class="bar" id="bar"><span class="title">Ghost Messenger</span><button class="ghost" id="min" aria-label="Minimize panel">&ndash;</button></header>
  <div class="body" id="body">
    <div class="readout" aria-live="polite"><span class="done" id="done">0</span><span class="of" id="of">of 1</span></div>
    <p class="status" id="status">Ready</p>
    <div class="tabs" role="tablist">
      <button role="tab" id="tab-shortcut" aria-selected="true">Shortcut</button>
      <button role="tab" id="tab-names" aria-selected="false">Names</button>
    </div>
    <div id="pane-shortcut">
      <label>Shortcut name<input type="text" id="shortcut" placeholder="Paste the emoji, for example \u{1F6EB}"></label>
      <div class="row" style="margin-top:6px"><select id="found" aria-label="Shortcuts found on the page"><option value="">Shortcuts found</option></select><button class="quiet" id="find">Find shortcuts</button></div>
      <p class="hint" style="margin-top:6px">Take a snap and open Send To, then press Find shortcuts.</p>
    </div>
    <div id="pane-names" hidden>
      <label>Names, one per line<textarea id="names" rows="4"></textarea></label>
      <p class="hint" style="margin-top:6px">Type each name exactly as it shows on the Send To screen.</p>
    </div>
    <div class="grid">
      <label>Snaps to send<input type="number" id="count" min="1" max="9999"></label>
      <label>Wait between (sec)<input type="number" id="gap" min="${MIN_GAP_SECONDS}" max="3600"></label>
    </div>
    <label class="check"><input type="checkbox" id="forever"> Keep going until I press Stop</label>
    <label class="check"><input type="checkbox" id="members"> Read shortcut members (experimental)</label>
    <button class="go" id="go">Start</button>
    <ol class="log" id="log" aria-label="Activity"></ol>
  </div>
</section>`;
  function mountPanel(doc = document) {
    doc.getElementById("ghostmessage-panel")?.remove();
    const host = doc.createElement("div");
    host.id = "ghostmessage-panel";
    Object.assign(host.style, { position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647" });
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = HTML;
    const $ = (id) => root.getElementById(id);
    for (const type of ["keydown", "keyup", "keypress"]) root.addEventListener(type, (e) => e.stopPropagation());
    const settings = load();
    let running = false, stopping = false, current = null, sent = 0;
    function status(text, bad = false) {
      $("status").textContent = text;
      $("status").classList.toggle("bad", bad);
    }
    function log(text) {
      const li = doc.createElement("li");
      const t = doc.createElement("time");
      t.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      li.append(t, doc.createTextNode(text));
      $("log").prepend(li);
      while ($("log").children.length > 30) $("log").lastChild.remove();
    }
    function readout(total) {
      $("done").textContent = String(sent);
      $("of").textContent = total === Infinity ? "of \u221E" : "of " + total;
    }
    function showTab(tab) {
      settings.tab = tab;
      $("pane-shortcut").hidden = tab !== "shortcut";
      $("pane-names").hidden = tab !== "names";
      $("tab-shortcut").setAttribute("aria-selected", String(tab === "shortcut"));
      $("tab-names").setAttribute("aria-selected", String(tab === "names"));
    }
    function applyForever() {
      $("count").disabled = $("forever").checked || running;
    }
    function lockInputs(locked) {
      for (const id of ["shortcut", "names", "gap", "forever", "members", "find", "found", "tab-shortcut", "tab-names"]) $(id).disabled = locked;
      applyForever();
    }
    function readSettings() {
      settings.shortcut = $("shortcut").value.trim();
      settings.names = $("names").value;
      settings.count = Math.max(1, Math.min(9999, parseInt($("count").value, 10) || 1));
      settings.gap = Math.max(MIN_GAP_SECONDS, parseInt($("gap").value, 10) || MIN_GAP_SECONDS);
      settings.forever = $("forever").checked;
      settings.members = $("members").checked;
      save(settings);
      return settings;
    }
    function findShortcuts() {
      const labels = [];
      for (const b of doc.querySelectorAll("div.THeKv > button.c47Sk, button.c47Sk")) {
        const label = (b.textContent || "").trim();
        if (label && b.offsetWidth > 0 && !labels.includes(label)) labels.push(label);
      }
      const sel = $("found");
      sel.replaceChildren(new Option(labels.length ? "Pick a shortcut" : "None found", ""));
      for (const l of labels) sel.append(new Option(l, l));
      if (labels.length) {
        status(labels.length + " shortcut(s) found");
      } else {
        status("No shortcuts on this screen. Open Send To first.", true);
      }
    }
    async function runCycle(s) {
      let clicked = false;
      const useShortcut = s.tab === "shortcut";
      const recipients = useShortcut ? [s.shortcut] : s.names.split("\n").map((n) => n.trim()).filter(Boolean);
      const sender = createSender({
        document: doc,
        recipients,
        recipientMode: useShortcut ? "shortcut" : "nickname",
        expandShortcuts: useShortcut && s.members,
        ...SENDER_DEFAULTS,
        onState: (st) => {
          if (st.state === "awaitSendAck" && st.reason === "final_send_clicked") clicked = true;
        },
        onShortcutMembers: (m) => log("Shortcut has " + m.members.length + " member(s)"),
        onDiagnostic: (d) => {
          if (d.level === "warning" && d.message) log(d.message);
        },
        onError: (e) => log("Error: " + e.message)
      });
      current = sender;
      const watchdog = setTimeout(() => sender.stop(), CYCLE_WATCHDOG_MS);
      try {
        await sender.start();
      } catch (e) {
        log("Could not start: " + e.message);
      } finally {
        clearTimeout(watchdog);
        try {
          await sender.dispose();
        } catch {
        }
        current = null;
      }
      return clicked;
    }
    async function waitGap(seconds) {
      const end = Date.now() + seconds * 1e3;
      while (!stopping && Date.now() < end) {
        status("Next send in " + Math.ceil((end - Date.now()) / 1e3) + "s");
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    async function start() {
      if (running) return;
      const s = readSettings();
      if (s.tab === "shortcut" && !s.shortcut) {
        status("Enter a shortcut name first.", true);
        return;
      }
      if (s.tab === "names" && !s.names.split("\n").some((n) => n.trim())) {
        status("Add at least one name first.", true);
        return;
      }
      const total = s.forever ? Infinity : s.count;
      running = true;
      stopping = false;
      sent = 0;
      let failures = 0, ending = "Finished";
      $("go").textContent = "Stop";
      $("go").classList.add("stop");
      lockInputs(true);
      readout(total);
      log("Started: " + (total === Infinity ? "until stopped" : total + " send(s)"));
      while (!stopping && sent < total) {
        status("Sending " + (sent + 1) + (total === Infinity ? "" : " of " + total) + "\u2026");
        const ok = await runCycle(s);
        if (ok) {
          sent++;
          failures = 0;
          log("Send " + sent + " clicked");
          readout(total);
        } else if (!stopping) {
          failures++;
          log("No send detected (" + failures + " of " + MAX_FAILURES_IN_A_ROW + ")");
          if (failures >= MAX_FAILURES_IN_A_ROW) {
            ending = "Stopped: no send detected " + MAX_FAILURES_IN_A_ROW + " times in a row";
            break;
          }
        }
        if (stopping || sent >= total) break;
        await waitGap(s.gap);
      }
      if (stopping) ending = "Stopped after " + sent;
      else if (ending === "Finished") ending = "Finished: " + sent + " sent";
      running = false;
      stopping = false;
      $("go").textContent = "Start";
      $("go").classList.remove("stop");
      lockInputs(false);
      status(ending, ending.startsWith("Stopped:"));
      log(ending);
    }
    function stop() {
      if (!running) return;
      stopping = true;
      status("Stopping\u2026");
      current?.stop();
    }
    $("shortcut").value = settings.shortcut;
    $("names").value = settings.names;
    $("count").value = settings.count;
    $("gap").value = settings.gap;
    $("forever").checked = settings.forever;
    $("members").checked = settings.members;
    showTab(settings.tab);
    applyForever();
    readout(settings.forever ? Infinity : settings.count);
    $("tab-shortcut").onclick = () => showTab("shortcut");
    $("tab-names").onclick = () => showTab("names");
    $("find").onclick = findShortcuts;
    $("found").onchange = () => {
      if ($("found").value) $("shortcut").value = $("found").value;
    };
    $("forever").onchange = () => {
      applyForever();
      readout($("forever").checked ? Infinity : parseInt($("count").value, 10) || 1);
    };
    $("count").oninput = () => {
      if (!running) readout(parseInt($("count").value, 10) || 1);
    };
    $("go").onclick = () => running ? stop() : start();
    $("min").onclick = () => {
      settings.minimized = !settings.minimized;
      $("body").hidden = settings.minimized;
      save(settings);
    };
    $("body").hidden = settings.minimized;
    $("bar").addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const rect = host.getBoundingClientRect();
      const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
      $("bar").setPointerCapture(e.pointerId);
      const move = (ev) => {
        const x = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - dx));
        const y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy));
        Object.assign(host.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" });
        settings.x = x;
        settings.y = y;
      };
      const up = () => {
        $("bar").removeEventListener("pointermove", move);
        $("bar").removeEventListener("pointerup", up);
        save(settings);
      };
      $("bar").addEventListener("pointermove", move);
      $("bar").addEventListener("pointerup", up);
    });
    if (settings.x != null && settings.y != null) {
      Object.assign(host.style, { left: Math.min(settings.x, window.innerWidth - 80) + "px", top: Math.min(settings.y, window.innerHeight - 60) + "px", right: "auto", bottom: "auto" });
    }
    doc.body.append(host);
    return { start, stop, destroy() {
      stop();
      host.remove();
    } };
  }

  // gui-entry.js
  window.__ghostPanel?.destroy?.();
  window.__ghostPanel = mountPanel(document);
})();
