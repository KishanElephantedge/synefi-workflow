import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MarketTrends from './MarketTrends.jsx'
import ContentStrategy from './ContentStrategy.jsx'
import { LinkedInPostsTab, BlogsTab, LinkedInArticlesTab } from './ContentPlatforms.jsx'

// 2026-08-28, explicit instruction -- Market Intelligence and Content were one long scrolling
// page; split into tabs, same shell pattern as Operations.jsx/Relationships.jsx. Uses `section`
// (not `tab`) for the same reason Operations.jsx does -- avoids colliding with any nested page's
// own `tab` param.
//
// 2026-09-19, explicit instruction -- the generic "Content" section (topic ideation chat +
// trending-topics list) is kept as-is for ideation, and three platform-specific sections were
// added alongside it: LinkedIn Posts, Blogs, LinkedIn Articles. All three list the SAME shared
// ContentOpportunity pool (content_opportunity.py) and differ only in which platform's draft
// they generate/show; Blogs additionally surfaces Content Clusters (content_pillar.py), which
// has no linkedin/linkedin_article equivalent. See ContentPlatforms.jsx.
const SECTIONS = ['Trends', 'Content', 'LinkedIn Posts', 'Blogs', 'LinkedIn Articles']
const SECTION_SLUGS = {
  trends: 'Trends', content: 'Content',
  'linkedin-posts': 'LinkedIn Posts', blogs: 'Blogs', 'linkedin-articles': 'LinkedIn Articles',
}

export default function MarketIntelligence() {
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState(SECTION_SLUGS[searchParams.get('section')] || 'Content')

  return (
    <div>
      <div className="v2-config-tabs">
        {SECTIONS.map(s => (
          <button key={s} type="button" className={`v2-config-tab${section === s ? ' active' : ''}`} onClick={() => setSection(s)}>
            {s}
          </button>
        ))}
      </div>

      {section === 'Trends' && <MarketTrends />}
      {section === 'Content' && <ContentStrategy />}
      {section === 'LinkedIn Posts' && <LinkedInPostsTab />}
      {section === 'Blogs' && <BlogsTab />}
      {section === 'LinkedIn Articles' && <LinkedInArticlesTab />}
    </div>
  )
}
