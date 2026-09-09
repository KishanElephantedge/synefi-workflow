// Placeholder for stage 2. The real "Content Intelligence" backend
// (app/gtm_os/content/content_opportunity.py, GET /gtm-os/content-opportunities) exists
// already, but it's hardcoded to Elephant Edge's own tenant today -- making it real per-partner
// (likely built on each partner's own ICP, see PartnerSettings.jsx) is separate follow-up work,
// not done here. This just reserves the nav slot and route.
export default function PartnerContent() {
  return (
    <div>
      <div className="partnerAccountsHeader">
        <h1>Content</h1>
        <p>Content ideas tailored to your audience -- coming soon.</p>
      </div>
      <div className="partnerCardWrap">
        <div className="partnerEmptyState">Nothing to show yet -- check back soon.</div>
      </div>
    </div>
  )
}
