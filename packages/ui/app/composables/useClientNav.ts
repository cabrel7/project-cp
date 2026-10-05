import { type ComputedRef, computed, type MaybeRef, toValue } from 'vue'
import type { CpNavItem } from '../components/Cp/SidebarNav.vue'
import { useCpMode } from './useCpMode'

export interface UseClientNavOptions {
  pendingApprovals?: MaybeRef<number>
  /** URL (http/https) de la documentation publique. */
  docsUrl?: string
}

export function useClientNav(options?: UseClientNavOptions): ComputedRef<CpNavItem[]> {
  const { technicalMode } = useCpMode()
  const { t } = useI18n()

  return computed(() => {
    const tech = technicalMode.value
    const approvalsBadge = options?.pendingApprovals ? toValue(options.pendingApprovals) : undefined

    return [
      { value: 'home', icon: 'i-lucide-house', label: t('cp.nav.home') },
      { value: 'chat', icon: 'i-lucide-message-circle', label: t('cp.nav.chat') },
      {
        value: 'approvals',
        icon: 'i-lucide-shield-check',
        label: tech ? t('cp.nav.approvals.technical') : t('cp.nav.approvals.simple'),
        badge: approvalsBadge,
      },
      {
        value: 'mcp-servers',
        icon: 'i-lucide-server',
        label: tech ? t('cp.nav.mcpServers.technical') : t('cp.nav.mcpServers.simple'),
        group: t('cp.nav.group.build'),
      },
      {
        value: 'connectors',
        icon: 'i-lucide-plug',
        label: tech ? t('cp.nav.connectors.technical') : t('cp.nav.connectors.simple'),
        group: t('cp.nav.group.build'),
      },
      {
        value: 'agents',
        icon: 'i-lucide-bot',
        label: tech ? t('cp.nav.agents.technical') : t('cp.nav.agents.simple'),
        group: t('cp.nav.group.build'),
      },
      {
        value: 'capabilities',
        icon: 'i-lucide-sparkles',
        label: tech ? t('cp.nav.capabilities.technical') : t('cp.nav.capabilities.simple'),
        group: t('cp.nav.group.build'),
      },
      {
        value: 'marketplace',
        icon: 'i-lucide-shopping-bag',
        label: t('cp.nav.marketplace'),
        group: t('cp.nav.group.build'),
      },
      {
        value: 'activity',
        icon: 'i-lucide-play',
        label: tech ? t('cp.nav.activity.technical') : t('cp.nav.activity.simple'),
        group: t('cp.nav.group.track'),
      },
      {
        value: 'usage',
        icon: 'i-lucide-bar-chart-3',
        label: tech ? t('cp.nav.usage.technical') : t('cp.nav.usage.simple'),
        group: t('cp.nav.group.track'),
      },
      {
        value: 'api-keys',
        icon: 'i-lucide-key-round',
        label: tech ? t('cp.nav.apiKeys.technical') : t('cp.nav.apiKeys.simple'),
        group: t('cp.nav.group.developers'),
      },
      {
        value: 'webhooks',
        icon: 'i-lucide-zap',
        label: t('cp.nav.webhooks'),
        group: t('cp.nav.group.developers'),
      },
      {
        value: 'environments',
        icon: 'i-lucide-layers',
        label: tech ? t('cp.nav.environments.technical') : t('cp.nav.environments.simple'),
        group: t('cp.nav.group.developers'),
      },
      {
        value: 'documentation',
        icon: 'i-lucide-book-open',
        label: t('cp.nav.documentation'),
        group: t('cp.nav.group.developers'),
        external: true,
        href: options?.docsUrl,
      },
      {
        value: 'team',
        icon: 'i-lucide-users',
        label: tech ? t('cp.nav.team.technical') : t('cp.nav.team.simple'),
        group: t('cp.nav.group.organization'),
      },
      {
        value: 'billing',
        icon: 'i-lucide-coins',
        label: t('cp.nav.billing'),
        group: t('cp.nav.group.organization'),
      },
      {
        value: 'budgets',
        icon: 'i-lucide-gauge',
        label: t('cp.nav.budgets'),
        group: t('cp.nav.group.organization'),
      },
      {
        value: 'security',
        icon: 'i-lucide-lock',
        label: tech ? t('cp.nav.security.technical') : t('cp.nav.security.simple'),
        group: t('cp.nav.group.organization'),
      },
      {
        value: 'settings',
        icon: 'i-lucide-settings',
        label: t('cp.nav.settings'),
        group: t('cp.nav.group.organization'),
      },
    ]
  })
}
