const assert = require('assert');
const proc = require('child_process');
const fs = require('fs');
const path = require('path');
const semverGte = require('semver/functions/gte');

const isWindows = process.platform === 'win32';

function format_plugins(plugin) {
  return `**:: ${plugin.name}**
  ***Id:*** ${plugin.id}
  ***Repo:*** ${plugin.repo}
  ***Description:*** ${plugin.description}\n`;
}

module.exports = {};

// you'd better do some checks before calling this function
function rmdir(dir) {
  // node ^12.10 can recursively delete natively
  if (semverGte(process.versions.node, '12.10.0')) {
    fs.rmdirSync(dir, { recursive: true });
  } else if (isWindows) {
    proc.spawnSync('rmdir', ['/s', '/q', dir], {
      cwd: process.cwd(), env: process.env, stdio: 'inherit', shell: true,
    });
  } else {
    proc.spawnSync('rm', ['-rf', dir], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
  }
}

function plugins_list(appkit) {
  appkit.api.get('/plugins',
    appkit.terminal.format_objects.bind(null, format_plugins,
      appkit.terminal.markdown('###===### No plugins were found.')));
}

function plugins_info(appkit, args) {
  assert.ok(args.NAME, 'The name for the plugin wasnt provided');
  appkit.api.get(`/plugins/${args.NAME}`, appkit.terminal.print);
}

function plugins_publish(appkit, args) {
  assert.ok(args.NAME, 'The name for the plugin wasnt provided');
  const payload = {
    description: args.description,
    name: args.NAME,
    repo: args.repo,
    owner: args.owner,
    email: args.email,
  };
  const task = appkit.terminal.task(`Creating plugin **:: ${args.NAME}** `);
  task.start();
  appkit.api.post(JSON.stringify(payload), '/plugins', (err) => {
    if (err) {
      task.end('error');
      appkit.terminal.error(err);
      return;
    }
    task.end('ok');
  });
}

function plugins_unpublish(appkit, args) {
  assert.ok(args.NAME, 'The name for the plugin wasnt provided');
  const task = appkit.terminal.task(`Destroying plugin **:: ${args.NAME}** `);
  task.start();
  appkit.api.delete(`/plugins/${args.NAME}`, (err) => {
    if (err) {
      task.end('error');
      appkit.terminal.error(err);
      return;
    }
    task.end('ok');
  });
}

function plugins_revise(appkit, args) {
  assert.ok(args.NAME, 'The name for the plugin wasnt provided');
  const payload = {};

  if (args.description) {
    payload.description = args.description;
  }
  if (args.repo) {
    payload.repo = args.repo;
  }
  if (args.owner) {
    payload.owner = args.owner;
  }
  if (args.email) {
    payload.email = args.email;
  }
  const task = appkit.terminal.task(`Updating plugin **:: ${args.NAME}** `);
  task.start();
  appkit.api.patch(JSON.stringify(payload), `/plugins/${args.NAME}`, (err) => {
    if (err) {
      task.end('error');
      appkit.terminal.error(err);
      return;
    }
    task.end('ok');
  });
}

function plugins_install(appkit, args) {
  const pull_and_install = () => {
    let tmp_dir = null;
    const loader = appkit.terminal.task(`Installing plugin from ${args.GITHUB_REPO}`);
    loader.start();
    try {
      tmp_dir = path.join(appkit.config.third_party_plugins_dir, (`.tmp${Math.floor(Math.random() * 1000)}`));
      fs.mkdirSync(tmp_dir);
      proc.spawnSync('git', ['clone', args.GITHUB_REPO, tmp_dir], {
        cwd: process.cwd(), env: process.env, stdio: 'ignore', shell: isWindows || undefined,
      });
      if (fs.statSync(path.join(tmp_dir, 'index.js')).isFile()) {
        try {
          if (fs.statSync(path.join(tmp_dir, 'install.js')).isFile()) {
            require(path.join(tmp_dir, 'install.js'));
          }
        } catch (e) {
          // do nothing.
        }
        const plugin = require(path.join(tmp_dir, 'index.js'));
        const plugin_name = plugin.group;
        assert.ok(plugin_name.indexOf(' ') === -1, 'The plugin name or group contained invalid characters such as a space.');
        assert.ok(plugin_name.length > 1, 'The plugin name was not valid, it was less than one character.');
        fs.renameSync(tmp_dir, path.join(appkit.config.third_party_plugins_dir, plugin_name));
        loader.end('ok');
        console.log(appkit.terminal.markdown(`###===### Installed plugin ^^${plugin_name}^^`));
      }
    } catch (e) {
      loader.end('error');
      if (e.message.indexOf('ENOTEMPTY') > -1) {
        appkit.terminal.error('The plugin is already installed (or a plugin with this name), try using "appkit update" instead.');
      } else if (e.message.indexOf('ENOENT') > -1) {
        appkit.terminal.error('The github repo provided did not appear to be a valid repo, check the repo URL and try again.');
      } else {
        appkit.terminal.error(`Unable to install plugin from ${args.GITHUB_REPO}: ${e.message}`);
      }
      if (tmp_dir) {
        assert.ok(tmp_dir !== '/', 'Something really bad happened (tmp_dir === /).');
        assert.ok(
          tmp_dir.indexOf(appkit.config.third_party_plugins_dir) > -1,
          'Something bad happened tmp_dir was not in plugins path.',
        );
        rmdir(tmp_dir);
      }
    }
  };
  if (args.GITHUB_REPO.startsWith('https://') || args.GITHUB_REPO.startsWith('git@')) {
    pull_and_install();
  } else {
    appkit.api.get(`/plugins/${args.GITHUB_REPO}`, (err, plugin) => {
      if (err) {
        appkit.terminal.error(err.code === 401 ? err : 'The specified plugin could not be found.');
        return;
      }
      args.GITHUB_REPO = plugin.repo;
      pull_and_install();
    });
  }
}

function plugins_uninstall(appkit, args) {
  try {
    assert.ok(
      appkit.plugins[args.PLUGIN],
      'The specified plugin does not exist, use "aka version" to get a list of installed plugins.',
    );
    if (fs.statSync(path.join(appkit.config.third_party_plugins_dir, args.PLUGIN, '.git')).isDirectory()) {
      const tmp_dir = path.join(appkit.config.third_party_plugins_dir, args.PLUGIN);
      assert.ok(tmp_dir !== '/', 'Something really bad happened (tmp_dir === /).');
      assert.ok(
        tmp_dir.indexOf(appkit.config.third_party_plugins_dir) > -1,
        'Something bad happened tmp_dir was not in plugins path.',
      );
      rmdir(tmp_dir);
    } else {
      throw new Error('No such plug-in found.');
    }
  } catch (e) {
    if (e.message.indexOf('ENOENT') > -1) {
      appkit.terminal.error(`You cannot uninstall the core plugin ${args.PLUGIN}, sorry.`);
    } else {
      appkit.terminal.error(`Unable to uninstall plugin ${args.PLUGIN}: ${e.message}`);
    }
  }
}

module.exports.init = function init(args, appkit) {
  const plugins_create = {
    description: {
      alias: 'd',
      type: 'string',
      description: 'The description for the plugin',
    },
    repo: {
      alias: 'r',
      type: 'string',
      demand: true,
      description: 'The repo for the plugin (e.g. https://github.com/foo/bar)',
    },
    owner: {
      alias: 'o',
      type: 'string',
      demand: true,
      description: 'The owner\'s name for the plugin',
    },
    email: {
      alias: 'e',
      type: 'string',
      demand: true,
      description: 'The owner\'s email for the plugin',
    },
  };

  const plugins_update = {
    description: {
      alias: 'd',
      type: 'string',
      description: 'The description for the plugin',
    },
    repo: {
      alias: 'r',
      type: 'string',
      description: 'The repo for the plugin (e.g. https://github.com/foo/bar)',
    },
    owner: {
      alias: 'o',
      type: 'string',
      description: 'The owner\'s name for the plugin',
    },
    email: {
      alias: 'e',
      type: 'string',
      description: 'The owner\'s email for the plugin',
    },
  };
  args.command('plugins', 'List public plugins', {}, plugins_list.bind(null, appkit))
    .command('plugins:info NAME', 'Get more information on a plugin', {}, plugins_info.bind(null, appkit))
    .command('plugins:publish NAME', 'Publish a plugin', plugins_create, plugins_publish.bind(null, appkit))
    .command('plugins:unpublish NAME', 'Unpublish a plugin', {}, plugins_unpublish.bind(null, appkit))
    .command('plugins:revise NAME', 'Update a published plugin', plugins_update, plugins_revise.bind(null, appkit))
    .command('plugins:install GITHUB_REPO', 'Install a plugin from a repo', {}, plugins_install.bind(null, appkit))
    .command('plugins:uninstall PLUGIN', 'Uninstall a plugin', {}, plugins_uninstall.bind(null, appkit));
};
