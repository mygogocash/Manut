import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import type {
  MnBudgetRollupDto,
  MnCostEventDto,
} from '@affine/core/modules/manut-control-plane/types';
import { useCallback, useEffect, useState } from 'react';

import * as styles from './budget-dashboard.css';
import { BudgetDrilldown } from './budget-drilldown';
import { BudgetProjectRow } from './budget-project-row';

/**
 * Manut Budget dashboard (M4).
 *
 * Top-level view for the Settings → Budget panel. Lists per-project
 * spend rollups for the selected month with utilization bars + a
 * drilldown into the most-recent cost events when a row is clicked.
 *
 * Data layer: the GraphQL operations are declared in
 * `@affine/core/modules/manut-control-plane/graphql.ts`. Wiring them
 * to the host `useQuery` hook happens at the call site (the host hook
 * varies by surface — useQuery on web, a different hook on mobile);
 * for now this component renders empty when no fetcher is provided so
 * the panel can ship behind a feature flag without a runtime crash.
 */

interface BudgetDashboardProps {
  workspaceId: string;
  /** Optional fetcher injected by the host. Returns rollups for a month. */
  fetchRollups?: (monthYear: string) => Promise<MnBudgetRollupDto[]>;
  /** Optional fetcher for the drilldown panel. */
  fetchCostEvents?: (filter: {
    projectId?: string | null;
    monthYear: string;
  }) => Promise<MnCostEventDto[]>;
}

function defaultMonthYear(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function BudgetDashboard({
  workspaceId: _workspaceId,
  fetchRollups,
  fetchCostEvents,
}: BudgetDashboardProps) {
  const [monthYear, setMonthYear] = useState(defaultMonthYear);
  const [rollups, setRollups] = useState<MnBudgetRollupDto[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [drilldown, setDrilldown] = useState<MnCostEventDto[]>([]);

  // Load rollups whenever month changes. The host provides the fetcher
  // so this component stays presentational + tree-shakeable.
  useEffect(() => {
    if (!fetchRollups) return;
    let cancelled = false;
    fetchRollups(monthYear)
      .then(rows => {
        if (!cancelled) setRollups(rows);
      })
      .catch(() => {
        /* swallow — UI shows empty state */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchRollups, monthYear]);

  useEffect(() => {
    if (!fetchCostEvents || selectedProjectId === null) {
      setDrilldown([]);
      return;
    }
    let cancelled = false;
    fetchCostEvents({ projectId: selectedProjectId, monthYear })
      .then(events => {
        if (!cancelled) setDrilldown(events);
      })
      .catch(() => {
        /* swallow — UI shows empty drilldown */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCostEvents, monthYear, selectedProjectId]);

  const handleSelect = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId);
  }, []);

  return (
    <>
      <SettingHeader
        title="Budget"
        subtitle="Workspace AI spend by project. Caps reset on the 1st of each month (UTC)."
      />
      <SettingWrapper>
        <div className={styles.wrapper}>
          <div className={styles.monthRow}>
            <span className={styles.monthLabel}>Month</span>
            <input
              className={styles.monthInput}
              type="month"
              value={monthYear}
              onChange={e => setMonthYear(e.target.value)}
            />
          </div>

          {rollups.length === 0 ? (
            <div className={styles.empty}>
              No spend recorded for {monthYear}.
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr className={styles.headerRow}>
                  <th className={styles.cell}>Project</th>
                  <th className={styles.cellRight}>Cap</th>
                  <th className={styles.cellRight}>Spent</th>
                  <th className={styles.cell}>Utilization</th>
                  <th className={styles.cellRight}>%</th>
                </tr>
              </thead>
              <tbody>
                {rollups.map(rollup => (
                  <BudgetProjectRow
                    key={`${rollup.scopeType}:${rollup.scopeId ?? 'workspace'}`}
                    rollup={rollup}
                    onSelect={handleSelect}
                  />
                ))}
              </tbody>
            </table>
          )}

          {selectedProjectId !== null && <BudgetDrilldown events={drilldown} />}
        </div>
      </SettingWrapper>
    </>
  );
}
