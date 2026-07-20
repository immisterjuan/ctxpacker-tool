import { greet, add } from './utils';

export interface AppConfig {
  name: string;
  version: string;
  debug: boolean;
}

export class App {
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  run(): string {
    return greet(this.config.name);
  }

  sum(a: number, b: number): number {
    return add(a, b);
  }
}

export const DEFAULT_CONFIG: AppConfig = {
  name: 'my-app',
  version: '1.0.0',
  debug: false,
};
