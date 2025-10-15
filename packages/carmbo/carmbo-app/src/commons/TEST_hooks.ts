import {requestContext} from '@fastify/request-context'

export type TEST_HookFunction = (...args: unknown[]) => Promise<void>

export async function TEST_executeHook(name: string, ...args: unknown[]) {
  const hook = requestContext.get('TEST_hooks')?.[name]

  if (hook) {
    await hook(...args)
  }
}

export function resetHooks() {
  const hooks = requestContext.get('TEST_hooks')

  if (!hooks) {
    return
  }

  for (const hook of Object.keys(hooks)) {
    delete hooks[hook]
  }
}
