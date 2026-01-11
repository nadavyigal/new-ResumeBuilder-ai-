import OpenAI from "openai";

// Lazy initialization to prevent build-time errors
let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    openaiInstance = new OpenAI({
      apiKey,
    });
  }
  return openaiInstance;
}

// Export for use in other files
export { getOpenAI };

export async function optimizeResume(resumeText: string, jobDescriptionText: string) {
  try {
    const completion = await getOpenAI().chat.completions.create({
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
