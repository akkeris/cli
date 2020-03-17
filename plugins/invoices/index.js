const assert = require('assert');

function list(appkit, args) {
  assert.ok(!(args.org && args.space), 'An organization and space cannot be used at the same time.');
  let url = '/account/invoices';
  if (args.org) {
    url = `/organizations/${args.org}/invoices`;
  } else if (args.space) {
    url = `/spaces/${args.space}/invoices`;
  }
  appkit.api.get(url, (err, data) => {
    if (err) {
      appkit.terminal.error(err);
      return;
    }
    appkit.terminal.print(null, data.map((x) => {
      let id = x.$ref.split('/');
      id = id[id.length - 1];
      const from = new Date(id);
      const to = new Date(from.getFullYear(), from.getMonth() + 2, 0);
      return {
        id,
        start_date: from.toLocaleString(),
        end_date: to.toLocaleString(),
      };
    }));
  });
}

function get(appkit, args) {
  assert.ok(!(args.org && args.space), 'An organization and space cannot be used at the same time.');
  assert.ok(args.ID, 'An invoice id was not provided.');

  const id = new Date(args.ID);
  const now = new Date();
  if (id.getTime() > now.getTime()) {
    appkit.terminal.error({ code: 404, body: '{"message":"The speicifed invoice was not found"}' });
    return;
  }

  args.org = args.org || args.o;
  args.space = args.space || args.s;
  args.details = args.details || args.d;

  let url = '/account/invoices/';
  if (args.org) {
    url = `/organizations/${args.org}/invoices/`;
  } else if (args.space) {
    url = `/spaces/${args.space}/invoices/`;
  }

  appkit.api.get(url + args.ID, (err, data) => {
    if (err) {
      appkit.terminal.error(err);
      return;
    }

    if (args.details) {
      appkit.terminal.table(data.items);
    }
    appkit.terminal.vtable({
      Addons: Math.round(data.addons_total * 100) / 100,
      Databases: Math.round(data.database_total * 100) / 100,
      Platform: Math.round(data.platform_total * 100) / 100,
      Start: data.period_start,
      End: data.period_end,
      Status: data.payment_status,
      Total: Math.round(data.total * 100) / 100,
    });
  });
}

module.exports = {
  init(appkit) {
    const invoices = {
      org: {
        alias: 'o',
        demand: false,
        string: true,
        description: 'Filter by organization',
      },
      space: {
        alias: 's',
        demand: false,
        string: true,
        description: 'Filter by space',
      },
      details: {
        alias: 'd',
        demand: false,
        boolean: true,
        default: false,
        description: 'Show itemized details',
      },
    };

    appkit.args
      .command('invoices', 'List invoices for all organizations', invoices, list.bind(null, appkit))
      .command('invoices:info ID', 'Get information on a specific invoice', invoices, get.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'invoices',
  help: 'manage and view invoices',
  primary: true,
};
