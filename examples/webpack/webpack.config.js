import CopyPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";

export default {
    entry: "./src/main.ts",
    module: {
        rules: [{ test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ }],
    },
    resolve: { extensions: [".ts", ".js"] },
    output: { clean: true },
    plugins: [
        new HtmlWebpackPlugin({ template: "src/index.html" }),
        new CopyPlugin({ patterns: [{ from: "public" }] }),
    ],
    // The engine's binary, which webpack emits from its `new URL(…, import.meta.url)`,
    // is far over webpack's size hints.
    performance: { hints: false },
};
