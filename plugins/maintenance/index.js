const assert = require('assert');
const fs = require('fs');

/* eslint-disable */
async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
/* eslint-enable */

function get_info(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get(`/apps/${args.app}`, (err, info) => {
    if (err || !info) {
      appkit.terminal.print(err);
      return;
    }
    if (info.maintenance === true) {
      console.log('on');
    } else {
      console.log('off');
    }
  });
}

function maintenance(state, appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  const task = appkit.terminal.task(`${(state === true ? 'Enabling' : 'Disabling')} maintenance mode for **⬢ ${args.app}**`);
  task.start();
  appkit.api.patch(JSON.stringify({ maintenance: state }), `/apps/${args.app}`, (err, info) => {
    if (err || !info) {
      task.end('error');
      appkit.terminal.print(err);
      return;
    }
    task.end('ok');
  });
}

const on = maintenance.bind(null, true);
const off = maintenance.bind(null, false);

// Apply maintenance mode to one or more apps at a time
async function batchMaintenance(state, appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'At least one application must be provided.');

    const apps = Array.isArray(args.app) ? args.app : [args.app];
    const badApps = [];

    // Verify that each app is valid
    await asyncForEach(apps, async (app) => {
      try {
        await appkit.api.get(`/apps/${app}`);
      } catch (err) {
        badApps.push(app);
      }
    });

    if (badApps.length > 0) {
      appkit.terminal.error(`There was a problem retrieving information about the following apps: ${badApps.join(', ')}`);
      return;
    }

    // Callback function to send a PATCH for all provided apps
    const applyMaintenancePatch = (input) => {
      if (input === 'confirm') {
        const task = appkit.terminal.task(`${(state === true ? 'Enabling' : 'Disabling')} maintenance mode for given app(s)`);
        task.start();

        Promise.all(
          apps.map(async (app) => {
            try {
              await appkit.api.patch(JSON.stringify({ maintenance: state }), `/apps/${app}`);
              return { app };
            } catch (error) {
              return { app, error };
            }
          }).map((p) => p.catch((e) => e)),
        ).then((values) => {
          const errors = values.filter((v) => Object.prototype.hasOwnProperty.call(v, 'error'));
          const successes = values.filter((v) => !Object.prototype.hasOwnProperty.call(v, 'error'));
          if (errors.length > 0) {
            task.end('error');
            console.log(appkit.terminal.markdown('\n~~Some tasks failed with errors:~~'));
            errors.forEach((e) => {
              console.log(appkit.terminal.markdown(`!!${e.app}!!: ${e.error.code} ${e.error.body.toString()}`));
            });
            console.log(`\nThe following apps were successfully ${(state === true ? 'placed into' : 'taken out of')} maintenance mode:`);
            console.log(appkit.terminal.markdown(`${successes.map((a) => `• ^^${a.app}^^`).join('\n')}`));
            return;
          }
          task.end('ok');
        });
      } else {
        appkit.terminal.soft_error('Confirmation did not match. Aborted.');
      }
    };

    // Wait for user confirmation (or bypass with confirm flag)
    if (args.confirm) {
      applyMaintenancePatch('confirm');
    } else {
      let confirmText = `~~▸~~    This will ${(state === true ? 'put' : 'take')} the following application(s) ${(state === true ? 'IN' : 'OUT of')} maintenance mode:\n`;
      confirmText += `${apps.map((a) => `~~▸~~    • ***${a}***`).join('\n')}\n`;
      confirmText += '~~▸~~    To proceed, type !!confirm!! or re-run this command with !!--confirm!!\n';

      appkit.terminal.confirm(confirmText, applyMaintenancePatch);
    }
  } catch (err) {
    appkit.terminal.error(err);
  }
}

const batchMaintenanceOn = batchMaintenance.bind(null, true);
const batchMaintenanceOff = batchMaintenance.bind(null, false);

// Save formation state to a file for the given app
async function saveFormations(api, app, filename) {
  let formations;
  formations = await api.get(`/apps/${app}/formation`);
  // Only save properties that we need
  formations = formations.map((f) => ({
    id: f.id,
    type: f.type,
    command: f.command,
    healthcheck: f.healthcheck,
    quantity: f.quantity,
    port: f.port,
    size: f.size,
  }));
  fs.writeFileSync(`${process.cwd()}/${filename}`, JSON.stringify(formations, null, 2));
  return formations;
}

async function saveState(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  const task = appkit.terminal.task(`Saving formation state for ${args.app} to ${args.filename}`);
  task.start();

  try {
    await saveFormations(appkit.api, args.app, args.filename);
    task.end('ok');
  } catch (err) {
    task.end('error');
    appkit.terminal.print(err);
  }
}

async function restoreState(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    await appkit.api.get(`/apps/${args.app}`);
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  const has = (object, property) => Object.prototype.hasOwnProperty.call(object, property);

  let cd = false;
  let state;
  try {
    // Is file in current directory?
    if (fs.existsSync(`${process.cwd()}/${args.filename}`)) {
      cd = true;
    } else if (fs.existsSync(args.filename)) {
      cd = false;
    } else {
      throw new Error('Unable to find specified file');
    }
    const file = fs.readFileSync(cd ? `${process.cwd()}/${args.filename}` : args.filename);

    state = JSON.parse(file);

    // Verify state structure
    assert.ok(Array.isArray(state), 'State file should be an array of formations');

    // Verify that the following properties are present in each formation object:
    // command, quantity, size, type, port, healthcheck
    assert.ok(
      state.filter((formation) => (
        has(formation, 'command')
        && has(formation, 'quantity')
        && has(formation, 'size')
        && has(formation, 'type')
        && has(formation, 'port')
        && has(formation, 'healthcheck')
      ).length === state.length),
      'Each formation should contain command, quantity, size, type, port, and healthcheck',
    );
  } catch (err) {
    appkit.terminal.print(err);
  }

  const applyBatchMaintenancePatch = (input) => {
    if (input === 'confirm') {
      const task = appkit.terminal.task(`Restoring state on app ${args.app} for given formations`);
      task.start();

      appkit.api.patch(JSON.stringify(state), `/apps/${args.app}/formation`).then(() => {
        task.end('ok');
      }).catch((error) => {
        task.end('error');
        appkit.terminal.print(error);
      });
    } else {
      appkit.terminal.soft_error('Confirmation did not match. Aborted.');
    }
  };

  // Wait for user confirmation (or bypass with confirm flag)
  if (args.confirm) {
    applyBatchMaintenancePatch('confirm');
  } else {
    let confirmText = `~~▸~~    This will restore the following formation state for ${args.app}:\n`;
    confirmText += `${state.map((f) => `~~▸~~    • ***${f.type}*** (${f.quantity})\n~~▸~~        size: ${f.size}, port: ${f.port}, command: ${f.command ? `'${f.command}'` : 'null'}, healthcheck: ${f.healthcheck ? `'${f.healthcheck}'` : 'null'}`).join('\n')}\n`;
    confirmText += '~~▸~~    To proceed, type !!confirm!! or re-run this command with !!--confirm!!\n';
    appkit.terminal.confirm(confirmText, applyBatchMaintenancePatch);
  }
}

async function scaleDown(appkit, args) {
  try {
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  } catch (err) {
    appkit.terminal.error(err);
    return;
  }

  let formations;

  const task = appkit.terminal.task(`Saving formation state for ${args.app} to ${args.filename}`);
  task.start();

  try {
    formations = await saveFormations(appkit.api, args.app, args.filename);
    task.end('ok');
  } catch (err) {
    task.end('error');
    appkit.terminal.print(err);
    return;
  }

  // Set all formations to 0
  formations = formations.map((formation) => ({
    ...formation,
    quantity: 0,
  }));

  const scaleFormationsToZero = (input) => {
    if (input === 'confirm') {
      const task2 = appkit.terminal.task(`Scaling down all formations on ${args.app}`);
      task2.start();

      appkit.api.patch(JSON.stringify(formations), `/apps/${args.app}/formation`).then(() => {
        task2.end('ok');
      }).catch((error) => {
        task2.end('error');
        appkit.terminal.print(error);
      });
    } else {
      appkit.terminal.soft_error('Confirmation did not match. Aborted.');
    }
  };

  // Wait for user confirmation (or bypass with confirm flag)
  if (args.confirm) {
    scaleFormationsToZero('confirm');
  } else {
    let confirmText = `~~▸~~    This will scale down the following formations on ***${args.app}***:\n`;
    confirmText += `${formations.map((formation) => `~~▸~~    • ${formation.type}`).join('\n')}\n`;
    confirmText += '~~▸~~    To proceed, type !!confirm!! or re-run this command with !!--confirm!!\n';
    appkit.terminal.confirm(confirmText, scaleFormationsToZero);
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

    const batchOptions = {
      confirm: {
        alias: 'c',
        demand: false,
        boolean: true,
        description: 'Confirm (in advance) that you wish to manage maintenance mode for the app(s)',
      },
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app(s) to manage - add as many as you want',
      },
    };

    const saveStateOptions = {
      filename: {
        alias: 'f',
        demand: true,
        string: true,
        description: 'Name of the file to save formation state to',
      },
      ...require_app_option,
    };

    const restoreStateOptions = {
      filename: {
        alias: 'f',
        demand: true,
        string: true,
        description: 'Name of the file containing a previously saved state',
      },
      confirm: {
        alias: 'c',
        demand: false,
        boolean: true,
        description: 'Confirm (in advance) that you wish to restore formation state',
      },
      ...require_app_option,
    };

    const scaleDownOptions = {
      filename: {
        alias: 'f',
        demand: true,
        string: true,
        description: 'Name of the file to save formation state to',
      },
      confirm: {
        alias: 'c',
        demand: false,
        boolean: true,
        description: 'Confirm (in advance) that you wish to scale app formations to 0',
      },
      ...require_app_option,
    };

    appkit.args
      .command('maintenance', 'Display the maintenance mode status of an app', require_app_option, get_info.bind(null, appkit))
      .command('maintenance:on', 'Put an app into maintenance mode', require_app_option, on.bind(null, appkit))
      .command('maintenance:off', 'Take an app out of maintenance mode', require_app_option, off.bind(null, appkit))

      .command('maintenance:batch:on', 'Turn maintenance mode ON on multiple apps', batchOptions, batchMaintenanceOn.bind(null, appkit))
      .command('maintenance:batch:off', 'Turn maintenance mode OFF on multiple apps', batchOptions, batchMaintenanceOff.bind(null, appkit))

      .command('maintenance:state:save', 'Save app formation state to a file', saveStateOptions, saveState.bind(null, appkit))
      .command('maintenance:state:restore', 'Restore app formation state from a file', restoreStateOptions, restoreState.bind(null, appkit))
      .command('maintenance:scaleDown', 'Scale all formations of an app to 0 after saving state to file', scaleDownOptions, scaleDown.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'apps',
  help: 'put apps in or out of maintenance mode',
  primary: true,
};
