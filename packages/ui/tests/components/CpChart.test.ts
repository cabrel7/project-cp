import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Chart from '../../app/components/Cp/Chart.vue'
import { buildChartOption, readChartTokens } from '../../app/utils/cpChart'
import { VChart } from '../stubs'

// happy-dom n'a pas de canvas : vue-echarts et les modules ECharts sont remplacés.
vi.mock('vue-echarts', async () => ({ default: (await import('../stubs')).VChart }))
vi.mock('echarts/core', () => ({ use: vi.fn() }))
vi.mock('echarts/charts', () => ({ LineChart: {}, BarChart: {} }))
vi.mock('echarts/components', () => ({
  GridComponent: {},
  TooltipComponent: {},
  LegendComponent: {},
  AriaComponent: {},
}))
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }))

const props = {
  type: 'bar' as const,
  categories: ['Lun', 'Mar', 'Mer'],
  series: [
    { name: 'Rapide', data: [10, 20, 30] },
    { name: 'Expert', data: [1, 2, 3] },
  ],
  unit: 'cr',
}

const tokens = {
  series: ['#1', '#2', '#3', '#4', '#5', '#6'],
  grid: 'grid',
  ink: 'ink',
  inkMuted: 'muted',
  surface: 'surface',
  line: 'line',
}

describe('CpChart', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style')
    document.documentElement.classList.remove('dark')
  })

  it('charge ECharts à la demande et lui passe l option', async () => {
    const wrapper = mount(Chart, { props })
    await flushPromises()
    const chart = wrapper.findComponent(VChart)
    expect(chart.exists()).toBe(true)
    const option = JSON.parse(chart.attributes('data-option') as string)
    expect(option.series).toHaveLength(2)
    expect(option.xAxis.data).toEqual(props.categories)
  })

  it('graphique annoncé comme image avec un nom accessible', () => {
    const wrapper = mount(Chart, { props: { ...props, label: 'Consommation sur 7 jours' } })
    const canvas = wrapper.get('[data-cp-chart-canvas]')
    expect(canvas.attributes('role')).toBe('img')
    expect(canvas.attributes('aria-label')).toBe('Consommation sur 7 jours')
  })

  it('bascule vers la vue tableau et revient', async () => {
    const wrapper = mount(Chart, { props })
    const toggle = wrapper.get('[data-cp-chart-toggle]')
    expect(toggle.text()).toBe('Voir les données')
    await toggle.trigger('click')
    expect(toggle.text()).toBe('Voir le graphique')
    const rows = wrapper.findAll('[data-cp-chart-table] tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]?.text()).toBe('Lun10 cr1 cr')
    expect(wrapper.findAll('[data-cp-chart-table] thead th').map((h) => h.text())).toEqual([
      'Période',
      'Rapide',
      'Expert',
    ])
    expect(wrapper.find('[data-cp-chart-canvas]').exists()).toBe(false)
    await toggle.trigger('click')
    expect(wrapper.find('[data-cp-chart-table]').exists()).toBe(false)
  })

  it('sans donnée : état vide avec message', () => {
    const wrapper = mount(Chart, { props: { ...props, series: [] } })
    expect(wrapper.find('[data-cp-empty-state]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Aucune donnée à afficher pour cette période')
    expect(wrapper.find('[data-cp-chart-toggle]').exists()).toBe(false)
  })

  it('chargement : squelette', () => {
    const wrapper = mount(Chart, { props: { ...props, loading: true } })
    expect(wrapper.find('[data-cp-skeleton]').exists()).toBe(true)
    expect(wrapper.find('[data-cp-chart-canvas]').exists()).toBe(false)
  })

  it('relit les jetons quand le thème change (clair -> sombre)', async () => {
    document.documentElement.style.setProperty('--cp-chart-1', '#aaaaaa')
    document.documentElement.style.setProperty('--cp-chart-2', '#cccccc')
    const wrapper = mount(Chart, { props })
    await flushPromises()
    const colors = () =>
      JSON.parse(wrapper.findComponent(VChart).attributes('data-option') as string).color[0]
    expect(colors()).toBe('#aaaaaa')
    document.documentElement.style.setProperty('--cp-chart-1', '#bbbbbb')
    document.documentElement.classList.add('dark')
    // happy-dom notifie les MutationObserver de façon asynchrone (hors micro-tâches).
    await new Promise((resolve) => setTimeout(resolve, 10))
    await flushPromises()
    expect(colors()).toBe('#bbbbbb')
  })
})

describe('readChartTokens', () => {
  it('lit les jetons --cp-* de la racine', () => {
    document.documentElement.style.setProperty('--cp-chart-3', ' #008f7a ')
    document.documentElement.style.setProperty('--cp-chart-grid', '#ece9e0')
    const read = readChartTokens()
    expect(read.series[2]).toBe('#008f7a')
    expect(read.grid).toBe('#ece9e0')
    expect(read.series).toHaveLength(6)
  })
})

describe('buildChartOption', () => {
  const build = (over: Partial<Parameters<typeof buildChartOption>[0]> = {}) =>
    buildChartOption({ ...props, tokens, ...over })

  it('séries chart-1…6 dans l ordre, sans recyclage', () => {
    const series = Array.from({ length: 3 }, (_, i) => ({ name: `S${i}`, data: [i] }))
    expect(build({ series }).color).toEqual(['#1', '#2', '#3'])
  })

  it('jeton absent : pas de couleur en dur, ECharts retombe sur son défaut', () => {
    const empty = { ...tokens, series: ['', '', '', '', '', ''], grid: '' }
    const option = build({ tokens: empty })
    expect(option.color).toBeUndefined()
    expect(option.xAxis.axisLine.lineStyle.color).toBeUndefined()
  })

  it('grille en chart-grid, texte des axes en ink-muted, légende en ink', () => {
    const option = build()
    expect(option.yAxis.splitLine.lineStyle.color).toBe('grid')
    expect(option.xAxis.axisLabel.color).toBe('muted')
    expect(option.yAxis.axisLabel.color).toBe('muted')
    expect(option.legend.textStyle.color).toBe('ink')
  })

  it('un seul axe Y (objet, pas tableau)', () => {
    expect(Array.isArray(build().yAxis)).toBe(false)
  })

  it('légende dès 2 séries seulement', () => {
    expect(build().legend.show).toBe(true)
    expect(build({ series: [{ name: 'A', data: [1] }] }).legend.show).toBe(false)
  })

  it('infobulle au survol avec l unité', () => {
    const { tooltip } = build()
    expect(tooltip.trigger).toBe('axis')
    expect(tooltip.valueFormatter(12)).toBe('12 cr')
    expect(build({ unit: undefined }).tooltip.valueFormatter(12)).toBe('12')
  })

  it('courbe : 2 px', () => {
    const [first] = build({ type: 'line' }).series as {
      type: string
      lineStyle: { width: number }
    }[]
    expect(first?.type).toBe('line')
    expect(first?.lineStyle.width).toBe(2)
  })

  it('barres : extrémités arrondies 4 px', () => {
    const [first] = build({ type: 'bar' }).series as {
      type: string
      itemStyle: { borderRadius: number[] }
    }[]
    expect(first?.type).toBe('bar')
    expect(first?.itemStyle.borderRadius).toEqual([4, 4, 0, 0])
  })

  it('barres empilées : pile commune, liseré surface, arrondi sur le segment du haut', () => {
    const series = build({ type: 'stacked-bar' }).series as {
      stack: string
      itemStyle: { borderRadius: number | number[]; borderColor: string }
    }[]
    expect(series.map((s) => s.stack)).toEqual(['total', 'total'])
    expect(series[0]?.itemStyle.borderRadius).toBe(0)
    expect(series[1]?.itemStyle.borderRadius).toEqual([4, 4, 0, 0])
    expect(series[0]?.itemStyle.borderColor).toBe('surface')
  })

  it('désactive l’animation si prefers-reduced-motion: reduce, la garde sinon', () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('reduce') })) as never
    expect(build({}).animation).toBe(false)
    window.matchMedia = (() => ({ matches: false })) as never
    expect(build({}).animation).toBe(true)
    window.matchMedia = original
  })
})
