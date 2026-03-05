#!/bin/bash
# Master Setup Script - Runs all automated setup tasks
# Run this script to verify and configure everything for launch

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════════"
echo "  ResumeBuilder AI - Complete Setup Script"
echo "  This will verify deployment and guide you through setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "✅ Current directory: $(pwd)"
echo ""

# Step 1: Install dependencies if needed
echo "📦 Step 1: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "✅ Dependencies already installed"
fi
echo ""

# Step 2: Run deployment verification
echo "🔍 Step 2: Running deployment verification..."
echo ""
if [ -f "scripts/verify-deployment.js" ]; then
    node scripts/verify-deployment.js
    VERIFY_EXIT=$?
    echo ""
    if [ $VERIFY_EXIT -ne 0 ]; then
        echo "⚠️  Deployment verification found issues"
        echo "    Review the errors above and fix before proceeding"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo "⚠️  Verification script not found, skipping..."
fi
echo ""

# Step 3: PostHog Dashboard Setup
echo "📊 Step 3: PostHog Dashboard Setup..."
echo ""
echo "PostHog requires manual setup (no API for dashboard creation yet)"
echo ""
echo "Options:"
echo "  1) Run interactive setup guide now"
echo "  2) Skip for now (you can run ./scripts/setup-posthog-dashboard.sh later)"
echo ""
read -p "Choose (1/2): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[1]$ ]]; then
    if [ -f "scripts/setup-posthog-dashboard.sh" ]; then
        bash scripts/setup-posthog-dashboard.sh
    else
        echo "⚠️  Setup script not found"
    fi
else
    echo "⏭️  Skipping PostHog setup (run ./scripts/setup-posthog-dashboard.sh later)"
fi
echo ""

# Step 4: Buttondown Email Setup
echo "✉️  Step 4: Buttondown Email Setup..."
echo ""
echo "Buttondown email templates are ready at:"
echo "  📁 scripts/buttondown-emails/"
echo ""
echo "Files:"
echo "  - email-1-welcome.html (send immediately)"
echo "  - email-2-value.html (send Day 3)"
echo "  - email-3-conversion.html (send Day 7)"
echo "  - SETUP_INSTRUCTIONS.md (full guide)"
echo ""
echo "Next steps:"
echo "  1. Go to https://buttondown.email"
echo "  2. Create 3 new emails using the templates above"
echo "  3. Set up automation (immediate, +3 days, +7 days)"
echo ""
read -p "Press Enter when Buttondown is set up (or skip for now)..."
echo "✅ Buttondown setup noted"
echo ""

# Step 5: Weekly Content Automation
echo "🤖 Step 5: Testing Weekly Content Automation..."
echo ""
echo "The /weekly-content command is configured to run every Monday at 9am"
echo ""
echo "Sample output generated at:"
echo "  📄 WEEKLY_CONTENT_PLAN_2025-02-17.md"
echo ""
echo "To test manually:"
echo "  Type: /weekly-content"
echo "  Or run it through Claude Code"
echo ""
read -p "Press Enter to continue..."
echo ""

# Step 6: Analytics Setup
echo "📈 Step 6: Analytics Configuration..."
echo ""
echo "PostHog Key: ${NEXT_PUBLIC_POSTHOG_KEY:-NOT_SET}"
echo "PostHog Host: ${NEXT_PUBLIC_POSTHOG_HOST:-NOT_SET}"
echo ""
if [ -z "$NEXT_PUBLIC_POSTHOG_KEY" ]; then
    echo "⚠️  PostHog not configured in environment"
else
    echo "✅ PostHog configured"
fi
echo ""

# Step 7: Final Checklist
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ SETUP COMPLETE - Final Checklist"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Before launching, verify:"
echo ""
echo "Infrastructure:"
echo "  [ ] Supabase tables exist (ran verification above)"
echo "  [ ] Environment variables set in .env.local"
echo "  [ ] OpenAI API key working"
echo "  [ ] Resend API key configured (for emails)"
echo ""
echo "Marketing Setup:"
echo "  [ ] PostHog dashboard created (7 insights)"
echo "  [ ] Buttondown emails imported (3 emails)"
echo "  [ ] Email automation configured (Day 0, 3, 7)"
echo "  [ ] UTM tracking spreadsheet created"
echo ""
echo "Content Ready:"
echo "  [ ] Blog post reviewed and customized"
echo "  [ ] Reddit posts ready (r/resumes, r/jobs)"
echo "  [ ] LinkedIn posts drafted (launch, value, engagement)"
echo "  [ ] Facebook groups joined"
echo "  [ ] All content has your voice/story"
echo ""
echo "Testing:"
echo "  [ ] Anonymous ATS checker works end-to-end"
echo "  [ ] Signup flow tested"
echo "  [ ] Email confirmation working"
echo "  [ ] All links have UTM parameters"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📚 Key Files for Review:"
echo "  • LAUNCH_WEEK_1_MASTER_PLAN.md - Day-by-day execution"
echo "  • BLOG_POST_DRAFT_comprehensive-ats-guide-2025.md - Blog content"
echo "  • LAUNCH_CONTENT_Reddit_Strategy.md - Reddit posts"
echo "  • LAUNCH_CONTENT_LinkedIn_Facebook.md - Social content"
echo "  • EMAIL_SEQUENCE_Buttondown.md - Email templates"
echo "  • ANALYTICS_DASHBOARD_Setup.md - Tracking guide"
echo ""
echo "🚀 Next Steps:"
echo "  1. Review and customize all content files"
echo "  2. Set up PostHog dashboard (if skipped)"
echo "  3. Import Buttondown emails (if skipped)"
echo "  4. Test the complete user flow"
echo "  5. Launch Sunday morning!"
echo ""
echo "💡 Run /weekly-content every Monday for fresh content"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Ready to launch! 🎉"
echo "═══════════════════════════════════════════════════════════"
echo ""
