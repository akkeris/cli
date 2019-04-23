"use strict"

const assert = require('assert')

function format_space(space) {
  return `**҈ ${space.name} (region: ${space.region.name}, stack: ${space.stack.name})**
  ***Compliance:*** ${space.compliance.join(", ")}
  ***Id:*** ${space.id}
  ***Apps:*** ${space.apps}\n`;
}

function info_spaces(appkit, args) {
  assert.ok(args.NAME && args.NAME !== '', 'The specified space is not valid');
  appkit.api.get('/spaces/' + args.NAME, (err, space) => {
    if (err) {
      return appkit.terminal.print(err);
    }
    console.log(appkit.terminal.markdown(`###===### **҈ ${space.name}**
Apps:\t\t${space.apps}
Created:\t${space.created_at}
Compliance:${space.compliance.filter((x)=>{ return x !== 'internal' }).map((x) => { return '\t' + x; }).join('\n\t')}
Available:\t${space.compliance.filter((x) => { return x === 'internal' }).length === 1 ? 'Internal Only' : 'Externally'}
Region:\t\t${space.region.name}
Stack:\t\t${space.stack.name}
State:\t\t${space.state}
Updated:\t${space.updated_at}`));
  });
}

function list_spaces(appkit, args) {
  appkit.api.get('/spaces', 
    appkit.terminal.format_objects.bind(null, format_space, 
      appkit.terminal.markdown('###===### No spaces were found.')));
}

function create_space(appkit, args) {
  assert.ok(args.NAME.indexOf(' ') === -1, 'A space name cannot contain spaces.');
  args.NAME = args.NAME.toLowerCase();
  let payload = {name:args.NAME, description:args.description};
  if (args.internal) {
    if (!args.compliance)
      args.compliance = [];
    
    args.compliance.push('internal')
  }
  if(args.compliance) {
    payload.compliance = args.compliance.map((x) => { return x.replace(',','')});
  }
  if(args.stack) {
    payload.stack = args.stack;
  }
  appkit.api.post(JSON.stringify(payload), '/spaces', appkit.terminal.print);
}

module.exports = {
  
  init:function(appkit) {
    let space_options = {
      description:{
        string:true,
        demand:false,
        alias:'d',
        description:'The description of the space'
      },
      compliance:{
        array:true,
        demand:false,
        alias:'c',
        description:'A space separated list of tags to add for compliance (e.g. "prod socs")'
      },
      internal:{
        boolean:true,
        demand:false,
        alias:'i',
        description:'Host internal-only applications (true|false)'
      },
      stack:{
        array:false,
        demand:false,
        alias:'s',
        description:'Specify the stack (and region) to create this space in (see aka stacks)'
      }
    };
    appkit.args
      .command('spaces', 'List available spaces', {}, list_spaces.bind(null, appkit))
      .command('spaces:info NAME', 'Get information on a space', {}, info_spaces.bind(null, appkit))
      .command('spaces:create NAME', 'Create a new space', space_options, create_space.bind(null, appkit))

  },
  update:function() {
    // do nothing.
  },
  group:'spaces',
  help:'view and create spaces and compliances',
  primary:true
}
