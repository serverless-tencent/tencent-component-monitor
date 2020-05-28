const utils = require('../../utils')

function wrapEmitWithTransaction(agent, emit) {
  const { transaction } = agent

  return function wrappedHandler(evnt, request, response) {
    transaction.init()

    function instrumentedFinish() {
      response.removeListener('finish', instrumentedFinish)
      request.removeListener('aborted', instrumentedFinish)

      // 状态码
      if (response.statusCode != null) {
        const statusCode = String(response.statusCode)
        const path = transaction.path || request.path
        if (/^\d+$/.test(statusCode)) {
          const context = request.__SLS_CONTEXT__
          const latency = Date.now() - transaction.start
          const data = {
            latency,
            path,
            method: request.method,
            statusCode
          }
          agent.emit('responseFinish', context, data, request.__SLS_NO_REPORT__)
        }
      }
      transaction.end()
    }
    // response结束时上报状态码和耗时
    response.once('finish', instrumentedFinish)
    request.once('aborted', instrumentedFinish)

    return emit.apply(this, arguments)
  }
}

module.exports = function initialize(agent, http) {
  if (!http) {
    return false
  }

  utils.wrapMethod(http.Server && http.Server.prototype, 'emit', function wrapEmit(emit) {
    var txStarter = wrapEmitWithTransaction(agent, emit)
    return function wrappedEmit(evnt) {
      // 针对request事件做特殊逻辑
      if (evnt === 'request') {
        return txStarter.apply(this, arguments)
      }
      return emit.apply(this, arguments)
    }
  })
}
