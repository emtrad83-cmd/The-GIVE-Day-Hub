import './style.css'
import { supabase } from './supabase.js'

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
  'Growing My GIVER Network': 'I am surrounded by a thriving, global community of Givers who uplift each other and change the world together.'
}

const DEFAULT_AFFIRMATIONS = [
  'I am calm, grounded, and safe initiating conversations with people I don’t yet know.',
  'I am someone who finishes small actions daily, and those actions compound into extraordinary impact.',
  'I am trusted because I lead with curiosity, dignity, and integrity.',
  'I am disciplined and consistent, even when conditions are imperfect.',
  'I am the man who executes what he designs and gives others permission to do the same.',
  'I am the first multimillionaire in my family.'
]

const MANIFESTATION_PROMPTS = [
  'The Already Life — Today I am living as if everything I desire is already mine. In this life, I…',
  'Gratitude for What’s Coming — I am so grateful that I now have… because it means…',
  'The Feeling — When I imagine my life fully realized, what I feel most is… and today that shows up as…',
  'Evidence — I can already see my dreams becoming real. The proof I see today is…',
  'The Version of Me — The version of me who has everything I desire woke up today and…',
  'Letter from Future Evan — Dear present Evan, I’m writing from the life you built. Here’s what you need to know…',
  'Overflow — I give freely because I live in abundance. Today that abundance looks like…'
]

const DEFAULT_TRICKS = ['B’Wave', 'Will to Read', 'Shadow Wallet Routine', 'Card Opener']
const STAGES = ['Outreach', 'Conversation', 'Sample', 'Video', 'Video Follow-Up', 'Patron or Giver']
const ROLES = ['Patron','Giver','Senior Giver','Mentor Candidate','Mentor','Senior Mentor Candidate','Senior Mentor','Master Mentor Candidate','Master Mentor','Chancellor Mentor Candidate','Chancellor Mentor','Ambassador Mentor Candidate','Ambassador Mentor']

let state = {
  user: null,
  active: 'dashboard',
  selectedDate: localStorage.getItem('giveHubSelectedDate') || new Date().toISOString().slice(0, 10),
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
  goalProgress: [],
  logs28: [],
  savedButton: null,
  savedText: null
}

const $ = (id) => document.getElementById(id)
const today = () => new Date().toISOString().slice(0, 10)
const selectedMonthStart = () => state.selectedDate.slice(0, 8) + '01'
const weekStartFor = (dateStr = state.selectedDate) => {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}
const pct = (value, target) => Math.min(100, Math.round((Number(value || 0) / Number(target || 1)) * 100))
const sentenceCount = (text) => (text || '').split(/[.!?]+/).map(s => s.trim()).filter(Boolean).length
const dateNumber = (dateStr) => Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 86400000)
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
  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null
    await render()
  })
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
  return `
    <div class="auth">
      <div class="card auth-card">
        <h1>The GIVE Day Hub</h1>
        <p class="tag">Focused Energy. One Action. Shipped Daily.</p>
        <div class="notice">Sign in or create your account. Your data will sync through Supabase.</div>
        <label>Email</label>
        <input id="email" type="email" placeholder="you@example.com" />
        <label>Password</label>
        <input id="password" type="password" placeholder="At least 6 characters" />
        <div class="footer-actions">
          <button class="primary" id="signin">Sign In</button>
          <button id="signup">Create Account</button>
        </div>
        <p id="authmsg" class="small muted"></p>
      </div>
    </div>
  `
}

function bindAuth() {
  $('signin').onclick = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: $('email').value, password: $('password').value })
    $('authmsg').textContent = error ? error.message : 'Signed in.'
  }
  $('signup').onclick = async () => {
    const { error } = await supabase.auth.signUp({ email: $('email').value, password: $('password').value })
    $('authmsg').textContent = error ? error.message : 'Account created. Check email if confirmation is required, then sign in.'
  }
}

async function loadAll() {
  const user_id = state.user.id
  await ensureDefaults(user_id)

  const { data: daily } = await supabase.from('daily_logs').select('*').eq('user_id', user_id).eq('log_date', state.selectedDate).maybeSingle()
  if (!daily) {
    const { data } = await supabase.from('daily_logs').insert({ user_id, log_date: state.selectedDate, gratitude: [] }).select().single()
    state.daily = data
  } else state.daily = daily

  const from28 = new Date(state.selectedDate + 'T00:00:00')
  from28.setDate(from28.getDate() - 27)
  const fromDate = from28.toISOString().slice(0, 10)
  const toDate = state.selectedDate
  const weekStart = weekStartFor()

  const queries = await Promise.all([
    supabase.from('settings').select('*').eq('user_id', user_id).maybeSingle(),
    supabase.from('affirmations').select('*').eq('user_id', user_id).order('sort_order'),
    supabase.from('goals').select('*').eq('user_id', user_id).order('sort_order'),
    supabase.from('magic_repertoire').select('*').eq('user_id', user_id).order('trick_name'),
    supabase.from('magic_practice').select('*').eq('user_id', user_id).lte('practice_date', toDate).order('practice_date', { ascending: false }),
    supabase.from('prospects').select('*').eq('user_id', user_id).order('created_at', { ascending: false }),
    supabase.from('gu_family').select('*').eq('user_id', user_id).order('created_at', { ascending: false }),
    supabase.from('finances').select('*').eq('user_id', user_id).gte('entry_date', selectedMonthStart()).order('entry_date', { ascending: false }),
    supabase.from('relationships').select('*').eq('user_id', user_id).gte('connection_date', weekStart).lte('connection_date', toDate).order('connection_date', { ascending: false }),
    supabase.from('goal_progress').select('*').eq('user_id', user_id).gte('progress_date', weekStart).lte('progress_date', toDate).order('progress_date', { ascending: false }),
    supabase.from('daily_logs').select('*').eq('user_id', user_id).gte('log_date', fromDate).lte('log_date', toDate).order('log_date')
  ])

  state.settings = queries[0].data
  state.affirmations = queries[1].data || []
  state.goals = queries[2].data || []
  state.tricks = queries[3].data || []
  state.magic = queries[4].data || []
  state.prospects = queries[5].data || []
  state.family = queries[6].data || []
  state.finances = queries[7].data || []
  state.relationships = queries[8].data || []
  state.goalProgress = queries[9].data || []
  state.logs28 = queries[10].data || []
}

async function ensureDefaults(user_id) {
  const { data: settings } = await supabase.from('settings').select('*').eq('user_id', user_id).maybeSingle()
  if (!settings) await supabase.from('settings').insert({ user_id })

  for (let i = 0; i < DEFAULT_AFFIRMATIONS.length; i++) {
    const text = DEFAULT_AFFIRMATIONS[i]
    const { data } = await supabase.from('affirmations').select('id').eq('user_id', user_id).eq('text', text).maybeSingle()
    if (!data) await supabase.from('affirmations').insert({ user_id, text, sort_order: i })
  }

  const names = Object.keys(GOAL_STATEMENTS)
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    const identity_statement = GOAL_STATEMENTS[name]
    const { data } = await supabase.from('goals').select('id, identity_statement').eq('user_id', user_id).eq('name', name).maybeSingle()
    if (!data) await supabase.from('goals').insert({ user_id, name, identity_statement, status: 'Active', next_action: '', sort_order: i })
    else if (!data.identity_statement) await supabase.from('goals').update({ identity_statement }).eq('id', data.id).eq('user_id', user_id)
  }

  for (const trick_name of DEFAULT_TRICKS) {
    const { data } = await supabase.from('magic_repertoire').select('id').eq('user_id', user_id).eq('trick_name', trick_name).maybeSingle()
    if (!data) await supabase.from('magic_repertoire').insert({ user_id, trick_name, active: true, performance_ready: false })
  }
}

function shellView() {
  return `
    <header>
      <div class="wrap">
        <div class="top">
          <div>
            <h1>The GIVE Day Hub</h1>
            <p class="tag">The Giver’s Scoreboard</p>
          </div>
          <div class="date-controls">
            <button id="prevDate">←</button>
            <div class="date-pill">${state.selectedDate}</div>
            <button id="nextDate">→</button>
            <button id="todayBtn">Today</button>
          </div>
        </div>
        <nav>
          ${navButton('dashboard','Dashboard')}
          ${navButton('wisdom','Wisdom')}
          ${navButton('wealth','Wealth')}
          ${navButton('wellness','Wellness')}
          ${navButton('settings','Settings')}
          <button id="signout">Sign Out</button>
        </nav>
      </div>
    </header>
    <main>
      ${state.active === 'dashboard' ? dashboardView() : ''}
      ${state.active === 'wisdom' ? wisdomView() : ''}
      ${state.active === 'wealth' ? wealthView() : ''}
      ${state.active === 'wellness' ? wellnessView() : ''}
      ${state.active === 'settings' ? settingsView() : ''}
    </main>
  `
}

function navButton(key, label) {
  return `<button class="nav ${state.active === key ? 'active' : ''}" data-tab="${key}">${label}</button>`
}

function bindShell() {
  document.querySelectorAll('.nav').forEach(btn => btn.onclick = async () => { state.active = btn.dataset.tab; await render() })
  $('signout').onclick = async () => { await supabase.auth.signOut() }
  $('prevDate').onclick = () => changeDate(-1)
  $('nextDate').onclick = () => changeDate(1)
  $('todayBtn').onclick = () => setDate(today())
  if (state.active === 'wisdom') bindWisdom()
  if (state.active === 'wealth') bindWealth()
  if (state.active === 'wellness') bindWellness()
  if (state.active === 'settings') bindSettings()
  applySavedFeedback()
}

async function changeDate(delta) {
  const d = new Date(state.selectedDate + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  await setDate(d.toISOString().slice(0, 10))
}

async function setDate(dateStr) {
  state.selectedDate = dateStr
  localStorage.setItem('giveHubSelectedDate', dateStr)
  await render()
}

function dashboardView() {
  const c = completeForLog(state.daily)
  const weekLogs = state.logs28.filter(x => x.log_date >= weekStartFor())
  const monthLogs = state.logs28.filter(x => x.log_date >= selectedMonthStart())
  const sum = (arr, key) => arr.reduce((t, x) => t + Number(x[key] || 0), 0)

  const workouts = weekLogs.filter(x => x.workout_status === 'Yes').length
  const recoveryDays = weekLogs.filter(x => x.bevel_recovery !== null && x.bevel_recovery !== undefined).length
  const wisdomDays = weekLogs.filter(x => completeForLog(x).wisdom).length
  const magicDaysWeek = uniquePracticeDays(state.magic.filter(m => m.practice_date >= weekStartFor() && m.practice_date <= state.selectedDate))
  const giveMonth = monthLogs.filter(x => completeForLog(x).give).length
  const income = state.finances.filter(x => x.entry_type === 'Income').reduce((t, x) => t + Number(x.amount || 0), 0)

  return `
    <div class="grid">
      <section class="card span8">
        <h2>GIVE Day Status</h2>
        <div class="status-grid">
          ${statusCard('📖', 'Wisdom', c.wisdom, 'Gratitude + Affirmations')}
          ${statusCard('💰', 'Wealth', c.wealth, 'GU Daily Ratios')}
          ${statusCard('💪', 'Wellness', c.wellness, 'Workout + Bevel')}
        </div>
        <div class="crown">${c.give ? 'Today is a GIVE Day 👑' : 'Today is still in progress'}</div>
      </section>

      <section class="card span4">
        <h2>Daily Affirmation</h2>
        <p><strong>${escapeHtml(affirmationSpotlight())}</strong></p>
      </section>

      <section class="card span6">
        <h2>GIVE Day Streak</h2>
        <div class="kpi-line"><strong>Current streak</strong><strong>${currentStreak()}</strong></div>
        <div class="heatmap">${heatmap()}</div>
      </section>

      <section class="card span6">
        <h2>Master Ratio Scorecard</h2>
        ${kpi('Daily Reach Outs', state.daily.reach_outs || 0, state.settings.daily_reach_outs)}
        ${kpi('Daily Samples', state.daily.samples || 0, state.settings.daily_samples)}
        ${kpi('Daily 6-W', state.daily.six_w || 0, state.settings.daily_six_w)}
        ${kpi('Weekly Reach Outs', sum(weekLogs,'reach_outs'), state.settings.weekly_reach_outs)}
        ${kpi('Weekly Samples', sum(weekLogs,'samples'), state.settings.weekly_samples)}
        ${kpi('Weekly 6-W', sum(weekLogs,'six_w'), state.settings.weekly_six_w)}
        ${kpi('Monthly Reach Outs', sum(monthLogs,'reach_outs'), state.settings.monthly_reach_outs)}
        ${kpi('Monthly Samples', sum(monthLogs,'samples'), state.settings.monthly_samples)}
        ${kpi('Monthly 6-W', sum(monthLogs,'six_w'), state.settings.monthly_six_w)}
        ${kpi('Wisdom Days This Week', wisdomDays, 7)}
        ${kpi('Magic Practice Days This Week', magicDaysWeek, 7)}
        ${kpi('Income This Month', income, state.settings.monthly_income_goal, '$')}
        ${kpi('GIVE Days This Month', giveMonth, new Date(state.selectedDate + 'T00:00:00').getDate())}
      </section>

      <section class="card span6">
        <h2>Goal Tracker</h2>
        ${goalTrackerView()}
      </section>

      <section class="card span6">
        <h2>Magic Progress</h2>
        ${magicProgressView(magicDaysWeek)}
      </section>

      <section class="card span6">
        <h2>Wellness Ratios</h2>
        ${kpi('Workout Days This Week', workouts, state.settings.weekly_workout_days)}
        ${kpi('Recovery Data Days This Week', recoveryDays, 7)}
        ${kpi('Intentional Connections This Week', state.relationships.length, 7)}
        <div class="kpi-line"><strong>Today’s Workout Status</strong><span>${escapeHtml(state.daily.workout_status || 'Not logged')}</span></div>
        <div class="kpi-line"><strong>Today’s Recovery</strong><span>${state.daily.bevel_recovery ?? '—'}%</span></div>
      </section>
    </div>
  `
}

function goalTrackerView() {
  const movedThisWeek = new Set(state.goalProgress.map(p => p.goal_id)).size
  const counts = {
    Active: state.goals.filter(g => g.status === 'Active').length,
    Paused: state.goals.filter(g => g.status === 'Paused').length,
    Achieved: state.goals.filter(g => g.status === 'Achieved').length
  }
  const activeGoals = state.goals.filter(g => g.status === 'Active')
  return `
    <div class="goal-summary">
      <div class="goal-count"><strong>${counts.Active}</strong>Active</div>
      <div class="goal-count"><strong>${counts.Paused}</strong>Paused</div>
      <div class="goal-count"><strong>${counts.Achieved}</strong>Achieved</div>
    </div>
    <div class="kpi" style="margin-top:12px;"><div class="kpi-line"><strong>Goals Moved This Week</strong><span>${movedThisWeek}</span></div></div>
    <h3 style="margin-top:16px;">Next Single Actions</h3>
    <div class="list">
      ${activeGoals.length ? activeGoals.map(g => `
        <div class="item">
          <div class="item-top"><strong>${escapeHtml(g.name)}</strong><span class="badge">${escapeHtml(g.status)}</span></div>
          <p class="small tight">${escapeHtml(g.next_action || 'No next action set yet.')}</p>
        </div>`).join('') : '<p class="muted">No active goals right now.</p>'}
    </div>
  `
}

function magicProgressView(magicDaysWeek) {
  const activeTricks = state.tricks.filter(t => t.active)
  const readyTricks = state.tricks.filter(t => t.performance_ready)
  const last = state.magic[0]
  return `
    ${kpi('Practice Streak', magicPracticeStreak(), 7)}
    ${kpi('Active Rotation', activeTricks.length, state.settings.target_repertoire_size || 6)}
    ${kpi('Performance Ready', readyTricks.length, state.settings.performance_ready_goal || 4)}
    ${kpi('Practice Days This Week', magicDaysWeek, 7)}
    <div class="kpi-line"><strong>Last Trick Practiced</strong><span>${last ? escapeHtml(last.trick_name) : 'None yet'}</span></div>
  `
}

function statusCard(icon, title, done, note) {
  return `<div class="status ${done ? 'done' : ''}"><div class="icon">${done ? '✓' : icon}</div><strong>${title}</strong><div class="small muted">${note}</div></div>`
}

function kpi(label, value, target, prefix = '') {
  return `<div class="kpi"><div class="kpi-line"><strong>${label}</strong><span>${prefix}${value} / ${prefix}${target}</span></div><div class="bar"><span style="width:${pct(value,target)}%"></span></div></div>`
}

function affirmationSpotlight() {
  if (!state.affirmations.length) return 'I am someone who finishes small actions daily.'
  const day = dateNumber(state.selectedDate)
  if (state.settings?.affirmation_rotation === 'random') return state.affirmations[day % state.affirmations.length]?.text
  return state.affirmations[day % state.affirmations.length]?.text
}

function manifestationPrompt() {
  return MANIFESTATION_PROMPTS[dateNumber(state.selectedDate) % MANIFESTATION_PROMPTS.length]
}

function currentStreak() {
  let streak = 0
  const logsByDate = Object.fromEntries(state.logs28.map(l => [l.log_date, l]))
  for (let i = 0; i < 28; i++) {
    const d = new Date(state.selectedDate + 'T00:00:00')
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (completeForLog(logsByDate[key]).give) streak++
    else break
  }
  return streak
}

function magicPracticeStreak() {
  const days = new Set(state.magic.map(m => m.practice_date))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(state.selectedDate + 'T00:00:00')
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (days.has(key)) streak++
    else break
  }
  return streak
}

function uniquePracticeDays(records) {
  return new Set(records.map(r => r.practice_date)).size
}

function heatmap() {
  const logsByDate = Object.fromEntries(state.logs28.map(l => [l.log_date, l]))
  let html = ''
  for (let i = 27; i >= 0; i--) {
    const d = new Date(state.selectedDate + 'T00:00:00')
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const log = logsByDate[key]
    const c = completeForLog(log)
    const cls = c.give ? 'full' : c.partial ? 'partial' : 'missed'
    html += `<div class="daybox ${cls}"><strong>${d.getDate()}</strong><br>${c.give ? 'GIVE' : c.partial ? 'Partial' : 'Missed'}</div>`
  }
  return html
}

function wisdomView() {
  const gratitude = gratitudeArray()
  return `
    <div class="grid">
      <section class="card span6">
        <h2>Gratitude</h2>
        ${[0,1,2,3,4].map(i => `<label>Gratitude ${i+1}</label><input id="grat${i}" value="${escapeHtml(gratitude[i] || '')}" />`).join('')}
        <button class="primary" id="saveGratitude">Save Gratitude</button>
      </section>

      <section class="card span6">
        <h2>Affirmations</h2>
        <div class="list">${state.affirmations.map(a => `
          <div class="item">
            <strong>${escapeHtml(a.text)}</strong>
          </div>`).join('')}</div>
        <button class="primary" id="affirmToday">${state.daily.affirmed ? 'Affirmed Today ✓' : 'I Affirmed Today'}</button>
      </section>

      <section class="card span6">
        <h2>Manifestation</h2>
        <div class="prompt-box"><strong>Today’s Prompt</strong><br>${escapeHtml(manifestationPrompt())}</div>
        <textarea id="manifestation">${escapeHtml(state.daily.manifestation || '')}</textarea>
        <p class="small muted">Complete when 3+ present-tense sentences are saved. Current: ${sentenceCount(state.daily.manifestation)}</p>
        <button class="primary" id="saveManifestation">Save Manifestation</button>
      </section>

      <section class="card span6">
        <h2>Magic Practice</h2>
        <label>Trick</label>
        <select id="magicTrick">${state.tricks.filter(t => t.active).map(t => `<option>${escapeHtml(t.trick_name)}</option>`).join('')}</select>
        <label>Minutes</label><input id="magicMinutes" type="number" value="10" />
        <label>Practice Note</label><textarea id="magicNote"></textarea>
        <button class="primary" id="saveMagic">Log Magic Practice</button>
      </section>

      <section class="card span12">
        <h2>Goals</h2>
        <p class="muted">Log what you did today to move a goal forward. Goal setup still lives in Settings.</p>
        <div class="list">${state.goals.map(g => `
          <div class="item">
            <div class="item-top"><strong>${escapeHtml(g.name)}</strong><span class="badge">${escapeHtml(g.status || 'Active')}</span></div>
            <p>${escapeHtml(g.identity_statement || GOAL_STATEMENTS[g.name] || '')}</p>
            <p class="small"><strong>Next action:</strong> ${escapeHtml(g.next_action || 'No next action set yet.')}</p>
            <label>Progress today</label>
            <textarea class="goalProgressNote" data-goal="${g.id}" placeholder="What did you do today to move this goal forward?"></textarea>
            <button class="primary logGoalProgress" data-goal="${g.id}">Log Progress</button>
          </div>`).join('')}
        </div>
      </section>
    </div>
  `
}

function bindWisdom() {
  $('saveGratitude').onclick = async () => {
    const gratitude = [0,1,2,3,4].map(i => $(`grat${i}`).value)
    await updateDaily({ gratitude }, 'saveGratitude', 'Saved ✓')
  }
  $('affirmToday').onclick = async () => updateDaily({ affirmed: true }, 'affirmToday', 'Affirmed ✓')
  $('saveManifestation').onclick = async () => updateDaily({ manifestation: $('manifestation').value }, 'saveManifestation', 'Saved ✓')
  $('saveMagic').onclick = async () => {
    await supabase.from('magic_practice').insert({ user_id: state.user.id, practice_date: state.selectedDate, trick_name: $('magicTrick').value, minutes: Number($('magicMinutes').value || 0), note: $('magicNote').value })
    state.savedButton = 'saveMagic'
    state.savedText = 'Logged ✓'
    await render()
  }
  document.querySelectorAll('.logGoalProgress').forEach(btn => btn.onclick = async () => {
    const goalId = btn.dataset.goal
    const note = btn.closest('.item').querySelector('.goalProgressNote').value.trim()
    if (!note) {
      alert('Add a quick progress note first.')
      return
    }
    await supabase.from('goal_progress').insert({ user_id: state.user.id, goal_id: goalId, progress_date: state.selectedDate, progress_note: note })
    state.savedButton = null
    state.savedText = null
    btn.classList.add('saved')
    btn.textContent = 'Logged ✓'
    setTimeout(() => { btn.classList.remove('saved'); btn.textContent = 'Log Progress' }, 1600)
  })
}

function wealthView() {
  const weekLogs = state.logs28.filter(x => x.log_date >= weekStartFor())
  const monthLogs = state.logs28.filter(x => x.log_date >= selectedMonthStart())
  const sum = (arr, key) => arr.reduce((t, x) => t + Number(x[key] || 0), 0)
  const income = state.finances.filter(x => x.entry_type === 'Income').reduce((t, x) => t + Number(x.amount || 0), 0)
  const expenses = state.finances.filter(x => x.entry_type === 'Expense').reduce((t, x) => t + Number(x.amount || 0), 0)

  return `
    <div class="grid">
      <section class="card span4">
        <h2>GU Daily Ratios</h2>
        <label>Reach Outs</label><input id="reachOuts" type="number" value="${state.daily.reach_outs ?? ''}" />
        <label>Samples</label><input id="samples" type="number" value="${state.daily.samples ?? ''}" />
        <label>6-W Conversations</label><input id="sixW" type="number" value="${state.daily.six_w ?? ''}" />
        <button class="primary" id="saveGU">Save GU Ratios</button>
      </section>

      <section class="card span4">
        <h2>GU Weekly Summary</h2>
        ${kpi('Weekly Reach Outs', sum(weekLogs,'reach_outs'), state.settings.weekly_reach_outs)}
        ${kpi('Weekly Samples', sum(weekLogs,'samples'), state.settings.weekly_samples)}
        ${kpi('Weekly 6-W', sum(weekLogs,'six_w'), state.settings.weekly_six_w)}
      </section>

      <section class="card span4">
        <h2>GU Monthly Summary</h2>
        ${kpi('Monthly Reach Outs', sum(monthLogs,'reach_outs'), state.settings.monthly_reach_outs)}
        ${kpi('Monthly Samples', sum(monthLogs,'samples'), state.settings.monthly_samples)}
        ${kpi('Monthly 6-W', sum(monthLogs,'six_w'), state.settings.monthly_six_w)}
      </section>

      <section class="card span4">
        <h2>Income & Expenses</h2>
        ${kpi('Income', income, state.settings.monthly_income_goal, '$')}
        <div class="kpi-line"><strong>Expenses</strong><span>$${expenses}</span></div>
        <div class="kpi-line"><strong>Net</strong><span>$${income - expenses}</span></div>
        <label>Type</label><select id="finType"><option>Income</option><option>Expense</option></select>
        <label>Source / Description</label><input id="finDesc" />
        <label>Amount</label><input id="finAmount" type="number" />
        <label>Category</label><select id="finCat"><option>Business</option><option>Personal</option><option>Subscription</option><option>Travel</option><option>Other</option></select>
        <button class="primary" id="saveFinance">Add Entry</button>
        <h3>Entries This Month</h3>
        <div class="list">${state.finances.map(financeEditItem).join('') || '<p class="muted">No income or expense entries yet.</p>'}</div>
      </section>

      <section class="card span4">
        <h2>Pipeline Tracker</h2>
        <label>Name</label><input id="prospectName" />
        <label>Stage</label><select id="prospectStage">${STAGES.map(s => `<option>${s}</option>`).join('')}</select>
        <label>Next Step</label><input id="prospectNext" />
        <button class="primary" id="addProspect">Add Prospect</button>
        <div class="list">${state.prospects.map(prospectEditItem).join('')}</div>
      </section>

      <section class="card span4">
        <h2>GU Family Roster</h2>
        <label>Name</label><input id="familyName" />
        <label>Role</label><select id="familyRole">${ROLES.map(r => `<option>${r}</option>`).join('')}</select>
        <label>Phone</label><input id="familyPhone" />
        <label>Email</label><input id="familyEmail" />
        <button class="primary" id="addFamily">Add Person</button>
        <div class="list">${state.family.map(f => `<div class="item"><div class="item-top"><strong>${escapeHtml(f.name)}</strong><span class="badge">${escapeHtml(f.role)}</span></div><p class="small">${escapeHtml(f.phone || '')} ${escapeHtml(f.email || '')}</p></div>`).join('')}</div>
      </section>
    </div>
  `
}

function bindWealth() {
  $('saveGU').onclick = async () => updateDaily({ reach_outs: Number($('reachOuts').value || 0), samples: Number($('samples').value || 0), six_w: Number($('sixW').value || 0) }, 'saveGU', 'Saved ✓')
  $('saveFinance').onclick = async () => {
    const type = $('finType').value
    await supabase.from('finances').insert({ user_id: state.user.id, entry_type: type, source: type === 'Income' ? $('finDesc').value : null, description: type === 'Expense' ? $('finDesc').value : null, amount: Number($('finAmount').value || 0), entry_date: state.selectedDate, category: $('finCat').value })
    state.savedButton = 'saveFinance'
    state.savedText = 'Added ✓'
    await render()
  }
  $('addProspect').onclick = async () => {
    await supabase.from('prospects').insert({ user_id: state.user.id, name: $('prospectName').value, stage: $('prospectStage').value, last_contact: state.selectedDate, next_step: $('prospectNext').value })
    state.savedButton = 'addProspect'
    state.savedText = 'Added ✓'
    await render()
  }
  $('addFamily').onclick = async () => {
    await supabase.from('gu_family').insert({ user_id: state.user.id, name: $('familyName').value, role: $('familyRole').value, phone: $('familyPhone').value, email: $('familyEmail').value, date_joined: state.selectedDate })
    state.savedButton = 'addFamily'
    state.savedText = 'Added ✓'
    await render()
  }

  document.querySelectorAll('.saveFinanceEntry').forEach(btn => btn.onclick = async () => {
    const card = btn.closest('.item')
    const id = btn.dataset.id
    const type = card.querySelector('.financeType').value
    await supabase.from('finances').update({
      entry_type: type,
      source: type === 'Income' ? card.querySelector('.financeDesc').value : null,
      description: type === 'Expense' ? card.querySelector('.financeDesc').value : null,
      amount: Number(card.querySelector('.financeAmount').value || 0),
      entry_date: card.querySelector('.financeDate').value,
      category: card.querySelector('.financeCategory').value
    }).eq('id', id).eq('user_id', state.user.id)
    btn.classList.add('saved'); btn.textContent = 'Saved ✓'
    setTimeout(() => { btn.classList.remove('saved'); btn.textContent = 'Save' }, 1600)
  })

  document.querySelectorAll('.deleteFinanceEntry').forEach(btn => btn.onclick = async () => {
    if (!confirm('Delete this income/expense entry?')) return
    await supabase.from('finances').delete().eq('id', btn.dataset.id).eq('user_id', state.user.id)
    await render()
  })

  document.querySelectorAll('.saveProspect').forEach(btn => btn.onclick = async () => {
    const card = btn.closest('.item')
    await supabase.from('prospects').update({
      name: card.querySelector('.prospectNameEdit').value,
      stage: card.querySelector('.prospectStageEdit').value,
      last_contact: card.querySelector('.prospectLastEdit').value,
      next_step: card.querySelector('.prospectNextEdit').value
    }).eq('id', btn.dataset.id).eq('user_id', state.user.id)
    await render()
  })

  document.querySelectorAll('.deleteProspect').forEach(btn => btn.onclick = async () => {
    if (!confirm('Delete this prospect?')) return
    await supabase.from('prospects').delete().eq('id', btn.dataset.id).eq('user_id', state.user.id)
    await render()
  })

  document.querySelectorAll('.moveToFamily').forEach(btn => btn.onclick = async () => {
    const p = state.prospects.find(x => x.id === btn.dataset.id)
    if (!p) return
    const role = p.stage === 'Patron or Giver' ? 'Patron' : 'Giver'
    await supabase.from('gu_family').insert({ user_id: state.user.id, name: p.name, role, date_joined: state.selectedDate, note: p.next_step || '' })
    await supabase.from('prospects').delete().eq('id', p.id).eq('user_id', state.user.id)
    await render()
  })
}

function wellnessView() {
  return `
    <div class="grid">
      <section class="card span4">
        <h2>Workout Log</h2>
        <label>Status</label><select id="workoutStatus"><option></option><option ${state.daily.workout_status==='Yes'?'selected':''}>Yes</option><option ${state.daily.workout_status==='Rest Day'?'selected':''}>Rest Day</option><option ${state.daily.workout_status==='Missed'?'selected':''}>Missed</option></select>
        <label>Type</label><select id="workoutType"><option></option><option ${state.daily.workout_type==='Strength'?'selected':''}>Strength</option><option ${state.daily.workout_type==='Cardio'?'selected':''}>Cardio</option><option ${state.daily.workout_type==='Mobility'?'selected':''}>Mobility</option><option ${state.daily.workout_type==='Mixed'?'selected':''}>Mixed</option></select>
        <label>Duration</label><input id="workoutDuration" type="number" value="${state.daily.workout_duration ?? ''}" />
        <label>Notes</label><textarea id="workoutNotes">${escapeHtml(state.daily.workout_notes || '')}</textarea>
        <button class="primary" id="saveWorkout">Save Workout</button>
      </section>

      <section class="card span4">
        <h2>Recovery & Bevel</h2>
        <label>Recovery %</label><input id="bevelRecovery" type="number" value="${state.daily.bevel_recovery ?? ''}" />
        <label>Sleep %</label><input id="bevelSleep" type="number" value="${state.daily.bevel_sleep ?? ''}" />
        <label>Strain %</label><input id="bevelStrain" type="number" value="${state.daily.bevel_strain ?? ''}" />
        <label>Stress Score</label><input id="bevelStress" type="number" value="${state.daily.bevel_stress ?? ''}" />
        <button class="primary" id="saveBevel">Save Bevel Data</button>
      </section>

      <section class="card span4">
        <h2>Relationships</h2>
        <label>Person / Group</label><input id="relPerson" />
        <label>Type</label><select id="relType"><option>Friend</option><option>Community</option><option>Giver Outreach</option><option>Partner</option><option>Family</option></select>
        <label>Note</label><textarea id="relNote"></textarea>
        <button class="primary" id="saveRelationship">Log Connection</button>
        <div class="list">${state.relationships.map(r => `<div class="item"><strong>${escapeHtml(r.person_group || 'Social Rest Day')}</strong><p class="small">${escapeHtml(r.note || '')}</p></div>`).join('')}</div>
      </section>

      <section class="card span12">
        <h2>Wellness History</h2>
        <p class="muted">Workout and Bevel data save into your daily log. Use the date arrows above to edit any day.</p>
        <div class="list">${wellnessHistoryView()}</div>
      </section>
    </div>
  `
}

function bindWellness() {
  $('saveWorkout').onclick = async () => updateDaily({ workout_status: $('workoutStatus').value, workout_type: $('workoutType').value, workout_duration: Number($('workoutDuration').value || 0), workout_notes: $('workoutNotes').value }, 'saveWorkout', 'Saved ✓')
  $('saveBevel').onclick = async () => updateDaily({ bevel_recovery: Number($('bevelRecovery').value || 0), bevel_sleep: Number($('bevelSleep').value || 0), bevel_strain: Number($('bevelStrain').value || 0), bevel_stress: Number($('bevelStress').value || 0) }, 'saveBevel', 'Saved ✓')
  $('saveRelationship').onclick = async () => {
    await supabase.from('relationships').insert({ user_id: state.user.id, connection_date: state.selectedDate, person_group: $('relPerson').value, connection_type: $('relType').value, note: $('relNote').value })
    state.savedButton = 'saveRelationship'
    state.savedText = 'Logged ✓'
    await render()
  }
}

function settingsView() {
  return `
    <div class="grid">
      <section class="card span6">
        <h2>Targets Manager</h2>
        <div class="row">
          ${settingInput('daily_reach_outs','Daily Reach Outs')}
          ${settingInput('daily_samples','Daily Samples')}
          ${settingInput('daily_six_w','Daily 6-W')}
          ${settingInput('weekly_reach_outs','Weekly Reach Outs')}
          ${settingInput('weekly_samples','Weekly Samples')}
          ${settingInput('weekly_six_w','Weekly 6-W')}
          ${settingInput('monthly_reach_outs','Monthly Reach Outs')}
          ${settingInput('monthly_samples','Monthly Samples')}
          ${settingInput('monthly_six_w','Monthly 6-W')}
          ${settingInput('weekly_workout_days','Weekly Workout Days')}
          ${settingInput('monthly_income_goal','Monthly Income Goal')}
          ${settingInput('monthly_give_day_target','Monthly GIVE Day Target')}
          ${settingInput('target_repertoire_size','Target Repertoire Size')}
          ${settingInput('performance_ready_goal','Performance-Ready Goal')}
        </div>
        <label>Affirmation Rotation</label>
        <select id="affirmation_rotation"><option ${state.settings.affirmation_rotation==='sequential'?'selected':''}>sequential</option><option ${state.settings.affirmation_rotation==='random'?'selected':''}>random</option></select>
        <button class="primary" id="saveSettings">Save Settings</button>
      </section>

      <section class="card span6">
        <h2>Goals Manager</h2>
        <p class="muted">Edit the goal, identity statement, status, and next single action. Add a new goal when an old one reaches achieved status.</p>
        <div class="list">${state.goals.map(goalEditItem).join('')}</div>
        <h3>Add Goal</h3>
        <label>Goal Name</label><input id="newGoalName" />
        <label>Identity Statement</label><textarea id="newGoalStatement"></textarea>
        <label>Next Single Action</label><input id="newGoalNext" />
        <button class="primary" id="addGoal">Add Goal</button>
      </section>

      <section class="card span6">
        <h2>Affirmations Manager</h2>
        <label>New Affirmation</label><input id="newAffirmation" />
        <button class="primary" id="addAffirmation">Add Affirmation</button>
        <div class="list">${state.affirmations.map(a => `
          <div class="item">
            <div class="item-top">
              <strong>${escapeHtml(a.text)}</strong>
              <button class="danger deleteAffirmation" data-id="${a.id}">Delete</button>
            </div>
          </div>`).join('')}</div>
      </section>

      <section class="card span6">
        <h2>Magic Repertoire Manager</h2>
        <label>New Trick</label><input id="newTrick" />
        <button class="primary" id="addTrick">Add Trick</button>
        <div class="list">${state.tricks.map(trickEditItem).join('')}</div>
      </section>
    </div>
  `
}

function goalEditItem(g) {
  return `
    <div class="item">
      <label>Goal Name</label><input class="goalName" data-id="${g.id}" value="${escapeHtml(g.name)}" />
      <label>Identity Statement</label><textarea class="goalStatement" data-id="${g.id}">${escapeHtml(g.identity_statement || '')}</textarea>
      <label>Status</label><select class="goalStatus" data-id="${g.id}"><option ${g.status==='Active'?'selected':''}>Active</option><option ${g.status==='Paused'?'selected':''}>Paused</option><option ${g.status==='Achieved'?'selected':''}>Achieved</option></select>
      <label>Next Single Action</label><input class="goalNext" data-id="${g.id}" value="${escapeHtml(g.next_action || '')}" />
      <div class="footer-actions">
        <button class="primary saveGoal" data-id="${g.id}">Save Goal</button>
        <button class="danger deleteGoal" data-id="${g.id}">Delete Goal</button>
      </div>
    </div>
  `
}

function trickEditItem(t) {
  return `
    <div class="item">
      <label>Trick Name</label><input class="trickName" data-id="${t.id}" value="${escapeHtml(t.trick_name)}" />
      <label>Status</label>
      <select class="trickActive" data-id="${t.id}"><option value="true" ${t.active ? 'selected' : ''}>Active Rotation</option><option value="false" ${!t.active ? 'selected' : ''}>Archived</option></select>
      <label>Performance Ready?</label>
      <select class="trickReady" data-id="${t.id}"><option value="false" ${!t.performance_ready ? 'selected' : ''}>Not Yet</option><option value="true" ${t.performance_ready ? 'selected' : ''}>Performance Ready</option></select>
      <div class="footer-actions">
        <button class="primary saveTrick" data-id="${t.id}">Save Trick</button>
        <button class="danger deleteTrick" data-id="${t.id}">Delete Trick</button>
      </div>
    </div>
  `
}

function settingInput(key, label) {
  return `<div class="col4"><label>${label}</label><input id="${key}" type="number" value="${state.settings[key] ?? ''}" /></div>`
}

function bindSettings() {
  $('saveSettings').onclick = async () => {
    const payload = {
      daily_reach_outs: Number($('daily_reach_outs').value),
      daily_samples: Number($('daily_samples').value),
      daily_six_w: Number($('daily_six_w').value),
      weekly_reach_outs: Number($('weekly_reach_outs').value),
      weekly_samples: Number($('weekly_samples').value),
      weekly_six_w: Number($('weekly_six_w').value),
      monthly_reach_outs: Number($('monthly_reach_outs').value),
      monthly_samples: Number($('monthly_samples').value),
      monthly_six_w: Number($('monthly_six_w').value),
      weekly_workout_days: Number($('weekly_workout_days').value),
      monthly_income_goal: Number($('monthly_income_goal').value),
      monthly_give_day_target: Number($('monthly_give_day_target').value),
      target_repertoire_size: Number($('target_repertoire_size').value),
      performance_ready_goal: Number($('performance_ready_goal').value),
      affirmation_rotation: $('affirmation_rotation').value
    }
    await supabase.from('settings').update(payload).eq('user_id', state.user.id)
    await render()
  }

  $('addAffirmation').onclick = async () => {
    await supabase.from('affirmations').insert({ user_id: state.user.id, text: $('newAffirmation').value, sort_order: state.affirmations.length })
    await render()
  }

  $('addTrick').onclick = async () => {
    await supabase.from('magic_repertoire').insert({ user_id: state.user.id, trick_name: $('newTrick').value, active: true, performance_ready: false })
    await render()
  }

  $('addGoal').onclick = async () => {
    await supabase.from('goals').insert({ user_id: state.user.id, name: $('newGoalName').value, identity_statement: $('newGoalStatement').value, status: 'Active', next_action: $('newGoalNext').value, sort_order: state.goals.length })
    await render()
  }

  document.querySelectorAll('.saveGoal').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id
    const card = btn.closest('.item')
    await supabase.from('goals').update({
      name: card.querySelector('.goalName').value,
      identity_statement: card.querySelector('.goalStatement').value,
      status: card.querySelector('.goalStatus').value,
      next_action: card.querySelector('.goalNext').value
    }).eq('id', id).eq('user_id', state.user.id)
    await render()
  })

  document.querySelectorAll('.saveTrick').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id
    const card = btn.closest('.item')
    await supabase.from('magic_repertoire').update({
      trick_name: card.querySelector('.trickName').value,
      active: card.querySelector('.trickActive').value === 'true',
      performance_ready: card.querySelector('.trickReady').value === 'true'
    }).eq('id', id).eq('user_id', state.user.id)
    await render()
  })

  document.querySelectorAll('.deleteAffirmation').forEach(btn => btn.onclick = async () => {
    if (!confirm('Delete this affirmation?')) return
    await supabase.from('affirmations').delete().eq('id', btn.dataset.id).eq('user_id', state.user.id)
    await render()
  })

  document.querySelectorAll('.deleteGoal').forEach(btn => btn.onclick = async () => {
    if (!confirm('Delete this goal? This cannot be undone.')) return
    await supabase.from('goals').delete().eq('id', btn.dataset.id).eq('user_id', state.user.id)
    await render()
  })

  document.querySelectorAll('.deleteTrick').forEach(btn => btn.onclick = async () => {
    if (!confirm('Delete this magic trick? This cannot be undone.')) return
    await supabase.from('magic_repertoire').delete().eq('id', btn.dataset.id).eq('user_id', state.user.id)
    await render()
  })
}

async function updateDaily(payload, savedButton = null, savedText = 'Saved ✓') {
  const { data, error } = await supabase.from('daily_logs').upsert({
    id: state.daily.id,
    user_id: state.user.id,
    log_date: state.selectedDate,
    ...payload,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,log_date' }).select().single()

  if (error) alert(error.message)
  else {
    state.daily = data
    state.savedButton = savedButton
    state.savedText = savedText
    await render()
  }
}


function financeEditItem(f) {
  const desc = f.entry_type === 'Income' ? (f.source || '') : (f.description || '')
  return `
    <div class="item">
      <div class="row">
        <div class="col3"><label>Date</label><input class="financeDate" type="date" value="${escapeHtml(f.entry_date)}" /></div>
        <div class="col3"><label>Type</label><select class="financeType"><option ${f.entry_type==='Income'?'selected':''}>Income</option><option ${f.entry_type==='Expense'?'selected':''}>Expense</option></select></div>
        <div class="col3"><label>Amount</label><input class="financeAmount" type="number" value="${f.amount ?? 0}" /></div>
        <div class="col3"><label>Category</label><select class="financeCategory"><option ${f.category==='Business'?'selected':''}>Business</option><option ${f.category==='Personal'?'selected':''}>Personal</option><option ${f.category==='Subscription'?'selected':''}>Subscription</option><option ${f.category==='Travel'?'selected':''}>Travel</option><option ${f.category==='Other'?'selected':''}>Other</option></select></div>
        <div class="col12"><label>Source / Description</label><input class="financeDesc" value="${escapeHtml(desc)}" /></div>
      </div>
      <div class="footer-actions">
        <button class="primary saveFinanceEntry" data-id="${f.id}">Save</button>
        <button class="danger deleteFinanceEntry" data-id="${f.id}">Delete</button>
      </div>
    </div>
  `
}

function prospectEditItem(p) {
  const stageClass = `stage-${String(p.stage || '').toLowerCase().replaceAll(' ', '-').replaceAll('/', '-')}`
  return `
    <div class="item stage-card ${stageClass}">
      <div class="item-top"><strong>${escapeHtml(p.name)}</strong><span class="badge stage-badge ${stageClass}">${escapeHtml(p.stage)}</span></div>
      <label>Name</label><input class="prospectNameEdit" value="${escapeHtml(p.name)}" />
      <label>Stage</label><select class="prospectStageEdit">${STAGES.map(s => `<option ${p.stage===s?'selected':''}>${s}</option>`).join('')}</select>
      <label>Last Contact</label><input class="prospectLastEdit" type="date" value="${escapeHtml(p.last_contact || state.selectedDate)}" />
      <label>Next Step</label><input class="prospectNextEdit" value="${escapeHtml(p.next_step || '')}" />
      <div class="footer-actions">
        <button class="primary saveProspect" data-id="${p.id}">Save</button>
        <button class="moveToFamily" data-id="${p.id}">Move to GU Family</button>
        <button class="danger deleteProspect" data-id="${p.id}">Delete</button>
      </div>
    </div>
  `
}

function wellnessHistoryView() {
  const rows = state.logs28
    .filter(l => l.workout_status || l.bevel_recovery !== null || l.bevel_sleep !== null || l.bevel_strain !== null || l.bevel_stress !== null)
    .slice()
    .reverse()
    .slice(0, 10)

  if (!rows.length) return '<p class="muted">No wellness data logged yet.</p>'

  return rows.map(l => `
    <div class="item">
      <div class="item-top"><strong>${escapeHtml(l.log_date)}</strong><span class="badge">${escapeHtml(l.workout_status || 'No workout')}</span></div>
      <p class="small tight"><strong>Workout:</strong> ${escapeHtml(l.workout_type || '—')} ${l.workout_duration ? `• ${l.workout_duration} min` : ''}</p>
      <p class="small tight"><strong>Bevel:</strong> Recovery ${l.bevel_recovery ?? '—'}% • Sleep ${l.bevel_sleep ?? '—'}% • Strain ${l.bevel_strain ?? '—'}% • Stress ${l.bevel_stress ?? '—'}</p>
      <p class="small tight">${escapeHtml(l.workout_notes || '')}</p>
    </div>
  `).join('')
}

function applySavedFeedback() {
  if (!state.savedButton) return
  const btn = $(state.savedButton)
  if (!btn) return
  const original = btn.textContent
  btn.classList.add('saved')
  btn.textContent = state.savedText || 'Saved ✓'
  setTimeout(() => {
    btn.classList.remove('saved')
    btn.textContent = original
    state.savedButton = null
    state.savedText = null
  }, 1600)
}


function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]))
}

init()
