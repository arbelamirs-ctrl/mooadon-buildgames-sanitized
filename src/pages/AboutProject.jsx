import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

export default function AboutProject() {
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');

    :root {
      --avax-red: #E84142;
      --emerald: #10b981;
      --emerald-dim: #064e3b;
      --slate-950: #020617;
      --slate-900: #0f172a;
      --slate-800: #1e293b;
      --slate-700: #334155;
      --slate-400: #94a3b8;
      --slate-300: #cbd5e1;
      --white: #f8fafc;
    }

    .about-project {
      font-family: 'DM Sans', sans-serif;
      background: var(--slate-950);
      color: var(--slate-300);
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 48px 32px;
    }

    .about-project section { margin-bottom: 48px; }

    .header {
      border-bottom: 1px solid var(--slate-800);
      padding-bottom: 32px;
      margin-bottom: 48px;
    }

    .header-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .badge-program {
      background: rgba(232, 65, 66, 0.12);
      border: 1px solid rgba(232, 65, 66, 0.35);
      color: #f87171;
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.08em;
      padding: 4px 10px;
      border-radius: 4px;
    }

    .badge-round {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--emerald);
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.08em;
      padding: 4px 10px;
      border-radius: 4px;
    }

    .project-name {
      font-family: 'DM Serif Display', serif;
      font-size: 52px;
      color: var(--white);
      line-height: 1.1;
      letter-spacing: -0.5px;
    }

    .project-name span { color: var(--emerald); }

    .tagline {
      font-size: 18px;
      color: var(--slate-400);
      margin-top: 8px;
      font-weight: 300;
    }

    .header-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 32px;
    }

    .header-stat {
      background: var(--slate-900);
      border: 1px solid var(--slate-800);
      border-radius: 10px;
      padding: 16px 20px;
    }

    .header-stat-label {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.1em;
      color: var(--slate-400);
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .header-stat-value {
      font-size: 22px;
      font-weight: 600;
      color: var(--white);
    }

    .header-stat-value.green { color: var(--emerald); }
    .header-stat-value.red { color: #f87171; }

    .section-label {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.15em;
      color: var(--avax-red);
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    h2 {
      font-family: 'DM Serif Display', serif;
      font-size: 28px;
      color: var(--white);
      margin-bottom: 20px;
    }

    p { margin-bottom: 12px; font-size: 15px; }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .metric-card {
      background: var(--slate-900);
      border: 1px solid var(--slate-800);
      border-radius: 12px;
      padding: 24px;
      position: relative;
      overflow: hidden;
    }

    .metric-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--emerald), transparent);
    }

    .metric-card.red::before {
      background: linear-gradient(90deg, var(--avax-red), transparent);
    }

    .metric-label {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.08em;
      color: var(--slate-400);
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .metric-value {
      font-size: 36px;
      font-weight: 700;
      color: var(--white);
      line-height: 1;
      margin-bottom: 6px;
    }

    .metric-sub {
      font-size: 13px;
      color: var(--slate-400);
    }

    .metric-note {
      font-size: 11px;
      color: var(--emerald);
      margin-top: 8px;
      font-family: 'DM Mono', monospace;
    }

    .metric-note.red { color: #f87171; }

    .integration-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .integration-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--slate-900);
      border: 1px solid var(--slate-800);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 14px;
      color: var(--slate-300);
    }

    .integration-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--emerald);
      flex-shrink: 0;
    }

    .integration-dot.orange { background: #f59e0b; }

    .integration-category {
      font-size: 10px;
      font-family: 'DM Mono', monospace;
      color: var(--slate-400);
      letter-spacing: 0.05em;
    }

    .strategy-block {
      background: var(--slate-900);
      border: 1px solid var(--slate-800);
      border-left: 3px solid var(--emerald);
      border-radius: 0 12px 12px 0;
      padding: 24px;
      margin-bottom: 16px;
    }

    .strategy-block.red { border-left-color: var(--avax-red); }

    .strategy-title {
      font-weight: 600;
      color: var(--white);
      font-size: 15px;
      margin-bottom: 8px;
    }

    .strategy-body { font-size: 14px; color: var(--slate-400); }

    .why-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .why-card {
      background: var(--slate-900);
      border: 1px solid var(--slate-800);
      border-radius: 10px;
      padding: 20px;
      text-align: center;
    }

    .why-icon {
      font-size: 28px;
      margin-bottom: 10px;
    }

    .why-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--white);
      margin-bottom: 6px;
    }

    .why-body {
      font-size: 12px;
      color: var(--slate-400);
    }

    .checklist {
      list-style: none;
    }

    .checklist li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--slate-800);
      font-size: 14px;
    }

    .checklist li:last-child { border-bottom: none; }

    .check-label { color: var(--white); font-weight: 500; }
    .check-note { font-size: 12px; color: var(--slate-400); margin-top: 2px; }

    .steps {
      counter-reset: step;
    }

    .step-item {
      counter-increment: step;
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      align-items: flex-start;
    }

    .step-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(232, 65, 66, 0.15);
      border: 1px solid rgba(232, 65, 66, 0.35);
      color: #f87171;
      font-family: 'DM Mono', monospace;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .step-content { padding-top: 4px; }
    .step-title { font-weight: 600; color: var(--white); font-size: 15px; margin-bottom: 4px; }
    .step-desc { font-size: 13px; color: var(--slate-400); }

    .step-tag {
      display: inline-block;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: var(--emerald);
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 6px;
    }

    .footer {
      border-top: 1px solid var(--slate-800);
      padding-top: 24px;
      margin-top: 48px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--slate-700);
      font-family: 'DM Mono', monospace;
    }

    .mono {
      font-family: 'DM Mono', monospace;
      font-size: 12px;
      color: var(--emerald);
    }

    code {
      font-family: 'DM Mono', monospace;
      font-size: 12px;
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="about-project">
        {/* HEADER */}
        <div className="header">
          <div className="header-meta">
            <span className="badge-program">RETRO9000 · C-CHAIN ROUND</span>
            <span className="badge-round">MARCH 2026 ONWARDS</span>
          </div>
          <div className="project-name">
            Mooa<span>don</span>
          </div>
          <div className="tagline">
            Blockchain-native loyalty infrastructure for physical retail — live on Avalanche C-Chain
          </div>

          <div className="header-grid">
            <div className="header-stat">
              <div className="header-stat-label">Live Pilots</div>
              <div className="header-stat-value green">9</div>
            </div>
            <div className="header-stat">
              <div className="header-stat-label">Integrations Built</div>
              <div className="header-stat-value">13+</div>
            </div>
            <div className="header-stat">
              <div className="header-stat-label">Chain</div>
              <div className="header-stat-value red">Avalanche C</div>
            </div>
          </div>
        </div>

        {/* WHAT WE BUILD */}
        <section>
          <div className="section-label">Project Overview</div>
          <h2>What Mooadon Does</h2>
          <p>
            Mooadon is a loyalty and rewards platform built for physical retail — restaurants, boutiques, beauty salons, and fitness studios. Every purchase, reward, and redemption is settled on the Avalanche C-Chain, creating a verifiable, tamper-proof loyalty record for both merchants and customers.
          </p>
          <p>
            Unlike traditional loyalty SaaS (stamp cards, points apps), Mooadon anchors loyalty balances and token issuance on-chain. Each business has a unique company wallet and token. Customers accumulate points that are backed by real smart contract state — not a database entry that can be revoked.
          </p>
          <p>
            With 9 live pilots in premium retail already running on Avalanche Fuji Testnet, Mooadon is ready to migrate core transaction flows to mainnet — directly contributing to C-Chain AVAX burn through gas fees on every loyalty transaction.
          </p>
        </section>

        {/* METRICS */}
        <section>
          <div className="section-label">Traction & Impact</div>
          <h2>Key Metrics</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Live Business Pilots</div>
              <div className="metric-value">9</div>
              <div className="metric-sub">Premium retail brands — active, real customers</div>
              <div className="metric-note">→ Each pilot = recurring on-chain tx volume</div>
            </div>

            <div className="metric-card red">
              <div className="metric-label">On-Chain Activity</div>
              <div className="metric-value">Fuji ✓</div>
              <div className="metric-sub">All tx signed & settled via Avalanche Fuji testnet</div>
              <div className="metric-note red">→ Mainnet migration: ready to deploy</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Transaction Types</div>
              <div className="metric-value">5+</div>
              <div className="metric-sub">
                Token issuance · Point awards · Redemptions · Welcome bonus · Refund adjustments
              </div>
              <div className="metric-note">→ Each = gas fee = AVAX burned</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Integrations (Proof of Usage)</div>
              <div className="metric-value">13+</div>
              <div className="metric-sub">
                6 POS gateways · 7 CRM platforms · Shopify · WooCommerce · Stripe
              </div>
              <div className="metric-note">→ Each integration = additional tx surface</div>
            </div>
          </div>
        </section>

        {/* AVAX BURN MODEL */}
        <section>
          <div className="section-label">C-Chain Round Fit</div>
          <h2>How Mooadon Burns AVAX</h2>
          <p>
            The Retro9000 C-Chain Round rewards projects based on <strong style={{ color: 'var(--white)' }}>AVAX burned through on-chain transactions</strong>. Mooadon's architecture is purpose-built to generate consistent, recurring burn:
          </p>

          <div className="strategy-block">
            <div className="strategy-title">Per-Transaction Burns</div>
            <div className="strategy-body">
              Every loyalty event — a purchase, a redemption, a tier upgrade — triggers a smart contract call on C-Chain. Each call burns AVAX as gas. With 9 pilots each processing dozens of daily transactions, the burn is continuous and compounding.
            </div>
          </div>

          <div className="strategy-block">
            <div className="strategy-title">Token Issuance & Company Wallet Funding</div>
            <div className="strategy-body">
              When a new business onboards, Mooadon automatically deploys a company wallet (<code className="mono">createCompanyWallet</code>), generates a loyalty token (<code className="mono">generateCompanyTokens</code>), and funds the Treasury (<code className="mono">fundNewCompanyTreasury</code>). Each of these is an on-chain transaction — burned at onboarding.
            </div>
          </div>

          <div className="strategy-block red">
            <div className="strategy-title">POS & Webhook-Triggered Burns</div>
            <div className="strategy-body">
              Integrations with Tranzila, Shopify, and WooCommerce trigger real-time loyalty awards via webhook → backend → smart contract. Every physical or online sale by a connected business is an automatic on-chain event.
            </div>
          </div>
        </section>

        {/* INTEGRATIONS */}
        <section>
          <div className="section-label">Integration Count as Proof of Usage</div>
          <h2>13+ Live Integrations</h2>
          <p style={{ marginBottom: '16px' }}>
            Each integration is a multiplier on transaction volume — and therefore on AVAX burn. The broader the integration surface, the more transactions flow through Mooadon's smart contracts.
          </p>
          <div className="integration-grid">
            {[
              { name: 'Tranzila TRAPI', cat: 'POS · PAYMENT GATEWAY', orange: false },
              { name: 'CreditGuard', cat: 'POS · PAYMENT GATEWAY', orange: false },
              { name: 'Pelecard', cat: 'POS · PAYMENT GATEWAY', orange: false },
              { name: 'Cardcom', cat: 'POS · PAYMENT GATEWAY', orange: false },
              { name: 'PayPlus', cat: 'POS · PAYMENT GATEWAY', orange: false },
              { name: 'PayMe', cat: 'POS · PAYMENT GATEWAY', orange: false },
              { name: 'HubSpot', cat: 'CRM', orange: true },
              { name: 'Salesforce', cat: 'CRM', orange: true },
              { name: 'Pipedrive', cat: 'CRM', orange: true },
              { name: 'Zoho / Monday / Freshsales', cat: 'CRM · 3 PLATFORMS', orange: true },
              { name: 'Shopify OAuth', cat: 'E-COMMERCE', orange: false },
              { name: 'WooCommerce REST API', cat: 'E-COMMERCE', orange: false },
              { name: 'Stripe + Twilio', cat: 'PAYMENTS · COMMUNICATIONS', orange: false },
            ].map((item, idx) => (
              <div key={idx} className="integration-item">
                <div className={`integration-dot ${item.orange ? 'orange' : ''}`}></div>
                <div>
                  <div>{item.name}</div>
                  <div className="integration-category">{item.cat}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* L1 STRATEGY */}
        <section>
          <div className="section-label">Long-Term Vision</div>
          <h2>L1 Strategy on Avalanche</h2>
          <p>
            Mooadon's near-term goal is to maximize C-Chain AVAX burn through real retail loyalty volume. The long-term vision is to launch a purpose-built <strong style={{ color: 'var(--white)' }}>Loyalty L1 on Avalanche</strong> — a dedicated chain optimized for high-frequency, low-value loyalty transactions at scale.
          </p>

          <div className="strategy-block">
            <div className="strategy-title">Phase 1 — C-Chain (Now)</div>
            <div className="strategy-body">
              Migrate all production loyalty transactions from Fuji testnet to Avalanche C-Chain mainnet. Drive AVAX burn through 9 active pilots × daily transaction volume. Register in Retro9000 C-Chain Round and begin climbing the leaderboard.
            </div>
          </div>

          <div className="strategy-block">
            <div className="strategy-title">Phase 2 — L1 Planning (Q3–Q4 2026)</div>
            <div className="strategy-body">
              Design the Mooadon Loyalty L1: custom gas token (MUA), low-cost micro-transactions, Interchain Messaging (ICM) to bridge loyalty data back to C-Chain. Retail loyalty requires thousands of daily sub-$0.01 interactions — a dedicated L1 is the only scalable architecture.
            </div>
          </div>

          <div className="strategy-block red">
            <div className="strategy-title">Why This Fits Retro9000</div>
            <div className="strategy-body">
              Retro9000 explicitly funds projects building toward L1s and generating real C-Chain usage. Mooadon checks both boxes: 9 live pilots generating real tx volume today, and a clear roadmap to become a purpose-built Avalanche L1 for the $500B global loyalty market.
            </div>
          </div>
        </section>

        {/* WHY AVALANCHE */}
        <section>
          <div className="section-label">Technical Rationale</div>
          <h2>Why Avalanche for Loyalty</h2>
          <div className="why-grid">
            <div className="why-card">
              <div className="why-icon">⚡</div>
              <div className="why-title">Sub-second Finality</div>
              <div className="why-body">Customers can't wait 10 seconds at checkout for a loyalty point to confirm. Avalanche's finality matches POS terminal speed.</div>
            </div>
            <div className="why-card">
              <div className="why-icon">💸</div>
              <div className="why-title">Low Gas Costs</div>
              <div className="why-body">Awarding 50 loyalty points on a ₪30 purchase only makes sense if gas &lt; ₪0.10. Avalanche C-Chain delivers this at scale.</div>
            </div>
            <div className="why-card">
              <div className="why-icon">🔗</div>
              <div className="why-title">EVM Compatible</div>
              <div className="why-body">Our existing Solidity contracts deploy unchanged. No rewrite required — faster time to mainnet.</div>
            </div>
            <div className="why-card">
              <div className="why-icon">🛡️</div>
              <div className="why-title">Tamper-Proof Records</div>
              <div className="why-body">Loyalty balances on-chain cannot be revoked by the merchant — building genuine customer trust and retention.</div>
            </div>
            <div className="why-card">
              <div className="why-icon">🌐</div>
              <div className="why-title">L1 Upgrade Path</div>
              <div className="why-body">Avalanche's L1 architecture lets us launch a dedicated loyalty chain without abandoning the C-Chain ecosystem.</div>
            </div>
            <div className="why-card">
              <div className="why-icon">📊</div>
              <div className="why-title">Retro9000 Aligned</div>
              <div className="why-body">AVAX burned = proof of real usage. Every loyalty tx contributes to a publicly verifiable impact score.</div>
            </div>
          </div>
        </section>

        {/* ELIGIBILITY CHECKLIST */}
        <section>
          <div className="section-label">Retro9000 Eligibility</div>
          <h2>Checklist</h2>
          <ul className="checklist">
            {[
              {
                done: true,
                label: 'Live on Avalanche (Fuji Testnet)',
                note: 'All loyalty transactions currently processed on Fuji. Mainnet migration in progress.',
              },
              {
                done: true,
                label: 'Real on-chain transaction volume',
                note: '9 active pilots generating daily smart contract interactions: token issuance, point awards, redemptions.',
              },
              {
                done: true,
                label: 'Directly related to Avalanche C-Chain / L1s',
                note: 'Core architecture runs on C-Chain. Long-term vision is a purpose-built Loyalty L1.',
              },
              {
                done: false,
                label: 'Listed on Retro9000 Discover Projects page',
                note: 'Action required: submit project application at retro9000.avax.network',
              },
              {
                done: false,
                label: 'Mainnet deployment',
                note: 'Action required: deploy smart contracts to C-Chain mainnet and mark "Currently Live".',
              },
              {
                done: false,
                label: 'KYB / KYC completion',
                note: 'Required before grant distribution. Initiate early to avoid delays.',
              },
            ].map((item, idx) => (
              <li key={idx}>
                <div style={{ marginTop: '2px' }}>
                  {item.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" style={{ display: 'inline' }} />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" style={{ display: 'inline' }} />
                  )}
                </div>
                <div style={{ marginLeft: '-20px', paddingLeft: '20px' }}>
                  <div className="check-label">{item.label}</div>
                  <div className="check-note">{item.note}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ACTION PLAN */}
        <section>
          <div className="section-label">Next Steps</div>
          <h2>Action Plan</h2>
          <div className="steps">
            {[
              {
                num: 1,
                title: 'Deploy to C-Chain Mainnet',
                desc: 'Migrate createCompanyWallet, generateCompanyTokens, and fundNewCompanyTreasury from Fuji to mainnet. Update onchain_network config to "mainnet".',
                tag: 'HIGHEST PRIORITY',
              },
              {
                num: 2,
                title: 'Register on retro9000.avax.network',
                desc: 'Submit project profile: name, description, website, GitHub, contract addresses, and team info. Choose category: Infrastructure / Tooling or Consumer App on C-Chain.',
                tag: 'IMMEDIATE ACTION',
              },
              {
                num: 3,
                title: 'Instrument AVAX Burn Tracking',
                desc: 'Tag all smart contract calls with the company/project address so the Retro9000 leaderboard can attribute AVAX burned to Mooadon. Document tx hashes for the project dashboard.',
                tag: 'TECHNICAL',
              },
              {
                num: 4,
                title: 'Drive Transaction Volume via Pilots',
                desc: 'Activate all 9 pilots on mainnet. Each daily loyalty transaction = AVAX burned = leaderboard points. Target: 500+ on-chain events in first month.',
                tag: 'GROWTH',
              },
              {
                num: 5,
                title: 'Community Votes & Regular Updates',
                desc: 'Post weekly progress updates to the Retro9000 dashboard. Share pilot milestones, tx volume stats, and integration count. Engage community for votes — historically a factor in grant selection.',
                tag: 'ONGOING',
              },
              {
                num: 6,
                title: 'Complete KYB / KYC Early',
                desc: 'The Avalanche Foundation requires KYB/KYC before distributing grants. Initiate this process immediately after registration to avoid delays if selected.',
                tag: 'COMPLIANCE',
              },
            ].map((step) => (
              <div key={step.num} className="step-item">
                <div className="step-number">{step.num}</div>
                <div className="step-content">
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc">{step.desc}</div>
                  <span className="step-tag">{step.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <div className="footer">
          <span>MOOADON · RETRO9000 PROJECT BRIEF · MARCH 2026</span>
          <span>retro9000.avax.network</span>
        </div>
      </div>
    </>
  );
}