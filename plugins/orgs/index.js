const assert = require('assert');

function format_org(org) {
  return `** ⃫ ${org.name}**
  ***Id:*** ${org.id}\n`;
}

function list_orgs(appkit) {
  appkit.api.get('/organizations', appkit.terminal.format_objects.bind(null, format_org, appkit.terminal.markdown('###===### No orgs were found.')));
}

function info_orgs(appkit, args) {
  assert.ok(args.NAME && args.NAME !== '', 'An organization name was not provided.');
  appkit.api.get(`/organizations/${args.NAME}`, appkit.terminal.print);
}

function create_orgs(appkit, args) {
  assert.ok(args.NAME && args.NAME !== '', 'An organization name was not provided.');
  assert.ok(args.NAME.indexOf(' ') === -1, 'An organization name cannot contain spaces.');
  args.NAME = args.NAME.toLowerCase();
  const payload = { name: args.NAME, description: (args.contact || '') };
  appkit.api.post(JSON.stringify(payload), '/organizations', appkit.terminal.print);
}

module.exports = {
  init(appkit) {
    const create_org_options = {
      contact: {
        string: true,
        demand: false,
        description: 'The contact information for the new organization',
      },
    };

    appkit.args
      .command('orgs', 'List available Akkeris organizations', {}, list_orgs.bind(null, appkit))
      .command('orgs:info NAME', 'Get information on the specified organization', {}, info_orgs.bind(null, appkit))
      .command('orgs:create NAME', 'Create a new organization', create_org_options, create_orgs.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'orgs',
  help: 'view organizations',
  primary: true,
};
