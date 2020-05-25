const { Capi } = require('@tencent-sdk/capi')
// const logger = require('./logger')

// 字符串转16进制
function str2hex(str) {
  if (str === '') {
    return ''
  }
  const arr = []
  for (let i = 0; i < str.length; i++) {
    arr.push(str.charCodeAt(i).toString(16))
  }
  return arr.join('')
}

exports.reportHttp = async function(context, { latency, method, path, statusCode }) {
  try {
    // 自定级监控上报的指标名只支持【a-zA-Z0-9_-】，所以把path进行转义上报
    path = str2hex(path)
    const ServiceType = 'monitor'
    const {
      tencentcloud_region,
      function_name: FunctionName,
      function_version: Version = '$latest',
      namespace: Namespace = 'default'
    } = context
    const environment = JSON.parse(context.environment || '{}')
    const {
      TENCENTCLOUD_SECRETID: SecretId,
      TENCENTCLOUD_SECRETKEY: SecretKey,
      TENCENTCLOUD_SESSIONTOKEN: Token,
      TENCENTCLOUD_REGION: envTencentRegion,
      REGION: envRegion
    } = environment
    const Region = tencentcloud_region || envTencentRegion || envRegion || 'ap-guangzhou'
    if (!SecretId || !SecretKey) {
      // logger.warn('Report monitor data error: No SecretId or SecretKey in environment parameters.')
      return
    }
    const client = new Capi({
      Region,
      SecretId,
      SecretKey,
      Token,
      ServiceType
    })
    const commonParams = {
      Version: '2018-07-24',
      AnnounceInstance: `${Namespace}|${FunctionName}|${Version}`
    }
    const debugOptions = {
      debug: false,
      host: 'monitor.tencentcloudapi.com',
      timeout: 100
    }

    const keyPrefix = `${method}_${path}`
    const Metrics = [
      { MetricName: 'request', Value: 1 },
      { MetricName: keyPrefix, Value: 1 },
      { MetricName: 'latency', Value: latency },
      { MetricName: keyPrefix + '_latency', Value: latency },
      { MetricName: keyPrefix + '_' + statusCode, Value: 1 }
    ]
    if (statusCode.startsWith('4')) {
      Metrics.push({ MetricName: '4xx', Value: 1 })
      Metrics.push({ MetricName: 'error', Value: 1 })
    } else if (statusCode.startsWith('5')) {
      Metrics.push({ MetricName: '5xx', Value: 1 })
      Metrics.push({ MetricName: 'error', Value: 1 })
    }

    return client.request(
      {
        Action: 'PutMonitorData',
        Metrics,
        ...commonParams
      },
      debugOptions,
      true
    )
  } catch (e) {}
}
