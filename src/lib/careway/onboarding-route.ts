export function onboardingRedirect(
  area: "care" | "onboarding",
  profile: { onboardingComplete: boolean; deferred: boolean },
) {
  const finished = profile.onboardingComplete || profile.deferred;
  if (area === "care" && !finished) return "/onboarding";
  if (area === "onboarding" && finished) return "/home";
  return null;
}
