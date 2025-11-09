import React from 'react';
import { OptimizedResume } from '@/lib/ai-optimizer';

interface ATSResumeTemplateProps {
  data: OptimizedResume;
  customization?: any;
}

/**
 * ATS-Friendly Resume Template
 *
 * Clean, single-column layout optimized for Applicant Tracking Systems.
 * No tables, graphics, or complex formatting - just pure, parseable text.
 */
export function ATSResumeTemplate({ data, customization }: ATSResumeTemplateProps) {
  return (
    <div
      className="max-w-4xl mx-auto p-8 shadow-sm rounded-lg border border-gray-200"
      style={{ backgroundColor: customization?.color_scheme?.background || undefined }}
    >
      {/* Header */}
      <header className="border-b-2 border-gray-900 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {data.contact?.name || 'Name Not Provided'}
        </h1>
        <div className="text-sm text-gray-700 space-y-1">
          {data.contact?.location && <p>{data.contact.location}</p>}
          {(data.contact?.email || data.contact?.phone) && (
            <p>
              {data.contact?.email} {data.contact?.email && data.contact?.phone && '| '} {data.contact?.phone}
            </p>
          )}
          {(data.contact?.linkedin || data.contact?.portfolio) && (
            <p>
              {data.contact?.linkedin && <span>{data.contact.linkedin}</span>}
              {data.contact?.linkedin && data.contact?.portfolio && <span> | </span>}
              {data.contact?.portfolio && <span>{data.contact.portfolio}</span>}
            </p>
          )}
        </div>
      </header>

      {/* Professional Summary */}
      {data.summary && (
        <section className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
            Professional Summary
          </h2>
          <p className="text-gray-800 leading-relaxed">{data.summary}</p>
        </section>
      )}

      {/* Core Skills */}
      {data.skills && (data.skills.technical?.length > 0 || data.skills.soft?.length > 0) && (
        <section className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
            Skills
          </h2>

          {data.skills.technical?.length > 0 && (
            <div className="mb-3">
              <h3 className="font-semibold text-gray-900 mb-1">Technical Skills</h3>
              <p className="text-gray-800 leading-relaxed">
                {data.skills.technical.join(' • ')}
              </p>
            </div>
          )}

          {data.skills.soft?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Professional Skills</h3>
              <p className="text-gray-800 leading-relaxed">
                {data.skills.soft.join(' • ')}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Experience */}
      {data.experience && data.experience.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
            Experience
          </h2>

          {data.experience.map((job, index) => (
            <div key={index} className="mb-4">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="font-bold text-gray-900">{job.title}</h3>
                <span className="text-sm text-gray-700">
                  {job.startDate} – {job.endDate}
                </span>
              </div>
              <div className="flex justify-between items-baseline mb-2">
                <p className="font-semibold text-gray-800">{job.company}</p>
                {job.location && <span className="text-sm text-gray-700">{job.location}</span>}
              </div>
              {job.achievements && job.achievements.length > 0 && (
                <ul className="list-disc list-outside ml-5 space-y-1">
                  {job.achievements.map((achievement, i) => (
                    <li key={i} className="text-gray-800 leading-relaxed">
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
            Education
          </h2>

          {data.education.map((edu, index) => (
            <div key={index} className="mb-2">
              <div className="flex justify-between items-baseline">
                <h3 className="font-bold text-gray-900">{edu.degree}</h3>
                {edu.graduationDate && <span className="text-sm text-gray-700">{edu.graduationDate}</span>}
              </div>
              <div className="flex justify-between items-baseline">
                <p className="text-gray-800">{edu.institution}</p>
                {edu.location && <span className="text-sm text-gray-700">{edu.location}</span>}
              </div>
              {edu.gpa && (
                <p className="text-sm text-gray-700">GPA: {edu.gpa}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Certifications */}
      {data.certifications && data.certifications.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
            Certifications
          </h2>
          <ul className="list-disc list-outside ml-5 space-y-1">
            {data.certifications.map((cert, index) => (
              <li key={index} className="text-gray-800">
                {cert}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Projects */}
      {data.projects && data.projects.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3 border-b border-gray-300 pb-1">
            Projects
          </h2>

          {data.projects.map((project, index) => (
            <div key={index} className="mb-3">
              <h3 className="font-bold text-gray-900">{project.name}</h3>
              {project.description && <p className="text-gray-800 mb-1">{project.description}</p>}
              {project.technologies && project.technologies.length > 0 && (
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Technologies:</span> {project.technologies.join(', ')}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Match Score Indicator (for display only, not in exported version) */}
      <div className="mt-8 pt-6 border-t border-gray-300 print:hidden">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-900">ATS Match Score</span>
            <span className="text-2xl font-bold text-blue-600">
              {data.matchScore}%
            </span>
          </div>

          {data.keyImprovements && data.keyImprovements.length > 0 && (
            <div className="mt-3">
              <h4 className="font-semibold text-gray-900 mb-2">Key Improvements:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {data.keyImprovements.map((improvement, i) => (
                  <li key={i}>{improvement}</li>
                ))}
              </ul>
            </div>
          )}

          {data.missingKeywords && data.missingKeywords.length > 0 && (
            <div className="mt-3">
              <h4 className="font-semibold text-gray-900 mb-2">Missing Keywords:</h4>
              <div className="flex flex-wrap gap-2">
                {data.missingKeywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
