declare global {
  namespace App {
    interface PageData {
      meta?: ApiEnvelope<unknown>;
    }
  }
}

export type ApiEnvelope<T> = {
  data: T;
  meta: {
    snapshotId: string;
    filters: Record<string, unknown>;
    sourceTable: string;
    queryHash: string;
    generatedAt: string;
    populationCount?: number;
    includedCount?: number;
    excludedMissingCount?: number;
    coveragePeriod?: [string | null, string | null];
  };
};

export {};
