/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Webpack config for Adobe I/O Runtime actions only (merged by `aio app build`).
 *
 * Auto-discovered: aio walks up from each action directory until it finds a
 * file matching `*webpack-config.js` / `*webpack-config.cjs`. No reference in
 * app.config.yaml is needed.
 *
 * Must be `.cjs` because integration-test/package.json declares `"type":
 * "module"` — `module.exports` would be a syntax error in a `.js` file.
 *
 * @see https://developer.adobe.com/app-builder/docs/guides/app_builder_guides/configuration/webpack_configuration/
 * @see https://developer.adobe.com/app-builder/docs/guides/app_builder_guides/configuration/typescript-actions
 */

/* eslint-disable no-undef */
module.exports = {
  output: {
    libraryTarget: "commonjs2",
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        loader: "esbuild-loader",
        options: {
          target: "es2020",
        },
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  optimization: {
    minimize: false,
  },
  devtool: false,
  node: {
    global: false,
  },
};
