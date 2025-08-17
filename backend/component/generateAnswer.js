// // Put helpers at module scope so they're not recreated on each call.

// const DEFAULTS = {
//   TOP_K: 12,        // candidates to fetch (smaller = faster)
//   MAX_FINAL: 6,     // final chunks provided to model
//   MAX_PER_PAGE: 1,  // avoid redundancy from same page
//   MAX_CHUNK_CHARS: 800,
//   MAX_CONTEXT_CHARS: 6000,
//   MIN_AVG_SCORE: 0.25 // early-exit threshold
// };

// function safeNum(n, d = 0) {
//   return Number.isFinite(n) ? n : d;
// }

// function clamp01(x) {
//   if (!Number.isFinite(x)) return 0;
//   return Math.max(0, Math.min(1, x));
// }

// // fast, cheap text hash fallback (djb2)
// function fastHashText(s = '') {
//   let h = 5381;
//   for (let i = 0; i < s.length; i++) {
//     h = ((h << 5) + h) + s.charCodeAt(i);
//   }
//   return (h >>> 0).toString(36);
// }

// function trimToSentenceBoundary(text, maxChars) {
//   if (!text) return '';
//   if (text.length <= maxChars) return text;
//   const slice = text.slice(0, maxChars);
//   const lastEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
//   if (lastEnd > Math.floor(maxChars * 0.5)) return slice.slice(0, lastEnd + 1);
//   return slice + '…';
// }

// // Single-pass dedupe & select to minimize sorting
// function selectChunksFast(candidates, { topK, maxPerPage, maxFinal }) {
//   if (!candidates || candidates.length === 0) return [];

//   // 1) consider only topK by score (cheap slice then single sort)
//   const top = candidates.slice(0, Math.min(candidates.length, topK))
//                         .sort((a,b)=> safeNum(b.score,0) - safeNum(a.score,0));

//   const seen = new Set();
//   const pageCount = new Map();
//   const selected = [];

//   for (const c of top) {
//     const md = c.metadata || {};
//     const key = md.chunkId || `${md.fileId||''}:${md.estimatedPage||''}:${md.chunkIndex||''}` || fastHashText(c.text || '');
//     if (seen.has(key)) continue;

//     const pageKey = `${md.fileId || ''}:${md.estimatedPage || ''}`;
//     const cnt = pageCount.get(pageKey) || 0;
//     if (cnt >= maxPerPage) continue;

//     seen.add(key);
//     pageCount.set(pageKey, cnt + 1);
//     selected.push(c);

//     if (selected.length >= maxFinal) break;
//   }

//   // sort selected by doc flow (fileId, page, chunkIndex) for coherent context ordering
//   selected.sort((a,b) => {
//     const fa = a.metadata?.fileId || '';
//     const fb = b.metadata?.fileId || '';
//     if (fa !== fb) return fa.localeCompare(fb);
//     const pa = safeNum(a.metadata?.estimatedPage, 0);
//     const pb = safeNum(b.metadata?.estimatedPage, 0);
//     if (pa !== pb) return pa - pb;
//     const ca = safeNum(a.metadata?.chunkIndex, 0);
//     const cb = safeNum(b.metadata?.chunkIndex, 0);
//     return ca - cb;
//   });

//   return selected;
// }

// function buildPrompt(query, chunks, { maxChunkChars, maxContextChars }) {
//   const parts = [];
//   let used = 0;

//   for (let i = 0; i < chunks.length; i++) {
//     const c = chunks[i];
//     const md = c.metadata || {};
//     const label = `[Source ${i+1}] ${md.fileName ? `${md.fileName} p.${md.estimatedPage || '?'}` : ''}`.trim();
//     const trimmed = trimToSentenceBoundary(String(c.text || '').trim(), maxChunkChars);
//     const block = `${label}\n${trimmed}`;
//     if (used + block.length + 2 > maxContextChars && parts.length > 0) break;
//     parts.push(block);
//     used += block.length + 2;
//   }

//   const context = parts.join('\n\n');

//   const prompt = `
// You are an AI assistant that answers using ONLY the provided sources.

// SOURCES:
// ${context}

// QUESTION: ${query}

// RULES:
// - Answer only from the SOURCES above.
// - Cite inline using [Source N] where N matches the label.
// - If information is missing, say so.
// - Be concise and precise.

// Answer:
// `.trim();

//   return { prompt, usedSources: parts.length };
// }

// function computeConfidenceFromAnswer(answer, selected) {
//   const avg = selected.reduce((s, c) => s + clamp01(safeNum(c.score, 0)), 0) / Math.max(1, selected.length);
//   // cheap citation detection
//   let usedCount = 0;
//   for (let i = 0; i < selected.length; i++) {
//     if (answer.indexOf(`[Source ${i+1}]`) !== -1) usedCount++;
//   }
//   const coverage = usedCount / Math.max(1, selected.length);
//   return clamp01(0.75 * avg + 0.25 * coverage);
// }


// // The optimized generateAnswer method
// async function generateAnswerOptimized(query, fileIds = null, workspaceId = null, options = {}) {
//   const cfg = { ...DEFAULTS, ...options };

//   if (!query || !String(query).trim()) {
//     return { answer: '', sources: [], confidence: 0 };
//   }

//   // 1) reuse / cache model instance on `this`
//   if (!this._genModel) {
//     this._genModel = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
//   }
//   const model = this._genModel;

//   // 2) retrieve candidates (fast)
//   const candidates = await this.searchRelevantChunks(query, fileIds, workspaceId, cfg.TOP_K);
//   if (!candidates || candidates.length === 0) {
//     return {
//       answer: "I couldn't find relevant information in the uploaded documents to answer your question.",
//       sources: [],
//       confidence: 0
//     };
//   }

//   // 3) select & dedupe single-pass
//   const selected = selectChunksFast(candidates, {
//     topK: cfg.TOP_K,
//     maxPerPage: cfg.MAX_PER_PAGE,
//     maxFinal: cfg.MAX_FINAL
//   });

//   if (!selected.length) {
//     return {
//       answer: "No strong matches found.",
//       sources: [],
//       confidence: 0
//     };
//   }

//   // 4) quick quality guard: avoid calling model if retrieval is weak
//   const avgScore = selected.reduce((s,c)=> s + safeNum(c.score,0), 0) / selected.length;
//   if (avgScore < cfg.MIN_AVG_SCORE) {
//     return {
//       answer: "I couldn't find enough strong matches in the documents to answer confidently. Try rephrasing.",
//       sources: selected.map((c,i)=>({
//         id: `source_${i+1}`,
//         chunkId: c.metadata?.chunkId || null,
//         fileId: c.metadata?.fileId || null,
//         fileName: c.metadata?.fileName || null,
//         originalText: c.text,
//         relevanceScore: safeNum(c.score,0),
//         estimatedPage: c.metadata?.estimatedPage || null,
//         pageUrl: c.metadata?.pageUrl || null
//       })),
//       confidence: clamp01(avgScore)
//     };
//   }

//   // 5) build prompt (trim chunks to limit tokens)
//   const { prompt } = buildPrompt(query, selected, {
//     maxChunkChars: cfg.MAX_CHUNK_CHARS,
//     maxContextChars: cfg.MAX_CONTEXT_CHARS
//   });

//   // 6) model call (single awaited call)
//   let answerText = '';
//   try {
//     const result = await model.generateContent(prompt);
//     answerText = (result?.response?.text?.() || result?.candidates?.[0]?.content || '').trim();
//   } catch (err) {
//     // model failure -> return graceful message but include selected sources for inspection
//     return {
//       answer: "Failed to generate an answer (model error).",
//       sources: selected.map((c,i)=>({
//         id: `source_${i+1}`,
//         chunkId: c.metadata?.chunkId || null,
//         fileId: c.metadata?.fileId || null,
//         fileName: c.metadata?.fileName || null,
//         originalText: c.text,
//         relevanceScore: safeNum(c.score,0),
//         estimatedPage: c.metadata?.estimatedPage || null,
//         pageUrl: c.metadata?.pageUrl || null
//       })),
//       confidence: 0
//     };
//   }

//   // 7) map sources & compute confidence (cheap scan)
//   const sources = selected.map((c, i) => ({
//     id: `source_${i+1}`,
//     chunkId: c.metadata?.chunkId || null,
//     fileName: c.metadata?.fileName || 'Document',
//     fileId: c.metadata?.fileId || null,
//     chunkIndex: c.metadata?.chunkIndex ?? null,
//     originalText: c.text || '',
//     relevanceScore: safeNum(c.score, 0),
//     estimatedPage: c.metadata?.estimatedPage ?? null,
//     pageUrl: c.metadata?.pageUrl ?? null,
//     cloudinaryUrl: c.metadata?.cloudinaryUrl ?? null,
//     thumbnailUrl: c.metadata?.thumbnailUrl ?? null
//   }));

//   const confidence = computeConfidenceFromAnswer(answerText, selected);

//   return {
//     answer: answerText || "No answer generated from the provided sources.",
//     sources,
//     confidence
//   };
// }


// module.exports = generateAnswerOptimized;