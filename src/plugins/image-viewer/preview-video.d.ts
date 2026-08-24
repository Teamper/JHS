export function Z(qualities: string[], preferred?: string): string;
export function fetchDmmPreview(carNum: string | null, storage: any, movie?: any, scope?: any): Promise<{
    sources: Record<string, string>;
    error?: { code?: string; message?: string } | null;
}>;
