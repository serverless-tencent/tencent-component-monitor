const path = require('path')
const fs = require('fs')
const utils = require('./utils')
const INSTRUMENTATIONS = require('./instrumentations')()

const { MODULE_TYPE } = require('./constants')

const CORE_INSTRUMENTATION = {
  http: {
    type: MODULE_TYPE.TRANSACTION,
    file: 'http.js'
  },
  https: {
    type: MODULE_TYPE.TRANSACTION,
    file: 'http.js'
  }
}

function _firstPartyInstrumentation(agent, fileName, nodule, moduleName) {
  if (!fs.existsSync(fileName)) {
    return
  }
  try {
    return require(fileName)(agent, nodule, moduleName)
  } catch (error) {
    agent.emit('responseFinish')
  }
}

const shimmer = {
  /**
   * 修改module.load方法，模块加载时可以动态载入补丁以便在某些特定方法中加入指标收集探针
   */
  patchModule: function patchModule(agent) {
    const Module = require('module')
    const filepathMap = {}

    /**
     * Forces file name resolve for modules not in our cache when
     * their parent has already been loaded/cached by Node.
     * Provides a fall-back for unexpected cases that may occur.
     * Also provides flexibilty for testing now that node 11+ caches these.
     * @param {*} request
     * @param {*} parent
     * @param {*} isMain
     */
    function resolveFileName(request, parent, isMain) {
      const cachedPath = filepathMap[request]
      if (!cachedPath && parent && parent.loaded) {
        // Our patched _resolveFilename will cache. No need to here.
        return Module._resolveFilename(request, parent, isMain)
      }

      return cachedPath
    }

    utils.wrapMethod(Module, '_resolveFilename', function wrapRes(resolve) {
      return function wrappedResolveFilename(file) {
        // This is triggered by the load call, so record the path that has been seen so
        // we can examine it after the load call has returned.
        const resolvedFilepath = resolve.apply(this, arguments)
        filepathMap[file] = resolvedFilepath
        return resolvedFilepath
      }
    })

    // Node在模块加载时都会调用到Module的_load方法。
    // 当require一个模块时，程序会根据模块的名字决定加载执行哪一个封装逻辑；如果没有封装逻辑，那么直接执行原模块：
    utils.wrapMethod(Module, '_load', function wrapLoad(load) {
      return function wrappedLoad(request, parent, isMain) {
        // _load() will invoke _resolveFilename() first time resolving a module.
        const m = load.apply(this, arguments)

        const fileName = resolveFileName(request, parent, isMain)
        // eslint-disable-next-line
        return _postLoad(agent, m, request, fileName)
      }
    })
  },

  unpatchModule: function unpatchModule() {
    const Module = require('module')

    utils.unwrapMethod(Module, '_resolveFilename')
    utils.unwrapMethod(Module, '_load')
  },

  bootstrapInstrumentation: function bootstrapInstrumentation(agent) {
    // Instrument each of the core modules.
    Object.keys(CORE_INSTRUMENTATION).forEach(function forEachCore(mojule) {
      const core = CORE_INSTRUMENTATION[mojule]
      const filePath = path.join(__dirname, 'instrumentation', 'core', core.file)
      let uninstrumented = null

      try {
        uninstrumented = require(mojule)
      } catch (err) {}

      _firstPartyInstrumentation(agent, filePath, uninstrumented)
    })

    // 注册所有注入模块
    Object.keys(INSTRUMENTATIONS).forEach(function forEachInstrumentation(moduleName) {
      const instrInfo = INSTRUMENTATIONS[moduleName]

      const fileName = path.join(__dirname, 'instrumentation', moduleName + '.js')
      shimmer.registerInstrumentation({
        moduleName: moduleName,
        type: instrInfo.type,
        onRequire: _firstPartyInstrumentation.bind(null, agent, fileName)
      })
    })
  },

  registerInstrumentation: function registerInstrumentation(opts) {
    shimmer.registeredInstrumentations[opts.moduleName] = opts
  },

  registeredInstrumentations: Object.create(null),

  /**
   * Given a NodeJS module name, return the name/identifier of our
   * instrumentation.  These two things are usually, but not always,
   * the same.
   */
  getInstrumentationNameFromModuleName(moduleName) {
    return moduleName
  }
}

/**
 * 执行模块的onRequire逻辑，实际执行探针的绑定
 */
function instrument(agent, nodule, moduleName) {
  const instrumentation = shimmer.registeredInstrumentations[moduleName]

  // 已经加载过，不重复加载
  if (nodule.hasOwnProperty('__instrumented')) {
    return nodule
  }
  try {
    // onRequire事件是在初始化registeredInstrumentations定义的
    // 加载对应的模块，比如express，把探针绑定上
    if (instrumentation.onRequire(nodule) !== false) {
      nodule.__instrumented = true
    }
  } catch (instrumentationError) {
    agent.emit('responseFinish')
  }

  return nodule
}

function _postLoad(agent, nodule, name, resolvedName) {
  const instrumentation = name

  // 判断是否已经注册探针，如果没有则返回原模块
  if (shimmer.registeredInstrumentations[instrumentation]) {
    return instrument(agent, nodule, instrumentation, resolvedName)
  }

  return nodule
}

module.exports = shimmer
