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
      ui.div(label('Command'), action.formation.command ? `'${action.formation.command}'` : 'Default image command');
      ui.div(label('Size'), action.formation.size);
      ui.div(label('Events'), action.events || md('###n/a###'));

      if (action.formation.options.env && Object.keys(action.formation.options.env).length > 0) {
        Object.keys(action.formation.options.env).forEach((key, idx) => {
          ui.div(label(idx > 0 ? ' ' : 'Env Vars'), `'${key}' = '${action.formation.options.env[key]}'`);
        });
      } else {
        ui.div(label('Env Vars'), md('###n/a###'));
      }
      ui.div();
    });

    console.log(ui.toString());
  } catch (err) {
    appkit.terminal.print(err);
  }
}

/**
 * DescribeAction - Describe an action
 */
async function describeAction(appkit, args) {
  args.action = args.ACTION;
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.action && args.action !== '', 'An action was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  try {
    const action = await appkit.api.get(`/apps/${args.app}/actions/${args.action}`);

    if (!action) {
      console.log(appkit.terminal.markdown('\nNo actions were found.'));
      return;
    }

    const ui = require('cliui')();

    const md = (s) => appkit.terminal.markdown(s);
    const label = (s) => ({ text: md(`**${s}**`), width: 20 });

    ui.div(md(`***${action.name}*** ###(${action.action})###`));

    // Spit out - for the entire length of header (+ 4 for spaces/parenthesis)
    ui.div(md(`###${'-'.repeat(action.name.length + action.action.length + 3)}###`));

    ui.div(label('Description'), action.description);
    ui.div(label('Created At'), (new Date(action.created)).toLocaleString());
    ui.div(label('Updated At'), (new Date(action.updated)).toLocaleString());
    ui.div(label('Image'), action.formation.options.image ? action.formation.options.image : 'Latest app image');
    ui.div(label('Command'), action.formation.command ? `'${action.formation.command}'` : 'Default image command');
    ui.div(label('Size'), action.formation.size);
    ui.div(label('Events'), action.events || md('###n/a###'));

    if (action.formation.options.env && Object.keys(action.formation.options.env).length > 0) {
      Object.keys(action.formation.options.env).forEach((key, idx) => {
        ui.div(label(idx > 0 ? ' ' : 'Env Vars'), `'${key}' = '${action.formation.options.env[key]}'`);
      });
    } else {
      ui.div(label('Env Vars'), md('###n/a###'));
    }
    ui.div();

    console.log(ui.toString());
  } catch (err) {
    appkit.terminal.print(err);
  }
}

/**
 * ListActionRuns - Get a list of action runs for an action
 */
async function listActionRuns(appkit, args) {
  args.action = args.ACTION;
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.action && args.action !== '', 'An action was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  try {
    const runs = await appkit.api.get(`/apps/${args.app}/actions/${args.action}/runs`);

    console.log(appkit.terminal.markdown(`###===### **${args.action}** Action Runs ###===###\n`));

    if (!runs || runs.length === 0) {
      console.log(appkit.terminal.markdown(`\nNo action runs for **${args.action}** were found.`));
      return;
    }

    const ui = require('cliui')();

    const md = (s) => appkit.terminal.markdown(s);
    const label = (s) => ({ text: md(`**${s}**`), width: 20 });
    const srt = (a, b) => a.run_number - b.run_number;

    if (runs.length > 10) {
      console.log('Showing last 10 runs...\n');
    }

    runs.sort(srt).slice(-10).reverse().forEach((run) => {
      ui.div((md(`**Run #${run.run_number}** ###(${run.action_run})###`)));

      // Spit out - for the entire length of header (5 for 'Run #', 3 for ' ()')
      ui.div(md(`###${'-'.repeat(run.run_number.toString().length + run.action_run.length + 5 + 3)}###`));

      ui.div(label('Status'), run.status);
      ui.div(label('Started At'), (new Date(run.started_at)).toLocaleString());
      ui.div(label('Finished At'), run.finished_at ? (new Date(run.finished_at)).toLocaleString() : md('###n/a###'));
      ui.div(label('Source'), run.source);
      ui.div(label('Exit Code'), run.exit_code || md('###n/a###'));
      ui.div();
    });

    console.log(ui.toString());
  } catch (err) {
    appkit.terminal.print(err);
  }
}

/**
 * describeActionRun - Get a list of action runs for an action
 */
async function describeActionRun(appkit, args) {
  args.action = args.ACTION;
  args.run = args.RUN;
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.action && args.action !== '', 'An action was not provided.');
    assert.ok(args.run && args.run !== '', 'An action run was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  try {
    const run = await appkit.api.get(`/apps/${args.app}/actions/${args.action}/runs/${args.run}`);

    if (!run) {
      console.log(appkit.terminal.markdown(`\nNo action run matching ${args.run} for **${args.action}** was found.`));
      return;
    }

    const ui = require('cliui')();

    const md = (s) => appkit.terminal.markdown(s);
    const label = (s) => ({ text: md(`**${s}**`), width: 20 });

    ui.div((md(`**Run #${run.run_number}** ###(${run.action_run})###`)));

    // Spit out - for the entire length of header (5 for 'Run #', 3 for ' ()')
    ui.div(md(`###${'-'.repeat(run.run_number.toString().length + run.action_run.length + 5 + 3)}###`));

    ui.div(label('Status'), run.status);
    ui.div(label('Started At'), (new Date(run.started_at)).toLocaleString());
    ui.div(label('Finished At'), run.finished_at ? (new Date(run.finished_at)).toLocaleString() : md('###n/a###'));
    ui.div(label('Source'), run.source);
    ui.div(label('Exit Code'), run.exit_code || md('###n/a###'));
    ui.div();

    console.log(ui.toString());
  } catch (err) {
    appkit.terminal.print(err);
  }
}

/**
 * createAction - Create a new action on an app
 */
async function createAction(appkit, args) {
  args.name = args.NAME;
  // Check to make sure we have passed in required arguments
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.name && args.name !== '', 'A name was not provided.');
    assert.ok(args.command && args.command !== '', 'A command was not provided.');
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

  // Make sure that env follows this forrmat: { "key": "value" }
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

  // If events are in an array, convert to string
  if (args.events && Array.isArray(args.events) && args.events.length > 0) {
    args.events = args.events.join(',');
  }

  // Make sure events are formatted properly (comma-separated string)
  if (args.events && typeof args.events === 'string' && args.events !== '') {
    requestPayload.events = args.events;
  }

  const task = appkit.terminal.task(`Creating action **${args.name}**`);
  task.start();
  try {
    await appkit.api.post(JSON.stringify(requestPayload), `/apps/${args.app}/actions`);
  } catch (err) {
    task.end('error');
    appkit.terminal.error(err);
    return;
  }
  task.end('ok');
}

/**
 * deleteAction - Delete an existing action on an app
 */
async function deleteAction(appkit, args) {
  // Check to make sure we have passed in required arguments
  args.action = args.ACTION;
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.action && args.action !== '', 'A action was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    process.exit(1);
  }

  const task = appkit.terminal.task(`Deleting action **${args.action}** from ${args.app}`);
  task.start();
  try {
    await appkit.api.delete(`/apps/${args.app}/actions/${args.action}`);
  } catch (err) {
    task.end('error');
    appkit.terminal.error(err);
    return;
  }
  task.end('ok');
}

/**
 * updateAction - update an existing action on an app
 */
async function updateAction(appkit, args) {
  args.action = args.ACTION;
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.action && args.action !== '', 'An action was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    process.exit(1);
  }
  const updateRequestPayload = {
    size: args.size,
    options: {
    },
    name: args.action,
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

  // If events are in an array, convert to string
  if (args.events && Array.isArray(args.events) && args.events.length > 0) {
    args.events = args.events.join(',');
  }

  // Make sure events are formatted properly (comma-separated string)
  if (args.events && typeof args.events === 'string' && args.events !== '') {
    updateRequestPayload.events = args.events;
  } else if (!args.events || (typeof args.events === 'string' && args.events === '')) {
    updateRequestPayload.events = '';
  }

  const task = appkit.terminal.task(`Updating action **${args.action}**`);
  task.start();
  try {
    await appkit.api.patch(JSON.stringify(updateRequestPayload), `/apps/${args.app}/actions/${args.action}`);
  } catch (err) {
    task.end('error');
    appkit.terminal.error(err);
    return;
  }
  task.end('ok');
}

/**
 * triggerAction - Trigger an action on an app
 */
async function triggerAction(appkit, args) {
  // Check to make sure we have passed in required arguments
  args.action = args.ACTION;
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    assert.ok(args.action && args.action !== '', 'A action was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    process.exit(1);
  }

  const task = appkit.terminal.task(`Triggering action **${args.action}** on ${args.app}`);
  task.start();
  try {
    await appkit.api.post(null, `/apps/${args.app}/actions/${args.action}/runs`);
  } catch (err) {
    task.end('error');
    appkit.terminal.error(err);
    return;
  }
  task.end('ok');
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
        demand: true,
        string: true,
        description: 'The command to use for the action\'s image',
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
      events: {
        alias: 'v',
        demand: false,
        string: true,
        description: 'Comma separated list of events that should trigger the action',
      },
    };

    const delete_action_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The name of the app to act on',
      },
    };

    const trigger_action_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The name of the app to act on',
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
      events: {
        alias: 'v',
        demand: false,
        string: true,
        description: 'Comma separated list of events that should trigger the action',
      },
    };

    appkit.args
      .command('actions', 'List available actions on an app', require_app_option, listActions.bind(null, appkit))
      .command('actions:create NAME', 'Create action on an app', create_action_option, createAction.bind(null, appkit))
      .command('actions:info ACTION', 'Get action info on an app', require_app_option, describeAction.bind(null, appkit))
      .command('actions:trigger ACTION', 'Trigger action on an app', trigger_action_option, triggerAction.bind(null, appkit))
      .command('actions:update ACTION', 'Update an action on an app', update_action_option, updateAction.bind(null, appkit))
      .command('actions:delete ACTION', 'Delete an action on an app', delete_action_option, deleteAction.bind(null, appkit))
      .command('actions:runs ACTION', 'List action runs on an app', require_app_option, listActionRuns.bind(null, appkit))
      .command('actions:runs:info ACTION RUN', 'Get info on a specific action run on an app', require_app_option, describeActionRun.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'actions',
  help: 'manage actions (create, destroy)',
  primary: true,
};
