const STORAGE_KEY = 'billwais.records.v1';
const DRAFTS_KEY = 'billwais.drafts.v1';
const demoRecords = [
  {id:'demo-e-1',kind:'bill',utility:'electricity',provider:'ALECO',period:'2026-08',amount:2940,consumption:260,unit:'kWh',account:'',filename:'',dataUrl:''},
  {id:'demo-w-1',kind:'bill',utility:'water',provider:'Local Water District',period:'2026-08',amount:1180,consumption:28,unit:'m³',account:'',filename:'',dataUrl:''},
  {id:'demo-e-2',kind:'bill',utility:'electricity',provider:'ALECO',period:'2026-07',amount:2140,consumption:198,unit:'kWh',account:'',filename:'',dataUrl:''},
  {id:'demo-w-2',kind:'bill',utility:'water',provider:'Local Water District',period:'2026-07',amount:990,consumption:24,unit:'m³',account:'',filename:'',dataUrl:''},
  {id:'demo-e-3',kind:'bill',utility:'electricity',provider:'ALECO',period:'2026-06',amount:1975,consumption:184,unit:'kWh',account:'',filename:'',dataUrl:''},
  {id:'demo-w-3',kind:'bill',utility:'water',provider:'Local Water District',period:'2026-06',amount:1040,consumption:25,unit:'m³',account:'',filename:'',dataUrl:''}
];
let records = loadJson(STORAGE_KEY, demoRecords);
let drafts = loadJson(DRAFTS_KEY, []);
let currentFilter = 'all';
let chartMode = 'spend';
let activeLetter = null;
let toastTimer;

function loadJson(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); }
  catch { showToast('Browser storage is full. Remove a large attachment and try again.'); }
}
function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function normalizeRecordInput(record) {
  const provider = String(record.provider || '').trim();
  const period = String(record.period || '').trim();
  const amount = safeNumber(record.amount, NaN);
  if (!provider || !period || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Please complete the provider, billing period, and amount before saving.');
  }
  return {
    ...record,
    provider,
    period,
    amount: Number(amount.toFixed(2)),
    consumption: record.consumption !== null && record.consumption !== undefined && record.consumption !== '' ? Number(Number(record.consumption).toFixed(2)) : null,
    previousReading: record.previousReading !== null && record.previousReading !== undefined && record.previousReading !== '' ? Number(record.previousReading) : null,
    presentReading: record.presentReading !== null && record.presentReading !== undefined && record.presentReading !== '' ? Number(record.presentReading) : null,
    notes: String(record.notes || '').trim()
  };
}
function money(value) { return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(Number(value)||0); }
function monthName(period, short=false) {
  if (!period) return 'Unknown period';
  const [year,month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH',{month:short?'short':'long',year:'numeric'}).format(new Date(year,month-1,1));
}
function sortedBills(utility) { return records.filter(record => record.kind==='bill' && (!utility || record.utility===utility)).sort((a,b)=>b.period.localeCompare(a.period)); }
function pairFor(utility) { const bills=sortedBills(utility); return [bills[0],bills[1]]; }
function changePercent(current,previous) { return previous ? ((current-previous)/previous)*100 : 0; }
function flagged(current,previous) { return Boolean(current && previous && changePercent(current.amount,previous.amount)>=30); }
function showToast(message) {
  const toast=document.getElementById('toast'); toast.textContent=message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2600);
}
function utilityLabel(utility) { return utility==='electricity'?'Electricity':'Water'; }
function utilityUnit(utility) { return utility==='electricity'?'kWh':'m³'; }
function icon(name,className='icon') { return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="#icon-${name}"></use></svg>`; }
function utilityIcon(utility) { return icon(utility==='electricity'?'bolt':'water','icon'); }
function setDate() {
  document.getElementById('today-date').textContent=new Intl.DateTimeFormat('en-PH',{month:'long',day:'numeric',year:'numeric'}).format(new Date()).toUpperCase();
}
function renderSummary() {
  const [electricity] = pairFor('electricity'); const [water] = pairFor('water');
  const combined=(electricity?.amount||0)+(water?.amount||0);
  const alerts=[['electricity',...pairFor('electricity')],['water',...pairFor('water')]].filter(([,current,previous])=>flagged(current,previous));
  const biggest=alerts.sort((a,b)=>changePercent(b[1].amount,b[2].amount)-changePercent(a[1].amount,a[2].amount))[0];
  const change=biggest?`${changePercent(biggest[1].amount,biggest[2].amount)>=0?'+':''}${Math.round(changePercent(biggest[1].amount,biggest[2].amount))}%`:'No flags';
  const cards=[
    ['Electricity',electricity?money(electricity.amount):'—',electricity?`${monthName(electricity.period)} · ${electricity.consumption||'—'} ${electricity.unit||utilityUnit('electricity')}`:'No bill added','electricity'],
    ['Water',water?money(water.amount):'—',water?`${monthName(water.period)} · ${water.consumption||'—'} ${water.unit||utilityUnit('water')}`:'No bill added','water'],
    ['Combined latest bills',money(combined),'Most recent recorded billing periods','combined'],
    ['Largest bill change',change,biggest?`${utilityLabel(biggest[0])} · compared with previous bill`:'Add another period to compare','change']
  ];
  document.getElementById('summary-grid').innerHTML=cards.map(([label,value,meta,kind])=>`<article class="summary-card"><div class="summary-label">${label}</div><div class="summary-value">${value}</div><div class="summary-meta">${meta}</div></article>`).join('');
}
function renderChart() {
  const months=[...new Set(sortedBills().map(record=>record.period))].sort().slice(-6);
  const series=chartMode==='spend'?
    [{utility:'electricity',label:'Electricity',field:'amount',color:'#e6762e'},{utility:'water',label:'Water',field:'amount',color:'#1593c6'}]:
    [{utility:chartMode,label:chartMode==='electricity'?'Electricity usage':'Water usage',field:'consumption',color:chartMode==='electricity'?'#e6762e':'#1593c6'}];
  const values=months.flatMap(period=>series.map(item=>records.find(record=>record.kind==='bill'&&record.utility===item.utility&&record.period===period)?.[item.field]||0));
  const step=chartMode==='spend'?2000:chartMode==='electricity'?50:10;
  const axisMax=Math.max(step,Math.ceil(Math.max(...values,0)/step)*step);
  const ticks=Array.from({length:5},(_,index)=>axisMax*(1-index/4));
  const formatTick=value=>chartMode==='spend'?`₱${value>=1000?`${(value/1000).toFixed(value%1000?1:0)}k`:value}`:String(Math.round(value));
  document.getElementById('chart-y-labels').innerHTML=ticks.map(value=>`<span>${formatTick(value)}</span>`).join('');
  document.getElementById('chart-grid-lines').innerHTML=ticks.map(()=>'<i></i>').join('');
  const monthLabels=document.getElementById('chart-months');
  monthLabels.innerHTML=months.map(period=>`<span>${escapeHtml(monthName(period,true).split(' ')[0])}</span>`).join('');
  monthLabels.style.gridTemplateColumns=`repeat(${Math.max(months.length,1)},minmax(0,1fr))`;
  document.getElementById('chart-legend').innerHTML=series.map(item=>`<span><i style="--series-color:${item.color}"></i>${item.label}${chartMode==='electricity'?' · kWh':chartMode==='water'?' · m³':''}</span>`).join('');
  const width=600; const top=8; const bottom=158;
  const xFor=index=>months.length===1?width/2:8+index*(width-16)/(months.length-1);
  const yFor=value=>bottom-(value/axisMax)*(bottom-top);
  const plots=series.map(item=>{
    const points=months.map((period,index)=>{
      const record=records.find(entry=>entry.kind==='bill'&&entry.utility===item.utility&&entry.period===period);
      return {x:xFor(index),y:yFor(record?.[item.field]||0),value:record?.[item.field]||0,period};
    });
    if(!points.length)return '';
    const curves=points.slice(0,-1).map((point,index)=>{
      const next=points[index+1];
      const previous=points[Math.max(0,index-1)];
      const following=points[Math.min(points.length-1,index+2)];
      const controlOne={x:point.x+(next.x-point.x)/6,y:point.y+(next.y-previous.y)/6};
      const controlTwo={x:next.x-(next.x-point.x)/6,y:next.y-(following.y-point.y)/6};
      return `C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${next.x} ${next.y}`;
    }).join(' ');
    const linePath=`M ${points[0].x} ${points[0].y} ${curves}`;
    const areaPath=`M ${points[0].x} ${bottom} L ${points[0].x} ${points[0].y} ${curves} L ${points[points.length-1].x} ${bottom} Z`;
    const circles=points.map(point=>`<circle cx="${point.x}" cy="${point.y}" r="3.5"><title>${escapeHtml(monthName(point.period))}: ${chartMode==='spend'?money(point.value):`${point.value} ${chartMode==='electricity'?'kWh':'m³'}`}</title></circle>`).join('');
    return `<path d="${areaPath}" fill="${item.color}" opacity=".08"></path><path d="${linePath}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path><g fill="${item.color}">${circles}</g>`;
  }).join('');
  const description=chartMode==='spend'?'Monthly billed amounts for electricity and water':`${utilityLabel(chartMode)} consumption by month`;
  document.getElementById('monthly-chart').setAttribute('aria-label',description);
  document.getElementById('monthly-chart').innerHTML=`<svg class="line-chart" viewBox="0 0 ${width} 168" preserveAspectRatio="none" aria-hidden="true">${plots}</svg>`;
  document.querySelectorAll('[data-chart-mode]').forEach(button=>{
    const selected=button.dataset.chartMode===chartMode;
    button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  });
}
function renderAlert() {
  const matches=[['electricity',...pairFor('electricity')],['water',...pairFor('water')]].filter(([,current,previous])=>flagged(current,previous)).sort((a,b)=>changePercent(b[1].amount,b[2].amount)-changePercent(a[1].amount,a[2].amount));
  const panel=document.getElementById('alert-panel');
  panel.classList.toggle('is-warning',matches.length>0);
  if(!matches.length){panel.innerHTML=`<div class="alert-mark">${icon('check')}</div><p class="eyebrow">BILL CHECK</p><h2>No unusual increase flagged.</h2><p>When you add bills for consecutive periods, BillWais can compare their recorded amounts and consumption.</p><div class="alert-detail"><span>Comparison threshold</span><strong>30% increase</strong></div>`;return;}
  const [utility,current,previous]=matches[0]; const percent=Math.round(changePercent(current.amount,previous.amount));
  panel.innerHTML=`<div class="alert-mark">${icon('warning')}</div><p class="eyebrow">WARNING</p><h2>${utilityLabel(utility)} bill changed by ${percent}%.</h2><p class="alert-body">This bill is flagged for unusual increases and possible discrepancies. Your ${monthName(current.period)} bill is higher than the previous recorded period and may need review with your provider.</p><div class="alert-detail"><span>${previous.consumption||'—'} → ${current.consumption||'—'} ${escapeHtml(current.unit||utilityUnit(utility))}</span><strong>${money(previous.amount)} → ${money(current.amount)}</strong></div><div class="alert-actions"><button class="button button-dark" type="button" data-draft="${escapeHtml(current.id)}">Draft concern</button><button class="button button-outline" type="button" data-go="insights">Compare bills</button></div>`;
}
function renderRecent() {
  const list=[...records].sort((a,b)=>b.period.localeCompare(a.period)).slice(0,4);
  document.getElementById('recent-records').innerHTML=list.length?list.map(record=>`<div class="record-item"><span class="utility-mark ${record.utility}">${utilityIcon(record.utility)}</span><div class="record-main"><strong>${escapeHtml(record.provider)} · ${utilityLabel(record.utility)} ${record.kind==='receipt'?'receipt':'bill'}</strong><small>${monthName(record.period)}${record.kind==='receipt'?' · Payment record':''}</small></div><span class="record-amount">${money(record.amount)}</span></div>`).join(''):'<p class="disclaimer-line">No records yet. Add a bill to get started.</p>';
}
function renderArchive() {
  const query=document.getElementById('record-search').value.trim().toLowerCase();
  const filtered=[...records].filter(record=>(currentFilter==='all'||(currentFilter==='receipt'?record.kind==='receipt':record.utility===currentFilter))&&`${record.provider} ${record.period} ${record.kind} ${record.utility}`.toLowerCase().includes(query)).sort((a,b)=>b.period.localeCompare(a.period));
  document.getElementById('archive-empty').hidden=filtered.length>0;
  document.getElementById('archive-rows').innerHTML=filtered.map(record=>`<tr><td><div class="table-record"><span class="utility-mark ${record.utility}">${utilityIcon(record.utility)}</span><span><strong>${utilityLabel(record.utility)} ${record.kind==='receipt'?'receipt':'bill'}</strong><small>${record.consumption?`${record.consumption} ${escapeHtml(record.unit||utilityUnit(record.utility))} recorded`:'Household record'}</small></span></div></td><td>${escapeHtml(record.provider)}</td><td>${monthName(record.period)}</td><td class="table-amount">${money(record.amount)}</td><td>${record.filename?`<button class="doc-link" type="button" data-download="${escapeHtml(record.id)}">${escapeHtml(record.filename)}</button>`:'<span class="disclaimer-line">No file</span>'}</td><td><button class="row-menu" type="button" data-delete="${escapeHtml(record.id)}" aria-label="Delete record" title="Delete record">${icon('trash')}</button></td></tr>`).join('');
}
function renderInsights() {
  const cards=['electricity','water'].map(utility=>{
    const [current,previous]=pairFor(utility); const pct=current&&previous?Math.round(changePercent(current.amount,previous.amount)):null;
    const consumptionPct=current&&previous&&previous.consumption?Math.round(changePercent(current.consumption,previous.consumption)):null;
    return `<article class="panel insight-card"><div class="insight-card-head"><div class="insight-title"><span class="utility-mark ${utility}">${utilityIcon(utility)}</span><div><h2>${utilityLabel(utility)}</h2><div class="insight-provider">${escapeHtml(current?.provider||'No provider recorded')}</div></div></div>${pct!==null?`<span class="change-badge ${pct<0?'negative':''}">${pct>0?'+':''}${pct}% amount</span>`:''}</div>${current&&previous?`<div class="compare-values"><div class="compare-value"><small>${monthName(previous.period)}</small><strong>${money(previous.amount)}</strong></div><span class="compare-arrow">→</span><div class="compare-value"><small>${monthName(current.period)}</small><strong>${money(current.amount)}</strong></div></div><div class="insight-stat"><span>Consumption change</span><strong>${consumptionPct===null?'Not enough data':`${consumptionPct>0?'+':''}${consumptionPct}% · ${previous.consumption||'—'} → ${current.consumption||'—'} ${escapeHtml(current.unit||utilityUnit(utility))}`}</strong></div>`:`<div class="letter-empty"><p>Add at least two ${utilityLabel(utility).toLowerCase()} bills to compare periods.</p></div>`}</article>`;
  }).join('');
  document.getElementById('insight-grid').innerHTML=cards;
  const electricity=pairFor('electricity')[0]; const water=pairFor('water')[0];
  const recs=[
    ['bolt','Switch off standby','Unplug chargers and turn appliances off at the outlet when not in use. Standby loads can add to electricity use.'],
    ['water','Check for quiet leaks','Look for dripping taps and check the meter when water is not being used. A small leak can continue around the clock.'],
    ['calendar','Compare like periods','Billing days and meter-reading dates affect totals. Check the number of days and the actual readings before drawing conclusions.']
  ];
  if(electricity?.consumption>250)recs[0]=['bolt','Review cooling habits','Set air-conditioning to a comfortable, efficient temperature and clean filters regularly. Actual savings vary by home and appliance.'];
  if(water?.consumption>30)recs[1]=['water','Use water mindfully','Shorter showers, full laundry loads, and prompt leak repairs can reduce avoidable water use.'];
  document.getElementById('recommendations').innerHTML=recs.map(([iconName,title,copy])=>`<article class="recommendation">${icon(iconName,'icon rec-icon')}<h3>${title}</h3><p>${copy}</p></article>`).join('');
}
function renderLetters() {
  const count=drafts.length; document.getElementById('letter-count').textContent=count;
  const list=document.getElementById('letter-list');
  if(!count){list.innerHTML='<div class="letter-empty"><h2>No drafts yet</h2><p>If a recorded bill shows a notable increase, you can start an editable letter from the overview. Review all details before contacting your provider.</p></div>';return;}
  list.innerHTML=[...drafts].reverse().map(draft=>`<div class="letter-row"><span class="letter-row-icon">${icon('file')}</span><div class="letter-row-main"><strong>${utilityLabel(draft.utility)} bill concern</strong><small>${escapeHtml(draft.provider)} · ${monthName(draft.period)} · Edited ${new Intl.DateTimeFormat('en-PH',{dateStyle:'medium'}).format(new Date(draft.updatedAt))}</small></div><button class="button button-outline" type="button" data-open-draft="${escapeHtml(draft.id)}">Open draft</button></div>`).join('');
}
function renderAll() { renderSummary();renderChart();renderAlert();renderRecent();renderArchive();renderInsights();renderLetters(); }
function syncViewFromHash() {
  const hash = window.location.hash.replace('#','');
  const validViews = ['overview','records','insights','letters'];
  const requested = validViews.includes(hash) ? hash : 'overview';
  showView(requested, false);
}
function showView(name, updateHash = true) {
  document.querySelectorAll('.view-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`view-${name}`));
  document.querySelectorAll('.nav-link').forEach(button=>button.classList.toggle('active',button.dataset.view===name));
  document.getElementById('page-crumb').textContent={overview:'Overview',records:'Bill & receipt archive',insights:'Usage insights',letters:'Concern letters'}[name]||'Overview';
  if (updateHash) {
    const nextHash = name === 'overview' ? '#view-overview' : `#view-${name}`;
    if (window.location.hash !== nextHash) {
      history.replaceState(null, '', nextHash);
    }
  }
}
function setRecordKind() {
  const receipt=document.getElementById('record-kind').value==='receipt';
  const utility=document.querySelector('[name="utility"]').value;
  document.getElementById('bill-only-details').hidden=receipt;
  document.getElementById('ocr-tools').hidden=receipt;
  document.getElementById('read-bill').disabled=receipt||!document.getElementById('bill-file').files.length;
  document.getElementById('unit-label').textContent=utilityUnit(utility);
  document.getElementById('period-label').textContent=receipt?'Receipt month':'Billing month';
  document.getElementById('amount-label').textContent=receipt?'Payment amount (₱)':'Amount due (₱)';
  document.getElementById('record-form-title').textContent=receipt?'Add a payment receipt':'Add a record';
  document.getElementById('record-form-intro').textContent=receipt?'Enter the details shown on your payment receipt.':'Enter the details shown on your bill, or send a copy to OCR.Space for reading.';
  document.getElementById('record-save').textContent=receipt?'Save this receipt':'Save this bill';
  document.querySelectorAll('[data-utility]').forEach(button=>{
    const selected=button.dataset.utility===utility;
    button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  });
}
function renderChargeLines(chargeLines=[]) {
  const container=document.getElementById('charge-lines');
  container.innerHTML=chargeLines.map((charge,index)=>`<div class="charge-row"><label class="sr-only" for="charge-name-${index}">Charge description</label><input id="charge-name-${index}" name="chargeName" class="charge-name" maxlength="80" value="${escapeHtml(charge.name||'')}" placeholder="Charge description"><label class="sr-only" for="charge-amount-${index}">Charge amount</label><input id="charge-amount-${index}" name="chargeAmount" class="charge-amount" type="number" min="0" step="0.01" value="${escapeHtml(charge.amount??'')}" placeholder="0.00"><button class="charge-remove" type="button" data-remove-charge aria-label="Remove charge line" title="Remove charge line"><svg class="icon" aria-hidden="true"><use href="#icon-trash"/></svg></button></div>`).join('');
}
function openRecordDialog() {
  const form=document.getElementById('record-form');form.reset();
  form.elements.utility.value='electricity';
  const now=new Date();form.elements.period.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  renderChargeLines();
  document.getElementById('ocr-fields').hidden=true;
  document.getElementById('ocr-review').hidden=true;
  document.getElementById('ocr-review').open=false;
  document.getElementById('record-form-title').textContent='Add a record';
  setRecordKind();
  const dialog = document.getElementById('record-dialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  setTimeout(() => {
    const firstField = form.querySelector('input[name="provider"]');
    if (firstField) firstField.focus();
  }, 50);
}
async function readAttachment(file) {
  if(!file)return {filename:'',dataUrl:''};
  if(file.size>1024*1024)throw new Error('Please choose a file smaller than 1 MB.');
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({filename:file.name,dataUrl:String(reader.result)});reader.onerror=()=>reject(new Error('Could not read that file.'));reader.readAsDataURL(file);});
}
function setOcrStatus(message) { document.getElementById('ocr-status').textContent=message; }
function renderOcrFields(extracted) {
  const fields=[
    ['Provider',extracted.provider],
    ['Utility',extracted.utility?utilityLabel(extracted.utility):'Not detected'],
    ['Billing period',extracted.period?monthName(extracted.period):'Not detected'],
    ['Amount due',extracted.amount===null?'Not detected':`₱${Number(extracted.amount).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`],
    ['Meter readings',extracted.previousReading!==null&&extracted.presentReading!==null?`${extracted.previousReading} → ${extracted.presentReading}`:'Not detected'],
    ['Consumption',extracted.consumption===null?'Not detected':`${extracted.consumption} ${utilityUnit(extracted.utility)}`],
    ['Account / meter number',extracted.account],
    ['Period dates',extracted.periodStart||extracted.periodEnd?[extracted.periodStart,extracted.periodEnd].filter(Boolean).join(' → '):'Not detected'],
    ['Payment due',extracted.dueDate||'Not detected'],
    ['Charge lines',extracted.chargeLines.length?`${extracted.chargeLines.length} detected`:'Not detected']
  ];
  document.getElementById('ocr-field-list').innerHTML=fields.map(([label,value])=>`<div><dt>${label}</dt><dd class="${value?'':'ocr-missing'}">${escapeHtml(value||'Not detected')}</dd></div>`).join('');
  document.getElementById('ocr-fields').hidden=false;
}
function formatOcrText(text) {
  const lines=String(text||'').split(/\r?\n/).map(line=>line.replace(/[\t ]+/g,' ').trim());
  return lines.reduce((formatted,line)=>{
    if(!line)return formatted.endsWith('\n\n')||!formatted?'':`${formatted}\n`;
    return `${formatted}${formatted&&!formatted.endsWith('\n')?'\n':''}${line}`;
  },'').trim();
}
async function readBillFile(file) {
  if(file.size>1024*1024)throw new Error('This demo accepts bill files up to 1 MB.');
  const upload=new FormData();
  upload.append('file',file,file.name);
  setOcrStatus('Sending bill securely to OCR.Space...');
  let response;
  try{
    response=await fetch('./api/ocr.php',{method:'POST',body:upload,credentials:'same-origin'});
  }catch{
    throw new Error('Could not reach the local PHP OCR gateway. Check that Apache and PHP are running.');
  }
  let result;
  try{result=await response.json();}
  catch{throw new Error('The local OCR gateway returned an invalid response.');}
  if(!response.ok||result.error)throw new Error(result.error||`OCR.Space request failed (${response.status}).`);
  return {text:result.text||'',confidence:null,source:result.source||'OCR.Space',truncated:false,warning:result.warning||''};
}
function parseBillDate(value) {
  const input=String(value||'').trim();
  let match=input.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if(match)return `${match[1]}-${String(Number(match[2])).padStart(2,'0')}-${String(Number(match[3])).padStart(2,'0')}`;
  match=input.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if(match)return `${match[3]}-${String(Number(match[2])).padStart(2,'0')}-${String(Number(match[1])).padStart(2,'0')}`;
  const monthMatch=input.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if(!monthMatch)return '';
  const monthNames={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
  return `${monthMatch[3]}-${String(monthNames[monthMatch[1].toLowerCase()]).padStart(2,'0')}-${String(Number(monthMatch[2])).padStart(2,'0')}`;
}
function extractChargeLines(lines) {
  return lines.flatMap(line=>{
    const match=line.match(/^(.{3,60}?)\s+(?:₱|PHP)?\s*([\d,]+(?:\.\d{1,2})?)\s*$/i);
    if(!match||/amount due|total|consumption|reading|billing|account|period|date|balance/i.test(match[1]))return [];
    if(!/charge|chg|loss|supply|npc|env|renew|lifeline|subsid|capex|surcharge|vat|dsm|trans|dist|gen\.?|ancillary|retail|metering|other|uc\b|basic/i.test(match[1]))return [];
    return [{name:match[1].trim(),amount:Number(match[2].replace(/,/g,''))}];
  });
}
function parseBillText(text) {
  const lines=text.split(/\r?\n/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean);
  const normalized=lines.join('\n');
  const knownProviders=[
    ['ALECO',/\b(?:ALECO|ALBAY ELECTRIC COOPERATIVE)\b/i],
    ['Legazpi City Water District',/\b(?:LEGAZPI CITY WATER DISTRICT|LCWD)\b/i],
    ['Meralco',/\bMERALCO\b/i],
    ['Manila Water',/\bMANILA WATER\b/i],
    ['Maynilad',/\bMAYNILAD\b/i],
    ['PrimeWater',/\bPRIME\s*WATER\b/i]
  ];
  const provider=knownProviders.find(([,pattern])=>pattern.test(normalized))?.[0]||'';
  let utility='';
  if(provider==='ALECO'||provider==='Meralco'||/\b(?:electricity bill|electric bill|kilowatt.hours?|kwh)\b/i.test(normalized))utility='electricity';
  else if(provider==='Legazpi City Water District'||provider==='Manila Water'||provider==='Maynilad'||provider==='PrimeWater'||/\b(?:water bill|water district|cubic meters?|m³|m3)\b/i.test(normalized))utility='water';
  const months={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
  const periodLines=lines.filter(line=>/billing period|service period|period covered|billing month|bill period/i.test(line));
  const periodSource=periodLines.length?periodLines.join(' '):normalized;
  const findLabeledDate=pattern=>{
    const line=lines.find(value=>pattern.test(value));
    if(!line)return '';
    const date=line.match(/\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})\b/i);
    return date?parseBillDate(date[0]):'';
  };
  let periodStart=findLabeledDate(/period start|start date|service from|from date/i);
  let periodEnd=findLabeledDate(/period end|end date|service to|to date/i);
  const dateRange=normalized.match(/(\d{1,2}[/-]\d{1,2}[/-]20\d{2})\s*(?:-|–|to|through)\s*(\d{1,2}[/-]\d{1,2}[/-]20\d{2})/i);
  if(dateRange){periodStart=periodStart||parseBillDate(dateRange[1]);periodEnd=periodEnd||parseBillDate(dateRange[2]);}
  let periodMatch=periodSource.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])(?:[-/.]\d{1,2})?\b/);
  let period='';
  if(periodMatch)period=`${periodMatch[1]}-${String(Number(periodMatch[2])).padStart(2,'0')}`;
  else{
    const monthYearPattern=/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b(?:\s+\d{1,2}(?:st|nd|rd|th)?)?[\s,.-]+(20\d{2})\b/gi;
    const matches=[...periodSource.matchAll(monthYearPattern)];
    if(matches.length)period=`${matches[matches.length-1][2]}-${String(months[matches[matches.length-1][1].toLowerCase()]).padStart(2,'0')}`;
  }
  if(!period)period=(periodEnd||periodStart).slice(0,7);
  const amountLabel=/amount due|total amount due|total due|amount payable|total payable|balance due|bill total|current bill/i;
  let amount=null;
  for(let index=0;index<lines.length;index++){
    if(!amountLabel.test(lines[index]))continue;
    const context=`${lines[index]} ${lines[index+1]||''}`;
    const match=context.match(/(?:₱|PHP)\s*([\d,]+(?:\.\d{1,2})?)/i)||lines[index].match(/(?:due|payable|bill total|current bill)\D{0,16}([\d,]+(?:\.\d{1,2})?)/i);
    if(match){amount=Number(match[1].replace(/,/g,''));break;}
  }
  if(amount===null){
    const currencyAmounts=[...normalized.matchAll(/(?:₱|PHP)\s*([\d,]+(?:\.\d{1,2})?)/gi)];
    if(currencyAmounts.length)amount=Number(currencyAmounts[currencyAmounts.length-1][1].replace(/,/g,''));
  }
  const consumptionPattern=/([\d,]+(?:\.\d+)?)\s*(kwh|kilowatt[ -]?hours?|m³|m3|cubic\s*meters?)/i;
  const consumptionLines=lines.filter(line=>/(?:consumption|usage|used|volume|total kwh|meter reading)/i.test(line)&&consumptionPattern.test(line));
  const consumptionLine=consumptionLines[0]||lines.find(line=>consumptionPattern.test(line))||'';
  const consumptionMatch=consumptionLine.match(consumptionPattern);
  const consumption=consumptionMatch?Number(consumptionMatch[1].replace(/,/g,'')):null;
  const previousLine=lines.find(line=>/previous|prior|prev\.?/i.test(line)&&/reading|meter/i.test(line))||'';
  const presentLine=lines.find(line=>/present|current/i.test(line)&&/reading|meter/i.test(line))||'';
  const readingPattern=/([\d,]+(?:\.\d+)?)/;
  const previousReadingMatch=previousLine.match(readingPattern);
  const presentReadingMatch=presentLine.match(readingPattern);
  const previousReading=previousReadingMatch?Number(previousReadingMatch[1].replace(/,/g,'')):null;
  const presentReading=presentReadingMatch?Number(presentReadingMatch[1].replace(/,/g,'')):null;
  const dueDate=findLabeledDate(/payment due|due date|pay by/i);
  const accountLine=lines.find(line=>/account\s*(?:\/\s*meter\s*)?(?:number|no\.?|#)|meter\s*(?:number|no\.?|#)|consumer\s*(?:number|no\.?|#)|service\s*(?:id|number)/i.test(line))||'';
  const accountMatch=accountLine.match(/(?:account(?:\s*\/\s*meter)?|meter|consumer|service)\s*(?:number|no\.?|#|id)?\s*[:#-]?\s*([A-Z0-9-]{5,})/i);
  const chargeLines=extractChargeLines(lines);
  return {provider,utility,period,amount,consumption,account:accountMatch?.[1]||'',periodStart,periodEnd,dueDate,previousReading,presentReading,chargeLines};
}
async function readSelectedBill() {
  const file=document.getElementById('bill-file').files[0];
  if(!file)return;
  const readButton=document.getElementById('read-bill');
  const saveButton=document.querySelector('#record-form button[type="submit"]');
  readButton.disabled=true;saveButton.disabled=true;
  document.getElementById('ocr-fields').hidden=true;
  document.getElementById('ocr-review').hidden=true;
  document.getElementById('ocr-review').open=false;
  setOcrStatus('Preparing secure OCR.Space request...');
  try{
    const result=await readBillFile(file);
    const extracted=parseBillText(result.text);
    const form=document.getElementById('record-form');
    if(extracted.utility)form.elements.utility.value=extracted.utility;
    if(extracted.provider)form.elements.provider.value=extracted.provider;
    if(extracted.period)form.elements.period.value=extracted.period;
    if(extracted.amount!==null)form.elements.amount.value=extracted.amount;
    form.elements.consumption.value=extracted.consumption??'';
    if(extracted.account)form.elements.account.value=extracted.account;
    if(extracted.periodStart)form.elements.periodStart.value=extracted.periodStart;
    if(extracted.periodEnd)form.elements.periodEnd.value=extracted.periodEnd;
    if(extracted.dueDate)form.elements.dueDate.value=extracted.dueDate;
    if(extracted.previousReading!==null)form.elements.previousReading.value=extracted.previousReading;
    if(extracted.presentReading!==null)form.elements.presentReading.value=extracted.presentReading;
    if(extracted.chargeLines.length)renderChargeLines(extracted.chargeLines);
    setRecordKind();
    const fields=[extracted.provider,extracted.utility,extracted.period,extracted.amount!==null,extracted.consumption!==null,extracted.previousReading!==null||extracted.presentReading!==null,extracted.account,extracted.periodStart||extracted.periodEnd,extracted.dueDate,extracted.chargeLines.length>0].filter(Boolean).length;
    const confidence=result.confidence===null?`${result.source||'OCR.Space'} complete`:`OCR confidence ${Math.round(result.confidence)}%`;
    const confidenceNote=result.confidence!==null&&result.confidence<65?' Low confidence; use a clearer scan or enter the values manually.':'';
    const pageNote=result.warning?` ${result.warning}`:result.truncated?' Only the first 5 PDF pages were read.':'';
    setOcrStatus(`${confidence}. Found ${fields} bill details. Check every value against the original before saving.${confidenceNote}${pageNote}`);
    document.getElementById('record-form-title').textContent='Check what we read';
    document.getElementById('record-form-intro').textContent='Everything below is editable. Correct anything the bill was unclear about, then save.';
    renderOcrFields(extracted);
    document.getElementById('ocr-text').textContent=formatOcrText(result.text)||'No readable text was found.';
    document.getElementById('ocr-review').hidden=false;
  }catch(error){
    setOcrStatus(`Could not read this file: ${error.message}`);
  }finally{
    readButton.disabled=!document.getElementById('bill-file').files.length||document.getElementById('record-kind').value==='receipt';
    saveButton.disabled=false;
  }
}
function openLetter(recordId) {
  const current=records.find(record=>record.id===recordId);if(!current)return;
  const previous=sortedBills(current.utility).find(record=>record.period<current.period);
  const existing=drafts.find(draft=>draft.recordId===recordId);
  const text=existing?.text||makeLetter(current,previous);
  activeLetter={id:existing?.id||`draft-${recordId}`,recordId,utility:current.utility,provider:current.provider,period:current.period,text};
  document.getElementById('letter-text').value=text;document.getElementById('letter-dialog').showModal();
}
function makeLetter(current,previous) {
  const name='[Your Name]';const provider=current.provider||'[Utility Provider]';
  const oldAmount=previous?money(previous.amount):'[usual or previous bill amount]';
  const consumptionLine=current.consumption?`Recorded consumption: ${current.consumption} ${current.unit||utilityUnit(current.utility)}${previous?.consumption?` (previous: ${previous.consumption} ${previous.unit||utilityUnit(current.utility)})`:''}`:'Consumption: [add your meter reading or consumption if available]';
  return `${name}\n[Your Address]\n[Your Phone Number]\n[Your Email Address]\n${new Intl.DateTimeFormat('en-PH',{dateStyle:'long'}).format(new Date())}\n\nThe Manager / Customer Relations\n${provider}\n\nSubject: Request for verification of utility bill for ${monthName(current.period)}\n\nDear Sir/Madam,\n\nI am writing to respectfully request a review of my ${utilityLabel(current.utility).toLowerCase()} bill for ${monthName(current.period)}${current.account?` under account number ${current.account}`:''}. The amount recorded is ${money(current.amount)}, compared with ${oldAmount} for my previous recorded bill.\n\n${consumptionLine}\n\nI would appreciate it if you could verify the meter reading and provide an itemized explanation of the charges for this billing period. Please let me know if you need copies of my bill, prior records, or any additional information.\n\nThis request is for verification; I understand the change may have several causes. I would be grateful for guidance on the appropriate review process and any applicable payment arrangements while the inquiry is being considered.\n\nThank you for your time and assistance.\n\nYours faithfully,\n\n${name}\n[Signature, if submitting a printed copy]`;
}
function saveLetter() {
  if(!activeLetter)return;
  activeLetter.text=document.getElementById('letter-text').value;activeLetter.updatedAt=new Date().toISOString();
  const index=drafts.findIndex(draft=>draft.id===activeLetter.id);
  if(index>=0)drafts[index]=activeLetter;else drafts.push(activeLetter);
  persist();renderLetters();document.getElementById('letter-dialog').close();showToast('Draft saved in this browser.');
}
function downloadRecord(id) {
  const record=records.find(item=>item.id===id);if(!record?.dataUrl)return;
  const link=document.createElement('a');link.href=record.dataUrl;link.download=record.filename||'billwais-document';document.body.append(link);link.click();link.remove();
}
function printLetter() {
  const text=document.getElementById('letter-text').value;
  const popup=window.open('','_blank','width=800,height=900');if(!popup){showToast('Allow pop-ups to print or save this letter.');return;}
  const safe=escapeHtml(text);
  popup.document.write(`<!doctype html><html><head><title>BillWais concern letter</title><style>body{font:12pt/1.65 Georgia,serif;color:#222;margin:2.5cm;white-space:pre-wrap}@media print{body{margin:2cm}}</style></head><body>${safe}</body></html>`);
  popup.document.close();popup.focus();popup.print();
}

setDate();
document.addEventListener('click',event=>{
  const utilityChoice=event.target.closest('[data-utility]');if(utilityChoice){document.querySelector('[name="utility"]').value=utilityChoice.dataset.utility;setRecordKind();return;}
  if(event.target.closest('#add-charge')){const chargeLines=[...document.querySelectorAll('.charge-row')].map(row=>({name:row.querySelector('.charge-name').value,amount:row.querySelector('.charge-amount').value}));chargeLines.push({name:'',amount:''});renderChargeLines(chargeLines);return;}
  const removeCharge=event.target.closest('[data-remove-charge]');if(removeCharge){const chargeLines=[...document.querySelectorAll('.charge-row')].filter(row=>row!==removeCharge.closest('.charge-row')).map(row=>({name:row.querySelector('.charge-name').value,amount:row.querySelector('.charge-amount').value}));renderChargeLines(chargeLines);return;}
  const chartTab=event.target.closest('[data-chart-mode]');if(chartTab){chartMode=chartTab.dataset.chartMode;renderChart();return;}
  const nav=event.target.closest('[data-view]');if(nav){showView(nav.dataset.view);return;}
  const go=event.target.closest('[data-go]');if(go){showView(go.dataset.go);return;}
  if(event.target.closest('#add-bill-top,#add-record-overview,#add-record-archive')){openRecordDialog();return;}
  const close=event.target.closest('[data-close]');if(close){document.getElementById(close.dataset.close).close();return;}
  const draft=event.target.closest('[data-draft]');if(draft){openLetter(draft.dataset.draft);return;}
  const openDraft=event.target.closest('[data-open-draft]');if(openDraft){const item=drafts.find(entry=>entry.id===openDraft.dataset.openDraft);if(item){activeLetter={...item};document.getElementById('letter-text').value=item.text;document.getElementById('letter-dialog').showModal();}return;}
  const download=event.target.closest('[data-download]');if(download){downloadRecord(download.dataset.download);return;}
  const remove=event.target.closest('[data-delete]');if(remove){if(confirm('Delete this record from this browser?')){records=records.filter(item=>item.id!==remove.dataset.delete);drafts=drafts.filter(item=>item.recordId!==remove.dataset.delete);persist();renderAll();showToast('Record deleted.');}return;}
  const filter=event.target.closest('[data-filter]');if(filter){currentFilter=filter.dataset.filter;document.querySelectorAll('.filter-tab').forEach(button=>button.classList.toggle('active',button===filter));renderArchive();}
});
document.getElementById('record-kind').addEventListener('change',setRecordKind);
document.querySelector('[name="utility"]').addEventListener('change',setRecordKind);
document.getElementById('bill-file').addEventListener('change',event=>{
  const file=event.currentTarget.files[0];
  document.getElementById('read-bill').disabled=!file||document.getElementById('record-kind').value==='receipt';
  document.getElementById('ocr-fields').hidden=true;
  document.getElementById('ocr-review').hidden=true;
  document.getElementById('record-form-title').textContent='Add a record';
  document.getElementById('record-form-intro').textContent='Enter the details shown on your bill, or send a copy to OCR.Space for reading.';
  setOcrStatus(file?`Ready to send ${file.name} to OCR.Space.`:'Choose an image or PDF to send to OCR.Space for reading.');
});
document.getElementById('read-bill').addEventListener('click',readSelectedBill);
document.getElementById('record-search').addEventListener('input',renderArchive);
document.getElementById('record-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;const values=new FormData(form);
  try{
    const attachment=await readAttachment(values.get('file'));
    const utility=String(values.get('utility'));const kind=String(values.get('kind'));
    const provider=String(values.get('provider')||'').trim();
    const period=String(values.get('period')||'').trim();
    const amount=safeNumber(values.get('amount'), NaN);
    if (!provider || !period || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Please complete the provider, billing period, and valid amount before saving.');
    }
    const previousReading=kind==='bill'&&values.get('previousReading')!==''?Number(values.get('previousReading')):null;
    const presentReading=kind==='bill'&&values.get('presentReading')!==''?Number(values.get('presentReading')):null;
    const enteredConsumption=kind==='bill'&&values.get('consumption')!==''?Number(values.get('consumption')):null;
    const consumption=enteredConsumption!==null?enteredConsumption:previousReading!==null&&presentReading!==null&&presentReading>=previousReading?presentReading-previousReading:null;
    const chargeLines=kind==='bill'?[...document.querySelectorAll('.charge-row')].map(row=>({name:row.querySelector('.charge-name').value.trim(),amount:row.querySelector('.charge-amount').value})).filter(line=>line.name&&line.amount!==''&&Number.isFinite(Number(line.amount))).map(line=>({...line,amount:Number(line.amount)})):[];
    const normalized = normalizeRecordInput({id:`record-${Date.now()}`,kind,utility,provider,period,amount,consumption,unit:utilityUnit(utility),account:String(values.get('account')||'').trim(),previousReading,presentReading,periodStart:kind==='bill'?String(values.get('periodStart')||''):'',periodEnd:kind==='bill'?String(values.get('periodEnd')||''):'',dueDate:kind==='bill'?String(values.get('dueDate')||''):'',chargeLines,notes:String(values.get('notes')||'').trim(),...attachment});
    const duplicate = records.some(item => item.utility===normalized.utility && item.provider.toLowerCase()===normalized.provider.toLowerCase() && item.period===normalized.period && item.kind===normalized.kind);
    if (duplicate) {
      throw new Error('A matching record already exists for that utility and billing period.');
    }
    records.push(normalized);persist();renderAll();document.getElementById('record-dialog').close();showToast('Record added to your local archive.');
  }catch(error){showToast(error.message);}
});
document.getElementById('letter-form').addEventListener('submit',event=>{event.preventDefault();saveLetter();});
document.getElementById('print-letter').addEventListener('click',printLetter);
document.getElementById('email-letter').addEventListener('click',()=>{
  const record=records.find(item=>item.id===activeLetter?.recordId);const subject=`Bill review request: ${activeLetter?.provider||'utility bill'} ${monthName(activeLetter?.period)}`;
  window.location.href=`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(document.getElementById('letter-text').value)}`;
  showToast(record?'Your email app will open with the draft.':'Your email app will open with the draft.');
});
window.addEventListener('hashchange', syncViewFromHash);
renderAll();
syncViewFromHash();