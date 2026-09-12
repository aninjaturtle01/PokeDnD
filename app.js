const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const STORAGE_KEY = 'pokemonD20CompanionV024Premade';
const VERSION = '0.2.4-premade';
const abilities = [
  ['Strength','STR'],['Dexterity','DEX'],['Constitution','CON'],['Intelligence','INT'],['Wisdom','WIS'],['Charisma','CHA']
];
const statKeys = [
  ['attack','ATK'],['defense','DEF'],['spAttack','SP.A'],['spDefense','SP.D'],['speed','SPD']
];
const typeOrder = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
const dexRank = {undiscovered:0,seen:1,scanned:2,caught:3};
const navItems = [
  ['home','⌂','Home'],['trainer','◆','Trainer'],['party','●','Party'],['pokedex','▦','Pokédex'],['moves','✦','Moves'],['bag','▣','Bag']
];

let DATA = {};
let state = loadState();
let ui = {route:'home', creatorStep:1, creatorDraft:null, bagTab:'inventory', dexSearch:'', dexType:'All', dexState:'All', moveSearch:'', moveType:'All', moveKind:'All', bagSearch:'', shopCategory:'All'};

function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(s && Array.isArray(s.trainers)) return s;
  }catch(e){}
  return {version:VERSION, activeTrainerId:null, trainers:[]};
}
function saveState(){ state.version=VERSION; localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function uid(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function fmtMod(n){ n=Number(n)||0; return n>=0?`+${n}`:`${n}`; }
function abilityMod(score){return Math.floor((Number(score)-10)/2);}
function trainerProf(level){return level>=5?3:2;}
function pokemonProf(level){if(level>=17)return 6;if(level>=13)return 5;if(level>=9)return 4;if(level>=5)return 3;return 2;}
function maxPokemonHP(species,level){return 10+Math.floor(species.baseHP/5)+Math.floor(level*(2+species.baseHP/50));}
function currentTrainer(){return state.trainers.find(t=>t.id===state.activeTrainerId)||state.trainers[0]||null;}
function speciesById(id){return DATA.pokemon.find(p=>p.id===Number(id));}
function naturalLearnset(sp){return sp?.naturalLearnset || (sp?.naturalMoves||[]).map(name=>({name,gameLevel:1,unlockLevel:1}));}
function unlockedNaturalEntries(sp,level){return naturalLearnset(sp).filter(e=>Number(e.unlockLevel)<=Number(level));}
function unlockedNaturalMoves(sp,level){return unlockedNaturalEntries(sp,level).map(e=>e.name);}
function defaultNaturalMoves(sp,level){return unlockedNaturalMoves(sp,level).slice(-4);}
function ensurePokemonMoveProgress(p,{initializeActive=false,migrateLegacy=false}={}){
  const sp=speciesById(p.speciesId); if(!sp)return [];
  p.activeMoves ||= []; p.relearnableMoves ||= []; p.learnedTMMoves ||= [];
  const unlocked=unlockedNaturalMoves(sp,p.level);
  const beforePool=[...p.relearnableMoves];
  if(migrateLegacy && !p.moveProgressionMigrated){
    const naturalNames=new Set(naturalLearnset(sp).map(e=>e.name));
    const legalTM=new Set(sp.tmMoves||[]);
    for(const name of [...p.activeMoves,...p.relearnableMoves]){
      if(legalTM.has(name) && (!naturalNames.has(name) || !unlocked.includes(name)) && !p.learnedTMMoves.includes(name)) p.learnedTMMoves.push(name);
    }
    p.moveProgressionMigrated=true;
  }
  const newly=unlocked.filter(n=>!beforePool.includes(n));
  p.relearnableMoves=[...new Set([...unlocked,...p.learnedTMMoves])];
  if(initializeActive && !p.activeMoves.length) p.activeMoves=defaultNaturalMoves(sp,p.level);
  p.activeMoves=p.activeMoves.filter(n=>p.relearnableMoves.includes(n)).slice(0,4);
  return newly;
}
function moveByName(name){return DATA.moves.find(m=>m.name===name);}
function itemById(id){return DATA.items.find(i=>i.id===id);}
function classData(name){return DATA.classes[name];}
function backgroundData(name){return DATA.backgrounds.find(b=>b.name===name);}
function pokemonInstance(tr,id){return tr.pokemon.find(p=>p.id===id);}
function partyPokemon(tr){return tr.partyIds.map(id=>pokemonInstance(tr,id)).filter(Boolean);}
function storagePokemon(tr){return tr.storageIds.map(id=>pokemonInstance(tr,id)).filter(Boolean);}
function dexState(tr,sid){return tr.pokedex?.[sid]||'undiscovered';}
function setDexState(tr,sid,newState){tr.pokedex ||= {}; const old=dexState(tr,sid); if(dexRank[newState]>=dexRank[old]) tr.pokedex[sid]=newState; else tr.pokedex[sid]=newState; saveState();}
function hpPct(p){return p.maxHp?Math.max(0,Math.min(100,p.currentHp/p.maxHp*100)):0;}
function hpClass(p){const x=hpPct(p); return x<=25?'low':x<=50?'mid':'';}
function heldEquippedCount(tr,itemId,excludePokemonId=null){return tr.pokemon.filter(p=>p.id!==excludePokemonId && p.heldItemId===itemId).length;}
function availableQty(tr,itemId,excludePokemonId=null){return Math.max(0,(tr.inventory[itemId]||0)-heldEquippedCount(tr,itemId,excludePokemonId));}
function inventorySlotCount(tr){
  const stackable=new Set(['Poké Balls','Medicine','Berries','Battle Items']);
  let slots=0;
  for(const [id,qty0] of Object.entries(tr.inventory||{})){
    const it=itemById(id); if(!it||qty0<=0) continue;
    let qty=qty0;
    if(it.category==='Held Items'||it.category==='Berries') qty=Math.max(0,qty-heldEquippedCount(tr,id));
    if(qty<=0) continue;
    slots += stackable.has(it.category)?Math.ceil(qty/10):qty;
  }
  return slots;
}
function addInventory(tr,itemId,qty=1){tr.inventory[itemId]=(tr.inventory[itemId]||0)+qty;if(tr.inventory[itemId]<=0) delete tr.inventory[itemId];}
function normalizeItemName(name){return name.toLowerCase().replace(/[’']/g,"'").trim();}
function findItemByName(name){const target=normalizeItemName(name); return DATA.items.find(i=>normalizeItemName(i.name)===target);}
function typeBadges(types=[]){return types.map(t=>`<span class="type-badge type-${escapeHTML(t)}">${escapeHTML(t)}</span>`).join('');}
function initials(name){return name.replace(/[^A-Za-z0-9♀♂]/g,'').slice(0,2).toUpperCase()||'PK';}
function statusLabel(s){return ({undiscovered:'Undiscovered',seen:'Seen',scanned:'Scanned',caught:'Caught'})[s]||s;}
function trainerMaxHP(tr){
  const cd=classData(tr.className); const con=abilityMod(tr.abilityScores.Constitution); let hp=cd.hitDie+con;
  for(let lv=2;lv<=tr.level;lv++) hp+=Math.max(1,(cd.hitDie===10?6:5)+con);
  return hp;
}
function nurseCareMax(tr){return Math.max(2,2+trainerProf(tr.level)+abilityMod(tr.abilityScores.Wisdom));}
function encounterResourceDefinitions(tr){
  const defs=[];
  const pb=trainerProf(tr.level);
  if(tr.className==='Trainer'){
    if(tr.level>=1) defs.push({key:'tacticalCommand',label:'Tactical Command',max:pb,note:`${pb} uses per fight`});
    if(tr.level>=2) defs.push({key:'battleInstinct',label:'Battle Instinct',max:1,note:'1 use per fight'});
    if(tr.level>=3) defs.push({key:'quickCommand',label:'Quick Command',max:1,note:'1 use per fight; also spends a Tactical Command use'});
  }
  if(tr.className==='Researcher'&&tr.level>=1) defs.push({key:'pokedexScan',label:'Pokédex Scan',max:pb,note:`${pb} uses per fight`});
  if(tr.className==='Nurse'&&tr.level>=5) defs.push({key:'triage',label:'Triage',max:1,note:'1 use per fight'});
  if(tr.className==='Coordinator'&&tr.level>=1) defs.push({key:'encourage',label:'Encourage',max:pb,note:`${pb} uses per fight`});
  if(tr.className==='Technician'&&tr.level>=2) defs.push({key:'ballTuning',label:'Ball Tuning',max:pb,note:`${pb} uses per fight`});
  return defs;
}
function ensureEncounterResources(tr){
  tr.encounterResources ||= {};
  for(const d of encounterResourceDefinitions(tr)){
    if(tr.encounterResources[d.key]==null) tr.encounterResources[d.key]=d.max;
    tr.encounterResources[d.key]=Math.max(0,Math.min(d.max,Number(tr.encounterResources[d.key])||0));
  }
  return tr.encounterResources;
}
function resetEncounterResources(tr){
  tr.encounterResources ||= {};
  for(const d of encounterResourceDefinitions(tr)) tr.encounterResources[d.key]=d.max;
}
function renderEncounterResources(tr,compact=false){
  const defs=encounterResourceDefinitions(tr); ensureEncounterResources(tr);
  if(!defs.length) return `<div class="small muted">Your current class features at this level are passive or use their own non-combat resources.</div>`;
  return `<div class="feature-list">${defs.map(d=>`<div class="feature"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div style="min-width:0"><div class="feature-name">${escapeHTML(d.label)}</div><div class="feature-text">${escapeHTML(d.note)}</div></div><div class="qty-control"><button data-encounter-resource="${d.key}" data-delta="-1" ${tr.encounterResources[d.key]<=0?'disabled':''}>−</button><span class="qty-num">${tr.encounterResources[d.key]}/${d.max}</span><button data-encounter-resource="${d.key}" data-delta="1" ${tr.encounterResources[d.key]>=d.max?'disabled':''}>+</button></div></div></div>`).join('')}</div>${compact?'':`<button class="ghost-btn btn-block" style="margin-top:10px" data-action="reset-encounter-resources">Reset for new fight</button><div class="tiny muted" style="margin-top:8px">Reset only when the GM says a new fight has begun. Passive features do not spend uses.</div>`}`;
}
function skillAbility(skill){for(const [ab,list] of Object.entries(DATA.skills)) if(list.includes(skill)) return ab; return null;}
function skillMod(tr,skill){const ab=skillAbility(skill); let n=ab?abilityMod(tr.abilityScores[ab]):0; if(tr.skillProficiencies.includes(skill)) n+=trainerProf(tr.level); return n;}
function saveMod(tr,ability){let n=abilityMod(tr.abilityScores[ability]); if(classData(tr.className).saves.includes(ability))n+=trainerProf(tr.level); return n;}
function getEvolutionOptions(p){return DATA.evolutions.filter(e=>e.from===p.speciesId);}
function evolutionEligible(tr,p,e){if(e.kind==='level'){if(p.level<e.value)return false;if(p.lastEvolutionLevel===p.level&&e.value===p.level&&(p.battleMarks||0)<1)return false;return true;}if(e.kind==='item')return (tr.inventory[findItemByName(e.value)?.id]||0)>0;if(e.kind==='trade')return (tr.inventory[findItemByName('Linking Cord')?.id]||0)>0;return false;}

async function loadData(){
  if(window.POKEMON_D20_DATA){ DATA=window.POKEMON_D20_DATA; return; }
  const names=['pokemon','moves','items','classes','backgrounds','evolutions','type-chart','conditions','skills'];
  const entries=await Promise.all(names.map(async n=>[n,await (await fetch(`data/${n}.json`)).json()]));
  DATA=Object.fromEntries(entries);
}

function render(){
  const app=$('#app'); app.className='';
  const tr=currentTrainer();
  if(!tr || ui.route==='creator'){ app.innerHTML=renderCreator(); bindCreator(); return; }
  app.innerHTML=`<div class="app-shell">
    ${renderSideNav(tr)}
    <main class="main">
      ${renderTopbar(tr)}
      <div class="content">${renderRoute(tr)}</div>
    </main>
    ${renderMobileNav()}
  </div>`;
  bindCommon();
}
function renderSideNav(tr){return `<aside class="side-nav">
  <div class="brand"><div class="mini-orb"></div><div><div class="brand-title">Pokémon d20</div><div class="brand-sub">Player Companion • V0.2.4 Premade</div></div></div>
  <nav class="nav-list">${navItems.map(([r,ic,l])=>`<button class="nav-btn ${ui.route===r?'active':''}" data-route="${r}"><span class="nav-icon">${ic}</span>${l}</button>`).join('')}</nav>
  <div class="side-bottom"><div class="profile-mini"><div class="profile-mini-name">${escapeHTML(tr.name)}</div><div class="profile-mini-sub">Lv. ${tr.level} ${escapeHTML(tr.className)}</div><button class="side-action" data-action="characters">Characters & Backup</button></div></div>
</aside>`}
function renderMobileNav(){return `<nav class="mobile-nav">${navItems.map(([r,ic,l])=>`<button class="${ui.route===r?'active':''}" data-route="${r}"><span>${ic}</span><span>${l}</span></button>`).join('')}</nav>`}
function renderTopbar(tr){return `<header class="topbar"><div class="top-title">${escapeHTML(navItems.find(x=>x[0]===ui.route)?.[2]||'Pokémon d20')}</div><div class="top-actions"><div class="money-pill">₽${Number(tr.money||0).toLocaleString()}</div><button class="icon-btn" data-action="reference" title="Rules reference">Rules</button><button class="icon-btn" data-action="characters" title="Characters and backup">${escapeHTML(tr.name.split(' ')[0])}</button></div></header>`}
function renderRoute(tr){
  if(ui.route==='trainer')return renderTrainer(tr);
  if(ui.route==='party')return renderParty(tr);
  if(ui.route==='pokedex')return renderPokedex(tr);
  if(ui.route==='moves')return renderMoves(tr);
  if(ui.route==='bag')return renderBag(tr);
  return renderHome(tr);
}

function renderHome(tr){
  const party=partyPokemon(tr), active=pokemonInstance(tr,tr.activePokemonId)||party[0], cd=classData(tr.className);
  return `<div class="page-head"><div><div class="eyebrow">Player Dashboard</div><h1 class="page-title">Ready for the table.</h1><p class="page-sub">The companion tracks your sheet, party and reference data. It never rolls dice or resolves your decisions for you.</p></div><div class="btn-row"><button class="primary-btn" data-action="pokemon-center">Heal at Pokémon Center</button>${encounterResourceDefinitions(tr).length?'<button class="ghost-btn" data-action="reset-encounter-resources">New fight: reset feature uses</button>':''}</div></div>
  <div class="grid dashboard-grid">
    <section class="grid">
      <div class="hero-trainer"><div class="eyebrow" style="color:#ffb8bf">Trainer</div><div class="hero-name">${escapeHTML(tr.name)}</div><div class="hero-meta">Level ${tr.level} ${escapeHTML(tr.className)} • ${escapeHTML(tr.background)}</div><div class="hero-row">
        <div class="hero-stat"><strong>${tr.hpCurrent}/${tr.hpMax}</strong><span>Trainer HP</span></div><div class="hero-stat"><strong>${10+abilityMod(tr.abilityScores.Dexterity)}</strong><span>AC</span></div><div class="hero-stat"><strong>${fmtMod(trainerProf(tr.level))}</strong><span>Proficiency</span></div><div class="hero-stat"><strong>₽${Number(tr.money).toLocaleString()}</strong><span>Cash</span></div>
      </div></div>
      <div class="card"><div class="card-head"><div><div class="card-title">Party</div><div class="card-sub">Six Pokémon maximum. Select a Pokémon to open its sheet.</div></div><button class="ghost-btn btn-sm" data-route="party">Manage party</button></div>${renderPartyStrip(tr)}</div>
      <div class="rule-note info-note"><strong>Table first.</strong> Attack rolls, damage, saves, capture rolls and status rolls are performed with physical dice. The app only shows your modifiers and rules.</div>
    </section>
    <aside class="grid">
      ${active?renderActivePokemonCard(tr,active):`<div class="card empty-state"><div class="empty-icon">●</div><strong>No active Pokémon</strong><p>Add a Pokémon to your party to populate this panel.</p><button class="primary-btn" data-action="add-pokemon">Add Pokémon</button></div>`}
      <div class="card"><div class="section-kicker">Class</div><div class="section-title">${escapeHTML(tr.className)} Features</div><div class="feature-list">${cd.features.filter(f=>f.level<=tr.level).slice(-3).map(renderFeature).join('')}</div><div class="divider"></div><div class="section-kicker">Fight Uses</div>${renderEncounterResources(tr,true)}<button class="ghost-btn btn-block" style="margin-top:12px" data-route="trainer">View full Trainer sheet</button></div>
      <div class="card"><div class="card-title">Quick Reference</div><div class="card-sub" style="margin-bottom:12px">Conditions and the type chart stay one tap away without tracking turns for you.</div><button class="secondary-btn btn-block" data-action="reference">Open rules reference</button></div>
    </aside>
  </div>`;
}
function renderPartyStrip(tr){
  const arr=partyPokemon(tr); let out='';
  for(let i=0;i<6;i++){
    const p=arr[i]; if(!p){out+=`<button class="party-chip empty" data-action="add-pokemon">+ Empty slot</button>`;continue;}
    const sp=speciesById(p.speciesId), pct=hpPct(p);
    out+=`<button class="party-chip" data-pokemon="${p.id}"><div style="display:flex;justify-content:space-between;gap:7px"><div class="poke-avatar">${initials(sp.name)}</div>${tr.activePokemonId===p.id?'<span class="tag">ACTIVE</span>':''}</div><div><div class="party-name">${escapeHTML(p.nickname||sp.name)}</div><div class="party-level">Lv. ${p.level} • ${p.currentHp<=0?'FAINTED':`${p.currentHp}/${p.maxHp} HP`}</div><div class="hp-track"><div class="hp-fill ${hpClass(p)}" style="width:${pct}%"></div></div></div></button>`;
  }
  return `<div class="party-strip">${out}</div>`;
}
function renderActivePokemonCard(tr,p){
  const sp=speciesById(p.speciesId); return `<div class="card"><div class="card-head"><div><div class="section-kicker">Active Pokémon</div><div class="card-title" style="font-size:1.35rem">${escapeHTML(p.nickname||sp.name)}</div><div class="card-sub">${escapeHTML(sp.name)} • Level ${p.level}</div></div><div class="poke-avatar">${initials(sp.name)}</div></div><div>${typeBadges(sp.types)}</div><div style="margin-top:16px"><div style="display:flex;justify-content:space-between;font-weight:900"><span>HP</span><span>${p.currentHp}/${p.maxHp}</span></div><div class="hp-track" style="height:10px"><div class="hp-fill ${hpClass(p)}" style="width:${hpPct(p)}%"></div></div></div><div class="grid grid-2" style="margin-top:14px"><div class="review-box"><div class="tiny muted">DEF target</div><strong>${sp.stats.defense.score}</strong></div><div class="review-box"><div class="tiny muted">SP. DEF target</div><strong>${sp.stats.spDefense.score}</strong></div></div><button class="primary-btn btn-block" style="margin-top:14px" data-pokemon="${p.id}">Open Pokémon sheet</button></div>`;
}

function renderTrainer(tr){
  const cd=classData(tr.className); const allSkills=Object.values(DATA.skills).flat();
  return `<div class="page-head"><div><div class="eyebrow">Character Sheet</div><h1 class="page-title">${escapeHTML(tr.name)}</h1><p class="page-sub">Level ${tr.level} ${escapeHTML(tr.className)} • ${escapeHTML(tr.background)} • Trainer Proficiency ${fmtMod(trainerProf(tr.level))}</p></div><div class="btn-row"><button class="ghost-btn" data-action="edit-trainer">Edit sheet</button>${tr.level<5?'<button class="primary-btn" data-action="trainer-level-up">Level up</button>':''}</div></div>
  <div class="trainer-layout">
    <section class="grid">
      <div class="card"><div class="card-head"><div><div class="card-title">Ability Scores</div><div class="card-sub">Static modifiers are calculated for you; all checks are still rolled at the table.</div></div></div><div class="ability-grid">${abilities.map(([ab,short])=>{const score=tr.abilityScores[ab],mod=abilityMod(score);return `<div class="ability"><div class="ability-name">${short}</div><div class="ability-score">${score}</div><div class="ability-mod">${fmtMod(mod)}</div></div>`}).join('')}</div></div>
      <div class="card"><div class="card-head"><div><div class="card-title">Skills & Saves</div><div class="card-sub">Filled circles mark proficient skills. Saving throw proficiencies come from your class.</div></div></div><div class="skill-list">${allSkills.map(sk=>`<div class="skill-row"><div class="skill-left"><span class="prof-dot ${tr.skillProficiencies.includes(sk)?'on':''}"></span><span>${escapeHTML(sk)}</span></div><span class="skill-mod">${fmtMod(skillMod(tr,sk))}</span></div>`).join('')}</div><div class="divider"></div><div class="grid grid-3">${abilities.map(([ab,short])=>`<div class="review-box"><div class="tiny muted">${short} SAVE ${cd.saves.includes(ab)?'• PROF':''}</div><strong>${fmtMod(saveMod(tr,ab))}</strong></div>`).join('')}</div></div>
      <div class="card"><div class="card-head"><div><div class="card-title">Notes</div><div class="card-sub">Campaign notes, goals, bonds and anything you want attached to the character.</div></div></div><textarea id="trainer-notes" style="width:100%;min-height:180px;border:1px solid var(--line);border-radius:12px;padding:12px;resize:vertical">${escapeHTML(tr.notes||'')}</textarea><div class="small muted" style="margin-top:8px">Saved locally as you type.</div></div>
    </section>
    <aside class="grid">
      <div class="card"><div class="section-kicker">Vitals</div><div class="grid grid-3"><div class="review-box"><div class="tiny muted">HP</div><strong>${tr.hpCurrent}/${tr.hpMax}</strong></div><div class="review-box"><div class="tiny muted">AC</div><strong>${10+abilityMod(tr.abilityScores.Dexterity)}</strong></div><div class="review-box"><div class="tiny muted">Move</div><strong>30 ft</strong></div></div><div class="hp-editor"><label class="small muted">Current HP</label><input class="hp-input" type="number" min="0" max="${tr.hpMax}" value="${tr.hpCurrent}" data-action="trainer-hp"></div>${tr.className==='Nurse'?renderNurseResource(tr):''}</div>
      <div class="card"><div class="section-kicker">Class</div><div class="section-title">${escapeHTML(tr.className)} — ${escapeHTML(cd.role)}</div><div class="small muted" style="margin-bottom:12px">Hit Die d${cd.hitDie} • Saving Throws: ${cd.saves.join(', ')}</div><div class="feature-list">${cd.features.map(f=>renderFeature(f,f.level>tr.level)).join('')}</div><div class="divider"></div><div class="section-title">Limited Uses per Fight</div>${renderEncounterResources(tr)}</div>
      <div class="card"><div class="card-title">Background</div><div class="card-sub" style="margin-bottom:10px">${escapeHTML(backgroundData(tr.background)?.identity||'')}</div>${(backgroundData(tr.background)?.skills||[]).map(s=>`<span class="tag">${escapeHTML(s)}</span>`).join('')}</div>
    </aside>
  </div>`;
}
function renderFeature(f,locked=false){return `<div class="feature ${locked?'locked':''}"><div class="feature-level">Level ${f.level}${locked?' • Locked':''}</div><div class="feature-name">${escapeHTML(f.name)}</div><div class="feature-text">${escapeHTML(f.text)}</div></div>`}
function renderNurseResource(tr){const max=nurseCareMax(tr); tr.classResources ||= {}; if(tr.classResources.careCharges==null)tr.classResources.careCharges=max; return `<div class="divider"></div><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><div class="card-title">Care Charges</div><div class="card-sub">Track use manually after applying your class feature.</div></div><div class="qty-control"><button data-action="care-minus">−</button><span class="qty-num">${tr.classResources.careCharges}/${max}</span><button data-action="care-plus">+</button></div></div>`}

function renderParty(tr){
  const party=partyPokemon(tr), storage=storagePokemon(tr);
  return `<div class="page-head"><div><div class="eyebrow">Pokémon Manager</div><h1 class="page-title">Party & Storage</h1><p class="page-sub">Manage your six party slots, HP, moves, Battle Marks and held items. PC storage preserves a Pokémon’s current state and never heals it.</p></div><button class="primary-btn" data-action="add-pokemon">Add Pokémon</button></div>
  <div class="card"><div class="card-head"><div><div class="card-title">Party ${party.length}/6</div><div class="card-sub">Changing your active Pokémon here is for between encounters. During combat, follow the full-turn switching rule at the table.</div></div></div>${renderPartyStrip(tr)}</div>
  <div class="card" style="margin-top:18px"><div class="card-head"><div><div class="card-title">PC Storage</div><div class="card-sub">${storage.length} Pokémon stored • HP, fainting, moves, Battle Marks and held items are preserved.</div></div></div>${storage.length?`<div class="dex-grid">${storage.map(p=>{const sp=speciesById(p.speciesId);return `<button class="dex-card" data-pokemon="${p.id}"><div class="dex-no">${sp.number} • LV ${p.level}</div><div class="dex-name">${escapeHTML(p.nickname||sp.name)}</div><div>${typeBadges(sp.types)}</div><div class="dex-state">${p.currentHp<=0?'FAINTED':`${p.currentHp}/${p.maxHp} HP`} • ${escapeHTML(p.heldItemId?itemById(p.heldItemId)?.name||'Held item':'No held item')}</div></button>`}).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">▦</div><strong>Storage is empty</strong><p>Captured Pokémon go here when your party is full.</p></div>`}</div>`;
}

function renderPokedex(tr){
  const q=ui.dexSearch.toLowerCase().trim(); const list=DATA.pokemon.filter(p=>(!q||p.name.toLowerCase().includes(q)||p.number.includes(q))&&(ui.dexType==='All'||p.types.includes(ui.dexType))&&(ui.dexState==='All'||dexState(tr,p.id)===ui.dexState));
  return `<div class="page-head"><div><div class="eyebrow">Kanto Database</div><h1 class="page-title">Pokédex</h1><p class="page-sub">Track what your Trainer has seen, scanned and caught. Researcher scans can unlock species data without automating the scan itself.</p></div></div>
  <div class="toolbar"><div class="search"><input id="dex-search" placeholder="Search name or number" value="${escapeHTML(ui.dexSearch)}"></div><select id="dex-type" class="select"><option>All</option>${typeOrder.map(t=>`<option ${ui.dexType===t?'selected':''}>${t}</option>`).join('')}</select><select id="dex-state" class="select"><option>All</option>${['undiscovered','seen','scanned','caught'].map(s=>`<option value="${s}" ${ui.dexState===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select></div>
  <div class="dex-grid">${list.map(p=>{const ds=dexState(tr,p.id);return `<button class="dex-card" data-dex="${p.id}"><div class="dex-no">${p.number}</div><div class="dex-name">${escapeHTML(p.name)}</div>${dexRank[ds]>=1?`<div>${typeBadges(p.types)}</div>`:`<div><div class="locked-line"></div><div class="locked-line" style="width:48%"></div></div>`}<div class="dex-state state-${ds}">${statusLabel(ds)}</div></button>`}).join('')}</div>${list.length?'':`<div class="empty-state"><strong>No Pokédex results</strong><p>Try a different filter.</p></div>`}`;
}

function renderMoves(){
  const q=ui.moveSearch.toLowerCase().trim(); const list=DATA.moves.filter(m=>(!q||m.name.toLowerCase().includes(q)||m.rules.toLowerCase().includes(q))&&(ui.moveType==='All'||m.type===ui.moveType)&&(ui.moveKind==='All'||m.kind===ui.moveKind));
  const kinds=[...new Set(DATA.moves.map(m=>m.kind))].sort();
  return `<div class="page-head"><div><div class="eyebrow">Rules Compendium</div><h1 class="page-title">Moves</h1><p class="page-sub">Reference only: move entries tell you what to roll. The app never rolls, determines hits or applies damage.</p></div></div>
  <div class="toolbar"><div class="search"><input id="move-search" placeholder="Search moves or rules" value="${escapeHTML(ui.moveSearch)}"></div><select id="move-type" class="select"><option>All</option>${typeOrder.map(t=>`<option ${ui.moveType===t?'selected':''}>${t}</option>`).join('')}</select><select id="move-kind" class="select"><option>All</option>${kinds.map(k=>`<option ${ui.moveKind===k?'selected':''}>${escapeHTML(k)}</option>`).join('')}</select></div>
  <div class="move-list">${list.map(m=>renderMoveCard(m,true)).join('')}</div>`;
}
function renderMoveCard(m,clickable=false){return `<button class="move-card" ${clickable?`data-move="${escapeHTML(m.name)}"`:''}><div class="move-top"><div><span class="type-badge type-${m.type}">${m.type}</span><span class="move-kind">${escapeHTML(m.kind)}</span></div></div><div class="move-name" style="margin-top:8px">${escapeHTML(m.name)}</div><div class="move-rule">${escapeHTML(m.rules)}</div><div class="move-group">${escapeHTML(m.group)}</div></button>`}

function renderBag(tr){
  const cats=['All',...new Set(DATA.items.map(i=>i.category))];
  return `<div class="page-head"><div><div class="eyebrow">Inventory & Economy</div><h1 class="page-title">Bag</h1><p class="page-sub">The app handles item quantities and Pokédollar accounting. Dice-based effects and healing results stay in your hands.</p></div><div class="btn-row"><button class="${ui.bagTab==='inventory'?'primary-btn':'ghost-btn'}" data-bag-tab="inventory">Inventory</button><button class="${ui.bagTab==='shop'?'primary-btn':'ghost-btn'}" data-bag-tab="shop">Shop</button></div></div>
  <div class="card"><div class="inventory-header"><div><div class="card-title">₽${Number(tr.money).toLocaleString()}</div><div class="card-sub">Pokédollars available</div></div><div class="slot-meter">Bag slots: <strong>${inventorySlotCount(tr)}/20</strong> <span class="tiny">(equipped held items excluded)</span></div></div></div>
  ${ui.bagTab==='shop'?renderShop(tr,cats):renderInventory(tr,cats)}`;
}
function renderInventory(tr,cats){
  const owned=DATA.items.filter(i=>(tr.inventory[i.id]||0)>0 && (!ui.bagSearch||i.name.toLowerCase().includes(ui.bagSearch.toLowerCase())));
  const groups=[...new Set(owned.map(i=>i.category))];
  return `<div class="toolbar" style="margin-top:18px"><div class="search"><input id="bag-search" placeholder="Search your bag" value="${escapeHTML(ui.bagSearch)}"></div><button class="ghost-btn" data-action="add-found-item">+ Record found item</button></div>
  <div class="card"><div class="rule-note warning-note"><strong>Held item rule:</strong> one item per Pokémon, equipped before combat. Do not change held items during combat. Duplicate held items require multiple copies in your inventory.</div><div class="inventory-groups" style="margin-top:18px">${groups.length?groups.map(cat=>`<div><div class="section-kicker">${cat}</div>${owned.filter(i=>i.category===cat).map(i=>renderInventoryRow(tr,i)).join('')}</div>`).join(''):`<div class="empty-state"><strong>Your Bag is empty</strong><p>Buy items or record items found during the adventure.</p></div>`}</div></div>`;
}
function renderInventoryRow(tr,it){const qty=tr.inventory[it.id]||0, equipped=heldEquippedCount(tr,it.id), sellable=Math.max(0,qty-equipped); return `<div class="item-row"><div><div class="item-name">${escapeHTML(it.name)}</div><div class="tiny muted">${escapeHTML(it.category)}${equipped?` • ${equipped} equipped`:''}</div></div><div class="item-effect">${escapeHTML(it.effect||'No additional V1 rules text.')}</div><div class="qty-control"><button data-item-adjust="${it.id}" data-delta="-1" ${sellable<=0?'disabled':''}>−</button><span class="qty-num">${qty}</span><button data-item-adjust="${it.id}" data-delta="1">+</button></div><div class="btn-row" style="justify-content:flex-end"><button class="ghost-btn btn-sm" data-item="${it.id}">Details</button>${it.price!=null&&sellable>0?`<button class="ghost-btn btn-sm" data-sell="${it.id}">Sell</button>`:''}</div></div>`}
function renderShop(tr,cats){
  const q=ui.bagSearch.toLowerCase().trim(); const list=DATA.items.filter(i=>i.price!=null&&(!q||i.name.toLowerCase().includes(q)||i.effect.toLowerCase().includes(q))&&(ui.shopCategory==='All'||i.category===ui.shopCategory));
  return `<div class="toolbar" style="margin-top:18px"><div class="search"><input id="bag-search" placeholder="Search shop catalogue" value="${escapeHTML(ui.bagSearch)}"></div><select id="shop-category" class="select">${cats.map(c=>`<option ${ui.shopCategory===c?'selected':''}>${escapeHTML(c)}</option>`).join('')}</select></div><div class="card"><div class="card-sub" style="margin-bottom:12px">Standard V1 catalogue. Availability still depends on the shop the GM says you are visiting.</div>${list.map(i=>`<div class="item-row shop-row"><div><div class="item-name">${escapeHTML(i.name)}</div><div class="tiny muted">${escapeHTML(i.category)}</div></div><div class="item-effect">${escapeHTML(i.effect||'')}</div><div class="price">₽${i.price.toLocaleString()}</div><button class="primary-btn btn-sm" data-buy="${i.id}" ${tr.money<i.price?'disabled':''}>Buy</button></div>`).join('')}</div>`;
}

function renderCreator(){
  if(!ui.creatorDraft) ui.creatorDraft={name:'',className:'Trainer',background:'Academy Student',abilityScores:{Strength:15,Dexterity:14,Constitution:13,Intelligence:12,Wisdom:10,Charisma:8},skills:[],starterId:1,starterLevel:1,starterNickname:''};
  const d=ui.creatorDraft, cd=classData(d.className), bg=backgroundData(d.background); const step=ui.creatorStep;
  const starterIds=[1,4,7];
  let body='';
  if(step===1) body=`<div class="form-grid"><div class="field"><label>Trainer name</label><input id="cr-name" value="${escapeHTML(d.name)}" placeholder="Enter trainer name"></div><div class="field"><label>Background</label><select id="cr-background">${DATA.backgrounds.map(b=>`<option ${d.background===b.name?'selected':''}>${escapeHTML(b.name)}</option>`).join('')}</select></div></div><div class="divider"></div><div class="section-title">Choose a Trainer Class</div><div class="option-grid">${Object.entries(DATA.classes).map(([name,c])=>`<button class="option-card ${d.className===name?'selected':''}" data-cr-class="${name}"><div class="feature-level">d${c.hitDie} Hit Die</div><div class="feature-name">${name}</div><div class="feature-text">${escapeHTML(c.role)}</div></button>`).join('')}</div><div class="rule-note info-note" style="margin-top:16px"><strong>${escapeHTML(bg.name)}:</strong> ${escapeHTML(bg.identity)} Skills: ${bg.skills.join(', ')}.</div>`;
  if(step===2) body=`<div class="section-title">Ability Scores</div><p class="page-sub" style="margin-bottom:16px">V1 uses the standard array 15, 14, 13, 12, 10, 8. Assign each value once.</p><div class="form-grid">${abilities.map(([ab,short])=>`<div class="field"><label>${short} — ${ab}</label><select data-cr-ability="${ab}">${[15,14,13,12,10,8].map(v=>`<option value="${v}" ${d.abilityScores[ab]===v?'selected':''}>${v} (${fmtMod(abilityMod(v))})</option>`).join('')}</select></div>`).join('')}</div><div id="ability-warning" class="small danger-text" style="margin-top:12px"></div>`;
  if(step===3){const auto=bg.skills; const allowed=cd.skills.filter(sk=>!auto.includes(sk)); body=`<div class="section-title">Skill Proficiencies</div><p class="page-sub">Your background grants <strong>${auto.join(' and ')}</strong>. Choose ${cd.chooseSkills} additional class skills.</p><div class="check-grid" style="margin-top:16px">${allowed.map(sk=>`<label class="check-card"><input type="checkbox" data-cr-skill="${escapeHTML(sk)}" ${d.skills.includes(sk)?'checked':''}><span>${escapeHTML(sk)}</span></label>`).join('')}</div><div class="small muted" style="margin-top:12px">Selected ${d.skills.length}/${cd.chooseSkills}</div>`}
  if(step===4){
    if(!starterIds.includes(Number(d.starterId))) d.starterId=1;
    const sp=speciesById(d.starterId), starting=defaultNaturalMoves(sp,d.starterLevel), pool=unlockedNaturalMoves(sp,d.starterLevel);
    body=`<div class="form-grid"><div class="field"><label>Starter Pokémon</label><select id="cr-starter">${starterIds.map(id=>speciesById(id)).map(pk=>`<option value="${pk.id}" ${d.starterId===pk.id?'selected':''}>${pk.number} ${escapeHTML(pk.name)}</option>`).join('')}</select></div><div class="field"><label>Starter level</label><input id="cr-starter-level" type="number" min="1" max="20" value="${d.starterLevel}"></div><div class="field"><label>Nickname (optional)</label><input id="cr-starter-nickname" value="${escapeHTML(d.starterNickname)}"></div></div><div class="divider"></div><div class="section-title">Starting Active Moves</div><p class="page-sub">Moves unlock from the species' natural level-up learnset. At Level ${d.starterLevel}, ${escapeHTML(sp.name)} begins with the most recent ${Math.min(4,pool.length)} unlocked natural move${Math.min(4,pool.length)===1?'':'s'} active. Every earlier unlocked move is retained in its Relearnable Move Pool.</p><div class="check-grid" style="margin-top:14px">${starting.length?starting.map(m=>`<div class="check-card"><span>${escapeHTML(m)}</span><span class="tag">Active</span></div>`).join(''):'<div class="empty-state"><strong>No natural moves unlocked</strong></div>'}</div>`;
  }
  if(step===5){const sp=speciesById(d.starterId), starting=defaultNaturalMoves(sp,d.starterLevel); body=`<div class="review-grid"><div class="review-box"><div class="section-kicker">Trainer</div><strong>${escapeHTML(d.name||'Unnamed Trainer')}</strong><div class="small muted">Level 1 ${escapeHTML(d.className)} • ${escapeHTML(d.background)}</div></div><div class="review-box"><div class="section-kicker">Starting Money</div><strong>₽${(3000+(bg.moneyBonus||0)).toLocaleString()}</strong><div class="small muted">Includes background cash</div></div><div class="review-box"><div class="section-kicker">Starter</div><strong>${escapeHTML(d.starterNickname||sp.name)}</strong><div class="small muted">${sp.name} • Level ${d.starterLevel}</div></div><div class="review-box"><div class="section-kicker">Starting Moves</div><strong>${starting.length}/4 active</strong><div class="small muted">${escapeHTML(starting.join(', ')||'None unlocked')}</div></div></div><div class="divider"></div><div class="section-title">Ability Scores</div><div class="ability-grid">${abilities.map(([ab,short])=>`<div class="ability"><div class="ability-name">${short}</div><div class="ability-score">${d.abilityScores[ab]}</div><div class="ability-mod">${fmtMod(abilityMod(d.abilityScores[ab]))}</div></div>`).join('')}</div><div class="rule-note info-note" style="margin-top:18px">The companion will calculate permanent sheet values such as modifiers and maximum HP, but it will never roll your checks, attacks, damage or saves.</div>`}
  return `<div class="form-shell"><div class="creator-card"><div class="creator-head"><div class="brand" style="padding:0"><div class="mini-orb"></div><div><div class="brand-title">Pokémon d20 Companion</div><div class="brand-sub">V0.2.4 Premade • Player-first tabletop manager</div></div></div><h1 style="margin:24px 0 6px;font-size:2rem">Create a Trainer</h1><p style="margin:0;color:#c9d4e4">Character creator, party manager, Pokédex, move compendium and Bag — without digital dice.</p><div class="steps">${[1,2,3,4,5].map(n=>`<div class="step ${n<=step?'on':''}"></div>`).join('')}</div></div><div class="creator-body">${body}<div class="creator-actions"><button class="ghost-btn" data-cr-back ${step===1?'disabled':''}>Back</button>${step<5?`<button class="primary-btn" data-cr-next>Continue</button>`:`<button class="primary-btn" data-cr-create>Create Trainer</button>`}</div></div></div><div class="footer-note">Unofficial fan-made playtest tool. Pokémon and related names are trademarks of their respective owners.</div></div>`;
}

function bindCreator(){
  $('#cr-name')?.addEventListener('input',e=>ui.creatorDraft.name=e.target.value);
  $('#cr-background')?.addEventListener('change',e=>{ui.creatorDraft.background=e.target.value;ui.creatorDraft.skills=[];render()});
  $$('[data-cr-class]').forEach(b=>b.addEventListener('click',()=>{ui.creatorDraft.className=b.dataset.crClass;ui.creatorDraft.skills=[];render()}));
  $$('[data-cr-ability]').forEach(s=>s.addEventListener('change',()=>{ui.creatorDraft.abilityScores[s.dataset.crAbility]=Number(s.value);renderAbilityWarning()}));
  $$('[data-cr-skill]').forEach(c=>c.addEventListener('change',()=>{const arr=ui.creatorDraft.skills; if(c.checked){if(!arr.includes(c.dataset.crSkill))arr.push(c.dataset.crSkill)}else ui.creatorDraft.skills=arr.filter(x=>x!==c.dataset.crSkill);render()}));
  $('#cr-starter')?.addEventListener('change',e=>{ui.creatorDraft.starterId=Number(e.target.value);render()});
  $('#cr-starter-level')?.addEventListener('change',e=>{ui.creatorDraft.starterLevel=Math.max(1,Math.min(20,Number(e.target.value)||1));render()});
  $('#cr-starter-nickname')?.addEventListener('input',e=>ui.creatorDraft.starterNickname=e.target.value);
  $('[data-cr-back]')?.addEventListener('click',()=>{ui.creatorStep=Math.max(1,ui.creatorStep-1);render()});
  $('[data-cr-next]')?.addEventListener('click',()=>creatorNext());
  $('[data-cr-create]')?.addEventListener('click',()=>createTrainerFromDraft());
  renderAbilityWarning();
}
function renderAbilityWarning(){const el=$('#ability-warning');if(!el)return;const vals=Object.values(ui.creatorDraft.abilityScores);el.textContent=(new Set(vals).size===6&&[15,14,13,12,10,8].every(v=>vals.includes(v)))?'':'Assign each standard-array value exactly once.'}
function creatorNext(){
  const d=ui.creatorDraft, cd=classData(d.className); if(ui.creatorStep===1 && !d.name.trim()){alert('Enter a Trainer name first.');return}
  if(ui.creatorStep===2){const vals=Object.values(d.abilityScores);if(new Set(vals).size!==6||![15,14,13,12,10,8].every(v=>vals.includes(v))){alert('Use each standard-array value exactly once.');return}}
  if(ui.creatorStep===3&&d.skills.length!==cd.chooseSkills){alert(`Choose exactly ${cd.chooseSkills} class skills.`);return}
  ui.creatorStep=Math.min(5,ui.creatorStep+1);render();
}
function createTrainerFromDraft(){
  const d=ui.creatorDraft, cd=classData(d.className), bg=backgroundData(d.background), tr={id:uid('tr'),name:d.name.trim(),className:d.className,level:1,background:d.background,abilityScores:{...d.abilityScores},skillProficiencies:[...new Set([...bg.skills,...d.skills])],hpCurrent:1,hpMax:1,money:3000+(bg.moneyBonus||0),inventory:{},pokemon:[],partyIds:[],storageIds:[],activePokemonId:null,pokedex:{},notes:'',classResources:{}};
  tr.hpMax=trainerMaxHP(tr);tr.hpCurrent=tr.hpMax;
  cd.startingGear.forEach(g=>{const it=findItemByName(g.name);if(it)addInventory(tr,it.id,g.qty)});
  const bgGearMap={
    'Academy Student':['Notebook','Reference cards'],'Athlete':['Sports gear','Water bottle'],'Caregiver':['First-aid pouch','Blanket'],'Field Assistant':['Field notebook','Specimen containers'],'Performer':['Performance kit','Costume piece'],'Tinkerer':['Small tool roll','Spare parts'],'Traveller':['Bedroll','Map','Rope'],'Streetwise':['Flashlight','Simple disguise kit']
  };
  (bgGearMap[d.background]||[]).forEach(n=>{const it=findItemByName(n);if(it)addInventory(tr,it.id,1)});
  const p=createPokemonInstance(d.starterId,d.starterLevel,d.starterNickname);tr.pokemon.push(p);tr.partyIds.push(p.id);tr.activePokemonId=p.id;tr.pokedex[d.starterId]='caught';
  if(tr.className==='Nurse')tr.classResources.careCharges=nurseCareMax(tr);
  resetEncounterResources(tr);
  state.trainers.push(tr);state.activeTrainerId=tr.id;saveState();ui.route='home';ui.creatorDraft=null;ui.creatorStep=1;render();
}
function createPokemonInstance(speciesId,level=1,nickname=''){const sp=speciesById(speciesId),lv=Math.max(1,Math.min(20,Number(level)||1)),max=maxPokemonHP(sp,lv),pool=unlockedNaturalMoves(sp,lv),active=pool.slice(-4);return{id:uid('pk'),speciesId:Number(speciesId),nickname:nickname.trim(),level:lv,currentHp:max,maxHp:max,battleMarks:0,lastEvolutionLevel:null,activeMoves:[...active],relearnableMoves:[...pool],learnedTMMoves:[],moveProgressionMigrated:true,heldItemId:null,condition:'',conditionRounds:'',statStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0}}}


function seedPremadeCharacters(){
  if(state.trainers.length) return;
  const specs=[
    {
      name:'Theo', className:'Trainer', background:'Academy Student',
      abilityScores:{Strength:13,Dexterity:14,Constitution:17,Intelligence:12,Wisdom:10,Charisma:8},
      classSkills:['Athletics','Perception','Pokémon Handling'],
      team:[{speciesId:4,level:6},{speciesId:99,level:6},{speciesId:50,level:7},{speciesId:58,level:7}]
    },
    {
      name:'Jordan', className:'Technician', background:'Athlete',
      abilityScores:{Strength:10,Dexterity:14,Constitution:13,Intelligence:17,Wisdom:8,Charisma:12},
      classSkills:['Technology','Investigation','Pokémon'],
      team:[{speciesId:7,level:5},{speciesId:100,level:8},{speciesId:56,level:8},{speciesId:26,level:9}]
    },
    {
      name:'Maya', className:'Researcher', background:'Tinkerer',
      abilityScores:{Strength:8,Dexterity:12,Constitution:13,Intelligence:17,Wisdom:14,Charisma:10},
      classSkills:['Investigation','Nature','Pokémon'],
      team:[{speciesId:1,level:8},{speciesId:47,level:9},{speciesId:65,level:8},{speciesId:32,level:6}]
    },
    {
      name:'Ava', className:'Nurse', background:'Performer',
      abilityScores:{Strength:8,Dexterity:12,Constitution:13,Intelligence:10,Wisdom:17,Charisma:14},
      classSkills:['Medicine','Insight','Pokémon Handling'],
      team:[{speciesId:7,level:6},{speciesId:84,level:5},{speciesId:31,level:8},{speciesId:8,level:7}]
    }
  ];
  const bgGearMap={
    'Academy Student':['Notebook','Reference cards'],'Athlete':['Sports gear','Water bottle'],'Caregiver':['First-aid pouch','Blanket'],'Field Assistant':['Field notebook','Specimen containers'],'Performer':['Performance kit','Costume piece'],'Tinkerer':['Small tool roll','Spare parts'],'Traveller':['Bedroll','Map','Rope'],'Streetwise':['Flashlight','Simple disguise kit']
  };
  for(const spec of specs){
    const cd=classData(spec.className),bg=backgroundData(spec.background);
    const tr={id:uid('tr'),name:spec.name,className:spec.className,level:4,background:spec.background,abilityScores:{...spec.abilityScores},skillProficiencies:[...new Set([...(bg?.skills||[]),...spec.classSkills])],hpCurrent:1,hpMax:1,money:3000+(bg?.moneyBonus||0),inventory:{},pokemon:[],partyIds:[],storageIds:[],activePokemonId:null,pokedex:{},notes:'Premade Level 4 playtest character.',classResources:{},encounterResources:{}};
    tr.hpMax=trainerMaxHP(tr); tr.hpCurrent=tr.hpMax;
    (cd.startingGear||[]).forEach(g=>{const it=findItemByName(g.name);if(it)addInventory(tr,it.id,g.qty)});
    (bgGearMap[spec.background]||[]).forEach(n=>{const it=findItemByName(n);if(it)addInventory(tr,it.id,1)});
    for(const mon of spec.team){
      const pk=createPokemonInstance(mon.speciesId,mon.level,'');
      tr.pokemon.push(pk); tr.partyIds.push(pk.id); tr.pokedex[mon.speciesId]='caught';
    }
    tr.activePokemonId=tr.partyIds[0]||null;
    if(tr.className==='Nurse') tr.classResources.careCharges=nurseCareMax(tr);
    resetEncounterResources(tr);
    state.trainers.push(tr);
  }
  state.activeTrainerId=state.trainers[0]?.id||null;
  saveState();
}

function bindCommon(){
  $$('[data-route]').forEach(b=>b.addEventListener('click',()=>{ui.route=b.dataset.route;render()}));
  $$('[data-pokemon]').forEach(b=>b.addEventListener('click',()=>openPokemonSheet(b.dataset.pokemon)));
  $$('[data-dex]').forEach(b=>b.addEventListener('click',()=>openDex(Number(b.dataset.dex))));
  $$('[data-move]').forEach(b=>b.addEventListener('click',()=>openMove(b.dataset.move)));
  $$('[data-item]').forEach(b=>b.addEventListener('click',()=>openItem(b.dataset.item)));
  $$('[data-bag-tab]').forEach(b=>b.addEventListener('click',()=>{ui.bagTab=b.dataset.bagTab;render()}));
  $$('[data-buy]').forEach(b=>b.addEventListener('click',()=>buyItem(b.dataset.buy)));
  $$('[data-sell]').forEach(b=>b.addEventListener('click',()=>sellItem(b.dataset.sell)));
  $$('[data-item-adjust]').forEach(b=>b.addEventListener('click',()=>adjustItem(b.dataset.itemAdjust,Number(b.dataset.delta))));
  $$('[data-encounter-resource]').forEach(b=>b.addEventListener('click',()=>{const tr=currentTrainer(),defs=encounterResourceDefinitions(tr),d=defs.find(x=>x.key===b.dataset.encounterResource);if(!d)return;ensureEncounterResources(tr);tr.encounterResources[d.key]=Math.max(0,Math.min(d.max,tr.encounterResources[d.key]+Number(b.dataset.delta)));saveState();render()}));
  $$('[data-action]').forEach(b=>b.addEventListener('click',()=>handleAction(b.dataset.action,b)));
  bindLiveSearch('dex-search',v=>ui.dexSearch=v);
  $('#dex-type')?.addEventListener('change',e=>{ui.dexType=e.target.value;render()});
  $('#dex-state')?.addEventListener('change',e=>{ui.dexState=e.target.value;render()});
  bindLiveSearch('move-search',v=>ui.moveSearch=v);
  $('#move-type')?.addEventListener('change',e=>{ui.moveType=e.target.value;render()});
  $('#move-kind')?.addEventListener('change',e=>{ui.moveKind=e.target.value;render()});
  bindLiveSearch('bag-search',v=>ui.bagSearch=v);
  $('#shop-category')?.addEventListener('change',e=>{ui.shopCategory=e.target.value;render()});
  $('#trainer-notes')?.addEventListener('input',e=>{currentTrainer().notes=e.target.value;saveState()});
  $('[data-action="trainer-hp"]')?.addEventListener('change',e=>{const tr=currentTrainer();tr.hpCurrent=Math.max(0,Math.min(tr.hpMax,Number(e.target.value)||0));saveState();render()});
}
let liveSearchTimer=null;
function bindLiveSearch(id,setter){const input=document.getElementById(id);if(!input)return;input.addEventListener('input',e=>{const value=e.target.value,pos=e.target.selectionStart;setter(value);clearTimeout(liveSearchTimer);liveSearchTimer=setTimeout(()=>{render();requestAnimationFrame(()=>{const next=document.getElementById(id);if(next){next.focus();try{next.setSelectionRange(pos,pos)}catch(_){}}})},110)})}

function handleAction(action,el){
  if(action==='reference')openReference();
  if(action==='characters')openCharacters();
  if(action==='add-pokemon')openAddPokemon();
  if(action==='edit-trainer')openEditTrainer();
  if(action==='trainer-level-up')trainerLevelUp();
  if(action==='pokemon-center')healAtPokemonCenter();
  if(action==='reset-encounter-resources'){const tr=currentTrainer();if(confirm('Reset all limited class-feature uses for a new fight?')){resetEncounterResources(tr);saveState();render()}}
  if(action==='care-minus'||action==='care-plus'){const tr=currentTrainer(),max=nurseCareMax(tr);tr.classResources.careCharges=Math.max(0,Math.min(max,(tr.classResources.careCharges||0)+(action==='care-plus'?1:-1)));saveState();render()}
  if(action==='add-found-item')openFindItem();
}

function modal(title,body,opts=''){const root=$('#modal-root');root.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div class="modal-title">${title}</div><button class="close-btn" data-close-modal>×</button></div><div class="modal-body">${body}</div></div></div>`;root.querySelector('[data-close-modal]').onclick=closeModal;root.querySelector('.modal-backdrop').addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal()});return root.querySelector('.modal')}
function closeModal(){ $('#modal-root').innerHTML=''; }

function openPokemonSheet(pid){
  const tr=currentTrainer(),p=pokemonInstance(tr,pid); if(!p)return; const sp=speciesById(p.speciesId), held=p.heldItemId?itemById(p.heldItemId):null; const evo=getEvolutionOptions(p);
  const body=`<div class="pokemon-sheet-head"><div class="pokemon-ident"><div class="pokemon-big-avatar">${initials(sp.name)}</div><div><div class="dex-no">${sp.number} • LEVEL ${p.level}</div><div class="pokemon-name">${escapeHTML(p.nickname||sp.name)}</div><div class="pokemon-species">${escapeHTML(sp.name)} ${typeBadges(sp.types)}</div></div></div><div class="btn-row"><button class="ghost-btn btn-sm" data-pk-action="rename">Rename</button>${tr.partyIds.includes(p.id)?`<button class="${tr.activePokemonId===p.id?'secondary-btn':'ghost-btn'} btn-sm" data-pk-action="set-active">${tr.activePokemonId===p.id?'Active':'Set active'}</button><button class="ghost-btn btn-sm" data-pk-action="to-storage">To PC</button>`:`<button class="primary-btn btn-sm" data-pk-action="to-party" ${tr.partyIds.length>=6?'disabled':''}>Add to party</button>`}</div></div>
  <div class="grid grid-2" style="margin-top:18px"><div class="card soft"><div class="card-title">HP</div><div class="hp-editor"><input id="pk-current-hp" class="hp-input" type="number" min="0" max="${p.maxHp}" value="${p.currentHp}"><strong>/ ${p.maxHp}</strong>${p.currentHp<=0?'<span class="status-chip">FAINTED</span>':''}</div><div class="hp-track" style="height:11px;margin-top:12px"><div class="hp-fill ${hpClass(p)}" style="width:${hpPct(p)}%"></div></div><div class="small muted" style="margin-top:10px">Max HP is calculated from Base HP and Level. Enter damage or healing yourself after rolling at the table.</div></div><div class="card soft"><div class="card-title">Progression</div><div class="small muted">Pokémon Skill Proficiency ${fmtMod(pokemonProf(p.level))}</div><div class="section-kicker" style="margin-top:12px">Battle Marks</div><div class="mark-row">${[1,2,3].map(n=>`<button class="mark ${p.battleMarks>=n?'on':''}" data-mark="${n}"></button>`).join('')}<span class="small muted">${p.battleMarks}/3</span></div><button class="primary-btn btn-sm" style="margin-top:12px" data-pk-action="level-up" ${p.battleMarks<3||p.level>=20?'disabled':''}>Level up</button></div></div>
  <div class="card soft" style="margin-top:14px"><div class="card-head"><div><div class="card-title">Combat Stats</div><div class="card-sub">Defense and Sp. Defense are the full target numbers attackers must meet.</div></div></div><div class="stat-grid"><div class="stat-box"><div class="stat-label">Base HP</div><div class="stat-score">${sp.baseHP}</div><div class="stat-mod">Max ${p.maxHp}</div></div>${statKeys.map(([k,l])=>{const s=sp.stats[k],target=k==='defense'||k==='spDefense';return `<div class="stat-box ${target?'target-stat':''}"><div class="stat-label">${l}</div><div class="stat-score">${s.score}</div><div class="stat-mod">${fmtMod(s.mod)}</div></div>`}).join('')}</div></div>
  <div class="grid grid-2" style="margin-top:14px"><div class="card soft"><div class="card-head"><div><div class="card-title">Active Moves</div><div class="card-sub">Four active move slots. Tap Manage to use the Relearnable Move Pool.</div></div><button class="ghost-btn btn-sm" data-pk-action="moves">Manage</button></div><div class="move-slot-grid">${[0,1,2,3].map(i=>{const name=p.activeMoves[i];const m=name?moveByName(name):null;return name&&m?`<div class="move-slot"><div>${typeBadges([m.type])}</div><div class="move-slot-name">${escapeHTML(name)}</div><div class="move-slot-rule">${escapeHTML(m.rules)}</div></div>`:`<div class="move-slot empty">Empty move slot</div>`}).join('')}</div></div><div class="card soft"><div class="card-title">Held Item</div><div class="card-sub">${held?escapeHTML(held.effect):'No held item equipped.'}</div><div style="margin-top:10px">${held?`<strong>${escapeHTML(held.name)}</strong> <span class="tag">${escapeHTML(held.mode||'Held')}</span>`:'<span class="muted">Empty slot</span>'}</div><button class="ghost-btn btn-sm" style="margin-top:12px" data-pk-action="held">Manage held item</button><div class="rule-note warning-note" style="margin-top:12px"><strong>No changes in combat.</strong> This screen is for between encounters; the app deliberately does not provide a Battle Mode.</div></div></div>
  <div class="grid grid-2" style="margin-top:14px"><div class="card soft"><div class="card-title">Status</div><div class="form-grid" style="margin-top:10px"><div class="field"><label>Condition</label><select id="pk-condition"><option value="">None</option>${Object.keys(DATA.conditions).map(c=>`<option ${p.condition===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>Rounds remaining</label><input id="pk-condition-rounds" type="number" min="0" max="4" value="${escapeHTML(p.conditionRounds||'')}"></div></div>${p.condition?`<div class="rule-note" style="margin-top:12px">${escapeHTML(DATA.conditions[p.condition])}</div>`:''}</div><div class="card soft"><div class="card-title">Temporary Stat Stages</div><div class="stage-grid" style="margin-top:10px">${statKeys.map(([k,l])=>`<div class="stage-control"><div class="stage-label">${l}</div><div class="stage-value">${fmtMod(p.statStages[k]||0)}</div><div class="mini-stepper"><button data-stage="${k}" data-stage-delta="-1">−</button><button data-stage="${k}" data-stage-delta="1">+</button></div></div>`).join('')}</div></div></div>
  ${evo.length?`<div class="card soft" style="margin-top:14px"><div class="card-title">Evolution</div><div class="card-sub">Available evolution paths are listed below. The player chooses whether to evolve.</div><div style="margin-top:10px">${evo.map(e=>{const to=speciesById(e.to),ok=evolutionEligible(tr,p,e),req=e.kind==='level'?`Level ${e.value}`:e.kind==='item'?e.value:'Trade or Linking Cord';return `<div class="item-row" style="grid-template-columns:1fr 160px 110px"><div><div class="item-name">${escapeHTML(sp.name)} → ${escapeHTML(to.name)}</div><div class="tiny muted">${escapeHTML(req)}</div></div><div class="small ${ok?'success-text':'muted'}">${ok?'Requirement met':'Not currently met'}</div><button class="primary-btn btn-sm" data-evolve="${e.to}" ${ok?'':'disabled'}>Evolve</button></div>`}).join('')}</div></div>`:''}
  <div class="divider"></div><div class="btn-row"><button class="danger-btn" data-pk-action="remove">Remove Pokémon</button></div>`;
  const m=modal(`${escapeHTML(p.nickname||sp.name)} — Pokémon Sheet`,body);
  $('#pk-current-hp',m).onchange=e=>{p.currentHp=Math.max(0,Math.min(p.maxHp,Number(e.target.value)||0));saveState();closeModal();openPokemonSheet(pid);render()};
  $('#pk-condition',m).onchange=e=>{p.condition=e.target.value;p.conditionRounds=p.condition?'':'';saveState();closeModal();openPokemonSheet(pid)};
  $('#pk-condition-rounds',m).onchange=e=>{p.conditionRounds=e.target.value;saveState()};
  $$('[data-mark]',m).forEach(b=>b.onclick=()=>{p.battleMarks=Number(b.dataset.mark)===p.battleMarks?Math.max(0,p.battleMarks-1):Number(b.dataset.mark);saveState();closeModal();openPokemonSheet(pid);render()});
  $$('[data-stage]',m).forEach(b=>b.onclick=()=>{const k=b.dataset.stage;p.statStages[k]=Math.max(-6,Math.min(6,(p.statStages[k]||0)+Number(b.dataset.stageDelta)));saveState();closeModal();openPokemonSheet(pid)});
  $$('[data-pk-action]',m).forEach(b=>b.onclick=()=>pokemonAction(pid,b.dataset.pkAction));
  $$('[data-evolve]',m).forEach(b=>b.onclick=()=>evolvePokemon(pid,Number(b.dataset.evolve)));
}
function pokemonAction(pid,action){
  const tr=currentTrainer(),p=pokemonInstance(tr,pid),sp=speciesById(p.speciesId);
  if(action==='rename'){const n=prompt('Nickname (leave blank to use species name):',p.nickname||'');if(n!==null){p.nickname=n.trim();saveState();closeModal();openPokemonSheet(pid);render()}}
  if(action==='set-active'){if(tr.partyIds.includes(pid)){tr.activePokemonId=pid;saveState();closeModal();render()}}
  if(action==='to-storage'){tr.partyIds=tr.partyIds.filter(id=>id!==pid);if(!tr.storageIds.includes(pid))tr.storageIds.push(pid);if(tr.activePokemonId===pid)tr.activePokemonId=tr.partyIds[0]||null;saveState();closeModal();render()}
  if(action==='to-party'){if(tr.partyIds.length<6){tr.storageIds=tr.storageIds.filter(id=>id!==pid);if(!tr.partyIds.includes(pid))tr.partyIds.push(pid);if(!tr.activePokemonId)tr.activePokemonId=pid;saveState();closeModal();render()}}
  if(action==='moves'){closeModal();openMoveManager(pid)}
  if(action==='held'){closeModal();openHeldManager(pid)}
  if(action==='level-up'){if(p.battleMarks>=3&&p.level<20){const old=p.maxHp;p.level++;p.battleMarks=0;p.maxHp=maxPokemonHP(sp,p.level);p.currentHp=Math.min(p.maxHp,p.currentHp+(p.maxHp-old));const newly=ensurePokemonMoveProgress(p);saveState();closeModal();render();if(newly.length){const mm=modal(`${escapeHTML(p.nickname||sp.name)} reached Level ${p.level}`,`<div class="rule-note info-note"><strong>Natural move${newly.length===1?'':'s'} unlocked:</strong> ${newly.map(escapeHTML).join(', ')}.</div><p class="small muted">${newly.length===1?'It has':'They have'} been added to the Relearnable Move Pool. Your active four moves were not changed.</p><div class="btn-row" style="margin-top:16px"><button class="primary-btn" data-manage-new>Manage moves</button><button class="ghost-btn" data-continue-new>Continue</button></div>`);$('[data-manage-new]',mm).onclick=()=>{closeModal();openMoveManager(pid)};$('[data-continue-new]',mm).onclick=()=>{closeModal();openPokemonSheet(pid)}}else openPokemonSheet(pid)}}
  if(action==='remove'){if(confirm(`Remove ${p.nickname||sp.name} from this Trainer? This cannot be undone.`)){tr.pokemon=tr.pokemon.filter(x=>x.id!==pid);tr.partyIds=tr.partyIds.filter(x=>x!==pid);tr.storageIds=tr.storageIds.filter(x=>x!==pid);if(tr.activePokemonId===pid)tr.activePokemonId=tr.partyIds[0]||null;saveState();closeModal();render()}}
}
function openMoveManager(pid){
  const tr=currentTrainer(),p=pokemonInstance(tr,pid);if(!p)return;const sp=speciesById(p.speciesId);ensurePokemonMoveProgress(p);const progression=naturalLearnset(sp),legalTM=sp.tmMoves;
  const body=`<div class="rule-note info-note"><strong>Natural moves unlock with level.</strong> The app records unlocked moves in the Relearnable Move Pool. You may only make a move active after it has actually been learned naturally or through a TM.</div><div class="grid grid-2" style="margin-top:16px"><div><div class="section-title">Active Moves ${p.activeMoves.length}/4</div>${p.activeMoves.length?p.activeMoves.map(n=>`<div class="feature"><div class="feature-name">${escapeHTML(n)}</div><button class="ghost-btn btn-sm" data-active-remove="${escapeHTML(n)}">Move to pool</button></div>`).join(''):'<div class="empty-state"><strong>No active moves</strong></div>'}</div><div><div class="section-title">Relearnable Move Pool</div>${p.relearnableMoves.length?p.relearnableMoves.map(n=>`<div class="feature"><div class="feature-name">${escapeHTML(n)}</div><button class="primary-btn btn-sm" data-active-add="${escapeHTML(n)}" ${p.activeMoves.includes(n)||p.activeMoves.length>=4?'disabled':''}>Make active</button></div>`).join(''):'<div class="empty-state"><strong>Pool is empty</strong></div>'}</div></div><div class="divider"></div><div class="section-title">Natural Move Progression</div><div class="check-grid">${progression.map(e=>{const learned=Number(e.unlockLevel)<=p.level;return `<div class="check-card ${learned?'':'move-locked'}"><span style="flex:1"><strong>${escapeHTML(e.name)}</strong><span class="tiny muted" style="display:block">Tabletop Lv ${e.unlockLevel} • Game Lv ${e.gameLevel}</span></span><span class="tag">${learned?'Learned':`Unlocks Lv ${e.unlockLevel}`}</span></div>`}).join('')}</div><div class="divider"></div><div class="section-title">TM Moves</div><div class="check-grid">${legalTM.map(n=>{const it=findItemByName('TM — '+n),owned=it?(tr.inventory[it.id]||0):0;return `<div class="check-card"><span style="flex:1">${escapeHTML(n)}</span><span class="tiny muted">TM ×${owned}</span><button class="ghost-btn btn-sm" data-use-tm="${escapeHTML(n)}" ${p.relearnableMoves.includes(n)||owned<1?'disabled':''}>Use TM</button></div>`}).join('')}</div>`;
  const m=modal(`${escapeHTML(p.nickname||sp.name)} — Moves`,body);
  $$('[data-active-remove]',m).forEach(b=>b.onclick=()=>{p.activeMoves=p.activeMoves.filter(n=>n!==b.dataset.activeRemove);saveState();closeModal();openMoveManager(pid)});
  $$('[data-active-add]',m).forEach(b=>b.onclick=()=>{if(p.activeMoves.length<4&&p.relearnableMoves.includes(b.dataset.activeAdd)&&!p.activeMoves.includes(b.dataset.activeAdd)){p.activeMoves.push(b.dataset.activeAdd);saveState();closeModal();openMoveManager(pid)}});
  $$('[data-use-tm]',m).forEach(b=>b.onclick=()=>useTM(pid,b.dataset.useTm));
}

function useTM(pid,moveName){
  const tr=currentTrainer(),p=pokemonInstance(tr,pid),sp=speciesById(p.speciesId),it=findItemByName('TM — '+moveName);if(!it||(tr.inventory[it.id]||0)<1||!(sp.tmMoves||[]).includes(moveName))return;
  let preserved=false;
  if(tr.className==='Technician'&&tr.level>=3) preserved=confirm('TM Specialist applies. Roll 1d6 physically. Did you roll 5–6 and preserve the TM?\n\nOK = preserved • Cancel = consumed');
  if(!preserved)addInventory(tr,it.id,-1);
  p.learnedTMMoves ||= [];
  if(!p.learnedTMMoves.includes(moveName))p.learnedTMMoves.push(moveName);
  ensurePokemonMoveProgress(p);saveState();closeModal();openMoveManager(pid);render();
}

function openHeldManager(pid){
  const tr=currentTrainer(),p=pokemonInstance(tr,pid),sp=speciesById(p.speciesId);const eligible=DATA.items.filter(i=>['Held Items','Berries'].includes(i.category)&&(availableQty(tr,i.id,pid)>0||p.heldItemId===i.id)); const held=p.heldItemId?itemById(p.heldItemId):null;
  const body=`<div class="rule-note warning-note"><strong>Held items are locked during combat.</strong> The app has no Battle Mode, so players must follow this rule themselves. Each Pokémon may hold one item, and duplicates require multiple owned copies.</div><div class="section-title" style="margin-top:18px">Current Item</div>${held?`<div class="feature"><div class="feature-name">${escapeHTML(held.name)}</div><div class="feature-text">${escapeHTML(held.effect)}</div><button class="ghost-btn btn-sm" style="margin-top:10px" data-held-clear>Unequip</button>${held.mode?.includes('Consumable')||held.category==='Berries'?`<button class="danger-btn btn-sm" style="margin-top:10px;margin-left:6px" data-held-consume>Record consumed</button>`:''}</div>`:'<div class="empty-state"><strong>No held item</strong></div>'}<div class="divider"></div><div class="section-title">Available Held Items</div><div class="feature-list">${eligible.filter(i=>i.id!==p.heldItemId).map(i=>`<div class="feature"><div class="feature-name">${escapeHTML(i.name)} <span class="tag">${escapeHTML(i.mode||i.category)}</span></div><div class="feature-text">${escapeHTML(i.effect)}</div><div class="tiny muted" style="margin:7px 0">Available copies: ${availableQty(tr,i.id,pid)}</div><button class="primary-btn btn-sm" data-held-equip="${i.id}">Equip</button></div>`).join('')||'<div class="empty-state"><strong>No available held items</strong><p>Buy or find items first.</p></div>'}</div>`;
  const m=modal(`${escapeHTML(p.nickname||sp.name)} — Held Item`,body);
  $('[data-held-clear]',m)?.addEventListener('click',()=>{p.heldItemId=null;saveState();closeModal();openPokemonSheet(pid);render()});
  $('[data-held-consume]',m)?.addEventListener('click',()=>{if(p.heldItemId){addInventory(tr,p.heldItemId,-1);p.heldItemId=null;saveState();closeModal();openPokemonSheet(pid);render()}});
  $$('[data-held-equip]',m).forEach(b=>b.onclick=()=>{p.heldItemId=b.dataset.heldEquip;saveState();closeModal();openPokemonSheet(pid);render()});
}
function evolvePokemon(pid,toId){
  const tr=currentTrainer(),p=pokemonInstance(tr,pid),e=DATA.evolutions.find(x=>x.from===p.speciesId&&x.to===toId);if(!e||!evolutionEligible(tr,p,e))return;const oldSp=speciesById(p.speciesId),newSp=speciesById(toId);if(!confirm(`Evolve ${p.nickname||oldSp.name} into ${newSp.name}?`))return;
  if(e.kind==='item'){const it=findItemByName(e.value);addInventory(tr,it.id,-1)} if(e.kind==='trade'){const it=findItemByName('Linking Cord');addInventory(tr,it.id,-1)}
  const oldMax=p.maxHp;p.speciesId=toId;p.lastEvolutionLevel=p.level;p.maxHp=maxPokemonHP(newSp,p.level);p.currentHp=Math.min(p.maxHp,p.currentHp+(p.maxHp-oldMax));ensurePokemonMoveProgress(p);setDexState(tr,toId,'caught');saveState();closeModal();render();openPokemonSheet(pid);
}

function openAddPokemon(prefillSpeciesId=null){
  const tr=currentTrainer(),initialSid=Number(prefillSpeciesId)||DATA.pokemon[0]?.id||1,initialSp=speciesById(initialSid),initialMax=maxPokemonHP(initialSp,1);
  const body=`<div class="form-grid"><div class="field"><label>Species</label><select id="add-species">${DATA.pokemon.map(p=>`<option value="${p.id}" ${p.id===initialSid?'selected':''}>${p.number} ${escapeHTML(p.name)}</option>`).join('')}</select></div><div class="field"><label>Level</label><input id="add-level" type="number" min="1" max="20" value="1"></div><div class="field"><label>Current HP</label><input id="add-current-hp" type="number" min="0" max="${initialMax}" placeholder="Leave blank for full HP"><div class="tiny muted" id="add-max-hp">Maximum HP at this level: ${initialMax}</div></div><div class="field"><label>Nickname</label><input id="add-nickname" placeholder="Optional"></div></div><div class="rule-note info-note" style="margin-top:16px">Use this after a successful capture, receiving a Pokémon, or when the GM instructs you to add one. For a captured Pokémon, enter the HP it had remaining when caught; capture does not heal it. Leave Current HP blank only when the Pokémon should enter at full health. Natural moves up to the chosen level are learned automatically.</div><button class="primary-btn" style="margin-top:18px" id="add-confirm">Add Pokémon</button>`;
  const m=modal('Add Pokémon',body),speciesSel=$('#add-species',m),levelInput=$('#add-level',m),hpInput=$('#add-current-hp',m),maxLabel=$('#add-max-hp',m);
  const refreshMax=()=>{const sp=speciesById(Number(speciesSel.value)),lv=Math.max(1,Math.min(20,Number(levelInput.value)||1)),mx=maxPokemonHP(sp,lv);hpInput.max=String(mx);maxLabel.textContent=`Maximum HP at this level: ${mx}`;if(hpInput.value!==''&&Number(hpInput.value)>mx)hpInput.value=String(mx)};
  speciesSel.onchange=refreshMax;levelInput.oninput=refreshMax;refreshMax();
  $('#add-confirm',m).onclick=()=>{const sid=Number(speciesSel.value),lv=Math.max(1,Math.min(20,Number(levelInput.value)||1)),nick=$('#add-nickname',m).value;const p=createPokemonInstance(sid,lv,nick),raw=hpInput.value.trim();if(raw!=='')p.currentHp=Math.max(0,Math.min(p.maxHp,Number(raw)||0));tr.pokemon.push(p);if(tr.partyIds.length<6)tr.partyIds.push(p.id);else tr.storageIds.push(p.id);if(!tr.activePokemonId&&tr.partyIds.includes(p.id))tr.activePokemonId=p.id;setDexState(tr,sid,'caught');saveState();closeModal();render();openPokemonSheet(p.id)}
}
function openAddPokemonWithSpecies(sid){openAddPokemon(sid)}
function healAtPokemonCenter(){
  const tr=currentTrainer(),party=partyPokemon(tr);if(!party.length){alert('There are no Pokémon in the active party to heal.');return}
  if(!confirm('Heal the current party at a Pokémon Center?\n\nThis restores party Pokémon to full HP, revives fainted Pokémon, clears conditions and temporary stat stages, and refills Nurse Care Charges. Pokémon in PC storage are not healed.'))return;
  for(const p of party){p.currentHp=p.maxHp;p.condition='';p.conditionRounds='';p.statStages={attack:0,defense:0,spAttack:0,spDefense:0,speed:0}}
  if(tr.className==='Nurse'){tr.classResources ||= {};tr.classResources.careCharges=nurseCareMax(tr)}
  saveState();render();
}

function openDex(sid){
  const tr=currentTrainer(),sp=speciesById(sid),ds=dexState(tr,sid);const body=`<div class="pokemon-sheet-head"><div class="pokemon-ident"><div class="pokemon-big-avatar">${initials(sp.name)}</div><div><div class="dex-no">${sp.number}</div><div class="pokemon-name">${escapeHTML(sp.name)}</div>${dexRank[ds]>=1?`<div>${typeBadges(sp.types)}</div>`:''}</div></div><div><span class="tag state-${ds}">${statusLabel(ds)}</span></div></div><div class="divider"></div><div class="btn-row"><button class="ghost-btn btn-sm" data-dex-state="seen">Mark Seen</button><button class="ghost-btn btn-sm" data-dex-state="scanned">Mark Scanned</button><button class="ghost-btn btn-sm" data-dex-state="caught">Mark Caught</button></div>${dexRank[ds]>=1?`<div class="grid grid-3" style="margin-top:18px"><div class="review-box"><div class="tiny muted">Weaknesses</div><strong class="small">${escapeHTML(sp.weaknesses)}</strong></div><div class="review-box"><div class="tiny muted">Resistances</div><strong class="small">${escapeHTML(sp.resistances)}</strong></div><div class="review-box"><div class="tiny muted">Immunities</div><strong class="small">${escapeHTML(sp.immunities)}</strong></div></div>`:`<div class="empty-state"><strong>Species details undiscovered</strong><p>Mark the species Seen when the GM reveals it.</p></div>`}${dexRank[ds]>=2?`<div class="divider"></div><div class="section-title">Scanned Species Data</div><div class="stat-grid"><div class="stat-box"><div class="stat-label">Base HP</div><div class="stat-score">${sp.baseHP}</div></div>${statKeys.map(([k,l])=>`<div class="stat-box ${['defense','spDefense'].includes(k)?'target-stat':''}"><div class="stat-label">${l}</div><div class="stat-score">${sp.stats[k].score}</div><div class="stat-mod">${fmtMod(sp.stats[k].mod)}</div></div>`).join('')}</div><div class="grid grid-3" style="margin-top:12px"><div class="review-box"><div class="tiny muted">Capture DC</div><strong>${sp.captureDC}</strong></div><div class="review-box"><div class="tiny muted">Threat</div><strong>${sp.threat}</strong></div><div class="review-box"><div class="tiny muted">Role</div><strong class="small">${escapeHTML(sp.combatRole)}</strong></div></div>`:''}${dexRank[ds]>=3?`<div class="divider"></div><div class="grid grid-2"><div><div class="section-title">Natural Moves</div>${naturalLearnset(sp).map(e=>`<span class="tag">Lv ${e.unlockLevel} ${escapeHTML(e.name)}</span>`).join('')}</div><div><div class="section-title">TM Moves</div>${sp.tmMoves.map(m=>`<span class="tag">${escapeHTML(m)}</span>`).join('')}</div></div>`:''}<div class="divider"></div><button class="primary-btn" data-add-this>Add ${escapeHTML(sp.name)} to collection</button>`;const m=modal(`${sp.number} ${escapeHTML(sp.name)}`,body);$$('[data-dex-state]',m).forEach(b=>b.onclick=()=>{setDexState(tr,sid,b.dataset.dexState);closeModal();render();openDex(sid)});$('[data-add-this]',m).onclick=()=>{closeModal();openAddPokemonWithSpecies(sid)}
}
function openMove(name){const m=moveByName(name);if(!m)return;modal(escapeHTML(m.name),`<div>${typeBadges([m.type])}<span class="tag">${escapeHTML(m.kind)}</span></div><div class="section-kicker" style="margin-top:16px">${escapeHTML(m.group)}</div><div class="rule-note info-note" style="font-size:1rem;line-height:1.55">${escapeHTML(m.rules)}</div><div class="small muted" style="margin-top:14px">Roll and resolve this move physically at the table. This app deliberately contains no dice roller.</div>`)}
function openItem(id){const it=itemById(id);if(!it)return;modal(escapeHTML(it.name),`<div><span class="tag">${escapeHTML(it.category)}</span>${it.mode?`<span class="tag">${escapeHTML(it.mode)}</span>`:''}${it.subtype?`<span class="tag">${escapeHTML(it.subtype)}</span>`:''}</div><div class="rule-note info-note" style="margin-top:16px">${escapeHTML(it.effect||'No additional V1 rules text.')}</div><div class="divider"></div><div class="grid grid-2"><div class="review-box"><div class="tiny muted">Shop price</div><strong>${it.price==null?'Not sold':`₽${it.price.toLocaleString()}`}</strong></div><div class="review-box"><div class="tiny muted">Sell price</div><strong>${it.price==null?'—':`₽${Math.floor(it.price/2).toLocaleString()}`}</strong></div></div>`)}

function buyItem(id){const tr=currentTrainer(),it=itemById(id);if(!it||it.price==null||tr.money<it.price)return;tr.money-=it.price;addInventory(tr,id,1);saveState();render()}
function sellItem(id){const tr=currentTrainer(),it=itemById(id);if(!it||it.price==null||availableQty(tr,id)<=0)return;addInventory(tr,id,-1);tr.money+=Math.floor(it.price/2);saveState();render()}
function adjustItem(id,delta){const tr=currentTrainer();if(delta<0&&availableQty(tr,id)<=0)return;addInventory(tr,id,delta);saveState();render()}
function openFindItem(){
  const tr=currentTrainer(); const body=`<div class="field"><label>Item</label><select id="found-item">${DATA.items.map(i=>`<option value="${i.id}">${escapeHTML(i.name)} — ${escapeHTML(i.category)}</option>`).join('')}</select></div><div class="field" style="margin-top:12px"><label>Quantity</label><input id="found-qty" type="number" min="1" max="99" value="1"></div><button class="primary-btn" style="margin-top:16px" id="found-add">Add to Bag</button>`;const m=modal('Record Found Item',body);$('#found-add',m).onclick=()=>{addInventory(tr,$('#found-item',m).value,Math.max(1,Number($('#found-qty',m).value)||1));saveState();closeModal();render()}
}

function openReference(){
  const conditions=Object.entries(DATA.conditions).map(([n,t])=>`<div class="feature"><div class="feature-name">${n}</div><div class="feature-text">${escapeHTML(t)}</div></div>`).join('');
  const chart=DATA['type-chart'].map(r=>`<div class="item-row" style="grid-template-columns:100px 1.4fr 1.6fr 110px"><div>${typeBadges([r.attack])}</div><div class="small"><strong>×2:</strong> ${escapeHTML(r.super)}</div><div class="small"><strong>×½:</strong> ${escapeHTML(r.resisted)}</div><div class="small"><strong>×0:</strong> ${escapeHTML(r.immune)}</div></div>`).join('');
  modal('Rules Reference',`<div class="rule-note info-note"><strong>No dice automation.</strong> These are quick-reference rules only.</div><div class="section-title" style="margin-top:18px">Conditions</div><div class="feature-list">${conditions}</div><div class="divider"></div><div class="section-title">Technique Abilities</div><div class="feature-list"><div class="feature"><div class="feature-name">Fly</div><div class="feature-text">Eligible Flying-type Pokémon spend their normal 30-ft movement through the air, including vertical movement and suitable obstacles. It is not an attack.</div></div><div class="feature"><div class="feature-name">Dig</div><div class="feature-text">Eligible Ground-type Pokémon spend normal movement underground through suitable earth or soil. Solid constructed barriers block it. It is not an attack.</div></div><div class="feature"><div class="feature-name">Dive</div><div class="feature-text">Eligible Water-type Pokémon spend normal movement underwater without ordinary underwater movement penalties. It is not an attack.</div></div><div class="feature"><div class="feature-name">Bounce</div><div class="feature-text">Eligible Flying-type Pokémon spend normal movement on extraordinary vertical or horizontal leaps and suitable gaps. It is not an attack.</div></div></div><div class="divider"></div><div class="section-title">Type Chart</div><div style="overflow:auto">${chart}</div>`)
}
function openCharacters(){
  const tr=currentTrainer(); const body=`<div class="section-title">Characters</div><div class="feature-list">${state.trainers.map(t=>`<div class="feature"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><div class="feature-name">${escapeHTML(t.name)}</div><div class="feature-text">Level ${t.level} ${escapeHTML(t.className)}</div></div><button class="${t.id===state.activeTrainerId?'secondary-btn':'ghost-btn'} btn-sm" data-switch-trainer="${t.id}">${t.id===state.activeTrainerId?'Active':'Switch'}</button></div></div>`).join('')}</div><button class="primary-btn" style="margin-top:14px" data-new-trainer>Create another Trainer</button><div class="divider"></div><div class="section-title">Backup</div><p class="small muted">All playtest data is stored locally in this browser. Export a JSON backup before clearing browser data or moving devices.</p><div class="btn-row"><button class="ghost-btn" data-export>Export backup</button><label class="ghost-btn" style="cursor:pointer">Import backup<input type="file" accept="application/json" data-import style="display:none"></label></div><div class="divider"></div><button class="danger-btn" data-delete-trainer>Delete active Trainer</button>`;const m=modal('Characters & Backup',body);$$('[data-switch-trainer]',m).forEach(b=>b.onclick=()=>{state.activeTrainerId=b.dataset.switchTrainer;saveState();closeModal();ui.route='home';render()});$('[data-new-trainer]',m).onclick=()=>{closeModal();ui.route='creator';ui.creatorDraft=null;ui.creatorStep=1;render()};$('[data-export]',m).onclick=exportBackup;$('[data-import]',m).onchange=importBackup;$('[data-delete-trainer]',m).onclick=()=>{if(confirm(`Delete ${tr.name}? This cannot be undone unless you exported a backup.`)){state.trainers=state.trainers.filter(t=>t.id!==tr.id);state.activeTrainerId=state.trainers[0]?.id||null;saveState();closeModal();if(!state.activeTrainerId){ui.route='creator';ui.creatorDraft=null}else ui.route='home';render()}}
}
function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pokemon-d20-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function importBackup(e){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const s=JSON.parse(r.result);if(!Array.isArray(s.trainers))throw new Error('Invalid backup');state=s;for(const tr of state.trainers){ensureEncounterResources(tr);for(const p of (tr.pokemon||[]))ensurePokemonMoveProgress(p,{initializeActive:true,migrateLegacy:true})}saveState();closeModal();ui.route='home';render()}catch(err){alert('That file is not a valid Pokémon d20 Companion backup.')}};r.readAsText(f)}
function openEditTrainer(){const tr=currentTrainer();const body=`<div class="form-grid"><div class="field"><label>Name</label><input id="edit-name" value="${escapeHTML(tr.name)}"></div><div class="field"><label>Money</label><input id="edit-money" type="number" min="0" value="${tr.money}"></div></div><div class="section-title" style="margin-top:18px">Ability Scores</div><div class="form-grid">${abilities.map(([ab,short])=>`<div class="field"><label>${short}</label><input data-edit-ability="${ab}" type="number" min="1" max="20" value="${tr.abilityScores[ab]}"></div>`).join('')}</div><button class="primary-btn" style="margin-top:18px" id="edit-save">Save changes</button>`;const m=modal('Edit Trainer',body);$('#edit-save',m).onclick=()=>{tr.name=$('#edit-name',m).value.trim()||tr.name;tr.money=Math.max(0,Number($('#edit-money',m).value)||0);$$('[data-edit-ability]',m).forEach(i=>tr.abilityScores[i.dataset.editAbility]=Math.max(1,Math.min(20,Number(i.value)||10)));const oldMax=tr.hpMax;tr.hpMax=trainerMaxHP(tr);tr.hpCurrent=Math.min(tr.hpMax,Math.max(0,tr.hpCurrent+(tr.hpMax-oldMax)));if(tr.className==='Nurse')tr.classResources.careCharges=Math.min(nurseCareMax(tr),tr.classResources.careCharges??nurseCareMax(tr));saveState();closeModal();render()}}
function applyTrainerLevel(tr,newLevel){
  const oldMax=tr.hpMax;tr.level=newLevel;tr.hpMax=trainerMaxHP(tr);tr.hpCurrent=Math.min(tr.hpMax,Math.max(0,tr.hpCurrent+(tr.hpMax-oldMax)));
  if(tr.className==='Nurse'){tr.classResources ||= {};const mx=nurseCareMax(tr);tr.classResources.careCharges=Math.min(mx,tr.classResources.careCharges??mx)}
  resetEncounterResources(tr);
}
function openASIModal(tr){
  const opts=abilities.map(([ab,short])=>`<option value="${ab}">${short} — ${ab} (${tr.abilityScores[ab]})</option>`).join('');
  const body=`<div class="rule-note info-note"><strong>Level 4 Ability Score Improvement</strong><br>Choose +2 to one ability, or +1 to two different abilities. No ability can exceed 20.</div><div class="field" style="margin-top:16px"><label>Improvement</label><select id="asi-mode"><option value="2">+2 to one ability</option><option value="1+1">+1 to two abilities</option></select></div><div class="form-grid" style="margin-top:12px"><div class="field"><label>Ability</label><select id="asi-a">${opts}</select></div><div class="field" id="asi-b-wrap" style="display:none"><label>Second ability</label><select id="asi-b">${opts}</select></div></div><div id="asi-preview" class="small muted" style="margin-top:12px"></div><button class="primary-btn" style="margin-top:16px" id="asi-apply">Apply ASI & Advance to Level 4</button>`;
  const m=modal('Level 4 — Ability Score Improvement',body),mode=$('#asi-mode',m),a=$('#asi-a',m),b=$('#asi-b',m),wrap=$('#asi-b-wrap',m),preview=$('#asi-preview',m);
  const refresh=()=>{wrap.style.display=mode.value==='1+1'?'block':'none';const aa=a.value,bb=b.value;preview.textContent=mode.value==='2'?`${aa}: ${tr.abilityScores[aa]} → ${Math.min(20,tr.abilityScores[aa]+2)}`:`${aa}: ${tr.abilityScores[aa]} → ${Math.min(20,tr.abilityScores[aa]+1)}${aa===bb?' • Choose two different abilities':` • ${bb}: ${tr.abilityScores[bb]} → ${Math.min(20,tr.abilityScores[bb]+1)}`}`};
  mode.onchange=refresh;a.onchange=refresh;b.onchange=refresh;refresh();
  $('#asi-apply',m).onclick=()=>{const aa=a.value,bb=b.value;if(mode.value==='1+1'&&aa===bb){alert('Choose two different abilities for +1 / +1.');return}if(mode.value==='2'){if(tr.abilityScores[aa]>=20){alert(`${aa} is already 20.`);return}tr.abilityScores[aa]=Math.min(20,tr.abilityScores[aa]+2)}else{if(tr.abilityScores[aa]>=20||tr.abilityScores[bb]>=20){alert('Choose abilities below 20.');return}tr.abilityScores[aa]++;tr.abilityScores[bb]++}applyTrainerLevel(tr,4);saveState();closeModal();render()};
}
function trainerLevelUp(){
  const tr=currentTrainer();if(tr.level>=5)return;
  if(tr.level===3){if(!confirm(`Advance ${tr.name} from Trainer Level 3 to Level 4? You will choose an Ability Score Improvement next.`))return;openASIModal(tr);return}
  if(!confirm(`Advance ${tr.name} from Trainer Level ${tr.level} to ${tr.level+1}? Trainer advancement is milestone-based.`))return;
  applyTrainerLevel(tr,tr.level+1);saveState();render();
}


// Service worker registration. The app still works without it when run locally.
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});

loadData().then(()=>{
  seedPremadeCharacters();
  let migrated=false;
  for(const tr of state.trainers){const beforeResources=JSON.stringify(tr.encounterResources||{});ensureEncounterResources(tr);if(JSON.stringify(tr.encounterResources||{})!==beforeResources)migrated=true;for(const p of (tr.pokemon||[])){const before=JSON.stringify([p.activeMoves,p.relearnableMoves,p.learnedTMMoves,p.moveProgressionMigrated]);ensurePokemonMoveProgress(p,{initializeActive:true,migrateLegacy:true});if(JSON.stringify([p.activeMoves,p.relearnableMoves,p.learnedTMMoves,p.moveProgressionMigrated])!==before)migrated=true}}
  if(migrated)saveState();
  if(!state.activeTrainerId && state.trainers[0]) state.activeTrainerId=state.trainers[0].id;
  if(!state.trainers.length){ui.route='creator';ui.creatorDraft=null}
  render();
}).catch(err=>{
  console.error(err);$('#app').innerHTML=`<div class="app-loading"><div class="loading-card"><h1>Could not load app data</h1><p>Start the app through the included local server script instead of opening index.html directly.</p><pre>${escapeHTML(err.message)}</pre></div></div>`;
});
