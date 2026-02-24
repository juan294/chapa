/** Paginated response wrapper — Bitbucket uses next/previous URLs */
export interface BitbucketPaginated<T> {
  values: T[];
  page: number;
  size: number; // items in this page
  pagelen: number; // page size
  next?: string; // URL for next page (absent on last page)
}

/** Workspace permission entry */
export interface BitbucketWorkspace {
  workspace: {
    slug: string;
    name: string;
  };
  permission: string; // "owner" | "collaborator" | "member"
}

/** Repository */
export interface BitbucketRepo {
  slug: string;
  full_name: string; // "workspace/repo-slug"
  is_private: boolean;
  has_issues: boolean;
  owner: { username: string };
  links: { forks: { href: string } };
}

/** Commit */
export interface BitbucketCommit {
  hash: string;
  date: string; // ISO timestamp
  message: string;
  author: {
    raw: string; // "Name <email>"
    user?: { username: string };
  };
}

/** Pull request */
export interface BitbucketPullRequest {
  id: number;
  title: string;
  state: "MERGED" | "OPEN" | "DECLINED" | "SUPERSEDED";
  author: { username: string };
  created_on: string;
  updated_on: string;
}

/** PR diffstat entry */
export interface BitbucketDiffstat {
  status: string; // "added" | "removed" | "modified" | "renamed"
  lines_added: number;
  lines_removed: number;
  old?: { path: string };
  new?: { path: string };
}

/** PR activity entry */
export interface BitbucketPrActivity {
  approval?: { user: { username: string }; date: string };
  comment?: { user: { username: string }; content: { raw: string } };
  changes_requested?: { user: { username: string }; date: string };
}

/** Issue */
export interface BitbucketIssue {
  id: number;
  state: string; // "resolved" | "open" | etc.
  assignee?: { username: string };
}

/** Aggregated raw data before StatsData transform */
export interface RawBitbucketData {
  username: string;
  displayName: string;
  avatarUrl: string;
  commits: BitbucketCommit[]; // all commits by user across repos
  mergedPRs: {
    pr: BitbucketPullRequest;
    diffstat: BitbucketDiffstat[];
  }[];
  reviewActivities: BitbucketPrActivity[]; // approvals + change requests by user
  closedIssues: number;
  repos: {
    fullName: string;
    commitCount: number; // commits by this user in this repo
    isOwned: boolean; // user is repo owner
    forkCount: number; // forks of this repo (only for owned repos)
  }[];
}
