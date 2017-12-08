"use strict"

function format_release(release) {
  return `**• v${release.version} (${release.id}) ${release.current ? "^^^- current^^^" : ""}**
  ***Build:*** ${release.slug ? release.slug.id : 'unknown'}
  ***Created:*** ${(new Date(release.created_at)).toLocaleString()}
  ***Status:*** ${release.status === "succeeded" ? "^^succeeded^^" : "!!" + release.status + "!!"}
  ***Description:*** ${release.description}\n`;
}

function list(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  appkit.api.get('/apps/' + args.app + '/releases', 
    appkit.terminal.format_objects.bind(null, format_release, appkit.terminal.markdown('###===### No releases were found.')));
}

function create(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  if(args.build === '' || !args.build) {
    args.build = 'latest';
  }
  let create_release = () => {
    let payload = {slug:args.build, description:args.version};
    appkit.api.post(JSON.stringify(payload), '/apps/' + args.app + '/releases', appkit.terminal.print);
  };

  if(args.build.toLowerCase() === "latest" || args.build.toLowerCase() === "current") {
    appkit.api.get('/apps/' + args.app + '/builds', 
      (err, builds) => {
        if(err) {
          return appkit.terminal.error(err);
        }
        args.build = builds[builds.length - 1].id;
        create_release();
      }); 
  } else {
    create_release();
  }
}

function info(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  if(args.ID === '' || !args.ID) {
    args.ID = 'latest';
  }
  let fetch_release_info = () => {
    appkit.api.get('/apps/' + args.app + '/releases/' + args.ID, appkit.terminal.print);
  };
  if(args.ID.toLowerCase() === "latest" || args.ID.toLowerCase() === "current") {
    appkit.api.get('/apps/' + args.app + '/releases', (err, releases) => {
      if(err) {
        return appkit.terminal.error(err);
      }
      args.ID = releases[releases.length - 1].id;
      fetch_release_info();
    });
  } else {
    fetch_release_info();
  }  
}

function rollback(appkit, args) {
  console.assert(args.app && args.app !== '', 'An application name was not provided.');
  let payload = {release:args.release, description:args.version};
  appkit.api.post(JSON.stringify(payload), '/apps/' + args.app + '/releases', appkit.terminal.print);
}


module.exports = {
  init:function(appkit) {
    let create_release_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      },
      'build':{
        'alias':'b',
        'demand':true,
        'string':true,
        'description':'The build id to release on the app.'
      },
      'version':{
        'alias':'v',
        'string':true,
        'description':'The version of the release (informative only).'
      }
    }
    let require_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      }
    };
    let require_rollback_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      },
      'release':{
        'alias':'r',
        'demand':true,
        'string':true,
        'description':'The release id to rollback to on the app.'
      },
      'version':{
        'alias':'v',
        'string':true,
        'description':'The version of the release (informative only).'
      }
    };
    appkit.args
      .command('releases', 'list releases on an app', require_app_option, list.bind(null, appkit))
      .command('releases:create', 'create a new release from an existing build', create_release_option, create.bind(null, appkit))
      .command('releases:info [ID]', 'view release info', require_app_option, info.bind(null, appkit))
      .command('releases:rollback', 'rollback to a previous release on an app', require_rollback_option, rollback.bind(null, appkit))
      // aliases
      .command('release', false, require_app_option, list.bind(null, appkit))
      .command('releases:list', false, require_app_option, list.bind(null, appkit))
      .command('release:list', false, require_app_option, list.bind(null, appkit))
      .command('release:create', false, create_release_option, create.bind(null, appkit))
      .command('release:info ID', false, require_app_option, info.bind(null, appkit))
      .command('release:rollback', false, require_rollback_option, rollback.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'releases',
  help:'manage releases (create, list, rollback)',
  primary:true
}