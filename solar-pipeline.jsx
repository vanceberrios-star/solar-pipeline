import { useState, useEffect } from "react";

const RE_KEY    = "pipeline_re_v1";
const SOLAR_KEY = "pipeline_solar_v1";

const SEED_SOLAR = [];
const SEED_RE    = [];

async function loadSolar() { try { const r=await window.storage.get(SOLAR_KEY); if(r) return JSON.parse(r.value); await window.storage.set(SOLAR_KEY,JSON.stringify(SEED_SOLAR)); return SEED_SOLAR; } catch { return SEED_SOLAR; } }
async function saveSolar(d){ try { await window.storage.set(SOLAR_KEY,JSON.stringify(d)); } catch {} }
async function loadRE() {
  try {
    const r = await window.storage.get(RE_KEY);
    if (r) return JSON.parse(r.value);
    await window.storage.set(RE_KEY, JSON.stringify(SEED_RE));
    return SEED_RE;
  } catch { return SEED_RE; }
}
async function saveREField(id, key, val) {
  try {
    const r = await window.storage.get(RE_KEY);
    if (!r) return;
    const list = JSON.parse(r.value).map(x => x.id === id ? { ...x, [key]: val } : x);
    await window.storage.set(RE_KEY, JSON.stringify(list));
  } catch {}
}

function safeJSON(raw) {
  let s=raw.trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
  const a=s.indexOf("{"),b=s.lastIndexOf("}");
  if(a!==-1&&b!==-1) s=s.slice(a,b+1);
  return JSON.parse(s);
}
function uid()       { return Math.random().toString(36).slice(2,9); }
function daysUntil(d){ if(!d) return null; return Math.round((new Date(d)-new Date(new Date().toDateString()))/86400000); }
function daysSince(d){ if(!d) return null; return Math.round((new Date(new Date().toDateString())-new Date(d))/86400000); }
function fmt$(n)     { return n>0?"$"+Math.round(n).toLocaleString("en-US"):"—"; }
function urgCol(d)   { if(d===null) return "#4A6A8A"; if(d<0) return "#FF6B35"; if(d<=1) return "#FF6B35"; if(d<=3) return "#FFB800"; return "#00C2CB"; }

async function getFollowUpMsg(client, context = "") {
  const lc    = daysSince(client.lastContact);
  const fu    = daysUntil(client.followUp);
  const log   = (client.activityLog||[]).slice(-3).map(l=>`${l.date}: ${l.note}`).join("\n");
  const prompt = `Eres una representante de ventas exitosa de energía solar residencial en Puerto Rico (Windmar Homes). Generas mensajes de seguimiento que suenan como los escribiría una vendedora top — cálidos, profesionales, directos y enfocados en el ahorro del cliente. NUNCA uses groserías, palabras vulgares, ni lenguaje inapropiado. Siempre mantén un tono respetuoso, positivo y orientado al valor para el cliente.

CLIENTE:
Nombre: ${client.name}
Status: ${client.status}
Último contacto: hace ${lc??'?'} días
Seguimiento programado: ${fu===null?'sin fecha':fu<0?`vencido hace ${Math.abs(fu)} días`:`en ${fu} días`}
Consumo LUMA: ${client.lumaKwh||'—'} kWh/mes — Factura: $${client.lumaBill||'—'}/mes
Timeline: ${client.timeline||'—'}
Motivación: ${client.motivation||'—'}
Tipo de financiamiento: ${client.financeType||'—'}
Interés en batería: ${client.batteryInterest||'—'}
Competencia activa: ${client.competingQuotes||'—'}
Objeciones previas: ${client.objections||'Ninguna'}
Intentos de contacto: ${client.followUpAttempts||0}
Techo: ${client.roofCondition||'—'} — Evaluación: ${client.siteAssessment||'—'}
Decisor: ${client.decisionMaker||'—'}
Preferencia contacto: ${client.commPref||'WhatsApp'}
Historial:\n${log||'Sin historial'}
Notas: ${client.notes||'—'}
${context ? `\nCONTEXTO ESPECÍFICO PARA ESTE MENSAJE (IMPORTANTE — incluye esto en el mensaje):\n${context}` : ""}

Responde SOLO JSON sin markdown:
{
  "urgency": "AHORA" | "HOY" | "ESTA SEMANA",
  "channel": "WhatsApp" | "Llamada" | "Email" | "Instagram",
  "reasoning": "1-2 oraciones con la lógica específica para este cliente",
  "message": "mensaje profesional de representante solar, personalizado con nombre y situación, máx 90 palabras, texto plano sin asteriscos. REGLAS: lenguaje respetuoso y profesional en todo momento, sin groserías ni palabras vulgares, menciona algo concreto como la factura o consumo del cliente, tono cálido como lo haría una vendedora exitosa de Windmar PR"
}`;

  try {
    const res  = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:600,messages:[{role:"user",content:prompt}]})});
    const data = await res.json();
    const raw  = (data.content||[]).map(b=>b.text||"").join("");
    return safeJSON(raw);
  } catch(e) { return {urgency:"HOY",channel:client.commPref||"WhatsApp",reasoning:"Error al analizar.",message:`Hola ${client.name}, quería hacer seguimiento contigo sobre tu sistema solar.`}; }
}

async function getCrossSellMsg(client) {
  const prompt = `Eres un estratega de cross-sell para un equipo en PR: energía solar (Windmar) y bienes raíces (KW PR).

CLIENTE SOLAR:
Nombre: ${client.name}
Status: ${client.status}
Consumo LUMA: ${client.lumaKwh||'—'} kWh — Factura: $${client.lumaBill||'—'}/mes
Timeline: ${client.timeline||'—'}
Motivación: ${client.motivation||'—'}
Notas: ${client.notes||'—'}

¿Tiene potencial para comprar o vender propiedad en PR?

Responde SOLO JSON sin markdown:
{"score":"CALIENTE","reason":"razón con detalles específicos","timing":"cuándo exactamente","message":"WhatsApp personalizado máx 85 palabras texto plano PR"}
score = CALIENTE | TIBIO | FRIO`;
  try {
    const res  = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:500,messages:[{role:"user",content:prompt}]})});
    const data = await res.json();
    const raw  = (data.content||[]).map(b=>b.text||"").join("");
    return safeJSON(raw);
  } catch { return {score:"TIBIO",reason:"Error al analizar.",timing:"Próximo contacto.",message:`Hola ${client.name}, quería comentarte algo que te puede interesar.`}; }
}

const SCORE_COLOR   = {CALIENTE:"#FF6B35",TIBIO:"#FFB800",FRIO:"#7A99BB"};
const URGENCY_COLOR = {AHORA:"#FF6B35",HOY:"#FFB800","ESTA SEMANA":"#00C2CB"};
const STATUSES      = ["Lead nuevo","Propuesta enviada","Seguimiento","En instalación","Cerrado","Inactivo"];
const SOURCES       = ["Referido","Instagram","Facebook","Puerta a puerta","Evento","Llamada entrante","Otro"];
const TIMELINES     = ["ASAP","30-60 días","60-90 días","6+ meses","Cerrado","Sin definir"];
const MOTIVATIONS   = ["Reducir factura","Independencia energética","Valor de propiedad","Ambiente","Otro"];
const COMM_PREFS    = ["WhatsApp","Llamada","Email","Instagram"];
const CROSS_ST      = ["No intentado","Mencionado","Interesado","Convertido","No interesado"];
const FINANCE       = ["Efectivo","Préstamo","Lease","Por definir"];
const ROOF_COND     = ["Concreto","Zinc","Madera","Necesita reparación","Por evaluar"];
const SITE_ASSESS   = ["No evaluado","Programado","Completado","Viable","No viable"];
const BATTERY       = ["Sí","No","Tal vez"];
const POST_INSTALL  = ["N/A","Permiso en proceso","Instalado — LUMA pendiente","NEM aprobado","Completado"];
const DECISION      = ["Él solo","Ella sola","Él y esposa","Ella y esposo","Por confirmar"];

const EMPTY = {name:"",phone:"",email:"",address:"",status:"Lead nuevo",source:"",timeline:"",lumaKwh:"",lumaBill:"",financeType:"",motivation:"",commPref:"WhatsApp",lastContact:"",followUp:"",crossSellStatus:"No intentado",expectedComm:"",roofCondition:"",siteAssessment:"No evaluado",competingQuotes:"No",decisionMaker:"",batteryInterest:"",hoa:"No",objections:"",referralFrom:"",postInstallStatus:"N/A",followUpAttempts:0,star:3,notes:"",activityLog:[]};

function getSolarProjections(clients) {
  const now = new Date();
  const months = {};
  const monthName = (ym) => {
    const [y,m] = ym.split("-");
    return new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString("es-PR",{month:"long",year:"numeric"});
  };
  clients.filter(c=>c.expectedComm&&!["Cerrado","Inactivo"].includes(c.status)).forEach(c => {
    const offset = {ASAP:0,"30-60 días":1,"60-90 días":2,"6+ meses":5}[c.timeline] ?? 2;
    const d = new Date(now.getFullYear(), now.getMonth()+offset, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!months[ym]) months[ym] = {label:monthName(ym), total:0, clients:[]};
    months[ym].total += parseFloat(c.expectedComm)||0;
    months[ym].clients.push({name:c.name, val:parseFloat(c.expectedComm)||0});
  });
  return Object.entries(months).sort(([a],[b])=>a.localeCompare(b)).slice(0,6).map(([k,v])=>({key:k,...v}));
}

function getReferralChain(clients) {
  const tree = {};
  clients.forEach(c => {
    const ref = c.referralFrom?.trim();
    if (ref) {
      if (!tree[ref]) tree[ref] = [];
      tree[ref].push(c);
    }
  });
  return Object.entries(tree).sort(([,a],[,b])=>b.length-a.length);
}

export default function SolarApp() {
  const [clients,setClients]   = useState([]);
  const [reDB,setReDB]         = useState([]);
  const [tab,setTab]           = useState("today");
  const [showForm,setShowForm] = useState(false);
  const [form,setForm]         = useState({...EMPTY});
  const [editId,setEditId]     = useState(null);
  const [loading,setLoading]   = useState(true);
  const [expandedId,setExpandedId] = useState(null);
  const [aiMsgs,setAiMsgs]    = useState({});
  const [aiLoading,setAiLoading] = useState({});
  const [aiContext,setAiContext] = useState({});
  const [crossOpps,setCrossOpps] = useState([]);
  const [crossLoading,setCrossLoading] = useState(false);
  const [crossProgress,setCrossProgress] = useState({c:0,t:0});
  const [expandedCross,setExpandedCross] = useState(null);
  const [copied,setCopied]     = useState(null);
  const [newNote,setNewNote]   = useState({});
  const [filterStatus,setFilterStatus] = useState("Todos");
  const [sortBy,setSortBy]     = useState("followUp");

  useEffect(()=>{ Promise.all([loadSolar(),loadRE()]).then(([sol,re])=>{ setClients(sol); setReDB(re); setLoading(false); }); },[]);
  // FIX: added loading to dependency array
  useEffect(()=>{ if(!loading) saveSolar(clients); },[clients,loading]);
  useEffect(()=>{ if(tab==="cross") loadRE().then(setReDB); },[tab]);

  async function persist(list) { setClients(list); }
  function openAdd()  { setEditId(null); setForm({...EMPTY,activityLog:[]}); setShowForm(true); }
  function openEdit(c){ setEditId(c.id); setForm({...c}); setShowForm(true); }
  async function save() {
    if(!form.name.trim()) return;
    const list = editId
      ? clients.map(x=>x.id===editId?{...form,id:editId}:x)
      : [...clients,{...form,id:uid(),activityLog:form.activityLog||[]}];
    await persist(list); setShowForm(false);
  }
  async function del(id) {
    if(!window.confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) return;
    await persist(clients.filter(x=>x.id!==id));
  }
  async function addNote(id) {
    if(!newNote[id]?.trim()) return;
    const today=new Date().toISOString().slice(0,10);
    await persist(clients.map(x=>x.id===id?{...x,activityLog:[{date:today,note:newNote[id]},...(x.activityLog||[])],lastContact:today}:x));
    setNewNote(p=>({...p,[id]:""}));
  }
  async function updateField(id,key,val) { await persist(clients.map(x=>x.id===id?{...x,[key]:val}:x)); }

  async function getAI(client) {
    setAiLoading(p=>({...p,[client.id]:true}));
    const ctx = aiContext[client.id]||"";
    const r=await getFollowUpMsg(client, ctx);
    setAiMsgs(p=>({...p,[client.id]:r}));
    setAiLoading(p=>({...p,[client.id]:false}));
  }

  async function runCross() {
    setCrossLoading(true); setCrossOpps([]);
    const freshRE = await loadRE();
    setReDB(freshRE);
    const eligible = freshRE.filter(c=>!["Convertido","No interesado"].includes(c.crossSellStatus));
    setCrossProgress({c:0,t:eligible.length});
    const results=[]; let cur=0;
    for(const c of eligible){
      const prompt = `Eres un estratega de cross-sell para un equipo en PR: bienes raíces (KW PR) y energía solar (Windmar Homes).

CLIENTE DE REAL ESTATE:
Nombre: ${c.name}
Tipo: ${c.clientType||'—'}
Status: ${c.status}
Presupuesto: $${Number(c.budget||0).toLocaleString()}
Tipo propiedad: ${c.propertyType||'—'}
Timeline: ${c.timeline||'—'}
Motivación: ${c.motivation||'—'}
Pre-aprobado: ${c.preApproval||'—'}
Notas: ${c.notes||'—'}

¿Tiene potencial para energía solar residencial (Windmar Homes PR)?

Responde SOLO JSON sin markdown:
{"score":"CALIENTE","reason":"razón específica con detalles del cliente","timing":"cuándo exactamente","message":"WhatsApp personalizado con nombre, máx 85 palabras, texto plano conversacional PR, menciona algo de su factura LUMA o ahorro si es relevante"}
score = CALIENTE | TIBIO | FRIO`;
      try {
        const res  = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:500,messages:[{role:"user",content:prompt}]})});
        const data = await res.json();
        const raw  = (data.content||[]).map(b=>b.text||"").join("");
        const a    = safeJSON(raw);
        cur++; setCrossProgress({c:cur,t:eligible.length});
        if(a.score!=="FRIO") results.push({client:c,...a});
      } catch { cur++; setCrossProgress({c:cur,t:eligible.length}); }
    }
    // FIX: correct operator precedence for sort comparator
    results.sort((a,b)=>({CALIENTE:0,TIBIO:1}[a.score]??2)-({CALIENTE:0,TIBIO:1}[b.score]??2));
    setCrossOpps(results); setCrossLoading(false);
  }

  function exportCSV() {
    const headers=["Nombre","Teléfono","Email","Dirección","Status","kWh","Factura $","Financiamiento","Timeline","Motivación","Fuente","Referido por","Techo","Evaluación","Competencia","Decisor","Batería","HOA","Objeciones","Post-instalación","Último contacto","Seguimiento","Comisión esperada","Estrellas","Cross-sell","Notas"];
    const rows=clients.map(c=>[c.name,c.phone,c.email,c.address,c.status,c.lumaKwh,c.lumaBill,c.financeType,c.timeline,c.motivation,c.source,c.referralFrom,c.roofCondition,c.siteAssessment,c.competingQuotes,c.decisionMaker,c.batteryInterest,c.hoa,c.objections,c.postInstallStatus,c.lastContact,c.followUp,c.expectedComm,c.star,c.crossSellStatus,`"${(c.notes||"").replace(/"/g,"'")}"`].join(","));
    const csv=[headers.join(","),...rows].join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="Solar_Pipeline.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function copyText(txt,key){
    try { navigator.clipboard.writeText(txt); } catch {
      const ta=document.createElement("textarea"); ta.value=txt;
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(key); setTimeout(()=>setCopied(null),2500);
  }

  const active    = clients.filter(c=>!["Cerrado","Inactivo"].includes(c.status));
  const totalComm = clients.filter(c=>c.expectedComm).reduce((s,c)=>s+(parseFloat(c.expectedComm)||0),0);
  const overdue   = clients.filter(c=>{ const d=daysUntil(c.followUp); return d!==null&&d<0; });
  const dueToday  = clients.filter(c=>daysUntil(c.followUp)===0);
  const proposalPending = clients.filter(c=>c.status==="Propuesta enviada");
  const cold      = clients.filter(c=>{ const d=daysSince(c.lastContact); return d!==null&&d>=14&&!["Cerrado","Inactivo"].includes(c.status); });
  const postInstall = clients.filter(c=>c.status==="Cerrado"&&c.postInstallStatus&&!["N/A","Completado"].includes(c.postInstallStatus));

  let filtered=[...clients];
  if(filterStatus!=="Todos") filtered=filtered.filter(c=>c.status===filterStatus);
  if(sortBy==="followUp") filtered.sort((a,b)=>new Date(a.followUp||"9999")-new Date(b.followUp||"9999"));
  if(sortBy==="comm")     filtered.sort((a,b)=>(parseFloat(b.expectedComm)||0)-(parseFloat(a.expectedComm)||0));
  if(sortBy==="star")     filtered.sort((a,b)=>(b.star||0)-(a.star||0));
  if(sortBy==="bill")     filtered.sort((a,b)=>(parseFloat(b.lumaBill)||0)-(parseFloat(a.lumaBill)||0));

  if(loading) return <div style={{background:"#030E1A",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#00C2CB",fontFamily:"monospace",fontSize:16}}>Cargando pipeline Solar...</div>;

  return (
    <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:"#030E1A",minHeight:"100vh",color:"#EEF8FF"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} button:active{opacity:.8} input,select,textarea{font-family:inherit} textarea{resize:vertical}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#071420} ::-webkit-scrollbar-thumb{background:#00C2CB44;border-radius:4px}
        .card{background:#071420;border:1px solid #0E2A3A;border-radius:10px}
      `}</style>

      {/* HEADER */}
      <div style={{background:"#020A12",borderBottom:"3px solid #00C2CB",padding:"12px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:3,color:"#fff",lineHeight:1}}>
              ⚡ PIPELINE <span style={{color:"#00C2CB"}}>SOLAR</span>
            </div>
            <div style={{fontSize:10,color:"#3A6A7A",letterSpacing:1.5,textTransform:"uppercase",marginTop:1}}>Windmar Homes · Puerto Rico</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <HPill label="Activos" val={active.length} color="#00C2CB"/>
            <HPill label="Comisiones Pipeline" val={totalComm>0?fmt$(totalComm):"—"} color="#FFB800"/>
            <HPill label="⚠ Vencidos" val={overdue.length} color={overdue.length>0?"#FF6B35":"#1A3A4A"}/>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:"flex",background:"#071420",borderBottom:"1px solid #0E2A3A",overflowX:"auto"}}>
        {[{key:"today",label:"📋 HOY"},{key:"list",label:"👥 CLIENTES"},{key:"cross",label:"🏠 CROSS-SELL"},{key:"proj",label:"📊 GCI"},{key:"referidos",label:"🔗 REFERIDOS"}].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,minWidth:90,padding:"12px 8px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Bebas Neue'",fontSize:14,letterSpacing:2,color:tab===t.key?"#00C2CB":"#1A4A5A",borderBottom:tab===t.key?"3px solid #00C2CB":"3px solid transparent",whiteSpace:"nowrap",transition:"all 0.2s"}}>{t.label}</button>
        ))}
      </div>

      {/* TODAY TAB */}
      {tab==="today"&&(
        <div style={{padding:"16px"}}>
          <TSection title="🔴 SEGUIMIENTOS VENCIDOS" clients={overdue} accent="#FF6B35" onOpen={openEdit} empty="Todo al día ✓"/>
          <TSection title="🟡 SEGUIMIENTO HOY" clients={dueToday} accent="#FFB800" onOpen={openEdit} empty="Nada programado para hoy"/>
          <TSection title="📋 PROPUESTAS SIN RESPUESTA" clients={proposalPending} accent="#00C2CB" onOpen={openEdit} empty="Sin propuestas pendientes" sub={c=>`${c.lumaKwh||'—'} kWh · $${c.lumaBill||'—'}/mes`}/>
          <TSection title="🧊 LEADS FRÍOS (+14 días)" clients={cold} accent="#7A99BB" onOpen={openEdit} empty="Todos con contacto reciente"/>
          {postInstall.length>0&&<TSection title="🔧 SEGUIMIENTO POST-INSTALACIÓN" clients={postInstall} accent="#9B59B6" onOpen={openEdit} empty="" sub={c=>c.postInstallStatus}/>}
          <div style={{marginTop:16,display:"flex",gap:8}}>
            <button onClick={openAdd} style={btnS("#00C2CB","#020A12")}>+ NUEVO CLIENTE</button>
            <button onClick={exportCSV} style={btnS("#0E2A3A","#5A9AAA")}>⬇ EXPORTAR CSV</button>
          </div>
        </div>
      )}

      {/* CLIENTS TAB */}
      {tab==="list"&&(
        <div style={{padding:"16px"}}>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={openAdd} style={btnS("#00C2CB","#020A12")}>+ AGREGAR</button>
            <button onClick={exportCSV} style={btnS("#0E2A3A","#5A9AAA")}>⬇ CSV</button>
            <SL value={filterStatus} onChange={setFilterStatus} opts={["Todos",...STATUSES]} accent="#00C2CB"/>
            <SL value={sortBy} onChange={setSortBy} opts={[{v:"followUp",l:"📆 Seguimiento"},{v:"comm",l:"💰 Comisión"},{v:"star",l:"⭐ Estrellas"},{v:"bill",l:"⚡ Factura LUMA"}]} accent="#00C2CB"/>
          </div>

          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <MS label="Pipeline comisiones" val={totalComm>0?fmt$(totalComm):"—"} color="#FFB800"/>
            <MS label="Activos" val={active.length} color="#00C2CB"/>
            <MS label="Vencidos" val={overdue.length} color="#FF6B35"/>
            <MS label="Propuestas pendientes" val={proposalPending.length} color="#9B59B6"/>
          </div>

          {filtered.map(c=><SolarCard key={c.id} c={c} expanded={expandedId===c.id} onToggle={()=>setExpandedId(expandedId===c.id?null:c.id)} onEdit={()=>openEdit(c)} onDel={()=>del(c.id)} aiMsg={aiMsgs[c.id]} aiLoad={aiLoading[c.id]} aiCtx={aiContext[c.id]||""} onAiCtxChange={v=>setAiContext(p=>({...p,[c.id]:v}))} onClearMsg={()=>{setAiMsgs(p=>({...p,[c.id]:undefined}));setAiContext(p=>({...p,[c.id]:""}));}} onAI={()=>getAI(c)} newNote={newNote[c.id]||""} onNoteChange={v=>setNewNote(p=>({...p,[c.id]:v}))} onAddNote={()=>addNote(c.id)} onCopy={copyText} copied={copied} onCrossChange={v=>updateField(c.id,"crossSellStatus",v)}/>)}
          {filtered.length===0&&<Empty icon="⚡" msg="SIN CLIENTES CON ESE FILTRO"/>}
        </div>
      )}

      {/* CROSS-SELL TAB */}
      {tab==="cross"&&(
        <div style={{padding:"16px"}}>
          <div className="card" style={{padding:"18px",marginBottom:14}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2,marginBottom:4,color:"#4A90D9"}}>🏠 CLIENTES RE → LEADS SOLAR PARA TI</div>
            <div style={{fontSize:12,color:"#3A6A7A",marginBottom:14,lineHeight:1.6}}>
              Claude analiza los clientes de Vance en Real Estate e identifica quiénes tienen potencial para instalar solar contigo.
              {reDB.length===0&&<span style={{color:"#FF6B35"}}> Sin datos del app RE aún — agrega clientes allá primero.</span>}
            </div>
            <button onClick={runCross} disabled={crossLoading} style={{...btnS(crossLoading?"#0E2A3A":"#4A90D9",crossLoading?"#3A6A7A":"#fff"),width:"100%",fontSize:16}}>
              {crossLoading?`ANALIZANDO ${crossProgress.c}/${crossProgress.t}...`:"🔍 BUSCAR LEADS SOLAR EN BASE RE"}
            </button>
            {crossLoading&&crossProgress.t>0&&<ProgBar pct={crossProgress.c/crossProgress.t}/>}
          </div>

          {!crossLoading&&crossOpps.length>0&&(
            <div>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:2,color:"#3A6A7A",marginBottom:10}}>
                {crossOpps.length} OPORTUNIDADES — {crossOpps.filter(o=>o.score==="CALIENTE").length} 🔥 · {crossOpps.filter(o=>o.score==="TIBIO").length} 🟡
              </div>
              {crossOpps.map((opp,i)=>(
                <div key={i} className="card" style={{marginBottom:8,border:`1px solid ${SCORE_COLOR[opp.score]}55`,overflow:"hidden"}}>
                  <div onClick={()=>setExpandedCross(expandedCross===i?null:i)} style={{padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{background:SCORE_COLOR[opp.score],color:"white",fontFamily:"'Bebas Neue'",fontSize:11,letterSpacing:1.5,padding:"2px 8px",borderRadius:4}}>{opp.score}</div>
                      <div><div style={{fontWeight:700,fontSize:13}}>{opp.client.name}</div><div style={{fontSize:10,color:"#3A6A7A"}}>🏠 RE → ⚡ Solar (para ti)</div></div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <select value={opp.client.crossSellStatus||"No intentado"} onClick={e=>e.stopPropagation()} onChange={async e=>{
                        e.stopPropagation();
                        // FIX: update crossSellStatus in RE storage (not Solar clients)
                        await saveREField(opp.client.id,"crossSellStatus",e.target.value);
                        setReDB(prev=>prev.map(x=>x.id===opp.client.id?{...x,crossSellStatus:e.target.value}:x));
                        setCrossOpps(prev=>prev.map((o,j)=>j===i?{...o,client:{...o.client,crossSellStatus:e.target.value}}:o));
                      }}
                        style={{background:"#0E2A3A",border:"1px solid #1A4A5A",borderRadius:4,color:"#EEF8FF",fontSize:10,padding:"2px 6px",cursor:"pointer"}}>
                        {CROSS_ST.map(s=><option key={s}>{s}</option>)}
                      </select>
                      <span style={{color:"#1A4A5A"}}>{expandedCross===i?"▲":"▼"}</span>
                    </div>
                  </div>
                  {expandedCross===i&&(
                    <div style={{borderTop:"1px solid #0E2A3A",padding:"12px 14px"}}>
                      <div style={{fontSize:12,color:"#7ABCCC",marginBottom:6,lineHeight:1.5}}><strong style={{color:"#00C2CB"}}>Por qué:</strong> {opp.reason}</div>
                      <div style={{fontSize:12,color:"#7ABCCC",marginBottom:10,lineHeight:1.5}}><strong style={{color:"#FFB800"}}>Cuándo:</strong> {opp.timing}</div>
                      <div style={{background:"#020A12",borderRadius:7,padding:"11px",border:"1px solid #0E2A3A"}}>
                        <div style={{fontSize:10,color:"#3A6A7A",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>MENSAJE WHATSAPP</div>
                        <div style={{fontSize:13,color:"#EEF8FF",lineHeight:1.8}}>{opp.message}</div>
                        <button onClick={()=>copyText(opp.message,`cross-${opp.client.id}`)} style={{marginTop:8,...btnS(copied===`cross-${opp.client.id}`?"#00C2CB":"#0E2A3A",copied===`cross-${opp.client.id}`?"#020A12":"#EEF8FF"),fontSize:11}}>
                          {copied===`cross-${opp.client.id}`?"✓ COPIADO":"COPIAR MENSAJE"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!crossLoading&&crossOpps.length===0&&<div style={{textAlign:"center",padding:40,color:"#1A4A5A",fontSize:13}}>Presiona el botón para analizar.</div>}
        </div>
      )}

      {/* GCI PROJECTION TAB */}
      {tab==="proj"&&(
        <div style={{padding:"16px"}}>
          <div className="card" style={{padding:"18px",marginBottom:16}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:2,color:"#FFB800",marginBottom:4}}>📊 PROYECCIÓN DE COMISIONES</div>
            <div style={{fontSize:12,color:"#3A6A7A",lineHeight:1.6}}>Solo clientes con comisión esperada definida. Basado en timeline estimado.</div>
          </div>
          {(()=>{
            const proj = getSolarProjections(clients);
            const max  = Math.max(...proj.map(p=>p.total),1);
            const grand = proj.reduce((s,p)=>s+p.total,0);
            if(proj.length===0) return <Empty icon="📊" msg="AGREGA COMISIÓN ESPERADA A TUS CLIENTES"/>;
            return (
              <div>
                <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                  <MS label="Total proyectado" val={fmt$(grand)} color="#FFB800"/>
                  <MS label="Meses con deals" val={proj.length} color="#00C2CB"/>
                  <MS label="Promedio/mes" val={fmt$(grand/Math.max(proj.length,1))} color="#9B59B6"/>
                </div>
                {proj.map(p=>(
                  <div key={p.key} className="card" style={{marginBottom:10}}>
                    <div style={{padding:"12px 16px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:1,color:"#fff",textTransform:"capitalize"}}>{p.label}</div>
                        <div style={{fontFamily:"'Bebas Neue'",fontSize:20,color:"#FFB800",letterSpacing:1}}>{fmt$(p.total)}</div>
                      </div>
                      <div style={{background:"#0E2A3A",borderRadius:6,height:8,marginBottom:10,overflow:"hidden"}}>
                        <div style={{height:"100%",background:"linear-gradient(90deg,#00C2CB,#FFB800)",borderRadius:6,width:`${(p.total/max)*100}%`,transition:"width 0.5s ease"}}/>
                      </div>
                      {p.clients.map((c,j)=>(
                        <div key={j} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                          <span style={{color:"#5A9AAA"}}>{c.name}</span>
                          <span style={{color:"#FFB800",fontWeight:600}}>{fmt$(c.val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{fontSize:11,color:"#1A4A5A",marginTop:8,fontStyle:"italic"}}>* Actualiza la comisión esperada y el timeline para mayor precisión.</div>
              </div>
            );
          })()}
        </div>
      )}

      {/* REFERRAL CHAIN TAB */}
      {tab==="referidos"&&(
        <div style={{padding:"16px"}}>
          <div className="card" style={{padding:"18px",marginBottom:16}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:2,color:"#00C2CB",marginBottom:4}}>🔗 CADENA DE REFERIDOS</div>
            <div style={{fontSize:12,color:"#3A6A7A",lineHeight:1.6}}>
              Tus mejores fuentes de nuevos clientes. Clientes cerrados con referidos activos son tu activo más valioso — mantenlos cultivados.
            </div>
          </div>
          {(()=>{
            const chain = getReferralChain(clients);
            const noRef = clients.filter(c=>!c.referralFrom?.trim());
            if(chain.length===0) return <Empty icon="🔗" msg="AGREGA 'REFERIDO POR' A TUS CLIENTES"/>;
            return (
              <div>
                <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                  <MS label="Fuentes activas" val={chain.length} color="#00C2CB"/>
                  <MS label="Clientes referidos" val={clients.filter(c=>c.referralFrom?.trim()).length} color="#FFB800"/>
                  <MS label="Sin referidor" val={noRef.length} color="#3A6A7A"/>
                </div>

                {chain.map(([referrer, refs],i)=>{
                  const closedRefs = refs.filter(c=>c.status==="Cerrado");
                  const activeRefs = refs.filter(c=>!["Cerrado","Inactivo"].includes(c.status));
                  const refValue   = closedRefs.reduce((s,c)=>s+(parseFloat(c.expectedComm)||0),0);
                  return (
                    <div key={i} className="card" style={{marginBottom:10,border:`1px solid #00C2CB${refs.length>=3?"":"22"}`,overflow:"hidden"}}>
                      <div style={{background: refs.length>=3?"#00C2CB18":"#071420", padding:"12px 16px",borderBottom:"1px solid #0E2A3A"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:15,color:"#EEF8FF"}}>{referrer}</div>
                            <div style={{fontSize:11,color:"#3A6A7A",marginTop:2}}>
                              {refs.length} referido{refs.length!==1?"s":""} · {closedRefs.length} cerrado{closedRefs.length!==1?"s":""}
                            </div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            {refValue>0&&<div style={{fontFamily:"'Bebas Neue'",fontSize:18,color:"#FFB800",letterSpacing:1}}>{fmt$(refValue)}</div>}
                            {refs.length>=2&&<div style={{fontSize:10,color:"#00C2CB",fontWeight:700,letterSpacing:1}}>⭐ TOP REFERIDOR</div>}
                          </div>
                        </div>
                      </div>
                      <div style={{padding:"10px 16px"}}>
                        {refs.map((c,j)=>(
                          <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:j<refs.length-1?"1px solid #0E2A3A":"none"}}>
                            <div>
                              <span style={{fontSize:13,color:"#EEF8FF",fontWeight:500}}>{c.name}</span>
                              <span style={{fontSize:11,color:"#3A6A7A",marginLeft:8}}>{c.phone}</span>
                            </div>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              {c.expectedComm&&<span style={{fontSize:11,color:"#FFB800",fontWeight:600}}>{fmt$(parseFloat(c.expectedComm))}</span>}
                              <div style={{background:c.status==="Cerrado"?"#00C2CB20":c.status==="Inactivo"?"#1A4A5A":"#FFB80020",border:`1px solid ${c.status==="Cerrado"?"#00C2CB44":c.status==="Inactivo"?"#1A4A5A":"#FFB80044"}`,borderRadius:4,padding:"1px 7px",fontSize:10,color:c.status==="Cerrado"?"#00C2CB":c.status==="Inactivo"?"#3A6A7A":"#FFB800"}}>
                                {c.status}
                              </div>
                            </div>
                          </div>
                        ))}
                        {activeRefs.length>0&&(
                          <div style={{marginTop:8,padding:"6px 10px",background:"#FFB80010",borderRadius:6,border:"1px solid #FFB80033",fontSize:11,color:"#FFB800"}}>
                            💡 {activeRefs.length} lead{activeRefs.length!==1?"s":""} activo{activeRefs.length!==1?"s":""} en pipeline de esta fuente
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {noRef.length>0&&(
                  <div style={{marginTop:8}}>
                    <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,color:"#1A4A5A",marginBottom:8}}>SIN REFERIDOR REGISTRADO ({noRef.length})</div>
                    {noRef.map((c,i)=>(
                      <div key={i} className="card" style={{padding:"8px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",opacity:0.6}}>
                        <span style={{fontSize:13}}>{c.name}</span>
                        <span style={{fontSize:11,color:"#3A6A7A"}}>{c.source||"Sin fuente"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(2,10,18,0.97)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}}>
          <div style={{background:"#071420",borderRadius:12,padding:"22px 18px",width:"100%",maxWidth:460,border:"2px solid #00C2CB",maxHeight:"94vh",overflowY:"auto"}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:2,marginBottom:16,color:"#00C2CB"}}>{editId?"EDITAR CLIENTE":"NUEVO CLIENTE"}</div>
            <FI label="Nombre completo *" k="name" f={form} s={setForm}/>
            <FI label="Teléfono" k="phone" f={form} s={setForm} ph="787-000-0000"/>
            <FI label="Email" k="email" f={form} s={setForm}/>
            <FI label="Dirección" k="address" f={form} s={setForm}/>
            <SL2 label="Preferencia de contacto" k="commPref" f={form} s={setForm} opts={COMM_PREFS}/>
            <Sec>CONSUMO LUMA</Sec>
            <FI label="Consumo mensual (kWh)" k="lumaKwh" f={form} s={setForm} type="number" ph="1200"/>
            <FI label="Factura mensual ($)" k="lumaBill" f={form} s={setForm} type="number" ph="280"/>
            <SL2 label="Tipo de financiamiento" k="financeType" f={form} s={setForm} opts={FINANCE}/>
            <FI label="Comisión esperada ($)" k="expectedComm" f={form} s={setForm} type="number" ph="Ej. 4500"/>
            <Sec>EVALUACIÓN TÉCNICA</Sec>
            <SL2 label="Condición del techo" k="roofCondition" f={form} s={setForm} opts={ROOF_COND}/>
            <SL2 label="Evaluación del sitio" k="siteAssessment" f={form} s={setForm} opts={SITE_ASSESS}/>
            <SL2 label="HOA" k="hoa" f={form} s={setForm} opts={["No","Sí","Por confirmar"]}/>
            <SL2 label="Interés en batería" k="batteryInterest" f={form} s={setForm} opts={BATTERY}/>
            <SL2 label="Cotizaciones de competencia" k="competingQuotes" f={form} s={setForm} opts={["No","Sí","Por confirmar"]}/>
            <SL2 label="Decisor" k="decisionMaker" f={form} s={setForm} opts={DECISION}/>
            <FI label="Objeciones previas" k="objections" f={form} s={setForm} ph="Ej. Precio alto, no confía..."/>
            <Sec>PIPELINE</Sec>
            <SL2 label="Status" k="status" f={form} s={setForm} opts={STATUSES}/>
            <SL2 label="Fuente" k="source" f={form} s={setForm} opts={SOURCES}/>
            <SL2 label="Timeline" k="timeline" f={form} s={setForm} opts={TIMELINES}/>
            <SL2 label="Motivación" k="motivation" f={form} s={setForm} opts={MOTIVATIONS}/>
            <FI label="Referido por (nombre)" k="referralFrom" f={form} s={setForm} ph="Carmen Vega"/>
            <FI label="Último contacto" k="lastContact" f={form} s={setForm} type="date"/>
            <FI label="Próximo seguimiento" k="followUp" f={form} s={setForm} type="date"/>
            <FI label="Intentos de contacto" k="followUpAttempts" f={form} s={setForm} type="number" ph="0"/>
            <SL2 label="Status post-instalación" k="postInstallStatus" f={form} s={setForm} opts={POST_INSTALL}/>
            <div style={{marginBottom:12}}>
              <label style={lbl}>Prioridad (⭐)</label>
              <div style={{display:"flex",gap:6}}>
                {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setForm(p=>({...p,star:n}))} style={{flex:1,padding:"8px 0",background:form.star>=n?"#FFB800":"#0E2A3A",border:"none",borderRadius:6,cursor:"pointer",fontSize:16,transition:"all 0.2s"}}>★</button>)}
              </div>
            </div>
            <SL2 label="Estado cross-sell" k="crossSellStatus" f={form} s={setForm} opts={CROSS_ST}/>
            <FA label="Notas" k="notes" f={form} s={setForm}/>
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button onClick={save}  style={{flex:1,...btnS("#00C2CB","#020A12"),fontSize:16,fontFamily:"'Bebas Neue'",letterSpacing:2}}>GUARDAR</button>
              <button onClick={()=>setShowForm(false)} style={{flex:1,...btnS("#0E2A3A","#3A6A7A"),fontSize:16,fontFamily:"'Bebas Neue'",letterSpacing:2}}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SolarCard({c,expanded,onToggle,onEdit,onDel,aiMsg,aiLoad,aiCtx,onAiCtxChange,onClearMsg,onAI,newNote,onNoteChange,onAddNote,onCopy,copied,onCrossChange}) {
  const fu=daysUntil(c.followUp), lc=daysSince(c.lastContact), bc=urgCol(fu);
  return (
    <div className="card" style={{marginBottom:8,borderLeft:`3px solid ${bc}`,overflow:"hidden"}}>
      <div onClick={onToggle} style={{padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,fontSize:14}}>{c.name}</span>
            <TG val={c.status} color={c.status==="Cerrado"?"#00C2CB":c.status==="Propuesta enviada"?"#FFB800":c.status==="Inactivo"?"#1A4A5A":"#00C2CB"}/>
            {c.star>0&&<span style={{color:c.star>=4?"#FFB800":"#1A4A5A",fontSize:12}}>{"★".repeat(c.star)}</span>}
          </div>
          <div style={{fontSize:11,color:"#3A6A7A",display:"flex",flexWrap:"wrap",gap:"3px 12px",lineHeight:1.9}}>
            {c.phone&&<span>📞 {c.phone}</span>}
            {c.address&&<span>📍 {c.address}</span>}
            {c.lumaKwh&&<span>⚡ {c.lumaKwh} kWh</span>}
            {c.lumaBill&&<span>💵 ${c.lumaBill}/mes</span>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
          {c.expectedComm&&<div style={{fontFamily:"'Bebas Neue'",fontSize:16,color:"#FFB800",letterSpacing:1}}>{fmt$(parseFloat(c.expectedComm))}</div>}
          <div style={{fontSize:11,color:bc,fontWeight:fu!==null&&fu<0?700:400}}>{fu===null?"—":fu===0?"HOY":fu<0?`${Math.abs(fu)}d vencido`:`${fu}d`}</div>
          <span style={{color:"#1A4A5A",fontSize:13}}>{expanded?"▲":"▼"}</span>
        </div>
      </div>

      {expanded&&(
        <div style={{borderTop:"1px solid #0E2A3A",padding:"14px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 16px",marginBottom:12}}>
            <D icon="📆" label="Seguimiento" val={c.followUp||(fu!==null?`${fu}d`:"—")} warn={fu!==null&&fu<0}/>
            <D icon="🕐" label="Último contacto" val={lc===null?"—":lc===0?"Hoy":lc===1?"Ayer":`${lc}d atrás`} warn={lc!==null&&lc>10}/>
            <D icon="⚡" label="Consumo / Factura" val={`${c.lumaKwh||"—"} kWh · $${c.lumaBill||"—"}/mes`}/>
            <D icon="💳" label="Financiamiento" val={c.financeType||"—"}/>
            <D icon="🏠" label="Techo" val={c.roofCondition||"—"}/>
            <D icon="📐" label="Evaluación sitio" val={c.siteAssessment||"—"} warn={c.siteAssessment==="No viable"}/>
            <D icon="🔋" label="Batería" val={c.batteryInterest||"—"}/>
            <D icon="🏘" label="HOA" val={c.hoa||"—"} warn={c.hoa==="Sí"}/>
            <D icon="⚔️" label="Competencia" val={c.competingQuotes||"—"} warn={c.competingQuotes==="Sí"}/>
            <D icon="👤" label="Decisor" val={c.decisionMaker||"—"}/>
            <D icon="📣" label="Fuente" val={c.source||"—"}/>
            <D icon="📞" label="Intentos" val={c.followUpAttempts||"0"}/>
            {c.referralFrom&&<D icon="🔗" label="Referido por" val={c.referralFrom}/>}
            {c.postInstallStatus&&c.postInstallStatus!=="N/A"&&<D icon="🔧" label="Post-instalación" val={c.postInstallStatus}/>}
          </div>
          {c.objections&&<div style={{background:"#FF6B3511",border:"1px solid #FF6B3544",borderRadius:6,padding:"8px 10px",marginBottom:10,fontSize:11,color:"#FF9B65"}}>⚠ Objeción: {c.objections}</div>}
          {c.notes&&<div style={{fontSize:11,color:"#1A4A5A",fontStyle:"italic",marginBottom:10,lineHeight:1.5,borderTop:"1px solid #0E2A3A",paddingTop:8}}>{c.notes}</div>}

          {/* AI */}
          <div style={{background:"#020A12",borderRadius:8,padding:"12px",marginBottom:10,border:"1px solid #0E2A3A"}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:13,letterSpacing:2,color:"#00C2CB",marginBottom:8}}>🤖 RECOMENDACIÓN DE SEGUIMIENTO</div>
            {!aiMsg&&!aiLoad&&(
              <div>
                <div style={{fontSize:11,color:"#3A6A7A",marginBottom:5}}>¿Algo específico que incluir en el mensaje? <span style={{color:"#1A4A5A"}}>(opcional)</span></div>
                <input value={aiCtx} onChange={e=>onAiCtxChange(e.target.value)} placeholder="Ej: tiene competencia activa, le bajamos el precio, salió incentivo nuevo de LUMA..."
                  style={{width:"100%",background:"#020A12",border:"1px solid #1A4A5A",borderRadius:6,padding:"8px 11px",color:"#EEF8FF",fontSize:12,outline:"none",marginBottom:8}}/>
                <button onClick={onAI} style={{...btnS("#00C2CB","#020A12"),width:"100%",fontSize:13}}>GENERAR MENSAJE CON IA</button>
              </div>
            )}
            {aiLoad&&<div style={{color:"#00C2CB",fontSize:12,textAlign:"center",padding:8}}>Analizando cliente...</div>}
            {aiMsg&&!aiLoad&&(
              <div>
                <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                  <TG val={aiMsg.urgency} color={URGENCY_COLOR[aiMsg.urgency]||"#00C2CB"}/>
                  <TG val={`📲 ${aiMsg.channel}`} color="#00C2CB"/>
                </div>
                <div style={{fontSize:12,color:"#3A8A9A",marginBottom:8,lineHeight:1.5,fontStyle:"italic"}}>{aiMsg.reasoning}</div>
                <div style={{fontSize:13,color:"#EEF8FF",lineHeight:1.8,marginBottom:8}}>{aiMsg.message}</div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>onCopy(aiMsg.message,`ai-${c.id}`)} style={{...btnS(copied===`ai-${c.id}`?"#00C2CB":"#0E2A3A",copied===`ai-${c.id}`?"#020A12":"#EEF8FF"),flex:1,fontSize:11}}>{copied===`ai-${c.id}`?"✓ COPIADO":"COPIAR"}</button>
                  <button onClick={onClearMsg} style={{...btnS("#0E2A3A","#3A6A7A"),flex:1,fontSize:11}}>NUEVO MENSAJE</button>
                </div>
              </div>
            )}
          </div>

          {/* ACTIVITY LOG */}
          <div style={{marginBottom:10}}>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:2,color:"#3A6A7A",marginBottom:6}}>HISTORIAL</div>
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              <input value={newNote} onChange={e=>onNoteChange(e.target.value)} placeholder="Agregar nota..." onKeyDown={e=>e.key==="Enter"&&onAddNote()}
                style={{flex:1,background:"#020A12",border:"1px solid #0E2A3A",borderRadius:6,padding:"7px 10px",color:"#EEF8FF",fontSize:12,outline:"none"}}/>
              <button onClick={onAddNote} style={{...btnS("#00C2CB","#020A12"),fontSize:12,padding:"7px 14px"}}>+</button>
            </div>
            {(c.activityLog||[]).slice(0,5).map((l,i)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:"1px solid #0E2A3A",fontSize:11}}>
                <span style={{color:"#1A4A5A",flexShrink:0}}>{l.date}</span>
                <span style={{color:"#5A9AAA"}}>{l.note}</span>
              </div>
            ))}
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:11,display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:"#3A6A7A"}}>Cross-sell:</span>
              <select value={c.crossSellStatus||"No intentado"} onChange={e=>onCrossChange(e.target.value)}
                style={{background:"#0E2A3A",border:"1px solid #1A4A5A",borderRadius:4,color:"#EEF8FF",fontSize:11,padding:"2px 6px",cursor:"pointer"}}>
                {CROSS_ST.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:6}}>
              <a href={`https://wa.me/${c.phone?.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{...btnS("#25D366","#fff"),fontSize:11,textDecoration:"none",padding:"5px 10px"}}>WhatsApp</a>
              <button onClick={onEdit} style={{...btnS("#0E2A3A","#5A9AAA"),fontSize:11,padding:"5px 10px"}}>Editar</button>
              <button onClick={onDel}  style={{background:"transparent",border:"1px solid #3A1020",borderRadius:5,color:"#FF6B35",padding:"5px 10px",cursor:"pointer",fontSize:11}}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TSection({title,clients,accent,onOpen,empty,sub}) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:15,letterSpacing:2,color:accent,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
        {title}{clients.length>0&&<span style={{background:accent,color:"#fff",borderRadius:10,padding:"1px 8px",fontSize:11}}>{clients.length}</span>}
      </div>
      {clients.length===0
        ?<div style={{fontSize:12,color:"#1A4A5A",padding:"8px 0"}}>{empty}</div>
        :clients.map(c=>(
          <div key={c.id} onClick={()=>onOpen(c)} className="card" style={{padding:"10px 14px",marginBottom:6,cursor:"pointer",borderLeft:`3px solid ${accent}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:600,fontSize:13}}>{c.name}</div><div style={{fontSize:11,color:"#3A6A7A"}}>{sub?sub(c):`${c.status} · $${c.lumaBill||"—"}/mes`}</div></div>
            {c.expectedComm&&<div style={{fontFamily:"'Bebas Neue'",fontSize:14,color:accent}}>{fmt$(parseFloat(c.expectedComm))}</div>}
          </div>
        ))
      }
    </div>
  );
}

function ProgBar({pct}) { return <div style={{background:"#0E2A3A",borderRadius:6,height:5,marginTop:10,overflow:"hidden"}}><div style={{height:"100%",background:"#00C2CB",borderRadius:6,width:`${pct*100}%`,transition:"width 0.4s ease"}}/></div>; }
function HPill({label,val,color}) { return <div style={{background:color+"18",border:`1px solid ${color}44`,borderRadius:8,padding:"5px 12px",textAlign:"right"}}><div style={{fontSize:10,color:"#3A6A7A",letterSpacing:1}}>{label}</div><div style={{fontFamily:"'Bebas Neue'",fontSize:17,color,letterSpacing:1}}>{val}</div></div>; }
function MS({label,val,color}) { return <div style={{background:"#071420",border:"1px solid #0E2A3A",borderRadius:7,padding:"7px 12px",flex:1,minWidth:70}}><div style={{fontSize:9,color:"#3A6A7A"}}>{label}</div><div style={{fontFamily:"'Bebas Neue'",fontSize:16,color,letterSpacing:1}}>{val}</div></div>; }
function TG({val,color}) { return <div style={{background:color+"20",border:`1px solid ${color}44`,borderRadius:4,padding:"1px 7px",fontSize:10,color,letterSpacing:0.5,whiteSpace:"nowrap"}}>{val}</div>; }
function D({icon,label,val,warn}) { return <div><div style={{fontSize:9,color:"#1A4A5A",letterSpacing:1,textTransform:"uppercase"}}>{icon} {label}</div><div style={{fontSize:11,color:warn?"#FF6B35":"#5A9AAA",fontWeight:warn?700:400,marginTop:1}}>{val}</div></div>; }
function Empty({icon,msg}) { return <div style={{textAlign:"center",padding:48,color:"#1A4A5A"}}><div style={{fontSize:36,marginBottom:8}}>{icon}</div><div style={{fontFamily:"'Bebas Neue'",fontSize:16,letterSpacing:2}}>{msg}</div></div>; }
const lbl = {display:"block",fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:"#3A6A7A",marginBottom:4};
const inB = {width:"100%",background:"#020A12",border:"1px solid #0E2A3A",borderRadius:6,padding:"8px 11px",color:"#EEF8FF",fontSize:12,outline:"none"};
function FI({label,k,f,s,type="text",ph}) { return <div style={{marginBottom:10}}><label style={lbl}>{label}</label><input type={type} value={f[k]||""} onChange={e=>s(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={inB}/></div>; }
function SL2({label,k,f,s,opts}) { return <div style={{marginBottom:10}}><label style={lbl}>{label}</label><select value={f[k]||""} onChange={e=>s(p=>({...p,[k]:e.target.value}))} style={inB}><option value="">Seleccionar...</option>{opts.map(o=><option key={o}>{o}</option>)}</select></div>; }
function FA({label,k,f,s}) { return <div style={{marginBottom:10}}><label style={lbl}>{label}</label><textarea value={f[k]||""} onChange={e=>s(p=>({...p,[k]:e.target.value}))} rows={3} style={inB}/></div>; }
function Sec({children}) { return <div style={{fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:2,color:"#00C2CB",margin:"14px 0 8px",borderBottom:"1px solid #0E2A3A",paddingBottom:3}}>{children}</div>; }
function SL({value,onChange,opts,accent}) {
  const options=Array.isArray(opts)&&typeof opts[0]==="object"?opts:opts.map(o=>({v:o,l:o}));
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{background:"#071420",border:"1px solid #0E2A3A",borderRadius:7,color:"#EEF8FF",fontSize:11,padding:"7px 10px",cursor:"pointer",flex:1,minWidth:100}}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>;
}
function btnS(bg,color="#EEF8FF") { return {background:bg,color,border:"none",borderRadius:7,padding:"9px 16px",cursor:"pointer",fontWeight:600,fontSize:12,transition:"opacity 0.2s"}; }
