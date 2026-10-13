// État du réseau du navigateur (hors ligne = actions réseau désactivées avec explication). Faux côté serveur : sans effet.
export function useOnlineStatus() {
  const isOnline = ref(true)
  const sync = () => {
    isOnline.value = navigator.onLine
  }
  onMounted(() => {
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', sync)
    window.removeEventListener('offline', sync)
  })
  return isOnline
}
