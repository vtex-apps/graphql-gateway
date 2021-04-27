import { VBase } from '@vtex/api'
import parse from 'co-body'
import fetch from 'isomorphic-unfetch'
import atob from 'atob'

interface PersistedQuery extends Query {
  extensions: {
    persistedQuery: {
      version: string
      sha256Hash: string
      storage: string
    }
  }
}

const BUCKET = 'persistedQueries'

const saveAsync = async (persisted: Record<string, string>, vbase: VBase) => {
  for (const hash of Object.keys(persisted)) {
    // eslint-disable-next-line no-await-in-loop
    await vbase.saveJSON(BUCKET, hash, persisted[hash]).catch(console.error)
  }
}

const isPersistedQuery = (query: any): query is PersistedQuery =>
  !!query.extensions

const parseString = (x: unknown) => {
  if (typeof x !== 'string') {
    return x
  }

  if (x === 'undefined') {
    return undefined
  }

  return JSON.parse(x)
}

const parseVariables = (x: unknown) => {
  if (typeof x !== 'string') {
    return x
  }

  if (x === 'undefined') {
    return undefined
  }

  try {
    return JSON.parse(atob(x))
  } catch (err) {
    return JSON.parse(x)
  }
}

export default async function extract(ctx: Context, next: () => Promise<void>) {
  const {
    vtex: { authToken, logger },
    clients: { vbase },
  } = ctx

  const rawQuery =
    ctx.request.method === 'POST' ? await parse.json(ctx) : ctx.request.query

  const query = {
    query: rawQuery.query,
    operationName: rawQuery.operationName,
    variables: parseVariables(rawQuery.variables),
    extensions: parseString(rawQuery.extensions),
  }

  // We have a persisted query in here. We need to translate it to a query
  // so graphql can understand and run it
  if (isPersistedQuery(query)) {
    const {
      extensions: {
        persistedQuery: { sha256Hash },
      },
    } = query

    const maybeQuery = await vbase.getJSON<string>(BUCKET, sha256Hash, true)

    // Query is already in our local storage. Just translate i
    if (maybeQuery) {
      query.query = maybeQuery
    }
    // Query is somewhere else. We need to fetch it and than try to translate it
    else {
      const storageHost = ctx.get('x-vtex-graphql-referer')
      const url = `http://${storageHost}/page-data/_graphql/persisted.graphql.json`

      // fetch persisted.json from remote
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-vtex-proxy-to': `https://${storageHost}`,
          accept: 'application/json; charset=utf-8',
          'Proxy-Authorization': authToken,
          'accept-encoding': 'gzip',
          // Cookie used to AB-test FastStore stores
          cookie: 'VtexStoreVersion=v2;',
        },
      })

      const responseText = await response.text()

      try {
        const persisted = JSON.parse(responseText)

        if (!persisted?.[sha256Hash]) {
          throw new Error(`URL ${url} does not contains hash ${sha256Hash}`)
        }

        // update local storage
        saveAsync(persisted, vbase).catch(console.error)

        // set query and continue
        query.query = persisted[sha256Hash]
      } catch (err) {
        logger.error({
          url,
          response: responseText.slice(0, 300),
          headers: response.headers,
        })
        throw err
      }
    }

    // Delete extensions so apollo does not try to parse the persisted query again
    delete query.extensions
  }

  ctx.state.query = query

  await next()
}
