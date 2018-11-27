"use strict"

const assert = require ('assert')
const proc = require('child_process');
const fs = require('fs');
const SHA256 = require('crypto-js/sha256');

function list(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');

  let arr = args.app.split("-");

  appkit.api.get('/audits?app=' + arr[0] + '&space=' + arr.slice(1).join('-')  + (args.user ? '&user=' + args.user : '' + (args.results ? '&size=' + args.results : '')), function(err, audits) {
    if (err){
      return appkit.terminal.print(err);
    }

    audits.map((audit) => {
      const id = SHA256(JSON.stringify(audit)).toString().substring(0,7);
      console.log(appkit.terminal.markdown(`
**⬢ ${audit.action.toUpperCase()}**
  ***Id:***\t${id}
  ***User:***\t${audit.username}
  ***Time:***\t${new Date(audit.received_at).toLocaleString()}`));
    })
  });
}

function get(appkit, args) {
  assert.ok(args.app && args.app !== '', 'An application name was not provided.');
  assert.ok(args.id && args.id !== '', 'An activity id was not provided.');

  let arr = args.app.split("-");

  appkit.api.get('/audits?app=' + arr[0] + '&space=' + arr.slice(1).join('-')  + (args.user ? '&user=' + args.user : '' + (args.results ? '&size=' + args.results : '&size=50' )), function(err, audits) {
    if (err){
      return appkit.terminal.print(err);
    }

    audits.map((audit) => {
      const id = SHA256(JSON.stringify(audit)).toString().substring(0,7);
      if(id === args.id) {
        appkit.terminal.vtable(audit);
      }
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
    let require_id_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on.'
      },
      'id':{
        'alias': 'i',
        'demand':true,
        'string':true,
        'description':'the id of the activity'
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
      .command('audits', 'list audits on an app', require_app_option, list.bind(null, appkit))
      .command('audits:info', 'info on a specific audits on an app', require_id_option, get.bind(null,appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'audits',
  help:'manage audits',
  primary:true
}
