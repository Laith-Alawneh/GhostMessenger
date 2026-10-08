var Ghost = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
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
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // index.js
  var index_exports = {};
  __export(index_exports, {
    createOpener: () => createOpener,
    createSender: () => createSender
  });

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
    const document = options.document || globalThis.document;
    if (!document?.defaultView) throw Error("A browser document with defaultView is required");
    return document;
  }

  // patterns.js
  function createPatternFinder(document, options = {}) {
    const window = document.defaultView;
    const { Element, HTMLElement, Node, XPathResult } = window;
    const getComputedStyle = window.getComputedStyle.bind(window);
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
        const style = window.getComputedStyle(element);
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
          const label = document.querySelector(`label[for="${element.id}"]`);
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
            const elements = document.querySelectorAll(selector);
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
            const elements = document.querySelectorAll(selector);
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
        return Array.from(document.querySelectorAll(`[aria-label="${ariaLabel}"]`));
      }
      findByRole(role, preferredTag = null) {
        const elements = document.querySelectorAll(`[role="${role}"]`);
        if (!preferredTag) {
          return Array.from(elements);
        }
        return Array.from(elements).filter((el) => el.tagName.toLowerCase() === preferredTag);
      }
      findByAriaDescribedBy(ariaDescribedBy) {
        return Array.from(document.querySelectorAll(`[aria-describedby="${ariaDescribedBy}"]`));
      }
      findByStructure(fingerprint) {
        const candidates = [];
        if (fingerprint.tagName && fingerprint.parentTag) {
          const selector = `${fingerprint.parentTag} > ${fingerprint.tagName}`;
          candidates.push(...document.querySelectorAll(selector));
        }
        if (fingerprint.tagName && fingerprint.classList && fingerprint.classList.length > 0) {
          const classSelector = fingerprint.classList.map((c) => `.${c}`).join("");
          const selector = `${fingerprint.tagName}${classSelector}`;
          try {
            candidates.push(...document.querySelectorAll(selector));
          } catch (e) {
          }
        }
        if (fingerprint.listContext) {
          const lists = document.querySelectorAll(fingerprint.listContext.listTag);
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
            candidates.push(...document.querySelectorAll(selector));
          } catch (e) {
            console.warn("Invalid attribute selector:", selector);
          }
        }
        if (fingerprint.dataAttributes) {
          for (const [key, value] of Object.entries(fingerprint.dataAttributes)) {
            try {
              candidates.push(...document.querySelectorAll(`[${key}="${value}"]`));
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
        const elements = document.querySelectorAll(tagName);
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
          const result = document.evaluate(
            xpath,
            document,
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
        if (!document.contains(element)) {
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
            const matches = document.querySelectorAll(selector);
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
    const document = requireDocument(options), window = document.defaultView;
    const { Element, HTMLElement, Node, MouseEvent, PointerEvent, TouchEvent, Touch, Event, HTMLCanvasElement } = window;
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
    const { finder: smartFinder, configs: elementConfigs } = createPatternFinder(document, { now: () => lifecycle.clock.now(), onDiagnostic: (data) => lifecycle.emit("onDiagnostic", data) });
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
    let isPageVisible = !document.hidden;
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
            const closeButton = document.querySelector('button[aria-label="Close"]') || document.querySelector("button.close") || document.querySelector('[role="button"][aria-label*="close"]');
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
      window.addEventListener("error", errorHandler);
      const activeRecipientsAtStart = getActiveRecipients();
      console.log("Starting automation with recipient mode:", recipientMode);
      console.log("Nickname recipients:", People);
      console.log("Shortcut recipients:", Shortcuts);
      console.log("Active recipients count:", activeRecipientsAtStart.length);
      if (activeRecipientsAtStart.length === 0) {
        console.error("ERROR: Active recipient array is empty. Cannot send snaps without recipients.");
        console.error(`Please add at least one ${recipientMode === "shortcut" ? "shortcut" : "nickname"} before starting automation.`);
        actionInProgress = false;
        window.removeEventListener("error", errorHandler);
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
        const style = window.getComputedStyle(element);
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
          const candidate = document.querySelector(selector);
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
        const cameraBtn = document.querySelector("button.qJKfS");
        if (isElementInteractable(cameraBtn)) return true;
        const takePicBtn = document.querySelector("button.fE2D5, button.FBYjn");
        return isElementInteractable(takePicBtn);
      }
      function isElementVisible(element) {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }
      function isSendToViewVisible() {
        const byClass = document.querySelector("button.YatIx");
        if (isElementVisible(byClass)) return true;
        const byText = Array.from(document.querySelectorAll("button")).find((button) => {
          const label = normalizeRecipientLabel(button.textContent || button.innerText);
          return label.includes("send to") && isElementVisible(button);
        });
        if (byText) return true;
        const hasDownloadButton = Array.from(document.querySelectorAll("button")).some((button) => {
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
          (selector) => Array.from(document.querySelectorAll(selector)).some((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
        );
      }
      async function hasExpectedMarkerForState(stateId) {
        switch (stateId) {
          case "searching":
            return Boolean(
              document.querySelector("button.qJKfS") || document.querySelector("button.fE2D5, button.FBYjn")
            );
          case "takePicture":
            return Boolean(document.querySelector("button.fE2D5, button.FBYjn"));
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
        markers.takePicture = Boolean(document.querySelector("button.fE2D5, button.FBYjn"));
        if (markers.takePicture) {
          return { screenId: "takePicture", confidence: 0.82, markers };
        }
        markers.cameraHome = Boolean(document.querySelector("button.qJKfS"));
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
            const listItems = document.querySelectorAll("li.Ewflr, li.RbA83");
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
        const nameElements = document.querySelectorAll(".RBx9s.nonIntl");
        const groupchatElements = document.querySelectorAll(".mYSR9.nonIntl");
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
        const byClass = Array.from(document.querySelectorAll("button.Y7u8A"));
        const visibleClassMatch = byClass.find((button) => button.offsetWidth > 0 && button.offsetHeight > 0);
        if (visibleClassMatch) {
          return visibleClassMatch;
        }
        const byText = Array.from(document.querySelectorAll("button")).find((button) => {
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
              const buttons = Array.from(document.querySelectorAll("div.THeKv > button.c47Sk, button.c47Sk"));
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
        const fallbackButtons = Array.from(document.querySelectorAll("div.THeKv > button.c47Sk, button.c47Sk"));
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
        for (let node = row.parentElement; node && node !== document.body; node = node.parentElement) {
          if (node.scrollHeight > node.clientHeight + 4) return node;
        }
        return null;
      }
      function collectSelectedRows(into) {
        for (const row of document.querySelectorAll("li.Ewflr, li.RbA83")) {
          const label = rowLabel(row);
          if (label && isRowSelected(row) && !isDuplicateRecipient(into, label)) into.push(label);
        }
      }
      async function harvestShortcutMembers(shortcutLabel) {
        await robustDelay(Math.max(60, config.actionDelay));
        const names = [];
        collectSelectedRows(names);
        const firstRow = document.querySelector("li.Ewflr, li.RbA83");
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
            view: window,
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
            view: window,
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
          view: window,
          button: 0,
          buttons: 1,
          clientX: centerX,
          clientY: centerY
        });
        const mouseupEvent = new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
          button: 0,
          buttons: 0,
          clientX: centerX,
          clientY: centerY
        });
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
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
            element = document.querySelector("button.qJKfS");
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
              element = document.querySelector(selector);
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
            const buttons = Array.from(document.querySelectorAll("button"));
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
              element = document.querySelector(selector);
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
                const video = document.querySelector("video");
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
                    view: window,
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
                    view: window,
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
              const takePicBtn = document.querySelector("button.fE2D5");
              if (takePicBtn && takePicBtn.offsetWidth > 0 && takePicBtn.offsetHeight > 0) {
                takePicFound = true;
              }
            }
            const sendToButton = document.querySelector("button.YatIx");
            const peopleList = document.querySelector('ul[role="list"] li.Ewflr') || document.querySelector(".L7aBq");
            const sendButton = document.querySelector('button[type="submit"].TYX6O');
            let hasSendToText = false;
            const buttons = document.querySelectorAll("button span");
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
        window.removeEventListener("error", errorHandlers.error);
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
      return Array.from(document.querySelectorAll("li.Ewflr, li.RbA83")).map((row) => ({
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

  // opener.js
  function createOpener(options = {}) {
    const document = requireDocument(options), window = document.defaultView;
    const { Element, HTMLElement, KeyboardEvent, Event } = window;
    const lifecycle = createLifecycle(options);
    const Date2 = { now: () => lifecycle.clock.now() };
    const console = { log() {
    }, debug() {
    }, warn(...a) {
      lifecycle.emit("onDiagnostic", { level: "warning", message: a.map(String).join(" ") });
    }, error(...a) {
      lifecycle.emit("onError", { message: a.map(String).join(" ") });
    } };
    const config = { singleDelay: 300, multiDelay: 200, ...options };
    "use strict";
    let multiModeNames = [];
    let isMultiRunning = false;
    let multiSnapsOpened = 0;
    let multiLoopPromise = null;
    let multiCycleCounter = 0;
    let multiDiagTick = 0;
    let multiStateId = "multi_findOpenable";
    let isSingleRunning = false;
    let singleSnapsOpened = 0;
    let singleLoopPromise = null;
    let lastSingleElementClicked = null;
    let singleLastOpenableSeenAt = Date2.now();
    let singleCycleCounter = 0;
    let singleCycle = null;
    let singleDiagTick = 0;
    let singleStateId = "single_findOpenable";
    let singleStatePointer = "single_findOpenable";
    let singleStateFailCount = 0;
    let singleLastResyncAt = 0;
    const SINGLE_STATE_GRAPH = {
      single_findOpenable: { id: "single_findOpenable", prev: "single_interCycleDelay", next: "single_clickOpenable" },
      single_clickOpenable: { id: "single_clickOpenable", prev: "single_findOpenable", next: "single_waitOpened" },
      single_waitOpened: { id: "single_waitOpened", prev: "single_clickOpenable", next: "single_closeOpenedSnap" },
      single_closeOpenedSnap: { id: "single_closeOpenedSnap", prev: "single_waitOpened", next: "single_waitReturned" },
      single_waitReturned: { id: "single_waitReturned", prev: "single_closeOpenedSnap", next: "single_interCycleDelay" },
      single_interCycleDelay: { id: "single_interCycleDelay", prev: "single_waitReturned", next: "single_findOpenable" }
    };
    const OPEN_IDLE_TIMEOUT_MS = 5e3;
    const OPEN_MIN_POLL_MS = 45;
    const OPEN_TRANSITION_TIMEOUT_MS = 1400;
    const OPEN_RETURN_TIMEOUT_MS = 1800;
    const OPEN_MIN_VIEW_DWELL_MS = 280;
    const OPEN_CLOSE_RETRY_MS = 80;
    const OPEN_MAX_CLOSE_ATTEMPTS = 3;
    const OPEN_HARD_CYCLE_TIMEOUT_MS = 4200;
    const SINGLE_RESYNC_MISS_THRESHOLD = 2;
    const SINGLE_RESYNC_CONFIDENCE_THRESHOLD = 0.62;
    const SINGLE_RESYNC_MIN_INTERVAL_MS = 120;
    const MULTI_RESYNC_MISS_THRESHOLD = 2;
    const MULTI_RESYNC_CONFIDENCE_THRESHOLD = 0.62;
    const MULTI_RESYNC_MIN_INTERVAL_MS = 120;
    const MULTI_STATE_GRAPH = {
      multi_findOpenable: { id: "multi_findOpenable", prev: "multi_interCycleDelay", next: "multi_clickOpenable" },
      multi_clickOpenable: { id: "multi_clickOpenable", prev: "multi_findOpenable", next: "multi_waitOpened" },
      multi_waitOpened: { id: "multi_waitOpened", prev: "multi_clickOpenable", next: "multi_closeOpenedSnap" },
      multi_closeOpenedSnap: { id: "multi_closeOpenedSnap", prev: "multi_waitOpened", next: "multi_waitReturned" },
      multi_waitReturned: { id: "multi_waitReturned", prev: "multi_closeOpenedSnap", next: "multi_interCycleDelay" },
      multi_interCycleDelay: { id: "multi_interCycleDelay", prev: "multi_waitReturned", next: "multi_findOpenable" }
    };
    function sleep(ms) {
      return lifecycle.sleep(ms);
    }
    function normalizeText(value) {
      return String(value || "").normalize("NFKC").replace(/\u00A0/g, " ").replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
    }
    function isVisible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    function isExtensionUiElement(element) {
      return Boolean(options.isExcludedElement?.(element));
    }
    function isForegroundElement(element) {
      if (!isVisible(element)) return false;
      const rect = element.getBoundingClientRect();
      const points = [
        [0.5, 0.5],
        [0.25, 0.5],
        [0.75, 0.5]
      ];
      for (const [px, py] of points) {
        const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width * px));
        const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height * py));
        const topElement = document.elementFromPoint(x, y);
        if (!topElement) continue;
        if (isExtensionUiElement(topElement)) {
          return true;
        }
        if (topElement === element || element.contains(topElement) || topElement.contains(element)) {
          return true;
        }
      }
      return false;
    }
    function isInteractable(element) {
      if (!isVisible(element)) return false;
      const style = window.getComputedStyle(element);
      if (!style) return false;
      if (style.display === "none") return false;
      if (style.visibility === "hidden") return false;
      if (style.pointerEvents === "none") return false;
      if (Number.parseFloat(style.opacity || "1") === 0) return false;
      if (element.disabled) return false;
      if (element.getAttribute("aria-disabled") === "true") return false;
      return true;
    }
    async function clickElement(element) {
      lifecycle.check();
      if (!element) return false;
      try {
        element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      } catch (_) {
      }
      try {
        if (typeof element.focus === "function") element.focus();
      } catch (_) {
      }
      try {
        element.click();
        return true;
      } catch (_) {
        return false;
      }
    }
    function getMultiDelay() {
      return config.multiDelay;
    }
    function getSingleDelay() {
      return config.singleDelay;
    }
    function getPollMs(delayMs) {
      return Math.max(OPEN_MIN_POLL_MS, Math.min(90, Math.floor(delayMs / 3)));
    }
    function updateMultiStatus() {
      lifecycle.emit("onProgress", getState());
    }
    function updateSingleStatus() {
      lifecycle.emit("onProgress", getState());
    }
    function setMultiRunningUI() {
      lifecycle.emit("onState", getState());
    }
    function setSingleRunningUI() {
      lifecycle.emit("onState", getState());
    }
    function findSingleOpenableElement() {
      const candidates = Array.from(document.querySelectorAll("div.vwM69.OXbMa"));
      return candidates.find((candidate) => isVisible(candidate) && isForegroundElement(candidate)) || null;
    }
    function isSingleViewerVisible() {
      const buttons = Array.from(document.querySelectorAll("button"));
      let hasSendTo = false;
      let hasDownload = false;
      for (const button of buttons) {
        if (!isVisible(button) || isExtensionUiElement(button)) continue;
        const label = normalizeText(button.textContent || button.innerText);
        if (!label) continue;
        if (!hasSendTo && label.includes("send to")) hasSendTo = true;
        if (!hasDownload && label.includes("download")) hasDownload = true;
        if (hasSendTo && hasDownload) return true;
      }
      return hasSendTo;
    }
    function getMultiRows() {
      return Array.from(document.querySelectorAll(".deg2K .O4POs"));
    }
    function findOpenableMultiRowByName(targetName) {
      const normalizedTarget = normalizeText(targetName);
      if (!normalizedTarget) return null;
      const rows = getMultiRows();
      for (const row of rows) {
        const titleElement = row.querySelector(".FiLwP");
        const actionTextElement = row.querySelector(".giV53 .nonIntl");
        const openButtonContainer = row.querySelector(".HEkDJ");
        if (!titleElement || !actionTextElement || !openButtonContainer) continue;
        if (!isVisible(openButtonContainer)) continue;
        const title = normalizeText(titleElement.textContent);
        const action = normalizeText(actionTextElement.textContent);
        if (!title.includes(normalizedTarget)) continue;
        if (action !== "view") continue;
        return { row, actionTextElement, openButtonContainer };
      }
      return null;
    }
    function logMultiDiag(event, extra = {}, force = false) {
      multiDiagTick += 1;
      if (!force && multiDiagTick % 6 !== 0) return;
      console.log("[Open/MultiDiag]", {
        event,
        ...extra
      });
    }
    function logSingleDiag(event, extra = {}, force = false) {
      singleDiagTick += 1;
      if (!force && singleDiagTick % 6 !== 0) return;
      console.log("[Open/SingleDiag]", {
        event,
        state: singleStateId,
        pointer: singleStatePointer,
        cycleId: singleCycle?.cycleId || null,
        failCount: singleStateFailCount,
        ...extra
      });
    }
    function setSingleState(nextState, reason = "transition") {
      if (!SINGLE_STATE_GRAPH[nextState]) return;
      if (singleStateId === nextState) return;
      const prev = singleStateId;
      singleStateId = nextState;
      singleStatePointer = nextState;
      singleStateFailCount = 0;
      lifecycle.emit("onState", { ...getState(), reason });
      logSingleDiag("single_state_jump", { from: prev, to: nextState, reason }, true);
    }
    function resetSingleCycle(reason = "reset") {
      if (singleCycle) {
        logSingleDiag("single_cycle_reset", { reason, cycleId: singleCycle.cycleId });
      }
      singleCycle = null;
      lastSingleElementClicked = null;
    }
    function createSingleCycle(openableElement) {
      singleCycleCounter += 1;
      singleCycle = {
        cycleId: singleCycleCounter,
        openableElement,
        clickedAt: null,
        transitionedAwayAt: null,
        closeAttemptedAt: null,
        returnedAt: null,
        ackReason: null,
        closeAttempts: 0,
        delayStartedAt: null,
        counted: false
      };
    }
    function finalizeSingleCycle(reason, { allowClickFallback = false } = {}) {
      if (!singleCycle) {
        return false;
      }
      const hasStrictProof = Boolean(singleCycle.transitionedAwayAt);
      const hasClickFallbackProof = Boolean(options.allowLegacyClickFallback !== false && allowClickFallback && singleCycle.clickedAt);
      if (!hasStrictProof && !hasClickFallbackProof) {
        return false;
      }
      if (!singleCycle.returnedAt) {
        singleCycle.returnedAt = Date2.now();
      }
      if (!singleCycle.ackReason) {
        singleCycle.ackReason = hasStrictProof ? reason : `fallback_${reason}`;
      }
      if (singleCycle.counted) {
        return true;
      }
      singleSnapsOpened += 1;
      updateSingleStatus();
      singleCycle.counted = true;
      lifecycle.emit("onDiagnostic", { event: "open_counted", cycleId: singleCycle.cycleId, reason, strictProof: hasStrictProof });
      logSingleDiag("single_open_proof_confirmed", {
        cycleId: singleCycle.cycleId,
        ackReason: singleCycle.ackReason,
        reason,
        strictProof: hasStrictProof
      }, true);
      return true;
    }
    function hasSingleOpenProof() {
      return Boolean(singleCycle?.transitionedAwayAt && singleCycle?.returnedAt);
    }
    function hasSingleTransitionedAway() {
      if (!singleCycle?.openableElement) return false;
      if (isSingleViewerVisible()) return true;
      const target = singleCycle.openableElement;
      return !document.contains(target) || !isVisible(target) || !isForegroundElement(target);
    }
    function hasSingleReturnedToList() {
      return !isSingleViewerVisible() && Boolean(findSingleOpenableElement());
    }
    function findTopLeftBackCandidate() {
      const candidates = Array.from(document.querySelectorAll("button")).filter((button) => isInteractable(button) && !isExtensionUiElement(button)).map((button) => ({ button, rect: button.getBoundingClientRect() })).filter(({ rect }) => rect.top >= 0 && rect.left >= 0 && rect.top <= 180 && rect.left <= 180 && rect.width <= 160 && rect.height <= 160).sort((a, b) => {
        if (a.rect.top !== b.rect.top) return a.rect.top - b.rect.top;
        if (a.rect.left !== b.rect.left) return a.rect.left - b.rect.left;
        return a.rect.width * a.rect.height - b.rect.width * b.rect.height;
      });
      return candidates[0]?.button || null;
    }
    function findSingleCloseButton() {
      const selectors = [
        'button[aria-label*="Back" i]',
        'button[aria-label*="Close" i]',
        'button[title*="Back" i]',
        'button[title*="Close" i]',
        'button[data-testid*="back" i]',
        'button[data-testid*="close" i]',
        "header button"
      ];
      for (const selector of selectors) {
        const candidate = document.querySelector(selector);
        if (isInteractable(candidate) && !isExtensionUiElement(candidate)) {
          return candidate;
        }
      }
      return findTopLeftBackCandidate();
    }
    function dispatchCloseKey(key) {
      lifecycle.check();
      const target = document.activeElement || document.body || document;
      const downEvent = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      const upEvent = new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true });
      target.dispatchEvent(downEvent);
      target.dispatchEvent(upEvent);
      document.dispatchEvent(downEvent);
      document.dispatchEvent(upEvent);
    }
    async function attemptCloseOpenedSnap() {
      const closeButton = findSingleCloseButton();
      if (closeButton) {
        const clicked = await clickElement(closeButton);
        if (clicked) return true;
      }
      dispatchCloseKey("Escape");
      dispatchCloseKey("Backspace");
      return true;
    }
    function classifySingleOpenScreen() {
      const markers = {
        listView: Boolean(findSingleOpenableElement()),
        viewerVisible: isSingleViewerVisible(),
        transitionedAway: hasSingleTransitionedAway(),
        closeButton: Boolean(findSingleCloseButton())
      };
      if (markers.viewerVisible) {
        return { screenId: "viewer_opened", confidence: 0.92, markers };
      }
      if (markers.listView) {
        return { screenId: "list_view", confidence: 0.9, markers };
      }
      if (markers.transitionedAway || markers.closeButton) {
        return { screenId: "viewer_opened", confidence: markers.transitionedAway && markers.closeButton ? 0.86 : 0.72, markers };
      }
      return { screenId: "unknown", confidence: 0, markers };
    }
    function mapSingleClassificationToState(classification) {
      if (!classification) return null;
      if (classification.screenId === "list_view") {
        if (singleCycle?.transitionedAwayAt && !singleCycle?.counted) {
          return "single_waitReturned";
        }
        return "single_findOpenable";
      }
      if (classification.screenId === "viewer_opened") {
        if (singleCycle?.transitionedAwayAt) return "single_closeOpenedSnap";
        return "single_waitOpened";
      }
      return null;
    }
    function hasSingleExpectedMarker(stateId) {
      switch (stateId) {
        case "single_findOpenable":
          return Boolean(findSingleOpenableElement());
        case "single_clickOpenable":
          return Boolean(singleCycle?.openableElement);
        case "single_waitOpened":
          return Boolean(singleCycle?.clickedAt);
        case "single_closeOpenedSnap":
          return Boolean(singleCycle?.transitionedAwayAt);
        case "single_waitReturned":
          return Boolean(singleCycle?.transitionedAwayAt);
        case "single_interCycleDelay":
          return Boolean(singleCycle?.delayStartedAt);
        default:
          return false;
      }
    }
    async function resyncSingleState(expectedState, reason) {
      singleStateFailCount += 1;
      logSingleDiag("single_state_miss_expected", { expectedState, reason, failCount: singleStateFailCount });
      if (singleStateFailCount < SINGLE_RESYNC_MISS_THRESHOLD) {
        return false;
      }
      if (Date2.now() - singleLastResyncAt < SINGLE_RESYNC_MIN_INTERVAL_MS) {
        return false;
      }
      singleLastResyncAt = Date2.now();
      const classification = classifySingleOpenScreen();
      logSingleDiag("single_classifier_result", {
        expectedState,
        classifiedState: classification.screenId,
        confidence: classification.confidence,
        markers: classification.markers
      }, true);
      if (classification.confidence >= SINGLE_RESYNC_CONFIDENCE_THRESHOLD) {
        const mappedState = mapSingleClassificationToState(classification);
        if (mappedState && mappedState !== singleStateId) {
          setSingleState(mappedState, `classifier:${reason}`);
          return true;
        }
        if (mappedState === singleStateId) {
          singleStateFailCount = 0;
        }
        return false;
      }
      const node = SINGLE_STATE_GRAPH[singleStateId];
      const neighborStates = [node?.prev, node?.next].filter(Boolean);
      for (const candidate of neighborStates) {
        if (hasSingleExpectedMarker(candidate)) {
          setSingleState(candidate, `neighbor_probe:${reason}`);
          return true;
        }
      }
      logSingleDiag("single_state_jump_rejected_low_conf", {
        expectedState,
        confidence: classification.confidence
      }, true);
      return false;
    }
    function createMultiCycle(name, delayMs, pollMs) {
      multiCycleCounter += 1;
      return {
        cycleId: multiCycleCounter,
        targetName: name,
        delayMs,
        pollMs,
        stateId: "multi_findOpenable",
        stateFailCount: 0,
        lastResyncAt: 0,
        target: null,
        clickedAt: null,
        transitionedAwayAt: null,
        closeAttempts: 0,
        closeAttemptedAt: null,
        returnedAt: null,
        delayStartedAt: null
      };
    }
    function setMultiState(cycle, nextState, reason = "transition") {
      if (!cycle || !MULTI_STATE_GRAPH[nextState]) return;
      if (cycle.stateId === nextState) return;
      const prev = cycle.stateId;
      cycle.stateId = nextState;
      multiStateId = nextState;
      lifecycle.emit("onState", { ...getState(), reason });
      cycle.stateFailCount = 0;
      logMultiDiag("multi_state_jump", { cycleId: cycle.cycleId, from: prev, to: nextState, reason }, true);
    }
    function classifyMultiOpenScreen(targetName) {
      const anyRowsVisible = getMultiRows().some(isVisible);
      const targetOpenable = Boolean(findOpenableMultiRowByName(targetName));
      const closeButton = Boolean(findSingleCloseButton());
      const markers = { anyRowsVisible, targetOpenable, closeButton };
      if (targetOpenable) {
        return { screenId: "list_view", confidence: 0.9, markers };
      }
      if (anyRowsVisible) {
        return { screenId: "list_view", confidence: 0.74, markers };
      }
      if (closeButton) {
        return { screenId: "viewer_opened", confidence: 0.78, markers };
      }
      return { screenId: "unknown", confidence: 0, markers };
    }
    function mapMultiClassificationToState(cycle, classification) {
      if (!cycle || !classification) return null;
      if (classification.screenId === "list_view") {
        return cycle.transitionedAwayAt ? "multi_waitReturned" : "multi_findOpenable";
      }
      if (classification.screenId === "viewer_opened") {
        return cycle.transitionedAwayAt ? "multi_closeOpenedSnap" : "multi_waitOpened";
      }
      return null;
    }
    function hasMultiExpectedMarker(cycle, stateId) {
      if (!cycle) return false;
      switch (stateId) {
        case "multi_findOpenable":
          return Boolean(findOpenableMultiRowByName(cycle.targetName));
        case "multi_clickOpenable":
          return Boolean(cycle.target || findOpenableMultiRowByName(cycle.targetName));
        case "multi_waitOpened":
          return Boolean(cycle.clickedAt);
        case "multi_closeOpenedSnap":
        case "multi_waitReturned":
          return Boolean(cycle.transitionedAwayAt);
        case "multi_interCycleDelay":
          return Boolean(cycle.delayStartedAt);
        default:
          return false;
      }
    }
    async function resyncMultiState(cycle, expectedState, reason) {
      if (!cycle) return false;
      cycle.stateFailCount += 1;
      logMultiDiag("multi_state_miss_expected", {
        cycleId: cycle.cycleId,
        expectedState,
        reason,
        failCount: cycle.stateFailCount
      });
      if (cycle.stateFailCount < MULTI_RESYNC_MISS_THRESHOLD) {
        return false;
      }
      if (Date2.now() - cycle.lastResyncAt < MULTI_RESYNC_MIN_INTERVAL_MS) {
        return false;
      }
      cycle.lastResyncAt = Date2.now();
      const classification = classifyMultiOpenScreen(cycle.targetName);
      logMultiDiag("multi_classifier_result", {
        cycleId: cycle.cycleId,
        expectedState,
        classifiedState: classification.screenId,
        confidence: classification.confidence,
        markers: classification.markers
      }, true);
      if (classification.confidence >= MULTI_RESYNC_CONFIDENCE_THRESHOLD) {
        const mappedState = mapMultiClassificationToState(cycle, classification);
        if (mappedState && mappedState !== cycle.stateId) {
          setMultiState(cycle, mappedState, `classifier:${reason}`);
          return true;
        }
        if (mappedState === cycle.stateId) {
          cycle.stateFailCount = 0;
        }
        return false;
      }
      const node = MULTI_STATE_GRAPH[cycle.stateId];
      const neighborStates = [node?.prev, node?.next].filter(Boolean);
      for (const candidate of neighborStates) {
        if (hasMultiExpectedMarker(cycle, candidate)) {
          setMultiState(cycle, candidate, `neighbor_probe:${reason}`);
          return true;
        }
      }
      logMultiDiag("multi_state_jump_rejected_low_conf", {
        cycleId: cycle.cycleId,
        expectedState,
        confidence: classification.confidence
      }, true);
      return false;
    }
    async function runMultiOpenCycleForName(name) {
      const delayMs = getMultiDelay();
      const pollMs = getPollMs(delayMs);
      const cycle = createMultiCycle(name, delayMs, pollMs);
      while (isMultiRunning) {
        switch (cycle.stateId) {
          case "multi_findOpenable": {
            const target = findOpenableMultiRowByName(name);
            if (!target) {
              return { transitionedAway: false, returnedToList: false, timedOut: false, skipped: true, reason: "target_not_found" };
            }
            cycle.target = target;
            setMultiState(cycle, "multi_clickOpenable", "target_found");
            break;
          }
          case "multi_clickOpenable": {
            let target = cycle.target;
            if (!target || !isVisible(target.openButtonContainer)) {
              target = findOpenableMultiRowByName(name);
              cycle.target = target || null;
            }
            if (!target) {
              const jumped = await resyncMultiState(cycle, "multi_clickOpenable", "target_missing_before_click");
              if (!jumped) {
                return { transitionedAway: false, returnedToList: false, timedOut: true, reason: "target_missing_before_click" };
              }
              await sleep(cycle.pollMs);
              break;
            }
            const clicked = await clickElement(target.openButtonContainer);
            if (!clicked) {
              const jumped = await resyncMultiState(cycle, "multi_clickOpenable", "click_failed");
              if (!jumped) {
                return { transitionedAway: false, returnedToList: false, timedOut: true, reason: "click_failed" };
              }
              await sleep(cycle.pollMs);
              break;
            }
            cycle.clickedAt = Date2.now();
            setMultiState(cycle, "multi_waitOpened", "target_clicked");
            break;
          }
          case "multi_waitOpened": {
            if (!cycle.clickedAt) {
              setMultiState(cycle, "multi_findOpenable", "missing_clicked_at");
              break;
            }
            if (!findOpenableMultiRowByName(name)) {
              cycle.transitionedAwayAt = Date2.now();
              setMultiState(cycle, "multi_closeOpenedSnap", "transitioned_away");
              break;
            }
            if (Date2.now() - cycle.clickedAt >= OPEN_TRANSITION_TIMEOUT_MS) {
              const jumped = await resyncMultiState(cycle, "multi_waitOpened", "transition_timeout");
              if (!jumped) {
                return { transitionedAway: false, returnedToList: false, timedOut: true, reason: "transition_timeout" };
              }
              break;
            }
            await sleep(cycle.pollMs);
            break;
          }
          case "multi_closeOpenedSnap": {
            if (!cycle.transitionedAwayAt) {
              setMultiState(cycle, "multi_waitOpened", "missing_transition_flag");
              break;
            }
            if (Date2.now() - cycle.transitionedAwayAt < OPEN_MIN_VIEW_DWELL_MS) {
              await sleep(Math.max(25, OPEN_MIN_VIEW_DWELL_MS - (Date2.now() - cycle.transitionedAwayAt)));
              break;
            }
            if (getMultiRows().some(isVisible)) {
              cycle.returnedAt = Date2.now();
              setMultiState(cycle, "multi_waitReturned", "returned_before_close");
              break;
            }
            if (cycle.closeAttempts < OPEN_MAX_CLOSE_ATTEMPTS) {
              await attemptCloseOpenedSnap();
              cycle.closeAttempts += 1;
              cycle.closeAttemptedAt = Date2.now();
            } else {
              logMultiDiag("multi_close_fallback_used", {
                cycleId: cycle.cycleId,
                reason: "close_attempt_budget_exhausted"
              }, true);
            }
            setMultiState(cycle, "multi_waitReturned", "close_attempted");
            break;
          }
          case "multi_waitReturned": {
            if (!cycle.transitionedAwayAt) {
              setMultiState(cycle, "multi_findOpenable", "missing_transition_in_wait_returned");
              break;
            }
            if (getMultiRows().some(isVisible)) {
              cycle.returnedAt = Date2.now();
              return { transitionedAway: true, returnedToList: true, timedOut: false, reason: "returned_to_list" };
            }
            if (cycle.closeAttempts < OPEN_MAX_CLOSE_ATTEMPTS && (!cycle.closeAttemptedAt || Date2.now() - cycle.closeAttemptedAt >= OPEN_CLOSE_RETRY_MS)) {
              await attemptCloseOpenedSnap();
              cycle.closeAttempts += 1;
              cycle.closeAttemptedAt = Date2.now();
            }
            if (Date2.now() - cycle.transitionedAwayAt >= OPEN_RETURN_TIMEOUT_MS) {
              const jumped = await resyncMultiState(cycle, "multi_waitReturned", "return_timeout");
              if (!jumped && Date2.now() - cycle.clickedAt >= OPEN_HARD_CYCLE_TIMEOUT_MS) {
                return { transitionedAway: true, returnedToList: false, timedOut: true, reason: "hard_cycle_timeout" };
              }
              if (!jumped) {
                return { transitionedAway: true, returnedToList: false, timedOut: true, reason: "return_timeout" };
              }
            }
            await sleep(cycle.pollMs);
            break;
          }
          case "multi_interCycleDelay": {
            if (!cycle.delayStartedAt) cycle.delayStartedAt = Date2.now();
            if (Date2.now() - cycle.delayStartedAt >= cycle.delayMs) {
              return { transitionedAway: Boolean(cycle.transitionedAwayAt), returnedToList: Boolean(cycle.returnedAt), timedOut: false, reason: "delay_elapsed" };
            }
            await sleep(Math.min(cycle.pollMs, Math.max(25, cycle.delayMs / 2)));
            break;
          }
          default:
            setMultiState(cycle, "multi_findOpenable", "unknown_multi_state");
            await sleep(cycle.pollMs);
        }
      }
      return { transitionedAway: false, returnedToList: false, timedOut: false, reason: "stopped" };
    }
    async function runSingleOpenLoop() {
      singleLastOpenableSeenAt = Date2.now();
      singleStateId = "single_findOpenable";
      singleStatePointer = "single_findOpenable";
      singleStateFailCount = 0;
      singleLastResyncAt = 0;
      resetSingleCycle("single_start");
      while (isSingleRunning) {
        const delayMs = getSingleDelay();
        const pollMs = getPollMs(delayMs);
        switch (singleStateId) {
          case "single_findOpenable": {
            const openable = findSingleOpenableElement();
            if (!openable) {
              if (Date2.now() - singleLastOpenableSeenAt >= OPEN_IDLE_TIMEOUT_MS) {
                if (singleCycle && !singleCycle.counted) {
                  finalizeSingleCycle("idle_stop_fallback", { allowClickFallback: true });
                }
                console.log("[Open/Single] No openable snaps found, stopping.");
                stopSingleMode();
                break;
              }
              await sleep(pollMs);
              break;
            }
            if (singleCycle?.transitionedAwayAt && !singleCycle?.counted) {
              finalizeSingleCycle("next_openable_visible_after_open");
              singleCycle.delayStartedAt = Date2.now();
              setSingleState("single_interCycleDelay", "cycle_finalized_in_find_openable");
              break;
            }
            singleLastOpenableSeenAt = Date2.now();
            createSingleCycle(openable);
            setSingleState("single_clickOpenable", "openable_found");
            break;
          }
          case "single_clickOpenable": {
            let target = singleCycle?.openableElement;
            if (!target || !document.contains(target) || !isVisible(target)) {
              target = findSingleOpenableElement();
              if (!target) {
                await resyncSingleState("single_clickOpenable", "target_missing_before_click");
                await sleep(pollMs);
                break;
              }
              if (singleCycle) singleCycle.openableElement = target;
            }
            const clicked = await clickElement(target);
            if (!clicked) {
              await resyncSingleState("single_clickOpenable", "click_failed");
              await sleep(pollMs);
              break;
            }
            if (singleCycle) {
              singleCycle.clickedAt = Date2.now();
            }
            lastSingleElementClicked = target;
            setSingleState("single_waitOpened", "openable_clicked");
            break;
          }
          case "single_waitOpened": {
            if (!singleCycle?.clickedAt) {
              resetSingleCycle("missing_clicked_at");
              setSingleState("single_findOpenable", "missing_clicked_at");
              break;
            }
            if (hasSingleTransitionedAway()) {
              singleCycle.transitionedAwayAt = Date2.now();
              setSingleState("single_closeOpenedSnap", "transitioned_away");
              break;
            }
            const openClassification = classifySingleOpenScreen();
            if (openClassification.screenId === "viewer_opened" && openClassification.confidence >= 0.72) {
              singleCycle.transitionedAwayAt = Date2.now();
              singleCycle.ackReason = singleCycle.ackReason || "classifier_viewer_opened";
              setSingleState("single_closeOpenedSnap", "classifier_detected_opened");
              break;
            }
            if (Date2.now() - singleCycle.clickedAt >= OPEN_TRANSITION_TIMEOUT_MS) {
              const jumped = await resyncSingleState("single_waitOpened", "transition_timeout");
              if (!jumped) {
                finalizeSingleCycle("transition_timeout", { allowClickFallback: true });
                resetSingleCycle("transition_timeout_no_resync");
                setSingleState("single_findOpenable", "transition_timeout_no_resync");
              }
              break;
            }
            await sleep(pollMs);
            break;
          }
          case "single_closeOpenedSnap": {
            if (!singleCycle?.transitionedAwayAt) {
              setSingleState("single_waitOpened", "missing_transition_flag");
              break;
            }
            if (Date2.now() - singleCycle.transitionedAwayAt < OPEN_MIN_VIEW_DWELL_MS) {
              await sleep(Math.max(25, OPEN_MIN_VIEW_DWELL_MS - (Date2.now() - singleCycle.transitionedAwayAt)));
              break;
            }
            if (hasSingleReturnedToList()) {
              singleCycle.returnedAt = Date2.now();
              singleCycle.ackReason = "returned_before_close";
              setSingleState("single_waitReturned", "already_returned");
              break;
            }
            if (singleCycle.closeAttempts < OPEN_MAX_CLOSE_ATTEMPTS) {
              await attemptCloseOpenedSnap();
              singleCycle.closeAttempts += 1;
              singleCycle.closeAttemptedAt = Date2.now();
            } else {
              logSingleDiag("single_close_fallback_used", {
                cycleId: singleCycle.cycleId,
                reason: "close_attempt_budget_exhausted"
              }, true);
            }
            setSingleState("single_waitReturned", "close_attempted");
            break;
          }
          case "single_waitReturned": {
            if (!singleCycle?.transitionedAwayAt) {
              setSingleState("single_findOpenable", "missing_transition_in_wait_returned");
              break;
            }
            if (hasSingleReturnedToList()) {
              finalizeSingleCycle("returned_to_list");
              singleCycle.delayStartedAt = Date2.now();
              setSingleState("single_interCycleDelay", "return_confirmed");
              break;
            }
            if (singleCycle.closeAttempts < OPEN_MAX_CLOSE_ATTEMPTS && (!singleCycle.closeAttemptedAt || Date2.now() - singleCycle.closeAttemptedAt >= OPEN_CLOSE_RETRY_MS)) {
              await attemptCloseOpenedSnap();
              singleCycle.closeAttempts += 1;
              singleCycle.closeAttemptedAt = Date2.now();
            }
            if (Date2.now() - singleCycle.transitionedAwayAt >= OPEN_RETURN_TIMEOUT_MS) {
              const jumped = await resyncSingleState("single_waitReturned", "return_timeout");
              if (!jumped && Date2.now() - singleCycle.clickedAt >= OPEN_HARD_CYCLE_TIMEOUT_MS) {
                finalizeSingleCycle("hard_cycle_timeout", { allowClickFallback: true });
                logSingleDiag("single_open_count_blocked_no_proof", {
                  cycleId: singleCycle.cycleId,
                  reason: "hard_cycle_timeout"
                }, true);
                resetSingleCycle("single_hard_cycle_timeout");
                setSingleState("single_findOpenable", "single_hard_cycle_timeout");
              }
              break;
            }
            await sleep(pollMs);
            break;
          }
          case "single_interCycleDelay": {
            if (!singleCycle?.delayStartedAt) {
              if (singleCycle) singleCycle.delayStartedAt = Date2.now();
            }
            if (Date2.now() - singleCycle.delayStartedAt >= delayMs) {
              resetSingleCycle("inter_cycle_delay_complete");
              setSingleState("single_findOpenable", "delay_elapsed");
              break;
            }
            await sleep(Math.min(pollMs, Math.max(25, delayMs / 2)));
            break;
          }
          default:
            setSingleState("single_findOpenable", "unknown_single_state");
            await sleep(pollMs);
        }
      }
    }
    async function runMultiOpenLoop() {
      let currentIndex = 0;
      while (isMultiRunning) {
        if (!multiModeNames.length) {
          await sleep(getPollMs(getMultiDelay()));
          continue;
        }
        const name = multiModeNames[currentIndex];
        currentIndex = (currentIndex + 1) % multiModeNames.length;
        const cycleResult = await runMultiOpenCycleForName(name);
        if (cycleResult.transitionedAway && cycleResult.returnedToList) {
          multiSnapsOpened += 1;
          updateMultiStatus();
          logMultiDiag("multi_open_proof_confirmed", {
            target: name,
            reason: cycleResult.reason,
            count: multiSnapsOpened
          });
        } else if (cycleResult.timedOut) {
          console.warn(`[Open/Multi] Timed out waiting for "${name}" cycle (${cycleResult.reason}); skipping.`);
        } else if (cycleResult.skipped) {
          logMultiDiag("multi_target_skipped", {
            target: name,
            reason: cycleResult.reason
          });
        }
        multiStateId = "multi_interCycleDelay";
        lifecycle.emit("onState", { ...getState(), reason: "cycle_complete" });
        await sleep(getMultiDelay());
      }
    }
    function startMultiMode() {
      if (isMultiRunning) return;
      if (!multiModeNames.length) {
        console.warn("[Open/Multi] Add at least one username before starting.");
        return;
      }
      isMultiRunning = true;
      multiSnapsOpened = 0;
      updateMultiStatus();
      setMultiRunningUI(true);
      multiLoopPromise = runMultiOpenLoop().catch((e) => lifecycle.error(e)).finally(() => {
        multiLoopPromise = null;
        stopMultiMode();
        lifecycle.stop();
      });
    }
    function stopMultiMode() {
      if (!isMultiRunning) return;
      isMultiRunning = false;
      setMultiRunningUI(false);
    }
    function startSingleMode() {
      if (isSingleRunning) return;
      isSingleRunning = true;
      singleSnapsOpened = 0;
      updateSingleStatus();
      setSingleRunningUI(true);
      singleLoopPromise = runSingleOpenLoop().catch((e) => lifecycle.error(e)).finally(() => {
        singleLoopPromise = null;
        stopSingleMode();
        lifecycle.stop();
      });
    }
    function stopSingleMode() {
      if (!isSingleRunning) return;
      isSingleRunning = false;
      setSingleRunningUI(false);
    }
    function addMultiName(name) {
      const normalized = normalizeText(name);
      if (!normalized) return false;
      const exists = multiModeNames.some((n) => normalizeText(n) === normalized);
      if (exists) return false;
      multiModeNames.push(name.trim());
      return true;
    }
    function getState() {
      return { running: isSingleRunning || isMultiRunning, mode: options.mode === "multi" ? "multi" : "single", state: options.mode === "multi" ? multiStateId : singleStateId, snapsOpened: options.mode === "multi" ? multiSnapsOpened : singleSnapsOpened, recipients: [...multiModeNames] };
    }
    function stop() {
      stopSingleMode();
      stopMultiMode();
      lifecycle.stop();
      return Promise.all([singleLoopPromise, multiLoopPromise]);
    }
    for (const name of options.recipients || []) addMultiName(name);
    function start() {
      if (singleLoopPromise || multiLoopPromise) return singleLoopPromise || multiLoopPromise;
      if (options.mode === "multi" && !multiModeNames.length) throw Error("Multi mode requires recipients");
      lifecycle.begin();
      if (options.mode === "multi") startMultiMode();
      else startSingleMode();
      return singleLoopPromise || multiLoopPromise;
    }
    return { start, stop, getState, dispose() {
      const p = stop();
      lifecycle.dispose();
      return p;
    } };
  }
  return __toCommonJS(index_exports);
})();
