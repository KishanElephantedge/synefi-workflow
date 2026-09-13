import PlatformUsage from './PlatformUsage.jsx'
import Links from './Links.jsx'

// One Settings tab for both, per explicit instruction: platform usage (who is using the
// dashboards) and link tracking (who clicks what we send). Both answer "is anyone actually
// engaging", one for our own users and one for prospects.
export default function UsageAndLinks() {
  return (
    <div>
      <div className="v2-section-title" style={{ marginBottom: 4 }}>Platform usage</div>
      <p className="v2-table-muted" style={{ fontSize: '0.85rem', marginTop: 0, marginBottom: 14 }}>
        Who is using the dashboards — Elephant Edge and every partner — and which pages.
      </p>
      <PlatformUsage />

      <div className="v2-section-title" style={{ marginTop: 32, marginBottom: 4 }}>Tracked links</div>
      <div className="v2-card" style={{ marginBottom: 14, fontSize: '0.85rem', lineHeight: 1.55 }}>
        <strong>What this is for.</strong> When a message goes out with a plain link — like the
        Gumroad playbook link in the Digital Playbook campaign — there is no way to know if anyone
        opened it. Paste that link here and use the short link it gives you instead. The prospect
        lands on exactly the same page, and you can see how many real people clicked, when, and
        from where.
        <br />
        <br />
        To see <em>which</em> prospect clicked, send the short link with{' '}
        <code>?r=&#123;&#123;firstName&#125;&#125;</code> on the end in the SalesRobot sequence. LinkedIn's own link
        preview also “clicks” every link the moment it's sent — those are counted separately under
        “Bot / preview” so they don't inflate the real number.
      </div>
      <Links />
    </div>
  )
}
