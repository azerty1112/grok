const statusRunning = document.getElementById('status-running');
const statusProgress = document.getElementById('status-progress');
const progressFill = document.getElementById('progress-fill');
const logOutput = document.getElementById('log-output');
const saveStatus = document.getElementById('save-status');

const configInputs = Array.from(document.querySelectorAll('[data-config]'));

const parseValue = (input) => {
  const type = input.dataset.type;
  if (type === 'boolean') {
    return input.checked;
  }
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

const applyConfig = (config) => {
  configInputs.forEach((input) => {
    const key = input.id;
    if (!(key in config)) return;

    const type = input.dataset.type;
    const value = config[key];
    if (type === 'boolean') {
      input.checked = Boolean(value);
    } else if (type === 'array') {
      input.value = Array.isArray(value) ? value.join('\n') : '';
    } else {
      input.value = value ?? '';
    }
  });
};

const collectConfig = () => {
  return configInputs.reduce((acc, input) => {
    acc[input.id] = parseValue(input);
    return acc;
  }, {});
};

const updateState = async () => {
  const state = await window.grokAPI.getState();
  statusRunning.textContent = state.running ? 'قيد التشغيل' : 'متوقف';
  statusRunning.style.color = state.running ? '#10b981' : '#ef4444';
  const progress = Number(state.progress ?? 0);
  statusProgress.textContent = `${progress}%`;
  progressFill.style.width = `${progress}%`;
  if (state.log) {
    logOutput.textContent = state.log.trim();
  }
  applyConfig(state);
};

const showSaveStatus = (message, color = '#10b981') => {
  saveStatus.textContent = message;
  saveStatus.style.color = color;
  setTimeout(() => {
    saveStatus.textContent = '';
  }, 2000);
};

document.getElementById('save-config').addEventListener('click', async () => {
  try {
    await window.grokAPI.saveConfig(collectConfig());
    showSaveStatus('تم حفظ الإعدادات بنجاح');
    await updateState();
  } catch (error) {
    showSaveStatus('تعذر حفظ الإعدادات', '#ef4444');
  }
});

document.getElementById('run-automation').addEventListener('click', async () => {
  try {
    showSaveStatus('يتم تشغيل الأتمتة...', '#f59e0b');
    await window.grokAPI.run(collectConfig());
    showSaveStatus('اكتمل التشغيل بنجاح');
  } catch (error) {
    showSaveStatus('حدث خطأ أثناء التشغيل', '#ef4444');
  } finally {
    await updateState();
  }
});

document.getElementById('refresh-log').addEventListener('click', updateState);

updateState();
setInterval(updateState, 4000);
