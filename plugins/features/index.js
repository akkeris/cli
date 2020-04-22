function list(appkit, args) {
  appkit.api.get(`/apps/${args.app}/features`, (err, features) => {
    if (err) {
      appkit.terminal.error(err);
    } else {
      appkit.terminal.table(features.map((x) => ({
        name: x.name, display_name: x.display_name, description: x.description, enabled: x.enabled,
      })));
    }
  });
}

function disable(appkit, args) {
  appkit.api.patch(
    JSON.stringify({ enabled: false }),
    `/apps/${args.app}/features/${args.FEATURE}`,
    async (err, feature) => {
      if (err) {
        appkit.terminal.error(err);
      } else {
        console.log(appkit.terminal.markdown(`**⬢ ${args.app}** - ${feature.display_name} - ##disabled##`));
      }
    },
  );
}

function enable(appkit, args) {
  appkit.api.patch(JSON.stringify({ enabled: true }), `/apps/${args.app}/features/${args.FEATURE}`, async (err, feature) => {
    if (err) {
      appkit.terminal.error(err);
    } else {
      console.log(appkit.terminal.markdown(`**⬢ ${args.app}** - ${feature.display_name} - ^^enabled^^`));
    }
  });
}

function info(appkit, args) {
  appkit.api.get(`/apps/${args.app}/features/${args.FEATURE}`, (err, feature) => {
    if (err) {
      appkit.terminal.error(err);
    } else {
      console.log(appkit.terminal.markdown(`**⬢ ${args.app}** - ${feature.display_name} - ${feature.enabled ? '^^enabled^^' : '##disabled##'}`));
      console.log(appkit.terminal.markdown(feature.description));
    }
  });
}

module.exports = {
  init(appkit) {
    const require_app_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
    };

    appkit.args
      .command('features', 'List available features on an app', require_app_option, list.bind(null, appkit))
      .command('features:disable FEATURE', 'Disable a feature on an app', require_app_option, disable.bind(null, appkit))
      .command('features:enable FEATURE', 'Enable a feature on an app', require_app_option, enable.bind(null, appkit))
      .command('features:info FEATURE', 'Get information on a feature for an app', require_app_option, info.bind(null, appkit))
      // Aliases
      .command('app:features', false, require_app_option, list.bind(null, appkit))
      .command('app:features:info FEATURE', false, require_app_option, info.bind(null, appkit))
      .command('app:features:disable FEATURE', false, require_app_option, disable.bind(null, appkit))
      .command('app:features:enable FEATURE', false, require_app_option, enable.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'apps',
  help: 'manage features on an app',
  primary: true,
};
