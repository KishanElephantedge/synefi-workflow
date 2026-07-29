import { useEffect, useState } from 'react'
import client from '../api/client'

export default function Settings() {
  const [credentials, setCredentials] = useState([])
  const [parameters, setParameters] = useState([])
  const [credName, setCredName] = useState('')
  const [credValue, setCredValue] = useState('')
  const [paramKey, setParamKey] = useState('')
  const [paramValue, setParamValue] = useState('')
  const [paramDescription, setParamDescription] = useState('')
  const [dailyCap, setDailyCap] = useState('')
  const [dailyBudget, setDailyBudget] = useState('')
  const [personaTitles, setPersonaTitles] = useState('')
  const [heyreachApiKey, setHeyreachApiKey] = useState('')
  const [heyreachApiKeySet, setHeyreachApiKeySet] = useState(false)
  const [heyreachCampaignId, setHeyreachCampaignId] = useState('')
  const [salesrobotApiKey, setSalesrobotApiKey] = useState('')
  const [salesrobotApiKeySet, setSalesrobotApiKeySet] = useState(false)
  const [salesrobotCampaignUuid, setSalesrobotCampaignUuid] = useState('')
  const [salesrobotLinkedinAccountUuid, setSalesrobotLinkedinAccountUuid] = useState('')
  const [joboApiKey, setJoboApiKey] = useState('')
  const [joboApiKeySet, setJoboApiKeySet] = useState(false)
  const [anthropicApiKey, setAnthropicApiKey] = useState('')
  const [anthropicApiKeySet, setAnthropicApiKeySet] = useState(false)
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('')
  const [slackWebhookUrlSet, setSlackWebhookUrlSet] = useState(false)
  const [valueProposition, setValueProposition] = useState('')
  const [error, setError] = useState(null)

  const load = () => {
    client.get('/credentials').then(res => {
      setCredentials(res.data)
      const key = res.data.find(c => c.name === 'heyreach_api_key')
      setHeyreachApiKeySet(!!key?.is_set)
      const srKey = res.data.find(c => c.name === 'salesrobot_api_key')
      setSalesrobotApiKeySet(!!srKey?.is_set)
      const joboKey = res.data.find(c => c.name === 'jobo_api_key')
      setJoboApiKeySet(!!joboKey?.is_set)
      const anthropicKey = res.data.find(c => c.name === 'anthropic_api_key')
      setAnthropicApiKeySet(!!anthropicKey?.is_set)
      const slackKey = res.data.find(c => c.name === 'slack_webhook_url')
      setSlackWebhookUrlSet(!!slackKey?.is_set)
    }).catch(err => setError(err.message))
    client.get('/parameters').then(res => {
      setParameters(res.data)
      const cap = res.data.find(p => p.key === 'daily_company_cap')
      setDailyCap(cap ? String(cap.value.cap) : '5')
      const budget = res.data.find(p => p.key === 'daily_credit_budget_usd')
      setDailyBudget(budget ? String(budget.value.budget_usd) : '1')
      const titles = res.data.find(p => p.key === 'persona_titles')
      setPersonaTitles(titles ? JSON.stringify(titles.value, null, 2) : '')
      const campaignId = res.data.find(p => p.key === 'heyreach_campaign_id')
      setHeyreachCampaignId(campaignId ? String(campaignId.value.campaign_id) : '')
      const srCampaign = res.data.find(p => p.key === 'salesrobot_campaign_uuid')
      setSalesrobotCampaignUuid(srCampaign ? String(srCampaign.value.value) : '')
      const srAccount = res.data.find(p => p.key === 'salesrobot_linkedin_account_uuid')
      setSalesrobotLinkedinAccountUuid(srAccount ? String(srAccount.value.value) : '')
      const valueProp = res.data.find(p => p.key === 'core_value_proposition')
      setValueProposition(valueProp ? JSON.stringify(valueProp.value, null, 2) : '')
    }).catch(err => setError(err.message))
  }

  useEffect(load, [])

  const saveHeyreachApiKey = async (e) => {
    e.preventDefault()
    if (!heyreachApiKey.trim()) return
    try {
      await client.post('/credentials', null, { params: { name: 'heyreach_api_key', value: heyreachApiKey } })
      setHeyreachApiKey('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveHeyreachCampaignId = async (e) => {
    e.preventDefault()
    const campaignId = parseInt(heyreachCampaignId, 10)
    if (!campaignId) return
    try {
      await client.post('/parameters', { campaign_id: campaignId }, {
        params: { key: 'heyreach_campaign_id', description: 'HeyReach campaign that autonomous/manual pushes send leads into' },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveSalesrobotApiKey = async (e) => {
    e.preventDefault()
    if (!salesrobotApiKey.trim()) return
    try {
      await client.post('/credentials', null, { params: { name: 'salesrobot_api_key', value: salesrobotApiKey } })
      setSalesrobotApiKey('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveSalesrobotCampaignUuid = async (e) => {
    e.preventDefault()
    if (!salesrobotCampaignUuid.trim()) return
    try {
      await client.post('/parameters', { value: salesrobotCampaignUuid.trim() }, {
        params: { key: 'salesrobot_campaign_uuid', description: 'SalesRobot campaign that autonomous/manual pushes send leads into' },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveSalesrobotLinkedinAccountUuid = async (e) => {
    e.preventDefault()
    if (!salesrobotLinkedinAccountUuid.trim()) return
    try {
      await client.post('/parameters', { value: salesrobotLinkedinAccountUuid.trim() }, {
        params: { key: 'salesrobot_linkedin_account_uuid', description: 'SalesRobot-connected LinkedIn seat used to send from' },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveJoboApiKey = async (e) => {
    e.preventDefault()
    if (!joboApiKey.trim()) return
    try {
      await client.post('/credentials', null, { params: { name: 'jobo_api_key', value: joboApiKey } })
      setJoboApiKey('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveAnthropicApiKey = async (e) => {
    e.preventDefault()
    if (!anthropicApiKey.trim()) return
    try {
      await client.post('/credentials', null, { params: { name: 'anthropic_api_key', value: anthropicApiKey } })
      setAnthropicApiKey('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveValueProposition = async (e) => {
    e.preventDefault()
    let value
    try {
      value = JSON.parse(valueProposition)
    } catch {
      setError('Value proposition must be valid JSON')
      return
    }
    try {
      await client.post('/parameters', value, {
        params: { key: 'core_value_proposition', description: 'Our own value prop, used by Phase 13 fit analysis + message synthesis' },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveSlackWebhookUrl = async (e) => {
    e.preventDefault()
    if (!slackWebhookUrl.trim()) return
    try {
      await client.post('/credentials', null, { params: { name: 'slack_webhook_url', value: slackWebhookUrl } })
      setSlackWebhookUrl('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveDailyCap = async (e) => {
    e.preventDefault()
    const cap = parseInt(dailyCap, 10)
    if (!cap || cap < 1) return
    try {
      await client.post('/parameters', { cap }, {
        params: { key: 'daily_company_cap', description: 'Max companies the autonomous cycle selects per day' },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveDailyBudget = async (e) => {
    e.preventDefault()
    const budget_usd = parseFloat(dailyBudget)
    if (!budget_usd || budget_usd <= 0) return
    try {
      await client.post('/parameters', { budget_usd }, {
        params: { key: 'daily_credit_budget_usd', description: 'Hard USD cap on Deepline spend per autonomous cycle -- stops before the paid decision-maker phase once hit' },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const savePersonaTitles = async (e) => {
    e.preventDefault()
    let value
    try {
      value = JSON.parse(personaTitles)
    } catch {
      setError('Persona titles must be valid JSON')
      return
    }
    try {
      await client.post('/parameters', value, {
        params: { key: 'persona_titles', description: 'Persona -> title waterfall used by Phase 3 (overrides the built-in default)' },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const saveCredential = async (e) => {
    e.preventDefault()
    if (!credName.trim() || !credValue.trim()) return
    try {
      await client.post('/credentials', null, { params: { name: credName, value: credValue } })
      setCredName('')
      setCredValue('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteCredential = async (name) => {
    if (!window.confirm(`Delete credential "${name}"?`)) return
    await client.delete(`/credentials/${name}`)
    load()
  }

  const saveParameter = async (e) => {
    e.preventDefault()
    if (!paramKey.trim() || !paramValue.trim()) return
    let value
    try {
      value = JSON.parse(paramValue)
    } catch {
      // allow plain strings/numbers too, wrap as-is
      value = paramValue
    }
    try {
      await client.post('/parameters', value, { params: { key: paramKey, description: paramDescription } })
      setParamKey('')
      setParamValue('')
      setParamDescription('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="meta">HeyReach connection, autonomous system tuning, and advanced overrides.</p>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>HeyReach</h2>
        <p className="hint" style={{ marginBottom: '1rem' }}>Both fields below are required before you start the autonomous system or push a manual batch.</p>

        <form onSubmit={saveHeyreachApiKey} className="inline-form">
          <label style={{ minWidth: '10rem' }}>API key</label>
          <input
            type="password"
            placeholder={heyreachApiKeySet ? 'Currently set (enter a new value to replace)' : 'Paste your HeyReach API key'}
            value={heyreachApiKey}
            onChange={e => setHeyreachApiKey(e.target.value)}
            style={{ minWidth: '20rem' }}
          />
          <button type="submit">Save API key</button>
          {heyreachApiKeySet && <span className="status-pill on">Set</span>}
        </form>

        <form onSubmit={saveHeyreachCampaignId} className="inline-form">
          <label style={{ minWidth: '10rem' }}>Campaign ID</label>
          <input
            type="number"
            placeholder="e.g. 123456"
            value={heyreachCampaignId}
            onChange={e => setHeyreachCampaignId(e.target.value)}
            style={{ minWidth: '20rem' }}
          />
          <button type="submit">Save campaign ID</button>
        </form>
      </div>

      <div className="card">
        <h2>SalesRobot</h2>
        <p className="hint" style={{ marginBottom: '1rem' }}>The active outreach channel -- all three fields below are required before pushing a batch or running the autonomous system.</p>

        <form onSubmit={saveSalesrobotApiKey} className="inline-form">
          <label style={{ minWidth: '12rem' }}>API key</label>
          <input
            type="password"
            placeholder={salesrobotApiKeySet ? 'Currently set (enter a new value to replace)' : 'Paste your SalesRobot API key'}
            value={salesrobotApiKey}
            onChange={e => setSalesrobotApiKey(e.target.value)}
            style={{ minWidth: '20rem' }}
          />
          <button type="submit">Save API key</button>
          {salesrobotApiKeySet && <span className="status-pill on">Set</span>}
        </form>

        <form onSubmit={saveSalesrobotCampaignUuid} className="inline-form">
          <label style={{ minWidth: '12rem' }}>Campaign UUID</label>
          <input
            placeholder="e.g. 6561fd88-a82f-4eab-baea-8f0b315eccde"
            value={salesrobotCampaignUuid}
            onChange={e => setSalesrobotCampaignUuid(e.target.value)}
            style={{ minWidth: '20rem' }}
          />
          <button type="submit">Save campaign UUID</button>
        </form>

        <form onSubmit={saveSalesrobotLinkedinAccountUuid} className="inline-form">
          <label style={{ minWidth: '12rem' }}>LinkedIn account UUID</label>
          <input
            placeholder="e.g. ae7bc868-da58-425d-881b-5cd4de3a97f6"
            value={salesrobotLinkedinAccountUuid}
            onChange={e => setSalesrobotLinkedinAccountUuid(e.target.value)}
            style={{ minWidth: '20rem' }}
          />
          <button type="submit">Save LinkedIn account UUID</button>
        </form>
      </div>

      <div className="card">
        <h2>Jobo</h2>
        <p className="hint" style={{ marginBottom: '1rem' }}>Required for the Jobo discovery pipeline (bulk job search + firmographic + team-gap filtering).</p>

        <form onSubmit={saveJoboApiKey} className="inline-form">
          <label style={{ minWidth: '12rem' }}>API key</label>
          <input
            type="password"
            placeholder={joboApiKeySet ? 'Currently set (enter a new value to replace)' : 'Paste your Jobo API key'}
            value={joboApiKey}
            onChange={e => setJoboApiKey(e.target.value)}
            style={{ minWidth: '20rem' }}
          />
          <button type="submit">Save API key</button>
          {joboApiKeySet && <span className="status-pill on">Set</span>}
        </form>
      </div>

      <div className="card">
        <h2>Claude (Phase 13: Personalized Outreach)</h2>
        <p className="hint" style={{ marginBottom: '1rem' }}>Powers company/contact research and message writing. Direct Anthropic API, not routed through Deepline.</p>

        <form onSubmit={saveAnthropicApiKey} className="inline-form">
          <label style={{ minWidth: '12rem' }}>API key</label>
          <input
            type="password"
            placeholder={anthropicApiKeySet ? 'Currently set (enter a new value to replace)' : 'Paste your Anthropic API key'}
            value={anthropicApiKey}
            onChange={e => setAnthropicApiKey(e.target.value)}
            style={{ minWidth: '20rem' }}
          />
          <button type="submit">Save API key</button>
          {anthropicApiKeySet && <span className="status-pill on">Set</span>}
        </form>

        <label style={{ display: 'block', margin: '1rem 0 0.5rem' }}>Our value proposition (JSON)</label>
        <form onSubmit={saveValueProposition}>
          <textarea
            rows={8}
            value={valueProposition}
            onChange={e => setValueProposition(e.target.value)}
            placeholder='{"service": "...", "strengths": ["..."], "constraints": ["..."]}'
          />
          <div className="inline-form">
            <button type="submit">Save value proposition</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Slack</h2>
        <p className="hint" style={{ marginBottom: '1rem' }}>Incoming webhook -- sent alongside email whenever the autonomous system finds decision-makers ready for review.</p>
        <form onSubmit={saveSlackWebhookUrl} className="inline-form">
          <label style={{ minWidth: '12rem' }}>Webhook URL</label>
          <input
            type="password"
            placeholder={slackWebhookUrlSet ? 'Currently set (enter a new value to replace)' : 'https://hooks.slack.com/services/...'}
            value={slackWebhookUrl}
            onChange={e => setSlackWebhookUrl(e.target.value)}
            style={{ minWidth: '24rem' }}
          />
          <button type="submit">Save webhook URL</button>
          {slackWebhookUrlSet && <span className="status-pill on">Set</span>}
        </form>
      </div>

      <div className="card">
        <h2>Autonomous system settings</h2>
        <form onSubmit={saveDailyCap} className="inline-form">
          <label style={{ minWidth: '12rem' }}>Daily company cap</label>
          <input
            type="number"
            min="1"
            value={dailyCap}
            onChange={e => setDailyCap(e.target.value)}
            style={{ width: '5rem' }}
          />
          <button type="submit">Save cap</button>
        </form>

        <form onSubmit={saveDailyBudget} className="inline-form">
          <label style={{ minWidth: '12rem' }}>Daily credit budget (USD)</label>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={dailyBudget}
            onChange={e => setDailyBudget(e.target.value)}
            style={{ width: '5rem' }}
          />
          <button type="submit">Save budget</button>
        </form>
        <p className="hint">Hard cap -- if Phase 1 alone spends this much, the cycle skips the paid decision-maker/outreach steps for the rest of the day.</p>

        <hr className="divider" />

        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Persona title waterfalls (JSON)</label>
        <form onSubmit={savePersonaTitles}>
          <textarea
            rows={10}
            value={personaTitles}
            onChange={e => setPersonaTitles(e.target.value)}
            placeholder='{"engineering_leader": [["VP Engineering"], ["Director of Engineering"]], ...}'
          />
          <div className="inline-form">
            <button type="submit">Save persona titles</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Advanced: all credentials &amp; parameters</h2>
        <p className="hint">Everything above is saved here under the hood. Use this only for one-off keys that don't have a dedicated field yet.</p>

        <h3>Credentials</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Set?</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {(credentials || []).map(c => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>{c.is_set ? 'Yes' : 'No'}</td>
                  <td>{c.updated_at ? new Date(c.updated_at).toLocaleString() : '-'}</td>
                  <td><button type="button" className="danger" onClick={() => deleteCredential(c.name)}>Delete</button></td>
                </tr>
              ))}
              {credentials.length === 0 && (
                <tr><td colSpan={4} className="empty-state">No credentials saved yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <form onSubmit={saveCredential} className="inline-form">
          <input placeholder="name (e.g. heyreach_api_key)" value={credName} onChange={e => setCredName(e.target.value)} />
          <input placeholder="value" type="password" value={credValue} onChange={e => setCredValue(e.target.value)} />
          <button type="submit">Save credential</button>
        </form>

        <h3>Parameters</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Key</th><th>Value</th><th>Description</th></tr></thead>
            <tbody>
              {(parameters || []).map(p => (
                <tr key={p.key}>
                  <td>{p.key}</td>
                  <td><code>{JSON.stringify(p.value)}</code></td>
                  <td>{p.description}</td>
                </tr>
              ))}
              {parameters.length === 0 && (
                <tr><td colSpan={3} className="empty-state">No parameters saved yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <form onSubmit={saveParameter} className="inline-form">
          <input placeholder="key" value={paramKey} onChange={e => setParamKey(e.target.value)} />
          <input placeholder='value (JSON, e.g. {"campaign_id": 123})' value={paramValue} onChange={e => setParamValue(e.target.value)} />
          <input placeholder="description" value={paramDescription} onChange={e => setParamDescription(e.target.value)} />
          <button type="submit">Save parameter</button>
        </form>
      </div>
    </div>
  )
}
