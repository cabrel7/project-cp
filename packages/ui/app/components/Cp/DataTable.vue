<script setup lang="ts">
// Base du gabarit Liste : UTable + états chargement / vide. Tri local sur les colonnes `sortable`.
// Personnalisation d'une cellule : slot `cell-<key>` (reçoit `row`).
import CpEmptyState from './EmptyState.vue'
import CpSkeleton from './Skeleton.vue'

export interface CpDataTableColumn {
  key: string
  label: string
  sortable?: boolean
}

export type CpDataTableRow = Record<string, unknown>

const props = defineProps<{
  columns: CpDataTableColumn[]
  rows: CpDataTableRow[]
  loading?: boolean
  emptyText?: string
}>()

const { t } = useI18n()

const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

const tableColumns = computed(() =>
  props.columns.map((c) => ({ accessorKey: c.key, header: c.label })),
)

const sortedRows = computed(() => {
  const key = sortKey.value
  if (!key) return props.rows
  const factor = sortDir.value === 'asc' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const left = a[key]
    const right = b[key]
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor
    return String(left ?? '').localeCompare(String(right ?? '')) * factor
  })
})

function ariaSort(key: string): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 'asc' ? 'ascending' : 'descending'
}

function sortIcon(key: string): string {
  if (sortKey.value !== key) return 'i-lucide-arrow-up-down'
  return sortDir.value === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
}

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function cellValue(row: CpDataTableRow, key: string): string {
  const value = row[key]
  return value === null || value === undefined ? '' : String(value)
}
</script>

<template>
  <div class="rounded-lg border border-cp-line bg-cp-surface shadow-sm" data-cp-table>
    <div v-if="loading" class="p-4" :aria-label="t('cp.table.loading')">
      <CpSkeleton shape="line" :count="5" />
    </div>
    <CpEmptyState v-else-if="rows.length === 0" :title="emptyText ?? t('cp.table.empty')" />
    <UTable v-else :data="sortedRows" :columns="tableColumns" class="text-body-sm text-cp-ink">
      <template v-for="column in columns" :key="`${column.key}-header`" #[`${column.key}-header`]>
        <button
          v-if="column.sortable"
          type="button"
          class="flex items-center gap-1 text-label text-cp-ink"
          :data-sort="column.key"
          :aria-sort="ariaSort(column.key)"
          @click="toggleSort(column.key)"
        >
          {{ column.label }}
          <UIcon :name="sortIcon(column.key)" class="size-4 text-cp-ink-muted" aria-hidden="true" />
        </button>
        <span v-else class="text-label text-cp-ink">{{ column.label }}</span>
      </template>
      <template v-for="column in columns" :key="`${column.key}-cell`" #[`${column.key}-cell`]="{ row }">
        <slot :name="`cell-${column.key}`" :row="row.original">
          {{ cellValue(row.original, column.key) }}
        </slot>
      </template>
    </UTable>
  </div>
</template>
