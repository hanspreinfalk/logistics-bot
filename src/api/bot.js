import 'dotenv/config';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getPersonsOutboundPrompt } from '../prompts/persons.js';
import { getCompaniesOutboundPrompt } from '../prompts/companies.js';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

const webSearchTool = anthropic.tools.webSearch_20250305({
  maxUses: 5,
});

const outboundMessageSchema = z.object({
  message: z.string().describe('The outbound message to send to the person'),
});

const personsOutboundSchema = z.object({
  message: z.string().describe('The outbound message to send to the person'),
  linkedin_url: z.string().describe('The LinkedIn profile URL of the person (found via web search; use web search to find it, must be a valid linkedin.com URL)'),
  position: z.string().describe('The person\'s position/title only if it indicates high decision-making power (e.g. CEO, C-level, Founder, VP, Director); otherwise empty string'),
});

async function writeOutboundMessage(info) {
  const { inputMode } = info;
  const isPersons = inputMode === 'persons';
  const prompt = isPersons ? getPersonsOutboundPrompt(info) : getCompaniesOutboundPrompt(info);

  if (isPersons) {
    const { output } = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      tools: { webSearch: webSearchTool },
      prompt,
      output: Output.object({ schema: personsOutboundSchema }),
      maxSteps: 5,
    });
    return {
      message: (output?.message ?? '').trim(),
      linkedin_url: (output?.linkedin_url ?? '').trim(),
      position: (output?.position ?? '').trim(),
    };
  }

  const { output } = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    tools: { webSearch: webSearchTool },
    prompt,
    output: Output.object({ schema: outboundMessageSchema }),
    maxSteps: 5,
  });
  return output?.message?.trim() ?? '';
}

const decisionMakerSchema = z.object({
  person_id: z.string().describe('The person_id of the single highest decision maker in the list'),
});

async function selectDecisionMaker(companyName, persons) {
  if (!persons?.length) return null;
  const list = persons
    .map((p) => `- person_id: ${p.person_id}, full_name: ${p.full_name}, job_title: ${p.current_job_title ?? '—'}`)
    .join('\n');
  const prompt = `You are given a company and a list of people who work there. Choose the ONE person who is the highest decision maker (e.g. CEO, Managing Director, Head of, most senior role). If unclear, pick the most senior role.

Company: ${companyName}

People:
${list}`;

  const { output } = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    output: Output.object({ schema: decisionMakerSchema }),
    prompt,
  });

  const id = output?.person_id;
  if (id && persons.some((p) => p.person_id === id)) return id;
  return null;
}

export { selectDecisionMaker, writeOutboundMessage };
