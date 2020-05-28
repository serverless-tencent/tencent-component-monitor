const utils = require('../utils')
const report = require('../report')

module.exports = function initialize(agent, httpProxy) {
  utils.wrapMethod(httpProxy, 'proxy', function wrapRoute(fn) {
    return function() {
      const { transaction } = agent
      transaction.init()
      const proxy = fn.apply(this, arguments)
      return new Promise(function(resolve) {
        agent.once('responseFinish', function(ctx, data, noReport) {
          if (ctx && noReport !== true) {
            report.reportHttp(ctx, data).then(
              function(/* _data*/) {
                // const { Response } = _data || {}
                // const { Error: error } = Response || {}
                // if (error && error.Message) {
                //   console.warn('Report monitor data error: ' + error.Message)
                // }
                resolve(proxy)
              },
              function() {
                resolve(proxy)
              }
            )
          } else {
            resolve(proxy)
          }
        })
      })
    }
  })
}
