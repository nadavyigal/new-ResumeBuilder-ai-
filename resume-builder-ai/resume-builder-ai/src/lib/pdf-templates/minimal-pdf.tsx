/**
 * Minimal PDF Template
 *
 * Matches the browser "minimal-ssr" design: clean layout with colored section
 * headers, accent dots, skill pills, and card-like job entries.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PdfTemplateProps } from './index';

function buildStyles(primary: string, secondary: string, accent: string, muted: string, text: string) {
  return StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 11,
      fontFamily: 'Helvetica',
      lineHeight: 1.5,
      color: text,
    },
    // Header
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
      marginBottom: 14,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: '#ffffff',
      fontWeight: 'bold',
      fontSize: 16,
    },
    name: {
      fontSize: 22,
      fontWeight: 'bold',
      color: primary,
      letterSpacing: -0.3,
    },
    title: {
      fontSize: 11,
      fontWeight: 'bold',
      color: secondary,
      marginTop: 2,
    },
    metaRow: {
      fontSize: 9.5,
      color: secondary,
      marginTop: 4,
    },
    // Section
    section: {
      marginBottom: 14,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    sectionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: accent,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: primary,
    },
    // Summary
    summary: {
      fontSize: 11,
      lineHeight: 1.6,
      color: text,
    },
    // Pills
    pillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    pill: {
      backgroundColor: muted,
      color: primary,
      paddingVertical: 4,
      paddingHorizontal: 9,
      borderRadius: 999,
      fontSize: 9,
      fontWeight: 'bold',
    },
    // Job card
    jobCard: {
      padding: 10,
      borderWidth: 1,
      borderColor: '#f0f0f0',
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: '#fafafa',
    },
    jobTitle: {
      fontWeight: 'bold',
      fontSize: 11.5,
      color: primary,
    },
    jobMeta: {
      fontSize: 10,
      color: secondary,
      marginTop: 2,
    },
    jobDates: {
      fontSize: 9.5,
      fontWeight: 'bold',
      color: accent,
      marginTop: 2,
    },
    bulletList: {
      marginTop: 6,
      marginLeft: 12,
    },
    bulletItem: {
      flexDirection: 'row',
      marginBottom: 3,
    },
    bulletDot: {
      width: 14,
      fontSize: 10,
      color: text,
    },
    bulletText: {
      flex: 1,
      fontSize: 10,
      lineHeight: 1.5,
      color: text,
    },
    // Education
    eduItem: {
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
      marginBottom: 6,
    },
    eduTitle: {
      fontWeight: 'bold',
      fontSize: 11,
      color: primary,
    },
    eduMeta: {
      fontSize: 10,
      color: secondary,
    },
    // Certs / Projects
    certItem: {
      flexDirection: 'row',
      marginBottom: 3,
    },
    projectTitle: {
      fontWeight: 'bold',
      fontSize: 11,
      color: primary,
      marginBottom: 2,
    },
    projectDesc: {
      fontSize: 10,
      color: text,
      marginBottom: 2,
    },
    projectTech: {
      fontSize: 9,
      fontStyle: 'italic',
      color: secondary,
    },
  });
}

export const MinimalPdfTemplate: React.FC<PdfTemplateProps> = ({ resume, palette, isRTL }) => {
  const { primary, secondary, accent, muted, text } = palette;
  const s = buildStyles(primary, secondary, accent, muted, text);
  const { contact, summary, skills, experience, education, certifications, projects } = resume;

  const nameParts = (contact?.name || '').split(' ');
  const initials = nameParts.slice(0, 2).map(n => n[0] || '').join('').toUpperCase() || 'JD';

  const textAlign = isRTL ? 'right' as const : 'left' as const;

  return (
    <Document>
      <Page size="A4" style={[s.page, { textAlign }]}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{contact?.name}</Text>
            {contact?.title && <Text style={s.title}>{contact.title}</Text>}
            <Text style={s.metaRow}>
              {[contact?.location, contact?.email, contact?.phone].filter(Boolean).join(' • ')}
            </Text>
            {(contact?.linkedin || contact?.portfolio) && (
              <Text style={s.metaRow}>
                {[contact?.linkedin, contact?.portfolio].filter(Boolean).join(' • ')}
              </Text>
            )}
          </View>
        </View>

        {/* Professional Summary */}
        {summary && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Professional Summary</Text>
            </View>
            <Text style={s.summary}>{summary}</Text>
          </View>
        )}

        {/* Skills */}
        {skills && (skills.technical?.length > 0 || skills.soft?.length > 0) && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Skills</Text>
            </View>
            <View style={s.pillsRow}>
              {[...(skills.technical || []), ...(skills.soft || [])].map((skill, i) => (
                <Text key={i} style={s.pill}>{skill}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Experience */}
        {experience && experience.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Experience</Text>
            </View>
            {experience.map((exp, i) => (
              <View key={i} style={s.jobCard}>
                <Text style={s.jobTitle}>{exp.title}</Text>
                <Text style={s.jobMeta}>
                  {exp.company}{exp.location ? ` — ${exp.location}` : ''}
                </Text>
                <Text style={s.jobDates}>
                  {exp.startDate}{exp.endDate ? ` — ${exp.endDate}` : ''}
                </Text>
                {exp.achievements && exp.achievements.length > 0 && (
                  <View style={s.bulletList}>
                    {exp.achievements.map((a, j) => (
                      <View key={j} style={s.bulletItem}>
                        <Text style={s.bulletDot}>•</Text>
                        <Text style={s.bulletText}>{a}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {education && education.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Education</Text>
            </View>
            {education.map((edu, i) => (
              <View key={i} style={s.eduItem}>
                <Text style={s.eduTitle}>{edu.degree}</Text>
                <Text style={s.eduMeta}>
                  {edu.institution}{edu.location ? ` — ${edu.location}` : ''}{edu.graduationDate ? ` — ${edu.graduationDate}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        {certifications && certifications.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Certifications</Text>
            </View>
            {certifications.map((cert, i) => (
              <View key={i} style={s.certItem}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>{cert}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Projects */}
        {projects && projects.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>Projects</Text>
            </View>
            {projects.map((project, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={s.projectTitle}>{project.name}</Text>
                <Text style={s.projectDesc}>{project.description}</Text>
                {project.technologies?.length > 0 && (
                  <Text style={s.projectTech}>Technologies: {project.technologies.join(', ')}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
};
