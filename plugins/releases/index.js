
const util = require('util');
const assert = require('assert');

function format_release(appkit, release) {
  let state = ' ~~●~~ ';
  if (release.status === 'succeeded') {
    if (release.state === 'pending') {
      state = ' ~~●~~ ';
    } else if (release.state === 'failure') {
      state = ' !!✕!! ';
    } else if (release.state === 'error') {
      state = ' !!⚠!! ';
    } else {
      state = ' ^^^✓^^^ ';
    }
  } else if (release.status === 'pending' || release.status === 'queued') {
    state = ' ~~●~~ ';
  } else if (release.status === 'failed') {
    state = ' !!⚠!! ';
  } else {
    state = ' ###●### ';
  }
  if (release.build) {
    const info = [
      release.current ? '^^^current^^^' : '',
      release.description,
      release.build.source_blob.author,
      release.build.source_blob.message ? `##${release.build.source_blob.message.replace(/#/g, '').replace(/\s+/g, ' ')}##` : '',
      release.build.source_blob.commit ? `${release.build.source_blob.commit.substring(0, 7)}` : '',
    ].filter((x) => x && x !== '').map((x) => x.toString().replace(/\n/g, ' '));
    return `**• ${release.version ? `v${release.version}` : 'N/A'}**\t${appkit.terminal.friendly_date(new Date(release.created_at))}\t${info.join(' - ')}${state}`;
  }
  if (release.source_blob) {
    const info = [
      release.status === 'pending' ? '~~~pending~~~' : `!!${release.status}!!`,
      release.id,
      release.source_blob.author,
      release.source_blob.message ? `##${release.source_blob.message.replace(/#/g, '').replace(/\s+/g, ' ')}##` : '',
      release.source_blob.commit ? `${release.source_blob.commit.substring(0, 7)}` : '',
    ].filter((x) => x && x !== '').map((x) => x.toString().replace(/\n/g, ' '));
    return `**• N/A**\t${appkit.terminal.friendly_date(new Date(release.created_at))}\t${info.join(' - ')}${state}`;
  }
  return '';
}

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

async function list(appkit, args) {
  try {
    const get = util.promisify(appkit.api.get);
    assert.ok(args.app && args.app !== '', 'An application name was not provided.');
    const results = await Promise.all([get(`/apps/${args.app}/releases`), get(`/apps/${args.app}/builds`)]);
    if (results[0].length === 0 && results[1].length === 0) {
      console.log(appkit.terminal.markdown('###===### No releases were found.'));
      return;
    }
    let releases = results[0].map((x) => Object.assign(x, { build: results[1].filter((y) => y.id === x.slug.id)[0] }));
    releases = releases.concat(results[1].filter((x) => !releases.some((y) => y.slug.id === x.id)));
    releases = releases.sort((a, b) => (new Date(a.created_at).getTime() < new Date(b.created_at).getTime() ? -1 : 1));
    releases = args.all === true || releases.length < 11 ? releases : releases.slice(releases.length - 10);
    releases = await Promise.all(releases.map(async (x) => {
      if (!x.build && x.slug && x.slug.id) {
        return Object.assign(x, { build: await get(`/slugs/${x.slug.id}`) });
      }
      return x;
    }));
    releases.map(format_release.bind(null, appkit)).map(appkit.terminal.markdown).map((x) => console.log(x));
  } catch (e) {
    appkit.terminal.error(e);
  }
}

function wait_for_build(appkit, app, build_id, callback, iteration) {
  if (typeof (iteration) === 'undefined') {
    iteration = 0;
  }
  if (iteration === 5 * 60) {
    callback(new Error('Timeout occured'));
    return;
  }
  appkit.api.get(`/apps/${app}/builds/${build_id}`, (err, build) => {
    if (err) {
      callback(err);
      return;
    }
    if (build.status === 'succeeded') {
      callback(null, build);
      return;
    } if (build.status === 'failed') {
      callback(new Error('build failed.'));
      return;
    }
    process.stdout.write('\b..');
    setTimeout(wait_for_build.bind(null, appkit, app, build_id, callback, (iteration + 1)), 1000);
  });
}

function create(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');

  const task = appkit.terminal.task(`Deploying **⬢ ${args.URL} to ${args.app} **`);
  task.start();

  appkit.api.get(`/apps/${args.app}/features`, (err1, features) => {
    if (err1) {
      task.end('error');
      appkit.terminal.error(err1);
      return;
    }
    const auto_release_enabled = features.filter((x) => x.name === 'auto-release' && x.enabled === true).length === 1;
    if (auto_release_enabled) {
      const payload = {
        checksum: '', url: args.URL, repo: '', sha: '', branch: '', version: args.version,
      };
      appkit.api.post(JSON.stringify(payload), `/apps/${args.app}/builds`, (err2) => {
        if (err2) {
          task.end('error');
          appkit.terminal.error(err2);
          return;
        }
        task.end('ok');
      });
    } else {
      const payload = {
        checksum: '', url: args.URL, repo: '', sha: '', branch: '', version: args.version,
      };
      appkit.api.post(JSON.stringify(payload), `/apps/${args.app}/builds`, (err3, build) => {
        if (err3) {
          task.end('error');
          appkit.terminal.error(err3);
          return;
        }
        wait_for_build(appkit, args.app, build.id, (err4, result) => {
          if (err4) {
            task.end('error');
            appkit.terminal.error(err4);
            return;
          }
          appkit.api.post(JSON.stringify({ version: args.version, slug: result.id }), `/apps/${args.app}/releases`, (err5) => {
            if (err5) {
              task.end('error');
              appkit.terminal.error(err5);
              return;
            }
            task.end('ok');
          });
        });
      });
    }
  });
}

async function release_info(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  if (args.RELEASE === '' || !args.RELEASE) {
    args.RELEASE = 'latest';
  }
  try {
    console.log(appkit.terminal.markdown('##==## Release'));
    const release = await find_release(appkit, args.app, args.RELEASE);
    appkit.terminal.print(null, release);
    console.log();
    console.log(appkit.terminal.markdown('##==## Release Statuses'));
    appkit.terminal.print(null, (await appkit.api.get(`/apps/${args.app}/releases/${release.id}/statuses`)).statuses);
  } catch (err) {
    appkit.terminal.error(err);
  }
}

async function rollback(appkit, args) {
  const post = util.promisify(appkit.api.post);
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  const task = appkit.terminal.task(`Rolling back **⬢ ${args.app}**`);
  task.start();
  if (args.RELEASE === '' || !args.RELEASE) {
    args.RELEASE = 'previous';
  }
  try {
    const release = await find_release(appkit, args.app, args.RELEASE);
    process.stdout.write(appkit.terminal.markdown(`\b ##v${release.version}## (${release.description})  `));
    await post(JSON.stringify({ release: release.id, description: release.description }), `/apps/${args.app}/releases`);
    task.end('ok');
  } catch (err) {
    task.end('error');
    appkit.terminal.error(err);
  }
}

async function rebuild(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  try {
    const release = await find_release(appkit, args.app, args.release);
    assert.ok(release.slug.id, `Unable to find build information for release ${args.release}`);

    const task = appkit.terminal.task(`Rebuilding **${args.release} on ⬢${args.app} **`);
    task.start();

    const build = await appkit.api.put(null, `/apps/${args.app}/builds/${release.slug.id}`);
    wait_for_build(appkit, args.app, build.id, (err) => {
      if (err) {
        task.end('error');
        appkit.terminal.error(err);
        return;
      }
      task.end('ok');
    });
  } catch (err) {
    appkit.terminal.error(err);
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

    const create_release_option = {
      app: {
        ...require_app_option.app,
        description: 'The app to deploy to',
      },
      version: {
        alias: 'v',
        demand: false,
        string: true,
        description: 'Notes or an internal version number for this release',
      },
    };

    const releases_options = {
      all: {
        default: false,
        demand: false,
        boolean: true,
        description: 'Show all of the releases (not just the last 10)',
      },
      ...require_app_option,
    };

    const require_rollback_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to roll back',
      },
    };

    const rebuild_options = {
      release: {
        alias: 'RELEASE',
        demand: false,
        string: true,
        description: 'The release to rebuild',
        default: 'latest',
      },
      ...require_app_option,
    };

    appkit.args
      .command('releases', 'List releases on an app', releases_options, list.bind(null, appkit))
      .command('releases:create URL', 'Deploy a new version of an app from a .zip, .tgz, or docker image', create_release_option, create.bind(null, appkit))
      .command('releases:info [RELEASE]', 'View release info', require_app_option, release_info.bind(null, appkit))
      .command('releases:rollback [RELEASE]', 'Roll back to a previous release on an app', require_rollback_option, rollback.bind(null, appkit))
      .command('releases:rebuild', 'Rebuild a previous release (defaults to latest)', rebuild_options, rebuild.bind(null, appkit))
      // aliases
      .command('release', false, releases_options, list.bind(null, appkit))
      .command('releases:list', false, releases_options, list.bind(null, appkit))
      .command('release:list', false, releases_options, list.bind(null, appkit))
      .command('release:create URL', false, create_release_option, create.bind(null, appkit))
      .command('release:info [RELEASE]', false, require_app_option, release_info.bind(null, appkit))
      .command('release:rollback [RELEASE]', false, require_rollback_option, rollback.bind(null, appkit))
      .command('rollback [RELEASE]', false, require_rollback_option, rollback.bind(null, appkit))
      .command('apps:rebuild', false, rebuild_options, rebuild.bind(null, appkit))
      .command('rebuild', false, rebuild_options, rebuild.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'releases',
  help: 'manage releases (create, list, rollback)',
  primary: true,
};
