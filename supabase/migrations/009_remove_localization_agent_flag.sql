-- Remove localization_agent feature flag — agent was removed in 910c711.
-- Chapa does not do i18n; the localization agent was added from a different project blueprint.

DELETE FROM feature_flags WHERE key = 'localization_agent';
