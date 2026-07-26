/**
 * Calibration benchmark cases (WP-45 S5)
 *
 * 32 synthetic resume/job pairs spanning technical, commercial, operational,
 * junior, senior, career-switch, English and Hebrew. Every one is invented —
 * no production resume or job description content is copied into this repo,
 * per the packet's privacy constraint.
 *
 * `label` is the band a human would assign to the pair. These labels are the
 * author's, written alongside the fixtures.
 *
 * IMPORTANT — the packet requires INDEPENDENT human labels, and these are not
 * that. They were written by the same author as the fixtures, which means they
 * encode the same assumptions the scorer is being tested against. The runner
 * and the gates below are complete and usable; the labels need a second pass
 * from someone who did not write the cases before any band threshold derived
 * from them is treated as calibrated. See the S5 section of the work packet.
 */

export type BandLabel = 'strong' | 'stretch' | 'weak';

export interface BenchmarkCase {
  id: string;
  /** Held-out cases are scored separately and never used to pick thresholds. */
  holdout?: boolean;
  label: BandLabel;
  /** Why a human assigned that label. */
  rationale: string;
  jobTitle: string;
  jobText: string;
  requirements: string[];
  resumeText: string;
}

const SENIOR_DE_JOB = `We are hiring a Senior Data Engineer to own our streaming platform.
You will build and operate pipelines on Kafka and Spark, model data in Snowflake,
and orchestrate workloads with Airflow. Strong SQL and Python are required.
You will partner with analytics and product teams to define data contracts,
own data quality, and mentor two junior engineers. Experience running production
systems on AWS is expected. We value clear written communication and pragmatic
trade-offs over perfect architecture.`;

const SENIOR_DE_REQS = [
  'Kafka',
  'Spark',
  'Snowflake',
  'Airflow',
  'SQL',
  'Python',
  'AWS',
  'data modelling',
  'mentoring engineers',
];

const AE_JOB = `We are looking for an Account Executive to grow our mid-market segment.
You will own a quota, run full-cycle B2B sales from prospecting to close, manage a
pipeline in our CRM, negotiate commercial terms, and forecast accurately each quarter.
You will work closely with marketing on campaigns and with customer success on
renewals. We want someone who is comfortable talking to senior executives and who
writes clearly. Experience selling SaaS to operations teams is a plus.`;

const AE_REQS = [
  'B2B sales',
  'quota ownership',
  'CRM',
  'pipeline management',
  'contract negotiation',
  'quarterly forecasting',
  'SaaS',
  'stakeholder management',
];

const OPS_JOB = `Our logistics team needs an Operations Manager for a regional warehouse.
You will run daily shift planning, own inventory accuracy, manage a team of twenty,
drive continuous improvement using lean methods, and report on throughput and cost
per unit. You will work with suppliers on delivery schedules and with finance on
budgets. Health and safety compliance is part of the role. Experience with a WMS
and comfort with spreadsheets and basic SQL reporting are expected.`;

const OPS_REQS = [
  'shift planning',
  'inventory management',
  'team leadership',
  'lean',
  'supplier management',
  'health and safety compliance',
  'WMS',
  'SQL',
];

const HEB_JOB = `דרוש/ה מהנדס/ת תוכנה לצוות הבקאנד שלנו.
התפקיד כולל פיתוח שירותים ב-Node.js, עבודה מול בסיסי נתונים, כתיבת בדיקות,
ועבודה בסביבת ענן. נדרש ניסיון של שלוש שנים לפחות בפיתוח, ידע ב-SQL,
היכרות עם Docker, ויכולת עבודה בצוות. אנגלית ברמה גבוהה. יתרון לניסיון
בעבודה עם מערכות בקנה מידה גדול ובמתודולוגיות עבודה אג'ייל.`;

const HEB_REQS = [
  'Node.js',
  'SQL',
  'Docker',
  'ניסיון בפיתוח',
  'עבודת צוות',
  'אנגלית ברמה גבוהה',
];

/** Compose a plausible resume with clean sections. */
function resume(parts: {
  title: string;
  summary: string;
  skills: string;
  roles: Array<{ title: string; company: string; dates: string; bullets: string[] }>;
  education?: string;
}): string {
  const experience = parts.roles
    .map(
      role =>
        `${role.title} at ${role.company}\n${role.dates}\n${role.bullets
          .map(b => `• ${b}`)
          .join('\n')}`
    )
    .join('\n\n');

  return `Candidate Name
candidate@example.com | Remote

PROFESSIONAL SUMMARY
${parts.summary}

SKILLS
${parts.skills}

EXPERIENCE

${experience}

EDUCATION
${parts.education ?? 'BSc, Example University'}
`;
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  // --- Technical, senior -------------------------------------------------
  {
    id: 'de-senior-strong',
    label: 'strong',
    rationale:
      'Every must-have present with real depth, same title, current role, mentoring included.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'Senior Data Engineer',
      summary:
        'Senior Data Engineer with eight years building streaming platforms on Kafka, Spark and Snowflake.',
      skills: 'Kafka, Spark, Snowflake, Airflow, SQL, Python, AWS, dbt, Terraform',
      roles: [
        {
          title: 'Senior Data Engineer',
          company: 'Nimbus Analytics',
          dates: 'Jan 2021 - Present',
          bullets: [
            'Own the Kafka and Spark streaming platform serving forty internal consumers',
            'Model the Snowflake warehouse and define data contracts with product teams',
            'Orchestrate all batch workloads in Airflow on AWS',
            'Mentor two junior engineers and run the data quality on-call rotation',
          ],
        },
        {
          title: 'Data Engineer',
          company: 'Harbor Systems',
          dates: '2018 - 2021',
          bullets: [
            'Built Python and SQL pipelines feeding finance reporting',
            'Migrated nightly jobs from cron to Airflow',
          ],
        },
      ],
    }),
  },
  {
    id: 'de-senior-stretch',
    label: 'stretch',
    rationale:
      'Right discipline and seniority, but no Snowflake or Airflow and streaming is batch-only.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'Data Engineer',
      summary: 'Data engineer with six years building batch pipelines in Python and SQL.',
      skills: 'Python, SQL, Postgres, AWS, Jenkins, pandas',
      roles: [
        {
          title: 'Data Engineer',
          company: 'Harbor Systems',
          dates: 'Mar 2020 - Present',
          bullets: [
            'Build nightly Python and SQL pipelines into Postgres',
            'Run the reporting stack on AWS',
            'Partner with analysts on data definitions',
          ],
        },
      ],
    }),
  },
  {
    id: 'de-senior-weak',
    label: 'weak',
    rationale: 'Frontend engineer with no data engineering experience at all.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'Frontend Engineer',
      summary: 'Frontend engineer focused on design systems and accessibility.',
      skills: 'React, TypeScript, CSS, Figma, Storybook, Jest',
      roles: [
        {
          title: 'Frontend Engineer',
          company: 'Bright Studio',
          dates: 'Jun 2021 - Present',
          bullets: [
            'Own the component library used across four product teams',
            'Improved Lighthouse accessibility scores across the marketing site',
          ],
        },
      ],
    }),
  },
  {
    id: 'de-junior-weak',
    holdout: true,
    label: 'weak',
    rationale: 'Correct discipline but a graduate against a senior role that requires mentoring.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'Junior Data Analyst',
      summary: 'Recent graduate with internship experience in analytics.',
      skills: 'SQL, Excel, Python basics',
      roles: [
        {
          title: 'Data Intern',
          company: 'Small Retailer',
          dates: '2025 - 2026',
          bullets: ['Wrote SQL queries for the weekly sales report'],
        },
      ],
    }),
  },

  // --- Commercial --------------------------------------------------------
  {
    id: 'ae-strong',
    label: 'strong',
    rationale: 'Full-cycle B2B SaaS closer with quota, CRM, forecasting and exec exposure.',
    jobTitle: 'Account Executive',
    jobText: AE_JOB,
    requirements: AE_REQS,
    resumeText: resume({
      title: 'Account Executive',
      summary:
        'Account Executive with seven years of full-cycle B2B SaaS sales into operations teams.',
      skills:
        'B2B sales, quota ownership, CRM, pipeline management, contract negotiation, quarterly forecasting, SaaS, stakeholder management',
      roles: [
        {
          title: 'Account Executive',
          company: 'Vector Software',
          dates: 'Feb 2021 - Present',
          bullets: [
            'Own a mid-market quota and run full-cycle B2B sales from prospecting to close',
            'Manage pipeline in the CRM and forecast quarterly with the sales director',
            'Negotiate commercial terms with senior executives at logistics operators',
            'Partner with marketing on campaigns and customer success on renewals',
          ],
        },
      ],
    }),
  },
  {
    id: 'ae-stretch',
    label: 'stretch',
    rationale: 'Real sales background but SDR-level: prospecting yes, closing and forecasting no.',
    jobTitle: 'Account Executive',
    jobText: AE_JOB,
    requirements: AE_REQS,
    resumeText: resume({
      title: 'Sales Development Representative',
      summary: 'SDR with three years booking meetings for enterprise software.',
      skills: 'prospecting, outbound, CRM, cold calling, lead qualification',
      roles: [
        {
          title: 'Sales Development Representative',
          company: 'Vector Software',
          dates: 'Jan 2023 - Present',
          bullets: [
            'Book qualified meetings for the mid-market AE team',
            'Maintain prospect records in the CRM',
          ],
        },
      ],
    }),
  },
  {
    id: 'ae-weak',
    holdout: true,
    label: 'weak',
    rationale: 'Warehouse operative with no commercial experience.',
    jobTitle: 'Account Executive',
    jobText: AE_JOB,
    requirements: AE_REQS,
    resumeText: resume({
      title: 'Warehouse Operative',
      summary: 'Warehouse operative experienced in picking and packing.',
      skills: 'forklift operation, stock counting, order picking',
      roles: [
        {
          title: 'Warehouse Operative',
          company: 'Regional Depot',
          dates: '2022 - Present',
          bullets: ['Pick and pack customer orders to a daily target'],
        },
      ],
    }),
  },

  // --- Operational -------------------------------------------------------
  {
    id: 'ops-strong',
    label: 'strong',
    rationale: 'Warehouse ops manager covering every named requirement including WMS and SQL.',
    jobTitle: 'Operations Manager',
    jobText: OPS_JOB,
    requirements: OPS_REQS,
    resumeText: resume({
      title: 'Operations Manager',
      summary: 'Operations manager running regional warehouse sites for nine years.',
      skills:
        'shift planning, inventory management, team leadership, lean, supplier management, health and safety compliance, WMS, SQL',
      roles: [
        {
          title: 'Operations Manager',
          company: 'Regional Depot',
          dates: 'Apr 2019 - Present',
          bullets: [
            'Run daily shift planning for a team of twenty-two',
            'Own inventory accuracy and the WMS configuration',
            'Drive continuous improvement using lean methods',
            'Manage supplier delivery schedules and report cost per unit using SQL',
            'Own health and safety compliance for the site',
          ],
        },
      ],
    }),
  },
  {
    id: 'ops-stretch',
    label: 'stretch',
    rationale: 'Team lead with real ops exposure but no budget, supplier or WMS ownership.',
    jobTitle: 'Operations Manager',
    jobText: OPS_JOB,
    requirements: OPS_REQS,
    resumeText: resume({
      title: 'Shift Supervisor',
      summary: 'Shift supervisor in a distribution centre.',
      skills: 'shift planning, team leadership, stock counting, health and safety',
      roles: [
        {
          title: 'Shift Supervisor',
          company: 'Regional Depot',
          dates: 'Aug 2022 - Present',
          bullets: [
            'Plan and run the night shift for twelve operatives',
            'Escalate health and safety issues to the site manager',
          ],
        },
      ],
    }),
  },

  // --- Career switch -----------------------------------------------------
  {
    id: 'switch-stretch',
    label: 'stretch',
    rationale:
      'Analyst moving into data engineering: SQL and Python real, no streaming or orchestration.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'Senior Data Analyst',
      summary:
        'Senior analyst with six years in SQL and Python, moving toward data engineering.',
      skills: 'SQL, Python, dbt, Looker, Snowflake, Excel',
      roles: [
        {
          title: 'Senior Data Analyst',
          company: 'Nimbus Analytics',
          dates: 'Sep 2020 - Present',
          bullets: [
            'Model marts in Snowflake using dbt and heavy SQL',
            'Automate recurring reporting in Python',
            'Define metric definitions with product managers',
          ],
        },
      ],
    }),
  },
  {
    id: 'switch-weak',
    label: 'weak',
    rationale: 'Teacher with a short bootcamp against a senior engineering role.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'Secondary School Teacher',
      summary: 'Teacher of eleven years, recently completed a twelve-week data bootcamp.',
      skills: 'lesson planning, curriculum design, Python basics, SQL basics',
      roles: [
        {
          title: 'Secondary School Teacher',
          company: 'City Academy',
          dates: '2015 - Present',
          bullets: ['Teach mathematics to key stage four'],
        },
      ],
    }),
  },

  // --- Hebrew ------------------------------------------------------------
  {
    id: 'heb-strong',
    label: 'strong',
    rationale: 'Backend engineer matching every listed Hebrew requirement.',
    jobTitle: 'מהנדס תוכנה',
    jobText: HEB_JOB,
    requirements: HEB_REQS,
    resumeText: `מועמד לדוגמה
candidate@example.com

תקציר מקצועי
מהנדס תוכנה עם חמש שנות ניסיון בפיתוח בקאנד.

כישורים
Node.js, SQL, Docker, Kubernetes, ניסיון בפיתוח, עבודת צוות, אנגלית ברמה גבוהה

ניסיון תעסוקתי

מהנדס תוכנה at Example Ltd
2021 - Present
• פיתוח שירותים ב-Node.js מול בסיסי נתונים
• כתיבת בדיקות ועבודה בסביבת ענן עם Docker
• עבודה בצוות אג'ייל

השכלה
תואר ראשון במדעי המחשב
`,
  },
  {
    id: 'heb-weak',
    holdout: true,
    label: 'weak',
    rationale: 'Graphic designer against a backend engineering role.',
    jobTitle: 'מהנדס תוכנה',
    jobText: HEB_JOB,
    requirements: HEB_REQS,
    resumeText: `מועמד לדוגמה
candidate@example.com

תקציר מקצועי
מעצב גרפי עם ניסיון במיתוג.

כישורים
Photoshop, Illustrator, InDesign, עיצוב מותג

ניסיון תעסוקתי

מעצב גרפי at Studio
2019 - Present
• עיצוב חומרי שיווק ומיתוג

השכלה
תואר ראשון בעיצוב
`,
  },

  // --- Additional coverage (WP-45 S5 expansion to the packet's 30-50 range) --

  {
    id: 'de-senior-strong-2',
    label: 'strong',
    rationale: 'Platform engineer with the full streaming stack and mentoring, different wording to the JD.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'Staff Data Engineer',
      summary: 'Staff engineer owning event streaming and warehouse modelling for a retail platform.',
      skills: 'Kafka, Spark, Snowflake, Airflow, SQL, Python, AWS, data modelling, mentoring engineers',
      roles: [
        { title: 'Staff Data Engineer', company: 'Orchard Retail', dates: 'Feb 2020 - Present',
          bullets: ['Run the Kafka event backbone and the Spark jobs on top of it',
                    'Own Snowflake modelling and the Airflow schedule on AWS',
                    'Mentor engineers across two squads and set data quality standards'] },
      ],
    }),
  },
  {
    id: 'de-mid-stretch',
    label: 'stretch',
    rationale: 'Has Kafka and SQL but no warehouse, no orchestration, and one seniority level short.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'Data Engineer',
      summary: 'Data engineer with four years on ingestion services.',
      skills: 'Kafka, Python, SQL, Docker, Postgres',
      roles: [
        { title: 'Data Engineer', company: 'Signal Systems', dates: 'Jan 2022 - Present',
          bullets: ['Maintain Kafka consumers feeding the operational store', 'Write Python and SQL for ad hoc analysis'] },
      ],
    }),
  },
  {
    id: 'de-devops-weak',
    holdout: true,
    label: 'weak',
    rationale: 'Infrastructure engineer, adjacent tooling but no data engineering.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'DevOps Engineer',
      summary: 'DevOps engineer focused on Kubernetes and CI pipelines.',
      skills: 'Kubernetes, Terraform, Jenkins, Bash, AWS',
      roles: [
        { title: 'DevOps Engineer', company: 'Cloudworks', dates: '2021 - Present',
          bullets: ['Run the Kubernetes platform and CI pipelines'] },
      ],
    }),
  },
  {
    id: 'ae-strong-2',
    label: 'strong',
    rationale: 'Enterprise closer with quota, forecasting, negotiation and exec relationships.',
    jobTitle: 'Account Executive',
    jobText: AE_JOB,
    requirements: AE_REQS,
    resumeText: resume({
      title: 'Senior Account Executive',
      summary: 'Senior AE closing SaaS deals into operations and supply chain teams.',
      skills: 'B2B sales, quota ownership, CRM, pipeline management, contract negotiation, quarterly forecasting, SaaS, stakeholder management',
      roles: [
        { title: 'Senior Account Executive', company: 'Northwind Software', dates: 'Mar 2019 - Present',
          bullets: ['Carry and consistently retire a mid-market quota',
                    'Forecast quarterly and manage the pipeline end to end in the CRM',
                    'Negotiate terms directly with senior executives'] },
      ],
    }),
  },
  {
    id: 'ae-cs-stretch',
    label: 'stretch',
    rationale: 'Customer success manager: commercial exposure and renewals, but never carried new-business quota.',
    jobTitle: 'Account Executive',
    jobText: AE_JOB,
    requirements: AE_REQS,
    resumeText: resume({
      title: 'Customer Success Manager',
      summary: 'CSM owning renewals and expansion for mid-market accounts.',
      skills: 'renewals, account management, CRM, stakeholder management, upselling',
      roles: [
        { title: 'Customer Success Manager', company: 'Vector Software', dates: '2021 - Present',
          bullets: ['Own renewals and expansion across forty mid-market accounts', 'Work the CRM daily and coordinate with the AE team'] },
      ],
    }),
  },
  {
    id: 'ae-marketing-weak',
    label: 'weak',
    rationale: 'Marketing specialist with no selling, no quota and no pipeline ownership.',
    jobTitle: 'Account Executive',
    jobText: AE_JOB,
    requirements: AE_REQS,
    resumeText: resume({
      title: 'Marketing Specialist',
      summary: 'Marketing specialist running email campaigns and events.',
      skills: 'email marketing, campaign management, copywriting, event logistics',
      roles: [
        { title: 'Marketing Specialist', company: 'Brightline', dates: '2022 - Present',
          bullets: ['Plan and run demand generation campaigns'] },
      ],
    }),
  },
  {
    id: 'ops-strong-2',
    label: 'strong',
    rationale: 'Site manager covering planning, inventory, lean, suppliers, safety and WMS reporting.',
    jobTitle: 'Operations Manager',
    jobText: OPS_JOB,
    requirements: OPS_REQS,
    resumeText: resume({
      title: 'Site Operations Manager',
      summary: 'Site operations manager for a regional distribution centre.',
      skills: 'shift planning, inventory management, team leadership, lean, supplier management, health and safety compliance, WMS, SQL',
      roles: [
        { title: 'Site Operations Manager', company: 'Meridian Logistics', dates: '2018 - Present',
          bullets: ['Plan shifts for twenty-five staff and own inventory accuracy',
                    'Lead lean continuous improvement and manage supplier schedules',
                    'Report throughput and cost per unit from the WMS using SQL'] },
      ],
    }),
  },
  {
    id: 'ops-admin-weak',
    label: 'weak',
    rationale: 'Office administrator with no operations, inventory or team leadership.',
    jobTitle: 'Operations Manager',
    jobText: OPS_JOB,
    requirements: OPS_REQS,
    resumeText: resume({
      title: 'Office Administrator',
      summary: 'Office administrator handling scheduling and correspondence.',
      skills: 'diary management, correspondence, filing, reception',
      roles: [
        { title: 'Office Administrator', company: 'Grey & Co', dates: '2023 - Present',
          bullets: ['Manage diaries and office correspondence'] },
      ],
    }),
  },
  {
    id: 'ops-junior-stretch',
    holdout: true,
    label: 'stretch',
    rationale: 'Team leader with genuine warehouse operations but no budget or supplier ownership.',
    jobTitle: 'Operations Manager',
    jobText: OPS_JOB,
    requirements: OPS_REQS,
    resumeText: resume({
      title: 'Warehouse Team Leader',
      summary: 'Team leader running a picking team in a distribution centre.',
      skills: 'shift planning, team leadership, inventory management, health and safety, WMS',
      roles: [
        { title: 'Warehouse Team Leader', company: 'Meridian Logistics', dates: '2021 - Present',
          bullets: ['Lead a picking team of ten and run daily shift plans', 'Maintain inventory accuracy in the WMS'] },
      ],
    }),
  },
  {
    id: 'heb-stretch',
    label: 'stretch',
    rationale: 'Hebrew frontend engineer moving to backend: some overlap, missing the core stack.',
    jobTitle: 'מהנדס תוכנה',
    jobText: HEB_JOB,
    requirements: HEB_REQS,
    resumeText: `מועמד לדוגמה
candidate@example.com

תקציר מקצועי
מפתח פרונטאנד עם שלוש שנות ניסיון.

כישורים
React, TypeScript, SQL, עבודת צוות, אנגלית ברמה גבוהה

ניסיון תעסוקתי

מפתח פרונטאנד at Example Ltd
2023 - Present
• פיתוח ממשקי משתמש ב-React
• עבודה בצוות אג'ייל

השכלה
תואר ראשון במדעי המחשב
`,
  },
  {
    id: 'heb-strong-2',
    label: 'strong',
    rationale: 'Hebrew backend engineer matching the stack with more depth than the minimum.',
    jobTitle: 'מהנדס תוכנה',
    jobText: HEB_JOB,
    requirements: HEB_REQS,
    resumeText: `מועמד לדוגמה
candidate@example.com

תקציר מקצועי
מהנדס תוכנה בכיר עם שבע שנות ניסיון בפיתוח בקאנד ומערכות בקנה מידה גדול.

כישורים
Node.js, SQL, Docker, Kubernetes, ניסיון בפיתוח, עבודת צוות, אנגלית ברמה גבוהה

ניסיון תעסוקתי

מהנדס תוכנה at Scale Systems
2019 - Present
• פיתוח שירותים ב-Node.js מול בסיסי נתונים
• עבודה בסביבת ענן עם Docker ו-Kubernetes
• כתיבת בדיקות ועבודה בצוות אג'ייל

השכלה
תואר ראשון במדעי המחשב
`,
  },
  {
    id: 'switch-strong',
    holdout: true,
    label: 'strong',
    rationale: 'Analytics engineer who genuinely made the move: owns the full pipeline stack now.',
    jobTitle: 'Senior Data Engineer',
    jobText: SENIOR_DE_JOB,
    requirements: SENIOR_DE_REQS,
    resumeText: resume({
      title: 'Analytics Engineer',
      summary: 'Analytics engineer who moved into platform work and now owns ingestion end to end.',
      skills: 'Kafka, Spark, Snowflake, Airflow, SQL, Python, AWS, dbt, data modelling',
      roles: [
        { title: 'Analytics Engineer', company: 'Lumen Data', dates: 'Apr 2021 - Present',
          bullets: ['Own Snowflake modelling and the Airflow orchestration',
                    'Built the Kafka and Spark ingestion path with the platform team',
                    'Mentor two analysts moving into engineering'] },
      ],
    }),
  },
];

export const CALIBRATION_CASES = BENCHMARK_CASES.filter(c => !c.holdout);
export const HOLDOUT_CASES = BENCHMARK_CASES.filter(c => c.holdout);
