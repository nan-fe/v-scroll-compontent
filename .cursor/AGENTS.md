用 bun i 安装依赖
用最现代的 js 写法
const 定义的常量要大写，函数用驼峰风格命名
函数用 const funcname = ()=>{} 这种格式来定义, 不要用 function 定义函数
合并多个连续的 const 声明为一个,要写 `const a=1, b=2, c=3;`（而不是 `const a=1;const b=2;const c=3`）
import 导入函数，避免直接导入模块
命名要极简，变量名用下划线风格，函数名用小写驼峰风格
用 await 不要用 .then
写纯函数，不要写类
注重代码复用，多定义函数，避免出现大量类似的代码结构
用最新浏览器支持的原生 css nesting，减少代码冗余
export default 的函数、变量，除非是在 import.meta.main 中有调用需求，否则不要声明const变量再导出
修改后运行 ./build.sh 修复错误