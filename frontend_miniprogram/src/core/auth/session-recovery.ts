export interface SessionRecoverySteps {
  clearSession: () => void
  resetToVisitor: () => void
  tryAutomaticLogin: () => Promise<boolean>
  refreshAuthenticatedContext: () => Promise<void>
}

/** 恢复中先撤下旧身份，再通过已认证上下文确认新身份。 */
export async function recoverAuthenticatedSession(steps: SessionRecoverySteps): Promise<boolean> {
  steps.clearSession()
  steps.resetToVisitor()
  if (!await steps.tryAutomaticLogin())
    return false
  await steps.refreshAuthenticatedContext()
  return true
}
