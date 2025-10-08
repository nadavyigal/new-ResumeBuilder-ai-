import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function optimizeResume(resumeText: string, jobDescriptionText: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are an expert resume optimizer. Your task is to rewrite the provided resume to be perfectly tailored to the job description. You must return the result as a JSON object with the following structure: { "summary": "...", "experience": [{"job_title": "...", "company": "...", "date_range": "...", "responsibilities": ["...", "..."]}] }`,
      },
      {
        role: "user",
        content: `Here is the resume:\n\n${resumeText}\n\nHere is the job description:\n\n${jobDescriptionText}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const result = completion.choices[0].message.content;
  if (!result) {
    throw new Error("OpenAI API did not return a result.");
  }

  return JSON.parse(result);
}
