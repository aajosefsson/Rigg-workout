import { useState, useEffect, useRef } from "react";

const load = async (key, fallback = null) => {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fallback; }
  catch { return fallback; }
};
const save = async (key, val) => {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
};

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const BLOCK_COLORS = { A:"#FF6B1A", B:"#FF9A4D", C:"#FFB87A", D:"#FFCFA0" };
const RESULT_VARS = ["Time","Rounds","Reps","Weight (kg)","Distance (m)","Comment"];
const EMPTY_BLOCK = () => ({ name:"A", description:"", variables:["Rounds","Weight (kg)"] });
const EMPTY_WOD = () => ({ id: Date.now(), title:"", sessionNumber:1, blocks:[EMPTY_BLOCK()], date: todayStr() });
const EMPTY_PERIOD = () => ({ id: Date.now(), name:"", focus:"", startDate: todayStr(), durationWeeks: 8, workouts:[] });
const DEFAULT_MEMBERS = ["Erik","Sofia","Marcus","Linnea","Johan","Emma","Andreas","Maja","David","Sara","Tobias","Klara"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatDate(str) {
  if (!str) return "";
  const d = new Date(str + "T12:00:00");
  return `${DAYS[d.getDay()==0?6:d.getDay()-1]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getWeekDates(mondayStr) {
  return Array.from({length:7}, (_,i) => addDays(mondayStr, i));
}

const GrainBg = () => (
  <svg style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0,opacity:0.35}} xmlns="http://www.w3.org/2000/svg">
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)"/>
  </svg>
);

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: 'Barlow', sans-serif; background: #0f0a06; color: #f0ebe3; min-height: 100vh; }
  .app-root {
    position: relative; min-height: 100vh;
    background: radial-gradient(ellipse 80% 60% at 20% 10%, #4a1800 0%, transparent 55%),
                radial-gradient(ellipse 60% 50% at 80% 80%, #2d0f00 0%, transparent 50%),
                radial-gradient(ellipse 100% 80% at 50% 50%, #1a0800 0%, #0f0a06 100%);
  }
  h1,h2,h3,h4,h5 { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 0.02em; }
  .orange { color: #FF6B1A; } .muted { color: #8a7a6a; } .small { font-size:0.8rem; }

  .nav {
    position: sticky; top:0; z-index:100;
    display:flex; align-items:center; justify-content:space-between;
    padding: 14px 24px;
    background: rgba(15,10,6,0.88); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,107,26,0.15);
  }
  .nav-logo { font-family:'Barlow Condensed',sans-serif; font-size:1.5rem; font-weight:800; letter-spacing:0.08em; color:#FF6B1A; }
  .nav-tabs { display:flex; gap:4px; }
  .nav-tab {
    padding: 7px 18px; border-radius:6px; border:none; cursor:pointer;
    font-family:'Barlow',sans-serif; font-size:0.85rem; font-weight:600;
    background: transparent; color: #8a7a6a; transition: all 0.2s;
  }
  .nav-tab.active { background: rgba(255,107,26,0.15); color:#FF6B1A; }
  .nav-tab:hover:not(.active) { color:#f0ebe3; background:rgba(255,255,255,0.05); }

  .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px; backdrop-filter: blur(4px); }
  .card-orange { border-color: rgba(255,107,26,0.3); background: rgba(255,107,26,0.06); }

  input, textarea, select {
    width:100%; padding:9px 12px; border-radius:7px;
    border:1px solid rgba(255,255,255,0.12);
    background:rgba(255,255,255,0.06); color:#f0ebe3;
    font-family:'Barlow',sans-serif; font-size:0.9rem; transition: border 0.2s; outline:none;
  }
  input:focus, textarea:focus, select:focus { border-color:rgba(255,107,26,0.5); }
  textarea { resize:vertical; min-height:80px; }
  select option { background:#1a1008; }
  label { font-size:0.78rem; font-weight:600; color:#8a7a6a; text-transform:uppercase; letter-spacing:0.06em; display:block; margin-bottom:5px; }

  .btn {
    display:inline-flex; align-items:center; gap:6px;
    padding:9px 18px; border-radius:7px; border:none; cursor:pointer;
    font-family:'Barlow',sans-serif; font-size:0.875rem; font-weight:600;
    transition: all 0.18s; text-decoration:none;
  }
  .btn-primary { background:#FF6B1A; color:#fff; }
  .btn-primary:hover { background:#e55c0e; transform:translateY(-1px); }
  .btn-ghost { background:rgba(255,255,255,0.07); color:#f0ebe3; }
  .btn-ghost:hover { background:rgba(255,255,255,0.12); }
  .btn-danger { background:rgba(220,50,50,0.15); color:#ff7070; border:1px solid rgba(220,50,50,0.2); }
  .btn-danger:hover { background:rgba(220,50,50,0.25); }
  .btn-sm { padding:5px 12px; font-size:0.8rem; }
  .btn-xs { padding:3px 9px; font-size:0.75rem; border-radius:5px; }

  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
  .flex { display:flex; } .flex-center { display:flex; align-items:center; }
  .flex-between { display:flex; align-items:center; justify-content:space-between; }
  .flex-wrap { flex-wrap:wrap; }
  .gap-2{gap:8px;} .gap-3{gap:12px;} .gap-4{gap:16px;}
  .col{flex-direction:column;}
  .mt-1{margin-top:4px;} .mt-2{margin-top:8px;} .mt-3{margin-top:12px;} .mt-4{margin-top:16px;} .mt-6{margin-top:24px;}
  .mb-2{margin-bottom:8px;} .mb-3{margin-bottom:12px;} .mb-4{margin-bottom:16px;} .mb-6{margin-bottom:24px;}
  .w-full{width:100%;} .text-center{text-align:center;}

  .block-badge {
    display:inline-flex; align-items:center; justify-content:center;
    width:28px; height:28px; border-radius:6px;
    font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:1rem; flex-shrink:0;
  }
  .session-tag {
    display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px;
    background:rgba(255,107,26,0.12); color:#FF6B1A; font-size:0.78rem; font-weight:600; letter-spacing:0.04em;
  }

  .results-table { width:100%; border-collapse:collapse; }
  .results-table th { padding:8px 10px; text-align:left; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#8a7a6a; border-bottom:1px solid rgba(255,255,255,0.08); }
  .results-table td { padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.04); }
  .results-table tr:hover td { background:rgba(255,255,255,0.02); }
  .results-table input { padding:5px 8px; font-size:0.85rem; }

  .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
  .cal-day { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:6px; cursor:pointer; font-size:0.78rem; font-weight:600; transition:all 0.15s; }
  .cal-day:hover { background:rgba(255,255,255,0.07); }
  .cal-day.has-wod { background:rgba(255,107,26,0.12); color:#FF6B1A; }
  .cal-day.is-today { background:rgba(255,107,26,0.25); color:#FF6B1A; font-weight:800; }
  .cal-day.is-selected { outline:2px solid #FF6B1A; }
  .cal-day.other-month { opacity:0.3; }
  .cal-dot { width:4px; height:4px; border-radius:50%; background:#FF6B1A; margin-top:2px; }

  .wod-nav-btn { padding:8px 14px; border-radius:8px; border:none; cursor:pointer; background:rgba(255,255,255,0.07); color:#f0ebe3; font-size:1rem; transition:all 0.15s; flex-shrink:0; }
  .wod-nav-btn:hover:not(:disabled) { background:rgba(255,107,26,0.2); color:#FF6B1A; }
  .wod-nav-btn:disabled { opacity:0.25; cursor:default; }

  .login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .login-card { width:100%; max-width:380px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,107,26,0.2); border-radius:16px; padding:40px 32px; backdrop-filter:blur(8px); }

  .member-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:20px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); font-size:0.82rem; cursor:pointer; transition:all 0.15s; }
  .member-pill.active { background:rgba(255,107,26,0.15); border-color:rgba(255,107,26,0.35); color:#FF6B1A; }
  .member-pill:hover:not(.active):not(:disabled) { border-color:rgba(255,255,255,0.2); }

  .page { max-width:1100px; margin:0 auto; padding:24px 20px 60px; position:relative; z-index:1; }
  .section-header { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
  .section-line { flex:1; height:1px; background:rgba(255,255,255,0.07); }
  .period-list { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
  .period-pill { padding:6px 14px; border-radius:20px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#8a7a6a; font-size:0.82rem; font-weight:600; cursor:pointer; transition:all 0.15s; }
  .period-pill.active { background:rgba(255,107,26,0.15); border-color:rgba(255,107,26,0.3); color:#FF6B1A; }
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,107,26,0.3); border-radius:3px; }
  .check-var { display:flex; align-items:center; gap:7px; cursor:pointer; font-size:0.83rem; padding:4px 0; }
  .check-var input[type=checkbox] { width:auto; cursor:pointer; accent-color:#FF6B1A; }
  .week-day-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:14px; min-height:120px; cursor:pointer; transition:all 0.15s; }
  .week-day-card:hover { border-color:rgba(255,107,26,0.25); background:rgba(255,107,26,0.04); }
  .week-day-card.today-card { border-color:rgba(255,107,26,0.4); background:rgba(255,107,26,0.08); }
  .week-day-card.has-wod-card { border-color:rgba(255,107,26,0.2); }
  .admin-tabs { display:flex; border-bottom:1px solid rgba(255,255,255,0.07); margin-bottom:24px; flex-wrap:wrap; }
  .admin-tab { padding:10px 20px; border:none; background:transparent; color:#8a7a6a; font-family:'Barlow',sans-serif; font-size:0.87rem; font-weight:600; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.15s; }
  .admin-tab.active { color:#FF6B1A; border-bottom-color:#FF6B1A; }
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px; }
  .modal-inner { background:#1a0f07; border:1px solid rgba(255,107,26,0.3); border-radius:14px; padding:28px; width:100%; max-width:620px; max-height:85vh; overflow-y:auto; }
  @media(max-width:640px){
    .grid-2,.grid-3 { grid-template-columns:1fr; }
    .nav-logo { font-size:1.2rem; }
    .admin-tab { padding:8px 12px; font-size:0.8rem; }
  }
`;

const DEMO_PERIOD = {
  id: 1700000000000, name: "Spring Strength Block", focus: "Back Squat & Gymnastics",
  startDate: todayStr(), durationWeeks: 8,
  workouts: [{
    id: 1700000001000, title: "Heavy Squats + MetCon", sessionNumber: 1, date: todayStr(),
    blocks: [
      { name:"A", description:"Back Squat\n5x5 @ 80%\nRest 3 min between sets", variables:["Weight (kg)","Comment"] },
      { name:"B", description:"For Time:\n21-15-9\nThrusters (42.5/30kg)\nPull-ups", variables:["Time","Comment"] },
    ]
  }]
};

export default function App() {
  const [view, setView] = useState("member");
  const [adminAuth, setAdminAuth] = useState(false);
  const [periods, setPeriods] = useState([DEMO_PERIOD]);
  const [activePeriodId, setActivePeriodId] = useState(DEMO_PERIOD.id);
  const [results, setResults] = useState({});
  const [sessionMembers, setSessionMembers] = useState({});
  const [memberRoster, setMemberRoster] = useState(DEFAULT_MEMBERS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await load("cf_periods"); const r = await load("cf_results");
      const sm = await load("cf_session_members"); const aa = await load("cf_admin_auth");
      const mr = await load("cf_member_roster");
      if (p) setPeriods(p); if (r) setResults(r);
      if (sm) setSessionMembers(sm); if (aa) setAdminAuth(aa);
      if (mr) setMemberRoster(mr);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) save("cf_periods", periods); }, [periods, loaded]);
  useEffect(() => { if (loaded) save("cf_results", results); }, [results, loaded]);
  useEffect(() => { if (loaded) save("cf_session_members", sessionMembers); }, [sessionMembers, loaded]);
  useEffect(() => { if (loaded) save("cf_member_roster", memberRoster); }, [memberRoster, loaded]);

  const activePeriod = periods.find(p => p.id === activePeriodId) || periods[0];
  const allWorkouts = periods.flatMap(p => p.workouts);

  const updateResult = (wodId, blockName, member, variable, value) => {
    const key = `${wodId}_${blockName}_${member}`;
    setResults(prev => ({ ...prev, [key]: { ...(prev[key]||{}), [variable]: value } }));
  };
  const getResult = (wodId, blockName, member, variable) => results[`${wodId}_${blockName}_${member}`]?.[variable] || "";
  const setSessionMembersForWod = (wodId, mems) => setSessionMembers(prev => ({...prev, [wodId]: mems}));
  const getSessionMembers = (wodId) => sessionMembers[wodId] || [];

  const updatePeriod = (id, updates) => setPeriods(prev => prev.map(p => p.id===id ? {...p,...updates} : p));
  const addPeriod = () => { const np=EMPTY_PERIOD(); setPeriods(prev=>[...prev,np]); setActivePeriodId(np.id); };
  const deletePeriod = (id) => {
    setPeriods(prev => { const next=prev.filter(p=>p.id!==id); return next.length?next:[EMPTY_PERIOD()]; });
    setActivePeriodId(prev => { const rem=periods.filter(p=>p.id!==id); return rem.length?rem[0].id:null; });
  };
  const addWorkout = (periodId, wod) => setPeriods(prev => prev.map(p => p.id===periodId ? {...p,workouts:[...p.workouts,wod]} : p));
  const updateWorkout = (periodId, wod) => setPeriods(prev => prev.map(p => p.id===periodId ? {...p,workouts:p.workouts.map(w=>w.id===wod.id?wod:w)} : p));
  const deleteWorkout = (periodId, wodId) => setPeriods(prev => prev.map(p => p.id===periodId ? {...p,workouts:p.workouts.filter(w=>w.id!==wodId)} : p));

  if (!loaded) return <div style={{color:"#FF6B1A",display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"sans-serif"}}>Loading…</div>;

  return (
    <>
      <style>{css}</style>
      <div className="app-root">
        <GrainBg />
        <nav className="nav">
          <div className="nav-logo">⚡ RIGG WORKOUT</div>
          <div className="nav-tabs">
            <button className={`nav-tab ${view==="member"?"active":""}`} onClick={()=>setView("member")}>Home</button>
            <button className={`nav-tab ${view==="admin"?"active":""}`} onClick={()=>setView("admin")}>Coach Admin</button>
          </div>
        </nav>
        {view==="member"
          ? <MemberView allWorkouts={allWorkouts} periods={periods} results={results}
              updateResult={updateResult} getResult={getResult}
              getSessionMembers={getSessionMembers} memberRoster={memberRoster} />
          : adminAuth
            ? <AdminView periods={periods} activePeriod={activePeriod} activePeriodId={activePeriodId}
                setActivePeriodId={setActivePeriodId}
                updatePeriod={updatePeriod} addPeriod={addPeriod} deletePeriod={deletePeriod}
                addWorkout={addWorkout} updateWorkout={updateWorkout} deleteWorkout={deleteWorkout}
                results={results} updateResult={updateResult} getResult={getResult}
                sessionMembers={sessionMembers} setSessionMembersForWod={setSessionMembersForWod}
                getSessionMembers={getSessionMembers}
                memberRoster={memberRoster} setMemberRoster={setMemberRoster}
                onLogout={()=>{ setAdminAuth(false); save("cf_admin_auth",false); }} />
            : <LoginView onLogin={()=>{ setAdminAuth(true); save("cf_admin_auth",true); }} />
        }
      </div>
    </>
  );
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginView({ onLogin }) {
  const [user,setUser]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  const attempt=()=>{if(user==="Coach"&&pass==="Rigg123")onLogin();else setErr("Invalid credentials.");};
  return (
    <div className="login-wrap" style={{position:"relative",zIndex:1}}>
      <div className="login-card">
        <div className="text-center mb-4">
          <div style={{fontSize:"2.5rem",marginBottom:"8px"}}>⚡</div>
          <h2 style={{fontSize:"1.8rem",color:"#FF6B1A"}}>COACH ADMIN</h2>
          <p className="muted small mt-1">Restricted access</p>
        </div>
        <div className="mt-4"><label>Username</label>
          <input value={user} onChange={e=>setUser(e.target.value)} placeholder="Coach" onKeyDown={e=>e.key==="Enter"&&attempt()} />
        </div>
        <div className="mt-3"><label>Password</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&attempt()} />
        </div>
        {err&&<div style={{color:"#ff7070",fontSize:"0.82rem",marginTop:"10px"}}>{err}</div>}
        <button className="btn btn-primary w-full mt-4" style={{justifyContent:"center",padding:"12px"}} onClick={attempt}>Sign In →</button>
      </div>
    </div>
  );
}

// ─── ADMIN VIEW ────────────────────────────────────────────────────────────────
function AdminView({ periods, activePeriod, activePeriodId, setActivePeriodId,
  updatePeriod, addPeriod, deletePeriod, addWorkout, updateWorkout, deleteWorkout,
  results, updateResult, getResult, sessionMembers, setSessionMembersForWod,
  getSessionMembers, memberRoster, setMemberRoster, onLogout }) {

  const [tab, setTab] = useState("today");
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div className="page" style={{position:"relative",zIndex:1}}>
      <div className="flex-between mb-4">
        <div><h1 style={{fontSize:"2rem",color:"#FF6B1A"}}>COACH DASHBOARD</h1>
          <p className="muted small">Training management system</p></div>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>Log Out</button>
      </div>

      {/* Period bar */}
      <div className="card mb-4" style={{padding:"16px 20px"}}>
        <div className="flex-between mb-3">
          <h3 style={{fontSize:"1rem",color:"#FF6B1A"}}>Training Periods</h3>
          <button className="btn btn-primary btn-sm" onClick={addPeriod}>+ New Period</button>
        </div>
        <div className="period-list">
          {periods.map(p=>(
            <button key={p.id} className={`period-pill ${activePeriodId===p.id?"active":""}`}
              onClick={()=>{setActivePeriodId(p.id);setConfirmDel(false);}}>
              {p.name||"Unnamed Period"}
            </button>
          ))}
        </div>
        {activePeriod&&(
          <>
            <div className="grid-2 mt-3">
              <div><label>Period Name</label>
                <input value={activePeriod.name} onChange={e=>updatePeriod(activePeriod.id,{name:e.target.value})} placeholder="e.g. Spring Strength Block" /></div>
              <div><label>Focus / Theme</label>
                <input value={activePeriod.focus} onChange={e=>updatePeriod(activePeriod.id,{focus:e.target.value})} placeholder="e.g. Back Squat & Gymnastics" /></div>
              <div><label>Start Date</label>
                <input type="date" value={activePeriod.startDate||todayStr()} onChange={e=>updatePeriod(activePeriod.id,{startDate:e.target.value})} /></div>
              <div><label>Duration (weeks)</label>
                <input type="number" min="1" max="52" value={activePeriod.durationWeeks||8} onChange={e=>updatePeriod(activePeriod.id,{durationWeeks:Number(e.target.value)})} /></div>
            </div>
            <div className="flex-between mt-3">
              <p className="muted small">
                {activePeriod.startDate&&activePeriod.durationWeeks
                  ?`Ends: ${formatDate(addDays(activePeriod.startDate,(activePeriod.durationWeeks*7)-1))}`:""}
              </p>
              <div className="flex gap-2">
                {confirmDel&&<span style={{fontSize:"0.8rem",color:"#ff7070",alignSelf:"center"}}>Delete this period?</span>}
                <button className="btn btn-danger btn-sm" onClick={()=>{ if(confirmDel){deletePeriod(activePeriodId);setConfirmDel(false);}else setConfirmDel(true); }}>
                  {confirmDel?"Confirm Delete":"Delete Period"}
                </button>
                {confirmDel&&<button className="btn btn-ghost btn-sm" onClick={()=>setConfirmDel(false)}>Cancel</button>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {[["today","Today's Session"],["planner","Week Planner"],["members","Members"],["history","History"]].map(([k,l])=>(
          <button key={k} className={`admin-tab ${tab===k?"active":""}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {tab==="today"&&activePeriod&&(
        <TodayAdmin period={activePeriod} updateWorkout={updateWorkout} addWorkout={addWorkout}
          deleteWorkout={deleteWorkout} getResult={getResult} updateResult={updateResult}
          getSessionMembers={getSessionMembers} setSessionMembersForWod={setSessionMembersForWod}
          memberRoster={memberRoster} />
      )}
      {tab==="planner"&&activePeriod&&(
        <PlannerAdmin period={activePeriod} updateWorkout={updateWorkout} addWorkout={addWorkout} deleteWorkout={deleteWorkout}
          memberRoster={memberRoster} getSessionMembers={getSessionMembers} setSessionMembersForWod={setSessionMembersForWod} />
      )}
      {tab==="members"&&(
        <MembersAdmin memberRoster={memberRoster} setMemberRoster={setMemberRoster} />
      )}
      {tab==="history"&&(
        <HistoryAdmin periods={periods} getResult={getResult} getSessionMembers={getSessionMembers} />
      )}
    </div>
  );
}

// ─── TODAY ADMIN ───────────────────────────────────────────────────────────────
function TodayAdmin({ period, updateWorkout, addWorkout, deleteWorkout, getResult, updateResult, getSessionMembers, setSessionMembersForWod, memberRoster }) {
  const today = todayStr();
  const todayWods = period.workouts.filter(w=>w.date===today);
  const [editing, setEditing] = useState(null);

  const startNew = () => {
    const nums = period.workouts.map(w=>w.sessionNumber);
    const next = nums.length ? Math.max(...nums)+1 : 1;
    const wod = { ...EMPTY_WOD(), sessionNumber:next, date:today };
    addWorkout(period.id, wod);
    setEditing(wod.id);
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <div><div className="session-tag">📅 {formatDate(today)}</div>
          {period.focus&&<p className="muted small mt-1">Focus: {period.focus}</p>}</div>
        <button className="btn btn-primary" onClick={startNew}>+ New WoD</button>
      </div>
      {todayWods.length===0&&(
        <div className="card text-center" style={{padding:"40px"}}>
          <div style={{fontSize:"2rem",marginBottom:"8px"}}>💪</div>
          <p className="muted">No workout scheduled for today. Create one!</p>
        </div>
      )}
      {todayWods.map(wod=>(
        <WodEditor key={wod.id} wod={wod} periodId={period.id}
          isEditing={editing===wod.id} onEdit={()=>setEditing(editing===wod.id?null:wod.id)}
          onSave={w=>{updateWorkout(period.id,w);setEditing(null);}}
          onDelete={()=>{deleteWorkout(period.id,wod.id);if(editing===wod.id)setEditing(null);}}
          getResult={getResult} updateResult={updateResult}
          getSessionMembers={getSessionMembers} setSessionMembersForWod={setSessionMembersForWod}
          memberRoster={memberRoster} />
      ))}
    </div>
  );
}

// ─── WOD EDITOR ───────────────────────────────────────────────────────────────
function WodEditor({ wod, isEditing, onEdit, onSave, onDelete, getResult, updateResult, getSessionMembers, setSessionMembersForWod, memberRoster }) {
  const [local, setLocal] = useState(wod);
  const members = getSessionMembers(wod.id);
  useEffect(()=>setLocal(wod),[wod]);

  const addBlock=()=>{const n=["A","B","C","D"],u=local.blocks.map(b=>b.name),next=n.find(x=>!u.includes(x));if(!next)return;setLocal(p=>({...p,blocks:[...p.blocks,{name:next,description:"",variables:["Rounds"]}]}));};
  const removeBlock=(i)=>setLocal(p=>({...p,blocks:p.blocks.filter((_,j)=>j!==i)}));
  const updateBlock=(i,u)=>setLocal(p=>({...p,blocks:p.blocks.map((b,j)=>j===i?{...b,...u}:b)}));
  const toggleVar=(bi,v)=>{const b=local.blocks[bi],c=b.variables||[];updateBlock(bi,{variables:c.includes(v)?c.filter(x=>x!==v):[...c,v]});};
  const toggleMember=(name)=>{const cur=getSessionMembers(wod.id);if(cur.includes(name)){setSessionMembersForWod(wod.id,cur.filter(n=>n!==name));}else if(cur.length<16){setSessionMembersForWod(wod.id,[...cur,name]);}};

  return (
    <div className="card mb-4">
      <div className="flex-between mb-3" style={{flexWrap:"wrap",gap:"8px"}}>
        <div className="flex-center gap-3" style={{flexWrap:"wrap"}}>
          {isEditing
            ? <div style={{display:"flex",gap:"8px",alignItems:"flex-end",flexWrap:"wrap"}}>
                <div style={{width:"110px"}}>
                  <label style={{marginBottom:"3px"}}>Session #</label>
                  <input type="number" value={local.sessionNumber} onChange={e=>setLocal(p=>({...p,sessionNumber:Number(e.target.value)}))} style={{padding:"5px 8px",fontSize:"0.88rem"}} />
                </div>
                <div style={{flex:1,minWidth:"180px"}}>
                  <label style={{marginBottom:"3px"}}>WoD Title</label>
                  <input value={local.title} onChange={e=>setLocal(p=>({...p,title:e.target.value}))} placeholder="WoD Title" style={{padding:"5px 10px",fontSize:"0.9rem"}} />
                </div>
              </div>
            : <><span className="session-tag">Session #{wod.sessionNumber}</span><h3 style={{fontSize:"1.1rem"}}>{wod.title||"Untitled WoD"}</h3></>
          }
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>{isEditing?"Cancel":"Edit"}</button>
          {isEditing&&<button className="btn btn-primary btn-sm" onClick={()=>onSave(local)}>Save</button>}
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
        </div>
      </div>

      {isEditing?(
        <>
          {local.blocks.map((block,idx)=>(
            <div key={idx} className="card card-orange mb-3">
              <div className="flex-between mb-2">
                <div className="flex-center gap-2">
                  <div className="block-badge" style={{background:BLOCK_COLORS[block.name]||"#FF6B1A",color:"#fff"}}>{block.name}</div>
                  <span style={{fontWeight:600}}>Block {block.name}</span>
                </div>
                <button className="btn btn-danger btn-xs" onClick={()=>removeBlock(idx)}>Remove</button>
              </div>
              <textarea value={block.description} onChange={e=>updateBlock(idx,{description:e.target.value})} placeholder="Describe the block…" style={{marginBottom:"10px"}} />
              <div><label>Result Variables</label>
                <div className="flex flex-wrap gap-2">
                  {RESULT_VARS.map(v=>(
                    <label key={v} className="check-var">
                      <input type="checkbox" checked={(block.variables||[]).includes(v)} onChange={()=>toggleVar(idx,v)} />{v}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {local.blocks.length<4&&<button className="btn btn-ghost btn-sm mb-4" onClick={addBlock}>+ Add Block</button>}
        </>
      ):(
        <div className="mb-4">
          {wod.blocks.map((block,idx)=>(
            <div key={idx} style={{marginBottom:"12px",paddingLeft:"12px",borderLeft:`3px solid ${BLOCK_COLORS[block.name]||"#FF6B1A"}`}}>
              <div className="flex-center gap-2 mb-1">
                <div className="block-badge" style={{background:BLOCK_COLORS[block.name]||"#FF6B1A",color:"#fff",width:"22px",height:"22px",fontSize:"0.8rem"}}>{block.name}</div>
                <span style={{fontWeight:700,fontSize:"0.9rem"}}>Block {block.name}</span>
              </div>
              <pre style={{fontFamily:"'Barlow',sans-serif",fontSize:"0.85rem",color:"#c8bfb0",whiteSpace:"pre-wrap",lineHeight:1.5}}>{block.description}</pre>
            </div>
          ))}
        </div>
      )}

      {/* Participant management */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:"16px",marginTop:"8px"}}>
        <h4 style={{fontSize:"0.9rem",marginBottom:"10px",color:"#FF6B1A"}}>Class Participants ({members.length}/16)</h4>
        <div className="flex flex-wrap gap-2 mb-4">
          {memberRoster.map(name=>(
            <button key={name}
              className={`member-pill ${members.includes(name)?"active":""}`}
              onClick={()=>toggleMember(name)}
              disabled={!members.includes(name)&&members.length>=16}
              style={!members.includes(name)&&members.length>=16?{opacity:0.35,cursor:"not-allowed"}:{}}>
              {members.includes(name)?"✓ ":""}{name}
            </button>
          ))}
        </div>
      </div>

      {/* Results per block */}
      {members.length>0&&wod.blocks.map((block,bi)=>(
        <div key={bi} style={{marginBottom:"20px"}}>
          <div className="flex-center gap-2 mb-2">
            <div className="block-badge" style={{background:BLOCK_COLORS[block.name]||"#FF6B1A",color:"#fff",width:"22px",height:"22px",fontSize:"0.8rem"}}>{block.name}</div>
            <span style={{fontWeight:600,fontSize:"0.88rem"}}>Block {block.name} Results</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="results-table">
              <thead><tr><th>Member</th>{(block.variables||[]).map(v=><th key={v}>{v}</th>)}</tr></thead>
              <tbody>
                {members.map(member=>(
                  <tr key={member}>
                    <td style={{fontWeight:600,fontSize:"0.87rem"}}>{member}</td>
                    {(block.variables||[]).map(v=>(
                      <td key={v}><input value={getResult(wod.id,block.name,member,v)} onChange={e=>updateResult(wod.id,block.name,member,v,e.target.value)} placeholder="—" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MEMBERS ADMIN ─────────────────────────────────────────────────────────────
function MembersAdmin({ memberRoster, setMemberRoster }) {
  const [newName, setNewName] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState("");

  const addMember = () => {
    const n = newName.trim();
    if (!n || memberRoster.includes(n) || memberRoster.length >= 30) return;
    setMemberRoster([...memberRoster, n]);
    setNewName("");
  };

  const deleteMember = (name) => {
    if (confirmDel === name) { setMemberRoster(memberRoster.filter(n => n !== name)); setConfirmDel(null); }
    else { setConfirmDel(name); setEditingIdx(null); }
  };

  const startEdit = (i) => {
    setEditingIdx(i);
    setEditValue(memberRoster[i]);
    setConfirmDel(null);
  };

  const saveEdit = (i) => {
    const trimmed = editValue.trim();
    if (!trimmed) { setEditingIdx(null); return; }
    // don't allow duplicate names (ignore current position)
    if (memberRoster.some((n, idx) => n === trimmed && idx !== i)) { setEditingIdx(null); return; }
    const updated = [...memberRoster];
    updated[i] = trimmed;
    setMemberRoster(updated);
    setEditingIdx(null);
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h3 style={{fontSize:"1.1rem"}}>Member Roster</h3>
          <p className="muted small mt-1">{memberRoster.length}/30 members · Max 16 per class session</p>
        </div>
      </div>

      {/* Add member */}
      {memberRoster.length < 30 ? (
        <div className="card mb-4" style={{padding:"16px 20px"}}>
          <label>Add New Member</label>
          <div className="flex gap-3 mt-2">
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Enter full name…"
              onKeyDown={e=>e.key==="Enter"&&addMember()} style={{maxWidth:"300px"}} />
            <button className="btn btn-primary btn-sm" onClick={addMember}>Add</button>
          </div>
        </div>
      ) : (
        <div className="card mb-4 card-orange" style={{padding:"12px 16px"}}>
          <p style={{fontSize:"0.85rem",color:"#FF9A4D"}}>Maximum of 30 members reached.</p>
        </div>
      )}

      {/* Roster grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"8px"}}>
        {memberRoster.map((name, i) => (
          <div key={i} className="card" style={{padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
            <div className="flex-center gap-2" style={{flex:1,minWidth:0}}>
              <div style={{width:"24px",height:"24px",borderRadius:"50%",background:"rgba(255,107,26,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",fontWeight:700,color:"#FF6B1A",flexShrink:0}}>{i+1}</div>
              {editingIdx === i ? (
                <input
                  value={editValue}
                  onChange={e=>setEditValue(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") saveEdit(i); if(e.key==="Escape") setEditingIdx(null); }}
                  autoFocus
                  style={{padding:"3px 8px",fontSize:"0.88rem",flex:1}}
                />
              ) : (
                <span style={{fontWeight:600,fontSize:"0.9rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
              )}
            </div>

            <div className="flex gap-1" style={{flexShrink:0}}>
              {editingIdx === i ? (
                <>
                  <button className="btn btn-primary btn-xs" onClick={()=>saveEdit(i)}>✓</button>
                  <button className="btn btn-ghost btn-xs" onClick={()=>setEditingIdx(null)}>✕</button>
                </>
              ) : confirmDel === name ? (
                <>
                  <button className="btn btn-danger btn-xs" onClick={()=>deleteMember(name)}>Delete</button>
                  <button className="btn btn-ghost btn-xs" onClick={()=>setConfirmDel(null)}>No</button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost btn-xs" onClick={()=>startEdit(i)} style={{color:"#c8bfb0"}}>✎</button>
                  <button className="btn btn-ghost btn-xs" onClick={()=>deleteMember(name)} style={{color:"#ff7070"}}>✕</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PLANNER ADMIN ─────────────────────────────────────────────────────────────
function PlannerAdmin({ period, updateWorkout, addWorkout, deleteWorkout, memberRoster, getSessionMembers, setSessionMembersForWod }) {
  const today = todayStr();
  const periodMonday = getMondayOfWeek(period.startDate || today);
  const totalWeeks = period.durationWeeks || 8;
  const [weekOffset, setWeekOffset] = useState(()=>{
    const todayM=getMondayOfWeek(today);
    const diff=Math.round((new Date(todayM+"T12:00:00")-new Date(periodMonday+"T12:00:00"))/(7*24*3600*1000));
    return Math.max(0,Math.min(totalWeeks-1,diff));
  });
  const [selDate, setSelDate] = useState(null);
  const [editWod, setEditWod] = useState(null);
  const [modalTab, setModalTab] = useState("wod"); // "wod" | "participants"

  const weekStart = addDays(periodMonday, weekOffset*7);
  const weekDates = getWeekDates(weekStart);
  const wodForDate=(date)=>period.workouts.find(w=>w.date===date);

  const openDay=(date)=>{
    setSelDate(date);
    setModalTab("wod");
    const ex=wodForDate(date);
    if(ex){setEditWod({...ex,blocks:ex.blocks.map(b=>({...b}))});}
    else{const nums=period.workouts.map(w=>w.sessionNumber);setEditWod({...EMPTY_WOD(),date,sessionNumber:nums.length?Math.max(...nums)+1:1});}
  };
  const saveWod=()=>{
    const ex=wodForDate(selDate);
    if(ex)updateWorkout(period.id,editWod);else addWorkout(period.id,editWod);
    setSelDate(null);setEditWod(null);
  };
  const deleteDay=()=>{
    const ex=wodForDate(selDate);
    if(ex){deleteWorkout(period.id,ex.id);setSessionMembersForWod(ex.id,[]);}
    setSelDate(null);setEditWod(null);
  };

  // Participants for the currently-open modal (use wodId if exists, else use selDate as temp key)
  const currentWodId = editWod?.id;
  const sessionMems = currentWodId ? getSessionMembers(currentWodId) : [];
  const toggleParticipant = (name) => {
    if (!currentWodId) return;
    const cur = getSessionMembers(currentWodId);
    if (cur.includes(name)) setSessionMembersForWod(currentWodId, cur.filter(n=>n!==name));
    else if (cur.length < 16) setSessionMembersForWod(currentWodId, [...cur, name]);
  };

  const allWeeks=Array.from({length:totalWeeks},(_,i)=>getWeekDates(addDays(periodMonday,i*7)));

  return (
    <div>
      <div className="flex-between mb-4">
        <h3 style={{fontSize:"1.2rem"}}>Week {weekOffset+1} of {totalWeeks}</h3>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(w=>Math.max(0,w-1))} disabled={weekOffset<=0}>← Prev</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{const d=getMondayOfWeek(today);const diff=Math.round((new Date(d+"T12:00:00")-new Date(periodMonday+"T12:00:00"))/(7*24*3600*1000));setWeekOffset(Math.max(0,Math.min(totalWeeks-1,diff)));}}>This Week</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(w=>Math.min(totalWeeks-1,w+1))} disabled={weekOffset>=totalWeeks-1}>Next →</button>
        </div>
      </div>

      {/* Week grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"8px",marginBottom:"32px"}}>
        {weekDates.map((date,i)=>{
          const wod=wodForDate(date); const d=new Date(date+"T12:00:00");
          const participants = wod ? getSessionMembers(wod.id) : [];
          return (
            <div key={date} className={`week-day-card ${date===today?"today-card":""} ${wod?"has-wod-card":""}`} onClick={()=>openDay(date)}>
              <div style={{fontSize:"0.72rem",color:"#8a7a6a",fontWeight:700,textTransform:"uppercase",marginBottom:"4px"}}>{DAYS[i]}</div>
              <div style={{fontSize:"1.2rem",fontWeight:700,marginBottom:"6px"}}>{d.getDate()}</div>
              {wod ? (
                <>
                  <div className="session-tag" style={{fontSize:"0.68rem",padding:"2px 7px"}}>#{wod.sessionNumber}</div>
                  <div style={{fontSize:"0.75rem",marginTop:"4px",color:"#c8bfb0"}}>{wod.title||"WoD"}</div>
                  <div style={{marginTop:"6px",display:"flex",gap:"3px"}}>
                    {wod.blocks.map(b=><span key={b.name} style={{width:"12px",height:"12px",borderRadius:"3px",background:BLOCK_COLORS[b.name]||"#FF6B1A",display:"inline-block"}}/>)}
                  </div>
                  {participants.length > 0 && (
                    <div style={{marginTop:"6px",fontSize:"0.68rem",color:"#FF9A4D"}}>
                      👥 {participants.length}/16
                    </div>
                  )}
                </>
              ) : (
                <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.2)",marginTop:"8px"}}>+ Add WoD</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 8-week overview */}
      <div className="section-header">
        <h4 style={{fontSize:"0.85rem",color:"#8a7a6a",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.08em"}}>{totalWeeks}-WEEK OVERVIEW</h4>
        <div className="section-line"/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"32px"}}>
        {allWeeks.map((week,wi)=>{
          const wods=week.filter(d=>wodForDate(d));
          const s=new Date(week[0]+"T12:00:00"),e=new Date(week[6]+"T12:00:00");
          return (
            <div key={wi} className={`card ${weekOffset===wi?"card-orange":""}`} style={{padding:"10px 16px",cursor:"pointer"}} onClick={()=>setWeekOffset(wi)}>
              <div className="flex-between">
                <span style={{fontSize:"0.82rem",fontWeight:600}}>Week {wi+1}: {s.getDate()} {MONTHS[s.getMonth()].slice(0,3)} – {e.getDate()} {MONTHS[e.getMonth()].slice(0,3)}</span>
                <div className="flex gap-2">
                  <div style={{display:"flex",gap:"3px",alignItems:"center"}}>
                    {week.map(d=>{const w=wodForDate(d);return <span key={d} style={{width:"8px",height:"8px",borderRadius:"2px",background:w?"#FF6B1A":"rgba(255,255,255,0.1)",display:"inline-block"}}/>;})}</div>
                  <span className="muted small">{wods.length} session{wods.length!==1?"s":""}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Day modal */}
      {selDate&&editWod&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&(setSelDate(null),setEditWod(null))}>
          <div className="modal-inner">
            {/* Modal header */}
            <div className="flex-between mb-3">
              <h3 style={{color:"#FF6B1A"}}>{formatDate(selDate)}</h3>
              <div className="flex gap-2">
                <button className="btn btn-danger btn-sm" onClick={deleteDay}>Delete</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>{setSelDate(null);setEditWod(null);}}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={saveWod}>Save</button>
              </div>
            </div>

            {/* Modal tabs */}
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.07)",marginBottom:"18px"}}>
              {[["wod","WoD"],["participants",`Participants (${sessionMems.length}/16)`]].map(([k,l])=>(
                <button key={k}
                  style={{padding:"7px 16px",border:"none",background:"transparent",cursor:"pointer",
                    color:modalTab===k?"#FF6B1A":"#8a7a6a",fontFamily:"'Barlow',sans-serif",fontSize:"0.85rem",
                    fontWeight:600,borderBottom:modalTab===k?"2px solid #FF6B1A":"2px solid transparent",
                    marginBottom:"-1px",transition:"all 0.15s"}}
                  onClick={()=>setModalTab(k)}>{l}</button>
              ))}
            </div>

            {/* WoD tab */}
            {modalTab==="wod" && (
              <>
                <div className="grid-2 mb-3">
                  <div><label>WoD Title</label><input value={editWod.title} onChange={e=>setEditWod(p=>({...p,title:e.target.value}))} placeholder="Session name" /></div>
                  <div><label>Session #</label><input type="number" value={editWod.sessionNumber} onChange={e=>setEditWod(p=>({...p,sessionNumber:Number(e.target.value)}))} /></div>
                </div>
                {editWod.blocks.map((block,idx)=>(
                  <div key={idx} className="card card-orange mb-3">
                    <div className="flex-between mb-2">
                      <span style={{fontWeight:700,color:BLOCK_COLORS[block.name]||"#FF6B1A"}}>Block {block.name}</span>
                      <button className="btn btn-danger btn-xs" onClick={()=>setEditWod(p=>({...p,blocks:p.blocks.filter((_,i)=>i!==idx)}))}>✕</button>
                    </div>
                    <textarea value={block.description} onChange={e=>setEditWod(p=>({...p,blocks:p.blocks.map((b,i)=>i===idx?{...b,description:e.target.value}:b)}))} placeholder="Block description…" style={{marginBottom:"8px"}} />
                    <div className="flex flex-wrap gap-2">
                      {RESULT_VARS.map(v=>(
                        <label key={v} className="check-var">
                          <input type="checkbox" checked={(block.variables||[]).includes(v)}
                            onChange={()=>setEditWod(p=>({...p,blocks:p.blocks.map((b,i)=>i===idx?{...b,variables:(b.variables||[]).includes(v)?b.variables.filter(x=>x!==v):[...(b.variables||[]),v]}:b)}))} />{v}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {editWod.blocks.length<4&&(
                  <button className="btn btn-ghost btn-sm" onClick={()=>{const n=["A","B","C","D"],u=editWod.blocks.map(b=>b.name),next=n.find(x=>!u.includes(x));if(next)setEditWod(p=>({...p,blocks:[...p.blocks,{name:next,description:"",variables:["Rounds"]}]}));}}>+ Add Block</button>
                )}
              </>
            )}

            {/* Participants tab */}
            {modalTab==="participants" && (
              <div>
                <div className="flex-between mb-3">
                  <p style={{fontSize:"0.85rem",color:"#c8bfb0"}}>Select up to 16 participants for this session.</p>
                  {sessionMems.length > 0 && (
                    <button className="btn btn-ghost btn-xs" onClick={()=>setSessionMembersForWod(currentWodId,[])}>Clear all</button>
                  )}
                </div>

                {memberRoster.length === 0 ? (
                  <p className="muted small">No members in roster yet. Add members in the Members tab first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {memberRoster.map(name => {
                      const isIn = sessionMems.includes(name);
                      const isFull = !isIn && sessionMems.length >= 16;
                      return (
                        <button key={name}
                          className={`member-pill ${isIn?"active":""}`}
                          onClick={()=>toggleParticipant(name)}
                          disabled={isFull}
                          style={isFull?{opacity:0.35,cursor:"not-allowed"}:{}}>
                          {isIn ? "✓ " : ""}{name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {sessionMems.length > 0 && (
                  <div style={{marginTop:"16px",paddingTop:"14px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                    <p style={{fontSize:"0.75rem",color:"#8a7a6a",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>
                      Registered ({sessionMems.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sessionMems.map(name=>(
                        <span key={name} style={{padding:"4px 10px",borderRadius:"20px",background:"rgba(255,107,26,0.12)",border:"1px solid rgba(255,107,26,0.25)",color:"#FF9A4D",fontSize:"0.8rem",fontWeight:600}}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HISTORY ADMIN ─────────────────────────────────────────────────────────────
function HistoryAdmin({ periods, getResult, getSessionMembers }) {
  const [selPeriod,setSelPeriod]=useState(periods[0]?.id);
  const [selWod,setSelWod]=useState(null);
  const today=todayStr();
  const period=periods.find(p=>p.id===selPeriod);
  const past=period?[...period.workouts].filter(w=>w.date<=today).sort((a,b)=>b.date.localeCompare(a.date)):[];
  const wod=past.find(w=>w.id===selWod);
  return (
    <div>
      <div className="period-list mb-4">
        {periods.map(p=><button key={p.id} className={`period-pill ${selPeriod===p.id?"active":""}`} onClick={()=>{setSelPeriod(p.id);setSelWod(null);}}>{p.name||"Unnamed"}</button>)}
      </div>
      <div className="grid-2">
        <div>
          <h4 style={{fontSize:"0.88rem",color:"#8a7a6a",marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Past Sessions</h4>
          {past.length===0&&<p className="muted small">No past sessions yet.</p>}
          {past.map(w=>(
            <div key={w.id} className={`card mb-2 ${selWod===w.id?"card-orange":""}`} style={{cursor:"pointer",padding:"12px 16px"}} onClick={()=>setSelWod(w.id)}>
              <div className="flex-between">
                <div><span className="session-tag" style={{fontSize:"0.72rem"}}>#{w.sessionNumber}</span><span style={{marginLeft:"8px",fontWeight:600,fontSize:"0.9rem"}}>{w.title||"WoD"}</span></div>
                <span className="muted small">{formatDate(w.date)}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          {wod?(
            <div>
              <h4 style={{fontSize:"0.88rem",color:"#8a7a6a",marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Session #{wod.sessionNumber} Results</h4>
              <p style={{fontSize:"0.82rem",marginBottom:"12px",color:"#c8bfb0"}}>{formatDate(wod.date)}</p>
              {wod.blocks.map((block,bi)=>{
                const mems=getSessionMembers(wod.id);
                return (
                  <div key={bi} className="card mb-3">
                    <div className="flex-center gap-2 mb-2">
                      <div className="block-badge" style={{background:BLOCK_COLORS[block.name]||"#FF6B1A",color:"#fff",width:"22px",height:"22px",fontSize:"0.8rem"}}>{block.name}</div>
                      <span style={{fontWeight:600}}>Block {block.name}</span>
                    </div>
                    {mems.length===0?<p className="muted small">No participants recorded.</p>:(
                      <div style={{overflowX:"auto"}}>
                        <table className="results-table">
                          <thead><tr><th>Member</th>{(block.variables||[]).map(v=><th key={v}>{v}</th>)}</tr></thead>
                          <tbody>
                            {mems.map(m=>(
                              <tr key={m}><td style={{fontWeight:600,fontSize:"0.87rem"}}>{m}</td>
                                {(block.variables||[]).map(v=><td key={v} style={{color:getResult(wod.id,block.name,m,v)?undefined:"#555"}}>{getResult(wod.id,block.name,m,v)||"—"}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ):<div className="card text-center" style={{padding:"40px"}}><p className="muted">Select a session to view results</p></div>}
        </div>
      </div>
    </div>
  );
}

// ─── MEMBER VIEW ───────────────────────────────────────────────────────────────
function MemberView({ allWorkouts, periods, results, updateResult, getResult, getSessionMembers, memberRoster }) {
  const today = todayStr();
  const todayMonday = getMondayOfWeek(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [memberName, setMemberName] = useState("");
  const [showNameSelect, setShowNameSelect] = useState(false);
  const [savedResults, setSavedResults] = useState({});
  const [calMonth, setCalMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  const weekStart = addDays(todayMonday, weekOffset * 7);
  const weekDates = getWeekDates(weekStart);

  // When week offset changes, anchor selected date
  useEffect(() => {
    if (!weekDates.includes(selectedDate)) {
      const todayInWeek = weekDates.includes(today);
      const firstWod = weekDates.find(d => allWorkouts.some(w=>w.date===d));
      setSelectedDate(todayInWeek ? today : (firstWod || weekDates[0]));
    }
  }, [weekOffset]);

  const wodForDate = (date) => allWorkouts.find(w=>w.date===date);
  const wod = wodForDate(selectedDate);
  const period = periods.find(p=>p.workouts.some(w=>w.id===wod?.id));
  const sessionMems = wod ? getSessionMembers(wod.id) : [];
  const isMemberInSession = !!(wod && memberName && sessionMems.includes(memberName));
  const hasSaved = wod && memberName ? !!savedResults[`${wod.id}_${memberName}`] : false;

  const touchStart = useRef(null);
  const handleTouchStart = e => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = e => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    const ci = weekDates.indexOf(selectedDate);
    if (dx > 60 && ci > 0) setSelectedDate(weekDates[ci-1]);
    else if (dx < -60 && ci < 6) setSelectedDate(weekDates[ci+1]);
    touchStart.current = null;
  };

  // Calendar helpers
  const calDays=()=>{
    const first=new Date(calMonth.year,calMonth.month,1);
    const last=new Date(calMonth.year,calMonth.month+1,0);
    const startDay=first.getDay()===0?6:first.getDay()-1;
    const days=[];
    for(let i=0;i<startDay;i++) days.push(null);
    for(let d=1;d<=last.getDate();d++) days.push(d);
    return days;
  };
  const calDateStr=d=>{
    if(!d) return null;
    return `${calMonth.year}-${String(calMonth.month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  };

  const jumpToDate = (ds) => {
    setSelectedDate(ds);
    const newMonday = getMondayOfWeek(ds);
    const diff = Math.round((new Date(newMonday+"T12:00:00")-new Date(todayMonday+"T12:00:00"))/(7*24*3600*1000));
    setWeekOffset(diff);
  };

  return (
    <div className="page" style={{position:"relative",zIndex:1,maxWidth:"780px"}}>
      {/* Header */}
      <div style={{textAlign:"center",marginBottom:"24px"}}>
        <div className="muted small" style={{textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"4px"}}>
          {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
        </div>
        <h1 style={{fontSize:"3rem",lineHeight:1,color:"#FF6B1A"}}>WORKOUT<br/>OF THE DAY</h1>
        {period&&<p className="muted small mt-2">{period.name}{period.focus?` · ${period.focus}`:""}</p>}
      </div>

      {/* Week navigation + day strip */}
      <div style={{marginBottom:"16px"}}>
        <div className="flex-between mb-2">
          <button className="wod-nav-btn" onClick={()=>setWeekOffset(w=>w-1)}>← Week</button>
          <span style={{fontSize:"0.82rem",color:"#8a7a6a",fontWeight:600}}>
            {new Date(weekDates[0]+"T12:00:00").getDate()} {MONTHS[new Date(weekDates[0]+"T12:00:00").getMonth()].slice(0,3)} – {new Date(weekDates[6]+"T12:00:00").getDate()} {MONTHS[new Date(weekDates[6]+"T12:00:00").getMonth()].slice(0,3)}
          </span>
          <button className="wod-nav-btn" onClick={()=>setWeekOffset(w=>w+1)}>Week →</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"4px"}}>
          {weekDates.map((date,i)=>{
            const hasWod=!!wodForDate(date);
            const isSel=date===selectedDate;
            const isTod=date===today;
            return (
              <button key={date} onClick={()=>setSelectedDate(date)} style={{
                padding:"8px 4px",borderRadius:"8px",border:"none",cursor:"pointer",
                background:isSel?"#FF6B1A":isTod?"rgba(255,107,26,0.2)":"rgba(255,255,255,0.04)",
                color:isSel?"#fff":isTod?"#FF6B1A":"#f0ebe3",
                transition:"all 0.15s",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"
              }}>
                <span style={{fontSize:"0.65rem",fontWeight:700,opacity:0.7}}>{DAYS[i].slice(0,1)}</span>
                <span style={{fontSize:"0.9rem",fontWeight:700}}>{new Date(date+"T12:00:00").getDate()}</span>
                <span style={{width:"5px",height:"5px",borderRadius:"50%",background:hasWod?(isSel?"#fff":"#FF6B1A"):"transparent",display:"block"}}/>
              </button>
            );
          })}
        </div>
      </div>

      {/* WoD card or empty state */}
      {wod ? (
        <div className="card mb-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="flex-between mb-3">
            <div>
              <span className="session-tag">Session #{wod.sessionNumber}</span>
              <h3 style={{fontSize:"1.2rem",marginTop:"6px"}}>{wod.title||"WoD"}</h3>
            </div>
            <div style={{textAlign:"right",fontSize:"0.8rem",fontWeight:600,color:selectedDate===today?"#FF6B1A":"#8a7a6a"}}>
              {selectedDate===today?"● TODAY":selectedDate>today?"Upcoming":"Past session"}
            </div>
          </div>
          {wod.blocks.map((block,bi)=>(
            <div key={bi} style={{marginBottom:bi<wod.blocks.length-1?"24px":0,paddingBottom:bi<wod.blocks.length-1?"24px":0,borderBottom:bi<wod.blocks.length-1?"1px solid rgba(255,255,255,0.06)":undefined}}>
              <div className="flex-center gap-3 mb-2">
                <div className="block-badge" style={{background:BLOCK_COLORS[block.name]||"#FF6B1A",color:"#fff"}}>{block.name}</div>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"1.1rem",letterSpacing:"0.04em"}}>BLOCK {block.name}</span>
              </div>
              <pre style={{fontFamily:"'Barlow',sans-serif",fontSize:"0.95rem",whiteSpace:"pre-wrap",lineHeight:1.7,color:"#e0d8ce",paddingLeft:"40px"}}>{block.description}</pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center mb-4" style={{padding:"32px"}}>
          <div style={{fontSize:"2rem",marginBottom:"8px"}}>🗓️</div>
          <p className="muted">No session planned for {formatDate(selectedDate)}</p>
          <p className="muted small mt-2">Use the arrows above to browse the week, or tap a date in the calendar below.</p>
        </div>
      )}

      {/* Member selector — below WoD, only when there's a WoD */}
      {wod && (
        <div className="card mb-4" style={{padding:"14px 18px"}}>
          <div className="flex-between">
            <div>
              <div style={{fontSize:"0.75rem",color:"#8a7a6a",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px"}}>Who are you?</div>
              <div style={{fontWeight:600,fontSize:"0.95rem"}}>{memberName||"Select your name to log results"}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowNameSelect(p=>!p)}>{showNameSelect?"Done":"Select"}</button>
          </div>
          {showNameSelect&&(
            <div className="flex flex-wrap gap-2 mt-3">
              {memberRoster.map(n=>(
                <button key={n} className={`member-pill ${memberName===n?"active":""}`}
                  onClick={()=>{setMemberName(n);setShowNameSelect(false);}}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results entry (hidden after save) */}
      {wod&&memberName&&!hasSaved&&(
        <div className="card mb-4" style={{border:"1px solid rgba(255,107,26,0.25)"}}>
          <div className="flex-between mb-3">
            <h3 style={{fontSize:"1rem",color:"#FF6B1A"}}>Log Your Results — {memberName}</h3>
            {!isMemberInSession&&<span className="muted small" style={{fontSize:"0.72rem"}}>(Not in today's class list)</span>}
          </div>
          {wod.blocks.map((block,bi)=>(
            <div key={bi} style={{marginBottom:"16px"}}>
              <div className="flex-center gap-2 mb-2">
                <div className="block-badge" style={{background:BLOCK_COLORS[block.name]||"#FF6B1A",color:"#fff",width:"22px",height:"22px",fontSize:"0.78rem"}}>{block.name}</div>
                <span style={{fontWeight:600,fontSize:"0.88rem"}}>Block {block.name}</span>
              </div>
              <div className="grid-2">
                {(block.variables||[]).map(v=>(
                  <div key={v}><label>{v}</label>
                    <input value={getResult(wod.id,block.name,memberName,v)}
                      onChange={e=>updateResult(wod.id,block.name,memberName,v,e.target.value)}
                      placeholder={`Enter ${v.toLowerCase()}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-primary mt-2 w-full" style={{justifyContent:"center"}} onClick={()=>setSavedResults(p=>({...p,[`${wod.id}_${memberName}`]:true}))}>
            ✓ Save My Results
          </button>
        </div>
      )}

      {/* Saved confirmation */}
      {wod&&memberName&&hasSaved&&(
        <div className="card mb-4" style={{border:"1px solid rgba(80,200,80,0.2)",background:"rgba(80,200,80,0.04)",padding:"14px 18px",textAlign:"center"}}>
          <div style={{color:"#7dde7d",fontWeight:600}}>✓ Results saved — great work, {memberName}!</div>
          <button className="btn btn-ghost btn-xs mt-2" onClick={()=>setSavedResults(p=>({...p,[`${wod.id}_${memberName}`]:false}))}>Edit</button>
        </div>
      )}

      {/* Class results table */}
      {wod&&sessionMems.length>0&&(
        <div className="mb-6">
          <div className="section-header mb-3">
            <h4 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1rem",letterSpacing:"0.08em",color:"#8a7a6a"}}>CLASS RESULTS</h4>
            <div className="section-line"/>
          </div>
          {wod.blocks.map((block,bi)=>(
            <div key={bi} className="card mb-3">
              <div className="flex-center gap-2 mb-2">
                <div className="block-badge" style={{background:BLOCK_COLORS[block.name]||"#FF6B1A",color:"#fff",width:"22px",height:"22px",fontSize:"0.78rem"}}>{block.name}</div>
                <span style={{fontWeight:600,fontSize:"0.88rem"}}>Block {block.name}</span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table className="results-table">
                  <thead><tr><th>Member</th>{(block.variables||[]).map(v=><th key={v}>{v}</th>)}</tr></thead>
                  <tbody>
                    {sessionMems.map(m=>(
                      <tr key={m}>
                        <td style={{fontWeight:600,fontSize:"0.87rem",color:m===memberName?"#FF6B1A":undefined}}>{m}{m===memberName?" ★":""}</td>
                        {(block.variables||[]).map(v=><td key={v} style={{color:getResult(wod.id,block.name,m,v)?undefined:"#444"}}>{getResult(wod.id,block.name,m,v)||"—"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mini calendar */}
      <div className="card">
        <div className="flex-between mb-3">
          <button className="btn btn-ghost btn-xs" onClick={()=>setCalMonth(m=>({...m,month:m.month===0?11:m.month-1,year:m.month===0?m.year-1:m.year}))}>←</button>
          <h4 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1rem",letterSpacing:"0.06em"}}>{MONTHS[calMonth.month]} {calMonth.year}</h4>
          <button className="btn btn-ghost btn-xs" onClick={()=>setCalMonth(m=>({...m,month:m.month===11?0:m.month+1,year:m.month===11?m.year+1:m.year}))}>→</button>
        </div>
        <div className="cal-grid mb-2">
          {["M","T","W","T","F","S","S"].map((d,i)=>(
            <div key={i} style={{textAlign:"center",fontSize:"0.7rem",color:"#8a7a6a",fontWeight:700,padding:"4px 0"}}>{d}</div>
          ))}
        </div>
        <div className="cal-grid">
          {calDays().map((d,i)=>{
            const ds=calDateStr(d);
            const hasWod=ds?allWorkouts.some(w=>w.date===ds):false;
            const isTod=ds===today;
            const isSel=ds===selectedDate;
            return (
              <div key={i}
                className={`cal-day ${hasWod?"has-wod":""} ${isTod?"is-today":""} ${isSel&&!isTod?"is-selected":""} ${!d?"other-month":""}`}
                onClick={()=>{ if(d&&ds) jumpToDate(ds); }}>
                {d&&<><span>{d}</span>{hasWod&&<div className="cal-dot"/>}</>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
