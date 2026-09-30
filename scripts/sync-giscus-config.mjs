/**
 * 将 Giscus 指向本项目的 GitHub 源码仓库。
 *
 * 前置条件（在 GitHub 上）：
 * 1. 仓库 Settings → General → Features → 勾选 Discussions
 * 2. 安装 https://github.com/apps/giscus 并授权该仓库
 *
 * 用法：
 *   npm run giscus:setup -- owner/technotes
 * 或（已配置 origin 时）：
 *   npm run giscus:setup
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, '../src/config.yaml');

function parseGithubRemote() {
  try {
    const url = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    const match = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
    if (match) return `${match[1]}/${match[2]}`;
  } catch {
    /* no remote */
  }
  return null;
}

function patchYamlField(content, field, value) {
  const quoted = `'${String(value).replace(/'/g, "''")}'`;
  const pattern = new RegExp(`(^\\s*${field}:\\s*)(['"]?)[^'"]*\\2`, 'm');
  if (!pattern.test(content)) {
    throw new Error(`config.yaml 中未找到字段: ${field}`);
  }
  return content.replace(pattern, `$1${quoted}`);
}

const repo = process.argv[2] || process.env.GITHUB_REPOSITORY || parseGithubRemote();

if (!repo || !repo.includes('/')) {
  console.error(
    [
      '请指定 GitHub 仓库（须为本项目源码仓库，owner/repo 格式）。',
      '',
      '  npm run giscus:setup -- your-user/technotes',
      '',
      '或先 git remote add origin … 后直接 npm run giscus:setup',
    ].join('\n')
  );
  process.exit(1);
}

const apiUrl = `https://giscus.app/api/discussions/categories?repo=${encodeURIComponent(repo)}`;
const response = await fetch(apiUrl);

if (!response.ok) {
  console.error(
    [
      `无法从 giscus 读取仓库「${repo}」（HTTP ${response.status}）。`,
      '',
      '请确认：',
      '  · 仓库存在且为 public（或 giscus App 已授权 private 仓库）',
      '  · 已开启 GitHub Discussions',
      '  · 已安装 https://github.com/apps/giscus',
    ].join('\n')
  );
  process.exit(1);
}

/** @type {{ repositoryId?: string; categories?: Array<{ id: string; name: string }> }} */
const metadata = await response.json();
const repoId = metadata.repositoryId;
const categories = metadata.categories ?? [];

if (!repoId || categories.length === 0) {
  console.error('giscus 返回的数据不完整，请稍后在 https://giscus.app 手动配置。');
  process.exit(1);
}

const preferredNames = ['Announcements', 'General', 'Blog', 'Comments', '公告'];
const category =
  categories.find((item) => preferredNames.includes(item.name)) ?? categories[0];

let yamlContent = fs.readFileSync(configPath, 'utf8');
yamlContent = patchYamlField(yamlContent, 'repo', repo);
yamlContent = patchYamlField(yamlContent, 'repoId', repoId);
yamlContent = patchYamlField(yamlContent, 'category', category.name);
yamlContent = patchYamlField(yamlContent, 'categoryId', category.id);
yamlContent = yamlContent.replace(/^(\s*enabled:\s*)false/m, '$1true');

fs.writeFileSync(configPath, yamlContent, 'utf8');

console.log('已更新 src/config.yaml 中的 Giscus 配置：');
console.log(`  repo:         ${repo}`);
console.log(`  repoId:       ${repoId}`);
console.log(`  category:     ${category.name}`);
console.log(`  categoryId:   ${category.id}`);
console.log('');
console.log('请重新 npm run dev / build 后，在文章页查看评论区。');
