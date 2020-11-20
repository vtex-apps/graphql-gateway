import { introspectSchema, wrapSchema, RenameTypes } from '@graphql-tools/wrap'
import { AsyncExecutor } from '@graphql-tools/delegate'
import { mergeSchemas } from '@graphql-tools/merge'
import { parseAppId, versionToMajor } from '@vtex/api'
import { GraphQLSchema, print } from 'graphql'
import http from 'axios'

import { NamespaceUnderFieldTransform } from '../transformers/namespaceUnderField'
import { md5 } from '../utils/md5'

let globalSchema: GraphQLSchema | null = null

const apps = ['vtex.search-resolver@1.x', 'vtex.checkout-graphql@0.x']

const typeName = 'VTEX'
const fieldName = 'vtex'

const executor = (app: string): AsyncExecutor => async ({
  document,
  variables,
  context,
}) => {
  const ctx = (context as unknown) as Context
  const {
    vtex: { account, workspace, authToken },
    state,
  } = ctx

  const { name, version } = parseAppId(app)
  const major = versionToMajor(version)
  const query = print(document)
  const data = JSON.stringify({ query, variables })
  const hash = md5(data)
  const method = document.definitions.every((d: any) => d.operation === 'query')
    ? 'GET'
    : 'POST'

  const response = await http.request({
    method,
    url: `http://app.io.vtex.com/${name}/v${major}/${account}/${workspace}/_v/graphql?__graphqlBodyHash=${hash}`,
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authToken,
      'x-forwarded-host': `.${(context as any).get('x-vtex-graphql-referer')}`,
      'x-vtex-locale': 'en-US',
      'x-vtex-tenant': 'en-US',
    },
    data,
  })

  const cacheControl = response.headers['cache-control']
  const setCookie = response.headers['set-cookie']

  if (setCookie) {
    ctx.set('set-cookie', setCookie)
  }

  if (cacheControl) {
    state.cacheControl.push(cacheControl)
  }

  return response.data
}

export default async function schema(ctx: Context, next: () => Promise<void>) {
  if (!globalSchema) {
    const schemas = await Promise.all(
      apps.map(async app => {
        const exe = executor(app)

        return wrapSchema(
          {
            schema: await introspectSchema(exe, ctx),
            executor: exe,
          },
          [
            new RenameTypes(name => `${typeName}_${name}`),
            new NamespaceUnderFieldTransform(typeName, fieldName),
          ]
        )
      })
    )

    globalSchema = mergeSchemas({ schemas })
  }

  ctx.state.schema = globalSchema

  await next()
}
