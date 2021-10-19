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

/**
 * createActions - Create a new action on an app
 */
async function createActions(appkit, args) {
  // Check to make sure we have passed in required arguments
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.size && args.size !== '', 'An action size was not provided.');
    assert.ok(args.name && args.name !== '', 'A name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    process.exit(1);
  }

  // All possible arguments (some of these are optional)
  const {
    app, description, size, command, image, env, name,
  } = args;

  /*
    Code goes here
    Helpful functions:
      appkit.api.post(body, url); -- POST the given body to the given URL
      console.log(str); -- Output a message to the console

    Code should create a JSON object with the payload and POST it to the actions endpoint
  */
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

    const create_action_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
      description: {
        alias: 'd',
        demand: false,
        string: true,
        description: 'An optional description of the action',
      },
      size: {
        alias: 's',
        demand: true,
        string: true,
        description: 'The dyno size to use for the action\'s formation',
      },
      command: {
        alias: 'c',
        demand: false,
        string: true,
        description: 'An optional command to use for the action\'s image',
      },
      image: {
        alias: 'i',
        demand: false,
        string: true,
        description: 'An optional image to use for the action instead of the app\'s image',
      },
      env: {
        alias: 'e',
        demand: false,
        string: true,
        description: 'One or more key-value pairs (KEY=VALUE) to use as additional environment variables',
      },
    };

    appkit.args
      .command('actions', 'List available actions on an app', require_app_option, listActions.bind(null, appkit))
      .command('actions:create NAME', 'Create action on an app', create_action_option, createActions.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'actions',
  help: 'manage actions (create, destroy)',
  primary: true,
};
