/**
 * Sidebar PDF Template
 *
 * Matches the browser "sidebar-ssr" design: two-column layout with a dark
 * sidebar containing contact info and skills, and a light main area for
 * summary, experience, and education.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PdfTemplateProps } from './index';

function buildStyles(primary: string, secondary: string, accent: string, muted: string, text: string) {
  return StyleSheet.create({
    page: {
      fontSize: 11,
      fontFamily: 'Helvetica',
      lineHeight: 1.5,
      color: text,
      flexDirection: 'row',
    },
    // Sidebar
    sidebar: {
      width: '32%',
      backgroundColor: primary,
      padding: 20,
      color: '#e2e8f0',
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarText: {
      color: '#ffffff',
      fontWeight: 'bold',
      fontSize: 20,
    },
    sidebarName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#f8fafc',
      marginBottom: 2,
    },
    sidebarTitle: {
      fontSize: 10,
      color: '#cbd5e1',
      marginBottom: 12,
    },
    sidebarLabel: {
      fontSize: 8,
      fontWeight: 'bold',
      color: accent,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
      marginTop: 12,
    },
    sidebarMeta: {
      fontSize: 9.5,
      color: '#e2e8f0',
      marginBottom: 3,
      opacity: 0.9,
    },
    sidebarPill: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      color: '#e2e8f0',
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
      fontSize: 8.5,
      fontWeight: 'bold',
      marginRight: 4,
      marginBottom: 4,
    },
    pillsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    // Main content
    main: {
      width: '68%',
      padding: 24,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      paddingBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
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
    summary: {
      fontSize: 11,
      lineHeight: 1.6,
      color: text,
    },
    jobCard: {
      padding: 8,
      borderWidth: 1,
      borderColor: '#f0f0f0',
      borderRadius: 8,
      marginBottom: 8,
    },
    jobTitle: {
      fontWeight: 'bold',
      fontSize: 11,
      color: primary,
    },
    jobMeta: {
      fontSize: 9.5,
      color: secondary,
      marginTop: 2,
    },
    jobDates: {
      fontSize: 9,
      fontWeight: 'bold',
      color: accent,
      marginTop: 2,
    },
    bulletList: {
      marginTop: 5,
      marginLeft: 10,
    },
    bulletItem: {
      flexDirection: 'row',
      marginBottom: 2,
    },
    bulletDot: {
      width: 12,
      fontSize: 9,
      color: text,
    },
    bulletText: {
      flex: 1,
      fontSize: 9.5,
      lineHeight: 1.45,
      color: text,
    },
    eduItem: {
      marginBottom: 6,
    },
    eduTitle: {
      fontWeight: 'bold',
      fontSize: 11,
      color: primary,
    },
    eduMeta: {
      fontSize: 9.5,
      color: secondary,
    },
    projectTitle: {
      fontWeight: 'bold',
      fontSize: 11,
      color: primary,
      marginBottom: 2,
    },
    projectDesc: {
      fontSize: 9.5,
      color: text,
      marginBottom: 2,
    },
    projectTech: {
      fontSize: 8.5,
      fontStyle: 'italic',
      color: secondary,
    },
  });
}

export const SidebarPdfTemplate: React.FC<PdfTemplateProps> = ({ resume, palette }) => {
  const { primary, secondary, accent, muted, text } = palette;
  const s = buildStyles(primary, secondary, accent, muted, text);
  const { contact, summary, skills, experience, education, certifications, projects } = resume;

  const nameParts = (contact?.name || '').split(' ');
  const initials = nameParts.slice(0, 2).map(n => n[0] || '').join('').toUpperCase() || 'JD';

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Sidebar */}
        <View style={s.sidebar}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.sidebarName}>{contact?.name}</Text>
          {contact?.title && <Text style={s.sidebarTitle}>{contact.title}</Text>}

          <Text style={s.sidebarLabel}>Contact</Text>
          {contact?.location && <Text style={s.sidebarMeta}>{contact.location}</Text>}
          {contact?.email && <Text style={s.sidebarMeta}>{contact.email}</Text>}
          {contact?.phone && <Text style={s.sidebarMeta}>{contact.phone}</Text>}
          {contact?.linkedin && <Text style={s.sidebarMeta}>{contact.linkedin}</Text>}
          {contact?.portfolio && <Text style={s.sidebarMeta}>{contact.portfolio}</Text>}

          {/* Skills in sidebar */}
          {skills && (skills.technical?.length > 0 || skills.soft?.length > 0) && (
            <>
              <Text style={s.sidebarLabel}>Skills</Text>
              <View style={s.pillsWrap}>
                {[...(skills.technical || []), ...(skills.soft || [])].map((skill, i) => (
                  <Text key={i} style={s.sidebarPill}>{skill}</Text>
                ))}
              </View>
            </>
          )}

          {/* Certifications in sidebar */}
          {certifications && certifications.length > 0 && (
            <>
              <Text style={s.sidebarLabel}>Certifications</Text>
              {certifications.map((cert, i) => (
                <Text key={i} style={s.sidebarMeta}>• {cert}</Text>
              ))}
            </>
          )}
        </View>

        {/* Main Content */}
        <View style={s.main}>
          {/* Summary */}
          {summary && (
            <View style={s.section}>
              <View style={s.sectionTitleRow}>
                <View style={s.sectionDot} />
                <Text style={s.sectionTitle}>Professional Summary</Text>
              </View>
              <Text style={s.summary}>{summary}</Text>
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
        </View>
      </Page>
    </Document>
  );
};
