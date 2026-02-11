/**
 * Monday.com API Client
 * Direct browser-to-API calls using Monday.com API v2 (GraphQL)
 * Token stored in localStorage for this personal CRM app
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';
const TOKEN_KEY = 'calmplan_monday_token';

// ===== Token Management =====

export function getMondayToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setMondayToken(token) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function hasMondayToken() {
  return !!getMondayToken();
}

// ===== Core GraphQL Request =====

export async function mondayRequest(query, variables = {}) {
  const token = getMondayToken();
  if (!token) {
    throw new Error('לא הוגדר API Token של Monday.com. הגדר אותו בדף האינטגרציה.');
  }

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'API-Version': '2024-10'
    },
    body: JSON.stringify({ query, variables })
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 30;
    throw new MondayRateLimitError(parseInt(retryAfter));
  }

  if (response.status === 403) {
    throw new MondayForbiddenError();
  }

  if (!response.ok) {
    throw new Error(`Monday API HTTP Error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Monday API: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data;
}

// ===== Custom Error Types =====

export class MondayRateLimitError extends Error {
  constructor(retryAfter = 30) {
    super('Rate limited by Monday.com API');
    this.name = 'MondayRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class MondayForbiddenError extends Error {
  constructor() {
    super('Access forbidden - check API token and permissions');
    this.name = 'MondayForbiddenError';
  }
}

// ===== Board Operations =====

export async function getAllBoards() {
  // Fetch all board types (public, private, share)
  const results = [];
  for (const kind of ['public', 'private', 'share']) {
    try {
      const data = await mondayRequest(`{
        boards(limit: 200, board_kind: ${kind}) {
          id
          name
          board_folder_id
          state
          groups {
            id
            title
          }
        }
      }`);
      if (data.boards) results.push(...data.boards);
    } catch (e) {
      console.warn(`Could not fetch ${kind} boards:`, e.message);
    }
  }
  const data = { boards: results };

  return (data.boards || []).map(b => ({
    id: String(b.id),
    name: b.name,
    folder_id: b.board_folder_id,
    state: b.state,
    groups: b.groups || []
  }));
}

export async function getBoardColumns(boardId) {
  const data = await mondayRequest(`{
    boards(ids: [${boardId}]) {
      columns {
        id
        title
        type
        settings_str
      }
    }
  }`);

  return data.boards?.[0]?.columns || [];
}

// ===== Fetch Board Items (with pagination) =====

export async function getBoardItems(boardId) {
  const allItems = [];

  // First page
  const firstPage = await mondayRequest(`{
    boards(ids: [${boardId}]) {
      items_page(limit: 500) {
        cursor
        items {
          id
          name
          group {
            id
            title
          }
          column_values {
            id
            text
            type
            value
          }
        }
      }
    }
  }`);

  const page = firstPage.boards?.[0]?.items_page;
  if (page?.items) {
    allItems.push(...page.items);
  }

  let cursor = page?.cursor;

  // Subsequent pages
  while (cursor) {
    const nextPage = await mondayRequest(`{
      next_items_page(cursor: "${cursor}", limit: 500) {
        cursor
        items {
          id
          name
          group {
            id
            title
          }
          column_values {
            id
            text
            type
            value
          }
        }
      }
    }`);

    if (nextPage.next_items_page?.items) {
      allItems.push(...nextPage.next_items_page.items);
      cursor = nextPage.next_items_page.cursor;
    } else {
      cursor = null;
    }
  }

  return allItems;
}

// ===== Column Mutations =====

export async function addColumnToBoard(boardId, title, columnType, settingsJson) {
  const escapedTitle = title.replace(/"/g, '\\"');
  let mutation = `mutation {
    create_column(
      board_id: ${boardId},
      title: "${escapedTitle}",
      column_type: ${columnType}`;

  if (settingsJson) {
    const escapedSettings = JSON.stringify(settingsJson).replace(/"/g, '\\"');
    mutation += `,\n      defaults: "${escapedSettings}"`;
  }

  mutation += `\n    ) {\n      id\n      title\n    }\n  }`;

  const data = await mondayRequest(mutation);
  return data.create_column;
}

// ===== Item Mutations =====

export async function updateItemColumnValues(boardId, itemId, columnValues) {
  const valuesStr = JSON.stringify(JSON.stringify(columnValues));
  const data = await mondayRequest(`mutation {
    change_multiple_column_values(
      board_id: ${boardId},
      item_id: ${itemId},
      column_values: ${valuesStr}
    ) {
      id
    }
  }`);

  return data.change_multiple_column_values;
}

// ===== Board Creation =====

export async function createBoard(boardName, boardKind = 'public', folderId = null) {
  const escapedName = boardName.replace(/"/g, '\\"');
  let mutation = `mutation {
    create_board(
      board_name: "${escapedName}",
      board_kind: ${boardKind}`;

  if (folderId) {
    mutation += `,\n      folder_id: ${folderId}`;
  }

  mutation += `\n    ) {\n      id\n    }\n  }`;

  const data = await mondayRequest(mutation);
  return data.create_board;
}

// ===== Helpers: Parse & Map Monday Items =====

/**
 * Parse column_values array into a flat { colId: { text, value, type } } object
 */
export function parseColumnValues(columnValues) {
  const result = {};
  for (const col of columnValues) {
    let parsedValue = null;
    if (col.value) {
      try {
        parsedValue = JSON.parse(col.value);
      } catch {
        parsedValue = col.value;
      }
    }
    result[col.id] = {
      text: col.text || '',
      value: parsedValue,
      type: col.type
    };
  }
  return result;
}

/**
 * Map a Monday item to a local Client entity
 */
export function mapMondayItemToClient(item, boardId) {
  const cols = parseColumnValues(item.column_values);

  const client = {
    name: item.name,
    monday_item_id: String(item.id),
    monday_board_id: String(boardId),
    monday_group: item.group?.title || '',
    monday_group_id: item.group?.id || '',
  };

  // Map common column types
  const columnTexts = {};
  for (const [colId, col] of Object.entries(cols)) {
    columnTexts[colId] = col.text;

    switch (col.type) {
      case 'phone':
        if (!client.phone) client.phone = col.text;
        break;
      case 'email':
        if (!client.email) client.email = col.text;
        break;
      case 'color': // status column type
        if (!client.status) client.status = col.text;
        break;
      case 'text':
        if (!client.notes && col.text) client.notes = (client.notes || '') + col.text + '\n';
        break;
      case 'date':
        if (!client.start_date && col.text) client.start_date = col.text;
        break;
      case 'link':
        if (!client.website && col.text) client.website = col.text;
        break;
      case 'long_text':
        if (col.text) client.notes = (client.notes || '') + col.text + '\n';
        break;
      case 'dropdown':
        if (col.text) {
          const colIdLower = colId.toLowerCase();
          if (colIdLower.includes('service') || colIdLower.includes('שירות')) {
            client.services = col.text;
          }
        }
        break;
    }
  }

  // Store compact column data for reference
  client.monday_column_texts = columnTexts;

  return client;
}

/**
 * Map a Monday item to a local Task entity
 */
export function mapMondayItemToTask(item, boardId) {
  const cols = parseColumnValues(item.column_values);

  const task = {
    title: item.name,
    monday_item_id: String(item.id),
    monday_board_id: String(boardId),
    monday_group: item.group?.title || '',
    monday_group_id: item.group?.id || '',
  };

  const columnTexts = {};
  for (const [colId, col] of Object.entries(cols)) {
    columnTexts[colId] = col.text;

    switch (col.type) {
      case 'color': // status column
        if (!task.status) {
          const text = (col.text || '').toLowerCase();
          if (text === 'done' || text === 'הושלם' || text === 'בוצע' || text === 'completed') {
            task.status = 'completed';
          } else if (text === 'working on it' || text === 'עובד על זה' || text === 'בתהליך' || text === 'in progress') {
            task.status = 'in_progress';
          } else if (text === 'stuck' || text === 'תקוע') {
            task.status = 'stuck';
          } else {
            task.status = 'pending';
          }
          task.status_label = col.text;
        }
        break;
      case 'date':
        if (!task.due_date && col.text) {
          task.due_date = col.text;
        } else if (col.text && !task.scheduled_start) {
          task.scheduled_start = col.text;
        }
        break;
      case 'text':
        if (!task.description && col.text) task.description = col.text;
        break;
      case 'long_text':
        if (col.text) task.description = (task.description || '') + col.text;
        break;
      case 'people':
        if (col.text) task.assignee = col.text;
        break;
      case 'numeric':
        if (col.text) task.numeric_value = col.text;
        break;
      case 'dropdown':
        if (col.text) task.category = col.text;
        break;
    }
  }

  task.monday_column_texts = columnTexts;
  if (!task.status) task.status = 'pending';

  return task;
}

/**
 * Map a Monday item to a local AccountReconciliation entity
 */
export function mapMondayItemToReconciliation(item, boardId) {
  const cols = parseColumnValues(item.column_values);

  const rec = {
    title: item.name,
    monday_item_id: String(item.id),
    monday_board_id: String(boardId),
    monday_group: item.group?.title || '',
    monday_group_id: item.group?.id || '',
  };

  const columnTexts = {};
  for (const [colId, col] of Object.entries(cols)) {
    columnTexts[colId] = col.text;

    switch (col.type) {
      case 'color':
        if (!rec.status) rec.status = col.text;
        break;
      case 'date':
        if (!rec.date && col.text) rec.date = col.text;
        break;
      case 'numeric':
        if (!rec.amount && col.text) rec.amount = parseFloat(col.text) || 0;
        break;
      case 'text':
      case 'long_text':
        if (col.text) rec.notes = (rec.notes || '') + col.text + '\n';
        break;
    }
  }

  rec.monday_column_texts = columnTexts;
  return rec;
}

/**
 * Map a Monday item to a local ClientAccount entity
 */
export function mapMondayItemToClientAccount(item, boardId) {
  const cols = parseColumnValues(item.column_values);

  const account = {
    name: item.name,
    monday_item_id: String(item.id),
    monday_board_id: String(boardId),
    monday_group: item.group?.title || '',
    monday_group_id: item.group?.id || '',
  };

  const columnTexts = {};
  for (const [colId, col] of Object.entries(cols)) {
    columnTexts[colId] = col.text;

    switch (col.type) {
      case 'text':
        if (!account.account_number && col.text) account.account_number = col.text;
        break;
      case 'color':
        if (!account.status) account.status = col.text;
        break;
      case 'numeric':
        if (!account.balance && col.text) account.balance = parseFloat(col.text) || 0;
        break;
    }
  }

  account.monday_column_texts = columnTexts;
  return account;
}

/**
 * Map a Monday item to a local Therapist entity
 */
export function mapMondayItemToTherapist(item, boardId) {
  const cols = parseColumnValues(item.column_values);

  const therapist = {
    name: item.name,
    monday_item_id: String(item.id),
    monday_board_id: String(boardId),
    monday_group: item.group?.title || '',
  };

  const columnTexts = {};
  for (const [colId, col] of Object.entries(cols)) {
    columnTexts[colId] = col.text;

    switch (col.type) {
      case 'phone':
        if (!therapist.phone) therapist.phone = col.text;
        break;
      case 'email':
        if (!therapist.email) therapist.email = col.text;
        break;
      case 'text':
      case 'long_text':
        if (!therapist.specialty && col.text) therapist.specialty = col.text;
        break;
    }
  }

  therapist.monday_column_texts = columnTexts;
  return therapist;
}
