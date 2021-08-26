const assert = require('assert');

async function listRecommendations(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  try {
    const recommendations = await appkit.api.get(`/apps/${args.app}/recommendations`);

    console.log(appkit.terminal.markdown(`###===### **⬢ ${args.app}** Recommendations ###===###`));

    if (!recommendations || recommendations.length === 0) {
      console.log(appkit.terminal.markdown('\nNo recommendations were found.'));
      return;
    }

    // Sort by service
    const filtered = {};
    recommendations.forEach((x) => {
      if (!filtered[x.service]) {
        filtered[x.service] = [];
      }
      filtered[x.service].push(x);
    });

    // Output should look like the following:
    /*
        === ⬢ app-space Recommendations ===

        Service: Service_name

        resize formation (269af9dd-b668-4b5a-b9f1-e76e97304c6d)
        -------------------------------------------------------
        description         Resize web from gp1 to gp0 (Underutilized VMem Request in app)
        resource            web
        plan                gp0

        ...
    */

    const md = (s) => appkit.terminal.markdown(s);
    const bld = (s) => md(appkit.terminal.bold(s));
    const label = (s) => ({ text: md(`**${s}**`), width: 20 });
    const ui = require('cliui')();

    ui.div();

    Object.keys(filtered).forEach((service) => {
      ui.div(bld(`Service: ${service[0].toUpperCase()}${service.slice(1)}`));
      ui.div();

      filtered[service].forEach((rec) => {
        ui.div(md(`***${rec.action} ${rec.resource_type.name}*** ###(${rec.id})###`));

        // Spit out - for the entire length of header (+ 4 for spaces/parenthesis)
        ui.div(md(`###${'-'.repeat(rec.action.length + rec.resource_type.name.length + rec.id.length + 4)}###`));

        Object.keys(rec.details).forEach((key) => {
          ui.div(label(key), rec.details[key]);
        });
      });
    });

    console.log(ui.toString());
  } catch (err) {
    appkit.terminal.print(err);
  }
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
      .command('recommendations', 'Show a list of available recommendations on an app', require_app_option, listRecommendations.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'recommendations',
  help: 'manage recommendations for apps',
  primary: true,
};
