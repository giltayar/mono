export type BannerType = 'error' | 'info'

export type Banner = {
  message: string
  type: BannerType
  disappearing: boolean
}

export function exceptionToBanner(prefix: string, error: any): Banner | undefined {
  if (!error) {
    return undefined
  }

  return {
    message: `${prefix}${error.message ?? JSON.stringify(error)}`,
    type: 'error',
    disappearing: false,
  }
}
