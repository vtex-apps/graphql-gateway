import { mergeSchemas } from '@graphql-tools/merge'
import {
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
    app: 'vtex.search-resolver@1.x',
    executor: getExecutorForApp,
    transforms: [
      new RenameTypes(name => `${typeName}_${name}`),
      new NamespaceUnderFieldTransform(typeName, fieldName),
    ],
  },
  {
    app: 'vtex.checkout-graphql@0.x',
    executor: getExecutorForApp,
    transforms: [
      new RenameTypes(name => `${typeName}_${name}`),
      new NamespaceUnderFieldTransform(typeName, fieldName),
    ],
  }
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
