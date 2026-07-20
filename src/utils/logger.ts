import pino from 'pino';

let _logger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (!_logger) {
    const isCI = process.env['CI'] === 'true';
    const isPretty = !isCI && process.stdout.isTTY;

    _logger = pino(
      {
        level: process.env['LOG_LEVEL'] ?? 'info',
        base: null,
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      isPretty
        ? (pino as unknown as { transport: (opts: object) => pino.DestinationStream }).transport({
            target: 'pino-pretty',
            options: { colorize: true, ignore: 'pid,hostname' },
          })
        : process.stdout,
    );
  }
  return _logger;
}

export function resetLogger(): void {
  _logger = null;
}
