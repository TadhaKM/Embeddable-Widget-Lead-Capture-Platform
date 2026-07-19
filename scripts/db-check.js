// DB inspection CLI for live verification. Usage: node scripts/db-check.js <cmd> [args]
const { service, anon } = require('./_supa');

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const sb = service();

  switch (cmd) {
    case 'ping': {
      const { count, error } = await sb
        .from('widgets')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      console.log('OK — connected. widgets count =', count);
      break;
    }
    case 'widget': {
      const { data, error } = await sb
        .from('widgets')
        .select('*')
        .eq('id', args[0])
        .maybeSingle();
      if (error) throw error;
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case 'set-widget': {
      // set-widget <id> <webhook_url> <origin>
      const [id, webhook, origin] = args;
      const { data, error } = await sb
        .from('widgets')
        .update({ webhook_url: webhook, allowed_origins: [origin] })
        .eq('id', id)
        .select('id, webhook_url, allowed_origins, status')
        .maybeSingle();
      if (error) throw error;
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case 'latest-sub': {
      const { data, error } = await sb
        .from('submissions')
        .select('*')
        .eq('widget_id', args[0])
        .order('created_at', { ascending: false })
        .limit(Number(args[1] || 1));
      if (error) throw error;
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case 'hits': {
      const { count, error } = await sb
        .from('rate_limit_hits')
        .select('id', { count: 'exact', head: true })
        .eq('widget_id', args[0]);
      if (error) throw error;
      console.log('rate_limit_hits for widget =', count);
      break;
    }
    case 'sef': {
      const { data, error } = await sb
        .from('side_effect_failures')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Number(args[0] || 5));
      if (error) throw error;
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case 'anon-read': {
      // Prove RLS: anon key, no session -> should return 0 rows.
      const a = anon();
      const table = args[0] || 'widgets';
      const { data, error } = await a.from(table).select('*');
      console.log(
        `anon ${table} -> rows: ${(data || []).length}, error: ${
          error ? error.message : 'none'
        }`,
      );
      break;
    }
    default:
      console.log('unknown cmd:', cmd);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error('ERR:', e.message || e);
  process.exit(1);
});
