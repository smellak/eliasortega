import { openai } from "./llm-clients";
import { CALCULATOR_AGENT_SYSTEM_PROMPT } from "./prompts";
import { z } from "zod";

const calculatorInputSchema = z.object({
  providerName: z.string().optional(),
  goodsType: z.string().optional(),
  units: z.number().int().min(0).optional(),
  lines: z.number().int().min(0).optional(),
});

const calculatorOutputSchema = z.object({
  categoria_elegida: z.string(),
  work_minutes_needed: z.number().int().min(0),
  forklifts_needed: z.number().int().min(0),
  workers_needed: z.number().int().min(0),
  duration_min: z.number().int().min(15).max(180),
});

export type CalculatorInput = z.infer<typeof calculatorInputSchema>;
export type CalculatorOutput = z.infer<typeof calculatorOutputSchema>;

export async function runCalculator(input: CalculatorInput): Promise<CalculatorOutput> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: CALCULATOR_AGENT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      max_completion_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from calculator agent");
    }

    const parsed = JSON.parse(content);
    return calculatorOutputSchema.parse(parsed);
  } catch (error) {
    console.error("Calculator agent error:", error);
    return {
      categoria_elegida: "Mediano",
      work_minutes_needed: 60,
      forklifts_needed: 1,
      workers_needed: 1,
      duration_min: 60,
    };
  }
}
