import './style.css'
import { supabase } from './supabase.js'

const DEFAULT_AFFIRMATIONS = [
  'I am calm, grounded, and safe initiating conversations with people I don’t yet know.',
  'I am someone who finishes small actions daily, and those actions compound into extraordinary impact.',
  'I am trusted because I lead with curiosity, dignity, and integrity.',
  'I am disciplined and consistent, even when conditions are imperfect.',
  'I am the man who executes what he designs and gives others permission to do the same.',
  'I am the first multimillionaire in my family.'
]

const GOAL_STATEMENTS = {
  'Prosperity': 'I live in overflow. Abundance flows to me from multiple sources and I always have more than enough.',
  'Wellness / Fitness': 'I am strong, disciplined, and in the best shape of my life. My body is powerful and I treat it that way every day.',
  'Happiness': 'I am genuinely happy. I live with joy, presence, and gratitude — and I choose it daily.',
  'Freedom': 'I am free. My time, my money, and my choices belong to me. I live life on my terms.',
  'Wealth': 'I am wealthy. I am the first multimillionaire in my family and my daily actions reflect that reality.',
  'Travel': 'I explore the world with ease and joy. Travel is a natural, regular part of my life with Tony and beyond.',
  'Discipline': 'I am a disciplined man. I show up consistently, I do what I said I would do, and my identity is unshakeable.',
  'Performing Magician': 'I am a confident, skilled performer. I create wonder and connection wherever I go.',
  'Ambassador Mentor': 'I am a Master Mentor. I build leaders who build leaders and my GU organization grows with purpose and momentum.',
  'Growing my GIVER network': 'I am surrounded by a thriving, global community of Givers who uplift each other and change the world together.'
}

const DEFAULT_GOALS = Object.keys(GOAL_STATEMENTS)
const DEFAULT_TRICKS = ['B’Wave', 'Will to Read', 'Shadow Wallet Routine', 'Card Opener']
const MANIFESTATION_PROMPTS = [
  'The Already Life — Today I am living as if everything I desire is already mine. In this life, I…',
  'Gratitude for What’s Coming — I am so grateful that I now have… because it means…',
  'The Feeling — When I imagine my life fully realized, what I feel most is… and today that shows up as…',
  'Evidence — I can already see my dreams becoming real. The proof I see today is…',
  'The Version of Me — The version of me who has everything I desire woke up today and…',
  'Letter from Future Evan — Dear present Evan, I’m writing from the life you built. Here’s what you need to know…',
  'Overflow — I give freely because I live in abundance. Today that abundance looks like…'
]

const STAGES = ['Outreach', 'Conversation', 'Sample', 'Video', 'Video Follow-Up', 'Patron or Giver']
const ROLES = ['Patron','Giver','Senior Giver','Mentor Candidate','Mentor','Senior Mentor Candidate','Senior Mentor','Master Mentor Candidate','Master Mentor','Chancellor Mentor Candidate','Chancellor Mentor','Ambassador Mentor Candidate','Ambassador Mentor']

let state = {
  user: null,
  active: 'dashboard',
  selectedDate: new Date().toISOString().slice(0, 10),
  daily: null,
  settings: null,
  affirmations: [],
  goals: [],
  tricks: [],
  magic: [],
  prospects: [],
  family: [],
  finances: [],
  relationships: [],
  logs28: []
}

const $ = (id) => document.getElementById(id)
const today = () => new Date().toISOString().slice(0, 10)
const addDays = (dateString, days) => { const d = new Date(dateString + 'T12:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10) }
const monthStart = (dateString = state.selectedDate) => dateString.slice(0, 8) + '01'
const weekStart = (dateString = state.selectedDate) => {
  const d = new Date(dateString + 'T12:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}
const pct = (value, target) => Math.min(100, Math.round((Number(value || 0) / Number(target || 1)) * 100))
const sentenceCount = (text) => (text || '').split(/[.!?]+/).map(s => s.trim()).filter(Boolean).length
const gratitudeArray = () => Array.isArray(state.daily?.gratitude) ? state.daily.gratitude : []

function completeForLog(log) {
  const gratitude = Array.isArray(log?.gratitude) ? log.gratitude : []
  const wisdom = gratitude.filter(x => String(x || '').trim()).length >= 5 && log?.affirmed === true
  const wealth = log?.reach_outs !== null && log?.reach_outs !== undefined && log?.samples !== null && log?.samples !== undefined && log?.six_w !== null && log?.six_w !== undefined
  const wellness = !!log?.workout_status && log?.bevel_recovery !== null && log?.bevel_recovery !== undefined && log?.bevel_sleep !== null && log?.bevel_sleep !== undefined && log?.bevel_strain !== null && log?.bevel_strain !== undefined && log?.bevel_stress !== null && log?.bevel_stress !== undefined
  return { wisdom, wealth, wellness, give: wisdom && wealth && wellness, partial: wisdom || wealth || wellness }
}

async function init() {
  const { data } = await supabase.auth.getSession()
  state.user = data.session?.user || null
  supabase.auth.onAuthStateChange(async (_event, session) => { state.user = session?.user || null; await render() })
  await render()
}

async function render() {
  if (!state.user) {
    document.querySelector('#app').innerHTML = authView()
    bindAuth()
    return
  }
  await loadAll()
  document.querySelector('#app').innerHTML = shellView()
  bindShell()
}

function authView() {
  return `<div class="auth"><div class="card auth-card"><h1>The GIVE Day Hub</h1><p class="tag">Focused Energy. One Action. Shipped Daily.</p><div class="notice">Sign in or create your account. Your data will sync through Supabase.</div><label>Email</label><input id="email" type="email" placeholder="you@example.com" /><label>Password</label><input id="password" type="password" placeholder="At least 6 characters" /><div class="footer-actions"><button class="primary" id="signin">Sign In</button><button id="signup">Create Account</button></div><p id="authmsg" class="small muted"></p></div></div>`
}

function bindAuth() {
  $('signin').onclick = async () => { const { error } = await supabase.auth.signInWithPassword({ email: $('email').value, password: $('password').value }); $('authmsg').textContent = error ? error.message : 'Signed in.' }
  $('signup').onclick = async () => { const { error } = await supabase.auth.signUp({ email: $('email').value, password: $('password').value }); $('authmsg').textContent = error ? error.message : 'Account created. Sign in once confirmed.' }
}

async function loadAll() {
  const user_id = state.user.id
  await ensureDefaults(user_id)
  const { data: daily } = await supabase.from('daily_logs').select('*').eq('user_id', user_id).eq('log_date', state.selectedDate).maybeSingle()
  state.daily = daily || (await supabase.from('daily_logs').insert({ user_id, log_date: state.selectedDate, gratitude: [] }).select().single()).data

  const from28 = addDays(state.selectedDate, -27)
  const queries = await Promise.all([
    supabase.from('settings').select('*').eq('user_id', user_id).maybeSingle(),
    supabase.from('affirmations').select('*').eq('user_id', user_id).order('sort_order'),
    supabase.from('goals').select('*').eq('user_id', user_id).order('sort_order'),
    supabase.from('magic_repertoire').select('*').eq('user_id', user_id).order('trick_name'),
    supabase.from('magic_practice').select('*').eq('user_id', user_id).order('practice_date', { ascending: false }),
    supabase.from('prospects').select('*').eq('user_id', user_id).order('created_at', { ascending: false }),
    supabase.from('gu_family').select('*').eq('user_id', user_id).order('created_at', { ascending: false }),
    supabase.from('finances').select('*').eq('user_id', user_id).gte('entry_date', monthStart()).order('entry_date', { ascending: false }),
    supabase.from('relationships').select('*').eq('user_id', user_id).gte('connection_date', weekStart()).order('connection_date', { ascending: false }),
    supabase.from('daily_logs').select('*').eq('user_id', user_id).gte('log_date', from28).lte('log_date', state.selectedDate).order('log_date')
  ])
  state.settings = queries[0].data
  state.affirmations = uniqueByText(queries[1].data || [], 'text')
  state.goals = uniqueByText(queries[2].data || [], 'name')
  state.tricks = uniqueByText(queries[3].data || [], 'trick_name')
  state.magic = queries[4].data || []
  state.prospects = queries[5].data || []
  state.family = queries[6].data || []
  state.finances = queries[7].data || []
  state.relationships = queries[8].data || []
  state.logs28 = queries[9].data || []
}

function uniqueByText(rows, key) {
  const seen = new Set()
  return rows.filter(row => { const value = String(row[key] || '').trim().toLowerCase(); if (seen.has(value)) return false; seen.add(value); return true })
}

async function ensureDefaults(user_id) {
  const { data: settings } = await supabase.from('settings').select('*').eq('user_id', user_id).maybeSingle()
  if (!settings) await supabase.from('settings').insert({ user_id })

  const { data: affRows } = await supabase.from('affirmations').select('text').eq('user_id', user_id)
  const existingAff = new Set((affRows || []).map(a => a.text))
  const missingAff = DEFAULT_AFFIRMATIONS.filter(text => !existingAff.has(text)).map((text, i) => ({ user_id, text, sort_order: i }))
  if (missingAff.length) await supabase.from('affirmations').insert(missingAff)

  const { data: goalRows } = await supabase.from('goals').select('name').eq('user_id', user_id)
  const existingGoals = new Set((goalRows || []).map(g => g.name))
  const missingGoals = DEFAULT_GOALS.filter(name => !existingGoals.has(name)).map((name, i) => ({ user_id, name, status: 'Active', next_action: '', sort_order: i }))
  if (missingGoals.length) await supabase.from('goals').insert(missingGoals)

  const { data: trickRows } = await supabase.from('magic_repertoire').select('trick_name').eq('user_id', user_id)
  const existingTricks = new Set((trickRows || []).map(t => t.trick_name))
  const missingTricks = DEFAULT_TRICKS.filter(trick_name => !existingTricks.has(trick_name)).map(trick_name => ({ user_id, trick_name, active: true }))
  if (missingTricks.length) await supabase.from('magic_repertoire').insert(missingTricks)
}

function shellView() {
  return `<header><div class="wrap"><div class="top"><div><h1>The GIVE Day Hub</h1><p class="tag">The Giver’s Scoreboard</p></div><div class="footer-actions"><button id="prevDate">←</button><div class="date-pill">${state.selectedDate}</div><button id="nextDate">→</button><button id="todayDate">Today</button></div></div><nav>${navButton('dashboard','Dashboard')}${navButton('wisdom','Wisdom')}${navButton('wealth','Wealth')}${navButton('wellness','Wellness')}${navButton('settings','Settings')}<button id="signout">Sign Out</button></nav></div></header><main>${state.active === 'dashboard' ? dashboardView() : ''}${state.active === 'wisdom' ? wisdomView() : ''}${state.active === 'wealth' ? wealthView() : ''}${state.active === 'wellness' ? wellnessView() : ''}${state.active === 'settings' ? settingsView() : ''}</main>`
}

function navButton(key, label) { return `<button class="nav ${state.active === key ? 'active' : ''}" data-tab="${key}">${label}</button>` }
function bindShell() {
  document.querySelectorAll('.nav').forEach(btn => btn.onclick = async () => { state.active = btn.dataset.tab; await render() })
  $('signout').onclick = async () => { await supabase.auth.signOut() }
  $('prevDate').onclick = async () => { state.selectedDate = addDays(state.selectedDate, -1); await render() }
  $('nextDate').onclick = async () => { state.selectedDate = addDays(state.selectedDate, 1); await render() }
  $('todayDate').onclick = async () => { state.selectedDate = today(); await render() }
  if (state.active === 'wisdom') bindWisdom()
  if (state.active === 'wealth') bindWealth()
  if (state.active === 'wellness') bindWellness()
  if (state.active === 'settings') bindSettings()
}

function dashboardView() {
  const c = completeForLog(state.daily)
  const weekLogs = state.logs28.filter(x => x.log_date >= weekStart())
  const monthLogs = state.logs28.filter(x => x.log_date >= monthStart())
  const sum = (arr, key) => arr.reduce((t, x) => t + Number(x[key] || 0), 0)
  const workouts = weekLogs.filter(x => x.workout_status === 'Yes').length
  const wisdomDays = weekLogs.filter(x => completeForLog(x).wisdom).length
  const giveMonth = monthLogs.filter(x => completeForLog(x).give).length
  const income = state.finances.filter(x => x.entry_type === 'Income').reduce((t, x) => t + Number(x.amount || 0), 0)
  return `<div class="grid"><section class="card span8"><h2>GIVE Day Status</h2><div class="status-grid">${statusCard('📖','Wisdom',c.wisdom,'Gratitude + Affirmations')}${statusCard('💰','Wealth',c.wealth,'GU Daily Ratios')}${statusCard('💪','Wellness',c.wellness,'Workout + Bevel')}</div><div class="crown">${c.give ? 'This date is a GIVE Day 👑' : 'This date is still in progress'}</div></section><section class="card span4"><h2>Daily Affirmation</h2><p><strong>${escapeHtml(affirmationSpotlight())}</strong></p></section><section class="card span6"><h2>GIVE Day Streak</h2><div class="kpi-line"><strong>Current streak ending ${state.selectedDate}</strong><strong>${currentStreak()}</strong></div><div class="heatmap">${heatmap()}</div></section><section class="card span6"><h2>Master Ratio Scorecard</h2>${kpi('GU Daily Reach Outs', state.daily.reach_outs || 0, state.settings.daily_reach_outs)}${kpi('GU Weekly Reach Outs', sum(weekLogs,'reach_outs'), state.settings.weekly_reach_outs)}${kpi('GU Monthly Reach Outs', sum(monthLogs,'reach_outs'), state.settings.monthly_reach_outs)}${kpi('Weekly Workouts', workouts, state.settings.weekly_workout_days)}${kpi('Wisdom Practices This Week', wisdomDays, 7)}${kpi('Income This Month', income, state.settings.monthly_income_goal, '$')}${kpi('GIVE Days This Month', giveMonth, new Date(state.selectedDate + 'T12:00:00').getDate())}</section></div>`
}
function statusCard(icon, title, done, note) { return `<div class="status ${done ? 'done' : ''}"><div class="icon">${done ? '✓' : icon}</div><strong>${title}</strong><div class="small muted">${note}</div></div>` }
function kpi(label, value, target, prefix = '') { return `<div class="kpi"><div class="kpi-line"><strong>${label}</strong><span>${prefix}${value} / ${prefix}${target}</span></div><div class="bar"><span style="width:${pct(value,target)}%"></span></div></div>` }
function affirmationSpotlight() { if (!state.affirmations.length) return DEFAULT_AFFIRMATIONS[0]; const day = Math.floor(new Date(state.selectedDate + 'T12:00:00').getTime()/86400000); return state.affirmations[day % state.affirmations.length]?.text }
function manifestationPrompt() { const day = Math.floor(new Date(state.selectedDate + 'T12:00:00').getTime()/86400000); return MANIFESTATION_PROMPTS[day % MANIFESTATION_PROMPTS.length] }
function currentStreak() { let streak = 0; const byDate = Object.fromEntries(state.logs28.map(l => [l.log_date,l])); for (let i=0;i<28;i++){ const key=addDays(state.selectedDate,-i); if (completeForLog(byDate[key]).give) streak++; else break } return streak }
function heatmap() { const byDate = Object.fromEntries(state.logs28.map(l => [l.log_date,l])); let html=''; for(let i=27;i>=0;i--){ const key=addDays(state.selectedDate,-i); const d=new Date(key+'T12:00:00'); const c=completeForLog(byDate[key]); const cls=c.give?'full':c.partial?'partial':'missed'; html += `<div class="daybox ${cls}"><strong>${d.getDate()}</strong><br>${c.give?'GIVE':c.partial?'Partial':'Missed'}</div>` } return html }

function wisdomView() {
  const gratitude = gratitudeArray()
  return `<div class="grid"><section class="card span6"><h2>Gratitude</h2>${[0,1,2,3,4].map(i => `<label>Gratitude ${i+1}</label><input id="grat${i}" value="${escapeHtml(gratitude[i] || '')}" />`).join('')}<button class="primary" id="saveGratitude">Save Gratitude</button></section><section class="card span6"><h2>Affirmations</h2><div class="list">${state.affirmations.map(a => `<div class="item"><strong>${escapeHtml(a.text)}</strong></div>`).join('')}</div><button class="primary" id="affirmToday">${state.daily.affirmed ? 'Affirmed Today ✓' : 'I Affirmed Today'}</button></section><section class="card span6"><h2>Manifestation</h2><div class="notice"><strong>Today’s Prompt:</strong><br>${escapeHtml(manifestationPrompt())}</div><textarea id="manifestation">${escapeHtml(state.daily.manifestation || '')}</textarea><p class="small muted">Complete when 3+ present-tense sentences are saved. Current: ${sentenceCount(state.daily.manifestation)}</p><button class="primary" id="saveManifestation">Save Manifestation</button></section><section class="card span6"><h2>Magic Practice</h2><label>Trick</label><select id="magicTrick">${state.tricks.filter(t => t.active).map(t => `<option>${escapeHtml(t.trick_name)}</option>`).join('')}</select><label>Minutes</label><input id="magicMinutes" type="number" value="10" /><label>Practice Note</label><textarea id="magicNote"></textarea><button class="primary" id="saveMagic">Log Magic Practice</button></section><section class="card span12"><h2>Goals</h2><div class="list">${state.goals.map(goalItem).join('')}</div></section></div>`
}
function goalItem(g) { const statement = GOAL_STATEMENTS[g.name] || ''; return `<div class="item"><h3>${escapeHtml(g.name)}</h3><p><strong>${escapeHtml(statement)}</strong></p><div class="row"><div class="col3"><label>Status</label><select data-goal="${g.id}" class="goalStatus"><option ${g.status==='Active'?'selected':''}>Active</option><option ${g.status==='Paused'?'selected':''}>Paused</option><option ${g.status==='Achieved'?'selected':''}>Achieved</option></select></div><div class="col4"><label>Next Single Action</label><input data-goal="${g.id}" class="goalNext" value="${escapeHtml(g.next_action || '')}" /></div><div class="col5"><label>Monthly Reflection</label><input data-goal="${g.id}" class="goalReflection" value="${escapeHtml(g.monthly_reflection || '')}" /></div></div></div>` }
function bindWisdom() {
  $('saveGratitude').onclick = async () => updateDaily({ gratitude: [0,1,2,3,4].map(i => $(`grat${i}`).value) })
  $('affirmToday').onclick = async () => updateDaily({ affirmed: true })
  $('saveManifestation').onclick = async () => updateDaily({ manifestation: $('manifestation').value })
  $('saveMagic').onclick = async () => { await supabase.from('magic_practice').insert({ user_id: state.user.id, practice_date: state.selectedDate, trick_name: $('magicTrick').value, minutes: Number($('magicMinutes').value || 0), note: $('magicNote').value }); await render() }
  document.querySelectorAll('.goalStatus,.goalNext,.goalReflection').forEach(el => el.onchange = saveGoal)
}
async function saveGoal(e) { const id=e.target.dataset.goal; const card=e.target.closest('.item'); await supabase.from('goals').update({ status: card.querySelector('.goalStatus').value, next_action: card.querySelector('.goalNext').value, monthly_reflection: card.querySelector('.goalReflection').value }).eq('id',id).eq('user_id',state.user.id); await render() }

function wealthView() {
  const weekLogs = state.logs28.filter(x => x.log_date >= weekStart())
  const monthLogs = state.logs28.filter(x => x.log_date >= monthStart())
  const sum = (arr, key) => arr.reduce((t, x) => t + Number(x[key] || 0), 0)
  const income = state.finances.filter(x => x.entry_type === 'Income').reduce((t,x)=>t+Number(x.amount||0),0)
  const expenses = state.finances.filter(x => x.entry_type === 'Expense').reduce((t,x)=>t+Number(x.amount||0),0)
  return `<div class="grid"><section class="card span4"><h2>GU Daily Ratios</h2><label>Reach Outs</label><input id="reachOuts" type="number" value="${state.daily.reach_outs ?? ''}" /><label>Samples</label><input id="samples" type="number" value="${state.daily.samples ?? ''}" /><label>6-W Conversations</label><input id="sixW" type="number" value="${state.daily.six_w ?? ''}" /><button class="primary" id="saveGU">Save GU Ratios</button></section><section class="card span4"><h2>GU Weekly Summary</h2>${kpi('Weekly Reach Outs', sum(weekLogs,'reach_outs'), state.settings.weekly_reach_outs)}${kpi('Weekly Samples', sum(weekLogs,'samples'), state.settings.weekly_samples)}${kpi('Weekly 6-W', sum(weekLogs,'six_w'), state.settings.weekly_six_w)}</section><section class="card span4"><h2>GU Monthly Summary</h2>${kpi('Monthly Reach Outs', sum(monthLogs,'reach_outs'), state.settings.monthly_reach_outs)}${kpi('Monthly Samples', sum(monthLogs,'samples'), state.settings.monthly_samples)}${kpi('Monthly 6-W', sum(monthLogs,'six_w'), state.settings.monthly_six_w)}</section><section class="card span4"><h2>Income & Expenses</h2>${kpi('Income', income, state.settings.monthly_income_goal, '$')}<div class="kpi-line"><strong>Expenses</strong><span>$${expenses}</span></div><div class="kpi-line"><strong>Net</strong><span>$${income-expenses}</span></div><label>Type</label><select id="finType"><option>Income</option><option>Expense</option></select><label>Source / Description</label><input id="finDesc" /><label>Amount</label><input id="finAmount" type="number" /><label>Category</label><select id="finCat"><option>Business</option><option>Personal</option><option>Subscription</option><option>Travel</option><option>Other</option></select><button class="primary" id="saveFinance">Add Entry</button><div class="list">${state.finances.map(financeItem).join('')}</div></section><section class="card span4"><h2>Pipeline Tracker</h2><input id="prospectName" placeholder="Name" /><label>Stage</label><select id="prospectStage">${STAGES.map(s=>`<option>${s}</option>`).join('')}</select><label>Next Step</label><input id="prospectNext" /><button class="primary" id="addProspect">Add Prospect</button><div class="list">${state.prospects.map(prospectItem).join('')}</div></section><section class="card span4"><h2>GU Family Roster</h2><input id="familyName" placeholder="Name" /><label>Role</label><select id="familyRole">${ROLES.map(r=>`<option>${r}</option>`).join('')}</select><label>Phone</label><input id="familyPhone" /><label>Email</label><input id="familyEmail" /><button class="primary" id="addFamily">Add Person</button><div class="list">${state.family.map(familyItem).join('')}</div></section></div>`
}
function prospectItem(p){ return `<div class="item"><label>Name</label><input id="pname-${p.id}" value="${escapeHtml(p.name)}"><label>Stage</label><select id="pstage-${p.id}">${STAGES.map(s=>`<option ${p.stage===s?'selected':''}>${s}</option>`).join('')}</select><label>Next Step</label><input id="pnext-${p.id}" value="${escapeHtml(p.next_step||'')}"><div class="footer-actions"><button class="saveProspect" data-id="${p.id}">Save</button><button class="danger deleteProspect" data-id="${p.id}">Delete</button></div></div>` }
function familyItem(f){ return `<div class="item"><label>Name</label><input id="fname-${f.id}" value="${escapeHtml(f.name)}"><label>Role</label><select id="frole-${f.id}">${ROLES.map(r=>`<option ${f.role===r?'selected':''}>${r}</option>`).join('')}</select><label>Phone</label><input id="fphone-${f.id}" value="${escapeHtml(f.phone||'')}"><label>Email</label><input id="femail-${f.id}" value="${escapeHtml(f.email||'')}"><div class="footer-actions"><button class="saveFamily" data-id="${f.id}">Save</button><button class="danger deleteFamily" data-id="${f.id}">Delete</button></div></div>` }
function financeItem(f){ const desc=f.source||f.description||''; return `<div class="item"><strong>${escapeHtml(f.entry_type)}</strong><label>Description</label><input id="findesc-${f.id}" value="${escapeHtml(desc)}"><label>Amount</label><input id="finamount-${f.id}" type="number" value="${f.amount}"><div class="footer-actions"><button class="saveFin" data-id="${f.id}" data-type="${f.entry_type}">Save</button><button class="danger deleteFin" data-id="${f.id}">Delete</button></div></div>` }
function bindWealth() {
  $('saveGU').onclick = async () => updateDaily({ reach_outs: Number($('reachOuts').value || 0), samples: Number($('samples').value || 0), six_w: Number($('sixW').value || 0) })
  $('saveFinance').onclick = async () => { const type=$('finType').value; await supabase.from('finances').insert({ user_id:state.user.id, entry_type:type, source:type==='Income' ? $('finDesc').value : null, description:type==='Expense' ? $('finDesc').value : null, amount:Number($('finAmount').value||0), entry_date:state.selectedDate, category:$('finCat').value }); await render() }
  $('addProspect').onclick = async () => { await supabase.from('prospects').insert({ user_id:state.user.id, name:$('prospectName').value, stage:$('prospectStage').value, last_contact:state.selectedDate, next_step:$('prospectNext').value }); await render() }
  $('addFamily').onclick = async () => { await supabase.from('gu_family').insert({ user_id:state.user.id, name:$('familyName').value, role:$('familyRole').value, phone:$('familyPhone').value, email:$('familyEmail').value, date_joined:state.selectedDate }); await render() }
  document.querySelectorAll('.saveProspect').forEach(b=>b.onclick=async()=>{const id=b.dataset.id; await supabase.from('prospects').update({name:$(`pname-${id}`).value, stage:$(`pstage-${id}`).value, next_step:$(`pnext-${id}`).value, last_contact:state.selectedDate}).eq('id',id); await render()})
  document.querySelectorAll('.deleteProspect').forEach(b=>b.onclick=async()=>{await supabase.from('prospects').delete().eq('id',b.dataset.id); await render()})
  document.querySelectorAll('.saveFamily').forEach(b=>b.onclick=async()=>{const id=b.dataset.id; await supabase.from('gu_family').update({name:$(`fname-${id}`).value, role:$(`frole-${id}`).value, phone:$(`fphone-${id}`).value, email:$(`femail-${id}`).value}).eq('id',id); await render()})
  document.querySelectorAll('.deleteFamily').forEach(b=>b.onclick=async()=>{await supabase.from('gu_family').delete().eq('id',b.dataset.id); await render()})
  document.querySelectorAll('.saveFin').forEach(b=>b.onclick=async()=>{const id=b.dataset.id, type=b.dataset.type, desc=$(`findesc-${id}`).value; await supabase.from('finances').update({source:type==='Income'?desc:null, description:type==='Expense'?desc:null, amount:Number($(`finamount-${id}`).value||0)}).eq('id',id); await render()})
  document.querySelectorAll('.deleteFin').forEach(b=>b.onclick=async()=>{await supabase.from('finances').delete().eq('id',b.dataset.id); await render()})
}

function wellnessView() { return `<div class="grid"><section class="card span4"><h2>Workout Log</h2><label>Status</label><select id="workoutStatus"><option></option><option ${state.daily.workout_status==='Yes'?'selected':''}>Yes</option><option ${state.daily.workout_status==='Rest Day'?'selected':''}>Rest Day</option><option ${state.daily.workout_status==='Missed'?'selected':''}>Missed</option></select><label>Type</label><select id="workoutType"><option></option><option ${state.daily.workout_type==='Strength'?'selected':''}>Strength</option><option ${state.daily.workout_type==='Cardio'?'selected':''}>Cardio</option><option ${state.daily.workout_type==='Mobility'?'selected':''}>Mobility</option><option ${state.daily.workout_type==='Mixed'?'selected':''}>Mixed</option></select><label>Duration</label><input id="workoutDuration" type="number" value="${state.daily.workout_duration ?? ''}" /><label>Notes</label><textarea id="workoutNotes">${escapeHtml(state.daily.workout_notes || '')}</textarea><button class="primary" id="saveWorkout">Save Workout</button></section><section class="card span4"><h2>Recovery & Bevel</h2><label>Recovery %</label><input id="bevelRecovery" type="number" value="${state.daily.bevel_recovery ?? ''}" /><label>Sleep %</label><input id="bevelSleep" type="number" value="${state.daily.bevel_sleep ?? ''}" /><label>Strain %</label><input id="bevelStrain" type="number" value="${state.daily.bevel_strain ?? ''}" /><label>Stress Score</label><input id="bevelStress" type="number" value="${state.daily.bevel_stress ?? ''}" /><button class="primary" id="saveBevel">Save Bevel Data</button></section><section class="card span4"><h2>Relationships</h2><label>Person / Group</label><input id="relPerson" /><label>Type</label><select id="relType"><option>Friend</option><option>Community</option><option>Giver Outreach</option><option>Partner</option><option>Family</option></select><label>Note</label><textarea id="relNote"></textarea><button class="primary" id="saveRelationship">Log Connection</button><div class="list">${state.relationships.map(r=>`<div class="item"><strong>${escapeHtml(r.person_group||'Social Rest Day')}</strong><p>${escapeHtml(r.connection_type||'')}</p><textarea id="rnote-${r.id}">${escapeHtml(r.note||'')}</textarea><div class="footer-actions"><button class="saveRel" data-id="${r.id}">Save</button><button class="danger deleteRel" data-id="${r.id}">Delete</button></div></div>`).join('')}</div></section></div>` }
function bindWellness() { $('saveWorkout').onclick = async () => updateDaily({ workout_status:$('workoutStatus').value, workout_type:$('workoutType').value, workout_duration:Number($('workoutDuration').value||0), workout_notes:$('workoutNotes').value }); $('saveBevel').onclick = async () => updateDaily({ bevel_recovery:Number($('bevelRecovery').value||0), bevel_sleep:Number($('bevelSleep').value||0), bevel_strain:Number($('bevelStrain').value||0), bevel_stress:Number($('bevelStress').value||0) }); $('saveRelationship').onclick = async () => { await supabase.from('relationships').insert({ user_id:state.user.id, connection_date:state.selectedDate, person_group:$('relPerson').value, connection_type:$('relType').value, note:$('relNote').value }); await render() }; document.querySelectorAll('.saveRel').forEach(b=>b.onclick=async()=>{await supabase.from('relationships').update({note:$(`rnote-${b.dataset.id}`).value}).eq('id',b.dataset.id); await render()}); document.querySelectorAll('.deleteRel').forEach(b=>b.onclick=async()=>{await supabase.from('relationships').delete().eq('id',b.dataset.id); await render()}) }

function settingsView() { return `<div class="grid"><section class="card span6"><h2>Targets Manager</h2><div class="row">${settingInput('daily_reach_outs','Daily Reach Outs')}${settingInput('daily_samples','Daily Samples')}${settingInput('daily_six_w','Daily 6-W')}${settingInput('weekly_reach_outs','Weekly Reach Outs')}${settingInput('weekly_samples','Weekly Samples')}${settingInput('weekly_six_w','Weekly 6-W')}${settingInput('monthly_reach_outs','Monthly Reach Outs')}${settingInput('monthly_samples','Monthly Samples')}${settingInput('monthly_six_w','Monthly 6-W')}${settingInput('weekly_workout_days','Weekly Workout Days')}${settingInput('monthly_income_goal','Monthly Income Goal')}${settingInput('monthly_give_day_target','Monthly GIVE Day Target')}</div><label>Affirmation Rotation</label><select id="affirmation_rotation"><option ${state.settings.affirmation_rotation==='sequential'?'selected':''}>sequential</option><option ${state.settings.affirmation_rotation==='random'?'selected':''}>random</option></select><button class="primary" id="saveSettings">Save Settings</button></section><section class="card span6"><h2>Affirmations Manager</h2><input id="newAffirmation" /><button class="primary" id="addAffirmation">Add Affirmation</button><div class="list">${state.affirmations.map(a=>`<div class="item"><input id="aff-${a.id}" value="${escapeHtml(a.text)}"><div class="footer-actions"><button class="saveAff" data-id="${a.id}">Save</button><button class="danger deleteAff" data-id="${a.id}">Delete</button></div></div>`).join('')}</div></section><section class="card span6"><h2>Magic Repertoire Manager</h2><input id="newTrick" /><button class="primary" id="addTrick">Add Trick</button><div class="list">${state.tricks.map(t=>`<div class="item"><strong>${escapeHtml(t.trick_name)}</strong> <span class="badge">${t.active?'Active':'Archived'}</span></div>`).join('')}</div></section><section class="card span6"><h2>Goals Manager</h2><p class="muted">Goals are edited in the Wisdom Hub.</p><div class="list">${state.goals.map(g=>`<div class="item"><strong>${escapeHtml(g.name)}</strong></div>`).join('')}</div></section></div>` }
function settingInput(key,label){ return `<div class="col4"><label>${label}</label><input id="${key}" type="number" value="${state.settings[key] ?? ''}" /></div>` }
function bindSettings(){ $('saveSettings').onclick=async()=>{ const payload={}; ['daily_reach_outs','daily_samples','daily_six_w','weekly_reach_outs','weekly_samples','weekly_six_w','monthly_reach_outs','monthly_samples','monthly_six_w','weekly_workout_days','monthly_income_goal','monthly_give_day_target'].forEach(k=>payload[k]=Number($(k).value)); payload.affirmation_rotation=$('affirmation_rotation').value; await supabase.from('settings').update(payload).eq('user_id',state.user.id); await render() }; $('addAffirmation').onclick=async()=>{ await supabase.from('affirmations').insert({user_id:state.user.id,text:$('newAffirmation').value,sort_order:state.affirmations.length}); await render() }; $('addTrick').onclick=async()=>{ await supabase.from('magic_repertoire').insert({user_id:state.user.id,trick_name:$('newTrick').value,active:true}); await render() }; document.querySelectorAll('.saveAff').forEach(b=>b.onclick=async()=>{await supabase.from('affirmations').update({text:$(`aff-${b.dataset.id}`).value}).eq('id',b.dataset.id); await render()}); document.querySelectorAll('.deleteAff').forEach(b=>b.onclick=async()=>{await supabase.from('affirmations').delete().eq('id',b.dataset.id); await render()}) }

async function updateDaily(payload) { const { data, error } = await supabase.from('daily_logs').upsert({ id:state.daily.id, user_id:state.user.id, log_date:state.selectedDate, ...payload, updated_at:new Date().toISOString() }, { onConflict:'user_id,log_date' }).select().single(); if(error) alert(error.message); else { state.daily=data; await render() } }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) }

init()
