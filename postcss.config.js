export default {
  plugins: {
    // Tailwind v4 的 PostCSS 插件已内置 autoprefixer 与自动内容检测，
    // 因此不再需要单独的 autoprefixer 插件与 tailwind.config.js。
    '@tailwindcss/postcss': {},
  },
}
