import { LINKED, MAX_AGE } from '@vtex/api'
import { runHttpQuery } from 'apollo-server-core'
import NoIntrospection from 'graphql-disable-introspection'

export default async function run(ctx: Context, next: () => Promise<void>) {
  const {
    state: { query, schema },
    request: { method },
    request,
  } = ctx

  const { graphqlResponse, responseInit } = await runHttpQuery([], {
    method,
    options: {
      cacheControl: {
        calculateHttpHeaders: true,
        defaultMaxAge: MAX_AGE.LONG,
      },
      context: ctx,
      debug: LINKED,
      schema,
      schemaHash: '' as any,
      tracing: false,
      validationRules: [NoIntrospection]
    },
    query,
    request,
  })

  ctx.body = graphqlResponse
  ctx.state.responseInit = responseInit

  await next()
}
