import { type ComputedRef, computed } from 'vue'
import type { CpNavItem } from '../components/Cp/SidebarNav.vue'

export function useAdminNav(): ComputedRef<CpNavItem[]> {
  const { t } = useI18n()

  return computed(() => [
    { value: 'dashboard', icon: 'i-lucide-layout-dashboard', label: t('cp.adminNav.dashboard') },
    {
      value: 'clients',
      icon: 'i-lucide-users',
      label: t('cp.adminNav.clients'),
      group: t('cp.adminNav.group.revenue'),
    },
    {
      value: 'finance',
      icon: 'i-lucide-receipt',
      label: t('cp.adminNav.finance'),
      group: t('cp.adminNav.group.revenue'),
    },
    {
      value: 'pricing',
      icon: 'i-lucide-tag',
      label: t('cp.adminNav.pricing'),
      group: t('cp.adminNav.group.revenue'),
    },
    {
      value: 'providers',
      icon: 'i-lucide-cloud',
      label: t('cp.adminNav.providers'),
      group: t('cp.adminNav.group.ai'),
    },
    {
      value: 'gateway',
      icon: 'i-lucide-network',
      label: t('cp.adminNav.gateway'),
      group: t('cp.adminNav.group.ai'),
    },
    {
      value: 'platform-ai',
      icon: 'i-lucide-sparkles',
      label: t('cp.adminNav.platformAi'),
      group: t('cp.adminNav.group.ai'),
    },
    {
      value: 'api-keys',
      icon: 'i-lucide-key-round',
      label: t('cp.adminNav.apiKeys'),
      group: t('cp.adminNav.group.product'),
    },
    {
      value: 'mcp',
      icon: 'i-lucide-server',
      label: t('cp.adminNav.mcp'),
      group: t('cp.adminNav.group.product'),
    },
    {
      value: 'agents',
      icon: 'i-lucide-bot',
      label: t('cp.adminNav.agents'),
      group: t('cp.adminNav.group.product'),
    },
    {
      value: 'marketplace',
      icon: 'i-lucide-shopping-bag',
      label: t('cp.adminNav.marketplace'),
      group: t('cp.adminNav.group.product'),
    },
    {
      value: 'security',
      icon: 'i-lucide-triangle-alert',
      label: t('cp.adminNav.security'),
      group: t('cp.adminNav.group.trust'),
    },
    {
      value: 'compliance',
      icon: 'i-lucide-book-copy',
      label: t('cp.adminNav.compliance'),
      group: t('cp.adminNav.group.trust'),
    },
    {
      value: 'support',
      icon: 'i-lucide-life-buoy',
      label: t('cp.adminNav.support'),
      group: t('cp.adminNav.group.trust'),
    },
    {
      value: 'system',
      icon: 'i-lucide-activity',
      label: t('cp.adminNav.system'),
      group: t('cp.adminNav.group.operations'),
    },
    {
      value: 'flags',
      icon: 'i-lucide-flag',
      label: t('cp.adminNav.flags'),
      group: t('cp.adminNav.group.operations'),
    },
    {
      value: 'content',
      icon: 'i-lucide-languages',
      label: t('cp.adminNav.content'),
      group: t('cp.adminNav.group.operations'),
    },
    {
      value: 'internal-team',
      icon: 'i-lucide-user',
      label: t('cp.adminNav.internalTeam'),
      group: t('cp.adminNav.group.operations'),
    },
    {
      value: 'parameters',
      icon: 'i-lucide-settings',
      label: t('cp.adminNav.parameters'),
      group: t('cp.adminNav.group.operations'),
    },
  ])
}
