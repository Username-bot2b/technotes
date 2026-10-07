---
publishDate: 2026-10-07T08:00:00Z
title: Vue官方插件 3.3.12 会让 Prettier - Code formatter 失效
excerpt: 降级到 3.3.10 就好了，记得禁止 Auto Update
category: IDE,VSCode,Vue,Prettier
tags:
  - vscode
  - vue
  - prettier
author: technotes
---

这周一，打开项目修改代码后，发现格式化失效。明明上周都是好的。

让IDE内的AI排查了半天，也没找到个所以然，最大的帮助是将我引导到了 Output ，可以看到 Prettier 插件的直接报错信息。

后来我把报错信息复制到 Gemini ，它明确指出 Prettier 的报错和 Vue 插件有关，还指出了是其自定义模块加载钩子的问题。我回到IDE查看 Vue 插件，发现其自动升级到了 3.3.12 版本，而且就是前两天才出的新版本。我将其降级到 3.3.10，重载IDE，自动格式化就恢复了。

从此事学到了：应该关闭所有插件的自动升级，哪怕是官方插件也并不总是可靠。

另外我自己对AI太依赖了，虽然最近一直在尝试重拾人工编码的能力，但这次排查这个问题时，我几乎没怎么自己思考过。后来发现其实Output里面的报错信息已经很直观了，可以直接看到是和 vue 和 volar 有关，我如果将报错信息通读一下（本来也不长），应该早就找到问题了。

自勉