const assert = require('assert');

/**
 * ListActions - Get a list of actions based on an app
 */
async function listActions(appkit, args) {
  // Check to make sure we have passed in an app argument
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  try {
    const actions = await appkit.api.get(`/apps/${args.app}/actions`);

    console.log(appkit.terminal.markdown(`###===### **⬢ ${args.app}** Actions ###===###\n`));

    if (!actions || actions.length === 0) {
      console.log(appkit.terminal.markdown('\nNo actions were found.'));
      return;
    }

    // Output should look like the following:
    /*
        === ⬢ app-space Actions ===

        [action-name] (269af9dd-b668-4b5a-b9f1-e76e97304c6d)
        -------------------------------------------------------
        description         Testing for Akkeris Actions
        created             tsz
        updated             tsz

        size
        command
        options
          image
          environment

        ...
    */

    const ui = require('cliui')();

    const md = (s) => appkit.terminal.markdown(s);
    const label = (s) => ({ text: md(`**${s}**`), width: 20 });

    actions.forEach((action) => {
      ui.div(md(`***${action.name}*** ###(${action.action})###`));

      // Spit out - for the entire length of header (+ 4 for spaces/parenthesis)
      ui.div(md(`###${'-'.repeat(action.name.length + action.action.length + 3)}###`));

      ui.div(label('Description'), action.description);
      ui.div(label('Created At'), (new Date(action.created)).toLocaleString());
      ui.div(label('Updated At'), (new Date(action.updated)).toLocaleString());
      ui.div(label('Image'), action.formation.options.image ? action.formation.options.image : 'Latest app image');
      ui.div(label('Command'), action.formation.command ? action.formation.command : 'Default image command');
      ui.div();
      ui.div(appkit.terminal.italic('Environment Variables'));
      if (action.formation.options.env && Object.keys(action.formation.options.env).length > 0) {
        Object.keys(action.formation.options.env).forEach((key) => {
          ui.div(label(key), action.formation.options.env[key]);
        });
      }
    });

    console.log(ui.toString());
    console.log();
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
      .command('actions', 'List available actions on an app', require_app_option, listActions.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'actions',
  help: 'manage actions (create, destroy)',
  primary: true,
};
