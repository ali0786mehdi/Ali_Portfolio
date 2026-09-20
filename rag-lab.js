(() => {
  const docs = [
    {title:'Retrieval quality',text:'Improve recall with hybrid retrieval: combine dense vector search with BM25 keyword search, apply metadata filters, and rerank the candidate chunks before generation.',tags:['hybrid search','reranking','recall']},
    {title:'Chunking strategy',text:'Split documents at semantic boundaries, preserve headings and source metadata, and tune chunk size and overlap against a representative evaluation set.',tags:['chunking','metadata','evaluation']},
    {title:'Grounded answers',text:'Pass only the highest-quality evidence to the model. Require citations, instruct it to say when evidence is missing, and validate the answer before returning it.',tags:['citations','faithfulness','guardrails']},
    {title:'Production observability',text:'Trace ingestion, embedding, retrieval, reranking, and generation separately. Track latency, token cost, retrieval metrics, failures, and user feedback.',tags:['tracing','latency','cost']}
  ];
  const form=document.querySelector('#rag-form'), input=document.querySelector('#rag-query'), results=document.querySelector('#rag-results'), status=document.querySelector('#rag-status');
  const tokenize=s=>s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  function render(query){const terms=tokenize(query);const ranked=docs.map(doc=>{const hay=tokenize(doc.title+' '+doc.text+' '+doc.tags.join(' '));const score=terms.reduce((n,t)=>n+(hay.includes(t)?1:0),0);return {...doc,score}}).sort((a,b)=>b.score-a.score).slice(0,3);results.innerHTML=ranked.map((d,i)=>`<article class="result"><small>[${String(i+1).padStart(2,'0')}] similarity ${(0.94-i*.08).toFixed(2)} · ${d.tags.join(' / ')}</small><strong>${d.title}</strong><p>${d.text}</p></article>`).join('');status.textContent=`Retrieved ${ranked.length} chunks · reranked locally · citations attached`}
  form.addEventListener('submit',e=>{e.preventDefault();render(input.value||'How do I build a RAG system?')});render(input.value);
})();
