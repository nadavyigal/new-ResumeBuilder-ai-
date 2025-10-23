import { extractJob } from "@/lib/scraper/jobExtractor";
import { scrapeJobDescription } from "@/lib/job-scraper";
import { log } from "../utils/logger";
import "../validators"; // ensure validators loaded in tool context

export interface JobInfo {
  title?: string;
  company?: string;
  location?: string;
  text?: string;
  url?: string;
  raw?: any;
}

export const JobLinkScraper = {
  async getJob(job_url: string): Promise<JobInfo> {
    try {
      const extracted = await extractJob(job_url);
      const parts: string[] = [];
      if (extracted.job_title) parts.push(`Job Title: ${extracted.job_title}`);
      if (extracted.company_name) parts.push(`Company: ${extracted.company_name}`);
      if (extracted.location) parts.push(`Location: ${extracted.location}`);
      if (extracted.about_this_job) parts.push(`About: ${extracted.about_this_job}`);
      if (extracted.requirements?.length) parts.push(`Requirements: ${extracted.requirements.join("; ")}`);
      if (extracted.responsibilities?.length) parts.push(`Responsibilities: ${extracted.responsibilities.join("; ")}`);
      if (extracted.qualifications?.length) parts.push(`Qualifications: ${extracted.qualifications.join("; ")}`);
      return {
        title: extracted.job_title,
        company: extracted.company_name,
        location: extracted.location,
        text: parts.join("\n"),
        url: job_url,
        raw: extracted,
      };
    } catch (e: any) {
      log("tool_error", "JobLinkScraper.getJob structured scrape failed", { error: e?.message, url: job_url });
      try {
        const text = await scrapeJobDescription(job_url);
        return { text, url: job_url };
      } catch (e2: any) {
        log("tool_error", "JobLinkScraper.getJob simple scrape failed", { error: e2?.message, url: job_url });
        return { text: `Job Posting URL: ${job_url}`, url: job_url };
      }
    }
  },
};
