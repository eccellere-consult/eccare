# Sprint 1: Foundation & Critical Fixes
**Duration:** 2 weeks (July 26 - August 8, 2026)  
**Sprint Goal:** Fix deployment, stabilize infrastructure, complete core auth, set up production environment

---

## Sprint Objectives

### Primary Goals
1. ✅ Fix Hostinger 403 error and get eccare.in live
2. Set up production database and run migrations
3. Complete authentication flows (elder & caregiver)
4. Set up monitoring and error tracking
5. Create development environment documentation
6. Prepare for Voice Assistant development (Sprint 2)

### Success Criteria
- [ ] eccare.in is live and accessible
- [ ] Database is running on production with all tables
- [ ] Users can register, login, and manage profiles
- [ ] Error tracking is operational
- [ ] Team can develop locally without issues
- [ ] API documentation is up to date

---

## Week 1: Infrastructure & Deployment

### Day 1 (July 26) - Hostinger Deployment Fix
**Priority:** 🔴 Critical

#### Morning Tasks
- [x] ~~Analyze 403 error on eccare.in~~
- [x] ~~Create server.js and .htaccess files~~
- [x] ~~Push changes to GitHub~~
- [ ] **RESUME:** Connect via SSH and complete deployment
  - Get SSH password or reset it
  - Navigate to correct nodejs folder structure
  - Run deployment commands
  - Verify site is live

#### Afternoon Tasks
- [ ] Test eccare.in homepage loads correctly
- [ ] Check API routes are accessible (`/api/v1/health`)
- [ ] Verify SSL certificate is working
- [ ] Test from multiple devices/browsers

#### Blockers to Resolve
- Need SSH password for u911413127@148.135.143.32
- Need to understand Hostinger's nodejs app folder structure
- May need to configure Node.js app settings in Hostinger panel

**Deliverable:** eccare.in returns 200 status and shows homepage

---

### Day 2 (July 27) - Production Database Setup
**Priority:** 🔴 Critical

#### Morning Tasks
- [ ] Set up PostgreSQL database on hosting
  - Check if Hostinger provides PostgreSQL
  - If not, set up external DB (e.g., Supabase, Neon, Railway)
- [ ] Configure DATABASE_URL in production .env
- [ ] Test database connection from server

#### Afternoon Tasks
- [ ] Run Prisma migrations on production
  ```bash
  npx prisma migrate deploy
  ```
- [ ] Seed initial data
  - Create admin user
  - Create test elder user
  - Create test caregiver user
  - Create test family
- [ ] Verify all tables exist and are accessible
- [ ] Test a simple API endpoint that reads from DB

#### Deliverables
- [ ] Production database URL documented
- [ ] All Prisma tables created
- [ ] Seed script executed successfully
- [ ] API can read/write to production DB

---

### Day 3 (July 28) - Environment Variables & Secrets
**Priority:** 🟡 High

#### Morning Tasks
- [ ] Audit all required environment variables
  ```
  DATABASE_URL
  JWT_SECRET
  JWT_EXPIRES_IN
  ANTHROPIC_API_KEY
  FIREBASE_PROJECT_ID
  FIREBASE_PRIVATE_KEY
  FIREBASE_CLIENT_EMAIL
  NEXT_PUBLIC_API_URL
  NODE_ENV
  ```
- [ ] Create .env.example file with all required vars
- [ ] Document how to get each credential
- [ ] Set up secrets in Hostinger environment

#### Afternoon Tasks
- [ ] Test API with production environment variables
- [ ] Verify FCM (Firebase) credentials work
- [ ] Test Claude AI integration works
- [ ] Create backup of all credentials (secure storage)

#### Deliverables
- [ ] .env.example file created
- [ ] All production secrets configured
- [ ] Credentials documented in secure location

---

### Day 4 (July 29) - Error Tracking & Monitoring
**Priority:** 🟡 High

#### Morning Tasks
- [ ] Sign up for Sentry (or alternative)
- [ ] Install Sentry SDK in Next.js app
  ```bash
  npm install @sentry/nextjs
  npx @sentry/wizard -i nextjs
  ```
- [ ] Configure Sentry DSN in production
- [ ] Test error reporting (trigger a test error)

#### Afternoon Tasks
- [ ] Set up logging infrastructure
  - Create logger utility (Winston or Pino)
  - Add logging to critical API endpoints
  - Set up log levels (info, warn, error)
- [ ] Configure log storage (file or external service)
- [ ] Test logging in production

#### Deliverables
- [ ] Sentry is capturing errors in production
- [ ] Logging is operational
- [ ] Error dashboard is accessible

---

### Day 5 (July 30) - Authentication Flow Testing
**Priority:** 🟡 High

#### Morning Tasks
- [ ] Test complete registration flow (API + Web)
  - Elder registration
  - Caregiver registration
  - Verify OTP sending works
  - Verify email verification (if implemented)
- [ ] Test login flow
  - Test with correct credentials
  - Test with wrong credentials
  - Test remember me functionality

#### Afternoon Tasks
- [ ] Test session management
  - Test JWT token generation
  - Test token expiration
  - Test token refresh (if implemented)
  - Test logout
- [ ] Test role-based access
  - Elder can only access /elder routes
  - Caregiver can only access /family routes
  - Admin can access /admin routes
- [ ] Fix any auth bugs found

#### Deliverables
- [ ] All auth flows work end-to-end
- [ ] List of auth bugs (if any) documented
- [ ] Auth flows tested on mobile app

---

## Week 2: Core Features & Documentation

### Day 6 (Aug 1) - Family & Household System
**Priority:** 🟡 High

#### Morning Tasks
- [ ] Test family creation flow
  - Caregiver creates family
  - Add elder to family
  - Invite additional family members
- [ ] Test family invite flow
  - Send invite
  - Accept invite
  - View family members
- [ ] Verify permissions
  - Only family members can see each other
  - Only elder's family can see elder data

#### Afternoon Tasks
- [ ] Build/improve family management UI (web)
  - List family members
  - Add/remove members
  - Edit family details
  - Set roles (primary caregiver, etc.)
- [ ] Test on mobile app
  - View family members
  - Basic family actions

#### Deliverables
- [ ] Family system works end-to-end
- [ ] Family management UI is functional
- [ ] Mobile app shows family members

---

### Day 7 (Aug 2) - Emergency Contacts & SOS Testing
**Priority:** 🟠 Medium

#### Morning Tasks
- [ ] Test emergency contact management
  - Add contact
  - Edit contact
  - Delete contact
  - Verify contacts are saved to DB
- [ ] Test SOS creation
  - Create SOS from elder account
  - Verify SOS is saved with timestamp
  - Verify location is captured (if available)

#### Afternoon Tasks
- [ ] Test SOS notifications (basic)
  - Send push notification to family members
  - Verify notification is received
  - Test notification click behavior
- [ ] Test SOS feed in admin panel
  - View all SOS events
  - Filter by family
  - View SOS details
- [ ] Document SOS flow gaps for Sprint 2

#### Deliverables
- [ ] Emergency contacts CRUD works
- [ ] SOS can be created and stored
- [ ] Basic notifications work
- [ ] List of improvements needed for real-time alerts

---

### Day 8 (Aug 3) - API Documentation
**Priority:** 🟠 Medium

#### Morning Tasks
- [ ] Install API documentation tool (Swagger/OpenAPI)
- [ ] Document authentication endpoints
  - POST /api/v1/auth/register
  - POST /api/v1/auth/login
  - POST /api/v1/auth/logout
  - POST /api/v1/auth/send-otp
  - POST /api/v1/auth/verify-otp
  - GET /api/v1/auth/me
- [ ] Document user endpoints
  - GET /api/v1/users
  - GET /api/v1/users/:id
  - PATCH /api/v1/users/:id

#### Afternoon Tasks
- [ ] Document family endpoints
- [ ] Document emergency endpoints
- [ ] Document health/medication endpoints
- [ ] Add request/response examples
- [ ] Generate API documentation page

#### Deliverables
- [ ] API docs accessible at /api/docs
- [ ] All implemented endpoints documented
- [ ] Request/response examples provided

---

### Day 9 (Aug 4) - Development Environment Guide
**Priority:** 🟠 Medium

#### All Day Tasks
- [ ] Write comprehensive README.md
  - Project overview
  - Tech stack
  - Folder structure
  - How to run locally
  - How to run tests
  - How to deploy
- [ ] Create CONTRIBUTING.md
  - Code style guide
  - Git workflow
  - PR template
  - Commit message format
- [ ] Document database setup
  - How to run migrations
  - How to seed data
  - How to reset database
- [ ] Create setup scripts
  - `npm run setup` - installs deps, runs migrations
  - `npm run seed` - seeds development data
  - `npm run reset` - resets database
- [ ] Test setup process on fresh machine (if possible)

#### Deliverables
- [ ] README.md is complete
- [ ] CONTRIBUTING.md exists
- [ ] Setup scripts work
- [ ] New developer can get started in <30 mins

---

### Day 10 (Aug 5) - Testing Infrastructure
**Priority:** 🟢 Nice to Have

#### Morning Tasks
- [ ] Set up Jest for API testing
- [ ] Write tests for auth endpoints
  - Test registration
  - Test login
  - Test token validation
- [ ] Write tests for user endpoints
  - Test user CRUD
  - Test authorization

#### Afternoon Tasks
- [ ] Set up Playwright or Cypress for E2E testing (web)
- [ ] Write basic E2E tests
  - Test login flow
  - Test registration flow
  - Test elder home page loads
- [ ] Document how to run tests
- [ ] Set up test database

#### Deliverables
- [ ] Test suite runs successfully
- [ ] At least 10 tests written
- [ ] CI/CD pipeline runs tests (if time permits)

---

## Sprint Backlog (Prioritized)

### 🔴 Must Have (P0)
- [x] Fix Hostinger 403 error
- [ ] Production database setup and migrations
- [ ] All environment variables configured
- [ ] Authentication flows working (register, login, logout)
- [ ] Error tracking operational (Sentry)
- [ ] eccare.in is live and stable

### 🟡 Should Have (P1)
- [ ] Family/household system working
- [ ] Emergency contacts CRUD
- [ ] SOS creation and storage
- [ ] Basic push notifications
- [ ] Development environment documentation
- [ ] API documentation

### 🟠 Could Have (P2)
- [ ] Testing infrastructure
- [ ] Setup scripts
- [ ] Logging infrastructure
- [ ] Admin panel improvements
- [ ] Mobile app polish

### 🟢 Won't Have (Defer to Sprint 2)
- Voice assistant
- Medicine reminder UI
- Real-time SOS alerts
- Video calling
- Food ordering

---

## Technical Debt to Address

1. **Mobile app build configuration**
   - Ensure Expo build works for Android
   - Configure app signing
   - Test on real Android device

2. **API error handling**
   - Standardize error responses
   - Add validation to all endpoints
   - Improve error messages

3. **Database optimization**
   - Add indexes to frequently queried fields
   - Review relationships and foreign keys
   - Optimize Prisma queries

4. **Security hardening**
   - Add rate limiting to API endpoints
   - Implement CSRF protection
   - Audit JWT token security
   - Review CORS configuration

---

## Daily Standup Format

**What did you complete yesterday?**
- List completed tasks

**What will you work on today?**
- List planned tasks

**Any blockers?**
- List any issues preventing progress

---

## Sprint Ceremonies

### Sprint Planning (July 26 - Morning)
- Review BUILD_PLAN.md
- Go through Sprint 1 tasks
- Assign tasks
- Identify risks
- Set sprint goal

### Daily Standups (9:00 AM every day)
- 15 minutes max
- Share progress and blockers
- Sync on dependencies

### Sprint Review (Aug 8 - Afternoon)
- Demo working features
- Review sprint goals
- Collect feedback
- Update BUILD_PLAN.md if needed

### Sprint Retrospective (Aug 8 - End of day)
- What went well?
- What didn't go well?
- What can we improve?
- Action items for Sprint 2

---

## Definition of Done

A task is considered "done" when:
- [ ] Code is written and tested locally
- [ ] Code is committed to Git with clear commit message
- [ ] Code is pushed to GitHub
- [ ] Code is deployed to production (if applicable)
- [ ] Feature works on production
- [ ] Documentation is updated (if needed)
- [ ] No critical bugs remain

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Hostinger deployment issues | Medium | High | Have backup hosting ready (Vercel/Railway) |
| Database setup takes longer | Low | High | Use managed DB service (Supabase/Neon) |
| SSH access blocked | Low | Medium | Use Hostinger support, use File Manager as backup |
| Environment variables missing | Medium | High | Create comprehensive .env.example early |
| Team member unavailable | Medium | Medium | Cross-train on critical tasks |

---

## Sprint Metrics

### Velocity Tracking
- Total story points planned: TBD
- Story points completed: Track daily
- Burndown chart: Update daily

### Quality Metrics
- Bugs found: Track in issues
- Bugs fixed: Track resolution time
- Test coverage: Aim for >50% for critical paths
- Deployment success rate: Track deployments

---

## Communication Plan

### Primary Channel
- Slack/Discord for daily communication
- GitHub Issues for task tracking
- GitHub Projects for sprint board

### Documentation
- All decisions documented in GitHub Discussions
- Meeting notes in shared doc
- API changes logged in CHANGELOG.md

---

## Preparation for Sprint 2 (Voice Assistant)

By end of Sprint 1, prepare:
- [ ] Research voice-to-text providers
  - Google Speech-to-Text
  - OpenAI Whisper
  - Azure Speech
  - Compare pricing, accuracy, latency
- [ ] Create proof-of-concept for voice recording on mobile
- [ ] Test Claude AI intent detection with sample queries
- [ ] Design voice UI/UX mockups
- [ ] Estimate story points for Sprint 2 tasks

---

## Notes & Updates

**July 26:**
- Fixed 403 error by creating server.js and .htaccess
- Pushed changes to GitHub (commit: f7066b47)
- Need to complete SSH deployment
- Waiting for SSH password to proceed

**Add daily notes here as sprint progresses...**

---

## Sprint 1 Checklist (Quick Reference)

**Week 1:**
- [ ] Day 1: Fix Hostinger deployment ✅ (In Progress)
- [ ] Day 2: Production database setup
- [ ] Day 3: Environment variables
- [ ] Day 4: Error tracking (Sentry)
- [ ] Day 5: Auth flow testing

**Week 2:**
- [ ] Day 6: Family system testing
- [ ] Day 7: Emergency contacts & SOS
- [ ] Day 8: API documentation
- [ ] Day 9: Development guide
- [ ] Day 10: Testing infrastructure

**End of Sprint:**
- [ ] Sprint review
- [ ] Sprint retrospective
- [ ] Plan Sprint 2

---

**Last Updated:** July 26, 2026  
**Sprint Status:** 🟢 Active  
**Next Milestone:** eccare.in goes live
