/**
 * RAG Lab — Interactive Hands-on Hybrid RAG System
 * Powered by RagEngine
 */
(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => document.querySelectorAll(selector);

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // DOM Elements
  const sourceSelect = $('#source-select');
  const sourceText = $('#source-text');
  const chunkSizeInput = $('#chunk-size');
  const chunkSizeOutput = $('#chunk-size-value');
  const overlapInput = $('#overlap');
  const overlapOutput = $('#overlap-value');
  const ingestBtn = $('#ingest-btn');

  const docCountEl = $('#doc-count');
  const indexStatusEl = $('#index-status');
  const charCountEl = $('#source-characters');
  const chunkCountEl = $('#chunk-count');
  const vocabCountEl = $('#vocab-count');
  const chunkPreviewEl = $('#chunk-preview');

  const ragForm = $('#rag-form');
  const ragQueryInput = $('#rag-query');
  const queryStatusEl = $('#query-status');
  const quickQueriesEl = $('.quick-queries');

  const scoreChartEl = $('#score-chart');
  const canvas = $('#vector-graph');
  const graphTooltip = $('#graph-tooltip');

  const traceTimeEl = $('#trace-time');
  const traceEl = $('#trace');

  const confidenceValEl = $('#confidence-value');
  const confidenceMeterEl = $('#confidence-meter');
  const riskValEl = $('#risk-value');
  const riskMeterEl = $('#risk-meter');

  const answerEl = $('#answer');
  const evidenceAnswerEl = $('#evidence-answer');
  const llmAnswerEl = $('#llm-answer');

  // State
  let currentChunks = [];
  let currentIndex = null;
  let lastSearch = null;
  let projectedGraph = null;

  // Sync sliders
  function updateSliderLabels() {
    chunkSizeOutput.textContent = chunkSizeInput.value;
    overlapOutput.textContent = overlapInput.value;
  }

  chunkSizeInput.addEventListener('input', updateSliderLabels);
  overlapInput.addEventListener('input', updateSliderLabels);

  // Render dynamic quick query buttons
  function renderQuickQueries(datasetKey) {
    const queries = RagEngine.PRESET_QUERIES[datasetKey] || RagEngine.PRESET_QUERIES.portfolio;
    quickQueriesEl.innerHTML = queries
      .map(q => `<button type="button" data-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`)
      .join('');

    $$('.quick-queries button').forEach(btn => {
      btn.addEventListener('click', () => {
        ragQueryInput.value = btn.getAttribute('data-query');
        runPipeline(ragQueryInput.value, true);
      });
    });
  }

  // Switch dataset
  sourceSelect.addEventListener('change', () => {
    const key = sourceSelect.value;
    if (key === 'custom') {
      sourceText.value = '';
      sourceText.placeholder = 'Paste your custom document or knowledge text here...';
    } else {
      sourceText.value = RagEngine.DATASETS[key] || '';
    }
    renderQuickQueries(key);
    const firstQuery = (RagEngine.PRESET_QUERIES[key] || [])[0] || 'What is this about?';
    ragQueryInput.value = firstQuery;
    ingest(false);
  });

  // Ingest & Index
  function ingest(runDefaultQuery = true) {
    const text = sourceText.value.trim();
    if (!text) {
      chunkPreviewEl.innerHTML = '<p class="empty">Please enter or select knowledge text to ingest.</p>';
      indexStatusEl.textContent = 'Empty source';
      indexStatusEl.className = 'status-badge';
      return;
    }

    const chunkSize = parseInt(chunkSizeInput.value, 10) || 320;
    const overlap = parseInt(overlapInput.value, 10) || 40;
    const docName = sourceSelect.options[sourceSelect.selectedIndex]?.text || 'Document';

    currentChunks = RagEngine.chunkDocument(text, chunkSize, overlap, docName);
    currentIndex = new RagEngine.RagIndex(currentChunks);

    const sections = text.split(/\n\s*\n/).filter(Boolean).length;
    docCountEl.textContent = `${sections} document ${sections === 1 ? 'section' : 'sections'}`;
    charCountEl.textContent = text.length.toLocaleString();
    chunkCountEl.textContent = currentChunks.length;
    vocabCountEl.textContent = currentIndex.vocabularySize.toLocaleString();

    indexStatusEl.textContent = `Indexed (${currentChunks.length} chunks)`;
    indexStatusEl.className = 'status-badge grounded';
    queryStatusEl.textContent = 'Ready to retrieve';
    queryStatusEl.className = 'status-badge';

    // Render chunk preview cards
    chunkPreviewEl.innerHTML = currentChunks.map(c => `
      <div class="chunk" id="chunk-card-${c.id}" data-chunk-id="${c.id}">
        <b>CHUNK ${String(c.id).padStart(2, '0')} · ${escapeHtml(c.source)} <span style="opacity:0.6">(${c.charLength} chars, ${c.terms.length} terms)</span></b>
        <p style="margin:0.35rem 0 0 0; line-height:1.5;">${escapeHtml(c.text)}</p>
      </div>
    `).join('');

    // Clicking a chunk preview card highlights it
    $$('.chunk').forEach(el => {
      el.addEventListener('click', () => {
        $$('.chunk').forEach(c => c.classList.remove('highlighted'));
        el.classList.add('highlighted');
      });
    });

    if (runDefaultQuery && ragQueryInput.value.trim()) {
      runPipeline(ragQueryInput.value, false);
    }
  }

  ingestBtn.addEventListener('click', () => ingest(true));

  // Run RAG pipeline
  function runPipeline(query, scroll = true) {
    if (!currentIndex || currentChunks.length === 0) {
      traceEl.innerHTML = '<p class="empty">Ingest knowledge first before querying.</p>';
      return;
    }

    const q = query.trim();
    if (!q) return;

    const startTime = performance.now();

    // 1. Retrieval
    const searchRes = currentIndex.search(q, 5);
    lastSearch = searchRes;

    // 2. Generation & Guardrail Evaluation
    const gen = RagEngine.GroundedGenerator.generate(q, searchRes.topK);

    const latency = Math.max(1, Math.round(performance.now() - startTime));

    // Update query status
    const retrievedCount = gen.topChunks ? gen.topChunks.length : 0;
    queryStatusEl.textContent = gen.abstain
      ? '0 confident chunks (Abstained)'
      : `${retrievedCount} evidence chunks retrieved (score ≥ 0.15)`;
    queryStatusEl.className = gen.abstain ? 'status-badge' : 'status-badge grounded';

    traceTimeEl.textContent = `${latency} ms · hybrid dense+sparse`;

    // Meters
    confidenceValEl.textContent = `${gen.confidence}%`;
    confidenceMeterEl.style.width = `${gen.confidence}%`;
    riskValEl.textContent = `${gen.hallucinationRisk}%`;
    riskMeterEl.style.width = `${gen.hallucinationRisk}%`;

    // Highlight top chunks in preview list
    $$('.chunk').forEach(el => el.classList.remove('highlighted'));
    if (gen.topChunks) {
      gen.topChunks.forEach(c => {
        const card = $(`#chunk-card-${c.id}`);
        if (card) card.classList.add('highlighted');
      });
    }

    // Render Score Chart
    renderScoreChart(searchRes.topK);

    // Render 2D Vector Map Canvas
    renderVectorMap(searchRes.queryVector, searchRes.all);

    // Render Pipeline Trace
    renderTrace(q, searchRes, gen, latency);

    // Render Answers & Evidence
    renderAnswers(gen);

    if (scroll && answerEl) {
      answerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Render Candidate Score Chart
  function renderScoreChart(candidates) {
    if (!candidates || candidates.length === 0) {
      scoreChartEl.innerHTML = '<p class="empty">No matching chunks found.</p>';
      return;
    }

    scoreChartEl.innerHTML = candidates.map(c => {
      const isSelected = c.score >= 0.15;
      const barWidth = Math.max(4, Math.round(c.score * 100));
      return `
        <div class="score-row ${isSelected ? 'selected' : ''}" data-chunk-id="${c.id}" title="Click to view Chunk ${c.id}">
          <div>
            <span>C${c.id} · ${escapeHtml(c.source)}</span>
            <div class="score-breakdown">
              <span class="score-tag">Dense: <b>${c.denseSim}</b></span>
              <span class="score-tag">BM25: <b>${c.bm25Score}</b></span>
              <span class="score-tag">Cov: <b>${Math.round(c.coverage * 100)}%</b></span>
            </div>
          </div>
          <div class="bar">
            <i style="width:${barWidth}%"></i>
          </div>
          <b class="score-value">${c.score.toFixed(2)}</b>
        </div>
      `;
    }).join('');

    // Clicking score row highlights corresponding chunk preview card
    $$('.score-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-chunk-id');
        const card = $(`#chunk-card-${id}`);
        if (card) {
          $$('.chunk').forEach(c => c.classList.remove('highlighted'));
          card.classList.add('highlighted');
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  // Render 2D Vector Space Map Canvas
  function renderVectorMap(queryVector, allScoredChunks) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth || 620;
    const h = 320;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    projectedGraph = RagEngine.projectTo2D(queryVector, allScoredChunks, w, h);

    // Clear background
    ctx.clearRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(248, 246, 241, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 30; x < w; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 30; y < h; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const qx = projectedGraph.query.x;
    const qy = projectedGraph.query.y;

    // Draw concentric similarity distance rings
    const rings = [0.25, 0.5, 0.75];
    const maxR = Math.min(qx, qy) - 35;
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.1)';
    ctx.setLineDash([4, 4]);
    rings.forEach(frac => {
      ctx.beginPath();
      ctx.arc(qx, qy, maxR * (1 - frac), 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Draw connecting vectors from Query to retrieved chunks
    projectedGraph.points.forEach(pt => {
      if (pt.isRetrieved) {
        ctx.strokeStyle = 'rgba(126, 231, 135, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        // Pulsing outer halo for retrieved nodes
        ctx.beginPath();
        ctx.fillStyle = 'rgba(126, 231, 135, 0.15)';
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw chunk points
    projectedGraph.points.forEach(pt => {
      ctx.beginPath();
      ctx.fillStyle = pt.isRetrieved ? '#7ee787' : '#8a7538';
      ctx.arc(pt.x, pt.y, pt.isRetrieved ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Border ring
      ctx.strokeStyle = pt.isRetrieved ? '#b4f2bc' : '#4d4120';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label text
      ctx.fillStyle = pt.isRetrieved ? '#f8f6f1' : '#9a97a3';
      ctx.font = '10px "DM Mono", monospace';
      ctx.fillText(`C${pt.id}`, pt.x + 9, pt.y + 3);
    });

    // Draw Query Node at center
    ctx.beginPath();
    ctx.fillStyle = 'rgba(103, 183, 255, 0.25)';
    ctx.arc(qx, qy, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#67b7ff';
    ctx.arc(qx, qy, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#67b7ff';
    ctx.font = 'bold 11px "DM Mono", monospace';
    ctx.fillText('QUERY', qx + 12, qy + 4);
  }

  // Canvas Mouse Interaction (Hover Tooltip)
  if (canvas) {
    canvas.addEventListener('mousemove', e => {
      if (!projectedGraph) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let hovered = null;
      for (const pt of projectedGraph.points) {
        const dx = mouseX - pt.x;
        const dy = mouseY - pt.y;
        if (Math.sqrt(dx * dx + dy * dy) <= 12) {
          hovered = pt;
          break;
        }
      }

      if (hovered && graphTooltip) {
        graphTooltip.innerHTML = `
          <strong>Chunk ${hovered.id}</strong> · Score: <b>${hovered.score.toFixed(2)}</b><br>
          <span style="opacity:0.8">Semantic: ${hovered.denseSim} | BM25: ${hovered.bm25Score}</span>
        `;
        graphTooltip.style.left = `${hovered.x}px`;
        graphTooltip.style.top = `${hovered.y}px`;
        graphTooltip.classList.add('visible');
      } else if (graphTooltip) {
        graphTooltip.classList.remove('visible');
      }
    });

    canvas.addEventListener('mouseleave', () => {
      if (graphTooltip) graphTooltip.classList.remove('visible');
    });

    canvas.addEventListener('click', e => {
      if (!projectedGraph) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      for (const pt of projectedGraph.points) {
        const dx = mouseX - pt.x;
        const dy = mouseY - pt.y;
        if (Math.sqrt(dx * dx + dy * dy) <= 14) {
          const card = $(`#chunk-card-${pt.id}`);
          if (card) {
            $$('.chunk').forEach(c => c.classList.remove('highlighted'));
            card.classList.add('highlighted');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          break;
        }
      }
    });
  }

  // Render Pipeline Execution Trace
  function renderTrace(query, searchRes, gen, latency) {
    const qTerms = searchRes.queryTerms;
    const topChunk = searchRes.topK[0];
    const retrievedCount = gen.topChunks ? gen.topChunks.length : 0;

    traceEl.innerHTML = `
      <div class="trace-step">
        <b>01 · LINGUISTIC NORMALIZATION</b>
        <p>Tokenized "${escapeHtml(query)}" into ${qTerms.length} terms: <code>${escapeHtml(qTerms.join(', ') || 'none')}</code>.</p>
      </div>
      <div class="trace-step">
        <b>02 · DENSE & SPARSE RETRIEVAL</b>
        <p>Evaluated ${currentChunks.length} indexed chunks using 64-dim Subword Cosine Vector Similarity + BM25Okapi length-normalized scoring.</p>
      </div>
      <div class="trace-step">
        <b>03 · HYBRID RANK FUSION & RERANKING</b>
        <p>Merged dense semantic and lexical candidate scores. Top candidate C${topChunk ? topChunk.id : '–'} scored ${topChunk ? topChunk.score.toFixed(2) : '0.00'}.</p>
      </div>
      <div class="trace-step">
        <b>04 · CONTEXT WINDOW AUGMENTATION</b>
        <p>${retrievedCount > 0 ? `Selected ${retrievedCount} authoritative chunks, preserving document citation anchors.` : 'No chunks passed minimum relevance threshold (0.15).'}</p>
      </div>
      <div class="trace-step">
        <b>05 · GROUNDED SYNTHESIS & CITATIONS</b>
        <p>${gen.abstain ? 'Abstention guardrail triggered to prevent hallucinations.' : `Synthesized answer backed by ${gen.evidence.length} validated evidence sentences.`}</p>
      </div>
      <div class="trace-step">
        <b>06 · EVALUATION & GUARDRAILS</b>
        <p>Confidence: <strong>${gen.confidence}%</strong> · Hallucination risk: <strong>${gen.hallucinationRisk}%</strong> · Latency: <strong>${latency} ms</strong>.</p>
      </div>
    `;
  }

  // Render Answers and Evidence with interactive citations
  function renderAnswers(gen) {
    // Extractive Answer
    evidenceAnswerEl.className = gen.abstain ? 'answer-text empty' : 'answer-text';
    evidenceAnswerEl.innerHTML = formatCitations(gen.extractiveAnswer);

    // LLM Synthesized Answer
    llmAnswerEl.className = gen.abstain ? 'answer-text empty' : 'answer-text';
    llmAnswerEl.innerHTML = formatCitations(gen.llmAnswer);

    // Main Answer Panel
    const evidenceHtml = (gen.evidence && gen.evidence.length > 0)
      ? gen.evidence.map(e => `
          <p>
            <span class="citation" data-target-chunk="${e.chunkId}">[C${e.chunkId}]</span>
            ${escapeHtml(e.sentence)}
            <small style="opacity:0.6; display:block; margin-top:2px;">— ${escapeHtml(e.source)}</small>
          </p>
        `).join('')
      : '<p style="color:var(--faint)">No supporting chunks met the confidence threshold. Add knowledge or ask a more specific question.</p>';

    answerEl.innerHTML = `
      <p class="answer-text">${formatCitations(gen.llmAnswer)}</p>
      <div class="evidence">
        <h4>Retrieved Grounded Evidence (${gen.evidence ? gen.evidence.length : 0} items)</h4>
        ${evidenceHtml}
      </div>
    `;

    // Hook up citation clicks across all answer panels
    $$('.citation').forEach(cite => {
      cite.addEventListener('click', () => {
        const text = cite.textContent.replace(/[^0-9]/g, '');
        if (text) {
          const card = $(`#chunk-card-${text}`);
          if (card) {
            $$('.chunk').forEach(c => c.classList.remove('highlighted'));
            card.classList.add('highlighted');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });
    });
  }

  // Replace [C1] tags with styled clickable spans
  function formatCitations(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    return escaped.replace(/\[C(\d+)\]/g, (match, id) => {
      return `<span class="citation" data-target-chunk="${id}" title="Click to view Chunk ${id}">[C${id}]</span>`;
    });
  }

  // Handle Form Submission
  ragForm.addEventListener('submit', e => {
    e.preventDefault();
    runPipeline(ragQueryInput.value, true);
  });

  // Window resize handler for canvas responsiveness
  window.addEventListener('resize', () => {
    if (lastSearch) {
      renderVectorMap(lastSearch.queryVector, lastSearch.all);
    }
  });

  // Initialization
  sourceText.value = RagEngine.DATASETS.portfolio;
  updateSliderLabels();
  renderQuickQueries('portfolio');
  ragQueryInput.value = RagEngine.PRESET_QUERIES.portfolio[0];
  ingest(true);
})();
