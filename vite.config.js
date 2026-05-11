import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import cssModulePlugin from './vite-plugin-css-module.js';

const DIR = fileURLToPath(new URL('.', import.meta.url)),
  THEME_OUTPUT_PATH = process.env.V_SCROLL_THEME_OUTPUT ?? './.theme/@v-scroll.js',
  THEME_MODULE_ABS = path.isAbsolute(THEME_OUTPUT_PATH) ? THEME_OUTPUT_PATH : path.resolve(DIR, THEME_OUTPUT_PATH);

export default defineConfig({
  resolve: {
    alias: {
      // import map 只在浏览器生效；打包时 Rollup 需显式映射到构建产物
      '$/v-scroll.js': THEME_MODULE_ABS
    }
  },
  plugins: [
    cssModulePlugin({
      source_css_path: './v-scroll.css',
      output_js_path: THEME_MODULE_ABS
    })
  ]
});
