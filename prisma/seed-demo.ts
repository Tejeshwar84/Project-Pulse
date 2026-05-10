import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEMO_COMPANIES = ['TechNova Solutions', 'BuildSphere Systems']
const DEMO_PASSWORD = 'demo123'

interface DemoCredential {
  company: string
  name: string
  email: string
  role: string
  password: string
}

const credentials: DemoCredential[] = []

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

async function clearDemoData() {
  console.log('🗑️  Clearing existing demo data...\n')

  const companies = await prisma.company.findMany({
    where: { name: { in: DEMO_COMPANIES } },
  })

  for (const company of companies) {
    // Delete in dependency order
    await prisma.fileAttachment.deleteMany({ where: { uploadedBy: { companyId: company.id } } })
    await prisma.meetingParticipant.deleteMany({
      where: { meeting: { companyId: company.id } },
    })
    await prisma.message.deleteMany({ where: { project: { team: { companyId: company.id } } } })
    await prisma.task.deleteMany({ where: { project: { team: { companyId: company.id } } } })
    await prisma.expense.deleteMany({ where: { companyId: company.id } })
    await prisma.budgetEntry.deleteMany({ where: {} })
    await prisma.project.deleteMany({ where: { team: { companyId: company.id } } })
    await prisma.meeting.deleteMany({ where: { companyId: company.id } })
    await prisma.teamMember.deleteMany({ where: { team: { companyId: company.id } } })
    await prisma.team.deleteMany({ where: { companyId: company.id } })
    await prisma.todo.deleteMany({ where: { companyId: company.id } })
    await prisma.user.deleteMany({ where: { companyId: company.id } })
    await prisma.company.delete({ where: { id: company.id } })
  }

  console.log('✅ Demo data cleared.\n')
}

async function seedCompanies() {
  console.log('🏢 Creating companies...')

  const techNova = await prisma.company.create({
    data: {
      name: 'TechNova Solutions',
      description: 'AI-driven software innovation and digital transformation consulting.',
      currency: 'USD',
    },
  })

  const buildSphere = await prisma.company.create({
    data: {
      name: 'BuildSphere Systems',
      description: 'Enterprise infrastructure and cloud-native platform development.',
      currency: 'EUR',
    },
  })

  console.log('✅ 2 companies created.\n')
  return { techNova, buildSphere }
}

async function seedUsers(companyId: string, companyName: string) {
  console.log(`👥 Creating users for ${companyName}...`)

  const adminHash = await hashPassword(DEMO_PASSWORD)
  const admin = await prisma.user.create({
    data: {
      name: 'Alex Admin',
      email: `admin@${companyName.toLowerCase().replace(/\s+/g, '')}.demo`,
      passwordHash: adminHash,
      role: 'admin',
      verified: true,
      approvalStatus: 'approved',
      companyId,
    },
  })

  credentials.push({
    company: companyName,
    name: admin.name,
    email: admin.email,
    role: 'admin',
    password: DEMO_PASSWORD,
  })

  const managers = []
  for (let i = 1; i <= 2; i++) {
    const hash = await hashPassword(DEMO_PASSWORD)
    const manager = await prisma.user.create({
      data: {
        name: `Manager ${i}`,
        email: `manager${i}@${companyName.toLowerCase().replace(/\s+/g, '')}.demo`,
        passwordHash: hash,
        role: 'manager',
        verified: true,
        approvalStatus: 'approved',
        companyId,
      },
    })
    managers.push(manager)
    credentials.push({
      company: companyName,
      name: manager.name,
      email: manager.email,
      role: 'manager',
      password: DEMO_PASSWORD,
    })
  }

  const employees = []
  const employeeNames = ['Sarah Chen', 'Marcus Johnson', 'Priya Patel', 'Jake Wilson', 'Emma Davis', 'Luis Rodriguez']

  for (let i = 0; i < employeeNames.length; i++) {
    const hash = await hashPassword(DEMO_PASSWORD)
    const employee = await prisma.user.create({
      data: {
        name: employeeNames[i],
        email: `${employeeNames[i].toLowerCase().replace(/\s+/g, '.')}@${companyName.toLowerCase().replace(/\s+/g, '')}.demo`,
        passwordHash: hash,
        role: 'employee',
        verified: true,
        approvalStatus: 'approved',
        companyId,
      },
    })
    employees.push(employee)
    credentials.push({
      company: companyName,
      name: employee.name,
      email: employee.email,
      role: 'employee',
      password: DEMO_PASSWORD,
    })
  }

  console.log(`✅ 1 admin, 2 managers, 6 employees created.\n`)
  return { admin, managers, employees }
}

async function seedTeams(companyId: string, users: { admin: any; managers: any[]; employees: any[] }) {
  console.log('🤝 Creating teams...')

  const engineeringTeam = await prisma.team.create({
    data: {
      name: 'Engineering',
      description: 'Backend, frontend, and full-stack development.',
      companyId,
      createdBy: users.admin.id,
      members: {
        create: [
          { userId: users.managers[0].id },
          { userId: users.employees[0].id },
          { userId: users.employees[1].id },
          { userId: users.employees[2].id },
        ],
      },
    },
    include: { members: true },
  })

  const aiTeam = await prisma.team.create({
    data: {
      name: 'AI Team',
      description: 'Machine learning and AI model development.',
      companyId,
      createdBy: users.admin.id,
      members: {
        create: [
          { userId: users.managers[1].id },
          { userId: users.employees[0].id },
          { userId: users.employees[3].id },
          { userId: users.employees[4].id },
        ],
      },
    },
    include: { members: true },
  })

  const qaTeam = await prisma.team.create({
    data: {
      name: 'QA Team',
      description: 'Quality assurance and testing.',
      companyId,
      createdBy: users.admin.id,
      members: {
        create: [
          { userId: users.managers[0].id },
          { userId: users.employees[2].id },
          { userId: users.employees[5].id },
        ],
      },
    },
    include: { members: true },
  })

  console.log('✅ 3 teams created with members.\n')
  return { engineeringTeam, aiTeam, qaTeam }
}

async function seedProjects(teamId: string, managerIds: string[]) {
  console.log('📋 Creating projects with varied statuses...')

  const now = Date.now()
  const projects = []

  // Project 1: High-risk (overdue, budget warning)
  const highRisk = await prisma.project.create({
    data: {
      name: 'AI Customer Support Platform',
      description: 'Real-time AI-powered customer service chatbot with sentiment analysis.',
      status: 'at-risk',
      deadline: new Date(now - 5 * 86400000), // 5 days ago
      budget: 120000,
      spent: 98500,
      currency: 'USD',
      riskScore: 82,
      riskReason: 'Budget 82% consumed. 3 critical tasks overdue. Deadline passed.',
      teamId,
    },
  })
  projects.push(highRisk)

  // Project 2: In-progress (healthy)
  const inProgress = await prisma.project.create({
    data: {
      name: 'Smart Inventory System',
      description: 'Automated inventory tracking with ML-based demand forecasting.',
      status: 'active',
      deadline: new Date(now + 30 * 86400000),
      budget: 85000,
      spent: 32000,
      currency: 'USD',
      riskScore: 28,
      riskReason: 'On track. Budget and timeline healthy.',
      teamId,
    },
  })
  projects.push(inProgress)

  // Project 3: Upcoming (low activity)
  const upcoming = await prisma.project.create({
    data: {
      name: 'Healthcare Analytics Dashboard',
      description: 'Comprehensive analytics platform for health metrics and KPIs.',
      status: 'active',
      deadline: new Date(now + 60 * 86400000),
      budget: 150000,
      spent: 5000,
      currency: 'USD',
      riskScore: 15,
      riskReason: 'Early stage. Planning phase.',
      teamId,
    },
  })
  projects.push(upcoming)

  // Project 4: Completed
  const completed = await prisma.project.create({
    data: {
      name: 'Mobile App v1',
      description: 'iOS and Android launch of core product.',
      status: 'completed',
      deadline: new Date(now - 30 * 86400000),
      budget: 95000,
      spent: 94500,
      currency: 'USD',
      riskScore: 0,
      riskReason: 'Successfully completed on budget.',
      teamId,
    },
  })
  projects.push(completed)

  console.log('✅ 4 projects created.\n')
  return projects
}

async function seedTasks(projects: any[], employees: any[]) {
  console.log('✅ Creating tasks with intentional workload imbalance...')

  const now = Date.now()
  const overloadedEmployee = employees[0] // Sarah Chen
  const underutilizedEmployee = employees[5] // Luis Rodriguez

  // Project 1 (High-risk): Overdue tasks
  const project1Tasks = [
    {
      title: 'API design review',
      status: 'blocked',
      priority: 'high',
      assigneeId: overloadedEmployee.id,
      dueDate: new Date(now - 10 * 86400000),
      projectId: projects[0].id,
    },
    {
      title: 'NLP model training',
      status: 'in-progress',
      priority: 'high',
      assigneeId: overloadedEmployee.id,
      dueDate: new Date(now - 3 * 86400000),
      projectId: projects[0].id,
    },
    {
      title: 'Sentiment analysis implementation',
      status: 'todo',
      priority: 'high',
      assigneeId: overloadedEmployee.id,
      dueDate: new Date(now - 1 * 86400000),
      projectId: projects[0].id,
    },
    {
      title: 'Database optimization',
      status: 'blocked',
      priority: 'medium',
      assigneeId: overloadedEmployee.id,
      dueDate: new Date(now + 1 * 86400000),
      projectId: projects[0].id,
    },
    {
      title: 'Load testing',
      status: 'todo',
      priority: 'medium',
      assigneeId: overloadedEmployee.id,
      dueDate: new Date(now + 2 * 86400000),
      projectId: projects[0].id,
    },
  ]

  // Project 2 (In-progress): Balanced tasks
  const project2Tasks = [
    {
      title: 'Inventory schema design',
      status: 'done',
      priority: 'high',
      assigneeId: employees[1].id,
      dueDate: new Date(now - 15 * 86400000),
      projectId: projects[1].id,
    },
    {
      title: 'Demand forecasting ML model',
      status: 'in-progress',
      priority: 'high',
      assigneeId: employees[2].id,
      dueDate: new Date(now + 7 * 86400000),
      projectId: projects[1].id,
    },
    {
      title: 'API integration testing',
      status: 'todo',
      priority: 'medium',
      assigneeId: employees[3].id,
      dueDate: new Date(now + 10 * 86400000),
      projectId: projects[1].id,
    },
    {
      title: 'Frontend UI components',
      status: 'in-progress',
      priority: 'medium',
      assigneeId: employees[4].id,
      dueDate: new Date(now + 12 * 86400000),
      projectId: projects[1].id,
    },
  ]

  // Project 3 (Upcoming): Very few tasks
  const project3Tasks = [
    {
      title: 'Requirements gathering',
      status: 'todo',
      priority: 'medium',
      assigneeId: underutilizedEmployee.id,
      dueDate: new Date(now + 20 * 86400000),
      projectId: projects[2].id,
    },
  ]

  // Project 4 (Completed): All done
  const project4Tasks = [
    {
      title: 'Release build and deployment',
      status: 'done',
      priority: 'high',
      assigneeId: employees[1].id,
      dueDate: new Date(now - 35 * 86400000),
      projectId: projects[3].id,
    },
  ]

  const allTasks = [...project1Tasks, ...project2Tasks, ...project3Tasks, ...project4Tasks]

  for (const taskData of allTasks) {
    await prisma.task.create({ data: taskData })
  }

  console.log(`✅ ${allTasks.length} tasks created (with workload imbalance).\n`)
}

async function seedMeetings(companyId: string, users: any[]) {
  console.log('📅 Creating meetings...')

  const now = Date.now()

  // Completed meeting
  await prisma.meeting.create({
    data: {
      title: 'Q2 Planning & Project Kickoff',
      description: 'Quarterly planning and review of new initiatives.',
      dateTime: new Date(now - 2 * 86400000),
      isCompleted: true,
      completedAt: new Date(now - 1 * 86400000),
      createdBy: users[0].id,
      companyId,
      notes: 'Discussed Q2 priorities, allocated budget for new projects, assigned leads.',
      actionItems: '1. Set up project repos\n2. Onboard new team members\n3. Schedule technical reviews',
      participants: {
        create: [
          { userId: users[0].id },
          { userId: users[1].id },
          { userId: users[2].id },
        ],
      },
    },
  })

  // Upcoming meeting
  await prisma.meeting.create({
    data: {
      title: 'Weekly Standup - Engineering',
      description: 'Weekly sync for engineering team to discuss progress and blockers.',
      dateTime: new Date(now + 1 * 86400000),
      isCompleted: false,
      createdBy: users[0].id,
      companyId,
      notes: '',
      actionItems: '',
      participants: {
        create: [
          { userId: users[0].id },
          { userId: users[3].id },
          { userId: users[4].id },
        ],
      },
    },
  })

  // In-progress meeting (started an hour ago, not completed)
  await prisma.meeting.create({
    data: {
      title: 'Crisis Call - High-Risk Project',
      description: 'Emergency meeting to address project delays and risk mitigation.',
      dateTime: new Date(now - 1 * 3600000),
      isCompleted: false,
      createdBy: users[1].id,
      companyId,
      notes: 'Discussed timeline risks, budget concerns, and resource reallocation.',
      actionItems: '1. Get additional budget approval\n2. Hire contractor support\n3. Defer non-critical features',
      participants: {
        create: [
          { userId: users[1].id },
          { userId: users[3].id },
          { userId: users[5].id },
        ],
      },
    },
  })

  console.log('✅ 3 meetings created.\n')
}

async function seedTodos(employees: any[]) {
  console.log('📝 Creating personal todos...')

  const now = Date.now()

  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i]
    const todoCount = Math.floor(Math.random() * 4) + 2

    for (let j = 0; j < todoCount; j++) {
      const dueDateOffset = Math.floor(Math.random() * 30) - 10
      await prisma.todo.create({
        data: {
          title: `Personal task ${j + 1}`,
          userId: employee.id,
          companyId: employee.companyId,
          dueDate: new Date(now + dueDateOffset * 86400000),
          completed: Math.random() > 0.6,
        },
      })
    }
  }

  console.log(`✅ Personal todos created for ${employees.length} employees.\n`)
}

async function seedFileAttachments(projects: any[], users: any[]) {
  console.log('📎 Creating file attachment placeholders...')

  const fileNames = ['project_proposal.pdf', 'budget_analysis.xlsx', 'design_mockups.zip']

  for (let i = 0; i < Math.min(3, projects.length); i++) {
    await prisma.fileAttachment.create({
      data: {
        originalFileName: fileNames[i],
        generatedFileName: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileNames[i].split('.').pop()}`,
        filePath: `uploads/demo/${fileNames[i]}`,
        fileSize: Math.floor(Math.random() * 5000000) + 100000,
        mimeType: 'application/octet-stream',
        uploadedById: users[0].id,
        projectId: projects[i].id,
      },
    })
  }

  console.log('✅ 3 file attachment placeholders created.\n')
}

async function printCredentials() {
  console.log('\n' + '='.repeat(70))
  console.log('🔐 DEMO CREDENTIALS')
  console.log('='.repeat(70) + '\n')

  const credentialsByCompany: Record<string, DemoCredential[]> = {}

  for (const cred of credentials) {
    if (!credentialsByCompany[cred.company]) {
      credentialsByCompany[cred.company] = []
    }
    credentialsByCompany[cred.company].push(cred)
  }

  for (const [company, creds] of Object.entries(credentialsByCompany)) {
    console.log(`📦 ${company}`)
    console.log('-'.repeat(70))

    for (const cred of creds) {
      console.log(`  Role: ${cred.role.toUpperCase().padEnd(8)} | ${cred.name}`)
      console.log(`  Email:    ${cred.email}`)
      console.log(`  Password: ${cred.password}`)
      console.log()
    }
  }

  console.log('='.repeat(70))
  console.log(
    '✅ Demo data seeded successfully! Use the credentials above to log in.\n',
  )
}

async function main() {
  console.log('\n🌱 Seeding ProjectPulse with demo data...\n')

  try {
    await clearDemoData()

    const companies = await seedCompanies()

    // Seed TechNova
    const techNovaUsers = await seedUsers(companies.techNova.id, 'TechNova Solutions')
    const techNovaTeams = await seedTeams(companies.techNova.id, techNovaUsers)
    const techNovaProjects = await seedProjects(techNovaTeams.engineeringTeam.id, [
      techNovaUsers.managers[0].id,
      techNovaUsers.managers[1].id,
    ])
    await seedTasks(techNovaProjects, techNovaUsers.employees)
    await seedMeetings(companies.techNova.id, [
      techNovaUsers.admin,
      ...techNovaUsers.managers,
      ...techNovaUsers.employees,
    ])
    await seedTodos(techNovaUsers.employees)
    await seedFileAttachments(techNovaProjects, [techNovaUsers.admin, ...techNovaUsers.managers])

    // Seed BuildSphere
    const buildSphereUsers = await seedUsers(companies.buildSphere.id, 'BuildSphere Systems')
    const buildSphereTeams = await seedTeams(companies.buildSphere.id, buildSphereUsers)
    const buildSphereProjects = await seedProjects(buildSphereTeams.aiTeam.id, [
      buildSphereUsers.managers[0].id,
      buildSphereUsers.managers[1].id,
    ])
    await seedTasks(buildSphereProjects, buildSphereUsers.employees)
    await seedMeetings(companies.buildSphere.id, [
      buildSphereUsers.admin,
      ...buildSphereUsers.managers,
      ...buildSphereUsers.employees,
    ])
    await seedTodos(buildSphereUsers.employees)
    await seedFileAttachments(buildSphereProjects, [buildSphereUsers.admin, ...buildSphereUsers.managers])

    await printCredentials()
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
