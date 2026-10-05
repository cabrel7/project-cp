<script setup lang="ts">
// Graphique ECharts (dataviz.md) : séries chart-1…6, un seul axe Y, légende dès 2 séries, infobulle, vue tableau.
// ECharts est chargé à la demande (découpage du bundle) et seulement côté navigateur.
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  buildChartOption,
  type CpChartSeries,
  type CpChartType,
  readChartTokens,
} from '../../utils/cpChart'
import CpEmptyState from './EmptyState.vue'
import CpSkeleton from './Skeleton.vue'

const props = defineProps<{
  type: CpChartType
  series: CpChartSeries[]
  categories: string[]
  unit?: string
  /** Nom accessible du graphique (ex. « Consommation par profil sur 7 jours »). */
  label?: string
  loading?: boolean
}>()

const VChart = defineAsyncComponent(async () => {
  const [core, charts, components, renderers, vchart] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
    import('vue-echarts'),
  ])
  core.use([
    charts.LineChart,
    charts.BarChart,
    components.GridComponent,
    components.TooltipComponent,
    components.LegendComponent,
    components.AriaComponent,
    renderers.CanvasRenderer,
  ])
  return vchart.default
})

const { t, locale } = useI18n()

const mounted = ref(false)
const showTable = ref(false)
// Incrémenté quand le thème clair/sombre change : force la relecture des jetons.
const themeVersion = ref(0)
let observer: MutationObserver | undefined

onMounted(() => {
  mounted.value = true
  observer = new MutationObserver(() => {
    themeVersion.value++
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => observer?.disconnect())

const hasData = computed(
  () => props.series.length > 0 && props.series.some((item) => item.data.length > 0),
)

const option = computed(() => {
  void themeVersion.value
  return buildChartOption({
    type: props.type,
    series: props.series,
    categories: props.categories,
    unit: props.unit,
    tokens: readChartTokens(),
  })
})

const format = (value: number | undefined): string =>
  value === undefined
    ? ''
    : `${new Intl.NumberFormat(locale.value).format(value)}${props.unit ? ` ${props.unit}` : ''}`

const ariaLabel = computed(() => props.label ?? t('cp.chart.chartLabel'))
</script>

<template>
  <div class="flex flex-col gap-3" data-cp-chart :data-type="type">
    <CpSkeleton v-if="loading" shape="card" />
    <CpEmptyState v-else-if="!hasData" icon="i-lucide-chart-column" :title="t('cp.chart.noData')" />
    <template v-else>
      <div class="flex justify-end">
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          :icon="showTable ? 'i-lucide-chart-column' : 'i-lucide-table'"
          :label="showTable ? t('cp.chart.viewChart') : t('cp.chart.viewData')"
          :aria-pressed="showTable"
          data-cp-chart-toggle
          @click="showTable = !showTable"
        />
      </div>

      <div v-if="showTable" class="overflow-x-auto" data-cp-chart-table>
        <table class="w-full text-body-sm">
          <caption class="sr-only">{{ ariaLabel }}</caption>
          <thead>
            <tr class="border-b border-cp-line text-left text-cp-ink-muted">
              <th scope="col" class="py-2 pr-4 font-medium">{{ t('cp.chart.category') }}</th>
              <th v-for="item in series" :key="item.name" scope="col" class="py-2 pr-4 font-medium">
                {{ item.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(category, row) in categories" :key="`${row}-${category}`" class="border-b border-cp-line">
              <th scope="row" class="py-2 pr-4 text-left font-medium text-cp-ink">{{ category }}</th>
              <td v-for="item in series" :key="item.name" class="py-2 pr-4 tabular-nums text-cp-ink">
                {{ format(item.data[row]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="h-72 w-full" role="img" :aria-label="ariaLabel" data-cp-chart-canvas>
        <VChart v-if="mounted" :option="option" autoresize class="size-full" />
      </div>
    </template>
  </div>
</template>
