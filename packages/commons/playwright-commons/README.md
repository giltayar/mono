# `@giltayar/playwright-commons`

Shared helpers for Playwright tests.

```ts
import {waitForHtmx} from '@giltayar/playwright-commons'

await waitForHtmx(page, () => page.getByRole('button', {name: 'Save'}).click())
```
