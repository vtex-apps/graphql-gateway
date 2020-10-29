import crypto from 'crypto'

export const md5 = (data: string) =>
  crypto
    .createHash('md5')
    .update(data)
    .digest('hex')
