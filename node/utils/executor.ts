import { AsyncExecutor } from '@graphql-tools/delegate'
import { parseAppId, versionToMajor } from '@vtex/api'
import http from 'axios'
import { print } from 'graphql'

export const executor = (
  app: string,
  axiosOptions?: (ctx: Context) => { headers: Record<string, string> }
): AsyncExecutor => async ({ document, variables, context }) => {
  const ctx = (context as unknown) as Context
  const {
    vtex: { account, workspace, authToken },
    state,
  } = ctx

  const { name, version } = parseAppId(app)
  const major = versionToMajor(version)
  const query = print(document)
  const data = JSON.stringify({ query, variables })

  const options = axiosOptions?.(ctx)

  const response = await http.request({
    method: 'POST',
    url: `http://app.io.vtex.com/${name}/v${major}/${account}/${workspace}/_v/graphql`,
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authToken,
      'x-forwarded-host': (context as any).get('x-vtex-graphql-referer'),
      'x-vtex-locale': 'en-US',
      'x-vtex-tenant': 'en-US',
      ...options?.headers,
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
