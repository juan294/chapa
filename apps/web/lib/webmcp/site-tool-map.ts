export const SITE_TOOL_MAP = [
  {
    route: "/",
    goal: "Discover Chapa and route to the right page",
    tools: ["get_site_capabilities", "find_profile"],
  },
  {
    route: "/studio (and /studio?demo=1)",
    goal: "Co-design the badge; agent proposes, human confirms saves",
    tools: [
      "list_style_options",
      "apply_badge_style",
      "apply_preset",
      "preview_badge",
      "reset_badge_config",
      "save_badge_config",
      "simulate_score",
      "suggest_improvements",
      "explain_dimension",
    ],
  },
  {
    route: "/u/:handle",
    goal: "Read, compare, verify, and embed a public credential",
    tools: [
      "get_impact_profile",
      "get_impact_history",
      "verify_badge",
      "explain_dimension",
      "compare_profiles",
      "get_embed_snippet",
    ],
  },
  {
    route: "/verify/:hash",
    goal: "Confirm what a verification code proves and does not prove",
    tools: ["get_verification_record", "explain_verification"],
  },
] as const;
