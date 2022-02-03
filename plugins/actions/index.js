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
    assert.ok(args.name && args.name !== '', 'A name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    process.exit(1);
  }
  // All possible arguments (some of these are optional)
  const requestPayload = {
    size: args.size,
    options: {
    },
    name: args.name,
  };
  if (args.description && args.description !== '') {
    requestPayload.description = args.description;
  }
  if (args.image && args.image !== '') {
    requestPayload.options.image = args.image;
  }
  if (args.command && args.command !== '') {
    requestPayload.command = args.command;
  }
  if (args.env && typeof args.env === 'string' && args.env !== '') {
    args.env = [args.env];
  }

  if (args.env && Array.isArray(args.env) && args.env.length > 0) {
    const values_paired = args.env;
    const values = {};
    /* eslint-disable no-restricted-syntax */
    for (const value of values_paired) {
      if (value.indexOf('=') !== -1) {
        const key = value.substring(0, value.indexOf('='));
        const val = value.substring(value.indexOf('=') + 1);
        if (key && val) {
          values[key] = val;
        }
      }
    }
    requestPayload.options.env = values;
  }
  appkit.api.post(JSON.stringify(requestPayload), `/apps/${args.app}/actions`)
    .then(() => {
      console.log(`Action ${args.name} is successfully created`);
    })
    .catch((err) => {
      appkit.terminal.error(err);
    });
}

/**
 * deleteAction - Delete an existing action on an app
 */
async function deleteAction(appkit, args) {
  // Check to make sure we have passed in required arguments
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.action && args.action !== '', 'A action was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    process.exit(1);
  }
  const loader = appkit.terminal.loading(`Deleting action ${args.action} from ${args.app}`);
  loader.start();
  appkit.api.delete(`/apps/${args.app}/actions/${args.action}`, (err) => {
    loader.end();
    if (err) {
      appkit.terminal.error(err);
      return;
    }
    console.log(appkit.terminal.markdown(`###===### **${args.action}** has been succesfully deleted from ##${args.app}##`));
  });
}

/**
 * updateAction - update an existing action on an app
 */
async function updateAction(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.name && args.name !== '', 'A action was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    process.exit(1);
  }
  const updateRequestPayload = {
    size: args.size,
    options: {
    },
    name: args.name,
  };
  if (args.description && args.description !== '') {
    updateRequestPayload.description = args.description;
  }
  if (args.image) {
    updateRequestPayload.options.image = args.image;
  }
  if (args.command && args.command !== '') {
    updateRequestPayload.command = args.command;
  }
  if (args.env && typeof args.env === 'string' && args.env !== '') {
    args.env = [args.env];
  }

  if (args.env && Array.isArray(args.env) && args.env.length > 0) {
    const values_paired = args.env;
    const values = {};
    /* eslint-disable no-restricted-syntax */
    for (const value of values_paired) {
      if (value.indexOf('=') !== -1) {
        const key = value.substring(0, value.indexOf('='));
        const val = value.substring(value.indexOf('=') + 1);
        if (key && val) {
          values[key] = val;
        }
      }
    }
    updateRequestPayload.options.env = values;
  }
  appkit.api.patch(JSON.stringify(updateRequestPayload), `/apps/${args.app}/actions/${args.name}`)
    .then(() => {
      console.log(`Action ${args.name} is successfully updated`);
    })
    .catch((err) => {
      appkit.terminal.error(err);
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
        demand: false,
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
      name: {
        alias: 'n',
        demand: true,
        string: true,
        description: 'The name of the action',
      },
    };

    const delete_action_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The name of the app to act on',
      },
      action: {
        alias: 'n',
        demand: true,
        string: true,
        description: 'An name of the action',
      },
    };

    const update_action_option = {
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
        demand: false,
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
      name: {
        alias: 'n',
        demand: true,
        string: true,
        description: 'The name of the action',
      },
    };

    appkit.args
      .command('actions', 'List available actions on an app', require_app_option, listActions.bind(null, appkit))
      .command('actions:create', 'Create action on an app', create_action_option, createActions.bind(null, appkit))
      .command('actions:delete', 'Delete action on an app', delete_action_option, deleteAction.bind(null, appkit))
      .command('actions:update', 'update existing action on an app', update_action_option, updateAction.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'actions',
  help: 'manage actions (create, destroy)',
  primary: true,
};
