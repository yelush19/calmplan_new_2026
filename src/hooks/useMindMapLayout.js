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
const CATEGORY_RADIUS = 40;
const CLIENT_BASE_RADIUS = 22;
const RING1_DISTANCE = 220;   // Distance from center to category nodes
const RING2_BASE_DISTANCE = 160; // Base distance from category to client nodes
const MIN_CLIENT_SPACING = 18; // Minimum gap between client bubble edges

// Compute the worst status from a list of items (tasks or reconciliations)
function aggregateStatus(items) {
  if (!items || items.length === 0) return 'not_started';
  const statuses = items.map(item => item.status || 'not_started');
  return getWorstStatus(statuses);
}

// Match tasks to a client by both client_id and client_name
function getClientTasks(client, allTasks) {
  return allTasks.filter(task => {
    if (task.client_id && task.client_id === client.id) return true;
    if (task.client_name && client.name && task.client_name === client.name) return true;
    return false;
  });
}

// Match reconciliations to a client by client_id
function getClientReconciliations(client, allReconciliations) {
  return allReconciliations.filter(r => r.client_id === client.id);
}

// Determine which board categories a task belongs to
function getTaskBoardCategory(task) {
  const cat = task.category || '';
  for (const board of BOARD_CATEGORIES) {
    if (board.taskCategories.some(tc => cat === tc || cat.includes(tc.replace('work_', '')))) {
      return board.id;
    }
  }
  return null;
}

// Calculate per-category status for a client
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

// Compute client bubble radius based on complexity tier (from employee_count / complexity_level)
function computeClientRadius(client) {
  const tier = computeComplexityTier(client);
  return getBubbleRadius(tier, CLIENT_BASE_RADIUS);
}

export function useMindMapLayout({ clients, tasks, reconciliations }) {
  return useMemo(() => {
    const nodes = [];
    const edges = [];

    // Filter to only active clients
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
    const activeCategories = BOARD_CATEGORIES.filter(cat => {
      // Include a category if at least one client subscribes to it
      return activeClients.some(c => {
        const st = c.service_types || [];
        return cat.serviceTypes.some(s => st.includes(s));
      });
    });

    // If no categories have clients, show all categories anyway for visual structure
    const categoriesToShow = activeCategories.length > 0 ? activeCategories : BOARD_CATEGORIES;
    const categoryAngleStep = (2 * Math.PI) / categoriesToShow.length;

    const categoryNodeMap = {}; // categoryId -> node

    categoriesToShow.forEach((cat, i) => {
      // Start from top (-PI/2) and go clockwise
      const angle = categoryAngleStep * i - Math.PI / 2;
      const x = Math.cos(angle) * RING1_DISTANCE;
      const y = Math.sin(angle) * RING1_DISTANCE;

      // Count tasks in this category
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

      // Edge from hub to category
      edges.push({
        id: `hub-to-${cat.id}`,
        from: 'hub',
        to: `cat-${cat.id}`,
        color: cat.gradient.from,
      });
    });

    // === RING 2: CLIENT NODES ===
    // Group clients by their primary category
    const clientsByCategory = {};
    for (const cat of categoriesToShow) {
      clientsByCategory[cat.id] = [];
    }

    activeClients.forEach(client => {
      const primaryCat = getPrimaryCategoryForClient(client);
      if (clientsByCategory[primaryCat]) {
        clientsByCategory[primaryCat].push(client);
      } else {
        // Fallback: add to first category
        const firstCat = categoriesToShow[0]?.id;
        if (firstCat && clientsByCategory[firstCat]) {
          clientsByCategory[firstCat].push(client);
        }
      }
    });

    // Position clients around their primary category
    for (const [catId, catClients] of Object.entries(clientsByCategory)) {
      const catNode = categoryNodeMap[catId];
      if (!catNode || catClients.length === 0) continue;

      // Calculate angular spread for clients around this category
      const count = catClients.length;

      // Find the angle of the category relative to center
      const catAngle = Math.atan2(catNode.y, catNode.x);

      // Spread clients in an arc centered on the outward direction from the category
      const maxSpread = Math.min(Math.PI * 0.8, count * 0.25); // Arc width scales with count
      const angleStep = count > 1 ? maxSpread / (count - 1) : 0;
      const startAngle = catAngle - maxSpread / 2;

      catClients.forEach((client, i) => {
        const clientTasks = getClientTasks(client, allTasks);
        const clientRecons = getClientReconciliations(client, allRecons);
        const clientCategories = getCategoriesForClient(client);
        const categoryStatuses = computeCategoryStatuses(client, clientTasks, clientRecons);

        // Overall client status = worst across all categories
        const allStatuses = Object.values(categoryStatuses).map(cs => cs.status);
        const overallStatus = getWorstStatus(allStatuses);

        const activeServiceCount = clientCategories.length;
        const radius = computeClientRadius(client);

        // Position: radiate outward from category node
        const clientAngle = count > 1 ? startAngle + angleStep * i : catAngle;
        const distance = RING2_BASE_DISTANCE + (radius * 0.5); // Slightly further for bigger bubbles

        const x = catNode.x + Math.cos(clientAngle) * distance;
        const y = catNode.y + Math.sin(clientAngle) * distance;

        // Use the primary category's gradient, modulated by status
        const primaryGradient = catNode;

        const clientNode = {
          id: `client-${client.id}`,
          type: 'client',
          x,
          y,
          radius,
          label: client.name,
          categoryId: catId,
          gradientFrom: primaryGradient.gradientFrom,
          gradientTo: primaryGradient.gradientTo,
          status: overallStatus,
          data: {
            clientId: client.id,
            serviceTypes: client.service_types || [],
            categories: clientCategories,
            categoryStatuses,
            taskCount: clientTasks.length,
            completedCount: clientTasks.filter(t => t.status === 'completed').length,
            reconCount: clientRecons.length,
          },
        };

        nodes.push(clientNode);

        // Edge from primary category to client
        edges.push({
          id: `${catId}-to-client-${client.id}`,
          from: `cat-${catId}`,
          to: `client-${client.id}`,
          color: catNode.gradientFrom,
        });

        // Additional edges for secondary categories
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

    return { nodes, edges };
  }, [clients, tasks, reconciliations]);
}
