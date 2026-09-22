/** Shared between server routes and client forms, so this module stays free of server-only imports. */
export const achievementCategories = ["milestone", "highlight", "coaching", "player_developed"] as const;
export type AchievementCategory = typeof achievementCategories[number];

export const achievementCategoryLabels: Record<AchievementCategory, string> = {
  milestone: "Milestone",
  highlight: "Career highlight",
  coaching: "Player or team coached",
  player_developed: "Player developed",
};

/** Section headings used on the public profile and in the PDF. */
export const achievementGroupTitles: Record<AchievementCategory, string> = {
  milestone: "Milestones",
  highlight: "Career highlights",
  coaching: "Players and teams coached",
  player_developed: "Players developed",
};
