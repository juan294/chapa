/** Heatmap entry from GET /api/v1/users/{username}/heatmap */
export interface CodebergHeatmapEntry {
  timestamp: number; // Unix epoch seconds
  contributions: number;
}

/** Repository from GET /api/v1/users/{username}/repos */
export interface CodebergRepo {
  id: number;
  name: string;
  full_name: string; // "owner/repo"
  private: boolean;
  fork: boolean;
  has_issues: boolean;
  stars_count: number;
  forks_count: number;
  watchers_count: number;
  owner: { login: string };
}

/** Pull request from GET /api/v1/repos/{owner}/{repo}/pulls */
export interface CodebergPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  user: { login: string };
}

/** Review from GET /api/v1/repos/{owner}/{repo}/pulls/{index}/reviews */
export interface CodebergReview {
  id: number;
  state: string; // "APPROVED" | "REQUEST_CHANGES" | "REQUEST_REVIEW" | "COMMENT"
  user: { login: string };
  submitted_at: string;
}

/** Issue from GET /api/v1/repos/{owner}/{repo}/issues */
export interface CodebergIssue {
  id: number;
  number: number;
  state: "open" | "closed";
  user: { login: string };
  closed_at: string | null;
}

/** Aggregated raw data before StatsData transform */
export interface RawCodebergData {
  username: string;
  displayName: string;
  avatarUrl: string;
  heatmap: CodebergHeatmapEntry[];
  mergedPRs: CodebergPullRequest[]; // Filtered: merged=true, authored by user
  reviews: CodebergReview[]; // Filtered: APPROVED + REQUEST_CHANGES, excludes self
  closedIssues: number;
  repos: {
    fullName: string;
    commitCount: number; // Computed from heatmap or commits
    isOwned: boolean;
    starsCount: number;
    forksCount: number;
    watchersCount: number;
  }[];
}
