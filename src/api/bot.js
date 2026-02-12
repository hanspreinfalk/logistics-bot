import 'dotenv/config';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

const webSearchTool = anthropic.tools.webSearch_20250305({
  maxUses: 5,
});

const outboundMessageSchema = z.object({
  message: z.string().describe('The outbound message to send to the person'),
});


async function writeOutboundMessage(info) {
  const { companyName, person, company } = info;
  const firstName = person?.full_name?.split(/\s+/)[0] || 'there';
  const jobTitle = person?.current_job_title ?? '';
  const prompt = `You are writing a short, personalized outbound message to a decision maker at a company. Use web search to find something specific and genuine about the company and/or this person (recent news, focus areas, initiatives) so you can capture their attention.

Company: ${companyName}
Person: ${person?.full_name ?? 'Unknown'}
Job title: ${jobTitle}
LinkedIn: ${person?.linkedin_url ?? '—'}

Search for the company and the person to find one concrete thing you can reference (e.g. cross-border freight operations, a recent initiative, their role focus). Then write a single short message that:

1. Starts with "Hi [First name]," (use their actual first name).
2. In one sentence, say you're interested in learning more about what they're doing and mention the specific thing you found (e.g. "because we have several clients in cross-border freight operations" or similar hook tied to their company/role).
3. In one sentence, briefly introduce the sender: "I've already graduated from MIT with a degree in AI, and now I have a company where we develop software for logistics companies."

Keep the tone professional, concise, and genuine. Do not use bullet points or multiple paragraphs—one short block of 3–4 sentences like the example. Output only the message.`;

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
