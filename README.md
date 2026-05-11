# v-scroll-compontent

一个基于 Web Components 的自定义纵向滚动条组件示例项目，核心标签为 `v-scroll`。  
项目使用 `Vite` 构建，并通过自定义插件将 `v-scroll.css` 预处理并打包为 JS 模块供组件注入。

## 特性

- 使用原生 Custom Element + Shadow DOM，开箱即用
- 隐藏原生滚动条，提供可拖拽的自定义滚动 thumb
- 支持滚轮交互、拖拽交互和动态高度同步
- 通过 CSS 变量进行主题化和样式定制
- 提供 Docker 镜像构建与 GitHub Actions 自动部署流程

## 技术栈

- `Vite`
- `PostCSS` + `postcss-nesting`
- `clean-css`
- `Nginx`（生产静态资源托管）

## 目录结构

```text
.
├─ v-scroll.js                 # 组件逻辑（Custom Element）
├─ v-scroll.css                # 组件样式源文件
├─ vite-plugin-css-module.js   # 将 CSS 编译为 JS 模块的 Vite 插件
├─ vite.config.js              # Vite 配置（含别名映射与插件）
├─ index.html                  # 本地演示页面
├─ Dockerfile                  # 多阶段构建镜像
├─ docker/nginx.conf           # Nginx 配置
├─ build.sh                    # 构建脚本（优先 bun，其次 npm）
└─ .github/workflows/docker-acr.yml  # CI/CD 工作流
```

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2) 构建

```bash
npm run build
```

构建后会生成：

- `dist/`：静态资源产物
- `.theme/@v-scroll.js`：由 `v-scroll.css` 转换得到的样式模块

> 当前 `package.json` 仅提供 `build` 脚本，如需本地开发预览，可自行补充 `dev` 脚本（例如 `vite`）。

## 组件使用

组件通过 `v-scroll.js` 注册标签：

```html
<v-scroll>
  <div class="content">
    <!-- 可滚动内容 -->
  </div>
</v-scroll>
```

在示例页面中，组件依赖 import map 将样式模块映射为 `$/v-scroll.js`：

```html
<script type="importmap">
{
  "imports": {
    "$/v-scroll.js": "./.theme/@v-scroll.js"
  }
}
</script>
```

## 样式定制（CSS 变量）

可在宿主元素（`v-scroll`）上覆盖以下变量：

- `--v-scroll-width`：滚动条轨道总宽度
- `--v-scroll-edge-gap`：滚动条上下间距
- `--v-scroll-thumb-width`：thumb 宽度
- `--v-scroll-min-thumb`：thumb 最小高度
- `--v-scroll-track-bg`：轨道背景色
- `--v-scroll-thumb-bg`：thumb 默认背景
- `--v-scroll-thumb-bg-hover`：thumb hover 背景
- `--v-scroll-thumb-bg-drag`：thumb 拖拽背景
- `--v-scroll-radius`：thumb 圆角

示例：

```css
v-scroll {
  --v-scroll-width: 14px;
  --v-scroll-thumb-width: 6px;
  --v-scroll-track-bg: #1f2a3d;
  --v-scroll-thumb-bg: #4f6b97;
}
```

## Docker 构建与运行

### 构建镜像

```bash
docker build -t v-scroll-compontent:latest .
```

### 运行容器

```bash
docker run --rm -p 8080:80 v-scroll-compontent:latest
```

浏览器访问 [http://localhost:8080](http://localhost:8080)。

## CI/CD（GitHub Actions）

工作流文件：`.github/workflows/docker-acr.yml`

触发条件：

- push 到 `master`
- push 符合 `v*` 的 tag

流程概览：

1. 登录阿里云 ACR
2. 构建并推送镜像（`latest` + `git sha`）
3. SSH 到目标服务器执行：
   - `git pull origin master`
   - `docker compose pull`
   - `docker compose up -d`

## 注意事项

- 项目里的当前主题功能是为了测试更换“通过 CSS 变量进行主题化和样式定制” 能力加的，可以忽略

