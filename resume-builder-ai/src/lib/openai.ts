import OpenAI from "openai";

// Validate API key exists
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({
  apiKey: apiKey || 'invalid-key-placeholder',
});

export async function optimizeResume(resumeText: string, jobDescriptionText: string) {
  // Validate API key before making request
  if (!apiKey || apiKey === 'invalid-key-placeholder') {
    throw new Error('OPENAI_API_KEY is not configured. Please add your OpenAI API key to the .env.local file.');
  }

  try {
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
  } catch (error: unknown) {
    // Enhanced error handling for OpenAI API errors
    if (error instanceof Error) {
      // Check for common OpenAI API errors
      if (error.message.includes('Incorrect API key') || error.message.includes('invalid_api_key')) {
        throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env.local file. You can get a valid key from https://platform.openai.com/api-keys');
      }
      if (error.message.includes('insufficient_quota')) {
        throw new Error('OpenAI API quota exceeded. Please check your billing at https://platform.openai.com/account/billing');
      }
      if (error.message.includes('rate_limit')) {
        throw new Error('OpenAI API rate limit exceeded. Please try again in a few moments.');
      }
    }
    throw error;
  }
}
