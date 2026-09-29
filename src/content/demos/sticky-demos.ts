export type StickyDemoFiles = Record<string, string>;

const block = (count: number, label = '内容块') =>
  Array.from({ length: count }, (_, i) => `<p class="block">${label} ${i + 1}</p>`).join('\n    ');

const baseCss = `
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  line-height: 1.5;
  color: #111;
}
.block {
  margin: 0 0 16px;
  padding: 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
}
`.trim();

const longParagraph = (n: number) =>
  `<p class="msg-p">段落 ${n}：这是一条偏长的消息正文，用来撑开高度。Sticky 头像只会在所属消息块内吸顶；当整条消息滚出视口后，下一条消息的头像会接替吸顶。你可以试着把 <code>position: sticky</code> 改成 <code>fixed</code> 对比行为。</p>`;

const chatMessage = (author: string, initial: string, hue: string, paras: number) => `
  <article class="message">
    <div class="avatar" style="background: ${hue}" title="${author}">${initial}</div>
    <div class="body">
      <header class="meta"><strong>${author}</strong></header>
      ${Array.from({ length: paras }, (_, i) => longParagraph(i + 1)).join('\n      ')}
    </div>
  </article>`;

export const stickyDemos: Record<string, StickyDemoFiles> = {
  stickyVsFixed: {
    '/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="fixed-badge">Fixed · 始终在右上角</div>
  <p class="lead">先滚过上方空白，再观察<strong>虚线框内</strong>的黄条。</p>
  ${block(4, '上方占位')}
  <section class="bounded" aria-label="sticky 的作用范围">
    <p class="bounded-label">Sticky 的作用范围（虚线框 = 包含块边界）</p>
    <header class="sticky-bar">Sticky · 吸顶但滚出虚线框后会跟着离开</header>
    <div class="bounded-body">
      ${block(10, '框内段落')}
    </div>
  </section>
  ${block(6, '下方占位')}
</body>
</html>`,
    '/styles.css': `${baseCss}

.lead {
  margin: 0;
  padding: 12px 16px;
  background: #f3f4f6;
  border-bottom: 1px solid #999;
  font-size: 14px;
}

.fixed-badge {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 20;
  padding: 6px 10px;
  background: #374151;
  color: #fff;
  font-size: 12px;
  border: 2px solid #000;
}

.bounded {
  margin: 16px;
  border: 3px dashed #666;
  background: #fafafa;
}

.bounded-label {
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
  background: #e5e7eb;
  border-bottom: 1px solid #999;
}

.sticky-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 12px 16px;
  background: #fef08a;
  border-bottom: 2px solid #000;
  font-weight: 700;
}

.bounded-body {
  padding: 12px 16px 20px;
}
`,
  },

  chatAvatars: {
    '/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="feed-header">消息流 · 每条消息左侧头像独立 sticky</header>
  <div class="feed">
    ${chatMessage('Alice', 'A', '#6366f1', 5)}
    ${chatMessage('Bob', 'B', '#059669', 1)}
    ${chatMessage('Carol', 'C', '#d97706', 4)}
  </div>
</body>
</html>`,
    '/styles.css': `${baseCss}

.feed-header {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 10px 16px;
  background: #111;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.feed {
  padding: 0 12px 24px;
}

.message {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px 8px;
  border-bottom: 2px solid #ddd;
}

.avatar {
  position: sticky;
  top: 48px;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  border: 2px solid #000;
}

.meta {
  margin: 0 0 8px;
  font-size: 14px;
}

.msg-p {
  margin: 0 0 12px;
  padding: 0;
  background: transparent;
  border: none;
  font-size: 14px;
}

.msg-p code {
  font-size: 12px;
  background: #eee;
  padding: 1px 4px;
}
`,
  },

  scrollContainer: {
    '/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <h1>对比：页面滚动 vs 容器内滚动</h1>
  <section class="panel">
    <h2>Panel A · 无 overflow（sticky 相对页面）</h2>
    <header class="nav">Sticky A</header>
    <div class="content">${block(6, 'A')}</div>
  </section>
  <section class="panel scroll-box">
    <h2>Panel B · overflow: auto（sticky 相对此容器）</h2>
    <header class="nav">Sticky B</header>
    <div class="content">${block(10, 'B')}</div>
  </section>
  <section class="panel scroll-box" style="height: 220px;">撑高</section>
</body>
</html>`,
    '/styles.css': `${baseCss}

body { padding: 16px; }

.panel {
  margin-bottom: 24px;
  border: 2px solid #000;
}

.panel h2 {
  margin: 0;
  padding: 8px 12px;
  font-size: 14px;
  background: #e5e7eb;
  border-bottom: 1px solid #000;
}

.nav {
  position: sticky;
  top: 0;
  padding: 10px 12px;
  background: #bbf7d0;
  border-bottom: 1px solid #000;
  font-weight: 700;
}

.content { padding: 12px; }

.scroll-box {
  height: 220px;
  overflow: auto;
}
`,
  },

  stacking: {
    '/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="nav nav-primary">一级 Sticky · top: 0</header>
  <header class="nav nav-secondary">二级 Sticky · top: 44px</header>
  <main>
    ${block(14, '段落')}
  </main>
</body>
</html>`,
    '/styles.css': `${baseCss}

.nav {
  position: sticky;
  padding: 10px 16px;
  border-bottom: 2px solid #000;
  font-weight: 700;
}

.nav-primary {
  top: 0;
  z-index: 2;
  background: #fecaca;
}

.nav-secondary {
  top: 44px;
  z-index: 1;
  background: #fed7aa;
}

main { padding: 16px; }
`,
  },

  tableHead: {
    '/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>姓名</th>
          <th>部门</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        ${Array.from({ length: 20 }, (_, i) => `<tr><td>用户 ${i + 1}</td><td>研发</td><td>向下滚动，表头应吸顶</td></tr>`).join('\n        ')}
      </tbody>
    </table>
  </div>
</body>
</html>`,
    '/styles.css': `${baseCss}

body { padding: 16px; }

.table-wrap {
  max-height: 260px;
  overflow: auto;
  border: 2px solid #000;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 10px 12px;
  border: 1px solid #999;
  text-align: left;
}

thead th {
  position: sticky;
  top: 0;
  background: #dbeafe;
  z-index: 1;
}

tbody tr:nth-child(even) { background: #f9fafb; }
`,
  },

  realLayout: {
    '/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="announcement">Fixed 公告栏 · 全站活动通知（始终在视口最顶）</div>

  <header class="site-header">
    <nav class="site-nav">technotes · 首页 · 博客 · 关于</nav>
  </header>

  <div class="page-body">
    <aside class="sidebar">
      <nav class="sidebar-menu" aria-label="文档菜单">
        <p class="menu-title">目录</p>
        <a href="#">1. 概述</a>
        <a href="#">2. 基础语法</a>
        <a href="#">3. 滚动容器</a>
        <a href="#">4. 失效排查</a>
        <a href="#">5. 实战案例</a>
        <a href="#">6. 附录</a>
      </nav>
    </aside>

    <main class="content">
      <h1 class="article-title">复合布局下的 sticky 协作</h1>
      <p class="article-lede">导航栏会随页面滚走；侧边栏、Tab 条的 sticky 使用 <code>top: var(--announce-h)</code>，避免挡住 fixed 公告。</p>

      <div class="tab-list" role="tablist">
        <span class="tab tab--active">正文</span>
        <span class="tab">评论 (12)</span>
        <span class="tab">修订历史</span>
      </div>

      <article class="article-body">
        ${block(16, '正文段落')}
      </article>

      <footer class="article-tags">
        <strong>标签：</strong>
        <span class="tag">#css</span>
        <span class="tag">#sticky</span>
        <span class="tag">#layout</span>
        <span class="tag">#frontend</span>
      </footer>
    </main>
  </div>

  <footer class="page-footer">© 2026 技术笔记 · 页面 Footer（普通文档流，无 sticky / fixed）</footer>
</body>
</html>`,
    '/styles.css': `${baseCss}

:root {
  --announce-h: 40px;
}

.announcement {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: var(--announce-h);
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #6d28d9;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  border-bottom: 2px solid #000;
}

body {
  padding-top: var(--announce-h);
}

.site-header {
  background: #1f2937;
  color: #fff;
  border-bottom: 2px solid #000;
}

.site-nav {
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 700;
}

.page-body {
  display: flex;
  align-items: flex-start;
}

.sidebar {
  width: 168px;
  flex-shrink: 0;
  position: sticky;
  top: var(--announce-h);
  align-self: flex-start;
  max-height: calc(100vh - var(--announce-h));
  overflow-y: auto;
  background: #f3f4f6;
  border-right: 2px solid #999;
}

.menu-title {
  margin: 0 0 8px;
  padding: 12px 12px 0;
  font-size: 12px;
  font-weight: 700;
  color: #444;
}

.sidebar-menu a {
  display: block;
  padding: 8px 12px;
  font-size: 13px;
  text-decoration: underline;
  color: #00e;
}

.content {
  flex: 1;
  min-width: 0;
  padding: 16px 20px 8px;
}

.article-title {
  margin: 0 0 8px;
  font-size: 20px;
}

.article-lede {
  margin: 0 0 16px;
  font-size: 14px;
  color: #444;
}

.article-lede code {
  font-size: 12px;
  background: #eee;
  padding: 1px 4px;
}

.tab-list {
  position: sticky;
  top: var(--announce-h);
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  margin: 0 -4px 16px;
  background: #fef08a;
  border: 2px solid #000;
}

.tab {
  padding: 4px 10px;
  font-size: 13px;
  border: 1px solid #999;
  background: #fff;
}

.tab--active {
  font-weight: 700;
  background: #fde047;
}

.article-body {
  padding-bottom: 8px;
}

.article-tags {
  position: sticky;
  bottom: 0;
  z-index: 15;
  margin-top: 20px;
  padding: 12px 16px;
  background: #dbeafe;
  border: 2px solid #000;
  font-size: 14px;
}

.tag {
  display: inline-block;
  margin-right: 8px;
  padding: 2px 8px;
  background: #fff;
  border: 1px solid #999;
  font-size: 12px;
}

.page-footer {
  margin-top: 32px;
  padding: 20px 16px;
  background: #e5e7eb;
  border-top: 2px solid #999;
  text-align: center;
  font-size: 13px;
  color: #444;
}
`,
  },

  overflowToggle: {
    '/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="controls">
    <button type="button" class="toggle-btn" id="toggle">切换效果</button>
    <p class="status" id="status">当前：失效 · 祖先 <code>.page { overflow: hidden }</code></p>
  </div>
  <div class="page page--broken" id="page">
    <header class="nav nav--broken" id="nav">Sticky 导航 · 请在下方预览区内滚动</header>
    <main>${block(14, '段落')}</main>
  </div>
  <script>
    (function () {
      var page = document.getElementById('page');
      var status = document.getElementById('status');
      var nav = document.getElementById('nav');
      var broken = true;

      function render() {
        page.classList.toggle('page--broken', broken);
        page.classList.toggle('page--ok', !broken);
        nav.classList.toggle('nav--broken', broken);
        nav.classList.toggle('nav--ok', !broken);
        if (broken) {
          status.innerHTML =
            '当前：失效 · 祖先 <code>.page { overflow: hidden }</code>';
          nav.textContent = 'Sticky 失效 · 导航不会吸顶（overflow 截断）';
        } else {
          status.innerHTML =
            '当前：正常 · 已移除 <code>overflow: hidden</code>';
          nav.textContent = 'Sticky 正常 · 导航会吸顶';
        }
      }

      document.getElementById('toggle').addEventListener('click', function () {
        broken = !broken;
        render();
      });

      render();
    })();
  </script>
</body>
</html>`,
    '/styles.css': `${baseCss}

.controls {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 10px 12px;
  background: #f3f4f6;
  border-bottom: 2px solid #999;
}

.toggle-btn {
  margin: 0 0 6px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid #000;
  background: #fff;
}

.status {
  margin: 0;
  font-size: 13px;
  color: #333;
}

.status code {
  font-size: 12px;
  background: #e5e7eb;
  padding: 1px 4px;
}

.page--broken {
  overflow: hidden;
}

.nav {
  position: sticky;
  top: 81px;
  padding: 12px 16px;
  border-bottom: 2px solid #000;
  font-weight: 700;
}

.nav--broken {
  background: #fecaca;
}

.nav--ok {
  background: #bbf7d0;
}

main {
  padding: 16px;
}
`,
  },

  transformToggle: {
    '/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="controls">
    <button type="button" class="toggle-btn" id="toggle">切换效果</button>
    <p class="status" id="status"></p>
  </div>
  <p class="hint">请在<strong>灰色滚动区内部</strong>滚动（不是整页 iframe）。</p>
  <div class="scroll-host" id="scrollHost">
    <div class="between between--broken" id="between">
      <header class="nav nav--broken" id="nav">Sticky 导航</header>
      <div class="scroll-body">${block(12, '滚动区内段落')}</div>
    </div>
  </div>
  <script>
    (function () {
      var between = document.getElementById('between');
      var status = document.getElementById('status');
      var nav = document.getElementById('nav');
      var broken = true;

      function render() {
        between.classList.toggle('between--broken', broken);
        between.classList.toggle('between--ok', !broken);
        nav.classList.toggle('nav--broken', broken);
        nav.classList.toggle('nav--ok', !broken);
        if (broken) {
          status.innerHTML =
            '当前：sticky 与滚动区之间有 <code>transform: translateX(40px)</code> · 吸顶时导航会<strong>整体右移</strong>（布局与 transform 不同步）';
          nav.textContent = 'Sticky 错位 · transform 插在中间层';
        } else {
          status.innerHTML =
            '当前：中间层无 transform · 导航应竖直吸在<strong>灰色区域顶部</strong>';
          nav.textContent = 'Sticky 正常 · 相对灰色滚动区吸顶';
        }
      }

      document.getElementById('toggle').addEventListener('click', function () {
        broken = !broken;
        render();
      });

      render();
    })();
  </script>
</body>
</html>`,
    '/styles.css': `${baseCss}

.controls {
  padding: 10px 12px;
  background: #f3f4f6;
  border-bottom: 2px solid #999;
}

.toggle-btn {
  margin: 0 0 6px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid #000;
  background: #fff;
}

.status {
  margin: 0;
  font-size: 13px;
}

.status code {
  font-size: 12px;
  background: #e5e7eb;
  padding: 1px 4px;
}

.hint {
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
  background: #fffbeb;
  border-bottom: 1px solid #999;
}

.scroll-host {
  height: 260px;
  overflow-y: auto;
  margin: 12px;
  border: 2px solid #000;
  background: #f9fafb;
}

.between--broken {
  transform: translateX(40px);
}

.nav {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 10px 12px;
  border-bottom: 2px solid #000;
  font-weight: 700;
}

.nav--broken {
  background: #fecaca;
}

.nav--ok {
  background: #bbf7d0;
}

.scroll-body {
  padding: 12px;
}
`,
  },

  flexToggle: {
    '/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="controls">
    <button type="button" class="toggle-btn" id="toggle">切换效果</button>
    <p class="status" id="status"></p>
  </div>
  <p class="hint">在预览区内向下滚：观察左侧栏是否随正文滚动而<strong>吸在顶部</strong>。</p>
  <div class="layout layout--broken" id="layout">
    <aside class="sidebar sidebar--broken" id="sidebar">
      <strong>目录</strong>
      <a href="#">概述</a>
      <a href="#">API</a>
      <a href="#">示例</a>
    </aside>
    <main>${block(14, '正文')}</main>
  </div>
  <script>
    (function () {
      var layout = document.getElementById('layout');
      var sidebar = document.getElementById('sidebar');
      var status = document.getElementById('status');
      var broken = true;

      function render() {
        layout.classList.toggle('layout--broken', broken);
        layout.classList.toggle('layout--ok', !broken);
        sidebar.classList.toggle('sidebar--broken', broken);
        sidebar.classList.toggle('sidebar--ok', !broken);
        if (broken) {
          status.innerHTML =
            '当前：左侧栏是 flex 子项且 <code>align-self: stretch</code>（被拉满列高）· sticky 往往<strong>无效</strong>';
          sidebar.setAttribute('aria-label', 'stretch 导致 sticky 失效');
        } else {
          status.innerHTML =
            '当前：<code>align-self: flex-start</code> · 左侧栏应能吸顶';
          sidebar.setAttribute('aria-label', 'flex-start 修复 sticky');
        }
      }

      document.getElementById('toggle').addEventListener('click', function () {
        broken = !broken;
        render();
      });

      render();
    })();
  </script>
</body>
</html>`,
    '/styles.css': `${baseCss}

.controls {
  padding: 10px 12px;
  background: #f3f4f6;
  border-bottom: 2px solid #999;
}

.toggle-btn {
  margin: 0 0 6px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid #000;
  background: #fff;
}

.status {
  margin: 0;
  font-size: 13px;
}

.status code {
  font-size: 12px;
  background: #e5e7eb;
  padding: 1px 4px;
}

.hint {
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
  background: #fffbeb;
  border-bottom: 1px solid #999;
}

.layout {
  display: flex;
  gap: 16px;
  padding: 16px;
  align-items: stretch;
}

.sidebar {
  width: 168px;
  position: sticky;
  top: 12px;
  padding: 12px;
  border: 2px solid #000;
  font-size: 14px;
}

.sidebar strong {
  display: block;
  margin-bottom: 8px;
}

.sidebar a {
  display: block;
  margin-bottom: 6px;
  color: #00e;
}

.sidebar--broken {
  align-self: stretch;
  background: #fecaca;
}

.sidebar--ok {
  align-self: flex-start;
  background: #bbf7d0;
}

main {
  flex: 1;
  min-width: 0;
}
`,
  },
};
