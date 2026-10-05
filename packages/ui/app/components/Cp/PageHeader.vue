<script setup lang="ts">
// En-tête de page : fil d'Ariane (pages de détail), titre, phrase d'explication, actions à droite.
export interface CpBreadcrumb {
  label: string
  to?: string
}

defineProps<{
  title: string
  description?: string
  breadcrumbs?: CpBreadcrumb[]
}>()

const { t } = useI18n()
</script>

<template>
  <header class="flex flex-col gap-2" data-cp-page-header>
    <nav v-if="breadcrumbs?.length" :aria-label="t('cp.pageHeader.breadcrumb')">
      <ol class="flex flex-wrap items-center gap-1 text-body-sm text-cp-ink-muted">
        <li v-for="(crumb, index) in breadcrumbs" :key="`${index}-${crumb.label}`" class="flex items-center gap-1">
          <NuxtLink v-if="crumb.to" :to="crumb.to" class="text-cp-primary hover:underline">
            {{ crumb.label }}
          </NuxtLink>
          <span v-else :aria-current="index === breadcrumbs.length - 1 ? 'page' : undefined">
            {{ crumb.label }}
          </span>
          <UIcon
            v-if="index < breadcrumbs.length - 1"
            name="i-lucide-chevron-right"
            class="size-4"
            aria-hidden="true"
          />
        </li>
      </ol>
    </nav>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="text-heading-1 text-cp-ink">{{ title }}</h1>
        <p v-if="description" class="text-body text-cp-ink-muted">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-3" data-cp-actions>
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
