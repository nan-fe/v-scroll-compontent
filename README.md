# v-scroll-compontent

基于 Web Components 的纵向自定义滚动区域：核心标签为 `v-scroll`，使用 Custom Element 与 Shadow DOM，隐藏系统滚动条并提供可拖拽 thumb。  
构建使用 **Vite**，并通过自定义插件把 `v-scroll.css` 编译为内联样式模块（`.theme/@v-scroll.js`），由组件在 Shadow Root 中注入。

已经部署至阿里云服务，可以访问 http://47.100.107.192:4000/ 查看👀

## 特性

- 原生 Custom Element + Shadow DOM，页面中直接使用 `<v-scroll>` 即可
- 隐藏原生滚动条，thumb 可拖拽，并与 `scrollTop` 同步
- 滚轮在右侧 gutter / 空白区域可驱动滚动；支持内容区动态高度（ResizeObserver）
- 通过宿主上的 **CSS 变量** 做主题与尺寸定制
- 提供 **Docker** 多阶段镜像与 **GitHub Actions**（构建推送 ACR + 可选 SSH 部署）

## 技术栈

- Vite 7、PostCSS、postcss-nesting、clean-css（样式压缩）
- 生产环境由 **Nginx** 托管 `dist/` 静态文件

## 目录结构

```text
.
├─ v-scroll.js                 # 组件逻辑（注册 <v-scroll>）
├─ v-scroll.css                # 组件样式源（构建时写入 .theme）
├─ vite-plugin-css-module.js   # 将 v-scroll.css 编译为 export default "..." 的 JS 模块
├─ vite.config.js              # 别名 $/v-scroll.js → .theme/@v-scroll.js，并挂载上述插件
├─ index.html                  # 演示页（含 import map，直开文件时需先构建以生成 .theme）
├─ build.sh                    # 构建入口：有 bun 则用 bun run build，否则 npm run build
├─ Dockerfile                  # Node 构建 + nginx 镜像
├─ docker/
│   └─ nginx.conf              # 站点配置
├─ docker-compose.yml          # docker
├─ .husky/                     # Git 钩子（pre-commit 调 ./build.sh）
└─ .github/workflows/docker-acr.yml
```

构建或执行 `bunx vite` / `bun run build` 时，插件会生成或更新 **`.theme/@v-scroll.js`**（建议纳入版本控制或至少在发布流水线中生成，以免演示页引用缺失）。

## 快速开始

### 安装依赖

```bash
bun i
```

### 构建

```bash
bun run build
# 或（无 bun 时回退到 npm）
./build.sh
```

产物：

- **`dist/`**：可部署的静态站点（入口 HTML 与打包后的脚本）
- **`.theme/@v-scroll.js`**：由 `v-scroll.css` 生成的默认导出字符串模块，供 `v-scroll.js` 注入 Shadow 样式

### 本地开发（Vite）

当前 `package.json` 仅声明了 `build` 与 `prepare`。可用：

```bash
bunx vite
```

### Git 钩子（Husky）

[Husky 官方文档](https://typicode.github.io/husky) 中的示例多为 `npm` / `npx`；**不要**去改 `node_modules/husky/README.md`（该文件只有官网链接，且会在重装依赖时被覆盖）。在本仓库请按下表使用 **bun** 等价写法：

| 官方文档常见写法 | 本仓库推荐（bun） |
|------------------|-------------------|
| `npm install` | `bun i` |
| `npm install husky --save-dev` | `bun add -D husky` |
| `npx husky init` | `bunx husky init` |

`package.json` 已配置 `"prepare": "husky"`。克隆本仓库后执行 **`bun i`** 即可在安装依赖时注册钩子；**`.husky/pre-commit`** 会在每次 `git commit` 前执行 **`./build.sh`**（优先 `bun run build`）。临时跳过钩子：`HUSKY=0 git commit ...`。

## 在页面中使用

注册与挂载由 `v-scroll.js` 完成，页面引入该模块后即可使用标签（演示页写法）：

```html
<script type="importmap">
{
  "imports": {
    "$/v-scroll.js": "./.theme/@v-scroll.js"
  }
}
</script>
<script type="module" src="./v-scroll.js"></script>

<v-scroll>
  <div class="content">
    <!-- 可滚动内容；建议最外层带 .content 以便内部 min-height 行为一致 -->
  </div>
</v-scroll>
```

说明：

- **`import map`** 仅在浏览器原生 ES 模块解析时生效；在 **Vite 打包** 时，`vite.config.js` 里的 `resolve.alias` 会把 `$/v-scroll.js` 指到 `.theme/@v-scroll.js`，与上述映射一致。
- 修改 **`v-scroll.css`** 后需重新执行构建（或 `bunx vite` 触发插件），否则 `.theme/@v-scroll.js` 可能仍是旧样式。

## 样式定制（CSS 变量）

在 `v-scroll` 宿主（或外层选择器）上覆盖即可：

| 变量 | 含义 |
|------|------|
| `--v-scroll-width` | 滚动条区域总宽度（含两侧边距） |
| `--v-scroll-edge-gap` | thumb 距轨道上下边距 |
| `--v-scroll-thumb-width` | thumb 宽度 |
| `--v-scroll-min-thumb` | thumb 最小高度 |
| `--v-scroll-track-bg` | 轨道背景色（与渐变搭配） |
| `--v-scroll-thumb-bg` | thumb 默认背景 |
| `--v-scroll-thumb-bg-hover` | thumb 悬停背景 |
| `--v-scroll-thumb-bg-drag` | thumb 拖拽时背景 |
| `--v-scroll-radius` | thumb 圆角 |

示例：

```css
v-scroll {
  --v-scroll-width: 14px;
  --v-scroll-thumb-width: 6px;
  --v-scroll-track-bg: #1f2a3d;
  --v-scroll-thumb-bg: #4f6b97;
}
```

## Docker

镜像构建阶段使用 **`npm ci`**（见 `Dockerfile`），与本地推荐使用 **bun** 不冲突。

### 构建镜像

`docker-compose.yml` 中为远端部署示例：镜像来自 ACR，宿主机 **4000** 映射到容器 **80**（容器内 Nginx 固定监听 80）。

## CI/CD（GitHub Actions）

工作流：`.github/workflows/docker-acr.yml`

**触发条件**

- `push` 到分支 **`main`**
- `push` 符合 **`v*`** 的 tag

**流程概要**

1. 登录阿里云 ACR，Docker Buildx 构建并推送镜像（`latest` 与 `git sha` 标签）
2. 拉取指定 sha 镜像并做 HTTP 冒烟测试（容器内 80 端口）
3. 可选：SSH 到服务器，在 `DEPLOY_DIR` 下 `git pull`（默认分支）、`docker compose pull` 与 `docker compose up -d`

## 环境变量

- **`V_SCROLL_THEME_OUTPUT`**：可选，覆盖样式模块输出路径（默认 `./.theme/@v-scroll.js`），需与 `vite.config.js` 中别名目标一致。

## 备注

- 演示页里的明暗主题切换用于验证 CSS 变量主题能力，与组件核心逻辑无关，集成时可忽略。
