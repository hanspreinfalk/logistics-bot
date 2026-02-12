/**
 * Prompt for outbound messages when INPUT_MODE is 'persons' (Manifest).
 * Used in writeOutboundMessage (bot.js).
 */

export function getPersonsOutboundPrompt(info) {
  const { companyName, person } = info;
  const fullName = person?.full_name ?? 'Unknown';
  const firstName = person?.full_name?.split(/\s+/)[0] ?? 'there';
  const linkedinUrl = person?.linkedin_url ?? '—';

  return `You are writing a short, personalized outbound message to the CEO of a logistics company, you are supposed to be a startup AI company interested in them. Use web search to find something specific and genuine about the company and/or this person (recent news, focus areas, initiatives, their website) so you can capture their attention.

Company: ${companyName}
CEO: ${fullName}
LinkedIn: ${linkedinUrl}

Search for the company and the person to find one concrete thing you can reference (e.g. cross-border freight operations, a recent initiative, their role focus). Then write a single short message that:

1. Starts with "Hi ${firstName}. I saw you were at Manifest." (use their actual first name).
2. In one sentence, say you're interested in learning more about what they're doing and mention the specific thing you found (e.g. "because we have several clients in cross-border freight operations." (PERMITTED LIST: only use this hook if they're inside international shipments, cross-border freight operations, or warehousing as we only have clients in those areas) or similar hook tied to their company/role that clearly connects with the next line that isn't salesy, but that seem out of genuine interest of a person that literally went to MIT to study AI. Just don't say that you've worked with certain clients or companies if they're not in the list provided earlier, if it's a specific type of warehouse for example, you can say you work with warehousing companies, just not their very specific type).
3. In one sentence, briefly introduce the sender: "I'm a recent MIT grad in AI, and now I have a company where we develop tailored AI solutions for logistics companies."
4. In one sentence, ask if they're open to chat: "Would love to have a quick chat to learn more about your operation."

Keep the tone professional, concise, and genuine. Do not use bullet points or multiple paragraphs—one short block of 3–4 sentences like the example. Output only the message.`;
}
