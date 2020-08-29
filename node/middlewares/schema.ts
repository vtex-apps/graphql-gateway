import { introspectSchema, wrapSchema, RenameTypes } from '@graphql-tools/wrap'
import { AsyncExecutor } from '@graphql-tools/delegate'
import { mergeSchemas } from '@graphql-tools/merge'
import { parseAppId, versionToMajor } from '@vtex/api'
import { GraphQLSchema, print } from 'graphql'
import fetch from 'isomorphic-unfetch'

import { NamespaceUnderFieldTransform } from '../transformers/namespaceUnderField'
import { forwardAllowedCookies } from '../utils/cookie'

let globalSchema: GraphQLSchema | null = null

const apps = ['vtex.search-resolver@0.x', 'vtex.checkout-graphql@0.x']

const typeName = 'VTEX'
const fieldName = 'vtex'

const executor = (
  app: string,
  { shouldForwardCookie = false } = {}
): AsyncExecutor => async ({ document, variables, context }) => {
  const ctx = (context as unknown) as Context

  const {
    vtex: { account, workspace, authToken },
    request: { headers },
  } = ctx

  const { name, version } = parseAppId(app)
  const major = versionToMajor(version)
  const query = print(document)

  const fetchResult = await fetch(
    `http://app.io.vtex.com/${name}/v${major}/${account}/${workspace}/_v/graphql`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
        cookie: headers.cookie,
        'x-vtex-locale': 'en-US',
        'x-vtex-tenant': 'en-US',
      },
      body: JSON.stringify({ query, variables }),
    }
  )

  if (shouldForwardCookie) {
    forwardAllowedCookies(fetchResult.headers, ctx)
  }

  return fetchResult.json()
}

export default async function schema(ctx: Context, next: () => Promise<void>) {
  if (!globalSchema) {
    const schemas = await Promise.all(
      apps.map(async app =>
        wrapSchema(
          {
            schema: await introspectSchema(executor(app), ctx),
            executor: executor(app, { shouldForwardCookie: true }),
          },
          [
            new RenameTypes(name => `${typeName}_${name}`),
            new NamespaceUnderFieldTransform(typeName, fieldName),
          ]
        )
      )
    )

    globalSchema = mergeSchemas({ schemas })
  }

  ctx.state.schema = globalSchema

  await next()
}
