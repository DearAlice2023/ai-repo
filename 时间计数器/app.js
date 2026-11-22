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
let activePanel = 'stopwatch';

function activateTab(name) {
  activePanel = name;
  tabs.forEach((tab) => {
    const isActive = tab.dataset.panel === name;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  panels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === `panel-${name}`);
  });
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
   每日固定工作日程
   ========================================================= */
const schedEyebrowLabel = $('#schedEyebrowLabel');
const schedDate = $('#schedDate');
const schedHeroTitle = $('#schedHeroTitle');
const schedHeroCount = $('#schedHeroCount');
const schedHeroMeta = $('#schedHeroMeta');
const schedProgressLabel = $('#schedProgressLabel');
const schedProgressText = $('#schedProgressText');
const schedProgressBar = $('#schedProgressBar');
const schedForm = $('#schedForm');
const schedFormHint = $('#schedFormHint');
const schedName = $('#schedName');
const schedTime = $('#schedTime');
const schedDuration = $('#schedDuration');
const schedMsg = $('#schedMsg');
const schedCycle = $('#schedCycle');
const schedCycleHint = $('#schedCycleHint');
const schedCycleConfig = $('#schedCycleConfig');
const schedCycleDays = $('#schedCycleDays');
const schedCycleStartHint = $('#schedCycleStartHint');
const schedCycleReset = $('#schedCycleReset');
const schedCycleBar = $('#schedCycleBar');
const schedList = $('#schedList');
const schedListTitle = $('#schedListTitle');
const schedEmpty = $('#schedEmpty');
const schedEmptyTitle = $('#schedEmptyTitle');
const schedEmptyHint = $('#schedEmptyHint');
const schedCount = $('#schedCount');

const schedEditDialog = $('#schedEditDialog');
const schedEditForm = $('#schedEditForm');
const schedEditName = $('#schedEditName');
const schedEditTime = $('#schedEditTime');
const schedEditDuration = $('#schedEditDuration');
const schedEditDayField = $('#schedEditDayField');
const schedEditDay = $('#schedEditDay');
const schedEditMsg = $('#schedEditMsg');
const schedEditClose = $('#schedEditClose');
const schedEditCancel = $('#schedEditCancel');

const schedule = {
  items: [],
  rows: new Map(),
  renderDay: '',
  inline: null,
};

const cycle = {
  enabled: false,
  start: '',
  days: 4,
  selectedDay: 1,
};

let editingScheduleId = '';
let schedMsgTimer = 0;

/* ---------- 数据存取 ---------- */
function makeScheduleId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function loadCycle() {
  let raw = {};
  try {
    raw = JSON.parse(store.get('tc.scheduleCycle', '{}')) || {};
  } catch {
    raw = {};
  }
  const hasDays = Number.isFinite(Number(raw.days));
  cycle.enabled = raw.enabled === true;
  cycle.days = hasDays ? clamp(Math.round(Number(raw.days)), 2, 14) : 4;
  cycle.start = hasDays && typeof raw.start === 'string' && parseDateKey(raw.start)
    ? raw.start
    : localDateKey();
  cycle.selectedDay = 1;

  // 旧版“一项一天”的数据没有 days 字段，升级后从今天重新作为第 1 天
  if (!hasDays) saveCycle();
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
        doneOn: typeof item.doneOn === 'string' ? item.doneOn : '',
        cycleDay: clamp(Math.round(Number(item.cycleDay)) || 1, 1, cycle.days),
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

function saveSchedule() {
  store.set('tc.schedule', JSON.stringify(schedule.items));
}

function saveCycle() {
  store.set('tc.scheduleCycle', JSON.stringify({
    enabled: cycle.enabled,
    start: cycle.start,
    days: cycle.days,
  }));
}

function normalizeCycleState() {
  cycle.days = clamp(Math.round(Number(cycle.days)) || 4, 2, 14);
  cycle.start = parseDateKey(cycle.start) ? cycle.start : localDateKey();
  cycle.selectedDay = clamp(Math.round(Number(cycle.selectedDay)) || 1, 1, cycle.days);
  schedule.items.forEach((item) => {
    item.cycleDay = clamp(Math.round(Number(item.cycleDay)) || 1, 1, cycle.days);
  });
}

/* ---------- 日历与周期计算 ---------- */
function cycleTodayDay() {
  const days = clamp(Math.round(Number(cycle.days)) || 4, 2, 14);
  const start = parseDateKey(cycle.start) || startOfDay(new Date());
  const today = startOfDay(new Date());
  const elapsed = Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000));
  return (elapsed % days) + 1;
}

function cycleDayDistance(day) {
  return (day - cycleTodayDay() + cycle.days) % cycle.days;
}

function relativeDayLabel(distance) {
  if (distance === 0) return '今天';
  if (distance === 1) return '明天';
  return `${distance} 天后`;
}

function compareScheduleItems(a, b) {
  const diff = (parseClock(a.time) ?? 0) - (parseClock(b.time) ?? 0);
  return diff !== 0 ? diff : a.name.localeCompare(b.name, 'zh-Hans-CN');
}

function itemsForDay(day) {
  return schedule.items
    .filter((item) => item.cycleDay === day)
    .sort(compareScheduleItems);
}

function dailyItems() {
  return [...schedule.items].sort(compareScheduleItems);
}

function nextCycleDay(day) {
  return (day % cycle.days) + 1;
}

/* ---------- 基础 UI ---------- */
function setScheduleMessage(text, isError = false) {
  clearTimeout(schedMsgTimer);
  schedMsg.textContent = text;
  schedMsg.classList.toggle('is-error', isError);
  if (text && !isError) {
    schedMsgTimer = window.setTimeout(() => {
      schedMsg.textContent = '';
    }, 3000);
  }
}

function updateScheduleDate(date) {
  schedDate.textContent = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 周${WEEKDAYS[date.getDay()]}`;
}

function defaultScheduleTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return `${pad2(date.getHours())}:00`;
}

function renderCycleControls() {
  const todayDay = cycleTodayDay();
  schedCycle.checked = cycle.enabled;
  schedCycleConfig.hidden = !cycle.enabled;
  schedCycleDays.value = String(cycle.days);
  schedCycleHint.textContent = cycle.enabled
    ? `${cycle.days} 天一轮 · 今天第 ${todayDay} 天`
    : '开启后每天只显示当天分组的工作';

  const start = parseDateKey(cycle.start) || new Date();
  schedCycleStartHint.textContent = `起点：${start.getMonth() + 1} 月 ${start.getDate()} 日`;

  schedFormHint.textContent = cycle.enabled
    ? `添加到第 ${cycle.selectedDay} 天`
    : '可随时修改';
}

function renderCycleBar() {
  if (!cycle.enabled) {
    schedCycleBar.hidden = true;
    schedCycleBar.replaceChildren();
    return;
  }

  const todayDay = cycleTodayDay();
  const fragment = document.createDocumentFragment();

  for (let day = 1; day <= cycle.days; day += 1) {
    const count = itemsForDay(day).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cycle-pill';
    button.dataset.day = String(day);
    button.classList.toggle('is-active', day === cycle.selectedDay);
    button.classList.toggle('is-today', day === todayDay);
    button.classList.toggle('is-empty', count === 0);
    button.setAttribute('aria-pressed', String(day === cycle.selectedDay));
    button.title = `第 ${day} 天${day === todayDay ? '（今天）' : ''} · ${count} 项`;

    const label = document.createElement('span');
    label.textContent = `第 ${day} 天`;

    const meta = document.createElement('small');
    if (day === todayDay) {
      meta.textContent = count ? `今天 · ${count} 项` : '今天';
    } else {
      meta.textContent = count ? `${count} 项` : '空';
    }

    button.append(label, meta);
    fragment.append(button);
  }

  schedCycleBar.replaceChildren(fragment);
  schedCycleBar.hidden = false;
}

/* ---------- 渲染列表 ---------- */
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

function renderSchedule() {
  normalizeCycleState();

  const todayDay = cycleTodayDay();
  renderCycleControls();
  renderCycleBar();

  const isCycle = cycle.enabled;
  const selectedDay = cycle.selectedDay;
  const isTodayView = !isCycle || selectedDay === todayDay;
  const items = isCycle ? itemsForDay(selectedDay) : dailyItems();

  schedEyebrowLabel.textContent = isCycle && !isTodayView
    ? `周期第 ${selectedDay} 天`
    : '今日日程';

  if (isCycle) {
    schedListTitle.textContent = isTodayView ? '今日工作' : `第 ${selectedDay} 天工作`;
    schedEmptyTitle.textContent = isTodayView ? '今天还没有安排' : `第 ${selectedDay} 天还没有安排`;
    schedEmptyHint.textContent = `在上方添加工作，会加到第 ${selectedDay} 天`;
  } else {
    schedListTitle.textContent = '每日工作';
    schedEmptyTitle.textContent = '还没有安排';
    schedEmptyHint.textContent = '添加一项每天固定进行的工作吧';
  }
  schedCount.textContent = `${items.length} 项`;
  schedEmpty.hidden = items.length > 0;
  schedList.hidden = items.length === 0;

  schedule.rows.clear();
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const row = document.createElement('li');
    row.className = 'sched-item';
    row.dataset.id = item.id;
    if (isCycle && !isTodayView) row.classList.add('is-offday');
    if (schedule.inline && schedule.inline.id === item.id) row.classList.add('is-inline');

    let left;
    let check = null;

    if (isCycle && !isTodayView) {
      left = document.createElement('span');
      left.className = 'sched-cycle-day';
      left.textContent = String(selectedDay);
      left.title = `周期第 ${selectedDay} 天`;
      left.setAttribute('aria-label', `周期第 ${selectedDay} 天`);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sched-check';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `标记完成 ${item.name}`);
      button.title = '标记完成';
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
  schedule.renderDay = localDateKey();
  updateScheduleLive();

  if (schedule.inline) bindInlineInput();
}

/* ---------- 实时状态 ---------- */
function updateScheduleLive() {
  const now = new Date();
  const today = localDateKey(now);

  if (today !== schedule.renderDay) {
    if (cycle.enabled) cycle.selectedDay = cycleTodayDay();
    renderSchedule();
    return;
  }

  updateScheduleDate(now);

  if (cycle.enabled) {
    if (cycle.selectedDay === cycleTodayDay()) {
      updateTodayCycleLive(now, today);
    } else {
      updatePlanDayLive(now, today);
    }
  } else {
    updateDailyLive(now, today);
  }
}

function updateDailyLive(now, today) {
  const nowMinutes = (now.getHours() * 60) + now.getMinutes() + (now.getSeconds() / 60);
  let current = null;
  let next = null;
  let doneCount = 0;

  schedule.items.forEach((item) => {
    const start = parseClock(item.time);
    const rowEntry = schedule.rows.get(item.id);
    if (start === null || !rowEntry) return;

    const end = start + item.duration;
    const done = item.doneOn === today;
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
    rowEntry.status.textContent = label;
    rowEntry.bar.style.width = `${isCurrent ? progress : 0}%`;
    if (rowEntry.check) {
      rowEntry.check.setAttribute('aria-pressed', String(done));
      rowEntry.check.setAttribute('aria-label', done ? `取消完成 ${item.name}` : `标记完成 ${item.name}`);
      rowEntry.check.title = done ? '取消完成' : '标记完成';
    }
  });

  const total = schedule.items.length;
  schedProgressLabel.textContent = '今日进度';
  schedProgressText.textContent = `${doneCount} / ${total}`;
  schedProgressBar.style.width = total ? `${(doneCount / total) * 100}%` : '0%';
  schedHeroCount.classList.remove('is-check', 'is-placeholder');

  if (total === 0) {
    schedHeroTitle.textContent = '还没有日程';
    schedHeroCount.textContent = '待安排';
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = '添加每天固定进行的工作';
  } else if (current) {
    schedHeroTitle.textContent = `正在进行 · ${current.item.time} ${current.item.name}`;
    schedHeroCount.textContent = formatHms((current.end - nowMinutes) * 60000);
    const endLabel = `${current.end >= 1440 ? '次日 ' : ''}${clockFromMinutes(current.end)}`;
    schedHeroMeta.textContent = `结束于 ${endLabel} · 时长 ${current.item.duration} 分钟`;
  } else if (next) {
    schedHeroTitle.textContent = `下一项 · ${next.item.time} ${next.item.name}`;
    schedHeroCount.textContent = formatHms((next.start - nowMinutes) * 60000);
    schedHeroMeta.textContent = `${minutesLabel(next.start - nowMinutes, true)}后开始 · 时长 ${next.item.duration} 分钟`;
  } else if (doneCount === total) {
    schedHeroTitle.textContent = '今日工作已全部完成';
    schedHeroCount.textContent = '✓';
    schedHeroCount.classList.add('is-check');
    schedHeroMeta.textContent = `明天自动重置 · 共 ${total} 项`;
  } else {
    schedHeroTitle.textContent = `今天还有 ${total - doneCount} 项未打卡`;
    schedHeroCount.textContent = '待打卡';
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = '已过时间的工作仍可补打卡';
  }
}

function updateTodayCycleLive(now, today) {
  const day = cycleTodayDay();
  const items = itemsForDay(day);
  const total = items.length;
  const nowMinutes = (now.getHours() * 60) + now.getMinutes() + (now.getSeconds() / 60);
  let current = null;
  let next = null;
  let doneCount = 0;

  items.forEach((item) => {
    const start = parseClock(item.time);
    const rowEntry = schedule.rows.get(item.id);
    if (start === null || !rowEntry) return;

    const end = start + item.duration;
    const done = item.doneOn === today;
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
    rowEntry.status.textContent = label;
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
  schedFormHint.textContent = `添加到第 ${cycle.selectedDay} 天`;
  schedHeroCount.classList.remove('is-check', 'is-placeholder');

  if (total === 0) {
    schedHeroTitle.textContent = '今天还没有安排';
    schedHeroCount.textContent = '待安排';
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = `第 ${day} / ${cycle.days} 天 · 在上方添加今天的工作`;
  } else if (current) {
    schedHeroTitle.textContent = `正在进行 · ${current.item.time} ${current.item.name}`;
    schedHeroCount.textContent = formatHms((current.end - nowMinutes) * 60000);
    const endLabel = `${current.end >= 1440 ? '次日 ' : ''}${clockFromMinutes(current.end)}`;
    schedHeroMeta.textContent = `结束于 ${endLabel} · 第 ${day} / ${cycle.days} 天`;
  } else if (next) {
    schedHeroTitle.textContent = `下一项 · ${next.item.time} ${next.item.name}`;
    schedHeroCount.textContent = formatHms((next.start - nowMinutes) * 60000);
    schedHeroMeta.textContent = `${minutesLabel(next.start - nowMinutes, true)}后开始 · 第 ${day} / ${cycle.days} 天`;
  } else if (doneCount === total) {
    schedHeroTitle.textContent = `今日 ${total} 项全部完成`;
    schedHeroCount.textContent = '✓';
    schedHeroCount.classList.add('is-check');
    schedHeroMeta.textContent = `第 ${day} / ${cycle.days} 天 · 明天进入第 ${nextCycleDay(day)} 天`;
  } else {
    schedHeroTitle.textContent = `今天还有 ${total - doneCount} 项未打卡`;
    schedHeroCount.textContent = '待打卡';
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = `第 ${day} / ${cycle.days} 天 · 可补打卡`;
  }
}

function updatePlanDayLive(now, today) {
  const day = cycle.selectedDay;
  const items = itemsForDay(day);
  const total = items.length;
  const distance = cycleDayDistance(day);
  const relative = relativeDayLabel(distance);

  items.forEach((item) => {
    const rowEntry = schedule.rows.get(item.id);
    if (!rowEntry) return;
    rowEntry.row.classList.remove('is-done', 'is-current', 'is-past');
    rowEntry.status.textContent = `第 ${day} 天 · ${relative}`;
    rowEntry.bar.style.width = '0%';
  });

  schedProgressLabel.textContent = '周期位置';
  schedProgressText.textContent = `第 ${day} / ${cycle.days} 天`;
  schedProgressBar.style.width = `${(day / cycle.days) * 100}%`;
  schedFormHint.textContent = `添加到第 ${day} 天`;
  schedHeroCount.classList.remove('is-check', 'is-placeholder');

  if (total === 0) {
    schedHeroTitle.textContent = `第 ${day} 天还没有安排`;
    schedHeroCount.textContent = '待安排';
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = `${relative} · 在上方添加工作会加到第 ${day} 天`;
  } else {
    schedHeroTitle.textContent = `第 ${day} 天 · ${total} 项工作`;
    schedHeroCount.textContent = relative;
    schedHeroCount.classList.add('is-placeholder');
    schedHeroMeta.textContent = `第一项 ${items[0].time} · 共 ${total} 项`;
  }
}

/* ---------- 内联修改 ---------- */
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
  if (save) {
    save.addEventListener('click', () => finish(true));
  }

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
  if (error) showToast(error, '', null);
}

/* ---------- 操作 ---------- */
function toggleScheduleDone(id) {
  const item = schedule.items.find((entry) => entry.id === id);
  if (!item) return;
  const today = localDateKey();
  item.doneOn = item.doneOn === today ? '' : today;
  saveSchedule();
  updateScheduleLive();
}

function deleteScheduleItem(id) {
  const index = schedule.items.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const removed = schedule.items.splice(index, 1)[0];
  saveSchedule();
  renderSchedule();
  showToast(`已删除「${removed.name}」`, '撤销', () => {
    schedule.items.push(removed);
    saveSchedule();
    renderSchedule();
  });
}

function setScheduleEditMessage(text, isError = false) {
  schedEditMsg.textContent = text;
  schedEditMsg.classList.toggle('is-error', isError);
}

function openScheduleEdit(id) {
  const item = schedule.items.find((entry) => entry.id === id);
  if (!item) return;

  editingScheduleId = id;
  schedEditName.value = item.name;
  schedEditTime.value = item.time;
  schedEditDuration.value = String(item.duration);
  setScheduleEditMessage('');

  const todayDay = cycleTodayDay();
  schedEditDay.replaceChildren();
  for (let day = 1; day <= cycle.days; day += 1) {
    const option = document.createElement('option');
    option.value = String(day);
    option.textContent = `第 ${day} 天${day === todayDay ? '（今天）' : ''}`;
    option.selected = day === item.cycleDay;
    schedEditDay.append(option);
  }
  schedEditDayField.hidden = !cycle.enabled;

  if (!schedEditDialog.open) schedEditDialog.showModal();
  schedEditName.focus();
  schedEditName.select();
}

function closeScheduleEdit() {
  if (schedEditDialog.open) schedEditDialog.close();
}

/* ---------- 表单与周期设置 ---------- */
schedForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = schedName.value.trim();
  const time = normalizeClock(schedTime.value);
  const duration = Math.round(Number(schedDuration.value));

  if (!name) {
    setScheduleMessage('请填写工作名称', true);
    schedName.focus();
    return;
  }
  if (!time) {
    setScheduleMessage('请选择开始时间', true);
    schedTime.focus();
    return;
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 720) {
    setScheduleMessage('时长需在 1–720 分钟之间', true);
    schedDuration.focus();
    return;
  }
  if (schedule.items.length >= 50) {
    setScheduleMessage('最多添加 50 项日程', true);
    return;
  }

  const cycleDay = cycle.enabled ? cycle.selectedDay : 1;
  schedule.items.push({
    id: makeScheduleId(),
    name: name.slice(0, 24),
    time,
    duration,
    doneOn: '',
    cycleDay,
  });
  saveSchedule();
  renderSchedule();
  schedName.value = '';
  setScheduleMessage(cycle.enabled ? `已添加到第 ${cycleDay} 天` : `已添加「${name.slice(0, 24)}」`);
  schedName.focus();
});

schedCycle.addEventListener('change', () => {
  if (schedCycle.checked) {
    cycle.enabled = true;
    cycle.days = clamp(Math.round(Number(schedCycleDays.value)) || 4, 2, 14);
    cycle.start = localDateKey();
    cycle.selectedDay = 1;
    normalizeCycleState();
    saveCycle();
    saveSchedule();
  } else {
    cycle.enabled = false;
    saveCycle();
  }
  renderSchedule();
});

schedCycleDays.addEventListener('change', () => {
  const raw = Number(schedCycleDays.value);
  const next = clamp(Number.isFinite(raw) && raw > 0 ? Math.round(raw) : cycle.days, 2, 14);

  if (next === cycle.days) {
    schedCycleDays.value = String(cycle.days);
    return;
  }

  cycle.days = next;
  let moved = 0;
  schedule.items.forEach((item) => {
    if (item.cycleDay > next) {
      item.cycleDay = next;
      moved += 1;
    }
  });
  cycle.selectedDay = clamp(cycle.selectedDay, 1, next);

  saveCycle();
  saveSchedule();
  renderSchedule();

  if (moved) {
    showToast(`已把 ${moved} 项工作移到第 ${next} 天`, '', null);
  }
});

schedCycleReset.addEventListener('click', () => {
  cycle.start = localDateKey();
  cycle.selectedDay = 1;
  saveCycle();
  renderSchedule();
  showToast('周期已从今天重新开始', '', null);
});

schedCycleBar.addEventListener('click', (event) => {
  const pill = event.target.closest('.cycle-pill');
  if (!pill) return;
  const day = Number(pill.dataset.day);
  if (!Number.isInteger(day)) return;

  const scrollLeft = schedCycleBar.scrollLeft;
  cycle.selectedDay = clamp(day, 1, cycle.days);
  renderSchedule();
  schedCycleBar.scrollLeft = scrollLeft;
});

/* ---------- 修改弹窗 ---------- */
schedEditForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const item = schedule.items.find((entry) => entry.id === editingScheduleId);
  if (!item) {
    closeScheduleEdit();
    return;
  }

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

  item.name = name.slice(0, 24);
  item.time = time;
  item.duration = duration;

  let movedToDay = 0;
  if (cycle.enabled) {
    const dayValue = parseInt(schedEditDay.value, 10);
    item.cycleDay = clamp(Number.isFinite(dayValue) ? dayValue : item.cycleDay, 1, cycle.days);
    if (item.cycleDay !== cycle.selectedDay) movedToDay = item.cycleDay;
  }

  const focusId = editingScheduleId;
  saveSchedule();
  renderSchedule();
  closeScheduleEdit();

  if (movedToDay) {
    showToast(`已移到第 ${movedToDay} 天`, '', null);
  } else {
    const nextRow = Array.from(schedList.querySelectorAll('.sched-item'))
      .find((row) => row.dataset.id === focusId);
    const nextEdit = nextRow ? nextRow.querySelector('.sched-edit') : null;
    if (nextEdit) nextEdit.focus();
  }
});

schedEditClose.addEventListener('click', closeScheduleEdit);
schedEditCancel.addEventListener('click', closeScheduleEdit);

schedEditDialog.addEventListener('close', () => {
  editingScheduleId = '';
});

schedEditDialog.addEventListener('click', (event) => {
  if (event.target === schedEditDialog) closeScheduleEdit();
});

[schedEditName, schedEditTime, schedEditDuration].forEach((input) => {
  input.addEventListener('input', () => {
    if (schedEditMsg.classList.contains('is-error')) setScheduleEditMessage('');
  });
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
    openScheduleEdit(id);
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
  loadCycle();
  schedule.items = loadSchedule();
  cycle.selectedDay = cycleTodayDay();
  schedTime.value = defaultScheduleTime();
  renderSchedule();
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
