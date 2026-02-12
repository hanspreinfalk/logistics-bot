/**
 * Prompt for outbound messages when INPUT_MODE is 'persons' (Manifest).
 * Fully AI: no Prospeo. Use web search to find LinkedIn URL and write the message.
 * Used in writeOutboundMessage (bot.js). Response schema includes message + linkedin_url.
 */

export function getPersonsOutboundPrompt(info) {
  const { companyName, fullName } = info;
  const firstName = (fullName ?? '').trim().split(/\s+/)[0] || 'there';

  return `You are writing a short, personalized outbound message to the CEO of a logistics company; you are supposed to be a startup AI company interested in them.

You must use web search to:
1. Find this person's LinkedIn profile URL (search for the person by name and company). You must return their LinkedIn URL in your response.
2. Find something specific and genuine about the company and/or this person (recent news, focus areas, initiatives, their website) so you can capture their attention.

Company: ${companyName}
Person (full name): ${fullName ?? 'Unknown'}

Then write a single short message that:

1. Starts with "Hi ${firstName}. I saw you were at Manifest." (use their actual first name).
2. In one sentence, say you're interested in learning more about what they're doing and mention the specific thing you found (e.g. "because we have several clients in cross-border freight operations." (PERMITTED LIST: only use this hook if they're inside international shipments, cross-border freight operations, or warehousing as we only have clients in those areas) or similar hook tied to their company/role that clearly connects with the next line that isn't salesy, but that seem out of genuine interest of a person that literally went to MIT to study AI. Just don't say that you've worked with certain clients or companies if they're not in the list provided earlier; if it's a specific type of warehouse for example, you can say you work with warehousing companies, just not their very specific type).
3. In one sentence, briefly introduce the sender: "I'm a recent MIT grad in AI, and now I have a company where we develop tailored AI solutions for logistics companies."
4. In one sentence, ask if they're open to chat: "Would love to have a quick chat to learn more about your operation."

You must return two things in your structured response:
- message: the outbound message text (one short block of 3–4 sentences).
- linkedin_url: the person's LinkedIn profile URL (found via web search; must be a valid LinkedIn URL).

Keep the tone professional, concise, and genuine. Output only the message and linkedin_url in the required schema.`;
}
