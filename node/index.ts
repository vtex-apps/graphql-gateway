import './global'

import { method, Service } from '@vtex/api'

import run from './middlewares/run'
import error from './middlewares/error'
import schema from './middlewares/schema'
import extract from './middlewares/extract'
import headers from './middlewares/headers'

export default new Service({
  routes: {
    graphql: method({
      GET: [error, headers, extract, schema, run],
      POST: [error, headers, extract, schema, run],
    }),
  },
})
