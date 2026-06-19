/** Event from GET /api/v4/users/{id}/events — used to reconstruct the contribution heatmap. */
export interface GitlabEvent {
  created_at: string; // ISO timestamp
  action_name?: string; // e.g. "pushed to", "opened", "accepted", "commented on"
  push_data?: { commit_count: number } | null;
  target_type?: string | null;
}

/** Project from GET /api/v4/users/{id}/projects */
export interface GitlabProject {
  id: number;
  path_with_namespace: string; // "owner/repo"
  star_count: number;
  forks_count: number;
  namespace: { path: string };
}

/** Merge request from GET /api/v4/merge_requests */
export interface GitlabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  state: string;
  merged_at: string | null;
  author: { username: string };
}

/** A single file change from GET /projects/{id}/merge_requests/{iid}/changes */
export interface GitlabMrChange {
  diff: string;
}

/** Approvals from GET /projects/{id}/merge_requests/{iid}/approvals */
export interface GitlabApprovals {
  approved_by?: { user: { username: string } }[];
}

/** Diffstat computed from a merge request's unified diff. */
export interface GitlabMrDiffStat {
  additions: number;
  deletions: number;
  changed_files: number;
}

/** Aggregated raw data before the StatsData transform. */
export interface RawGitlabData {
  username: string;
  displayName: string;
  avatarUrl: string;
  /** Pre-bucketed by date (YYYY-MM-DD) from the Events API. */
  heatmap: { date: string; count: number }[];
  /** Per merged MR diffstat (capped). */
  mergedPRs: GitlabMrDiffStat[];
  /** Count of others' MRs the user approved (0 when approvals are Premium-gated). */
  reviewsCount: number;
  closedIssues: number;
  repos: {
    fullName: string;
    commitCount: number; // merged MR count in the project (proxy, mirrors Codeberg)
    isOwned: boolean;
    starsCount: number;
    forksCount: number;
    watchersCount: number;
  }[];
}
