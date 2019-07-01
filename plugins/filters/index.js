"use strict"

const fs = require('fs')
const assert = require('assert')

function format_filter(filter) {
  return `**Ⴤ ${filter.name}**
  ***Id: ${filter.id}***
  ***Type:*** ${filter.type}
${Object.keys(filter.options).map((opt) => { 
  let label = opt.replace('_', ' ').split(' ').map((x) => {
    return x[0].toUpperCase() + x.substring(1)
  }).join(' ')
  return '  ***' + label + ':*** ' + filter.options[opt];
}).join('\n')}
  `;
}

function format_filter_attachment(fa) {
  return `**Ⴤ ${fa.id}**
  ***Type:*** ${fa.filter.type}
  ***Filter:*** ${fa.filter.name}
${Object.keys(fa.options).map((opt) => { 
  let label = opt.replace('_', ' ').split(' ').map((x) => {
    return x[0].toUpperCase() + x.substring(1)
  }).join(' ')
  return '  ***' + label + ':*** ' + fa.options[opt];
}).join('\n')}`;
}

function list_attachments(appkit, args) {
  appkit.api.get(`/apps/${args.app}/filters`, appkit.terminal.format_objects.bind(null, format_filter_attachment,
      appkit.terminal.markdown('###===### No filters are attached to this app.')));
}

function list(appkit, args) {
  if(args.app) {
    return list_attachments(appkit, args); // as a convenience... the command apps:filters looks alot like filters
  }
  appkit.api.get(`/filters`, appkit.terminal.format_objects.bind(null, format_filter,
      appkit.terminal.markdown('###===### No filters were found.')));
}

async function create(appkit, args) {
  let task = appkit.terminal.task(`Creating http filter **⬢ ${args.FILTER_NAME}**`);
  task.start()
  try {
    let options = {}
    if(args.type === "jwt") {
      if(!args['jwt-jwks-uri'] || !args['jwt-issuer']) {
        task.end('error');
        return appkit.terminal.error(new Error('A JWT http filter requires options "jwt-jwks-uri" and "jwt-issuer" be set. It may optionally have one (or more) "audiences".'))
      }
      options = {jwks_uri:args['jwt-jwks-uri'], issuer:args['jwt-issuer'], audiences:args['jwt-audiences']}
    } else {
      task.end('error');
      return appkit.terminal.error(new Error('The specified filter type was invalid, the supported options are: jwt'))
    }
    await appkit.api.post(JSON.stringify({"type":args.type, "name":args.FILTER_NAME, options, description:args.description, organization:args.org}),`/filters`)
  } catch (e) {
    task.end('error');
    return appkit.terminal.error(e);
  }
  task.end('ok')
}

async function destroy(appkit, args) {
  let del = async (input) => {
    if(input === args.FILTER_NAME) {
      let task = appkit.terminal.task(`Destroying **⬢ ${args.FILTER_NAME}** (any apps using it will have it removed on the next deployment)`);
      task.start();
      try {
        await appkit.api.delete(`/filters/${args.FILTER_NAME}`)
      } catch (e) {
        task.end('error');
        return appkit.terminal.error(e);
      }
      task.end('ok')
    } else {
      appkit.terminal.soft_error(`Confirmation did not match !!${args.FILTER_NAME}!!. Aborted.`);
    }
  };
  if(args.confirm) {
    await del(args.confirm);
  } else {
    appkit.terminal.confirm(` ~~▸~~    WARNING: This will delete **⬢ ${args.FILTER_NAME}** and remove it from any attached apps.\n ~~▸~~    To proceed, type !!${args.FILTER_NAME}!! or re-run this command with !!--confirm ${args.FILTER_NAME}!!\n`, del);
  }
}

function update(appkit, args) {
  // TODO
}

async function attach(appkit, args) {
  let attach = async (input) => {
    if(input !== args.app) {
      return appkit.terminal.soft_error(`Confirmation did not match !!${args.app}!!. Aborted.`);
    }
    let task = appkit.terminal.task(`Attaching http filter **Ⴤ ${args.FILTER_NAME}** to ##⬢ ${args.app}##`);
    task.start()
    try {
      let filter_info = await appkit.api.get(`/filters/${args.FILTER_NAME}`)
      let options = {}
      if (args.excludes && Array.isArray(args.excludes)) {
        options.excludes = args.excludes
      }
      await appkit.api.post(JSON.stringify({"filter":{"id":filter_info.id}, options}),`/apps/${args.app}/filters`);
      await appkit.api.patch(JSON.stringify({"RESTART":Math.random()}),`/apps/${args.app}/config-vars`); // TODO: REMOVE
    } catch (e) {
      task.end('error');
      return appkit.terminal.error(e);
    }
    task.end('ok')
  }
  if(args.confirm) {
    await attach(args.confirm);
  } else {
    appkit.terminal.confirm(` ~~▸~~    !!DANGER ZONE!!: This feature is still in beta, and attaching this filter to **⬢ ${args.app}** may result in instability.\n ~~▸~~    Before continuing ensure you've read ##https://github.com/akkeris/akkeris/issues/9## and have implemented its recommendations.\n ~~▸~~    To proceed, type !!${args.app}!! or re-run this command with !!--confirm ${args.app}!!\n`, attach);
  }
}

async function detach(appkit, args) {
  let task = appkit.terminal.task(`Detaching **Ⴤ ${args.FILTER_ATTACHMENT_ID}**`);
  task.start();
  try {
    await appkit.api.delete(`/apps/${args.app}/filters/${args.FILTER_ATTACHMENT_ID}`);
    await appkit.api.patch(JSON.stringify({"RESTART":Math.random()}),`/apps/${args.app}/config-vars`); // TODO: REMOVE
  } catch (e) {
    task.end('error');
    return appkit.terminal.error(e);
  }
  task.end('ok')
}
module.exports = {
  init:function(appkit) {
    let confirm_option = {
      'confirm':{
        'alias':'c',
        'string':true,
        'description':'The confirmation string to use when removing'
      }
    }
    let filters_create_option = {
      'description':{
        'alias':'d',
        'string':true,
        'demand':true,
        'description':'The description used for the http filter.'
      },
      'org':{
        'alias':'o',
        'string':true,
        'demand':true,
        'description':'The name of the organization who owns this filter.'
      },
      'type':{
        'alias':'t',
        'choices':['jwt'],
        'demand':true,
        'description':'The type of http filter.'
      },
      'jwt-issuer':{
        'string':true,
        'description':'The issuer to use for a JWT oauth filter (required if type=jwt).'
      },
      'jwt-jwks-uri':{
        'string':true,
        'description':'The jwks uri to use for a JWT oauth filter (required if type=jwt).'
      },
      'jwt-audiences':{
        'array':true,
        'description':'One or more jwt audiences to sue for a JWT oauth filter.'
      }
    }
    let filters_attach = {
      'excludes':{
        'alias':'e',
        'array':true,
        'description':'One or more relative path prefixes to exclude from the filter (e.g., /test would exclude /test/foo and /test).'
      },
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on'
      },
      'confirm':{
        'alias':'c',
        'demand':false,
        'string':true,
        'description':'Confirm with the application name that you want to continue attaching this filter.'
      }
    }
    let require_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on'
      }
    }
    let optional_app = {
      'app':{
        'alias':'a',
        'demand':false,
        'string':true,
        'description':'If specified, view the filters on a specific app.'
      }
    }

    appkit.args
      .command('filters', 'List available http filters that can be attached.', optional_app, list.bind(null, appkit))
      .command('filters:create FILTER_NAME', 'Create a new http filter', filters_create_option, create.bind(null, appkit))
      .command('filters:destroy FILTER_NAME', 'Destroy an http filter', confirm_option, destroy.bind(null, appkit))
      //.command('filters:update FILTER_NAME [options..]', 'Update an http filter', {}, update.bind(null, appkit))
      .command('apps:filters:attach FILTER_NAME', 'Attach an http filter to an app', filters_attach, attach.bind(null, appkit))
      .command('apps:filters:detach FILTER_ATTACHMENT_ID', 'Attach an http filter to an app', require_app_option, detach.bind(null, appkit))
      .command('apps:filters', 'List http filters currently on an app', require_app_option, list_attachments.bind(null, appkit))
      // aliases
      .command('filters:attach FILTER_NAME', false, filters_attach, attach.bind(null, appkit))
      .command('filters:detach FILTER_ATTACHMENT_ID', false, require_app_option, detach.bind(null, appkit))
    },
  update:function() {
    // do nothing.
  },
  group:'filters',
  help:'manage filters on an app',
  primary:true
}