import { getEnv } from './env.js'

export async function initOtel() {
  const env = getEnv()
  if (!env.OTEL_ENABLED) return

  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node')
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')

  const config: Record<string, unknown> = {
    serviceName: env.OTEL_SERVICE_NAME,
    instrumentations: [getNodeAutoInstrumentations()],
  }
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    config.traceExporter = new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT })
  }

  const sdk = new NodeSDK(config as ConstructorParameters<typeof NodeSDK>[0])

  sdk.start()

  const shutdown = async () => {
    await sdk.shutdown()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
