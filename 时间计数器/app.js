'use strict';

/* =========================================================
   通用工具
   ========================================================= */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const pad2 = (n) => String(n).padStart(2, '0');
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* 隐私模式等场景下忽略存储失败 */
    }
  },
};

/* 秒表：HH:MM:SS.CC（不足一小时省略小时） */
function formatStopwatch(ms) {
  const totalCs = Math.floor(Math.max(0, ms) / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);

  if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
  return `${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

/* 倒计时：向上取整秒，保证开始瞬间显示完整时长 */
function formatCountdown(ms, showHours) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);

  return showHours
    ? `${pad2(h)}:${pad2(m)}:${pad2(s)}`
    : `${pad2(m)}:${pad2(s)}`;
}

function formatClockTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (h) parts.push(`${h} 小时`);
  if (m) parts.push(`${m} 分`);
  if (s) parts.push(`${s} 秒`);
  return parts.join(' ') || '0 秒';
}

/* 始终带小时的 HH:MM:SS */
function formatHms(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/* 本地日期键，用于“每日重置” */
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/* 解析 YYYY-MM-DD 为本地零点，非法日期返回 null */
function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
}

function normalizeClock(value) {
  const minutes = parseClock(value);
  if (minutes === null) return null;
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

function clockFromMinutes(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function minutesLabel(minutes, roundUp = false) {
  const value = Math.max(0, roundUp ? Math.ceil(minutes) : Math.round(minutes));
  if (value >= 60) {
    const h = Math.floor(value / 60);
    const rest = value % 60;
    return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`;
  }
  return `${value} 分钟`;
}

/* =========================================================
   主题
   ========================================================= */
const themeToggle = $('#themeToggle');
const themeMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme, persist = true) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  themeToggle.setAttribute(
    'aria-label',
    next === 'dark' ? '切换到浅色模式' : '切换到深色模式'
  );
  themeToggle.title = next === 'dark' ? '切换到浅色模式' : '切换到深色模式';
  if (themeMeta) themeMeta.setAttribute('content', next === 'dark' ? '#0a0d14' : '#f2f5fb');
  if (persist) store.set('tc.theme', next);
}

const savedTheme = store.get('tc.theme', '');
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
const initialTheme = savedTheme === 'light' || savedTheme === 'dark'
  ? savedTheme
  : prefersLight
    ? 'light'
    : 'dark';
applyTheme(initialTheme, false);

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* =========================================================
   标签页
   ========================================================= */
const tabs = $$('.tab');
const panels = $$('.panel');
const tabList = $('.tabs');
let activePanel = 'loop';

function activateTab(name) {
  activePanel = name;
  let activeTab = null;

  tabs.forEach((tab) => {
    const isActive = tab.dataset.panel === name;
    if (isActive) activeTab = tab;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  panels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === `panel-${name}`);
  });

  if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (name === 'stats') renderStats();
  updateDocumentTitle();
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab.dataset.panel));
});

tabList.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const names = tabs.map((tab) => tab.dataset.panel);
  const index = names.indexOf(activePanel);
  const step = event.key === 'ArrowRight' ? 1 : names.length - 1;
  const next = (index + step) % names.length;
  activateTab(names[next]);
  tabs[next].focus();
});

/* =========================================================
   秒表
   ========================================================= */
const swDisplay = $('#swDisplay');
const swStart = $('#swStart');
const swLap = $('#swLap');
const swReset = $('#swReset');
const lapsCard = $('#lapsCard');
const lapList = $('#lapList');
const lapCount = $('#lapCount');

const sw = {
  running: false,
  elapsed: 0,
  startedAt: 0,
  laps: [],
  lastLapTotal: 0,
};

let swRaf = 0;

function swNow() {
  return sw.elapsed + (sw.running ? performance.now() - sw.startedAt : 0);
}

function renderStopwatch() {
  swDisplay.textContent = formatStopwatch(swNow());
}

function updateStopwatchButtons() {
  swStart.textContent = sw.running ? '暂停' : sw.elapsed > 0 ? '继续' : '开始';
  swLap.disabled = !sw.running;
  swReset.disabled = !sw.running && sw.elapsed === 0 && sw.laps.length === 0;
}

function stopwatchLoop() {
  swRaf = 0;
  if (!sw.running) return;
  renderStopwatch();
  swRaf = requestAnimationFrame(stopwatchLoop);
}

function startStopwatchLoop() {
  if (!swRaf) swRaf = requestAnimationFrame(stopwatchLoop);
}

function toggleStopwatch() {
  if (sw.running) {
    sw.elapsed = swNow();
    sw.running = false;
    renderStopwatch();
  } else {
    sw.startedAt = performance.now();
    sw.running = true;
    startStopwatchLoop();
  }
  updateStopwatchButtons();
}

function addLap() {
  if (!sw.running) return;
  const total = swNow();
  sw.laps.push({ lap: total - sw.lastLapTotal, total });
  sw.lastLapTotal = total;
  renderLaps();
  updateStopwatchButtons();
}

function resetStopwatch() {
  sw.running = false;
  sw.elapsed = 0;
  sw.startedAt = 0;
  sw.laps = [];
  sw.lastLapTotal = 0;
  if (swRaf) {
    cancelAnimationFrame(swRaf);
    swRaf = 0;
  }
  renderStopwatch();
  renderLaps();
  updateStopwatchButtons();
}

function renderLaps() {
  const laps = sw.laps;
  lapsCard.hidden = laps.length === 0;
  lapCount.textContent = `${laps.length} 次`;

  if (laps.length === 0) {
    lapList.replaceChildren();
    return;
  }

  let bestIndex = -1;
  let worstIndex = -1;
  if (laps.length >= 2) {
    let best = Infinity;
    let worst = -Infinity;
    laps.forEach((entry, index) => {
      if (entry.lap < best) {
        best = entry.lap;
        bestIndex = index;
      }
      if (entry.lap > worst) {
        worst = entry.lap;
        worstIndex = index;
      }
    });
  }

  const fragment = document.createDocumentFragment();
  for (let index = laps.length - 1; index >= 0; index -= 1) {
    const entry = laps[index];
    const row = document.createElement('div');
    row.className = 'lap-row';
    if (index === bestIndex) row.classList.add('is-best');
    if (index === worstIndex) row.classList.add('is-worst');

    const number = document.createElement('span');
    number.className = 'lap-no';
    number.textContent = `#${pad2(index + 1)}`;

    const lapTime = document.createElement('span');
    lapTime.textContent = formatStopwatch(entry.lap);

    const totalTime = document.createElement('span');
    totalTime.textContent = formatStopwatch(entry.total);

    row.append(number, lapTime, totalTime);
    fragment.append(row);
  }

  lapList.replaceChildren(fragment);
}

swStart.addEventListener('click', toggleStopwatch);
swLap.addEventListener('click', addLap);
swReset.addEventListener('click', resetStopwatch);

/* =========================================================
   倒计时
   ========================================================= */
const countdownCard = $('#countdownCard');
const cdDisplay = $('#cdDisplay');
const cdStatus = $('#cdStatus');
const cdHours = $('#cdHours');
const cdMinutes = $('#cdMinutes');
const cdSeconds = $('#cdSeconds');
const cdPresets = $('#cdPresets');
const cdStart = $('#cdStart');
const cdReset = $('#cdReset');
const cdHint = $('#cdHint');
const ringProgress = $('#ringProgress');

const RING_C = 2 * Math.PI * Number(ringProgress.getAttribute('r'));
ringProgress.style.strokeDasharray = String(RING_C);

const cdInputs = [cdHours, cdMinutes, cdSeconds];
const MAX_CD_MS = ((99 * 3600) + (59 * 60) + 59) * 1000;

const cd = {
  duration: 0,
  remaining: 0,
  running: false,
  endAt: 0,
  done: false,
};

let cdTimer = 0;

function readDurationInputs() {
  const h = clamp(parseInt(cdHours.value, 10) || 0, 0, 99);
  const m = clamp(parseInt(cdMinutes.value, 10) || 0, 0, 59);
  const s = clamp(parseInt(cdSeconds.value, 10) || 0, 0, 59);
  return ((h * 3600) + (m * 60) + s) * 1000;
}

function setDurationInputs(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  cdHours.value = String(Math.floor(total / 3600));
  cdMinutes.value = String(Math.floor((total % 3600) / 60));
  cdSeconds.value = String(total % 60);
}

function stopCountdownTimer() {
  if (cdTimer) {
    clearInterval(cdTimer);
    cdTimer = 0;
  }
}

function setCountdownInputsDisabled(disabled) {
  cdInputs.forEach((input) => {
    input.disabled = disabled;
  });
  $$('.chip', cdPresets).forEach((chip) => {
    chip.disabled = disabled;
  });
}

function updateCountdownButtons() {
  if (cd.running) {
    cdStart.textContent = '暂停';
  } else if (cd.done) {
    cdStart.textContent = '重新开始';
  } else if (cd.remaining > 0 && cd.remaining < cd.duration) {
    cdStart.textContent = '继续';
  } else {
    cdStart.textContent = '开始';
  }

  cdReset.disabled = !cd.running && !cd.done && cd.remaining === cd.duration;
  setCountdownInputsDisabled(cd.running);
}

function renderCountdown() {
  const showHours = cd.duration >= 3600000;
  cdDisplay.textContent = formatCountdown(cd.remaining, showHours);

  const ratio = cd.duration > 0 ? clamp(cd.remaining / cd.duration, 0, 1) : 0;
  ringProgress.style.strokeDashoffset = String(RING_C * (1 - ratio));

  if (cd.done) {
    cdStatus.textContent = '时间到！';
  } else if (cd.running) {
    cdStatus.textContent = '倒计时中';
  } else if (cd.duration === 0) {
    cdStatus.textContent = '请设置时长';
  } else if (cd.remaining > 0 && cd.remaining < cd.duration) {
    cdStatus.textContent = '已暂停';
  } else {
    cdStatus.textContent = '准备就绪';
  }

  cdStatus.classList.toggle('is-done', cd.done);
  countdownCard.classList.toggle('is-done', cd.done);
  cdDisplay.classList.toggle('is-low', cd.running && cd.remaining <= 10000);

  if (cd.running) {
    cdHint.textContent = `预计 ${formatClockTime(new Date(Date.now() + cd.remaining))} 结束`;
  } else if (cd.done) {
    cdHint.textContent = `倒计时结束 · 共 ${formatDuration(cd.duration)}`;
  } else if (cd.duration > 0) {
    cdHint.textContent = `总时长 ${formatDuration(cd.duration)}`;
  } else {
    cdHint.textContent = '输入时长，或从预设中选择';
  }

  updateDocumentTitle();
}

function syncDurationFromInputs() {
  if (cd.running) return;
  stopCountdownTimer();
  cd.duration = readDurationInputs();
  cd.remaining = cd.duration;
  cd.done = false;
  cd.endAt = 0;
  renderCountdown();
  updateCountdownButtons();
  store.set('tc.countdownMs', cd.duration);
}

function applyCountdownPreset(ms) {
  const safe = clamp(ms, 0, MAX_CD_MS);
  setDurationInputs(safe);
  cd.duration = safe;
  cd.remaining = safe;
  cd.running = false;
  cd.done = false;
  cd.endAt = 0;
  stopCountdownTimer();
  renderCountdown();
  updateCountdownButtons();
  store.set('tc.countdownMs', safe);
}

function tickCountdown() {
  const remaining = cd.endAt - Date.now();
  if (remaining <= 0) {
    finishCountdown();
    return;
  }
  cd.remaining = remaining;
  renderCountdown();
}

function finishCountdown() {
  cd.running = false;
  cd.remaining = 0;
  cd.done = true;
  cd.endAt = 0;
  stopCountdownTimer();
  renderCountdown();
  updateCountdownButtons();
  playAlarm();
  vibrateAlert([180, 90, 180]);
}

function toggleCountdown() {
  if (cd.running) {
    cd.remaining = Math.max(0, cd.endAt - Date.now());
    cd.running = false;
    stopCountdownTimer();
    renderCountdown();
    updateCountdownButtons();
    return;
  }

  ensureAudio();

  if (cd.done || cd.remaining <= 0) {
    cd.duration = readDurationInputs();
    cd.remaining = cd.duration;
  }

  if (cd.remaining <= 0) {
    cdStatus.textContent = '请先设置时长';
    return;
  }

  cd.done = false;
  cd.running = true;
  cd.endAt = Date.now() + cd.remaining;
  stopCountdownTimer();
  cdTimer = window.setInterval(tickCountdown, 100);
  renderCountdown();
  updateCountdownButtons();
}

function resetCountdown() {
  cd.running = false;
  cd.done = false;
  cd.endAt = 0;
  stopCountdownTimer();
  cd.duration = readDurationInputs();
  cd.remaining = cd.duration;
  renderCountdown();
  updateCountdownButtons();
  store.set('tc.countdownMs', cd.duration);
}

cdInputs.forEach((input) => {
  input.addEventListener('input', () => {
    if (!cd.running) syncDurationFromInputs();
  });
  input.addEventListener('blur', () => {
    if (cd.running) return;
    const max = Number(input.max);
    input.value = String(clamp(parseInt(input.value, 10) || 0, 0, max));
    syncDurationFromInputs();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      toggleCountdown();
    }
  });
});

cdPresets.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || cd.running) return;
  const seconds = Number(chip.dataset.seconds);
  if (Number.isFinite(seconds)) applyCountdownPreset(seconds * 1000);
});

cdStart.addEventListener('click', toggleCountdown);
cdReset.addEventListener('click', resetCountdown);

/* 声音提醒 */
let audioCtx = null;

function ensureAudio() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioCtx) audioCtx = new AudioCtor();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playAlarm() {
  const ctx = ensureAudio();
  if (!ctx) return;

  const start = ctx.currentTime + 0.05;
  [0, 0.32, 0.64].forEach((offset, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(index === 2 ? 1174.66 : 880, start + offset);
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.28, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.27);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.3);
  });
}

/* 阶段切换时的轻柔提示音 */
function playChime() {
  const ctx = ensureAudio();
  if (!ctx) return;

  const start = ctx.currentTime + 0.03;
  [880, 1174.66].forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start + (index * 0.16));
    gain.gain.setValueAtTime(0.0001, start + (index * 0.16));
    gain.gain.exponentialRampToValueAtTime(0.18, start + (index * 0.16) + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (index * 0.16) + 0.24);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start + (index * 0.16));
    oscillator.stop(start + (index * 0.16) + 0.26);
  });
}

function vibrateAlert(pattern) {
  const canVibrate = navigator.userActivation ? navigator.userActivation.hasBeenActive : true;
  if (!navigator.vibrate || !canVibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* 忽略不支持振动的环境 */
  }
}

/* =========================================================
   日期计数
   ========================================================= */
const dateTargetInput = $('#dateTarget');
const datePresets = $('#datePresets');
const dateDirection = $('#dateDirection');
const daysNumber = $('#daysNumber');
const dateTargetText = $('#dateTargetText');
const dYears = $('#dYears');
const dMonths = $('#dMonths');
const dDays = $('#dDays');
const dHours = $('#dHours');
const dMinutes = $('#dMinutes');
const dSeconds = $('#dSeconds');

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addMonthsClamped(date, months) {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  result.setDate(Math.min(day, daysInMonth(result.getFullYear(), result.getMonth())));
  return result;
}

function startOfDay(date) {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

/* 日历意义上的差值：年 / 月 / 天 / 时 / 分 / 秒 */
function calendarDiff(from, to) {
  const past = to.getTime() < from.getTime();
  const a = past ? new Date(to.getTime()) : new Date(from.getTime());
  const b = past ? new Date(from.getTime()) : new Date(to.getTime());

  let cursor = new Date(a.getTime());
  let years = 0;
  let months = 0;

  const yearSpan = b.getFullYear() - a.getFullYear();
  if (yearSpan > 0) {
    const candidate = addMonthsClamped(a, yearSpan * 12);
    if (candidate.getTime() <= b.getTime()) {
      years = yearSpan;
      cursor = candidate;
    } else {
      years = yearSpan - 1;
      cursor = addMonthsClamped(a, (yearSpan - 1) * 12);
    }
  }

  for (;;) {
    const next = addMonthsClamped(cursor, 1);
    if (next.getTime() <= b.getTime()) {
      months += 1;
      cursor = next;
    } else {
      break;
    }
  }

  let rest = b.getTime() - cursor.getTime();
  const days = Math.floor(rest / 86400000);
  rest -= days * 86400000;
  const hours = Math.floor(rest / 3600000);
  rest -= hours * 3600000;
  const minutes = Math.floor(rest / 60000);
  rest -= minutes * 60000;
  const seconds = Math.floor(rest / 1000);

  return {
    past,
    totalMs: b.getTime() - a.getTime(),
    years,
    months,
    days,
    hours,
    minutes,
    seconds,
  };
}

function parseDateInput() {
  if (!dateTargetInput.value) return null;
  const date = new Date(dateTargetInput.value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInputValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function nextNewYear() {
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  return thisYear.getTime() > now.getTime()
    ? thisYear
    : new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
}

function setDateTarget(date) {
  dateTargetInput.value = toInputValue(date);
  store.set('tc.target', date.toISOString());
  renderDate();
}

function renderDate() {
  const target = parseDateInput();
  const now = new Date();

  if (!target) {
    dateDirection.textContent = '请选择日期';
    daysNumber.textContent = '—';
    dateTargetText.textContent = '目标日期为空';
    [dYears, dMonths, dDays, dHours, dMinutes, dSeconds].forEach((el) => {
      el.textContent = '—';
    });
    return;
  }

  const diff = calendarDiff(now, target);
  const totalDays = Math.floor(diff.totalMs / 86400000);

  daysNumber.textContent = String(totalDays);
  dateDirection.textContent = Math.abs(diff.totalMs) < 1000
    ? '就是现在'
    : diff.past
      ? '目标已经过去'
      : '距离目标还有';

  dateTargetText.textContent = `${target.getFullYear()} 年 ${target.getMonth() + 1} 月 ${target.getDate()} 日 · 周${WEEKDAYS[target.getDay()]} ${pad2(target.getHours())}:${pad2(target.getMinutes())}`;

  dYears.textContent = String(diff.years);
  dMonths.textContent = String(diff.months);
  dDays.textContent = String(diff.days);
  dHours.textContent = pad2(diff.hours);
  dMinutes.textContent = pad2(diff.minutes);
  dSeconds.textContent = pad2(diff.seconds);
}

function onDateInputChange() {
  const date = parseDateInput();
  if (date) store.set('tc.target', date.toISOString());
  renderDate();
}

dateTargetInput.addEventListener('input', onDateInputChange);
dateTargetInput.addEventListener('change', onDateInputChange);

datePresets.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;

  const now = new Date();
  let target = null;

  switch (chip.dataset.preset) {
    case 'newyear':
      target = nextNewYear();
      break;
    case 'tomorrow':
      target = startOfDay(now);
      target.setDate(target.getDate() + 1);
      break;
    case 'week':
      target = new Date(now.getTime() + 7 * 86400000);
      target.setSeconds(0, 0);
      break;
    case 'month':
      target = addMonthsClamped(now, 1);
      target.setSeconds(0, 0);
      break;
    default:
      break;
  }

  if (target) setDateTarget(target);
});

/* =========================================================
   每日循环：子标签
   ========================================================= */
const subTabs = $$('.sub-tab');
const subPanels = $$('.sub-panel');
const subTabList = $('.sub-tabs');
let activeSub = 'schedule';

function activateSub(name) {
  activeSub = name;
  subTabs.forEach((tab) => {
    const isActive = tab.dataset.sub === name;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  subPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === `sub-${name}`);
  });

  if (name === 'schedule') {
    updateScheduleLive();
  } else {
    renderPomo();
  }
}

subTabs.forEach((tab) => {
  tab.addEventListener('click', () => activateSub(tab.dataset.sub));
});

subTabList.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const names = subTabs.map((tab) => tab.dataset.sub);
  const index = names.indexOf(activeSub);
  const step = event.key === 'ArrowRight' ? 1 : names.length - 1;
  const next = (index + step) % names.length;
  activateSub(names[next]);
  subTabs[next].focus();
});

/* =========================================================
   撤销提示
   ========================================================= */
const toast = $('#toast');
const toastText = $('#toastText');
const toastUndo = $('#toastUndo');
let toastTimer = 0;
let toastAction = null;

function hideToast() {
  clearTimeout(toastTimer);
  toast.hidden = true;
  toastAction = null;
}

function showToast(text, actionLabel, action) {
  clearTimeout(toastTimer);
  toastText.textContent = text;
  toastUndo.textContent = actionLabel;
  toastUndo.hidden = !actionLabel;
  toastAction = action || null;
  toast.hidden = false;
  toastTimer = window.setTimeout(hideToast, 6000);
}

toastUndo.addEventListener('click', () => {
  const action = toastAction;
  hideToast();
  if (action) action();
});

/* =========================================================
   每日日程（按星期几 / 每月几号重复）
   ========================================================= */
const schedEyebrowLabel = $('#schedEyebrowLabel');
const schedDate = $('#schedDate');
const schedHeroTitle = $('#schedHeroTitle');
const schedHeroCount = $('#schedHeroCount');
const schedHeroMeta = $('#schedHeroMeta');
const schedProgressLabel = $('#schedProgressLabel');
const schedProgressText = $('#schedProgressText');
const schedProgressBar = $('#schedProgressBar');
const schedDateStrip = $('#schedDateStrip');
const schedWeekLabel = $('#schedWeekLabel');
const schedPrevWeek = $('#schedPrevWeek');
const schedNextWeek = $('#schedNextWeek');
const schedTodayBtn = $('#schedTodayBtn');
const schedAddBtn = $('#schedAddBtn');
const schedList = $('#schedList');
const schedListTitle = $('#schedListTitle');
const schedEmpty = $('#schedEmpty');
const schedEmptyTitle = $('#schedEmptyTitle');
const schedEmptyHint = $('#schedEmptyHint');
const schedCount = $('#schedCount');

const schedEditDialog = $('#schedEditDialog');
const schedEditForm = $('#schedEditForm');
const schedEditTitle = $('#schedEditTitle');
const schedEditName = $('#schedEditName');
const schedEditTime = $('#schedEditTime');
const schedEditDuration = $('#schedEditDuration');
const schedRepeatType = $('#schedRepeatType');
const schedOnceDateField = $('#schedOnceDateField');
const schedOnceDate = $('#schedOnceDate');
const schedWeekdayField = $('#schedWeekdayField');
const schedWeekdays = $('#schedWeekdays');
const schedMonthDayField = $('#schedMonthDayField');
const schedMonthDays = $('#schedMonthDays');
const schedEditMsg = $('#schedEditMsg');
const schedEditClose = $('#schedEditClose');
const schedEditCancel = $('#schedEditCancel');
const schedEditSave = $('#schedEditSave');

const schedule = {
  items: [],
  rows: new Map(),
  renderDay: '',
  inline: null,
};

let selectedDate = startOfDay(new Date());
let editingScheduleId = '';
let dialogMode = 'edit';

let completions = [];
const completionSet = new Set();

/* ---------- 日历工具 ---------- */
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function startOfWeek(date) {
  const result = startOfDay(date);
  const shift = (result.getDay() + 6) % 7;
  return addDays(result, -shift);
}

function weekdayLabel(date) {
  return `周${WEEKDAY_LABELS[(date.getDay() + 6) % 7]}`;
}

function dateKeyOf(date) {
  return localDateKey(date);
}

function daysFromToday(date) {
  return Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000);
}

function compareScheduleItems(a, b) {
  const diff = (parseClock(a.time) ?? 0) - (parseClock(b.time) ?? 0);
  return diff !== 0 ? diff : a.name.localeCompare(b.name, 'zh-Hans-CN');
}

function defaultScheduleTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return `${pad2(date.getHours())}:00`;
}

/* ---------- 重复规则 ---------- */
const REPEAT_TYPES = new Set(['daily', 'weekly', 'monthly', 'once']);

function normalizeRecurrence(raw) {
  const type = raw && REPEAT_TYPES.has(raw.type) ? raw.type : 'daily';

  if (type === 'once') {
    const date = typeof raw.date === 'string' && parseDateKey(raw.date) ? raw.date : '';
    if (!date) return { type: 'daily', weekdays: [], monthDays: [], date: '' };
    return { type, weekdays: [], monthDays: [], date };
  }

  if (type === 'weekly') {
    const weekdays = [...new Set(
      (Array.isArray(raw.weekdays) ? raw.weekdays : [])
        .map((value) => Math.round(Number(value)))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
    )].sort((a, b) => a - b);
    if (!weekdays.length) return { type: 'daily', weekdays: [], monthDays: [], date: '' };
    return { type, weekdays, monthDays: [], date: '' };
  }

  if (type === 'monthly') {
    const monthDays = [...new Set(
      (Array.isArray(raw.monthDays) ? raw.monthDays : [])
        .map((value) => Math.round(Number(value)))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31)
    )].sort((a, b) => a - b);
    if (!monthDays.length) return { type: 'daily', weekdays: [], monthDays: [], date: '' };
    return { type, weekdays: [], monthDays, date: '' };
  }

  return { type: 'daily', weekdays: [], monthDays: [], date: '' };
}

function recurrenceLabel(recurrence) {
  const rec = recurrence || { type: 'daily' };
  if (rec.type === 'once') {
    const date = parseDateKey(rec.date);
    return date
      ? `仅一次 · ${date.getMonth() + 1} 月 ${date.getDate()} 日`
      : '仅一次';
  }
  if (rec.type === 'weekly' && rec.weekdays.length) {
    return `每周${rec.weekdays.map((day) => WEEKDAY_LABELS[day - 1]).join('、')}`;
  }
  if (rec.type === 'monthly' && rec.monthDays.length) {
    return `每月 ${rec.monthDays.join('、')} 号`;
  }
  return '每天';
}

function occursOn(item, date) {
  const rec = item.recurrence || { type: 'daily' };
  if (rec.type === 'once') {
    return rec.date === dateKeyOf(date);
  }
  if (rec.type === 'weekly') {
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    return rec.weekdays.includes(weekday);
  }
  if (rec.type === 'monthly') {
    return rec.monthDays.includes(date.getDate());
  }
  return true;
}

function tasksForDate(date) {
  return schedule.items
    .filter((item) => occursOn(item, date))
    .sort(compareScheduleItems);
}

/* ---------- 数据存取 ---------- */
function makeScheduleId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function loadSchedule() {
  let raw;
  try {
    raw = JSON.parse(store.get('tc.schedule', '[]'));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item.name !== 'string') return null;
      const time = normalizeClock(item.time);
      if (!time) return null;
      const name = item.name.trim().slice(0, 24);
      if (!name) return null;
      return {
        id: typeof item.id === 'string' && item.id ? item.id : makeScheduleId(),
        name,
        time,
        duration: clamp(Math.round(Number(item.duration) || 60), 1, 720),
        recurrence: normalizeRecurrence(item.recurrence),
        doneOn: typeof item.doneOn === 'string' ? item.doneOn : '',
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

function saveSchedule() {
  store.set('tc.schedule', JSON.stringify(schedule.items.map((item) => ({
    id: item.id,
    name: item.name,
    time: item.time,
    duration: item.duration,
    recurrence: item.recurrence,
  }))));
}

/* ---------- 完成记录 ---------- */
function completionKey(taskId, date) {
  return `${taskId}|${date}`;
}

function rebuildCompletionIndex() {
  completionSet.clear();
  completions.forEach((entry) => {
    completionSet.add(completionKey(entry.taskId, entry.date));
  });
}

function loadCompletions() {
  let raw;
  try {
    raw = JSON.parse(store.get('tc.completions', '[]'));
  } catch {
    return;
  }
  if (!Array.isArray(raw)) return;

  const seen = new Set();
  const result = [];
  raw.forEach((entry) => {
    if (!entry || typeof entry.taskId !== 'string' || typeof entry.date !== 'string') return;
    if (!parseDateKey(entry.date)) return;
    const key = completionKey(entry.taskId, entry.date);
    if (seen.has(key)) return;
    seen.add(key);
    result.push({
      taskId: entry.taskId,
      name: typeof entry.name === 'string' ? entry.name.slice(0, 24) : '工作',
      date: entry.date,
      at: Number(entry.at) || Date.now(),
    });
  });

  completions = result;
  rebuildCompletionIndex();
}

function saveCompletions() {
  if (completions.length > 5000) {
    completions.sort((a, b) => a.at - b.at);
    completions = completions.slice(-5000);
    rebuildCompletionIndex();
  }
  store.set('tc.completions', JSON.stringify(completions));
}

function isCompleted(taskId, date) {
  return completionSet.has(completionKey(taskId, date));
}

function addCompletion(item, date) {
  const key = completionKey(item.id, date);
  if (completionSet.has(key)) return;
  completions.push({
    taskId: item.id,
    name: item.name,
    date,
    at: Date.now(),
  });
  completionSet.add(key);
  saveCompletions();
}

function removeCompletion(taskId, date) {
  const key = completionKey(taskId, date);
  if (!completionSet.has(key)) return;
  completions = completions.filter((entry) => !(entry.taskId === taskId && entry.date === date));
  rebuildCompletionIndex();
  saveCompletions();
}

function migrateDoneOn() {
  let changed = false;
  schedule.items.forEach((item) => {
    if (!item.doneOn || !parseDateKey(item.doneOn)) return;
    if (isCompleted(item.id, item.doneOn)) return;
    completions.push({
      taskId: item.id,
      name: item.name,
      date: item.doneOn,
      at: Date.now(),
    });
    completionSet.add(completionKey(item.id, item.doneOn));
    changed = true;
  });
  if (changed) saveCompletions();
}

/* ---------- 日期条 ---------- */
function renderDateStrip() {
  const weekStart = startOfWeek(selectedDate);
  const todayKey = localDateKey();
  const selectedKey = dateKeyOf(selectedDate);
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 7; index += 1) {
    const date = addDays(weekStart, index);
    const key = dateKeyOf(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'date-pill';
    button.dataset.date = key;
    button.classList.toggle('is-today', key === todayKey);
    button.classList.toggle('is-selected', key === selectedKey);
    button.setAttribute('aria-pressed', String(key === selectedKey));
    button.title = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${tasksForDate(date).length} 项`;

    const weekday = document.createElement('span');
    weekday.textContent = weekdayLabel(date);

    const day = document.createElement('b');
    day.textContent = String(date.getDate());

    button.append(weekday, day);
    fragment.append(button);
  }

  schedDateStrip.replaceChildren(fragment);
  const end = addDays(weekStart, 6);
  schedWeekLabel.textContent = `${weekStart.getMonth() + 1} 月 ${weekStart.getDate()} 日 – ${end.getMonth() + 1} 月 ${end.getDate()} 日`;
}

/* ---------- 内联编辑 ---------- */
function createField(field, item) {
  const editing = schedule.inline
    && schedule.inline.id === item.id
    && schedule.inline.field === field;

  if (editing) {
    const input = document.createElement('input');
    input.className = `inline-input inline-${field}`;

    if (field === 'name') {
      input.type = 'text';
      input.maxLength = 24;
      input.value = item.name;
      input.setAttribute('aria-label', '修改工作名称');
    } else if (field === 'time') {
      input.type = 'time';
      input.value = item.time;
      input.setAttribute('aria-label', '修改开始时间');
    } else {
      input.type = 'number';
      input.min = '1';
      input.max = '720';
      input.step = '5';
      input.value = String(item.duration);
      input.setAttribute('aria-label', '修改时长');
    }

    return input;
  }

  const span = document.createElement('span');
  span.className = field === 'name'
    ? 'sched-name'
    : field === 'time'
      ? 'sched-time'
      : 'sched-dur';
  span.textContent = field === 'name'
    ? item.name
    : field === 'time'
      ? item.time
      : `${item.duration} 分钟`;
  span.dataset.field = field;
  span.tabIndex = 0;
  span.setAttribute('role', 'button');
  span.title = '点击修改';
  return span;
}

function createInlineEditor(field, item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'inline-editor';

  const label = document.createElement('span');
  label.className = 'inline-label';
  label.textContent = field === 'name' ? '名称' : field === 'time' ? '开始' : '时长';

  const input = createField(field, item);
  wrapper.append(label, input);

  if (field === 'duration') {
    const unit = document.createElement('span');
    unit.className = 'inline-unit';
    unit.textContent = '分钟';
    wrapper.append(unit);
  }

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'inline-save';
  save.textContent = '✓';
  save.title = '保存修改';
  save.setAttribute('aria-label', '保存修改');
  wrapper.append(save);

  return wrapper;
}

function beginInlineEdit(id, field) {
  if (schedule.inline) return;
  const item = schedule.items.find((entry) => entry.id === id);
  if (!item) return;
  schedule.inline = { id, field };
  renderSchedule();
}

function bindInlineInput() {
  const input = schedList.querySelector('.inline-input');
  if (!input || !schedule.inline) {
    schedule.inline = null;
    return;
  }

  let settled = false;
  const finish = (commit) => {
    if (settled) return;
    settled = true;
    finishInlineEdit(commit);
  };

  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
  });

  const save = schedList.querySelector('.inline-save');
  if (save) save.addEventListener('click', () => finish(true));

  input.focus();
  if (input.type === 'text') input.select();
}

function finishInlineEdit(commit) {
  const state = schedule.inline;
  if (!state) return;

  const item = schedule.items.find((entry) => entry.id === state.id);
  const input = schedList.querySelector('.inline-input');
  let error = '';

  if (commit && item && input) {
    if (state.field === 'name') {
      const value = input.value.trim().slice(0, 24);
      if (!value) {
        error = '工作名称不能为空';
      } else {
        item.name = value;
      }
    } else if (state.field === 'time') {
      const value = normalizeClock(input.value);
      if (!value) {
        error = '请选择有效的开始时间';
      } else {
        item.time = value;
      }
    } else if (state.field === 'duration') {
      const value = Math.round(Number(input.value));
      if (!Number.isFinite(value) || value < 1 || value > 720) {
        error = '时长需在 1–720 分钟之间';
      } else {
        item.duration = value;
      }
    }

    if (!error) saveSchedule();
  }

  schedule.inline = null;
  renderSchedule();
  if (!error) renderStats();
  if (error) showToast(error, '', null);
}

/* ---------- 渲染日程 ---------- */
function renderSchedule() {
  const todayDate = startOfDay(new Date());
  const todayKey = dateKeyOf(todayDate);
  const selectedKey = dateKeyOf(selectedDate);
  const isToday = selectedKey === todayKey;
  const isPast = startOfDay(selectedDate).getTime() < todayDate.getTime();
  const isFuture = startOfDay(selectedDate).getTime() > todayDate.getTime();
  const tasks = tasksForDate(selectedDate);

  renderDateStrip();

  schedEyebrowLabel.textContent = isToday ? '今日日程' : isPast ? '日程回顾' : '日程计划';
  schedDate.textContent = `${selectedDate.getMonth() + 1} 月 ${selectedDate.getDate()} 日 · ${weekdayLabel(selectedDate)}`;
  schedListTitle.textContent = isToday
    ? '今日工作'
    : `${selectedDate.getMonth() + 1} 月 ${selectedDate.getDate()} 日工作`;
  schedCount.textContent = `${tasks.length} 项`;

  if (isToday) {
    schedEmptyTitle.textContent = '今天没有安排';
    schedEmptyHint.textContent = '点上方「添加工作」安排今天的事项';
  } else if (isPast) {
    schedEmptyTitle.textContent = '这一天没有记录';
    schedEmptyHint.textContent = '这一天没有安排工作';
  } else {
    schedEmptyTitle.textContent = '这一天还没有安排';
    schedEmptyHint.textContent = '点上方「添加工作」提前安排';
  }

  schedEmpty.hidden = tasks.length > 0;
  schedList.hidden = tasks.length === 0;

  schedule.rows.clear();
  const fragment = document.createDocumentFragment();

  tasks.forEach((item) => {
    const row = document.createElement('li');
    row.className = 'sched-item';
    row.dataset.id = item.id;
    if (isFuture) row.classList.add('is-future');
    if (schedule.inline && schedule.inline.id === item.id) row.classList.add('is-inline');

    let left;
    let check = null;

    if (isFuture) {
      left = document.createElement('span');
      left.className = 'sched-plan-mark';
      left.title = '计划中的工作';
      left.setAttribute('aria-label', '计划中的工作');
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sched-check';
      const done = isCompleted(item.id, selectedKey);
      button.setAttribute('aria-pressed', String(done));
      button.setAttribute('aria-label', done ? `取消完成 ${item.name}` : `标记完成 ${item.name}`);
      button.title = done ? '取消完成' : '标记完成';
      check = button;
      left = button;
    }

    const main = document.createElement('div');
    main.className = 'sched-main';

    const line = document.createElement('div');
    line.className = 'sched-line';

    const inlineField = schedule.inline && schedule.inline.id === item.id
      ? schedule.inline.field
      : null;

    if (inlineField) {
      line.append(createInlineEditor(inlineField, item));
    } else {
      const timeEl = createField('time', item);
      const nameEl = createField('name', item);
      const durEl = createField('duration', item);
      line.append(timeEl, nameEl, durEl);
    }

    const status = document.createElement('div');
    status.className = 'sched-status';

    const bar = document.createElement('div');
    bar.className = 'sched-bar';
    const barFill = document.createElement('i');
    bar.append(barFill);

    main.append(line, status, bar);

    const actions = document.createElement('div');
    actions.className = 'sched-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'sched-edit';
    edit.title = '修改';
    edit.setAttribute('aria-label', `修改 ${item.name}`);
    edit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'sched-del';
    del.textContent = '×';
    del.title = '删除';
    del.setAttribute('aria-label', `删除 ${item.name}`);

    actions.append(edit, del);
    row.append(left, main, actions);
    fragment.append(row);

    schedule.rows.set(item.id, { row, status, bar: barFill, check });
  });

  schedList.replaceChildren(fragment);
  schedule.renderDay = todayKey;
  updateScheduleLive();

  if (schedule.inline) bindInlineInput();
}

/* ---------- 实时状态 ---------- */
function updateScheduleLive() {
  const now = new Date();
  const todayKey = localDateKey(now);

  if (todayKey !== schedule.renderDay) {
    if (dateKeyOf(selectedDate) === schedule.renderDay) {
      selectedDate = startOfDay(now);
    }
    renderSchedule();
    if (activePanel === 'stats') renderStats();
    return;
  }

  const selectedKey = dateKeyOf(selectedDate);
  const todayStart = startOfDay(now);
  const selectedStart = startOfDay(selectedDate);

  if (selectedKey === todayKey) {
    updateTodayLive(now);
  } else if (selectedStart.getTime() < todayStart.getTime()) {
    updatePastLive(now);
  } else {
    updateFutureLive();
  }
}

function updateTodayLive(now) {
  const date = selectedDate;
  const dateKey = dateKeyOf(date);
  const tasks = tasksForDate(date);
  const total = tasks.length;
  const nowMinutes = (now.getHours() * 60) + now.getMinutes() + (now.getSeconds() / 60);
  let current = null;
  let next = null;
  let doneCount = 0;

  tasks.forEach((item) => {
    const start = parseClock(item.time);
    const rowEntry = schedule.rows.get(item.id);
    if (start === null || !rowEntry) return;

    const end = start + item.duration;
    const done = isCompleted(item.id, dateKey);
    if (done) doneCount += 1;

    let label = '';
    let isCurrent = false;
    let isPast = false;
    let progress = 0;

    if (done) {
      label = '已完成';
    } else if (nowMinutes >= start && nowMinutes < end) {
      isCurrent = true;
      progress = clamp(((nowMinutes - start) / item.duration) * 100, 0, 100);
      label = `进行中 · 剩余 ${minutesLabel(end - nowMinutes, true)}`;
      if (!current) current = { item, start, end };
    } else if (nowMinutes >= end) {
      isPast = true;
      label = '已结束 · 未打卡';
    } else {
      label = `还有 ${minutesLabel(start - nowMinutes, true)}`;
      if (!next) next = { item, start };
    }

    rowEntry.row.classList.toggle('is-done', done);
    rowEntry.row.classList.toggle('is-current', isCurrent);
    rowEntry.row.classList.toggle('is-past', isPast);
    rowEntry.status.textContent = `${label} · ${recurrenceLabel(item.recurrence)}`;
    rowEntry.bar.style.width = `${isCurrent ? progress : 0}%`;
    if (rowEntry.check) {
      rowEntry.check.setAttribute('aria-pressed', String(done));
      rowEntry.check.setAttribute('aria-label', done ? `取消完成 ${item.name}` : `标记完成 ${item.name}`);
      rowEntry.check.title = done ? '取消完成' : '标记完成';
    }
  });

  schedProgressLabel.textContent = '今日进度';
  schedProgressText.textContent = `${doneCount} / ${total}`;
  schedProgressBar.style.width = total ? `${(doneCount / total) * 100}%` : '0%';
  schedHeroCount.classList.remove('is-check', 'is-placeholder');

  if (total === 0) {
    schedHeroTitle.textContent = '今天没有安排';
    schedHeroCount.textContent = '待安排';
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = '添加一项每天、每周或每月重复的工作';
  } else if (current) {
    schedHeroTitle.textContent = `正在进行 · ${current.item.time} ${current.item.name}`;
    schedHeroCount.textContent = formatHms((current.end - nowMinutes) * 60000);
    schedHeroMeta.textContent = `今日 ${doneCount} / ${total} 已完成 · 结束于 ${clockFromMinutes(current.end)}`;
  } else if (next) {
    schedHeroTitle.textContent = `下一项 · ${next.item.time} ${next.item.name}`;
    schedHeroCount.textContent = formatHms((next.start - nowMinutes) * 60000);
    schedHeroMeta.textContent = `今日 ${doneCount} / ${total} 已完成 · ${minutesLabel(next.start - nowMinutes, true)}后开始`;
  } else if (doneCount === total) {
    schedHeroTitle.textContent = `今日 ${total} 项全部完成`;
    schedHeroCount.textContent = '✓';
    schedHeroCount.classList.add('is-check');
    schedHeroMeta.textContent = '今天这一组已经收工';
  } else {
    schedHeroTitle.textContent = `今天还有 ${total - doneCount} 项未打卡`;
    schedHeroCount.textContent = '待打卡';
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = '已过时间的工作仍可补打卡';
  }
}

function updatePastLive() {
  const date = selectedDate;
  const dateKey = dateKeyOf(date);
  const tasks = tasksForDate(date);
  const total = tasks.length;
  let doneCount = 0;

  tasks.forEach((item) => {
    const rowEntry = schedule.rows.get(item.id);
    if (!rowEntry) return;
    const done = isCompleted(item.id, dateKey);
    if (done) doneCount += 1;
    rowEntry.row.classList.toggle('is-done', done);
    rowEntry.row.classList.remove('is-current', 'is-past');
    rowEntry.status.textContent = `${done ? '已完成' : '未完成'} · ${recurrenceLabel(item.recurrence)}`;
    rowEntry.bar.style.width = '0%';
    if (rowEntry.check) {
      rowEntry.check.setAttribute('aria-pressed', String(done));
      rowEntry.check.setAttribute('aria-label', done ? `取消完成 ${item.name}` : `标记完成 ${item.name}`);
      rowEntry.check.title = done ? '取消完成' : '标记完成';
    }
  });

  schedProgressLabel.textContent = '完成情况';
  schedProgressText.textContent = `${doneCount} / ${total}`;
  schedProgressBar.style.width = total ? `${(doneCount / total) * 100}%` : '0%';
  schedHeroCount.classList.remove('is-check', 'is-placeholder');

  if (total === 0) {
    schedHeroTitle.textContent = '这一天没有安排';
    schedHeroCount.textContent = '无记录';
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = '可以切换到其他日期查看';
  } else if (doneCount === total) {
    schedHeroTitle.textContent = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 全部完成`;
    schedHeroCount.textContent = '✓';
    schedHeroCount.classList.add('is-check');
    schedHeroMeta.textContent = `共 ${total} 项工作`;
  } else {
    schedHeroTitle.textContent = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${total} 项工作`;
    schedHeroCount.textContent = `${doneCount}/${total}`;
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = `已完成 ${doneCount} 项 · 未完成 ${total - doneCount} 项`;
  }
}

function updateFutureLive() {
  const date = selectedDate;
  const tasks = tasksForDate(date);
  const total = tasks.length;
  const diff = daysFromToday(date);
  const relative = diff === 1 ? '明天' : `${diff} 天后`;

  tasks.forEach((item) => {
    const rowEntry = schedule.rows.get(item.id);
    if (!rowEntry) return;
    rowEntry.row.classList.remove('is-done', 'is-current', 'is-past');
    rowEntry.status.textContent = `计划 · ${recurrenceLabel(item.recurrence)}`;
    rowEntry.bar.style.width = '0%';
  });

  schedProgressLabel.textContent = '计划事项';
  schedProgressText.textContent = `${total} 项`;
  schedProgressBar.style.width = '0%';
  schedHeroCount.classList.remove('is-check', 'is-placeholder');

  if (total === 0) {
    schedHeroTitle.textContent = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 还没有安排`;
    schedHeroCount.textContent = '待安排';
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = '点上方「添加工作」提前安排';
  } else {
    schedHeroTitle.textContent = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${total} 项计划`;
    schedHeroCount.textContent = relative;
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = `第一项 ${tasks[0].time} · 共 ${total} 项`;
  }
}

/* ---------- 打卡 ---------- */
function toggleScheduleDone(id) {
  const date = selectedDate;
  if (startOfDay(date).getTime() > startOfDay(new Date()).getTime()) return;
  const item = schedule.items.find((entry) => entry.id === id);
  if (!item) return;
  const dateKey = dateKeyOf(date);

  if (isCompleted(item.id, dateKey)) {
    removeCompletion(item.id, dateKey);
  } else {
    addCompletion(item, dateKey);
  }

  updateScheduleLive();
  renderStats();
}

function deleteScheduleItem(id) {
  const index = schedule.items.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const removed = schedule.items.splice(index, 1)[0];
  saveSchedule();
  renderSchedule();
  renderStats();
  showToast(`已删除「${removed.name}」`, '撤销', () => {
    schedule.items.push(removed);
    saveSchedule();
    renderSchedule();
    renderStats();
  });
}

/* ---------- 添加 / 修改弹窗 ---------- */
function setScheduleEditMessage(text, isError = false) {
  schedEditMsg.textContent = text;
  schedEditMsg.classList.toggle('is-error', isError);
}

function setRepeatFields(type) {
  schedRepeatType.value = type;
  schedOnceDateField.hidden = type !== 'once';
  schedWeekdayField.hidden = type !== 'weekly';
  schedMonthDayField.hidden = type !== 'monthly';
}

function setWeekdaySelection(days) {
  const selected = new Set(days);
  $$('button', schedWeekdays).forEach((button) => {
    const active = selected.has(Number(button.dataset.weekday));
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function getWeekdaySelection() {
  return $$('button.is-active', schedWeekdays)
    .map((button) => Number(button.dataset.weekday))
    .filter((value) => Number.isInteger(value));
}

function parseMonthDays(value) {
  const parts = String(value).split(/[,，、\s]+/).filter(Boolean);
  const days = [];
  let invalid = false;
  parts.forEach((part) => {
    const day = Number(part);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      invalid = true;
    } else {
      days.push(day);
    }
  });
  return { days: [...new Set(days)].sort((a, b) => a - b), invalid };
}

function readRecurrenceInputs() {
  const type = schedRepeatType.value;
  if (type === 'once') {
    return { type, date: schedOnceDate.value, weekdays: [], monthDays: [] };
  }
  if (type === 'weekly') {
    return { type, weekdays: getWeekdaySelection(), monthDays: [] };
  }
  if (type === 'monthly') {
    const parsed = parseMonthDays(schedMonthDays.value);
    return { type, weekdays: [], monthDays: parsed.days, invalid: parsed.invalid };
  }
  return { type: 'daily', weekdays: [], monthDays: [] };
}

function openAddDialog() {
  dialogMode = 'add';
  editingScheduleId = '';
  schedEditTitle.textContent = '添加工作';
  schedEditSave.textContent = '添加';
  schedEditName.value = '';
  schedEditTime.value = defaultScheduleTime();
  schedEditDuration.value = '60';
  setRepeatFields('daily');
  schedOnceDate.value = dateKeyOf(selectedDate);
  setWeekdaySelection([]);
  schedMonthDays.value = '';
  setScheduleEditMessage('');

  if (!schedEditDialog.open) schedEditDialog.showModal();
  schedEditName.focus();
}

function openEditDialog(id) {
  const item = schedule.items.find((entry) => entry.id === id);
  if (!item) return;

  dialogMode = 'edit';
  editingScheduleId = id;
  schedEditTitle.textContent = '修改工作';
  schedEditSave.textContent = '保存';
  schedEditName.value = item.name;
  schedEditTime.value = item.time;
  schedEditDuration.value = String(item.duration);

  const recurrence = item.recurrence || { type: 'daily' };
  setRepeatFields(recurrence.type);
  schedOnceDate.value = recurrence.date || dateKeyOf(selectedDate);
  setWeekdaySelection(recurrence.weekdays || []);
  schedMonthDays.value = (recurrence.monthDays || []).join(', ');
  setScheduleEditMessage('');

  if (!schedEditDialog.open) schedEditDialog.showModal();
  schedEditName.focus();
  schedEditName.select();
}

function closeScheduleEdit() {
  if (schedEditDialog.open) schedEditDialog.close();
}

schedAddBtn.addEventListener('click', openAddDialog);

schedRepeatType.addEventListener('change', () => {
  const type = schedRepeatType.value;
  setRepeatFields(type);

  if (type === 'weekly' && getWeekdaySelection().length === 0) {
    const weekday = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    setWeekdaySelection([weekday]);
  }

  if (type === 'monthly' && !schedMonthDays.value.trim()) {
    schedMonthDays.value = String(selectedDate.getDate());
  }

  if (type === 'once' && !schedOnceDate.value) {
    schedOnceDate.value = dateKeyOf(selectedDate);
  }
});

schedWeekdays.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-weekday]');
  if (!button) return;
  const active = button.classList.toggle('is-active');
  button.setAttribute('aria-pressed', String(active));
});

schedEditForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = schedEditName.value.trim();
  const time = normalizeClock(schedEditTime.value);
  const duration = Math.round(Number(schedEditDuration.value));

  if (!name) {
    setScheduleEditMessage('请填写工作名称', true);
    schedEditName.focus();
    return;
  }
  if (!time) {
    setScheduleEditMessage('请选择开始时间', true);
    schedEditTime.focus();
    return;
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 720) {
    setScheduleEditMessage('时长需在 1–720 分钟之间', true);
    schedEditDuration.focus();
    return;
  }

  const recurrence = readRecurrenceInputs();
  if (recurrence.type === 'once' && !parseDateKey(recurrence.date)) {
    setScheduleEditMessage('请选择仅一次的日期', true);
    schedOnceDate.focus();
    return;
  }
  if (recurrence.type === 'weekly' && recurrence.weekdays.length === 0) {
    setScheduleEditMessage('请至少选择一个星期几', true);
    schedWeekdayField.focus();
    return;
  }
  if (recurrence.type === 'monthly') {
    if (recurrence.invalid) {
      setScheduleEditMessage('每月几号只能填 1–31 之间的数字', true);
      schedMonthDays.focus();
      return;
    }
    if (recurrence.monthDays.length === 0) {
      setScheduleEditMessage('请填写每月几号，例如 1, 15', true);
      schedMonthDays.focus();
      return;
    }
  }

  if (dialogMode === 'add') {
    const item = {
      id: makeScheduleId(),
      name: name.slice(0, 24),
      time,
      duration,
      recurrence: normalizeRecurrence(recurrence),
    };
    schedule.items.push(item);
    saveSchedule();
    closeScheduleEdit();
    renderSchedule();
    renderStats();
    showToast(`已添加「${item.name}」`, '', null);
    if (!occursOn(item, selectedDate)) {
      showToast(`已添加，但不在当前日期显示（${recurrenceLabel(item.recurrence)}）`, '', null);
    }
  } else {
    const item = schedule.items.find((entry) => entry.id === editingScheduleId);
    if (!item) {
      closeScheduleEdit();
      return;
    }
    item.name = name.slice(0, 24);
    item.time = time;
    item.duration = duration;
    item.recurrence = normalizeRecurrence(recurrence);
    saveSchedule();
    closeScheduleEdit();
    renderSchedule();
    renderStats();
    if (!occursOn(item, selectedDate)) {
      showToast(`已保存，但不在当前日期显示（${recurrenceLabel(item.recurrence)}）`, '', null);
    } else {
      showToast('已保存', '', null);
    }
  }
});

schedEditClose.addEventListener('click', closeScheduleEdit);
schedEditCancel.addEventListener('click', closeScheduleEdit);

schedEditDialog.addEventListener('close', () => {
  editingScheduleId = '';
  dialogMode = 'edit';
});

schedEditDialog.addEventListener('click', (event) => {
  if (event.target === schedEditDialog) closeScheduleEdit();
});

[schedEditName, schedEditTime, schedEditDuration, schedMonthDays].forEach((input) => {
  input.addEventListener('input', () => {
    if (schedEditMsg.classList.contains('is-error')) setScheduleEditMessage('');
  });
});

/* ---------- 日期条交互 ---------- */
schedPrevWeek.addEventListener('click', () => {
  selectedDate = addDays(selectedDate, -7);
  renderSchedule();
});

schedNextWeek.addEventListener('click', () => {
  selectedDate = addDays(selectedDate, 7);
  renderSchedule();
});

schedTodayBtn.addEventListener('click', () => {
  selectedDate = startOfDay(new Date());
  renderSchedule();
});

schedDateStrip.addEventListener('click', (event) => {
  const pill = event.target.closest('.date-pill');
  if (!pill) return;
  const date = parseDateKey(pill.dataset.date);
  if (!date) return;
  selectedDate = startOfDay(date);
  renderSchedule();
});

/* ---------- 列表交互 ---------- */
schedList.addEventListener('click', (event) => {
  const field = event.target.closest('[data-field]');
  if (field) {
    const row = field.closest('.sched-item');
    if (row) {
      beginInlineEdit(row.dataset.id, field.dataset.field);
      return;
    }
  }

  const row = event.target.closest('.sched-item');
  if (!row) return;
  const id = row.dataset.id;

  if (event.target.closest('.sched-check')) {
    toggleScheduleDone(id);
  } else if (event.target.closest('.sched-edit')) {
    openEditDialog(id);
  } else if (event.target.closest('.sched-del')) {
    deleteScheduleItem(id);
  }
});

schedList.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const field = event.target.closest('[data-field]');
  if (!field) return;
  event.preventDefault();
  const row = field.closest('.sched-item');
  if (row) beginInlineEdit(row.dataset.id, field.dataset.field);
});

/* ---------- 初始化 ---------- */
function initSchedule() {
  schedule.items = loadSchedule();
  loadCompletions();
  migrateDoneOn();
  selectedDate = startOfDay(new Date());
  renderSchedule();
}

/* =========================================================
   完成统计
   ========================================================= */
const statTodayRate = $('#statTodayRate');
const statTodayDetail = $('#statTodayDetail');
const statWeekCount = $('#statWeekCount');
const statStreak = $('#statStreak');
const statTotal = $('#statTotal');
const statsChart = $('#statsChart');
const statsRanking = $('#statsRanking');
const statsRecent = $('#statsRecent');
const statsRange7 = $('#statsRange7');
const statsRange30 = $('#statsRange30');

let statsRange = 7;

function completionCountByDate(dateKey) {
  return completions.filter((entry) => entry.date === dateKey).length;
}

function renderStatsChart(today, todayKey) {
  const days = [];
  for (let offset = statsRange - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const key = dateKeyOf(date);
    days.push({
      date,
      key,
      count: completionCountByDate(key),
      isToday: key === todayKey,
    });
  }

  const max = Math.max(1, ...days.map((entry) => entry.count));
  const rangeTotal = days.reduce((sum, entry) => sum + entry.count, 0);
  statsChart.classList.toggle('is-30', statsRange === 30);
  const fragment = document.createDocumentFragment();

  days.forEach((entry, index) => {
    const column = document.createElement('div');
    column.className = 'chart-col';
    if (entry.isToday) column.classList.add('is-today');
    column.title = `${entry.date.getMonth() + 1} 月 ${entry.date.getDate()} 日 · ${entry.count} 次完成`;

    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    const fill = document.createElement('i');
    const height = entry.count === 0 ? 0 : Math.max(5, (entry.count / max) * 100);
    fill.style.height = `${height}%`;
    bar.append(fill);

    const label = document.createElement('span');
    label.className = 'chart-label';
    if (statsRange === 7) {
      label.textContent = `${entry.date.getMonth() + 1}/${entry.date.getDate()}`;
    } else {
      label.textContent = index % 5 === 0 || index === days.length - 1
        ? String(entry.date.getDate())
        : '';
    }

    column.append(bar, label);
    fragment.append(column);
  });

  if (rangeTotal === 0) {
    const empty = document.createElement('div');
    empty.className = 'chart-empty';
    empty.textContent = '还没有完成数据';
    fragment.append(empty);
  }

  statsChart.replaceChildren(fragment);
}

function renderStatsRanking() {
  const counts = new Map();
  completions.forEach((entry) => {
    const current = counts.get(entry.taskId) || { count: 0, name: entry.name, at: 0 };
    current.count += 1;
    if (entry.at >= current.at) {
      current.name = entry.name;
      current.at = entry.at;
    }
    counts.set(entry.taskId, current);
  });

  const itemsById = new Map(schedule.items.map((item) => [item.id, item]));
  const rows = [...counts.entries()]
    .map(([taskId, entry]) => ({
      name: itemsById.get(taskId)?.name || entry.name,
      count: entry.count,
      at: entry.at,
    }))
    .sort((a, b) => b.count - a.count || b.at - a.at)
    .slice(0, 5);

  if (rows.length === 0) {
    statsRanking.innerHTML = '<div class="stats-empty">还没有完成记录</div>';
    return;
  }

  const max = Math.max(...rows.map((row) => row.count));
  const fragment = document.createDocumentFragment();

  rows.forEach((row, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'rank-row';

    const rankIndex = document.createElement('span');
    rankIndex.className = 'rank-index';
    rankIndex.textContent = String(index + 1).padStart(2, '0');

    const main = document.createElement('div');
    main.className = 'rank-main';
    const name = document.createElement('div');
    name.className = 'rank-name';
    name.textContent = row.name;
    const bar = document.createElement('div');
    bar.className = 'rank-bar';
    const fill = document.createElement('i');
    fill.style.width = `${(row.count / max) * 100}%`;
    bar.append(fill);
    main.append(name, bar);

    const count = document.createElement('span');
    count.className = 'rank-count';
    count.textContent = String(row.count);

    wrapper.append(rankIndex, main, count);
    fragment.append(wrapper);
  });

  statsRanking.replaceChildren(fragment);
}

function renderStatsRecent() {
  const rows = [...completions]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  if (rows.length === 0) {
    statsRecent.innerHTML = '<div class="stats-empty">完成一项工作后，这里会出现记录</div>';
    return;
  }

  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const fragment = document.createDocumentFragment();

  rows.forEach((entry) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'recent-row';

    const name = document.createElement('span');
    name.className = 'recent-name';
    name.textContent = entry.name;

    const time = document.createElement('span');
    time.className = 'recent-time';
    const at = new Date(entry.at);
    const entryDate = parseDateKey(entry.date) || at;
    let dateLabel;
    if (dateKeyOf(entryDate) === dateKeyOf(today)) {
      dateLabel = '今天';
    } else if (dateKeyOf(entryDate) === dateKeyOf(yesterday)) {
      dateLabel = '昨天';
    } else {
      dateLabel = `${entryDate.getMonth() + 1}/${entryDate.getDate()}`;
    }
    time.textContent = `${dateLabel} ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;

    wrapper.append(name, time);
    fragment.append(wrapper);
  });

  statsRecent.replaceChildren(fragment);
}

function renderStats() {
  const today = startOfDay(new Date());
  const todayKey = dateKeyOf(today);
  const todayTasks = tasksForDate(today);
  const doneToday = todayTasks.filter((item) => isCompleted(item.id, todayKey)).length;
  const totalToday = todayTasks.length;
  const rate = totalToday ? Math.round((doneToday / totalToday) * 100) : null;

  statTodayRate.textContent = rate === null ? '—' : `${rate}%`;
  statTodayDetail.textContent = totalToday
    ? `${doneToday} / ${totalToday} 项`
    : '今天没有安排';

  const weekStart = addDays(today, -6);
  const weekCount = completions.filter((entry) => (
    entry.date >= dateKeyOf(weekStart) && entry.date <= todayKey
  )).length;
  statWeekCount.textContent = String(weekCount);

  const completionDays = new Set(completions.map((entry) => entry.date));
  let cursor = completionDays.has(todayKey) ? today : addDays(today, -1);
  let streak = 0;
  while (completionDays.has(dateKeyOf(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  statStreak.textContent = String(streak);
  statTotal.textContent = String(completions.length);

  renderStatsChart(today, todayKey);
  renderStatsRanking();
  renderStatsRecent();
}

[statsRange7, statsRange30].forEach((button) => {
  button.addEventListener('click', () => {
    statsRange = Number(button.dataset.range);
    statsRange7.classList.toggle('is-active', statsRange === 7);
    statsRange30.classList.toggle('is-active', statsRange === 30);
    renderStats();
  });
});

/* =========================================================
   AI 助手（OpenAI 兼容接口）
   ========================================================= */
const aiProvider = $('#aiProvider');
const aiKey = $('#aiKey');
const aiBase = $('#aiBase');
const aiModel = $('#aiModel');
const aiContext = $('#aiContext');
const aiSave = $('#aiSave');
const aiClear = $('#aiClear');
const aiSend = $('#aiSend');
const aiInput = $('#aiInput');
const aiMessages = $('#aiMessages');
const aiEmpty = $('#aiEmpty');
const aiStatus = $('#aiStatus');
const aiClearChat = $('#aiClearChat');

const AI_PRESETS = {
  deepseek: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openai: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
};

const aiSettings = {
  provider: 'deepseek',
  base: AI_PRESETS.deepseek.base,
  model: AI_PRESETS.deepseek.model,
  key: '',
  context: true,
};

let aiChat = [];
let aiError = '';
let aiLoading = false;

function loadAiSettings() {
  let raw = {};
  try {
    raw = JSON.parse(store.get('tc.aiSettings', '{}')) || {};
  } catch {
    raw = {};
  }

  aiSettings.provider = ['deepseek', 'openai', 'custom'].includes(raw.provider)
    ? raw.provider
    : 'deepseek';
  const preset = AI_PRESETS[aiSettings.provider];
  aiSettings.base = typeof raw.base === 'string' && raw.base.trim()
    ? raw.base.trim()
    : (preset ? preset.base : '');
  aiSettings.model = typeof raw.model === 'string' && raw.model.trim()
    ? raw.model.trim()
    : (preset ? preset.model : '');
  aiSettings.key = typeof raw.key === 'string' ? raw.key : '';
  aiSettings.context = raw.context !== false;
}

function saveAiSettings() {
  store.set('tc.aiSettings', JSON.stringify({
    provider: aiSettings.provider,
    base: aiSettings.base,
    model: aiSettings.model,
    key: aiSettings.key,
    context: aiSettings.context,
  }));
}

function applyAiFields() {
  aiProvider.value = aiSettings.provider;
  aiKey.value = aiSettings.key;
  aiBase.value = aiSettings.base;
  aiModel.value = aiSettings.model;
  aiContext.checked = aiSettings.context;
}

function setAiStatus(text, isError = false) {
  aiStatus.textContent = text;
  aiStatus.classList.toggle('is-error', isError);
}

function renderAiChat() {
  aiMessages.querySelectorAll('.ai-msg').forEach((node) => node.remove());
  aiEmpty.hidden = aiChat.length > 0 || aiLoading;
  aiSend.disabled = aiLoading;

  aiChat.forEach((message) => {
    const bubble = document.createElement('div');
    bubble.className = `ai-msg ${message.role}`;
    bubble.textContent = message.content;
    aiMessages.append(bubble);
  });

  if (aiLoading) {
    const typing = document.createElement('div');
    typing.className = 'ai-msg assistant is-typing';
    typing.textContent = '正在思考…';
    aiMessages.append(typing);
  }

  if (aiError) {
    const error = document.createElement('div');
    error.className = 'ai-msg error';
    error.textContent = aiError;
    aiMessages.append(error);
  }

  aiMessages.scrollTop = aiMessages.scrollHeight;
}

function resizeAiInput() {
  aiInput.style.height = 'auto';
  aiInput.style.height = `${Math.min(150, Math.max(46, aiInput.scrollHeight))}px`;
}

function aiTodaySummary() {
  const today = startOfDay(new Date());
  const todayKey = dateKeyOf(today);
  const tasks = tasksForDate(today);
  const done = tasks.filter((item) => isCompleted(item.id, todayKey)).length;

  const lines = tasks.length
    ? tasks.map((item) => {
      const status = isCompleted(item.id, todayKey) ? '已完成' : '未完成';
      return `- ${item.time} ${item.name}（${item.duration} 分钟，${recurrenceLabel(item.recurrence)}）${status}`;
    })
    : ['- 今天没有安排任务'];

  const weekStart = addDays(today, -6);
  const weekCount = completions.filter((entry) => (
    entry.date >= dateKeyOf(weekStart) && entry.date <= todayKey
  )).length;

  const completionDays = new Set(completions.map((entry) => entry.date));
  let cursor = completionDays.has(todayKey) ? today : addDays(today, -1);
  let streak = 0;
  while (completionDays.has(dateKeyOf(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return [
    `今天是 ${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日 ${weekdayLabel(today)}。`,
    `今日任务（完成 ${done}/${tasks.length}）：`,
    ...lines,
    `近 7 天完成 ${weekCount} 次，连续打卡 ${streak} 天。`,
  ].join('\n');
}

function extractAiContent(data) {
  const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || part?.content || '').join('');
  }
  return typeof content === 'string' ? content : '';
}

async function sendAiMessage() {
  if (aiLoading) return;

  const text = aiInput.value.trim();
  if (!text) return;

  if (!aiSettings.key.trim()) {
    showToast('请先填写并保存 API Key', '', null);
    aiKey.focus();
    return;
  }
  if (!aiSettings.base.trim() || !aiSettings.model.trim()) {
    showToast('请填写 Base URL 和模型', '', null);
    return;
  }

  aiChat.push({ role: 'user', content: text });
  if (aiChat.length > 30) aiChat = aiChat.slice(-30);
  aiInput.value = '';
  resizeAiInput();
  aiError = '';
  aiLoading = true;
  setAiStatus('正在请求 AI…');
  renderAiChat();

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60000);

  try {
    const system = [
      '你是「时间计数器」里的 AI 助手，帮助用户安排工作、拆解任务、复盘完成情况。',
      '回答简洁、具体、可执行，使用中文。',
      aiSettings.context ? `\n${aiTodaySummary()}` : '',
    ].join('\n');

    const messages = [
      { role: 'system', content: system },
      ...aiChat.slice(-20).map((message) => ({ role: message.role, content: message.content })),
    ];

    const response = await fetch(`${aiSettings.base.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiSettings.key.trim()}`,
      },
      body: JSON.stringify({
        model: aiSettings.model.trim(),
        messages,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) throw new Error('API Key 无效或没有权限');
      if (response.status === 429) throw new Error('请求过于频繁，请稍后再试');
      const message = data?.error?.message || data?.message || `请求失败（HTTP ${response.status}）`;
      throw new Error(message);
    }

    const content = extractAiContent(data);
    if (!content) throw new Error('接口没有返回内容');

    aiChat.push({ role: 'assistant', content });
    aiError = '';
  } catch (error) {
    if (error.name === 'AbortError') {
      aiError = '请求超时，请检查网络或接口地址。';
    } else if (error instanceof TypeError) {
      aiError = '网络请求失败，可能是 Base URL 不正确，或被浏览器 CORS 策略拦截。';
    } else {
      aiError = error.message || '请求失败';
    }
  } finally {
    clearTimeout(timer);
    aiLoading = false;
    setAiStatus('');
    renderAiChat();
  }
}

function clearAiChat() {
  aiChat = [];
  aiError = '';
  renderAiChat();
  setAiStatus('');
}

aiProvider.addEventListener('change', () => {
  const preset = AI_PRESETS[aiProvider.value];
  if (preset) {
    aiBase.value = preset.base;
    aiModel.value = preset.model;
  }
  setAiStatus('');
  showToast('已切换服务商，记得保存设置', '', null);
});
aiSave.addEventListener('click', () => {
  const base = aiBase.value.trim();
  const model = aiModel.value.trim();
  const key = aiKey.value.trim();

  if (!/^https?:\/\//i.test(base)) {
    showToast('Base URL 需要以 http:// 或 https:// 开头', '', null);
    return;
  }
  if (!model) {
    showToast('请填写模型名称', '', null);
    return;
  }

  aiSettings.provider = aiProvider.value;
  aiSettings.base = base;
  aiSettings.model = model;
  aiSettings.key = key;
  aiSettings.context = aiContext.checked;
  saveAiSettings();
  setAiStatus('');
  showToast('AI 设置已保存', '', null);
});

aiClear.addEventListener('click', () => {
  aiSettings.key = '';
  aiKey.value = '';
  saveAiSettings();
  setAiStatus('');
  showToast('已清除 API Key', '', null);
});

aiContext.addEventListener('change', () => {
  aiSettings.context = aiContext.checked;
  saveAiSettings();
});

aiSend.addEventListener('click', sendAiMessage);

aiClearChat.addEventListener('click', clearAiChat);

aiInput.addEventListener('input', resizeAiInput);

aiInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendAiMessage();
  }
});

aiMessages.addEventListener('click', (event) => {
  const prompt = event.target.closest('[data-prompt]');
  if (!prompt) return;
  aiInput.value = prompt.dataset.prompt;
  resizeAiInput();
  sendAiMessage();
});

function initStats() {
  renderStats();
}

function initAi() {
  loadAiSettings();
  applyAiFields();
  renderAiChat();
  resizeAiInput();
}

/* =========================================================
   工作 / 休息循环（专注循环）
   ========================================================= */
const pomoCard = $('#pomoCard');
const pomoDisplay = $('#pomoDisplay');
const pomoStatus = $('#pomoStatus');
const pomoRoundEl = $('#pomoRound');
const pomoDots = $('#pomoDots');
const pomoStart = $('#pomoStart');
const pomoSkip = $('#pomoSkip');
const pomoReset = $('#pomoReset');
const pomoHint = $('#pomoHint');
const pomoTotal = $('#pomoTotal');
const pomoRing = $('#pomoRing');
const pomoFocusInput = $('#pomoFocusInput');
const pomoBreakInput = $('#pomoBreakInput');
const pomoRoundsInput = $('#pomoRoundsInput');
const pomoPresets = $('#pomoPresets');
const pomoAuto = $('#pomoAuto');

pomoRing.style.strokeDasharray = String(RING_C);

const pomoInputs = [pomoFocusInput, pomoBreakInput, pomoRoundsInput];

const pomo = {
  phase: 'focus',
  round: 1,
  rounds: 4,
  focusMs: 25 * 60000,
  breakMs: 5 * 60000,
  remaining: 25 * 60000,
  running: false,
  started: false,
  endAt: 0,
  auto: true,
  dotsKey: '',
};

let pomoTimer = 0;
let pomoDaily = { date: '', count: 0 };

function todayPomoCount() {
  const today = localDateKey();
  if (pomoDaily.date !== today) {
    pomoDaily = { date: today, count: 0 };
    store.set('tc.pomoDaily', JSON.stringify(pomoDaily));
  }
  return pomoDaily.count;
}

function addPomoDaily() {
  const today = localDateKey();
  if (pomoDaily.date !== today) {
    pomoDaily = { date: today, count: 0 };
  }
  pomoDaily.count += 1;
  store.set('tc.pomoDaily', JSON.stringify(pomoDaily));
}

function totalPomoMs() {
  return (pomo.focusMs * pomo.rounds) + (pomo.breakMs * Math.max(0, pomo.rounds - 1));
}

function pomoPhaseDuration() {
  return pomo.phase === 'break' ? pomo.breakMs : pomo.focusMs;
}

function loadPomoSettings() {
  let raw = {};
  try {
    raw = JSON.parse(store.get('tc.pomoSettings', '{}')) || {};
  } catch {
    raw = {};
  }
  return {
    focus: clamp(Math.round(Number(raw.focus)) || 25, 1, 180),
    rest: clamp(Math.round(Number(raw.rest)) || 5, 1, 60),
    rounds: clamp(Math.round(Number(raw.rounds)) || 4, 1, 12),
    auto: raw.auto !== false,
  };
}

function savePomoSettings() {
  store.set('tc.pomoSettings', JSON.stringify({
    focus: Math.round(pomo.focusMs / 60000),
    rest: Math.round(pomo.breakMs / 60000),
    rounds: pomo.rounds,
    auto: pomo.auto,
  }));
}

function stopPomoTimer() {
  if (pomoTimer) {
    clearInterval(pomoTimer);
    pomoTimer = 0;
  }
}

function startPomoTimer() {
  stopPomoTimer();
  pomoTimer = window.setInterval(tickPomo, 100);
}

function resetPomoSession() {
  stopPomoTimer();
  pomo.phase = 'focus';
  pomo.round = 1;
  pomo.remaining = pomo.focusMs;
  pomo.running = false;
  pomo.started = false;
  pomo.endAt = 0;
  pomo.dotsKey = '';
}

function applyPomoSettings() {
  if (pomo.started) return;
  const focusValue = parseInt(pomoFocusInput.value, 10);
  const restValue = parseInt(pomoBreakInput.value, 10);
  const roundsValue = parseInt(pomoRoundsInput.value, 10);
  const focus = clamp(Number.isFinite(focusValue) ? focusValue : 25, 1, 180);
  const rest = clamp(Number.isFinite(restValue) ? restValue : 5, 1, 60);
  const rounds = clamp(Number.isFinite(roundsValue) ? roundsValue : 4, 1, 12);
  pomo.focusMs = focus * 60000;
  pomo.breakMs = rest * 60000;
  pomo.rounds = rounds;
  resetPomoSession();
  savePomoSettings();
  renderPomo();
}

function renderPomoDots(completed, currentIndex) {
  const key = `${pomo.rounds}|${completed}|${currentIndex}`;
  if (key === pomo.dotsKey) return;
  pomo.dotsKey = key;

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < pomo.rounds; index += 1) {
    const dot = document.createElement('span');
    dot.className = 'pomo-dot';
    if (index < completed) dot.classList.add('is-done');
    if (index === currentIndex) dot.classList.add('is-now');
    fragment.append(dot);
  }
  pomoDots.replaceChildren(fragment);
}

function renderPomo() {
  const done = pomo.phase === 'done';
  const duration = done ? 0 : pomoPhaseDuration();
  const showHours = (pomo.phase === 'break' ? pomo.breakMs : pomo.focusMs) >= 3600000;

  pomoDisplay.textContent = formatCountdown(done ? 0 : pomo.remaining, showHours);

  const ratio = duration > 0 ? clamp(pomo.remaining / duration, 0, 1) : 0;
  pomoRing.style.strokeDashoffset = String(RING_C * (1 - ratio));

  if (done) {
    pomoStatus.textContent = '全部完成';
  } else if (pomo.running) {
    pomoStatus.textContent = pomo.phase === 'focus' ? '专注中' : '休息中';
  } else if (!pomo.started) {
    pomoStatus.textContent = '准备开始';
  } else if (pomo.remaining < duration - 100) {
    pomoStatus.textContent = '已暂停';
  } else if (pomo.phase === 'break') {
    pomoStatus.textContent = '休息一下';
  } else {
    pomoStatus.textContent = '准备专注';
  }

  pomoStatus.classList.toggle('is-done', done);
  pomoCard.classList.toggle('is-break', pomo.phase === 'break');
  pomoCard.classList.toggle('is-done', done);
  pomoDisplay.classList.toggle('is-low', pomo.running && pomo.remaining <= 10000);

  pomoRoundEl.textContent = done
    ? `共 ${pomo.rounds} 轮`
    : `第 ${pomo.round} / ${pomo.rounds} 轮`;

  const completed = done
    ? pomo.rounds
    : pomo.phase === 'break'
      ? pomo.round
      : pomo.round - 1;
  const currentIndex = done || pomo.phase === 'break' ? -1 : pomo.round - 1;
  renderPomoDots(completed, currentIndex);

  if (pomo.running) {
    pomoStart.textContent = '暂停';
  } else if (done) {
    pomoStart.textContent = '再来一组';
  } else if (!pomo.started) {
    pomoStart.textContent = '开始';
  } else if (pomo.remaining > 0 && pomo.remaining < duration) {
    pomoStart.textContent = '继续';
  } else if (pomo.phase === 'break') {
    pomoStart.textContent = '开始休息';
  } else {
    pomoStart.textContent = '开始专注';
  }

  pomoSkip.disabled = !pomo.started || done;
  pomoReset.disabled = !pomo.started && !done && pomo.phase === 'focus'
    && pomo.remaining === pomo.focusMs;

  const locked = pomo.started;
  pomoInputs.forEach((input) => {
    input.disabled = locked;
  });
  $$('.chip', pomoPresets).forEach((chip) => {
    chip.disabled = locked;
  });

  pomoTotal.textContent = `一组约 ${formatDuration(totalPomoMs())}`;
  pomoHint.textContent = `今日已完成 ${todayPomoCount()} 轮专注`;

  updateDocumentTitle();
}

function togglePomo() {
  if (pomo.running) {
    pomo.remaining = Math.max(0, pomo.endAt - Date.now());
    pomo.running = false;
    pomo.endAt = 0;
    stopPomoTimer();
    renderPomo();
    return;
  }

  ensureAudio();

  if (pomo.phase === 'done') {
    resetPomoSession();
  }

  pomo.started = true;
  pomo.running = true;
  if (pomo.remaining <= 0) pomo.remaining = pomoPhaseDuration();
  pomo.endAt = Date.now() + pomo.remaining;
  startPomoTimer();
  renderPomo();
}

function resetPomo() {
  resetPomoSession();
  renderPomo();
}

function completePomoPhase() {
  const finishedPhase = pomo.phase;
  stopPomoTimer();

  if (finishedPhase === 'focus') {
    addPomoDaily();

    if (pomo.round >= pomo.rounds) {
      pomo.phase = 'done';
      pomo.remaining = 0;
      pomo.running = false;
      pomo.started = false;
      pomo.endAt = 0;
      playAlarm();
      vibrateAlert([180, 90, 180, 90, 180]);
      renderPomo();
      return;
    }

    pomo.phase = 'break';
    pomo.remaining = pomo.breakMs;
  } else {
    pomo.phase = 'focus';
    pomo.round += 1;
    pomo.remaining = pomo.focusMs;
  }

  playChime();

  if (pomo.auto) {
    pomo.running = true;
    pomo.started = true;
    pomo.endAt = Date.now() + pomo.remaining;
    startPomoTimer();
  } else {
    pomo.running = false;
    pomo.started = true;
    pomo.endAt = 0;
  }

  renderPomo();
}

function skipPomoPhase() {
  if (!pomo.started || pomo.phase === 'done') return;

  stopPomoTimer();

  if (pomo.phase === 'focus') {
    if (pomo.round >= pomo.rounds) {
      pomo.phase = 'done';
      pomo.remaining = 0;
      pomo.running = false;
      pomo.started = false;
      pomo.endAt = 0;
      renderPomo();
      return;
    }
    pomo.phase = 'break';
    pomo.remaining = pomo.breakMs;
  } else {
    pomo.phase = 'focus';
    pomo.round += 1;
    pomo.remaining = pomo.focusMs;
  }

  playChime();

  if (pomo.auto) {
    pomo.running = true;
    pomo.endAt = Date.now() + pomo.remaining;
    startPomoTimer();
  } else {
    pomo.running = false;
    pomo.endAt = 0;
  }

  renderPomo();
}

function tickPomo() {
  if (!pomo.running) return;
  const remaining = pomo.endAt - Date.now();
  if (remaining <= 0) {
    completePomoPhase();
    return;
  }
  pomo.remaining = remaining;
  renderPomo();
}

function updateDocumentTitle() {
  let title = '时间计数器';

  if (cd.running) {
    title = `${formatCountdown(cd.remaining, cd.duration >= 3600000)} · 时间计数器`;
  } else if (pomo.running) {
    const total = pomo.phase === 'break' ? pomo.breakMs : pomo.focusMs;
    title = `${formatCountdown(pomo.remaining, total >= 3600000)} ${pomo.phase === 'break' ? '休息' : '专注'} · 时间计数器`;
  } else if (cd.done) {
    title = '时间到！· 时间计数器';
  } else if (pomo.phase === 'done') {
    title = '专注循环完成 · 时间计数器';
  }

  if (document.title !== title) document.title = title;
}

pomoInputs.forEach((input) => {
  input.addEventListener('input', () => {
    if (!pomo.started) applyPomoSettings();
  });
  input.addEventListener('blur', () => {
    if (pomo.started) return;
    const min = Number(input.min);
    const max = Number(input.max);
    input.value = String(clamp(parseInt(input.value, 10) || min, min, max));
    applyPomoSettings();
  });
});

pomoPresets.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || pomo.started) return;
  pomoFocusInput.value = chip.dataset.focus;
  pomoBreakInput.value = chip.dataset.break;
  applyPomoSettings();
});

pomoAuto.addEventListener('change', () => {
  pomo.auto = pomoAuto.checked;
  savePomoSettings();
});

pomoStart.addEventListener('click', togglePomo);
pomoSkip.addEventListener('click', skipPomoPhase);
pomoReset.addEventListener('click', resetPomo);

function initPomodoro() {
  const settings = loadPomoSettings();
  pomoFocusInput.value = String(settings.focus);
  pomoBreakInput.value = String(settings.rest);
  pomoRoundsInput.value = String(settings.rounds);
  pomo.auto = settings.auto;
  pomoAuto.checked = settings.auto;
  pomo.focusMs = settings.focus * 60000;
  pomo.breakMs = settings.rest * 60000;
  pomo.rounds = settings.rounds;
  pomo.remaining = pomo.focusMs;

  try {
    const savedDaily = JSON.parse(store.get('tc.pomoDaily', '{}'));
    if (savedDaily && typeof savedDaily.date === 'string' && Number.isFinite(Number(savedDaily.count))) {
      pomoDaily = {
        date: savedDaily.date,
        count: clamp(Math.floor(Number(savedDaily.count)), 0, 9999),
      };
    }
  } catch {
    /* 使用默认值 */
  }

  renderPomo();
}

/* =========================================================
   特殊日期与备注
   ========================================================= */
const specialForm = $('#specialForm');
const specialDate = $('#specialDate');
const specialNote = $('#specialNote');
const specialSubmit = $('#specialSubmit');
const specialCancel = $('#specialCancel');
const specialMsg = $('#specialMsg');
const specialList = $('#specialList');
const specialEmpty = $('#specialEmpty');
const specialCount = $('#specialCount');
const reminderStack = $('#reminderStack');

const specialState = {
  items: [],
  editingId: '',
};

let specialMsgTimer = 0;
let reminderStore = {};
let specialRenderDay = '';

function makeSpecialId() {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function loadSpecialDates() {
  let raw;
  try {
    raw = JSON.parse(store.get('tc.specialDates', '[]'));
  } catch {
    return;
  }
  if (!Array.isArray(raw)) return;

  specialState.items = raw
    .map((item) => {
      if (!item || typeof item.date !== 'string' || !parseDateKey(item.date)) return null;
      const note = typeof item.note === 'string' ? item.note.trim().slice(0, 40) : '';
      if (!note) return null;
      return {
        id: typeof item.id === 'string' && item.id ? item.id : makeSpecialId(),
        date: item.date,
        note,
      };
    })
    .filter(Boolean)
    .slice(0, 100);
}

function saveSpecialDates() {
  store.set('tc.specialDates', JSON.stringify(specialState.items));
}

function loadReminderStore() {
  try {
    const raw = JSON.parse(store.get('tc.specialReminderShown', '{}'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      reminderStore = raw;
    }
  } catch {
    reminderStore = {};
  }
}

function saveReminderStore() {
  const keys = Object.keys(reminderStore);
  if (keys.length > 600) {
    keys.sort((a, b) => reminderStore[a] - reminderStore[b]);
    keys.slice(0, keys.length - 600).forEach((key) => {
      delete reminderStore[key];
    });
  }
  store.set('tc.specialReminderShown', JSON.stringify(reminderStore));
}

function setSpecialMessage(text, isError = false) {
  clearTimeout(specialMsgTimer);
  specialMsg.textContent = text;
  specialMsg.classList.toggle('is-error', isError);
  if (text && !isError) {
    specialMsgTimer = window.setTimeout(() => {
      specialMsg.textContent = '';
    }, 3000);
  }
}

function resetSpecialForm() {
  specialState.editingId = '';
  specialForm.reset();
  specialDate.value = localDateKey();
  specialSubmit.textContent = '添加';
  specialCancel.hidden = true;
}

function sortedSpecialDates() {
  const todayKey = localDateKey();
  return [...specialState.items].sort((a, b) => {
    const aFuture = a.date >= todayKey;
    const bFuture = b.date >= todayKey;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture
      ? a.date.localeCompare(b.date)
      : b.date.localeCompare(a.date);
  });
}

function specialDayInfo(date) {
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000);
  if (diff === 0) return { text: '今天', soon: true, diff };
  if (diff === 1) return { text: '明天', soon: true, diff };
  if (diff > 0) return { text: `还有 ${diff} 天`, soon: diff <= 3, diff };
  return { text: `已过去 ${Math.abs(diff)} 天`, soon: false, diff };
}

function renderSpecialDates() {
  const items = sortedSpecialDates();
  specialRenderDay = localDateKey();
  specialCount.textContent = `${specialState.items.length} 条`;
  specialList.hidden = items.length === 0;
  specialEmpty.hidden = items.length > 0;

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const date = parseDateKey(item.date);
    const info = specialDayInfo(date);
    const row = document.createElement('div');
    row.className = 'special-row';
    row.dataset.id = item.id;

    const dateCell = document.createElement('div');
    dateCell.className = 'special-date';
    dateCell.textContent = `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
    const dayLine = document.createElement('small');
    dayLine.textContent = `${weekdayLabel(date)} · ${info.text}`;
    if (info.soon) dayLine.classList.add('is-soon');
    dateCell.append(dayLine);

    const note = document.createElement('div');
    note.className = 'special-note';
    note.textContent = item.note;
    note.title = item.note;

    const actions = document.createElement('div');
    actions.className = 'special-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'sched-edit';
    edit.title = '修改特殊日期';
    edit.setAttribute('aria-label', `修改 ${item.note}`);
    edit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'sched-del';
    del.title = '删除特殊日期';
    del.textContent = '×';
    del.setAttribute('aria-label', `删除 ${item.note}`);

    actions.append(edit, del);
    row.append(dateCell, note, actions);
    fragment.append(row);
  });

  specialList.replaceChildren(fragment);
}

function showSpecialReminder(item, diff) {
  const date = parseDateKey(item.date);
  if (!date) return;

  const card = document.createElement('div');
  card.className = 'reminder-card';

  const icon = document.createElement('span');
  icon.className = 'reminder-icon';
  icon.textContent = '✦';

  const body = document.createElement('div');
  body.className = 'reminder-body';

  const kicker = document.createElement('div');
  kicker.className = 'reminder-kicker';
  kicker.textContent = '特殊日期提醒';

  const note = document.createElement('div');
  note.className = 'reminder-note';
  note.textContent = item.note;

  const meta = document.createElement('div');
  meta.className = 'reminder-meta';
  const when = diff === 0 ? '就是今天' : diff === 1 ? '明天' : `还有 ${diff} 天`;
  meta.textContent = `${when} · ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${weekdayLabel(date)}`;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'reminder-close';
  close.setAttribute('aria-label', '关闭提醒');
  close.textContent = '×';

  body.append(kicker, note, meta);
  card.append(icon, body, close);
  reminderStack.append(card);

  const remove = () => card.remove();
  close.addEventListener('click', remove);
  window.setTimeout(remove, 10000);
}

function checkSpecialReminders() {
  const today = startOfDay(new Date());
  if (localDateKey(today) !== specialRenderDay) {
    renderSpecialDates();
  }
  let changed = false;

  specialState.items.forEach((item) => {
    const date = parseDateKey(item.date);
    if (!date) return;
    const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 86400000);
    if (diff !== 3 && diff !== 1 && diff !== 0) return;

    const key = `${item.id}|${item.date}|${diff}`;
    if (reminderStore[key]) return;

    reminderStore[key] = Date.now();
    changed = true;
    showSpecialReminder(item, diff);
  });

  if (changed) saveReminderStore();
}

specialForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const date = parseDateKey(specialDate.value);
  const note = specialNote.value.trim();

  if (!date) {
    setSpecialMessage('请选择特殊日期', true);
    specialDate.focus();
    return;
  }
  if (!note) {
    setSpecialMessage('请填写备注', true);
    specialNote.focus();
    return;
  }
  if (specialState.items.length >= 100 && !specialState.editingId) {
    setSpecialMessage('最多保存 100 个特殊日期', true);
    return;
  }

  if (specialState.editingId) {
    const item = specialState.items.find((entry) => entry.id === specialState.editingId);
    if (item) {
      item.date = specialDate.value;
      item.note = note.slice(0, 40);
    }
    saveSpecialDates();
    resetSpecialForm();
    renderSpecialDates();
    checkSpecialReminders();
    setSpecialMessage('已保存');
  } else {
    specialState.items.push({
      id: makeSpecialId(),
      date: specialDate.value,
      note: note.slice(0, 40),
    });
    saveSpecialDates();
    resetSpecialForm();
    renderSpecialDates();
    checkSpecialReminders();
    setSpecialMessage('已添加');
  }
});

specialCancel.addEventListener('click', () => {
  resetSpecialForm();
  setSpecialMessage('');
});

specialList.addEventListener('click', (event) => {
  const row = event.target.closest('.special-row');
  if (!row) return;
  const item = specialState.items.find((entry) => entry.id === row.dataset.id);
  if (!item) return;

  if (event.target.closest('.sched-edit')) {
    specialState.editingId = item.id;
    specialDate.value = item.date;
    specialNote.value = item.note;
    specialSubmit.textContent = '保存';
    specialCancel.hidden = false;
    setSpecialMessage('');
    specialForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    specialNote.focus();
  } else if (event.target.closest('.sched-del')) {
    const index = specialState.items.findIndex((entry) => entry.id === item.id);
    if (index < 0) return;
    const removed = specialState.items.splice(index, 1)[0];
    saveSpecialDates();
    renderSpecialDates();
    showToast(`已删除「${removed.note}」`, '撤销', () => {
      specialState.items.push(removed);
      saveSpecialDates();
      renderSpecialDates();
    });
  }
});

specialDate.addEventListener('input', () => {
  if (specialMsg.classList.contains('is-error')) setSpecialMessage('');
});

specialNote.addEventListener('input', () => {
  if (specialMsg.classList.contains('is-error')) setSpecialMessage('');
});

function initSpecialDates() {
  loadSpecialDates();
  loadReminderStore();
  specialDate.value = localDateKey();
  renderSpecialDates();
  checkSpecialReminders();

  window.setInterval(checkSpecialReminders, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSpecialReminders();
  });
}

/* =========================================================
   页脚时钟 & 键盘快捷键
   ========================================================= */
const clockNow = $('#clockNow');

function updateClock() {
  const now = new Date();
  clockNow.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

document.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  const tag = (event.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'button' || tag === 'select' || event.target.isContentEditable) {
    return;
  }
  event.preventDefault();
  if (activePanel === 'stopwatch') toggleStopwatch();
  if (activePanel === 'countdown') toggleCountdown();
  if (activePanel === 'loop' && activeSub === 'pomodoro') togglePomo();
});

/* =========================================================
   初始化
   ========================================================= */
function initCountdown() {
  const stored = Number(store.get('tc.countdownMs', 300000));
  const initial = Number.isFinite(stored) && stored >= 0 && stored <= MAX_CD_MS ? stored : 300000;
  setDurationInputs(initial);
  cd.duration = initial;
  cd.remaining = initial;
  renderCountdown();
  updateCountdownButtons();
}

function initDate() {
  const stored = store.get('tc.target', '');
  const saved = stored ? new Date(stored) : null;
  const initial = saved && !Number.isNaN(saved.getTime()) ? saved : nextNewYear();
  dateTargetInput.value = toInputValue(initial);
  renderDate();
}

initCountdown();
initDate();
initSchedule();
initPomodoro();
initStats();
initAi();
initSpecialDates();
renderStopwatch();
renderLaps();
updateStopwatchButtons();
updateClock();

window.setInterval(renderDate, 250);
window.setInterval(updateClock, 1000);
window.setInterval(updateScheduleLive, 1000);
window.setInterval(() => {
  if (!pomo.running) renderPomo();
}, 1000);
