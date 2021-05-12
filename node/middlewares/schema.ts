import { mergeSchemas } from '@graphql-tools/merge'
import {
  FilterRootFields,
  FilterTypes,
  introspectSchema,
  RenameTypes,
  wrapSchema,
} from '@graphql-tools/wrap'
import { GraphQLSchema } from 'graphql'

import { NamespaceUnderFieldTransform } from '../transformers/namespaceUnderField'
import { executor as getExecutorForApp } from '../utils/executor'

let globalSchema: GraphQLSchema | null = null

const typeName = 'VTEX'
const fieldName = 'vtex'

const apps = [
  {
    app: 'vtex.recommendation-resolver@0.x',
    executor: getExecutorForApp,
    transforms: [
      new FilterTypes(
        type => !['Product', 'SKU', 'Seller', 'Offer'].includes(type.name)
      ),
      new RenameTypes(name => `${typeName}_RecommendationResolver_${name}`),
      new NamespaceUnderFieldTransform(typeName, fieldName),
    ],
  },
  {
    app: 'vtex.search-resolver@1.x',
    executor: getExecutorForApp,
    transforms: [
      new FilterTypes(
        type => !['Recommendation'].includes(type.name)
      ),
      new RenameTypes(name => `${typeName}_SearchResolver_ ${name}`),
      new NamespaceUnderFieldTransform(typeName, fieldName),
    ],
  },
  {
    app: 'vtex.checkout-graphql@0.x',
    executor: getExecutorForApp,
    transforms: [
      new RenameTypes(name => `${typeName}_CheckoutGraphql_${name}`),
      new NamespaceUnderFieldTransform(typeName, fieldName),
    ],
  },
  {
    app: 'vtex.admin-cms-graphql@0.x',
    executor: (app: string) =>
      getExecutorForApp(app, ({ vtex: { authToken } }: Context) => ({
        headers: {
          // Add this App's authToken so we have permission to read from Dynamic Storage without the need of the user passing a token
          // This should be safe since we are only exposing the `pages` query, that should not export any sensitive data
          cookie: `VtexIdclientAutCookie=${authToken}`,
        },
      })),
    transforms: [
      new FilterRootFields(
        (operation, rootField) => operation === 'Query' && rootField === 'pages'
      ),
      new NamespaceUnderFieldTransform(typeName, fieldName),
    ],
  },
]

export default async function schema(ctx: Context, next: () => Promise<void>) {
  if (!globalSchema) {
    const schemas = await Promise.all(
      apps.map(async ({ app, executor, transforms }) => {
        const exe = executor(app)

        return wrapSchema(
          {
            schema: await introspectSchema(exe, ctx),
            executor: exe,
          },
          transforms
        )
      })
    )

    globalSchema = mergeSchemas({ schemas })
  }

  ctx.state.schema = globalSchema

  await next()
}
