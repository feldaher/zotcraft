export interface AIConfig {
    endpoint: string;
    apiKey: string;
    model: string;
    enabled: boolean;
}

export interface AISummaryResult {
    summary: string;
    keyPoints: string[];
}
