export interface AutomaticLoginOptions {
  isDisabled: () => boolean
  login: () => Promise<unknown>
}

export function createAutomaticLoginAttempt(options: AutomaticLoginOptions): () => Promise<boolean> {
  let attempted = false

  return async function attemptAutomaticLogin() {
    if (attempted || options.isDisabled())
      return false
    attempted = true
    try {
      await options.login()
      return true
    }
    catch {
      return false
    }
  }
}
