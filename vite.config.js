// External dependency resolution lets the worker build without creating repository node_modules.
// Ordinary npm ci / npm run build needs no environment setting.
const modules = process.env.NIGHT_CANVAS_MODULES;
export default {
  base: "./",
  resolve: modules
    ? {
        alias: [
          { find: /^react-dom(\/.*)?$/, replacement: `${modules}/react-dom$1` },
          { find: /^react(\/.*)?$/, replacement: `${modules}/react$1` },
        ],
      }
    : undefined,
  build: { target: "es2022", assetsInlineLimit: 4096 },
};
