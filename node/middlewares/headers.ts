import parse, { CacheControl } from 'cache-control-parser'

const ONE_WEEK_S = 3600 * 24 * 7
const BASE_CACHE_CONTROL = 'private, max-age=0, must-revalidate'

const format = (cacheControl: CacheControl) =>
  [
    cacheControl.isPrivate && 'private',
    cacheControl.isPublic && 'public',
    cacheControl.immutable && 'immutable',
    cacheControl.noCache && 'no-cache',
    cacheControl.noStore && 'no-store',
    cacheControl.mustRevalidate && 'must-revalidate',
    cacheControl.noTransform && 'no-transform',
    cacheControl.proxyRevalidate && 'proxy-revalidate',
    typeof cacheControl.staleIfError === 'number' &&
      `stale-if-error=${cacheControl.staleIfError}`,
    typeof cacheControl.staleWhileRevalidate === 'number' &&
      `stale-if-error=${cacheControl.staleWhileRevalidate}`,
    typeof cacheControl.sharedMaxAge === 'number' &&
      `s-maxage=${cacheControl.sharedMaxAge}`,
    typeof cacheControl.maxAge === 'number' && `max-age=${cacheControl.maxAge}`,
  ]
    .filter(x => !!x)
    .join(', ')

export default async function headers(ctx: Context, next: () => Promise<void>) {
  ctx.state.cacheControl = []

  await next()

  const { headers: responseHeaders } = ctx.state.responseInit

  // Set Apollo computed Headers
  for (const [key, value] of Object.entries(responseHeaders ?? {})) {
    ctx.set(key, value)
  }

  // Set cache control.
  // Apollo cannot compute cache headers correctly, so we use the
  // returned headers from each stitched call to compute an aggregated
  // cache control header
  if (ctx.state.cacheControl.length === 0) {
    ctx.state.cacheControl.push(BASE_CACHE_CONTROL)
  }

  const cacheControl = ctx.state.cacheControl
    .map(parse)
    .reduce((previous, current) => {
      if (previous.noCache || previous.noStore || previous.isPrivate) {
        return previous
      }

      if (
        typeof current.maxAge === 'number' &&
        typeof previous.maxAge === 'number' &&
        current.maxAge > previous.maxAge
      ) {
        return previous
      }

      return current
    })

  if (cacheControl.isPublic && cacheControl.maxAge && cacheControl.maxAge > 0) {
    if (!cacheControl.staleWhileRevalidate) {
      cacheControl.staleWhileRevalidate = ONE_WEEK_S
    }

    if (!cacheControl.staleIfError) {
      cacheControl.staleIfError = ONE_WEEK_S
    }
  }

  ctx.set('cache-control', format(cacheControl))
}
