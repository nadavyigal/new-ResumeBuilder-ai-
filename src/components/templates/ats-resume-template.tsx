import React from 'react';
import { OptimizedResume } from '@/lib/validation/schemas';

interface ATSResumeTemplateProps {
  data: OptimizedResume;
}

/**
 * ATS-Friendly Resume Template
 *
 * Clean, single-column layout optimized for Applicant Tracking Systems.
 * No tables, graphics, or complex formatting - just pure, parseable text.
 */
export function ATSResumeTemplate({ data }: ATSResumeTemplateProps) {
  return (
    <div className="max-w-4xl mx-auto bg-white p-8 shadow-sm rounded-lg border border-gray-200">
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
    </div>
  );
}
