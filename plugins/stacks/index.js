function get_stacks(appkit, args) {
  appkit.api.get('/stacks', (err, stacks) => {
    if (err) {
      appkit.terminal.error(err);
      return;
    }
    if (args.json) {
      console.log(JSON.stringify(stacks, null, 2));
    } else {
      appkit.terminal.table(stacks.map((stack) => ({
        ID: stack.name,
        Region: stack.region.name,
        State: stack.state,
      })));
    }
  });
}

module.exports = {
  init(appkit) {
    const config_option = {
      json: {
        alias: 'j',
        demand: false,
        boolean: true,
        default: false,
        description: 'Output in JSON format',
      },
    };
    appkit.args
      .command('stacks', 'List available stacks for deployment', config_option, get_stacks.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'stacks',
  help: 'inquire about available runtimes to deploy within regions',
  primary: true,
};
