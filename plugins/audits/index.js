"use strict"

const proc = require('child_process');
const fs = require('fs');

function list(appkit, args) {
    console.assert(args.app && args.app !== '', 'An application name was not provided.');
    let arr = args.app.split("-");
    appkit.api.get('/audits?app=' + arr[0] + '&space=' + arr.slice(1).join('-')  + (args.user ? '&user=' + args.user : '' + (args.results ? '&size=' + args.results : '')), function(err, audits) {
        if (err){
            return appkit.terminal.print(err);
        }
        audits.map((audit) => {
            console.log(appkit.terminal.markdown(`
**⬢ ${audit.action.toUpperCase()}**
  ***User:***\t${audit.username}
  ***Time:***\t${new Date(audit.timestamp).toLocaleString()}`));
        })
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
      },
      'user':{
        'alias':'u',
        'string':true,
        'description':'Filter the activity by user'
      },
      'results':{
        'alias':'r',
        'string':true,
        'description':'Number of results to limit by (default is 10)'
      }
    };

    appkit.args
      .command('audits', 'list activity on an app', require_app_option, list.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'audits',
  help:'manage activity',
  primary:true
}
