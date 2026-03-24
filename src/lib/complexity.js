import { COMPLEXITY_TIERS } from './theme-constants';

// Compute complexity tier (0-3) from client data
export function computeComplexityTier(client) {
  // If manually set as numeric tier (0-3), respect it
  if (client.complexity_level !== undefined && client.complexity_level !== null && client.complexity_level !== '') {
    const num = Number(client.complexity_level);
    if (!isNaN(num) && num >= 0 && num <= 3) return num;
    // Handle legacy string values
    const legacyMap = { low: 0, medium: 1, high: 2 };
    if (typeof client.complexity_level === 'string' && legacyMap[client.complexity_level] !== undefined) {
      return legacyMap[client.complexity_level];
    }
  }

  // Auto-compute from employee_count and estimated hours
  const employees = client.employee_count || 0;
  const hours = client.business_info?.estimated_monthly_hours || {};
  const totalMinutes = Object.values(hours).reduce((sum, h) => sum + (Number(h) || 0) * 60, 0);

  // Check if client has ANY real data to compute from
  const hasEmployeeData = employees > 0;
  const hasHoursData = totalMinutes > 0;

  if (hasEmployeeData || hasHoursData) {
    // Compute from real data
    if (employees < 5 && totalMinutes < 20) return 0;   // Nano
    if (employees < 15 && totalMinutes < 30) return 1;   // Simple
    if (employees < 50 && totalMinutes < 45) return 2;   // Medium
    return 3;                                              // Complex
  }

  // FALLBACK: no employee/hours data — use service_types count to distribute
  // This prevents ALL clients from landing in the same tier
  const serviceCount = Array.isArray(client.service_types) ? client.service_types.length : 0;
  if (serviceCount <= 2) return 0;   // Few services → Nano
  if (serviceCount <= 4) return 1;   // Medium services → Simple
  if (serviceCount <= 6) return 2;   // Many services → Medium
  return 3;                           // Full-service → Complex
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
