# tencent-component-monitor

[![npm](https://img.shields.io/npm/v/tencent-component-monitor)](http://www.npmtrends.com/tencent-component-monitor)
[![NPM downloads](http://img.shields.io/npm/dm/tencent-component-monitor.svg?style=flat-square)](http://www.npmtrends.com/tencent-component-monitor)
[![Build Status](https://travis-ci.com/serverless-tencent/tencent-component-monitor.svg?branch=master)](https://travis-ci.com/serverless-tencent/tencent-component-monitor)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Tencent component monitor.

## Usage

如果组件需要支持自定义监控数据上报，需在 component 的\_shims 下安装 tencent-component-monitor

```bash
$ npm install tencent-component-monitor --save
```

并在 handler.js 文件里面，在所有引用的最前面引入 monitor

```bash
require('tencent-component-monitor')
```

## License

MIT License
