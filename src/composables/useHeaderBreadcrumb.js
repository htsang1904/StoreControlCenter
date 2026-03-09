import { ref } from 'vue'

const breadcrumbLabel = ref('')

export function useHeaderBreadcrumb() {
  function setBreadcrumbLabel(label = '') {
    breadcrumbLabel.value = String(label || '').trim()
  }

  function clearBreadcrumbLabel() {
    breadcrumbLabel.value = ''
  }

  return {
    breadcrumbLabel,
    setBreadcrumbLabel,
    clearBreadcrumbLabel,
  }
}
