import { AIConfig, AISummaryResult } from '@/types/ai';

export class AIClient {
    private config: AIConfig;

    constructor(config: AIConfig) {
        this.config = config;
    }

    async testConnection(): Promise<boolean> {
        if (!this.config.enabled) return true;
        try {
            // Simple completions call to test connection
            const response = await fetch(`${this.config.endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: 'Ping' }],
                    max_tokens: 5,
                }),
            });
            return response.ok;
        } catch (error) {
            console.error('AI connection test failed:', error);
            return false;
        }
    }

    async generateSummary(title: string, abstract: string): Promise<string> {
        if (!this.config.enabled) return '';
        if (!abstract) return '_No abstract available for summary._';

        const prompt = `
      You are a research assistant. Please summarize the following academic paper.
      
      Title: ${title}
      Abstract: ${abstract}
      
      Format your response as markdown:
      1. A concise summary paragraph (approx 3-4 sentences).
      2. A list of 3 key takeaways/ideas.
      
      Do not include the "Summary" header, just the content.
    `;

        try {
            const response = await fetch(`${this.config.endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                }),
            });

            if (!response.ok) {
                throw new Error(`AI API error: ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            return content.trim();
        } catch (error) {
            console.error('Error generating AI summary:', error);
            return '_AI summary generation failed._';
        }
    }
}
