import fs from 'node:fs/promises';
import path from 'node:path';
import CleanCSS from 'clean-css';
import postcss from 'postcss';
import postcssNesting from 'postcss-nesting';

const toAbsPath = (root, target_path) => (path.isAbsolute(target_path) ? target_path : path.resolve(root, target_path));

const createCssModuleCode = (css_text) => `export default ${JSON.stringify(css_text)};\n`;

const cssModulePlugin = (plugin_options = {}) => {
  const DEFAULT_OPTIONS = {
      source_css_path: './v-scroll.css',
      output_js_path: './.theme/@v-scroll.js'
    },
    OPTIONS = { ...DEFAULT_OPTIONS, ...plugin_options };
  return {
    name: 'v-scroll-css-module-builder',
    configResolved: async (resolved_config) => {
      const ROOT = resolved_config.root,
        SOURCE_CSS_PATH = toAbsPath(ROOT, OPTIONS.source_css_path),
        OUTPUT_JS_PATH = toAbsPath(ROOT, OPTIONS.output_js_path),
        CSS_SOURCE = await fs.readFile(SOURCE_CSS_PATH, 'utf8'),
        POSTCSS_RESULT = await postcss([postcssNesting()]).process(CSS_SOURCE, { from: SOURCE_CSS_PATH }),
        MINIFIED = new CleanCSS({ level: 2 }).minify(POSTCSS_RESULT.css);

      if (MINIFIED.errors.length) throw new Error(`CSS minify failed: ${MINIFIED.errors.join('; ')}`);
      const OUTPUT_CODE = createCssModuleCode(MINIFIED.styles),
        OUTPUT_DIR = path.dirname(OUTPUT_JS_PATH);
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      await fs.writeFile(OUTPUT_JS_PATH, OUTPUT_CODE, 'utf8');
    }
  };
};

export default cssModulePlugin;
