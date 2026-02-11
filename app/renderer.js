const statusRunning = document.getElementById('status-running');
const statusProgress = document.getElementById('status-progress');
const totalSettings = document.getElementById('total-settings');
const lastUpdate = document.getElementById('last-update');
const progressFill = document.getElementById('progress-fill');
const logOutput = document.getElementById('log-output');
const saveStatus = document.getElementById('save-status');
const dirtyIndicator = document.getElementById('dirty-indicator');
const searchInput = document.getElementById('settings-search');
const searchResult = document.getElementById('search-result');
const importFileInput = document.getElementById('import-file');
const toggleSyncButton = document.getElementById('toggle-sync');

const configInputs = Array.from(document.querySelectorAll('[data-config]'));
const panels = Array.from(document.querySelectorAll('[data-section]'));

let lastLoadedConfig = {};
let saveStatusTimer = null;
let isDirty = false;
let isAutoRefreshEnabled = true;
let isUpdating = false;
let refreshIntervalId = null;

const createBrowserFallbackAPI = () => {
  const storageKey = 'grok-browser-fallback-state';
  const initialState = {
    running: false,
    progress: 0,
    log: 'وضع المتصفح النقي مفعل (بدون Electron IPC).',
  };

  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || 'null') || initialState;
    } catch {
      return initialState;
    }
  };

  const write = (state) => localStorage.setItem(storageKey, JSON.stringify(state));

  return {
    getState: async () => read(),
    saveConfig: async (conf) => {
      write({ ...read(), ...conf });
      return true;
    },
    run: async (params) => {
      const state = { ...read(), ...params, running: true, progress: 100, log: 'تشغيل تجريبي محلي اكتمل.' };
      write(state);
      return { status: 'done' };
    },
    openExternal: async (url) => {
      const value = String(url || '').trim();
      if (!value) return { ok: false, reason: 'empty_url' };
      const finalUrl = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      window.open(finalUrl, '_blank', 'noopener');
      return { ok: true, url: finalUrl };
    },
  };
};

const api = window.grokAPI ?? createBrowserFallbackAPI();

const parseValue = (input) => {
  const type = input.dataset.type;
  if (type === 'boolean') return input.checked;
  if (type === 'number') {
    const value = Number(input.value);
    return Number.isNaN(value) ? 0 : value;
  }
  if (type === 'array') {
    return input.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return input.value.trim();
};

const collectConfig = () => {
  return configInputs.reduce((acc, input) => {
    acc[input.id] = parseValue(input);
    return acc;
  }, {});
};

const isConfigEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const updateDirtyState = () => {
  const current = collectConfig();
  isDirty = !isConfigEqual(current, lastLoadedConfig);
  dirtyIndicator.textContent = isDirty ? 'لديك تغييرات غير محفوظة' : 'كل التغييرات محفوظة';
  dirtyIndicator.classList.toggle('dirty-indicator--active', isDirty);
};

const setButtonBusy = (buttonId, busy, busyText) => {
  const button = document.getElementById(buttonId);
  if (!button) return;
  if (!button.dataset.originalText) button.dataset.originalText = button.textContent || '';
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.originalText;
};

const applyConfig = (config, options = { force: false }) => {
  const hasActiveElement = configInputs.some((input) => document.activeElement === input);
  if ((isDirty || hasActiveElement) && !options.force) return;

  configInputs.forEach((input) => {
    const key = input.id;
    if (!(key in config)) return;
    const type = input.dataset.type;
    const value = config[key];
    if (type === 'boolean') input.checked = Boolean(value);
    else if (type === 'array') input.value = Array.isArray(value) ? value.join('\n') : '';
    else input.value = value ?? '';
    input.classList.remove('is-invalid');
  });
  totalSettings.textContent = configInputs.length;
};

const formatTime = () => new Date().toLocaleTimeString('ar-EG', { hour12: false });

const showSaveStatus = (message, color = '#10b981') => {
  saveStatus.textContent = message;
  saveStatus.style.color = color;
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => {
    saveStatus.textContent = '';
  }, 2200);
};

const validateInputs = () => {
  let isValid = true;
  configInputs.forEach((input) => {
    input.classList.remove('is-invalid');
    if (input.dataset.type === 'number' && input.value !== '') {
      const num = Number(input.value);
      const min = input.min ? Number(input.min) : -Infinity;
      if (Number.isNaN(num) || num < min) {
        input.classList.add('is-invalid');
        isValid = false;
      }
    }
    if (input.id === 'GROK_URL' && input.value && !/^https?:\/\//i.test(input.value.trim())) {
      input.classList.add('is-invalid');
      isValid = false;
    }
  });

  if (!isValid) showSaveStatus('يرجى تصحيح الحقول المحددة قبل الحفظ', '#ef4444');
  return isValid;
};

const getLabelText = (input) => input.closest('label')?.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? input.id.toLowerCase();

const filterSections = () => {
  const keyword = searchInput.value.trim().toLowerCase();
  if (!keyword) {
    panels.forEach((panel) => {
      panel.style.display = '';
    });
    searchResult.textContent = 'جميع الأقسام ظاهرة.';
    return;
  }

  let visibleCount = 0;
  panels.forEach((panel) => {
    const title = panel.querySelector('h2')?.textContent?.toLowerCase() ?? '';
    const matchedInput = configInputs.some((input) => panel.contains(input) && (input.id.toLowerCase().includes(keyword) || getLabelText(input).includes(keyword)));
    const matches = title.includes(keyword) || matchedInput;
    panel.style.display = matches ? '' : 'none';
    if (matches) visibleCount += 1;
  });

  searchResult.textContent = visibleCount
    ? `تم عرض ${visibleCount} قسم من أصل ${panels.length}.`
    : 'لا توجد نتائج مطابقة.';
};

const togglePanel = (panel, collapse) => {
  panel.classList.toggle('is-collapsed', collapse);
  panel.querySelector('[data-toggle-section]')?.setAttribute('aria-expanded', String(!collapse));
};

const downloadJSON = (filename, payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const updateState = async (options = { forceConfigSync: false }) => {
  if (isUpdating) return;
  isUpdating = true;
  try {
    const state = await api.getState();
    statusRunning.textContent = state.running ? 'قيد التشغيل' : 'متوقف';
    statusRunning.style.color = state.running ? '#10b981' : '#ef4444';

    const progress = Number(state.progress ?? 0);
    statusProgress.textContent = `${progress}%`;
    progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;

    if (typeof state.log === 'string') {
      logOutput.textContent = state.log.trim() || 'لا توجد سجلات حالياً.';
      logOutput.scrollTop = logOutput.scrollHeight;
    }

    if (options.forceConfigSync || (!isDirty && !document.activeElement?.matches('[data-config]'))) {
      applyConfig(state, { force: options.forceConfigSync });
      lastLoadedConfig = collectConfig();
      updateDirtyState();
    }

    lastUpdate.textContent = formatTime();
  } catch (error) {
    showSaveStatus('تعذر تحديث الحالة من الخلفية', '#ef4444');
  } finally {
    isUpdating = false;
  }
};

const setAutoRefreshState = (enabled) => {
  isAutoRefreshEnabled = enabled;
  toggleSyncButton.textContent = enabled ? 'إيقاف التحديث التلقائي' : 'تشغيل التحديث التلقائي';
  toggleSyncButton.classList.toggle('btn--warning', !enabled);

  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }

  if (enabled) {
    refreshIntervalId = setInterval(() => {
      updateState();
    }, 4000);
  }
};

document.getElementById('save-config').addEventListener('click', async () => {
  if (!validateInputs()) return;
  setButtonBusy('save-config', true, 'جارٍ الحفظ...');
  try {
    const payload = collectConfig();
    await api.saveConfig(payload);
    lastLoadedConfig = payload;
    updateDirtyState();
    showSaveStatus('تم حفظ الإعدادات بنجاح');
    await updateState({ forceConfigSync: true });
  } catch {
    showSaveStatus('تعذر حفظ الإعدادات', '#ef4444');
  } finally {
    setButtonBusy('save-config', false, 'حفظ الإعدادات');
  }
});

document.getElementById('run-automation').addEventListener('click', async () => {
  if (!validateInputs()) return;
  setButtonBusy('run-automation', true, 'جارٍ التشغيل...');
  try {
    showSaveStatus('يتم تشغيل الأتمتة...', '#f59e0b');
    await api.run(collectConfig());
    showSaveStatus('اكتمل التشغيل بنجاح');
  } catch {
    showSaveStatus('حدث خطأ أثناء التشغيل', '#ef4444');
  } finally {
    setButtonBusy('run-automation', false, 'تشغيل الأتمتة');
    await updateState();
  }
});

document.getElementById('refresh-log').addEventListener('click', () => updateState());

document.getElementById('open-grok-url').addEventListener('click', async () => {
  const urlInput = document.getElementById('GROK_URL');
  const url = urlInput?.value?.trim() || '';
  if (!url) {
    showSaveStatus('أدخل رابط Grok أولاً', '#ef4444');
    return;
  }

  try {
    const result = await api.openExternal(url);
    if (result?.ok) {
      showSaveStatus('تم فتح الرابط');
    } else {
      showSaveStatus('تعذر فتح الرابط، تحقق من القيمة', '#ef4444');
    }
  } catch {
    showSaveStatus('حدث خطأ أثناء فتح الرابط', '#ef4444');
  }
});


document.getElementById('copy-log').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(logOutput.textContent || '');
    showSaveStatus('تم نسخ السجل');
  } catch {
    showSaveStatus('تعذر نسخ السجل', '#ef4444');
  }
});

document.getElementById('clear-log').addEventListener('click', () => {
  logOutput.textContent = 'تم مسح عرض السجل محليًا. اضغط تحديث لإعادة القراءة من الملف.';
});

document.getElementById('expand-all').addEventListener('click', () => {
  panels.forEach((panel) => togglePanel(panel, false));
});

document.getElementById('collapse-all').addEventListener('click', () => {
  panels.forEach((panel) => togglePanel(panel, true));
});

document.getElementById('clear-search').addEventListener('click', () => {
  searchInput.value = '';
  filterSections();
});

document.getElementById('export-config').addEventListener('click', () => {
  downloadJSON(`grok-config-${Date.now()}.json`, collectConfig());
  showSaveStatus('تم تصدير الإعدادات');
});

document.getElementById('import-config').addEventListener('click', () => importFileInput.click());

importFileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    applyConfig(parsed, { force: true });
    updateDirtyState();
    showSaveStatus('تم استيراد الإعدادات، اضغط حفظ للتأكيد', '#f59e0b');
  } catch {
    showSaveStatus('ملف غير صالح', '#ef4444');
  } finally {
    importFileInput.value = '';
  }
});

document.getElementById('reset-config').addEventListener('click', () => {
  applyConfig(lastLoadedConfig, { force: true });
  updateDirtyState();
  showSaveStatus('تم استرجاع آخر إعدادات محملة');
});

toggleSyncButton.addEventListener('click', () => {
  setAutoRefreshState(!isAutoRefreshEnabled);
  showSaveStatus(isAutoRefreshEnabled ? 'تم تفعيل التحديث التلقائي' : 'تم إيقاف التحديث التلقائي', '#f59e0b');
});

searchInput.addEventListener('input', filterSections);

panels.forEach((panel) => {
  panel.querySelector('[data-toggle-section]')?.addEventListener('click', () => {
    const collapse = !panel.classList.contains('is-collapsed');
    togglePanel(panel, collapse);
  });
});

configInputs.forEach((input) => {
  input.addEventListener('input', () => {
    updateDirtyState();
    if (input.classList.contains('is-invalid')) validateInputs();
  });
  input.addEventListener('blur', () => validateInputs());
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    document.getElementById('save-config').click();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (!isDirty) return;
  event.preventDefault();
  event.returnValue = '';
});

(async () => {
  await updateState({ forceConfigSync: true });
  setAutoRefreshState(true);
  filterSections();
  updateDirtyState();
})();
