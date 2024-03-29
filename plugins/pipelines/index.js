const util = require('util');
const assert = require('assert');

function format_pipeline(pipeline) {
  return `** ᱿ ${pipeline.name}**
  ***Id:*** ${pipeline.id}
  ***Created:*** ${(new Date(pipeline.created_at)).toLocaleString()}\n`;
}

function format_pipeline_couplings(pipeline_couplings) {
  return `** ᱿ ${pipeline_couplings.stage}**
  ***Id:*** ${pipeline_couplings.id}
  ***App:*** ${pipeline_couplings.app.name} (${pipeline_couplings.app.id})
  ***Status Checks:*** ${pipeline_couplings.required_status_checks ? pipeline_couplings.required_status_checks.contexts.join(', ') : ''}\n`;
}

function format_pipeline_statuses(status) {
  return `** ✓ ${status.context}** (${status.name})`;
}

function list(appkit) {
  appkit.api.get('/pipelines', appkit.terminal.format_objects.bind(null, format_pipeline, appkit.terminal.markdown('###===### No pipelines were found.')));
}

// function info(appkit, args) {
//   assert.ok(args.PIPELINE && args.PIPELINE !== '', 'A pipeline was not provided.');
//   appkit.api.get(`/pipelines/${args.PIPELINE}`, appkit.terminal.print);
// }

function list_apps_info(appkit, args) {
  assert.ok(args.PIPELINE && args.PIPELINE !== '', 'A pipeline was not provided.');
  appkit.api.get(`/pipelines/${args.PIPELINE}/pipeline-couplings`, appkit.terminal.format_objects.bind(null, format_pipeline_couplings, appkit.terminal.markdown('###===### No pipeline couplings were found.')));
}

function add(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  assert.ok(args.PIPELINE && args.PIPELINE !== '', 'A pipeline was not provided.');
  args.checks = args.checks || [];
  assert.ok((!args.checks || args.checks) && Array.isArray(args.checks), 'Invalid value was passed in for checks.');
  const payload = {
    app: args.app, pipeline: args.PIPELINE, stage: args.stage, required_status_checks: { contexts: args.checks },
  };
  appkit.api.post(JSON.stringify(payload), '/pipeline-couplings', appkit.terminal.print);
}

// function diff(appkit, args) {
//   console.log('this feature is not yet implemented.');
// }

async function find_release(appkit, app, release_key) {
  const get = util.promisify(appkit.api.get);
  if (/^[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}$/.exec(release_key) !== null) {
    // uuuid
    return get(`/apps/${app}/releases/${release_key}`);
  } if (/^v[0-9]+$/.exec(release_key) !== null || !Number.isNaN(parseInt(release_key, 10))) {
    // vNNN format
    let version = parseInt(release_key, 10);
    if (Number.isNaN(version)) {
      version = parseInt(release_key.substring(1), 10);
    }
    assert.ok(!Number.isNaN(version), 'The version, was not... a version.');
    let results = await get(`/apps/${app}/releases`);
    results = results.filter((x) => x.version === version);
    assert.ok(results.length === 1, `The version ${version} was not found.`);
    return results[0];
  } if (release_key === 'previous') {
    // not current, but one before
    const results = await get(`/apps/${app}/releases`);
    assert.ok(results.length > 1, 'A previous release was not found.');
    return results[results.length - 2];
  }
  // current release
  const results = await get(`/apps/${app}/releases`);
  assert.ok(results.length > 0, 'No releases were found.');
  return results[results.length - 1];
}

async function promote(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  let apps = args.to ? args.to : [];

  apps = apps
    .map((x) => x.split(','))
    .flat()
    .filter((x) => { if (x.trim() === '') return false; return true; });

  const task = appkit.terminal.task(`Promoting app **⬢ ${args.app}**`);
  task.start();

  const begin_pipeline_stages = function begin() {
    appkit.api.get('/pipeline-stages', (err1, stages) => {
      if (err1) {
        task.end('error');
        appkit.terminal.error(err1);
        return;
      }
      // promote to all apps that are a target
      // 1. get the pipeline for this app.
      appkit.api.get(`/apps/${args.app}/pipeline-couplings`, (err2, pipeline_coupling) => {
        if (err2) {
          task.end('error');
          appkit.terminal.error(err2);
          return;
        }
        if (stages[pipeline_coupling.stage] === null) {
          task.end('error');
          appkit.terminal.error('The specified application to promote does not have a promotion target and cannot be promoted.');
          return;
        }
        const source_app = pipeline_coupling.app;
        const { pipeline } = pipeline_coupling;

        // 2. get the pipeline couplings for this pipeline.
        appkit.api.get(`/pipelines/${pipeline_coupling.pipeline.id}/pipeline-couplings`, (err3, pipeline_couplings) => {
          if (err3) {
            task.end('error');
            appkit.terminal.error(err3);
            return;
          }

          // Ensure we can actually send to all the specified apps, or if none were specified, get a list
          // of apps we can and include them all.
          const possible_apps_stages = pipeline_couplings.filter((x) => stages[pipeline_coupling.stage] === x.stage);
          const possible_apps = possible_apps_stages.map((pl) => pl.app);
          if (apps.length === 0) {
            if (possible_apps.length === 0) {
              task.end('error');
              appkit.terminal.error('The specified application has no downstream apps to promote to.');
              return;
            }
            apps = possible_apps;
          } else {
            const filtered_apps = possible_apps.filter((papp) => apps.some((app) => app === papp.id || app === papp.name));
            if (apps.length !== filtered_apps.length) {
              task.end('error');
              appkit.terminal.error(`The specified app(s) to promote to was invalid, possible targets: ${possible_apps.map((x) => x.name).join(',')}`);
              return;
            }
            apps = filtered_apps;
          }
          // Promote the applications
          const payload = { pipeline, source: { app: source_app } };
          if (args.release) {
            payload.source.app.release = { id: args.release };
          }
          payload.targets = apps.map((x) => ({ app: x }));
          if (!args.unsafe) {
            payload.safe = true;
          } else if (args.unsafe === true) {
            payload.safe = false;
          }
          appkit.api.post(JSON.stringify(payload), '/pipeline-promotions', (err, result) => {
            if (err) {
              task.end('error');
              appkit.terminal.error(err);
              return;
            }
            const from = pipeline_couplings.filter((x) => x.app.id === result.source.app.id).map((x) => x.stage);
            const to = pipeline_couplings
              .filter((x) => payload.targets.map((y) => y.app.id).indexOf(x.app.id) !== -1)
              .map((x) => x.stage)
              .filter((v, i, s) => s.indexOf(v) === i);
            task.end('ok');
            console.log();
            console.log(appkit.terminal.markdown(`** ᱿ ${pipeline.name} pipeline** (${from.join(',')} -> ${to.join(',')})

Promoted: **⬢ ${result.source.app.name}-${result.source.space.name}** (Release: ${result.source.release.id || args.release})
      To: ${payload.targets.map((x) => `**⬢ ${x.app.name}** `).join('\n\t  ')}
`));
          });
        });
      });
    });
  };

  if (args.release) {
    const release = await find_release(appkit, args.app, args.release);
    assert.ok(release, `The release ${args.release} could not be found.`);
    args.release = release.id;
  }
  begin_pipeline_stages();
}

function remove(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get(`/apps/${args.app}/pipeline-couplings`, (err, pipeline_coupling) => {
    if (err) {
      appkit.terminal.error(err);
      return;
    }
    appkit.api.delete(`/pipeline-couplings/${pipeline_coupling.id}`, appkit.terminal.print);
  });
}

// function rename(appkit, args) {
//   console.log('this feature is not yet implemented.');
// }

async function update(appkit, args) {
  const task = appkit.terminal.task(`Updating pipeline coupling **${args.PIPELINE_COUPLING}**`);
  args.checks = args.checks || [];
  task.start();
  try {
    await appkit.api.patch(JSON.stringify({ required_status_checks: { contexts: args.checks } }), `/pipeline-couplings/${args.PIPELINE_COUPLING}`);
    task.end('ok');
  } catch (e) {
    task.end('error');
    appkit.terminal.error(e);
  }
}

function create(appkit, args) {
  assert.ok(args.NAME && args.NAME !== '', 'A name for the pipeline was not provided.');
  appkit.api.post(JSON.stringify({ name: args.NAME }), '/pipelines', appkit.terminal.print);
}

function destroy(appkit, args) {
  assert.ok(args.PIPELINE && args.PIPELINE !== '', 'A pipeline was not provided.');
  appkit.api.delete(`/pipelines/${args.PIPELINE}`, appkit.terminal.print);
}

async function list_statuses(appkit, args) {
  assert.ok(args.PIPELINE && args.PIPELINE !== '', 'A pipeline was not provided.');
  await appkit.api.get(`/pipelines/${args.PIPELINE}/statuses`,
    appkit.terminal.format_objects.bind(null,
      format_pipeline_statuses,
      appkit.terminal.markdown('###===### No available statuses were found.')));
}

const require_app_option = {
  app: {
    alias: 'a',
    demand: true,
    string: true,
    description: 'The app to act on.',
  },
};

const require_app_stage_option = {
  ...require_app_option,
  stage: {
    alias: 's',
    description: 'Pipeline stage',
    choices: ['review', 'development', 'staging', 'production'],
    demand: true,
  },
  checks: {
    alias: 'c',
    description: 'Comma-separated list of release statuses to add as required checks on this app and stage.',
    demand: false,
    array: true,
  },
};


const require_checks_option = {
  checks: {
    alias: 'c',
    description: 'Comma-separated list of release statuses to add as required checks on this app and stage.',
    demand: false,
    array: true,
  },
};

const require_app_promote_option = {
  ...require_app_option,
  to: {
    alias: 't',
    description: 'Comma-separated list of apps to promote to',
    array: true,
  },
  release: {
    alias: 'r',
    demand: false,
    string: true,
    description: 'The release uuid to promote (defaults to the last release)',
  },
  unsafe: {
    alias: 'u',
    demand: false,
    boolean: true,
    default: false,
    description: 'Promotes release even if missing config vars or addons are found in the destination app',
  },
};

module.exports = {

  init(appkit) {
    appkit.args
      .command('pipelines', 'List all pipelines', {}, list.bind(null, appkit))
      .command('pipelines:add PIPELINE', 'Add an app with checks to a pipeline', require_app_stage_option, add.bind(null, appkit))
      .command('pipelines:create NAME', 'Create a new pipeline', {}, create.bind(null, appkit))
      .command('pipelines:destroy PIPELINE', 'Permanently destroy a pipeline', {}, destroy.bind(null, appkit))
      .command('pipelines:info PIPELINE', 'Display the list of apps in a pipeline', {}, list_apps_info.bind(null, appkit))
      .command('pipelines:promote', 'Promote the latest release of an app to its downstream apps(s)', require_app_promote_option, promote.bind(null, appkit))
      .command('pipelines:remove', 'Remove an app from a pipeline', require_app_option, remove.bind(null, appkit))
      .command('pipelines:update PIPELINE_COUPLING', 'Update the status checks in a pipeline', require_checks_option, update.bind(null, appkit))
      .command('pipelines:checks PIPELINE', 'Get a list of release statuses available to add as checks on this pipeline', {}, list_statuses.bind(null, appkit))
      // Aliases
      .command('pipelines:list', false, list.bind(null, appkit))
      .command('promote', false, require_app_promote_option, promote.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'pipelines',
  help: 'promote one app to one or more other app(s)',
  primary: true,
};
