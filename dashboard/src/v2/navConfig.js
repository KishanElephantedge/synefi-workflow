// Single source of truth for V2's sidebar -- Phase 1 scope only (per CGPT.md). Every item here
// must have a matching <Route> in V2App.jsx (acceptance criterion #4).
//
// Phase 10 briefly flattened this into a single ungrouped list to match what looked like the
// reference deck's final iteration, then reverted back to grouped sections per explicit
// instruction -- keeping the original 3-group structure this app has shipped with since Phase 1.
import {
  IconListChecks,
  IconSparkles,
  IconTrendingUp,
  IconCalendar,
  IconBarChart,
  IconZap,
  IconScale,
  IconUsers,
  IconGrid,
  IconRadio,
  IconLayers,
  IconSettings,
  IconLightbulb,
  IconNetwork,
  IconActivity,
  IconDatabase,
} from './icons.jsx'

export const V2_NAV_GROUPS = [
  {
    label: 'Sales execution',
    items: [
      // Jobs to Be Done is the default V2 landing page and the first nav item, matching the
      // reference's final navigation -- `countKey` drives a real, live sidebar badge (see
      // V2Sidebar.jsx), never a hardcoded number. Briefing moved to the end of this group: now
      // that Jobs to Be Done is the actionable home screen, Briefing's governance-summary role is
      // secondary, not primary -- kept, not deleted (per prior "do not delete Briefing" decision).
      { path: 'briefing', label: 'Briefing', icon: IconSparkles },
      { path: 'jobs', label: 'Jobs to be done', icon: IconListChecks, countKey: 'jobs' },
      { path: 'meetings', label: 'Meetings', icon: IconCalendar },
      { path: 'pipeline', label: 'Pipeline', icon: IconTrendingUp },
      { path: 'revenue-pace', label: 'Revenue Pace', icon: IconBarChart },
      { path: 'efficiency', label: 'Efficiency', icon: IconZap },
      { path: 'overrides-evals', label: 'Overrides & Evals', icon: IconScale, countKey: 'overridesEvals' },
      { path: 'autonomous', label: 'Autonomous', icon: IconActivity },
    ],
  },
  {
    label: 'Look something up',
    items: [
      { path: 'accounts', label: 'Accounts', icon: IconUsers },
      { path: 'demand-grid', label: 'Demand Grid', icon: IconGrid },
      { path: 'market-intelligence', label: 'Market Intelligence', icon: IconRadio },
      { path: 'network', label: 'Network', icon: IconNetwork },
      { path: 'inbound', label: 'Inbound', icon: IconTrendingUp },
      { path: 'crm', label: 'CRM', icon: IconDatabase },
    ],
  },
  {
    label: 'Configure',
    items: [
      { path: 'icps-offerings', label: 'ICPs & Offerings', icon: IconLayers },
      { path: 'knowledge', label: 'Knowledge', icon: IconLightbulb },
      { path: 'settings', label: 'Settings', icon: IconSettings },
    ],
  },
]
