import './global'

import { Cached, LRUCache, method, Service } from '@vtex/api'

import run from './middlewares/run'
import error from './middlewares/error'
import schema from './middlewares/schema'
import extract from './middlewares/extract'
import headers from './middlewares/headers'

const vbaseCacheStorage = new LRUCache<string, Cached>({
  max: 1e3,
})

metrics.trackCache('vbase', vbaseCacheStorage)

export default new Service({
  clients: {
    options: {
      vbase: {
        concurrency: 3,
        memoryCache: vbaseCacheStorage,
        retries: 1,
        timeout: 1500,
      },
    },
  },
  routes: {
    graphql: method({
      GET: [error, headers, extract, schema, run],
      POST: [error, headers, extract, schema, run],
    }),
  },
})
