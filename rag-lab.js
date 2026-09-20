(() => {
  const $ = (selector) => document.querySelector(selector);
  const source = $('#source-text');
  const chunkSize = $('#chunk-size');
  const overlap = $('#overlap');
  const docs = [];
  let index = [];
  let indexed = false;

  const stopWords = new Set('a an and are as at be by for from has how i in is it make of on or the that this to what with you your do does should system systems'.split(' '));
  const tokenize = (value) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(word => word && !stopWords.has(word));
  const escapeHtml = (value) => { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; };

  function updateControls() {
    $('#chunk-size-value').textContent = chunkSize.value;
    $('#overlap-value').textContent = overlap.value;
  }
  chunkSize.addEventListener('input', updateControls);
  overlap.addEventListener('input', updateControls);

  function splitIntoChunks(text, size, overlapSize) {
    const paragraphs = text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
    const result = [];
    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (paragraph.length <= size) { result.push({ text: paragraph, paragraphIndex }); return; }
      let start = 0;
      while (start < paragraph.length) {
        const end = Math.min(start + size, paragraph.length);
        result.push({ text: paragraph.slice(start, end).trim(), paragraphIndex });
        if (end === paragraph.length) break;
        start = Math.max(end - overlapSize, start + 1);
      }
    });
    return result;
  }

  function ingest() {
    const text = source.value.trim();
    if (!text) return;
    const size = Number(chunkSize.value);
    const overlapSize = Math.min(Number(overlap.value), Math.floor(size / 2));
    index = splitIntoChunks(text, size, overlapSize).map((chunk, i) => ({
      id: i + 1,
      text: chunk.text,
      terms: tokenize(chunk.text),
      source: `notes-${chunk.paragraphIndex + 1}.txt`
    }));
    indexed = true;
    $('#doc-count').textContent = `${text.split(/\n\s*\n/).filter(Boolean).length} documents`;
    $('#source-characters').textContent = text.length;
    $('#chunk-count').textContent = index.length;
    $('#vocab-count').textContent = new Set(index.flatMap(chunk => chunk.terms)).size;
    $('#index-status').textContent = 'Indexed locally';
    $('#query-status').textContent = 'Ready to retrieve';
    $('#chunk-preview').innerHTML = index.map(chunk => `<div class="chunk"><b>CHUNK ${String(chunk.id).padStart(2, '0')} · ${escapeHtml(chunk.source)}</b><br>${escapeHtml(chunk.text)}</div>`).join('');
    runQuery($('#rag-query').value, false);
  }

  function scoreChunk(chunk, queryTerms) {
    const uniqueQuery = [...new Set(queryTerms)];
    const matches = uniqueQuery.filter(term => chunk.terms.includes(term));
    const lexical = matches.length / Math.max(uniqueQuery.length, 1);
    const coverage = matches.length / Math.max(chunk.terms.length, 1);
    const pseudoSemantic = uniqueQuery.some(term => chunk.text.toLowerCase().includes(term.slice(0, Math.max(4, term.length - 1)))) ? .08 : 0;
    return { matches, lexical, coverage, score: lexical * .78 + coverage * .14 + pseudoSemantic };
  }

  function makeAnswer(question, ranked) {
    if (!ranked.length || ranked[0].score < .08) return { text: 'I could not find enough evidence in the indexed knowledge to answer that safely.', citations: [], evidence: [] };
    const selected = ranked.slice(0, 2);
    const sentenceParts = selected.map((chunk) => {
      const sentences = chunk.text.split(/(?<=[.!?])\s+/);
      const queryTerms = tokenize(question);
      return sentences.sort((a, b) => queryTerms.filter(t => b.toLowerCase().includes(t)).length - queryTerms.filter(t => a.toLowerCase().includes(t)).length)[0];
    }).filter(Boolean);
    return { text: sentenceParts.join(' ') + ' ', citations: selected.map(chunk => `[${chunk.id}]`), evidence: selected };
  }

  function runQuery(question, animate = true) {
    if (!indexed) { $('#trace').innerHTML = '<p class="empty">Ingest knowledge first, then run a question.</p>'; return; }
    const query = question.trim() || 'How do I build a RAG system?';
    const start = performance.now();
    const queryTerms = tokenize(query);
    const scored = index.map(chunk => ({ ...chunk, ...scoreChunk(chunk, queryTerms) }));
    const ranked = scored.sort((a, b) => b.score - a.score).filter(chunk => chunk.score > 0).slice(0, 4);
    const answer = makeAnswer(query, ranked);
    const elapsed = Math.max(2, Math.round(performance.now() - start));
    $('#query-status').textContent = `${ranked.length} evidence chunks found`;
    $('#trace-time').textContent = `${elapsed} ms · local simulation`;
    $('#trace').innerHTML = [
      `<div class="trace-step"><b>1 · QUERY UNDERSTANDING</b><p>Tokenized question into ${queryTerms.length} searchable terms: ${escapeHtml(queryTerms.join(', ') || 'none')}.</p></div>`,
      `<div class="trace-step"><b>2 · CANDIDATE RETRIEVAL</b><p>Compared the question with ${index.length} indexed chunks using lexical and pseudo-semantic signals.</p></div>`,
      `<div class="trace-step"><b>3 · RERANKING</b><p>Kept ${ranked.length} chunks. Best match scored ${ranked[0] ? ranked[0].score.toFixed(2) : '0.00'} and matched ${ranked[0] ? ranked[0].matches.length : 0} terms.</p></div>`,
      `<div class="trace-step"><b>4 · CONTEXT BUILDING</b><p>Selected the top ${answer.evidence.length} chunks and attached their source IDs as citations.</p></div>`,
      `<div class="trace-step"><b>5 · GENERATION GUARDRAIL</b><p>${answer.evidence.length ? 'Answer is composed only from retrieved evidence.' : 'Abstained because evidence was insufficient.'}</p></div>`
    ].join('');
    $('#answer').innerHTML = `<p class="answer-text">${escapeHtml(answer.text)} ${answer.citations.map(citation => `<span class="citation">${citation}</span>`).join(' ')}</p><div class="evidence"><h4>Retrieved evidence</h4>${answer.evidence.length ? answer.evidence.map(chunk => `<p><span class="citation">[${chunk.id}]</span> ${escapeHtml(chunk.text)}</p>`).join('') : '<p>No supporting chunks were found. Try adding knowledge or asking a more specific question.</p>'}</div>`;
    if (animate) document.querySelector('.answer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('#ingest-btn').addEventListener('click', ingest);
  $('#rag-form').addEventListener('submit', (event) => { event.preventDefault(); runQuery($('#rag-query').value); });
  document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => { $('#rag-query').value = button.dataset.query; runQuery(button.dataset.query); }));
  updateControls();
  ingest();
})();
