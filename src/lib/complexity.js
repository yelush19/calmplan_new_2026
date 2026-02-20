import { COMPLEXITY_TIERS } from './theme-constants';

// Compute complexity tier (0-3) from client data
export function computeComplexityTier(client) {
  // If manually set, respect it
  if (client.complexity_level !== undefined && client.complexity_level !== null) {
    return Number(client.complexity_level);
  }

  // Auto-compute from employee_count and estimated hours
  const employees = client.employee_count || 0;
  const hours = client.business_info?.estimated_monthly_hours || {};
  const totalMinutes = Object.values(hours).reduce((sum, h) => sum + (Number(h) || 0) * 60, 0);

  if (employees < 5 && totalMinutes < 20) return 0;   // Nano
  if (employees < 15 && totalMinutes < 30) return 1;   // Simple
  if (employees < 50 && totalMinutes < 45) return 2;   // Medium
  return 3;                                              // Complex
}

// Get bubble radius based on complexity tier
export function getBubbleRadius(tier, baseRadius = 22) {
  const scale = COMPLEXITY_TIERS[tier]?.bubbleScale || 1.0;
  return Math.round(baseRadius * scale);
}

// Should auto-split tasks for this tier?
export function shouldAutoSplit(tier) {
  return tier >= 2;
}

// Get tier display info
export function getTierInfo(tier) {
  return COMPLEXITY_TIERS[tier] || COMPLEXITY_TIERS[0];
}
