const { request } = require('undici')
const { hrtime } = require('process')

import 'dotenv/config'

import { InfluxDB, Point } from '@influxdata/influxdb-client'
export const influxClient = new InfluxDB({ url: `${process.env.INFLUX_URL}`, token: `${process.env.INFLUX_TOKEN}` })
export const writeAPI = influxClient.getWriteApi("pocket", "rpcBenchmark")

const PAUSE = 2000 // milliseconds

async function main() {
  console.log("-------------------")
  benchmark('Pocket Network', 'eth_blockNumber', process.env.POCKET_URL)
  benchmark('Infura', 'eth_blockNumber', process.env.INFURA_URL)
  benchmark('Alchemy', 'eth_blockNumber', process.env.ALCHEMY_URL)
  writeAPI.flush()
  setTimeout(main, PAUSE)
}

async function benchmark(provider: string, method: string, requestURL: string | undefined) {

  if (!requestURL) {
    throw new Error(`${provider} URL not defined`)
  }

  const requestData = {
    jsonrpc: "2.0",
    method,
    params: [],
    id: "1"
  }

  const requestOptions = {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(requestData)
  }

  const start = hrtime.bigint();
  const { body, statusCode } = await request(requestURL, requestOptions)
  const end = hrtime.bigint();
  
  const json = await body.json()
  // console.log(statusCode, json)

  if (statusCode === 200) {
    const elapsedTime = BigInt(Math.round(Number(end - start) / 1000000))
    if (provider === 'Pocket Network') {
      console.log('\x1b[1m%s\x1b[0m', `${provider} ${method} ${elapsedTime} ms`)
    } else {
      console.log('\x1b[2m%s\x1b[0m', `${provider} ${method} ${elapsedTime} ms`)
    }

    const point = new Point('relay')
      .tag('provider', provider)
      .tag('method', method)
      .intField('elapsedTime', elapsedTime)
      .timestamp(new Date())

    writeAPI.writePoint(point)
  }
}

setTimeout(main, PAUSE)