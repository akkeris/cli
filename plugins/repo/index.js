"use strict"

function format_auto_builds(auto_build) {
  return `**• ${auto_build.app.name} set to ${auto_build.repo} on branch ${auto_build.branch}**
  ***Uername:*** ${auto_build.username}
  ***Created:*** ${(new Date(auto_build.created_at)).toLocaleString()}`;
}

function app_or_error(appkit, name, cb) {
  appkit.api.get(`/apps/${name}`, (err, app) => {
    if(err) {
      appkit.terminal.error(err);
    } else {
      cb(app);
    }
  });
}

function unset(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');  
  app_or_error(appkit, args.app, (app) => {
    let task = appkit.terminal.task(`Removing auto build hook for **• ${args.app}**`);
    task.start();
    appkit.api.delete(`/apps/${app.name}/builds/auto/github`, (err, data) => {
      if(err) {
        task.end('error');
        return appkit.terminal.print(err, data);
      }
      task.end('ok');
      appkit.terminal.print(err, data);
    });
  });
}

function set(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  if(args.REPO.startsWith('git://')) {
    return appkit.terminal.error('The specified repo must be an https uri.');
  }
  args.REPO = args.REPO.endsWith('.git') ? args.REPO.substring(0, args.REPO.lastIndexOf('.git')) : args.REPO;
  app_or_error(appkit, args.app, (app) => {
    let payload = { 
      app:app.name, 
      repo:args.REPO, 
      branch:args.BRANCH || 'master', 
      status_check:true, 
      auto_deploy:true, 
      username:args.username, 
      token:args.token 
    };
    appkit.api.post(JSON.stringify(payload), `/apps/${app.name}/builds/auto`, (err, data) => {
      let task = appkit.terminal.task(`Creating auto build hook for **• ${args.app}**`);
      task.start();
      if(err) {
        task.end('error');
        return appkit.terminal.print(err, data);
      }
      task.end('ok');
    });
  });
}

function info(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get(`/apps/${args.app}/builds/auto/github`, (err, data) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    console.log(appkit.terminal.markdown(format_auto_builds(data)));
  });
}


module.exports = {
  init:function(appkit) {
    let require_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      }
    };
    let require_auto_build_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to enable to auto deploy on.'
      },
      'username':{
        'alias':'u',
        'demand':false,
        'string':true,
        'description':'The username to access the repo as'
      },
      'token':{
        'alias':'t',
        'demand':false,
        'string':true,
        'description':'The token or personal access token to use when authenticating'
      }
    };
    appkit.args
      .command('repo', 'get information on which repo is being watched for auto-deploys', require_app_option, info.bind(null, appkit))
      .command('repo:set REPO [BRANCH]', 'watch a repo and branch and auto-deploy with changes', require_auto_build_option, set.bind(null, appkit))
      .command('repo:unset', 'stop watching a repository and deploying on change (if set)', require_app_option, unset.bind(null, appkit))
      .help()
  },
  update:function() {
    // do nothing.
  },
  group:'repo',
  help:'auto-deploy from a repository',
  primary:true
}