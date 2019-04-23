"use strict"

const https = require('https');
const url = require('url');

function get_regions(appkit, args) {
  appkit.api.get('/regions', (err, regions) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    if(args.json) {
      console.log(JSON.stringify(regions, null, 2))
    } else {
      appkit.terminal.table(regions.filter((x) => { return args.private && x.private_capable || args.common; } ).map((region) => {
        return {
          "ID":region.name,
          "Location":region.locale[0].toUpperCase() + region.locale.substring(1).toLowerCase() + ", " + region.country,
          "Runtime":(region.private_capable ? "Common + Internal Spaces" : "Common Spaces")
        }
      }));
    }
  });
}

module.exports = {
  init:function(appkit) {
    const config_option = {
      'common':{
        'alias':'c',
        'demand':false,
        'boolean':true,
        'default':true,
        'description': 'Show regions for common runtime'
      },
      'private':{
        'alias':'p',
        'demand':false,
        'boolean':true,
        'default':true,
        'description': 'Show regions for private spaces'
      },
      'json':{
        'alias':'j',
        'demand':false,
        'boolean':true,
        'default':false,
        'description': 'Output in json format'
      }
    };
    appkit.args
      .command('regions', 'List available regions for deployment', config_option, get_regions.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'regions',
  help:'inquire on regions to deploy to',
  primary:true
}