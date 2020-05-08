const utils = require('../utils')

/**
 * Express middleware generates traces where middleware are considered siblings
 * (ended on 'next' invocation) and not nested. Middlware are nested below the
 * routers they are mounted to.
 */

function wrapRouteMethods(route) {
  const methods = ['all', 'delete', 'get', 'head', 'opts', 'post', 'put', 'patch']
  utils.wrapMethod(route, methods, function(fn) {
    return fn
  })
}

module.exports = function initialize(agent, express) {
  if (!express || !express.Router) {
    return false
  }

  utils.wrapMethod(express.Router, 'route', function wrapRoute(fn) {
    if (!utils.isFunction(fn)) {
      return fn
    }

    return function wrappedRoute() {
      const sourceRoute = fn.apply(this, arguments)
      // Router每次添加一个route，都会把route包装到layer中，并且将layer添加到的stack中
      // 当客户端发送一个http请求后，会先进入express实例对象对应的router.handle函数中，
      // router.handle函数会通过next()遍历stack中的每一个layer进行match，
      // 如果match返回true，则获取layer.route，执行route.dispatch函数，
      // route.dispatch同样是通过next()遍历stack中的每一个layer，
      // 然后执行layer.handle_request，也就是调用中间件函数。直到所有的中间件函数被执行完毕，整个路由处理结束
      if (!utils.isWrapped(sourceRoute, 'get')) {
        wrapRouteMethods(sourceRoute)

        const layer = this.stack[this.stack.length - 1]
        utils.wrapMethod(layer, 'handle', function(func) {
          const { route } = layer
          const { path } = route
          const { transaction } = agent
          transaction.path = path
          return func
        })
      }
      return sourceRoute
    }
  })
}
