import { useMemo } from 'react';
import {
  BOARD_CATEGORIES,
  CATEGORY_GRADIENTS,
  STATUS_PRIORITY,
  getWorstStatus,
  getPrimaryCategoryForClient,
  getCategoriesForClient,
} from '@/lib/theme-constants';
import { computeComplexityTier, getBubbleRadius } from '@/lib/complexity';

const HUB_RADIUS = 55;
const CATEGORY_RADIUS = 42;
const CLIENT_BASE_RADIUS = 22;
const RING1_DISTANCE = 240;       // Distance from center to category nodes
const RING2_BASE_DISTANCE = 140;  // Base distance from category to client nodes
const MIN_CLIENT_GAP = 14;        // Minimum gap between client bubble edges
const COLLISION_ITERATIONS = 3;   // Number of collision resolution passes

// ---------- STATUS-DRIVEN PRIORITY ----------
// Higher priority = closer to center; issue/filing are highest
const STATUS_RING_PRIORITY = {
  issue: 5,
  ready_for_reporting: 4,
  in_progress: 3,
  waiting_for_materials: 2,
  waiting_for_external: 2,
  waiting_for_approval: 2,
  reported_waiting_for_payment: 1,
  not_started: 0,
  postponed: 0,
  completed: -1,   // Pushed to outer edges
};

function getStatusPriority(status) {
  return STATUS_RING_PRIORITY[status] ?? 0;
}

// ---------- DATA HELPERS ----------

function aggregateStatus(items) {
  if (!items || items.length === 0) return 'not_started';
  const statuses = items.map(item => item.status || 'not_started');
  return getWorstStatus(statuses);
}

function getClientTasks(client, allTasks) {
  return allTasks.filter(task => {
    if (task.client_id && task.client_id === client.id) return true;
    if (task.client_name && client.name && task.client_name === client.name) return true;
    return false;
  });
}

function getClientReconciliations(client, allReconciliations) {
  return allReconciliations.filter(r => r.client_id === client.id);
}

function getTaskBoardCategory(task) {
  const cat = task.category || '';
  for (const board of BOARD_CATEGORIES) {
    if (board.taskCategories.some(tc => cat === tc || cat.includes(tc.replace('work_', '')))) {
      return board.id;
    }
  }
  return null;
}

function computeCategoryStatuses(client, clientTasks, clientRecons) {
  const result = {};
  for (const board of BOARD_CATEGORIES) {
    const clientServiceTypes = client.service_types || [];
    const isSubscribed = board.serviceTypes.some(st => clientServiceTypes.includes(st));
    if (!isSubscribed) continue;

    let items = [];
    if (board.usesReconciliationEntity) {
      items = clientRecons;
    } else {
      items = clientTasks.filter(t => {
        const taskCat = t.category || '';
        return board.taskCategories.some(tc => taskCat === tc || taskCat.includes(tc.replace('work_', '')));
      });
    }

    result[board.id] = {
      status: aggregateStatus(items),
      taskCount: items.length,
      completedCount: items.filter(i => i.status === 'completed').length,
    };
  }
  return result;
}

function computeClientRadius(client) {
  const tier = computeComplexityTier(client);
  return getBubbleRadius(tier, CLIENT_BASE_RADIUS);
}

// ---------- COLLISION DETECTION ----------

function resolveCollisions(nodes, iterations = COLLISION_ITERATIONS) {
  // Only resolve collisions among client nodes
  const clientNodes = nodes.filter(n => n.type === 'client');
  if (clientNodes.length < 2) return;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < clientNodes.length; i++) {
      for (let j = i + 1; j < clientNodes.length; j++) {
        const a = clientNodes[i];
        const b = clientNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius + MIN_CLIENT_GAP;

        if (dist < minDist && dist > 0) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
  }
}

// ---------- MAIN LAYOUT HOOK ----------

export function useMindMapLayout({ clients, tasks, reconciliations }) {
  return useMemo(() => {
    const nodes = [];
    const edges = [];

    const activeClients = (clients || []).filter(c =>
      c.status === 'active' || c.status === 'onboarding_pending' || !c.status
    );
    const allTasks = tasks || [];
    const allRecons = reconciliations || [];

    // === CENTER HUB NODE ===
    nodes.push({
      id: 'hub',
      type: 'hub',
      x: 0,
      y: 0,
      radius: HUB_RADIUS,
      label: 'היום שלי',
      gradientFrom: '#10b981',
      gradientTo: '#059669',
      status: 'active',
      data: {
        clientCount: activeClients.length,
        taskCount: allTasks.length,
      },
    });

    // === RING 1: CATEGORY NODES ===
    // Include categories that either have clients OR are marked alwaysVisible
    const categoriesToShow = BOARD_CATEGORIES.filter(cat => {
      if (cat.alwaysVisible) return true;
      return activeClients.some(c => {
        const st = c.service_types || [];
        return cat.serviceTypes.some(s => st.includes(s));
      });
    });

    // If nothing matches at all, show all
    const finalCategories = categoriesToShow.length > 0 ? categoriesToShow : BOARD_CATEGORIES;
    const categoryAngleStep = (2 * Math.PI) / finalCategories.length;
    const categoryNodeMap = {};

    finalCategories.forEach((cat, i) => {
      const angle = categoryAngleStep * i - Math.PI / 2;
      const x = Math.cos(angle) * RING1_DISTANCE;
      const y = Math.sin(angle) * RING1_DISTANCE;

      const catTasks = allTasks.filter(t => {
        const taskCat = t.category || '';
        return cat.taskCategories.some(tc => taskCat === tc || taskCat.includes(tc.replace('work_', '')));
      });
      const catRecons = cat.usesReconciliationEntity ? allRecons : [];
      const allItems = [...catTasks, ...catRecons];
      const completedCount = allItems.filter(i => i.status === 'completed').length;
      const totalCount = allItems.length;

      const catNode = {
        id: `cat-${cat.id}`,
        type: 'category',
        x,
        y,
        radius: CATEGORY_RADIUS,
        label: cat.label,
        categoryId: cat.id,
        gradientFrom: cat.gradient.from,
        gradientTo: cat.gradient.to,
        status: aggregateStatus(allItems),
        data: {
          totalCount,
          completedCount,
          progress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        },
      };

      nodes.push(catNode);
      categoryNodeMap[cat.id] = catNode;

      edges.push({
        id: `hub-to-${cat.id}`,
        from: 'hub',
        to: `cat-${cat.id}`,
        color: cat.gradient.from,
      });
    });

    // === RING 2: CLIENT NODES ===
    const clientsByCategory = {};
    for (const cat of finalCategories) {
      clientsByCategory[cat.id] = [];
    }

    activeClients.forEach(client => {
      const primaryCat = getPrimaryCategoryForClient(client);
      if (clientsByCategory[primaryCat]) {
        clientsByCategory[primaryCat].push(client);
      } else {
        const firstCat = finalCategories[0]?.id;
        if (firstCat && clientsByCategory[firstCat]) {
          clientsByCategory[firstCat].push(client);
        }
      }
    });

    // Position clients around their primary category
    // Sort by status priority: high-priority (filing/issue) first (= closer to center arc)
    for (const [catId, catClients] of Object.entries(clientsByCategory)) {
      const catNode = categoryNodeMap[catId];
      if (!catNode || catClients.length === 0) continue;

      // Pre-compute each client's data for sorting
      const enriched = catClients.map(client => {
        const clientTasks = getClientTasks(client, allTasks);
        const clientRecons = getClientReconciliations(client, allRecons);
        const clientCategories = getCategoriesForClient(client);
        const categoryStatuses = computeCategoryStatuses(client, clientTasks, clientRecons);
        const allStatuses = Object.values(categoryStatuses).map(cs => cs.status);
        const overallStatus = getWorstStatus(allStatuses);
        const tier = computeComplexityTier(client);
        const radius = getBubbleRadius(tier, CLIENT_BASE_RADIUS);
        const statusPriority = getStatusPriority(overallStatus);

        return {
          client, clientTasks, clientRecons, clientCategories,
          categoryStatuses, overallStatus, tier, radius, statusPriority,
        };
      });

      // Sort: high-priority status first, then by tier descending
      enriched.sort((a, b) => {
        if (b.statusPriority !== a.statusPriority) return b.statusPriority - a.statusPriority;
        return b.tier - a.tier;
      });

      const count = enriched.length;
      const catAngle = Math.atan2(catNode.y, catNode.x);

      // Dynamic arc spread: wider with more clients, respecting neighbor space
      const maxSpread = Math.min(Math.PI * 0.85, 0.22 + count * 0.18);
      const angleStep = count > 1 ? maxSpread / (count - 1) : 0;
      const startAngle = catAngle - maxSpread / 2;

      enriched.forEach((item, i) => {
        const {
          client, clientTasks, clientRecons, clientCategories,
          categoryStatuses, overallStatus, tier, radius, statusPriority,
        } = item;

        // Distance from category: high-priority closer, completed pushed far out
        const isCompleted = overallStatus === 'completed';
        const isHighPriority = statusPriority >= 4; // issue or filing_ready
        let distanceMod = 0;
        if (isCompleted) distanceMod = 60;       // Push completed outward
        if (isHighPriority) distanceMod = -30;   // Pull urgent inward

        const clientAngle = count > 1 ? startAngle + angleStep * i : catAngle;
        const distance = RING2_BASE_DISTANCE + (radius * 0.5) + distanceMod;

        const x = catNode.x + Math.cos(clientAngle) * distance;
        const y = catNode.y + Math.sin(clientAngle) * distance;

        const clientNode = {
          id: `client-${client.id}`,
          type: 'client',
          x,
          y,
          radius,
          label: client.name,
          categoryId: catId,
          gradientFrom: catNode.gradientFrom,
          gradientTo: catNode.gradientTo,
          status: overallStatus,
          tier,
          data: {
            clientId: client.id,
            serviceTypes: client.service_types || [],
            categories: clientCategories,
            categoryStatuses,
            taskCount: clientTasks.length,
            completedCount: clientTasks.filter(t => t.status === 'completed').length,
            reconCount: clientRecons.length,
            employeeCount: client.employee_count || 0,
          },
        };

        nodes.push(clientNode);

        edges.push({
          id: `${catId}-to-client-${client.id}`,
          from: `cat-${catId}`,
          to: `client-${client.id}`,
          color: catNode.gradientFrom,
        });

        // Secondary edges for multi-service clients
        clientCategories.forEach(secondaryCatId => {
          if (secondaryCatId !== catId && categoryNodeMap[secondaryCatId]) {
            edges.push({
              id: `${secondaryCatId}-to-client-${client.id}`,
              from: `cat-${secondaryCatId}`,
              to: `client-${client.id}`,
              color: categoryNodeMap[secondaryCatId].gradientFrom,
              isSecondary: true,
            });
          }
        });
      });
    }

    // === COLLISION RESOLUTION ===
    resolveCollisions(nodes, COLLISION_ITERATIONS);

    return { nodes, edges };
  }, [clients, tasks, reconciliations]);
}
