"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campaign } from "@/lib/db/campaigns";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { formatDate } from "../admin-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "list" | "create" | "detail" | "edit";

interface FormData {
  type: "announcement" | "engagement";
  name: string;
  subject: string;
  previewText: string;
  headline: string;
  bodyText: string;
  features: { text: string }[];
  ctaText: string;
  ctaUrl: string;
}

const EMPTY_FORM: FormData = {
  type: "announcement",
  name: "",
  subject: "",
  previewText: "",
  headline: "",
  bodyText: "",
  features: [],
  ctaText: "See What's New",
  ctaUrl: "https://chapa.thecreativetoken.com",
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const classes: Record<string, string> = {
    draft: "bg-text-secondary/10 text-text-secondary",
    sending: "bg-amber/10 text-amber animate-pulse",
    sent: "bg-terminal-green/10 text-terminal-green",
    failed: "bg-terminal-red/10 text-terminal-red",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium font-heading ${classes[status] ?? classes.draft}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CampaignsDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null,
  );
  const [mode, setMode] = useState<ViewMode>("list");
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("juan294@gmail.com");
  const [sendingTest, setSendingTest] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch campaigns
  // -------------------------------------------------------------------------

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/campaigns");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newList: Campaign[] = data.campaigns ?? [];
      setCampaigns(newList);
      // Keep selectedCampaign in sync with refreshed data
      setSelectedCampaign((prev) =>
        prev ? (newList.find((c) => c.id === prev.id) ?? null) : null,
      );
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fireAndForget(fetchCampaigns, () => undefined);
  }, [fetchCampaigns]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          previewText: form.previewText || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setForm(EMPTY_FORM);
      setMode("list");
      await fetchCampaigns();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handlePreview = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/preview`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      setPreviewHtml(html);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSend = async (campaignId: string) => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSendResult(data.message);
      // Refresh list — the updated campaign will be in the response
      await fetchCampaigns();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setMode("list");
      setSelectedCampaign(null);
      await fetchCampaigns();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSendTest = async (campaignId: string) => {
    if (!testEmail.trim()) return;
    setSendingTest(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSendResult(data.message);
      setTestEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingTest(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;
    try {
      const res = await fetch(`/api/admin/campaigns/${selectedCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          previewText: form.previewText || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      await fetchCampaigns();
      setMode("detail");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openEdit = (campaign: Campaign) => {
    setForm({
      type: campaign.type,
      name: campaign.name,
      subject: campaign.subject,
      previewText: campaign.previewText ?? "",
      headline: campaign.headline,
      bodyText: campaign.bodyText,
      features: campaign.features,
      ctaText: campaign.ctaText,
      ctaUrl: campaign.ctaUrl,
    });
    setMode("edit");
  };

  const openDetail = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setPreviewHtml(null);
    setSendResult(null);
    setTestEmail("");
    setMode("detail");
  };

  // -------------------------------------------------------------------------
  // Form helpers
  // -------------------------------------------------------------------------

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addFeature = () => {
    setForm((prev) => ({
      ...prev,
      features: [...prev.features, { text: "" }],
    }));
  };

  const updateFeature = (index: number, text: string) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.map((f, i) => (i === index ? { text } : f)),
    }));
  };

  const removeFeature = (index: number) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  // -------------------------------------------------------------------------
  // Input styles
  // -------------------------------------------------------------------------

  const inputClass =
    "w-full rounded-lg border border-stroke bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-amber focus:outline-none";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return <div className="animate-pulse p-8 text-text-secondary">Loading campaigns...</div>;
  }

  // Error banner
  const errorBanner = error && (
    <div className="rounded-lg border border-terminal-red/20 bg-terminal-red/5 px-4 py-2 text-sm text-terminal-red mb-4">
      {error}
      <button
        onClick={() => setError(null)}
        className="ml-2 text-terminal-red/60 hover:text-terminal-red"
      >
        Dismiss
      </button>
    </div>
  );

  // =========================================================================
  // CREATE VIEW
  // =========================================================================

  if (mode === "create") {
    return (
      <div className="space-y-6">
        <h2 className="font-heading text-2xl tracking-tight text-text-primary">
          <span className="text-amber">$</span> campaigns
          <span className="text-text-secondary">/</span>new
        </h2>

        {errorBanner}

        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-stroke bg-card p-6"
        >
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-text-secondary">Campaign Type</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input type="radio" name="type" value="announcement"
                  checked={form.type === "announcement"}
                  onChange={() => updateField("type", "announcement")}
                  className="accent-amber" />
                Announcement
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input type="radio" name="type" value="engagement"
                  checked={form.type === "engagement"}
                  onChange={() => updateField("type", "engagement")}
                  className="accent-amber" />
                Engagement
              </label>
            </div>
            <p className="text-xs text-text-secondary/60">
              {form.type === "announcement"
                ? "Manual send to all users with email on file."
                : "Automated — sent when a user's score increases significantly."}
            </p>
          </fieldset>

          <div>
            <label htmlFor="create-name" className="block text-xs font-medium text-text-secondary mb-1">
              Campaign Name
            </label>
            <input
              id="create-name"
              className={inputClass}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="March 2026 Update"
              required
            />
          </div>

          <div>
            <label htmlFor="create-subject" className="block text-xs font-medium text-text-secondary mb-1">
              Email Subject
            </label>
            <input
              id="create-subject"
              className={inputClass}
              value={form.subject}
              onChange={(e) => updateField("subject", e.target.value)}
              placeholder="What's new in Chapa"
              required
            />
          </div>

          <div>
            <label htmlFor="create-preview" className="block text-xs font-medium text-text-secondary mb-1">
              Preview Text
              <span className="text-text-secondary/50 ml-1">(optional)</span>
            </label>
            <input
              id="create-preview"
              className={inputClass}
              value={form.previewText}
              onChange={(e) => updateField("previewText", e.target.value)}
              placeholder="Shown in inbox preview"
            />
          </div>

          <div>
            <label htmlFor="create-headline" className="block text-xs font-medium text-text-secondary mb-1">
              Headline
            </label>
            <input
              id="create-headline"
              className={inputClass}
              value={form.headline}
              onChange={(e) => updateField("headline", e.target.value)}
              placeholder="Your dashboard just got better"
              required
            />
          </div>

          <div>
            <label htmlFor="create-body" className="block text-xs font-medium text-text-secondary mb-1">
              Body
            </label>
            <textarea
              id="create-body"
              className={inputClass}
              value={form.bodyText}
              onChange={(e) => updateField("bodyText", e.target.value)}
              placeholder="Short paragraph about what changed..."
              rows={3}
              required
            />
            {form.type === "engagement" && (
              <p className="text-xs text-text-secondary/60 mt-1">
                Placeholders: {"{{handle}}"}, {"{{delta}}"}, {"{{tier_from}}"}, {"{{tier_to}}"}, {"{{archetype_from}}"}, {"{{archetype_to}}"}
              </p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-text-secondary">
              Feature Highlights
            </legend>
            {form.features.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  value={f.text}
                  onChange={(e) => updateFeature(i, e.target.value)}
                  placeholder="Feature description"
                  aria-label={`Feature highlight ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeFeature(i)}
                  aria-label="Remove feature"
                  className="shrink-0 rounded-lg border border-stroke px-2 text-text-secondary hover:text-terminal-red hover:border-terminal-red/20"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addFeature}
              className="text-xs text-amber hover:text-amber-light"
            >
              + Add feature
            </button>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-cta-text" className="block text-xs font-medium text-text-secondary mb-1">
                CTA Button Text
              </label>
              <input
                id="create-cta-text"
                className={inputClass}
                value={form.ctaText}
                onChange={(e) => updateField("ctaText", e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="create-cta-url" className="block text-xs font-medium text-text-secondary mb-1">
                CTA URL
              </label>
              <input
                id="create-cta-url"
                className={inputClass}
                value={form.ctaUrl}
                onChange={(e) => updateField("ctaUrl", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setMode("list")}
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white hover:bg-amber-light"
            >
              Create Draft
            </button>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  // EDIT VIEW
  // =========================================================================

  if (mode === "edit" && selectedCampaign) {
    return (
      <div className="space-y-6">
        <h2 className="font-heading text-2xl tracking-tight text-text-primary">
          <span className="text-amber">$</span> campaigns
          <span className="text-text-secondary">/</span>edit
        </h2>

        {errorBanner}

        <form
          onSubmit={handleEdit}
          className="space-y-4 rounded-xl border border-stroke bg-card p-6"
        >
          <div>
            <label htmlFor="edit-name" className="block text-xs font-medium text-text-secondary mb-1">
              Campaign Name
            </label>
            <input
              id="edit-name"
              className={inputClass}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="edit-subject" className="block text-xs font-medium text-text-secondary mb-1">
              Email Subject
            </label>
            <input
              id="edit-subject"
              className={inputClass}
              value={form.subject}
              onChange={(e) => updateField("subject", e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="edit-preview" className="block text-xs font-medium text-text-secondary mb-1">
              Preview Text
              <span className="text-text-secondary/50 ml-1">(optional)</span>
            </label>
            <input
              id="edit-preview"
              className={inputClass}
              value={form.previewText}
              onChange={(e) => updateField("previewText", e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="edit-headline" className="block text-xs font-medium text-text-secondary mb-1">
              Headline
            </label>
            <input
              id="edit-headline"
              className={inputClass}
              value={form.headline}
              onChange={(e) => updateField("headline", e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="edit-body" className="block text-xs font-medium text-text-secondary mb-1">
              Body
            </label>
            <textarea
              id="edit-body"
              className={inputClass}
              value={form.bodyText}
              onChange={(e) => updateField("bodyText", e.target.value)}
              rows={3}
              required
            />
            {form.type === "engagement" && (
              <p className="text-xs text-text-secondary/60 mt-1">
                Placeholders: {"{{handle}}"}, {"{{delta}}"}, {"{{tier_from}}"}, {"{{tier_to}}"}, {"{{archetype_from}}"}, {"{{archetype_to}}"}
              </p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-text-secondary">
              Feature Highlights
            </legend>
            {form.features.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  value={f.text}
                  onChange={(e) => updateFeature(i, e.target.value)}
                  placeholder="Feature description"
                  aria-label={`Feature highlight ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeFeature(i)}
                  aria-label="Remove feature"
                  className="shrink-0 rounded-lg border border-stroke px-2 text-text-secondary hover:text-terminal-red hover:border-terminal-red/20"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addFeature}
              className="text-xs text-amber hover:text-amber-light"
            >
              + Add feature
            </button>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-cta-text" className="block text-xs font-medium text-text-secondary mb-1">
                CTA Button Text
              </label>
              <input
                id="edit-cta-text"
                className={inputClass}
                value={form.ctaText}
                onChange={(e) => updateField("ctaText", e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="edit-cta-url" className="block text-xs font-medium text-text-secondary mb-1">
                CTA URL
              </label>
              <input
                id="edit-cta-url"
                className={inputClass}
                value={form.ctaUrl}
                onChange={(e) => updateField("ctaUrl", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setMode("detail")}
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white hover:bg-amber-light"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  // DETAIL VIEW
  // =========================================================================

  if (mode === "detail" && selectedCampaign) {
    const c = selectedCampaign;
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setMode("list");
            setSelectedCampaign(null);
            setPreviewHtml(null);
          }}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          &larr; Back to campaigns
        </button>

        {errorBanner}

        <div className="flex items-center gap-3">
          <h2 className="font-heading text-2xl tracking-tight text-text-primary">
            {c.name}
          </h2>
          <StatusBadge status={c.status} />
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-stroke bg-card p-4 text-sm">
          <dt className="text-text-secondary">Subject</dt>
          <dd className="text-text-primary">{c.subject}</dd>
          <dt className="text-text-secondary">Headline</dt>
          <dd className="text-text-primary">{c.headline}</dd>
          <dt className="text-text-secondary">Created</dt>
          <dd className="text-text-primary">{formatDate(c.createdAt)}</dd>
          {c.startedAt && (
            <>
              <dt className="text-text-secondary">Started</dt>
              <dd className="text-text-primary">{formatDate(c.startedAt)}</dd>
            </>
          )}
          {c.completedAt && (
            <>
              <dt className="text-text-secondary">Completed</dt>
              <dd className="text-text-primary">
                {formatDate(c.completedAt)}
              </dd>
            </>
          )}
        </dl>

        {/* Progress for sending campaigns */}
        {c.status === "sending" && c.totalRecipients > 0 && (
          <div className="rounded-xl border border-stroke bg-card p-4 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-stroke/30">
              <div
                className="h-full rounded-full bg-amber transition-all"
                style={{
                  width: `${Math.round((c.sentCount / c.totalRecipients) * 100)}%`,
                }}
              />
            </div>
            <p className="text-sm text-text-secondary">
              {c.sentCount} / {c.totalRecipients} sent
              {c.failedCount > 0 && (
                <span className="text-terminal-red ml-1">
                  ({c.failedCount} failed)
                </span>
              )}
            </p>
            <p className="text-xs text-text-secondary/60">
              Sends up to 95 emails/day (Free plan). Processing continues daily.
            </p>
          </div>
        )}

        {/* Send result */}
        {sendResult && (
          <div className="rounded-lg border border-terminal-green/20 bg-terminal-green/5 px-4 py-2 text-sm text-terminal-green">
            {sendResult}
          </div>
        )}

        {/* Engagement info banner */}
        {c.type === "engagement" && (
          <div className="rounded-lg border border-complement/20 bg-complement/5 px-4 py-2 text-sm text-complement-text">
            This template is sent automatically when a user&apos;s score increases by 10+ points. Enable delivery in the Engagement tab.
          </div>
        )}

        {/* Actions */}
        {c.status === "draft" && (
          <div className="flex gap-3">
            <button
              onClick={() => handlePreview(c.id)}
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary"
            >
              Preview Email
            </button>
            <button
              onClick={() => openEdit(c)}
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary"
            >
              Edit Draft
            </button>
            {c.type !== "engagement" && (
              <button
                onClick={() => handleSend(c.id)}
                disabled={sending}
                className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white hover:bg-amber-light disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send Campaign"}
              </button>
            )}
            <button
              onClick={() => handleDelete(c.id)}
              className="rounded-lg border border-terminal-red/20 px-4 py-2 text-sm font-medium text-terminal-red hover:bg-terminal-red/5"
            >
              Delete
            </button>
          </div>
        )}

        {/* Send Test Email */}
        <div className="rounded-xl border border-stroke bg-card p-4 space-y-3">
          <h3 className="font-heading text-sm text-text-secondary">
            Send Test Email
          </h3>
          <div className="flex gap-2">
            <label htmlFor="test-email" className="sr-only">Test Email Address</label>
            <input
              id="test-email"
              className={inputClass}
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <button
              onClick={() => handleSendTest(c.id)}
              disabled={sendingTest || !testEmail.trim()}
              className="shrink-0 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary disabled:opacity-50"
            >
              {sendingTest ? "Sending..." : "Send Test"}
            </button>
          </div>
          <p className="text-xs text-text-secondary/60">
            Sends one email with [TEST] prefix. Does not affect campaign status.
          </p>
        </div>

        {/* Preview iframe */}
        {previewHtml && (
          <div className="space-y-2">
            <h3 className="font-heading text-sm text-text-secondary">
              Email Preview
            </h3>
            <iframe
              srcDoc={previewHtml}
              title="Campaign email preview"
              className="w-full h-[600px] rounded-xl border border-stroke"
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // LIST VIEW
  // =========================================================================

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-heading text-2xl tracking-tight text-text-primary">
          <span className="text-amber">$</span> admin
          <span className="text-text-secondary">/</span>campaigns
        </h2>
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setMode("create");
          }}
          className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white hover:bg-amber-light"
        >
          New Campaign
        </button>
      </div>

      {errorBanner}

      <div className="rounded-xl border border-stroke bg-card overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-text-secondary">No campaigns yet</p>
            <p className="mt-1 text-xs text-text-secondary/60">
              Create your first campaign to get started.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke text-left">
                <th className="px-4 py-3 font-heading text-xs text-text-secondary">
                  Name
                </th>
                <th className="px-4 py-3 font-heading text-xs text-text-secondary">
                  Status
                </th>
                <th className="px-4 py-3 font-heading text-xs text-text-secondary">
                  Recipients
                </th>
                <th className="px-4 py-3 font-heading text-xs text-text-secondary">
                  Sent
                </th>
                <th className="px-4 py-3 font-heading text-xs text-text-secondary">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Campaign: ${c.name}`}
                  onClick={() => openDetail(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(c);
                    }
                  }}
                  className="cursor-pointer border-b border-stroke/50 hover:bg-amber/5 transition-colors"
                >
                  <td className="px-4 py-3 text-text-primary">
                    {c.name}
                    {c.type === "engagement" && (
                      <span className="ml-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-complement/10 text-complement-text font-heading">
                        engagement
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-text-secondary tabular-nums">
                    {c.totalRecipients}
                  </td>
                  <td className="px-4 py-3 text-text-secondary tabular-nums">
                    {c.sentCount} / {c.totalRecipients}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {formatDate(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
