'use server';

/**
 * @fileOverview AI-powered market insights flow.
 *
 * - getMarketInsights - A function that retrieves market trends summaries.
 * - MarketInsightsInput - The input type for the getMarketInsights function.
 * - MarketInsightsOutput - The return type for the getMarketInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MarketInsightsInputSchema = z.object({
  query: z
    .string()
    .describe('The user query to retrieve the most relevant market insights.'),
});
export type MarketInsightsInput = z.infer<typeof MarketInsightsInputSchema>;

const MarketInsightsOutputSchema = z.object({
  summary: z.string().describe('The AI-generated summary of market trends.'),
});
export type MarketInsightsOutput = z.infer<typeof MarketInsightsOutputSchema>;

export async function getMarketInsights(input: MarketInsightsInput): Promise<MarketInsightsOutput> {
  return marketInsightsFlow(input);
}

const marketInsightsPrompt = ai.definePrompt({
  name: 'marketInsightsPrompt',
  input: {schema: MarketInsightsInputSchema},
  output: {schema: MarketInsightsOutputSchema},
  prompt: `You are an AI assistant that provides summaries of market trends based on user queries.

  Based on the user query, analyze diverse news sources and generate a concise summary of market trends to help the user make informed financial decisions quickly.

  User Query: {{{query}}}`,
});

const marketInsightsFlow = ai.defineFlow(
  {
    name: 'marketInsightsFlow',
    inputSchema: MarketInsightsInputSchema,
    outputSchema: MarketInsightsOutputSchema,
  },
  async input => {
    const {output} = await marketInsightsPrompt(input);
    return output!;
  }
);
