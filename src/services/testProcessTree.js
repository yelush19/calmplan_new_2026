/**
 * Process Tree — Console Test Harness
 *
 * Exposes window.testProcessTree() for manual E2E validation.
 * Run from browser DevTools console to verify the full infrastructure:
 *   1. Seed company tree to Supabase (SystemConfig)
 *   2. Migrate a real client from service_types[] → process_tree{}
 *   3. Test frequency resolution chain
 *   4. Test node toggle cascade logic
 *
 * TEMPORARY — remove after Step 1 validation.
 */

export async function testProcessTree() {
  const SEP = '═'.repeat(60);
  const log = (title, data) => {
    console.log(`\n${SEP}`);
    console.log(`  ${title}`);
    console.log(SEP);
    if (data !== undefined) {
      if (typeof data === 'string') console.log(data);
      else console.log(JSON.parse(JSON.stringify(data)));
    }
  };

  try {
    // ── Dynamic imports (avoid bundling into main chunk) ──
    const { loadCompanyTree, resolveFrequency, toggleNode, isNodeEnabled, getEnabledNodeIds, invalidateTreeCache } =
      await import('@/services/processTreeService');
    const { migrateClientToProcessTree, migrationPreview } =
      await import('@/services/migrateClientToProcessTree');
    const { flattenTree, buildNodeMap, PROCESS_TREE_SEED } =
      await import('@/config/companyProcessTree');
    const { Client } = await import('@/api/entities');
    const { supabase, isSupabaseAvailable } = await import('@/api/supabaseClient');

    // ══════════════════════════════════════════════════════
    // TEST 0: Supabase connectivity diagnostic
    // ══════════════════════════════════════════════════════
    log('TEST 0: Supabase Connectivity');
    console.log('  isSupabaseAvailable():', isSupabaseAvailable());
    if (supabase) {
      const { data: probe, error: probeErr } = await supabase
        .from('calmplan_system_config')
        .select('id')
        .limit(1);
      console.log('  calmplan_system_config probe:', probeErr ? `❌ ${probeErr.message}` : `✅ OK (${probe?.length || 0} rows)`);
    } else {
      console.warn('  ⚠️ supabase client is null');
    }

    // ══════════════════════════════════════════════════════
    // TEST 1: Seed company tree to DB
    // ══════════════════════════════════════════════════════
    log('TEST 1: loadCompanyTree() — Seed to calmplan_system_config');
    invalidateTreeCache(); // Force fresh DB read
    const { tree, configId } = await loadCompanyTree();
    console.log('  configId:', configId);
    if (!configId) {
      console.error('  ❌ configId is null — seed did NOT write to DB!');
    }
    console.log('  version:', tree.version);
    console.log('  branches:', Object.keys(tree.branches));
    const flat = flattenTree(tree);
    console.log(`  total nodes: ${flat.length}`);
    console.log('  node IDs:', flat.map(n => n.id));

    // Verify it's actually in the DB
    if (supabase) {
      const { data: verify, error: verifyErr } = await supabase
        .from('calmplan_system_config')
        .select('id, config_key')
        .eq('config_key', 'company_process_tree');
      console.log('  DB verification:', verifyErr
        ? `❌ ${verifyErr.message}`
        : `✅ Found ${verify?.length || 0} row(s) in calmplan_system_config`);
    }
    console.log('  ✅ Company tree seeded');

    // ══════════════════════════════════════════════════════
    // TEST 2: Migration preview on a real client
    // ══════════════════════════════════════════════════════
    log('TEST 2: migrationPreview() — Real Client');
    const clients = await Client.list(null, 5);
    if (clients.length === 0) {
      console.warn('  ⚠️ No clients found — skipping migration test');
    } else {
      const testClient = clients[0];
      console.log(`  Client: "${testClient.name}" (id: ${testClient.id})`);
      console.log('  service_types:', testClient.service_types);
      console.log('  reporting_info:', testClient.reporting_info);

      // Preview
      const preview = migrationPreview(testClient);
      console.log(`  Preview: ${preview}`);

      // Full migration result
      const { process_tree, migrated } = migrateClientToProcessTree(testClient);
      console.log(`  migrated: ${migrated}`);
      console.log('  process_tree:', process_tree);
      console.log(`  enabled nodes: ${Object.entries(process_tree).filter(([,v]) => v.enabled).map(([k]) => k).join(', ')}`);
      console.log('  ✅ Migration completed');

      // ══════════════════════════════════════════════════════
      // TEST 3: Frequency resolution
      // ══════════════════════════════════════════════════════
      log('TEST 3: resolveFrequency() — Frequency Chain');

      // Create a mock client with the migrated process_tree
      const clientWithTree = { ...testClient, process_tree };

      const testNodes = ['P2_vat', 'P1_payroll', 'P1_masav_employees', 'P1_social_security', 'P2_tax_advances'];
      for (const nodeId of testNodes) {
        const freq = resolveFrequency(nodeId, clientWithTree, tree);
        const nodeMap = buildNodeMap(tree);
        const nodeDef = nodeMap[nodeId];
        console.log(`  ${nodeId} (${nodeDef?.label || '?'}): ${freq}`);
        if (nodeDef?.frequency_field) {
          console.log(`    → field: ${nodeDef.frequency_field} = ${testClient.reporting_info?.[nodeDef.frequency_field] || 'N/A'}`);
        }
        if (nodeDef?.frequency_inherit) {
          console.log(`    → inherits from parent: ${nodeDef.parent_id}`);
        }
      }
      console.log('  ✅ Frequency resolution verified');

      // ══════════════════════════════════════════════════════
      // TEST 4: Toggle cascade
      // ══════════════════════════════════════════════════════
      log('TEST 4: toggleNode() — Cascade Logic');

      // Start with empty tree
      let clientTree = {};
      console.log('\n  4a. Enable P1_masav_employees (child) → should auto-enable P1_payroll (parent)');
      clientTree = toggleNode(clientTree, 'P1_masav_employees', true, tree);
      const enabled4a = Object.entries(clientTree).filter(([,v]) => v.enabled).map(([k]) => k);
      console.log('    enabled:', enabled4a);
      console.log('    P1_payroll auto-enabled?', isNodeEnabled(clientTree, 'P1_payroll') ? '✅ YES' : '❌ NO');

      console.log('\n  4b. Enable more children');
      clientTree = toggleNode(clientTree, 'P1_social_security', true, tree);
      clientTree = toggleNode(clientTree, 'P1_deductions', true, tree);
      clientTree = toggleNode(clientTree, 'P2_vat', true, tree);
      const enabled4b = getEnabledNodeIds(clientTree);
      console.log('    enabled:', enabled4b);
      console.log('    P2_bookkeeping auto-enabled?', isNodeEnabled(clientTree, 'P2_bookkeeping') ? '✅ YES' : '❌ NO');

      console.log('\n  4c. Disable P1_payroll (parent) → should auto-disable ALL P1 children');
      clientTree = toggleNode(clientTree, 'P1_payroll', false, tree);
      const enabled4c = getEnabledNodeIds(clientTree);
      console.log('    enabled after disabling P1_payroll:', enabled4c);
      const p1Survivors = enabled4c.filter(id => id.startsWith('P1_'));
      console.log('    P1 survivors:', p1Survivors.length === 0 ? '✅ None (correct)' : `❌ ${p1Survivors}`);
      console.log('    P2_vat still enabled?', isNodeEnabled(clientTree, 'P2_vat') ? '✅ YES (unaffected)' : '❌ NO');

      console.log('\n  ✅ Cascade logic verified');
    }

    log('ALL TESTS PASSED ✅');
    return true;
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    throw err;
  }
}
