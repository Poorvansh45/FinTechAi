// StockScreenerWithAIDrivenAnalysis.ts
'use server';

/**
 * @fileOverview AI-driven stock screener flow that filters stocks based on technical analysis.
 *
 * - stockScreenerWithAIDrivenAnalysis - A function that initiates the stock screening process.
 * - StockScreenerInput - The input type for the stockScreenerWithAIDrivenAnalysis function.
 * - StockScreenerOutput - The return type for the stockScreenerWithAIDrivenAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StockScreenerInputSchema = z.object({
  criteria: z
    .string()
    .describe(
      'The criteria to filter stocks based on AI-driven technical analysis.'
    ),
});
export type StockScreenerInput = z.infer<typeof StockScreenerInputSchema>;

const StockScreenerOutputSchema = z.object({
  results: z
    .string()
    .describe('The stocks that match the specified criteria.'),
});
export type StockScreenerOutput = z.infer<typeof StockScreenerOutputSchema>;

export async function stockScreenerWithAIDrivenAnalysis(
  input: StockScreenerInput
): Promise<StockScreenerOutput> {
  return stockScreenerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'stockScreenerPrompt',
  input: {schema: StockScreenerInputSchema},
  output: {schema: StockScreenerOutputSchema},
  prompt: `You are an AI stock analyst who uses technical analysis.
Filter stocks based on the following criteria: {{{criteria}}}.
Return the stocks that match the criteria in a JSON format. Make sure to include the stock ticker and a brief explanation of why it matches the criteria.
`,
});

const stockScreenerFlow = ai.defineFlow(
  {
    name: 'stockScreenerFlow',
    inputSchema: StockScreenerInputSchema,
    outputSchema: StockScreenerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
