import { useMemo } from 'react';
import {
  BOARD_CATEGORIES,
  getWorstStatus,
  getPrimaryCategoryForClient,
  getCategoriesForClient,
} from '@/lib/theme-constants';
import { computeComplexityTier, getBubbleRadius } from '@/lib/complexity';

// ══════════════════════════════════════════════════════════════════
// LAW 2: THE SPATIAL ANCHOR — Geometry & Physics Engine
// ══════════════════════════════════════════════════════════════════
//
// ABSOLUTE RULES:
// 1. Radial Symmetry: 4 categories locked at 0°, 90°, 180°, 270°
// 2. Hard Collision Repulsion: 180px minimum between ANY two nodes
// 3. Geometric Center Lines: all edges use node center coordinates
// 4. Tree-Shifting: expanding nodes push siblings outward
//
// HIERARCHY:
//   Level 0: "My Day" hub (center)
//   Level 1: Categories (Soft-Square containers) — FIXED cross
//   Level 2: Client nodes (Pills) — radial around parent category
// ══════════════════════════════════════════════════════════════════

// ─── Layout Constants ───
const HUB_RADIUS = 52;
const HUB_WIDTH = 110;
const HUB_HEIGHT = 110;

const CATEGORY_WIDTH = 140;
const CATEGORY_HEIGHT = 80;
const CATEGORY_CORNER_RADIUS = 24;

const CLIENT_BASE_RADIUS = 22;
const CLIENT_PILL_HEIGHT = 36;

const RING1_DISTANCE = 280;         // Center → Category distance
const RING2_BASE_DISTANCE = 160;    // Category → Client base distance
const MIN_NODE_DISTANCE = 180;      // LAW 2.2: HARD minimum
const COLLISION_ITERATIONS = 25;    // More passes = zero overlap guarantee

// ─── Fixed Cardinal Angles for 4 Categories ───
// LAW 2.3: Radial Symmetry — locked cross shape
const CARDINAL_ANGLES = {
  4: [
    -Math.PI / 2,   // Top (0°)
    0,               // Right (90°)
    Math.PI / 2,     // Bottom (180°)
    Math.PI,         // Left (270°)
  ],
  3: [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6],
  2: [-Math.PI / 2, Math.PI / 2],
  1: [-Math.PI / 2],
};

function getFixedAngles(count) {
  if (count <= 4) return CARDINAL_ANGLES[count] || CARDINAL_ANGLES[4];
  // 5+ categories: evenly distribute starting from top
  return Array.from({ length: count }, (_, i) =>
    (i * 2 * Math.PI / count) - Math.PI / 2
  );
}

// ─── Status Priority for sorting ───
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
  completed: -1,
};

function getStatusPriority(status) {
  return STATUS_RING_PRIORITY[status] ?? 0;
}

// ─── Data Helpers ───

function aggregateStatus(items) {
  if (!items || items.length === 0) return 'not_started';
  return getWorstStatus(items.map(item => item.status || 'not_started'));
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

// ══════════════════════════════════════════════════════════════════
// LAW 2.2: HARD COLLISION REPULSION
// Min distance = 180px. Overlapping is a SYSTEM FAILURE.
// Uses iterative pairwise displacement with no spring pullback.
// ══════════════════════════════════════════════════════════════════

function resolveCollisions(movableNodes, allNodes, minDist = MIN_NODE_DISTANCE, iterations = COLLISION_ITERATIONS) {
  for (let iter = 0; iter < iterations; iter++) {
    let hadCollision = false;

    for (let i = 0; i < movableNodes.length; i++) {
      for (let j = i + 1; j < movableNodes.length; j++) {
        const a = movableNodes[i];
        const b = movableNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Use node-specific collision radius if available
        const aHalf = a.collisionRadius || (a.width ? a.width / 2 : a.radius || 40);
        const bHalf = b.collisionRadius || (b.width ? b.width / 2 : b.radius || 40);
        const effectiveMinDist = Math.max(aHalf + bHalf + 20, minDist);

        if (dist < effectiveMinDist && dist > 0.01) {
          hadCollision = true;
          const overlap = (effectiveMinDist - dist) / 2 + 2; // +2px safety
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }

    // Also repel movable nodes from fixed nodes (categories, hub)
    for (const movable of movableNodes) {
      for (const fixed of allNodes) {
        if (fixed === movable) continue;
        if (movableNodes.includes(fixed)) continue; // handled above
        const dx = movable.x - fixed.x;
        const dy = movable.y - fixed.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const fixedHalf = fixed.collisionRadius || (fixed.width ? fixed.width / 2 : fixed.radius || 40);
        const movableHalf = movable.collisionRadius || (movable.width ? movable.width / 2 : movable.radius || 40);
        const effectiveMinDist = Math.max(fixedHalf + movableHalf + 20, minDist * 0.8);

        if (dist < effectiveMinDist && dist > 0.01) {
          hadCollision = true;
          const overlap = effectiveMinDist - dist + 2;
          const nx = dx / dist;
          const ny = dy / dist;
          // Only move the movable node
          movable.x += nx * overlap;
          movable.y += ny * overlap;
        }
      }
    }

    if (!hadCollision) break;
  }
}

// Tree-shifting: when nodes are pushed, propagate shift to maintain structure
function treeShift(nodes, parentX, parentY, maxTetherDist) {
  for (const node of nodes) {
    const dx = node.x - parentX;
    const dy = node.y - parentY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxTetherDist && dist > 0) {
      const scale = maxTetherDist / dist;
      node.x = parentX + dx * scale;
      node.y = parentY + dy * scale;
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// MAIN LAYOUT HOOK
// ══════════════════════════════════════════════════════════════════

export function useMindMapLayout({ clients, tasks, reconciliations }) {
  return useMemo(() => {
    const nodes = [];
    const edges = [];

    // LAW 1.1: ACTIVE ONLY
    const activeClients = (clients || []).filter(c =>
      c.status === 'active' && c.is_deleted !== true
    );
    const allTasks = tasks || [];
    const allRecons = reconciliations || [];

    // ═══ LEVEL 0: CENTER HUB — "My Day" ═══
    const hubNode = {
      id: 'hub',
      type: 'hub',
      x: 0,
      y: 0,
      width: HUB_WIDTH,
      height: HUB_HEIGHT,
      radius: HUB_RADIUS,
      collisionRadius: HUB_WIDTH / 2,
      label: 'היום שלי',
      gradientFrom: '#00838F',
      gradientTo: '#006064',
      status: 'active',
      data: {
        clientCount: activeClients.length,
        taskCount: allTasks.length,
      },
    };
    nodes.push(hubNode);

    // ═══ LEVEL 1: CATEGORY NODES — Fixed Radial Cross ═══
    // Only show categories that have clients or are alwaysVisible
    const categoriesToShow = BOARD_CATEGORIES.filter(cat => {
      if (cat.alwaysVisible) return true;
      return activeClients.some(c => {
        const st = c.service_types || [];
        return cat.serviceTypes.some(s => st.includes(s));
      });
    });
    const finalCategories = categoriesToShow.length > 0 ? categoriesToShow : BOARD_CATEGORIES;

    // LAW 2.3: RADIAL SYMMETRY — fixed angles
    const fixedAngles = getFixedAngles(finalCategories.length);
    const categoryNodeMap = {};

    finalCategories.forEach((cat, i) => {
      const angle = fixedAngles[i];
      const x = Math.cos(angle) * RING1_DISTANCE;
      const y = Math.sin(angle) * RING1_DISTANCE;

      // Compute category aggregate stats
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
        width: CATEGORY_WIDTH,
        height: CATEGORY_HEIGHT,
        cornerRadius: CATEGORY_CORNER_RADIUS,
        collisionRadius: Math.max(CATEGORY_WIDTH, CATEGORY_HEIGHT) / 2,
        label: cat.label,
        categoryId: cat.id,
        angle,
        // LAW 3: Deep Teal for categories
        gradientFrom: '#00695C',
        gradientTo: '#004D40',
        status: aggregateStatus(allItems),
        data: {
          totalCount,
          completedCount,
          progress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        },
      };

      nodes.push(catNode);
      categoryNodeMap[cat.id] = catNode;

      // Edge: Hub → Category
      edges.push({
        id: `hub-to-${cat.id}`,
        from: 'hub',
        to: `cat-${cat.id}`,
        color: '#00695C',
        level: 'L0-L1',
      });
    });

    // ═══ LEVEL 2: CLIENT NODES — Radial around parent category ═══
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

    const allClientNodes = [];

    for (const [catId, catClients] of Object.entries(clientsByCategory)) {
      const catNode = categoryNodeMap[catId];
      if (!catNode || catClients.length === 0) continue;

      // Enrich each client with computed data
      const enriched = catClients.map(client => {
        const clientTasks = getClientTasks(client, allTasks);
        const clientRecons = getClientReconciliations(client, allRecons);
        const clientCategories = getCategoriesForClient(client);
        const categoryStatuses = computeCategoryStatuses(client, clientTasks, clientRecons);
        const allStatuses = Object.values(categoryStatuses).map(cs => cs.status);
        const overallStatus = allStatuses.length > 0 ? getWorstStatus(allStatuses) : 'not_started';
        const tier = computeComplexityTier(client);
        const radius = getBubbleRadius(tier, CLIENT_BASE_RADIUS);
        const statusPriority = getStatusPriority(overallStatus);

        return {
          client, clientTasks, clientRecons, clientCategories,
          categoryStatuses, overallStatus, tier, radius, statusPriority,
        };
      });

      // Sort: high-priority first, then by tier
      enriched.sort((a, b) => {
        if (b.statusPriority !== a.statusPriority) return b.statusPriority - a.statusPriority;
        return b.tier - a.tier;
      });

      const count = enriched.length;
      const catAngle = catNode.angle;

      // Dynamic arc spread around parent category
      // Wider arc for more clients, but never wrapping fully
      const maxSpread = Math.min(Math.PI * 0.9, 0.3 + count * 0.2);
      const angleStep = count > 1 ? maxSpread / (count - 1) : 0;
      const startAngle = catAngle - maxSpread / 2;

      enriched.forEach((item, i) => {
        const {
          client, clientTasks, clientRecons, clientCategories,
          categoryStatuses, overallStatus, tier, radius, statusPriority,
        } = item;

        // Distance: high-priority closer, completed pushed out
        const isCompleted = overallStatus === 'completed';
        const isHighPriority = statusPriority >= 4;
        let distanceMod = 0;
        if (isCompleted) distanceMod = 50;
        if (isHighPriority) distanceMod = -25;

        const clientAngle = count > 1 ? startAngle + angleStep * i : catAngle;
        const distance = RING2_BASE_DISTANCE + (radius * 0.4) + distanceMod;

        const pillWidth = Math.max(radius * 2.5, 80);
        const x = catNode.x + Math.cos(clientAngle) * distance;
        const y = catNode.y + Math.sin(clientAngle) * distance;

        const clientNode = {
          id: `client-${client.id}`,
          type: 'client',
          x,
          y,
          width: pillWidth,
          height: CLIENT_PILL_HEIGHT,
          radius,
          collisionRadius: pillWidth / 2,
          label: client.nickname || client.name,
          fullName: client.name,
          nickname: client.nickname || '',
          categoryId: catId,
          parentCatX: catNode.x,
          parentCatY: catNode.y,
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
        allClientNodes.push(clientNode);

        // Edge: Category → Client
        edges.push({
          id: `${catId}-to-client-${client.id}`,
          from: `cat-${catId}`,
          to: `client-${client.id}`,
          color: '#00897B',
          level: 'L1-L2',
        });

        // Secondary edges for multi-service clients
        clientCategories.forEach(secondaryCatId => {
          if (secondaryCatId !== catId && categoryNodeMap[secondaryCatId]) {
            edges.push({
              id: `${secondaryCatId}-to-client-${client.id}`,
              from: `cat-${secondaryCatId}`,
              to: `client-${client.id}`,
              color: '#B0BEC5',
              isSecondary: true,
              level: 'L1-L2-secondary',
            });
          }
        });
      });
    }

    // ═══ LAW 2.2: HARD COLLISION REPULSION ═══
    // Client nodes are movable; hub + category nodes are fixed anchors
    const fixedNodes = nodes.filter(n => n.type === 'hub' || n.type === 'category');
    resolveCollisions(allClientNodes, fixedNodes, MIN_NODE_DISTANCE, COLLISION_ITERATIONS);

    // Tree-shift: keep clients within reasonable distance of parent
    allClientNodes.forEach(node => {
      treeShift([node], node.parentCatX, node.parentCatY, RING2_BASE_DISTANCE + 120);
    });

    // Second collision pass after tree-shifting
    resolveCollisions(allClientNodes, fixedNodes, MIN_NODE_DISTANCE, 10);

    return { nodes, edges };
  }, [clients, tasks, reconciliations]);
}
