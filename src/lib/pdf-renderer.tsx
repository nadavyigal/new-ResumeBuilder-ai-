/**
 * React PDF Renderer - Serverless-compatible PDF generation
 * Works in Vercel without Puppeteer/Chrome
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { OptimizedResume } from './ai-optimizer';

// Register fonts (optional - uses built-in Helvetica by default)
// Font.register({
//   family: 'Helvetica',
//   src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
// });

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  contactInfo: {
    fontSize: 10,
    color: '#333333',
    marginBottom: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid #cccccc',
  },
  jobTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  jobMeta: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#555555',
    marginBottom: 8,
  },
  bulletList: {
    marginLeft: 20,
    marginTop: 4,
  },
  bulletItem: {
    marginBottom: 4,
    flexDirection: 'row',
  },
  bulletDot: {
    width: 20,
  },
  bulletText: {
    flex: 1,
    lineHeight: 1.4,
  },
  skillsList: {
    marginTop: 4,
  },
  skillCategory: {
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
});

interface ResumePDFProps {
  resume: OptimizedResume;
}

export const ResumePDF: React.FC<ResumePDFProps> = ({ resume }) => {
  const { contact, summary, skills, experience, education, certifications, projects } = resume;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{contact.name}</Text>
          <Text style={styles.contactInfo}>
            {contact.email} | {contact.phone} | {contact.location}
          </Text>
          {(contact.linkedin || contact.portfolio) && (
            <Text style={styles.contactInfo}>
              {contact.linkedin}{contact.linkedin && contact.portfolio ? ' | ' : ''}{contact.portfolio}
            </Text>
          )}
        </View>

        {/* Professional Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Summary</Text>
          <Text>{summary}</Text>
        </View>

        {/* Skills */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          {skills.technical && skills.technical.length > 0 && (
            <View style={styles.skillsList}>
              <Text style={styles.skillCategory}>Technical Skills:</Text>
              <Text>{skills.technical.join(', ')}</Text>
            </View>
          )}
          {skills.soft && skills.soft.length > 0 && (
            <View style={styles.skillsList}>
              <Text style={styles.skillCategory}>Professional Skills:</Text>
              <Text>{skills.soft.join(', ')}</Text>
            </View>
          )}
        </View>

        {/* Professional Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Experience</Text>
          {experience.map((exp, index) => (
            <View key={index}>
              <Text style={styles.jobTitle}>
                {exp.title} | {exp.company}
              </Text>
              <Text style={styles.jobMeta}>
                {exp.location} | {exp.startDate} – {exp.endDate}
              </Text>
              {exp.achievements && exp.achievements.length > 0 && (
                <View style={styles.bulletList}>
                  {exp.achievements.map((achievement, idx) => (
                    <View key={idx} style={styles.bulletItem}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{achievement}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Education */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Education</Text>
          {education.map((edu, index) => (
            <View key={index} style={{ marginBottom: 12 }}>
              <Text style={styles.jobTitle}>{edu.degree}</Text>
              <Text style={styles.jobMeta}>
                {edu.institution} | {edu.location} | {edu.graduationDate}
              </Text>
              {edu.gpa && <Text style={styles.jobMeta}>GPA: {edu.gpa}</Text>}
            </View>
          ))}
        </View>

        {/* Certifications */}
        {certifications && certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            <View style={styles.bulletList}>
              {certifications.map((cert, index) => (
                <View key={index} style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{cert}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Projects */}
        {projects && projects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
            {projects.map((project, index) => (
              <View key={index} style={{ marginBottom: 12 }}>
                <Text style={styles.jobTitle}>{project.name}</Text>
                <Text style={{ marginTop: 4, marginBottom: 4 }}>{project.description}</Text>
                <Text style={styles.jobMeta}>
                  Technologies: {project.technologies.join(', ')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
};
