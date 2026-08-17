import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'

export default function LandingPage() {
  const { user } = useTenant()
  const navigate = useNavigate()

  const handleLoginClick = () => {
    if (user) {
      navigate('/elephant-edge')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="landing-page">
      {/* Top Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="landing-logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <span className="landing-logo-text">Sales Operating System</span>
          </div>

          <nav className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#specs">System Specs</a>
            <a href="#pricing">Enterprise</a>
          </nav>

          <div className="landing-nav-actions">
            <button 
              type="button" 
              className="landing-btn-secondary" 
              onClick={handleLoginClick}
            >
              {user ? 'Go to Workspace' : 'Sign In'}
            </button>

            <button 
              type="button" 
              className="landing-btn-primary" 
              onClick={handleLoginClick}
            >
              {user ? 'Dashboard' : 'Get Started'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-container">
          <div className="landing-badge">
            <span className="landing-badge-dot"></span>
            <span>Autonomous Account-Based Marketing Platform</span>
          </div>

          <h1 className="landing-hero-title">
            Turn Live Buying & Hiring Signals Into <span className="highlight-gradient">Qualified Sales Pipeline.</span>
          </h1>

          <p className="landing-hero-subtitle">
            Scan job vacancies, evaluate firmographic signals, locate verified decision-makers, and execute multi-channel outreach campaigns autonomously.
          </p>

          <div className="landing-hero-actions">
            <button type="button" className="landing-btn-hero-primary" onClick={handleLoginClick}>
              <span>Launch Platform</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
            <button type="button" className="landing-btn-hero-secondary" onClick={() => navigate('/login')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
              <span>Login to System</span>
            </button>
          </div>

          {/* Live Pipeline Mockup Card */}
          <div className="landing-hero-mockup">
            <div className="mockup-header">
              <div className="mockup-dots">
                <span></span><span></span><span></span>
              </div>
              <div className="mockup-title">Autonomous Run Execution • Live Signal Stream</div>
              <div className="mockup-status">
                <span className="status-dot"></span> RUNNING
              </div>
            </div>

            <div className="mockup-body">
              <div className="mockup-card">
                <div className="mockup-card-header">
                  <div className="company-logo-placeholder">SR</div>
                  <div>
                    <h4>Slip Robotics</h4>
                    <p className="meta">Autonomous Logistics • 28 Employees</p>
                  </div>
                  <span className="score-badge">Score: 85/100</span>
                </div>
                
                <div className="mockup-card-grid">
                  <div className="grid-item">
                    <span className="label">Hiring Signal</span>
                    <span className="val highlight">SDR / Account Exec Vacancy</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">GTM Leadership</span>
                    <span className="val">0 Sales VPs (Founding Opportunity)</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Decision Maker</span>
                    <span className="val">Brandon Barbello (Founder & COO)</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Outreach Engine</span>
                    <span className="val success">Pushed to LinkedIn Automation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="landing-features">
        <div className="landing-section-header">
          <h2>Engineered for High-Converting Outbound</h2>
          <p>Consolidate prospecting, signal verification, and multi-channel automation into a unified engine.</p>
        </div>

        <div className="landing-features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"></path></svg>
            </div>
            <h3>Autonomous Discovery</h3>
            <p>Scrape live job boards and hiring feeds dynamically (Jobo & Sentrion APIs) to target companies actively building sales teams.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20v-4"></path></svg>
            </div>
            <h3>GTM Signal Scoring</h3>
            <p>Evaluate firmographic headcount, funding caps (&lt;$10M), revenue ranges, and executive structure point-in-time.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <h3>Decision-Maker Waterfall</h3>
            <p>Identify Founders, CEOs, and VPs instantly using waterfall data enrichment (Crustdata & Apify APIs).</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
            </div>
            <h3>LinkedIn & Email Execution</h3>
            <p>Push connection requests and personalized notes directly into SalesRobot and Smartlead for sequence execution.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
            </div>
            <h3>HubSpot CRM Sync</h3>
            <p>Automate bidirectional sync with HubSpot to register qualified leads, contacts, and score breakdowns effortlessly.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path><path d="M8 14h.01M12 14h.01M16 14h.01"></path></svg>
            </div>
            <h3>Google Calendar Scheduling</h3>
            <p>Sync booked meetings, manage demo availability, and track upcoming prospect discovery calls in real-time.</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="landing-steps">
        <div className="landing-section-header">
          <h2>How The Autonomous Loop Works</h2>
          <p>Three simple steps from signal trigger to booked meeting.</p>
        </div>

        <div className="steps-container">
          <div className="step-box">
            <div className="step-number">01</div>
            <h4>Signal Discovery</h4>
            <p>The orchestrator scans active job boards for SDR/AE postings and extracts verified company profiles.</p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-box">
            <div className="step-number">02</div>
            <h4>ICP & Hierarchy Filter</h4>
            <p>Evaluates executive leadership size, funding cap under $10M, and resolves target decision-maker contacts.</p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-box">
            <div className="step-number">03</div>
            <h4>Campaign & CRM Push</h4>
            <p>Drafts personalized notes, pushes leads to SalesRobot/HubSpot, and syncs calendar bookings automatically.</p>
          </div>
        </div>
      </section>

      {/* System Specs & Safeguards */}
      <section id="specs" className="landing-specs">
        <div className="specs-card">
          <div className="specs-left">
            <h2>Built-in Guardrails & Cost Protection</h2>
            <p>Our intelligent CreditGuard monitor prevents runaway billing by capping daily run execution costs under $1.50.</p>

            <div className="specs-metrics">
              <div className="metric">
                <span className="num">100%</span>
                <span className="lbl">Real-Time Signal Data</span>
              </div>
              <div className="metric">
                <span className="num">&lt;$1.50</span>
                <span className="lbl">Max Daily Execution Cost</span>
              </div>
              <div className="metric">
                <span className="num">0</span>
                <span className="lbl">Manual Data Entry Required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="landing-cta-footer">
        <div className="cta-container">
          <h2>Ready to Automate Your Outbound Sales Engine?</h2>
          <p>Access your operating system to discover targets, manage runs, and track campaign outcomes.</p>
          <div className="cta-actions">
            <button type="button" className="landing-btn-hero-primary" onClick={handleLoginClick}>
              {user ? 'Enter Platform' : 'Sign In to Workspace'}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="footer-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <span>Sales Operating System &copy; {new Date().getFullYear()} Elephant Edge. All rights reserved.</span>
          </div>

          <div className="footer-links">
            <button type="button" className="footer-link-btn" onClick={() => navigate('/login')}>Sign In</button>
            <a href="#features">Features</a>
            <a href="#how-it-works">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
