
const assert = require('assert');
const SHA256 = require('crypto-js/sha256');

function get_repo(repo) {
  return repo.split('/').slice(0, 5).join('/');
}

function summary_of_action(action) {
  if (action.info) {
    const info = JSON.parse(action.info);
    if (info.action === 'feature_change') {
      if (info.changes.length !== 1) {
        return 'multiple changes';
      }
      if (info.changes[0].type === 'update') {
        return `updated ##${info.changes[0].name}## to ${info.changes[0].value}`;
      }
      return info.changes[0].type;
    } if (info.action === 'config_change') {
      if (info.changes.length !== 1) {
        return 'multiple changes';
      }
      return `${info.changes[0].type}d ##${info.changes[0].name}##`;
    } if (info.action === 'formation_change') {
      if (info.changes.length !== 1) {
        return 'multiple changes';
      }
      return `changed ${info.changes[0].type} to ${info.changes[0].size} (${info.changes[0].quantity})`;
    } if (info.action === 'addon_change') {
      if (info.changes.length !== 1) {
        return 'multiple changes';
      }
      return `${info.change}d ##${info.changes[0].plan.name}##`;
    } if (info.action === 'build') {
      if (info.build.commit && info.build.commit !== '' && info.build.result === 'pending' && info.build.repo) {
        return `Build started for commit ##${info.build.commit.substring(0, 7)}## from ${get_repo(info.build.repo)}`;
      } if (info.build.commit && info.build.commit !== '' && info.build.result === 'succeeded' && info.build.repo) {
        return `Build succeeded for commit ##${info.build.commit.substring(0, 7)}## from ${get_repo(info.build.repo)}`;
      } if (info.build.commit && info.build.commit !== '' && info.build.result === 'failed' && info.build.repo) {
        return `Build failed for commit ##${info.build.commit.substring(0, 7)}## from ${get_repo(info.build.repo)}`;
      }
      return `status changed for ${info.build.id} ${info.build.result}`;
    } if (info.action === 'release') {
      return `##${info.release.description}## ${info.build.result}`;
    } if (info.action === 'preview' && info.change === 'create') {
      return `Created preview app ##${info.preview.app.url}##`;
    }
    return 'multiple changes';
  }
  return 'multiple changes';
}

function format_action(action) {
  return action.split('_').map((x) => x[0].toUpperCase() + x.substring(1).toLowerCase()).join(' ');
}

function list(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  const arr = args.app.split('-');
  if (args.limit > 1000) {
    appkit.terminal.print(new Error('A maximum of 1000 changes can be requested.'));
    return;
  }
  appkit.api.get(
    `/audits?app=${arr[0]}&space=${arr.slice(1).join('-')}${args.user ? `&user=${args.user}` : `${args.limit ? `&size=${args.limit}` : ''}`}`,
    (err, audits) => {
      if (err) {
        appkit.terminal.print(err);
        return;
      }
      if (audits.length === 0) {
        console.log(appkit.terminal.markdown('###===### No activity was found.'));
        return;
      }
      audits.forEach((audit) => {
        const id = SHA256(JSON.stringify(audit)).toString().substring(0, 7);
        console.log(appkit.terminal.markdown(`**§ ${id}** ${appkit.terminal.friendly_date(new Date(audit.received_at))} \t${format_action(audit.action)} - ${audit.username} - ${summary_of_action(audit)}`));
      });
    },
  );
}

function get(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  assert.ok(args.AUDIT_ID && args.AUDIT_ID !== '', 'An activity id was not provided.');

  const arr = args.app.split('-');

  appkit.api.get(
    `/audits?app=${arr[0]}&space=${arr.slice(1).join('-')}${args.user ? `&user=${args.user}` : ''}&size=1000`,
    (err, audits) => {
      if (err) {
        appkit.terminal.print(err);
        return;
      }

      audits.forEach((audit) => {
        const id = SHA256(JSON.stringify(audit)).toString().substring(0, 7);
        if (id === args.AUDIT_ID) {
          const { info } = audit;
          delete audit.info;
          console.log(appkit.terminal.markdown(`\n**§ ${id}** ${appkit.terminal.friendly_date(new Date(audit.received_at))} \t${format_action(audit.action)} - ${audit.username} - ${summary_of_action(audit)}\n`));
          appkit.terminal.vtable(audit);
          console.log(appkit.terminal.markdown('\n###===### Additional Info\n'));
          console.log(JSON.stringify(JSON.parse(info), null, 2));
          console.log(appkit.terminal.markdown('\n###===###\n'));
        }
      });
    },
  );
}

module.exports = {
  init(appkit) {
    const require_list_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
      user: {
        alias: 'u',
        string: true,
        description: 'Filter the activity by user',
      },
      limit: {
        alias: 'l',
        number: true,
        description: 'Number of results to limit by (default is 10)',
      },
    };

    const require_app_option = {
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
    };

    appkit.args
      .command('audits', 'List audits for an app', require_list_option, list.bind(null, appkit))
      .command('audits:info AUDIT_ID', 'Display detailed information for an audit', require_app_option, get.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'audits',
  help: 'manage audits',
  primary: true,
};
