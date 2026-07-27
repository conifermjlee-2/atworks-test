export type ConfidenceLevel = 'detected' | 'inferred';

export interface ApiCall {
  order: number;
  method: string;
  endpoint: string;
  condition?: string | null;
  callerType: 'component' | 'composable' | 'serverAction' | 'routeHandler' | 'unknown';
  confidence: ConfidenceLevel;
  evidence: string;
  navigatesTo?: string | null;
}

export interface Trigger {
  type: 'event' | 'lifecycle' | 'route' | 'unknown';
  name: string;
}

export interface ScenarioIR {
  framework: 'react' | 'nextjs' | 'vue' | 'unknown';
  route: string;
  sourceFile: string;
  trigger: Trigger;
  calls: ApiCall[];
}

export interface ScenarioReport {
  scenarios: ScenarioIR[];
  markdown: string;
}
