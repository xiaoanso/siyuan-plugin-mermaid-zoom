require("dotenv").config();

const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const { EsbuildPlugin } = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (env, argv) => {
  const isPro = argv.mode === "production";
  
  // 读取环境变量
  const pluginInfo = JSON.parse(fs.readFileSync("plugin.json", "utf-8"));
  const siyuanWorkspacePath = process.env.SIYUAN_WORKSPACE_PATH;
  
  // 开发模式输出目录：优先思源插件目录，否则回退到当前目录
  let outputPath = path.resolve(__dirname);
  if (!isPro && siyuanWorkspacePath) {
    const outputDir = `${siyuanWorkspacePath}/data/plugins/${pluginInfo.name}`;
    outputPath = path.resolve(outputDir);
    console.log(`\n🔄 Dev mode: Watching SiYuan plugin directory`);
    console.log(`   Plugin: ${pluginInfo.name}`);
    console.log(`   Output: ${outputDir}\n`);
  } else if (!isPro) {
    console.log(`\n⚠️  SIYUAN_WORKSPACE_PATH not set. Using local directory.`);
    console.log(`   Set SIYUAN_WORKSPACE_PATH in .env for hot-reload.\n`);
  }
  
  const plugins = [
    new MiniCssExtractPlugin({
      filename: isPro ? "dist/index.css" : "index.css",
    }),
  ];
  let entry = {
    index: "./src/index.ts",
  };
  if (isPro) {
    entry = {
      "dist/index": "./src/index.ts",
    };
    plugins.push(
      new webpack.BannerPlugin({
        banner: () => {
          return fs.readFileSync("LICENSE").toString();
        },
      })
    );
    plugins.push(
      new CopyPlugin({
        patterns: [
          { from: "preview.png", to: "./dist/" },
          { from: "icon.png", to: "./dist/" },
          { from: "README*.md", to: "./dist/" },
          { from: "plugin.json", to: "./dist/" },
          // Copy i18n source files into the distribution so runtime can load localized strings
          { from: "src/i18n/", to: "./dist/i18n/" },
        ],
      })
    );
    plugins.push(
      new ZipPlugin({
        filename: "package.zip",
        algorithm: "gzip",
        include: [/dist/],
        pathMapper: (assetPath) => {
          return assetPath.replace("dist/", "");
        },
      })
    );
  } else {
    // 开发模式：复制静态文件到思源插件目录（不需要i18n，使用this.i18n）
    plugins.push(
      new CopyPlugin({
        patterns: [
          { from: "preview.png", to: "./" },
          { from: "icon.png", to: "./" },
          { from: "README*.md", to: "./" },
          { from: "plugin.json", to: "./" },
          // 在开发模式也复制 i18n 文件，以便输出目录中包含本地化资源
          { from: "src/i18n/", to: "./i18n/" },
        ],
      })
    );
  }
  return {
    mode: argv.mode || "development",
    watch: !isPro,
    watchOptions: {
      ignored: /node_modules/,
      aggregateTimeout: 300,
    },
    devtool: isPro ? false : "eval",
    output: {
      filename: "[name].js",
      path: outputPath,
      libraryTarget: "commonjs2",
      library: {
        type: "commonjs2",
      },
    },
    externals: {
      siyuan: "siyuan",
    },
    entry,
    optimization: {
      minimize: true,
      minimizer: [new EsbuildPlugin()],
    },
    resolve: {
      extensions: [".ts", ".scss", ".js", ".json"],
    },
    module: {
      rules: [
        {
          test: /\.ts(x?)$/,
          include: [path.resolve(__dirname, "src")],
          use: [
            {
              loader: "esbuild-loader",
              options: {
                target: "es6",
              },
            },
          ],
        },
        {
          test: /\.scss$/,
          include: [path.resolve(__dirname, "src")],
          use: [
            MiniCssExtractPlugin.loader,
            { loader: "css-loader" },
            { loader: "sass-loader" },
          ],
        },
      ],
    },
    plugins,
  };
};