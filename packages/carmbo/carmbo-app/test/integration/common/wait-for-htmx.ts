import type {Page} from '@playwright/test'

export async function waitForHtmx<T>(page: Page, f: () => Promise<T>): Promise<T> {
  try {
    await page.evaluate(() =>
      window.addEventListener(
        'htmx:afterSettle',
        () =>
          //@ts-expect-error
          (window.TEST_isHtmxSettled = true),
        {once: true},
      ),
    )
    const ret = await f()

    await page.waitForFunction(
      () =>
        //@ts-expect-error
        window.TEST_isHtmxSettled === true,
    )
    await page.evaluate(
      () =>
        //@ts-expect-error
        delete window.TEST_isHtmxSettled,
    )

    return ret
  } finally {
  }
}
