<template>
  <div class="code-playground">
    <div class="code-playground__header">
      <p v-if="title" class="code-playground__title">{{ title }}</p>
      <div class="code-playground__toolbar" role="toolbar" aria-label="Playground 工具栏">
        <button
          type="button"
          class="code-playground__tool-btn"
          :class="{ 'code-playground__tool-btn--active': showEditor }"
          :aria-pressed="showEditor"
          @click="toggleEditor"
        >
          <span class="code-playground__glyph" aria-hidden="true">&lt;/&gt;</span>
          代码
        </button>
        <button
          type="button"
          class="code-playground__tool-btn"
          :class="{ 'code-playground__tool-btn--active': showPreview }"
          :aria-pressed="showPreview"
          @click="togglePreview"
        >
          <span class="code-playground__glyph" aria-hidden="true">{{ showPreview ? '▣' : '▢' }}</span>
          预览
        </button>
        <button
          type="button"
          class="code-playground__tool-btn code-playground__tool-btn--action"
          @click="openPreviewInNewTab"
        >
          <span class="code-playground__glyph" aria-hidden="true">↗</span>
          新窗口预览
        </button>
      </div>
    </div>

    <p v-if="!showEditor && !showPreview" class="code-playground__empty">请至少打开「代码」或「预览」之一。</p>

    <div
      v-else
      class="code-playground__layout"
      :class="{
        'code-playground__layout--both': showEditor && showPreview,
        'code-playground__layout--single': showEditor !== showPreview,
      }"
    >
      <div v-show="showEditor" class="code-playground__editor-pane">
        <div class="code-playground__tabs" role="tablist">
          <button
            v-for="fileName in fileNames"
            :key="fileName"
            type="button"
            role="tab"
            class="code-playground__tab"
            :class="{ 'code-playground__tab--active': fileName === activeFile }"
            :aria-selected="fileName === activeFile"
            @click="activeFile = fileName"
          >
            {{ displayName(fileName) }}
          </button>
        </div>
        <textarea
          v-model="fileContents[activeFile]"
          class="code-playground__textarea"
          spellcheck="false"
          :style="{ height: `${editorHeight}px` }"
          @input="scheduleUpdate"
        />
      </div>
      <div v-show="showPreview" class="code-playground__preview-pane">
        <p class="code-playground__preview-label">Preview（在预览区内滚动）</p>
        <iframe
          ref="previewFrame"
          class="code-playground__iframe"
          :style="{ height: `${editorHeight}px` }"
          title="Code preview"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { loadSandpackClient, type SandpackClient } from '@codesandbox/sandpack-client';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    files: Record<string, string>;
    editorHeight?: number;
  }>(),
  {
    editorHeight: 320,
  }
);

const previewFrame = ref<HTMLIFrameElement | null>(null);
const activeFile = ref('');
const fileContents = reactive<Record<string, string>>({});
const showEditor = ref(true);
const showPreview = ref(true);
const sandpackPreviewUrl = ref('');

let client: SandpackClient | null = null;
let updateTimer: ReturnType<typeof setTimeout> | undefined;
let previewFrameLoadHandler: (() => void) | null = null;
let unsubscribeSandpack: (() => void) | null = null;

const fileNames = computed(() =>
  Object.keys(fileContents).sort((a, b) => {
    if (a.endsWith('.html')) return -1;
    if (b.endsWith('.html')) return 1;
    return a.localeCompare(b);
  })
);

const displayName = (path: string) => path.replace(/^\//, '');

const pickFile = (name: string) => {
  const normalized = name.startsWith('/') ? name : `/${name}`;
  return fileContents[normalized] ?? fileContents[name] ?? '';
};

const toSandboxFiles = () =>
  Object.fromEntries(
    Object.entries(fileContents).map(([path, code]) => [
      path.startsWith('/') ? path : `/${path}`,
      { code, active: path === activeFile.value },
    ])
  );

const updatePreview = () => {
  if (!client) return;
  client.updateSandbox({
    files: toSandboxFiles(),
    template: 'static',
    entry: '/index.html',
  });
};

const scheduleUpdate = () => {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(updatePreview, 280);
};

const isSandpackPreviewUrl = (url: string) =>
  /^https?:\/\//.test(url) && url.includes('sandpack-static-server');

const syncPreviewUrlFromClient = () => {
  const src = client?.iframe?.src ?? previewFrame.value?.src ?? '';
  if (isSandpackPreviewUrl(src)) {
    sandpackPreviewUrl.value = src;
  }
};

const toggleEditor = () => {
  if (showEditor.value && !showPreview.value) return;
  showEditor.value = !showEditor.value;
};

const togglePreview = () => {
  if (showPreview.value && !showEditor.value) return;
  showPreview.value = !showPreview.value;
};

const buildStandaloneHtml = () => {
  let html = pickFile('index.html');
  const css = pickFile('styles.css');
  const js = pickFile('script.js');

  if (css) {
    html = html.replace(
      /<link[^>]*href=["'][^"']*styles\.css["'][^>]*>/gi,
      () => `<style>\n${css}\n</style>`
    );
  }

  if (js && !/<script[^>]*src=/i.test(html)) {
    const bodyClose = '</' + 'body>';
    const scriptTag = '<' + 'script>';
    const scriptClose = '</' + 'script>';
    html = html.replace(
      new RegExp(bodyClose, 'i'),
      `${scriptTag}\n${js}\n${scriptClose}\n${bodyClose}`
    );
  }

  return html;
};

const openPreviewInNewTab = () => {
  syncPreviewUrlFromClient();

  if (sandpackPreviewUrl.value) {
    window.open(sandpackPreviewUrl.value, '_blank', 'noopener,noreferrer');
    return;
  }

  // Sandpack 尚未返回 preview URL 时（例如首次编译中）回退到本地拼装的 HTML
  const html = buildStandaloneHtml();
  if (!html.trim()) return;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank', 'noopener,noreferrer');

  if (!tab) {
    URL.revokeObjectURL(url);
    return;
  }

  tab.addEventListener(
    'load',
    () => {
      URL.revokeObjectURL(url);
    },
    { once: true }
  );
};

onMounted(async () => {
  Object.assign(fileContents, props.files);
  activeFile.value = fileNames.value[0] ?? '/index.html';

  if (!previewFrame.value) return;

  client = await loadSandpackClient(
    previewFrame.value,
    {
      files: toSandboxFiles(),
      template: 'static',
      entry: '/index.html',
    },
    {
      showOpenInCodeSandbox: false,
      showErrorScreen: true,
      showLoadingScreen: true,
    }
  );

  unsubscribeSandpack = client.listen((message) => {
    if (
      message.type === 'urlchange' &&
      'url' in message &&
      typeof message.url === 'string' &&
      isSandpackPreviewUrl(message.url)
    ) {
      sandpackPreviewUrl.value = message.url;
    }
  });

  previewFrameLoadHandler = () => syncPreviewUrlFromClient();
  previewFrame.value.addEventListener('load', previewFrameLoadHandler);
  syncPreviewUrlFromClient();
});

onBeforeUnmount(() => {
  if (updateTimer) clearTimeout(updateTimer);
  unsubscribeSandpack?.();
  unsubscribeSandpack = null;
  if (previewFrame.value && previewFrameLoadHandler) {
    previewFrame.value.removeEventListener('load', previewFrameLoadHandler);
  }
  previewFrameLoadHandler = null;
  client?.destroy();
  client = null;
});
</script>

<style scoped>
.code-playground {
  margin: 1.25rem 0;
  border: 2px solid #999;
  background: #fff;
}

.code-playground__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  padding: 0.35rem 0.5rem 0.35rem 0.6rem;
  border-bottom: 1px solid #999;
  background: #f5f5f5;
}

.code-playground__title {
  margin: 0;
  flex: 1 1 12rem;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  font-weight: 700;
}

.code-playground__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.code-playground__tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  padding: 0.25rem 0.55rem;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #999;
  background: #fff;
  color: #111;
}

.code-playground__tool-btn--active {
  font-weight: 700;
  background: #fef08a;
  border-color: #666;
}

.code-playground__tool-btn--action {
  background: #e5e7eb;
}

.code-playground__glyph {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1;
}

.code-playground__tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.code-playground__empty {
  margin: 0;
  padding: 1rem 0.75rem;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  color: #666;
}

.code-playground__layout {
  display: grid;
}

.code-playground__layout--both {
  grid-template-columns: 1fr 1fr;
}

.code-playground__layout--single {
  grid-template-columns: 1fr;
}

.code-playground__editor-pane {
  border-right: 2px solid #999;
  min-width: 0;
}

.code-playground__layout--single .code-playground__editor-pane {
  border-right: none;
}

.code-playground__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  border-bottom: 1px solid #999;
  background: #eee;
}

.code-playground__tab {
  margin: 0;
  padding: 0.35rem 0.6rem;
  border: none;
  border-right: 1px solid #999;
  background: #eee;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  cursor: pointer;
}

.code-playground__tab--active {
  background: #fff;
  font-weight: 700;
}

.code-playground__textarea {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.6rem;
  border: none;
  resize: vertical;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.45;
  tab-size: 2;
  box-sizing: border-box;
  background: #fff;
  color: #000;
}

.code-playground__preview-pane {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.code-playground__preview-label {
  margin: 0;
  padding: 0.35rem 0.6rem;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  border-bottom: 1px solid #999;
  background: #fafafa;
  color: #444;
}

.code-playground__iframe {
  display: block;
  width: 100%;
  border: none;
  background: #fff;
}

@media (max-width: 768px) {
  .code-playground__layout--both {
    grid-template-columns: 1fr;
  }

  .code-playground__editor-pane {
    border-right: none;
    border-bottom: 2px solid #999;
  }
}
</style>
