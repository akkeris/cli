"use strict"

const https = require('https');
const url = require('url');

function get_stacks(appkit, args) {
  appkit.api.get('/stacks', (err, stacks) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    if(args.json) {
      console.log(JSON.stringify(stacks, null, 2))
    } else {
      appkit.terminal.table(stacks.map((stack) => {
        return {
          "ID":stack.name,
          "Region":stack.region.name,
          "State":stack.state
        }
      }));
    }
  });
}

module.exports = {
  init:function(appkit) {
    let config_option = {
      'json':{
        'alias':'j',
        'demand':false,
        'boolean':true,
        'default':false,
        'description':'output in json format'
      }
    };
    appkit.args
      .command('stacks', 'list available stacks for deployment', config_option, get_stacks.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'stacks',
  help:'inquire about available runtimes to deploy within regions',
  primary:true
}