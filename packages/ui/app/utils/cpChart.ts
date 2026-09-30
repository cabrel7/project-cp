// Thème ECharts généré depuis les jetons du design system (dataviz.md).
// Canvas ne comprend pas var(--x) : les jetons sont lus à l'exécution (clair ET sombre) puis passés à ECharts.

export type CpChartType = 'line' | 'bar' | 'stacked-bar'

export interface CpChartSeries {
  name: string
  data: number[]
}

export interface CpChartTokens {
  series: string[]
  grid: string
  ink: string
  inkMuted: string
  surface: string
  line: string
}

const SERIES_TOKENS = [
  '--cp-chart-1',
  '--cp-chart-2',
  '--cp-chart-3',
  '--cp-chart-4',
  '--cp-chart-5',
  '--cp-chart-6',
] as const

/** Lit les jetons `--cp-*` actifs (le thème sombre se reflète via la classe `.dark` de <html>). */
export function readChartTokens(root: Element = document.documentElement): CpChartTokens {
  const style = getComputedStyle(root)
  const read = (name: string): string => style.getPropertyValue(name).trim()
  return {
    series: SERIES_TOKENS.map(read),
    grid: read('--cp-chart-grid'),
    ink: read('--cp-ink'),
    inkMuted: read('--cp-ink-muted'),
    surface: read('--cp-surface'),
    line: read('--cp-line'),
  }
}

/** Une valeur vide (jeton absent, rendu serveur) devient `undefined` : ECharts retombe sur son défaut. */
const token = (value: string): string | undefined => (value === '' ? undefined : value)

export interface CpChartInput {
  type: CpChartType
  series: CpChartSeries[]
  categories: string[]
  unit?: string
  tokens: CpChartTokens
}

const BAR_RADIUS = 4
const LINE_WIDTH = 2

/** Couleur d'une série : chart-1 à chart-6 dans l'ordre, sans recyclage (au-delà, l'appelant regroupe en « Autres »). */
export function seriesColor(tokens: CpChartTokens, index: number): string | undefined {
  return token(tokens.series[index] ?? '')
}

export function buildChartOption({ type, series, categories, unit, tokens }: CpChartInput) {
  const withUnit = (value: unknown): string => (unit ? `${String(value)} ${unit}` : String(value))
  const axisText = { color: token(tokens.inkMuted), fontSize: 12 }
  const stacked = type === 'stacked-bar'
  const lastIndex = series.length - 1

  const colors = series.map((_, index) => seriesColor(tokens, index))
  // Jeton absent (rendu serveur, CSS non chargé) : pas de palette du tout plutôt qu'une palette trouée.
  const palette = colors.filter((color): color is string => color !== undefined)

  return {
    color: palette.length === colors.length ? palette : undefined,
    animation: true,
    aria: { enabled: true },
    textStyle: { color: token(tokens.ink) },
    grid: { left: 8, right: 16, top: series.length >= 2 ? 40 : 16, bottom: 8, containLabel: true },
    legend: {
      show: series.length >= 2,
      top: 0,
      icon: 'roundRect',
      textStyle: { color: token(tokens.ink), fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: type === 'line' ? 'line' : 'shadow' },
      valueFormatter: withUnit,
      backgroundColor: token(tokens.surface),
      borderColor: token(tokens.line),
      textStyle: { color: token(tokens.ink) },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: token(tokens.grid) } },
      axisTick: { show: false },
      axisLabel: axisText,
    },
    // Un seul axe Y : deux mesures d'échelles différentes = deux graphiques.
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: token(tokens.grid) } },
      axisLabel: { ...axisText, formatter: (value: number) => withUnit(value) },
    },
    series: series.map((item, index) => {
      if (type === 'line') {
        return {
          name: item.name,
          type: 'line',
          data: item.data,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: LINE_WIDTH },
        }
      }
      return {
        name: item.name,
        type: 'bar',
        data: item.data,
        ...(stacked ? { stack: 'total' } : { barGap: '10%' }),
        itemStyle: {
          // Extrémités arrondies 4 px ; écart de 2 px entre segments empilés (liseré couleur surface).
          borderRadius: stacked
            ? index === lastIndex
              ? [BAR_RADIUS, BAR_RADIUS, 0, 0]
              : 0
            : [BAR_RADIUS, BAR_RADIUS, 0, 0],
          ...(stacked ? { borderColor: token(tokens.surface), borderWidth: 1 } : {}),
        },
      }
    }),
  }
}
