import { parse } from 'cookie'

export const parseCookie = (cookie: string, host: string) => {
  const parsed = parse(cookie)
  const cookieName = Object.keys(parsed)[0] as string
  const cookieValue = parsed[cookieName]

  const extraOptions = {
    path: parsed.path,
    domain: parsed.domain ?? host,
    expires: parsed.expires ? new Date(parsed.expires) : undefined,
  }

  return {
    name: cookieName,
    value: cookieValue,
    options: extraOptions,
  }
}

export const CHECKOUT_COOKIE = 'checkout.vtex.com'

const SetCookieAllowlist = [CHECKOUT_COOKIE, '.ASPXAUTH']

const isAllowedSetCookie = (cookie: string) => {
  const [key] = cookie.split('=')

  return SetCookieAllowlist.includes(key)
}

const replaceDomain = (host: string, cookie: string) =>
  cookie.replace(/domain=.+?(;|$)/, `domain=${host};`)

export function forwardAllowedCookies(rawHeaders: Headers, ctx: Context) {
  const responseSetCookies: string[] = (rawHeaders as any).raw()['set-cookie']

  const host = ctx.get('x-forwarded-host')
  const forwardedSetCookies = responseSetCookies.filter(isAllowedSetCookie)

  const cleanCookies = forwardedSetCookies.map((cookie: string) =>
    parseCookie(replaceDomain(host, cookie), host)
  )

  cleanCookies.forEach(({ name, value, options }) => {
    ctx.cookies.set(name, value, options)
  })
}
