let prelinePromise = null

export async function initPreline() {
  if (!prelinePromise) {
    prelinePromise = import('preline/dist/index.js')
  }

  await prelinePromise

  if (window.HSStaticMethods?.autoInit) {
    window.HSStaticMethods.autoInit()
  }
}
