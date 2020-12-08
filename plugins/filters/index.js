function format_filter(filter) {
  const formatted_data = [`**Ⴤ ${filter.name}**
  ***Id: ${filter.id}***
  ***Type:*** ${filter.type}`];
  Object.entries(filter.options).forEach(([key, value]) => {
    const label = key.replace('_', ' ').split(' ').map((x) => x[0].toUpperCase() + x.substring(1)).join(' ');
    if (Array.isArray(value)) {
      formatted_data.push(`  ***${label}:*** ${value.join(', ')}`);
    } else {
      formatted_data.push(`  ***${label}:*** ${value}`);
    }
  });
  if (Array.isArray(filter.attached_apps)) {
    const attached_apps = filter.attached_apps.map((attached_app) => `${attached_app.name}-${attached_app.space.name}`).join(', ');
    formatted_data.push(`  ***Attached Apps:*** ${attached_apps}`);
  }
  return formatted_data.join('\n');
}

function format_filter_attachment(fa) {
  return `**Ⴤ ${fa.id}**
  ***Type:*** ${fa.filter.type}
  ***Filter:*** ${fa.filter.name}
${Object.keys(fa.filter.options).map((opt) => {
    const label = opt.replace('_', ' ').split(' ').map((x) => x[0].toUpperCase() + x.substring(1)).join(' ');
    if (Array.isArray(fa.filter.options[opt])) {
      return `  ***${label}:*** ${fa.filter.options[opt].join(', ')}`;
    }
    return `  ***${label}:*** ${fa.filter.options[opt]}`;
  }).join('\n')}
${Object.keys(fa.options).map((opt) => {
    const label = opt.replace('_', ' ').split(' ').map((x) => x[0].toUpperCase() + x.substring(1)).join(' ');
    return `  ***${label}:*** ${fa.options[opt]}`;
  }).join('\n')}`;
}

function list_attachments(appkit, args) {
  appkit.api.get(`/apps/${args.app}/filters`, appkit.terminal.format_objects.bind(null, format_filter_attachment,
    appkit.terminal.markdown('###===### No filters are attached to this app.')));
}

function list(appkit, args) {
  if (args.app) {
    list_attachments(appkit, args); // as a convenience... the command apps:filters looks alot like filters
    return;
  }
  appkit.api.get('/filters', appkit.terminal.format_objects.bind(null, format_filter,
    appkit.terminal.markdown('###===### No filters were found.')));
}

function info(appkit, args) {
  appkit.api.get(`/filters/${args.FILTER_NAME}`, (err, data) => {
    if (err) {
      appkit.terminal.print(err);
      return;
    }
    console.log(appkit.terminal.markdown(format_filter(data)));
  });
}

async function create(appkit, args) {
  const task = appkit.terminal.task(`Creating http filter **⬢ ${args.FILTER_NAME}**`);
  task.start();
  try {
    let options = {};
    if (args.type === 'jwt') {
      if (!args['jwt-jwks-uri'] || !args['jwt-issuer']) {
        task.end('error');
        appkit.terminal.error(new Error('A JWT http filter requires options "jwt-jwks-uri" and "jwt-issuer" be set. It may optionally have one (or more) "audiences".'));
        return;
      }
      options = {
        jwks_uri: args['jwt-jwks-uri'],
        issuer: args['jwt-issuer'],
        audiences: args['jwt-audiences'],
      };
    } else if (args.type === 'cors') {
      options = {
        allow_origin: args['cors-allow-origin'],
        allow_methods: args['cors-allow-methods'],
        allow_headers: args['cors-allow-headers'],
        expose_headers: args['cors-expose-headers'],
        max_age: args['cors-max-age'],
        allow_credentials: args['cors-allow-credentials'],
      };
    } else if (args.type === 'csp') {
      options = {
        policy: args['csp-policy'],
      }
    } else {
      task.end('error');
      appkit.terminal.error(new Error('The specified filter type was invalid, the supported options are: jwt, cors'));
      return;
    }
    await appkit.api.post(JSON.stringify({
      type: args.type, name: args.FILTER_NAME, options, description: args.description, organization: args.org,
    }), '/filters');
  } catch (e) {
    task.end('error');
    appkit.terminal.error(e);
    return;
  }
  task.end('ok');
}

async function update(appkit, args) {
  const task = appkit.terminal.task(`Updating http filter **⬢ ${args.FILTER_NAME}** ###(changes take place when an attached app deploys)###`);
  task.start();
  try {
    let options = {};
    if (args.type === 'jwt') {
      if (!args['jwt-jwks-uri'] || !args['jwt-issuer']) {
        task.end('error');
        appkit.terminal.error(new Error('A JWT http filter requires options "jwt-jwks-uri" and "jwt-issuer" be set. It may optionally have one (or more) "audiences".'));
        return;
      }
      options = {
        jwks_uri: args['jwt-jwks-uri'],
        issuer: args['jwt-issuer'],
        audiences: args['jwt-audiences'],
      };
    } else if (args.type === 'cors') {
      options = {
        allow_origin: args['cors-allow-origin'],
        allow_methods: args['cors-allow-methods'],
        allow_headers: args['cors-allow-headers'],
        expose_headers: args['cors-expose-headers'],
        max_age: args['cors-max-age'],
        allow_credentials: args['cors-allow-credentials'],
      };
    } else if (args.type === 'csp') {
      options = {
        policy: args['csp-policy'],
      }
    } else {
      task.end('error');
      appkit.terminal.error(new Error('The specified filter type was invalid, the supported options are: jwt, cors, or csp'));
      return;
    }
    await appkit.api.put(JSON.stringify({
      type: args.type, name: args.FILTER_NAME, options, description: args.description, organization: args.org,
    }), `/filters/${args.FILTER_NAME}`);
  } catch (e) {
    task.end('error');
    appkit.terminal.error(e);
    return;
  }
  task.end('ok');
}

async function destroy(appkit, args) {
  const del = async (input) => {
    if (input === args.FILTER_NAME) {
      const task = appkit.terminal.task(`Destroying **⬢ ${args.FILTER_NAME}** (any apps using it will have it removed on the next deployment)`);
      task.start();
      try {
        await appkit.api.delete(`/filters/${args.FILTER_NAME}`);
      } catch (e) {
        task.end('error');
        appkit.terminal.error(e);
        return;
      }
      task.end('ok');
    } else {
      appkit.terminal.soft_error(`Confirmation did not match !!${args.FILTER_NAME}!!. Aborted.`);
    }
  };
  if (args.confirm) {
    await del(args.confirm);
  } else {
    appkit.terminal.confirm(` ~~▸~~    WARNING: This will delete **⬢ ${args.FILTER_NAME}** and remove it from any attached apps.\n ~~▸~~    To proceed, type !!${args.FILTER_NAME}!! or re-run this command with !!--confirm ${args.FILTER_NAME}!!\n`, del);
  }
}

async function attach(appkit, args) {
  const attach_helper = async (input) => {
    if (input !== args.app) {
      appkit.terminal.soft_error(`Confirmation did not match !!${args.app}!!. Aborted.`);
      return;
    }
    const task = appkit.terminal.task(`Attaching http filter **Ⴤ ${args.FILTER_NAME}** to ##⬢ ${args.app}##`);
    task.start();
    try {
      const filter_info = await appkit.api.get(`/filters/${args.FILTER_NAME}`);
      const options = {};
      if (args.excludes && Array.isArray(args.excludes)) {
        options.excludes = args.excludes;
      }
      if (args.includes && Array.isArray(args.includes)) {
        options.includes = args.includes;
      }
      await appkit.api.post(JSON.stringify({ filter: { id: filter_info.id }, options }), `/apps/${args.app}/filters`);
    } catch (e) {
      task.end('error');
      appkit.terminal.error(e);
      return;
    }
    task.end('ok');
  };
  if (args.confirm) {
    await attach_helper(args.confirm);
  } else {
    appkit.terminal.confirm(` ~~▸~~    !!DANGER ZONE!!: This feature is still in beta, and attaching this filter to **⬢ ${args.app}** may result in instability.\n ~~▸~~    Before continuing ensure you've read ##https://github.com/akkeris/akkeris/issues/9## and have implemented its recommendations.\n ~~▸~~    To proceed, type !!${args.app}!! or re-run this command with !!--confirm ${args.app}!!\n`, attach_helper);
  }
}

async function attach_update(appkit, args) {
  const attach_update_helper = async (input) => {
    if (input !== args.app) {
      appkit.terminal.soft_error(`Confirmation did not match !!${args.app}!!. Aborted.`);
      return;
    }
    const task = appkit.terminal.task(`Updating http filter attachment **Ⴤ ${args.FILTER_ATTACHMENT_ID}** on ##⬢ ${args.app}##`);
    task.start();
    try {
      const filter_info = await appkit.api.get(`/apps/${args.app}/filters/${args.FILTER_ATTACHMENT_ID}`);
      const options = {};
      if (args.excludes && Array.isArray(args.excludes)) {
        options.excludes = args.excludes;
      }
      if (args.includes && Array.isArray(args.includes)) {
        options.includes = args.includes;
      }
      await appkit.api.put(JSON.stringify({ filter: { id: filter_info.filter.id }, options }), `/apps/${args.app}/filters/${args.FILTER_ATTACHMENT_ID}`);
    } catch (e) {
      task.end('error');
      appkit.terminal.error(e);
      return;
    }
    task.end('ok');
  };
  if (args.confirm) {
    await attach_update_helper(args.confirm);
  } else {
    appkit.terminal.confirm(` ~~▸~~    !!DANGER ZONE!!: This feature is still in beta, and updating this filter attachment on **⬢ ${args.app}** may result in instability.\n ~~▸~~    Before continuing ensure you've read ##https://github.com/akkeris/akkeris/issues/9## and have implemented its recommendations.\n ~~▸~~    To proceed, type !!${args.app}!! or re-run this command with !!--confirm ${args.app}!!\n`, attach_update_helper);
  }
}

async function detach(appkit, args) {
  const del = async (input) => {
    if (input !== args.app) {
      appkit.terminal.soft_error(`Confirmation did not match !!${args.app}!!. Aborted.`);
      return;
    }
    const task = appkit.terminal.task(`Detaching **Ⴤ ${args.FILTER_ATTACHMENT_ID}**`);
    task.start();
    try {
      await appkit.api.delete(`/apps/${args.app}/filters/${args.FILTER_ATTACHMENT_ID}`);
    } catch (e) {
      task.end('error');
      appkit.terminal.error(e);
      return;
    }
    task.end('ok');
  };
  if (args.confirm) {
    await del(args.confirm);
  } else {
    appkit.terminal.confirm(` ~~▸~~    WARNING: This will detach **⬢ ${args.FILTER_ATTACHMENT_ID}** from app ${args.app}.\n ~~▸~~    To proceed, type !!${args.app}!! or re-run this command with !!--confirm ${args.app}!!\n`, del);
  }
}

module.exports = {
  init(appkit) {
    const confirm_option = {
      confirm: {
        alias: 'c',
        string: true,
        description: 'The confirmation string to use when removing',
      },
    };

    const filters_create_option = {
      description: {
        alias: 'd',
        string: true,
        demand: true,
        description: 'The description used for the http filter.',
      },
      org: {
        alias: 'o',
        string: true,
        demand: true,
        description: 'The name of the organization who owns this filter.',
      },
      type: {
        alias: 't',
        choices: ['jwt', 'cors'],
        demand: true,
        description: 'The type of http filter.',
      },
      'jwt-issuer': {
        string: true,
        description: 'The issuer to use for a JWT oauth filter (required if type=jwt).',
      },
      'jwt-jwks-uri': {
        string: true,
        description: 'The jwks uri to use for a JWT oauth filter (required if type=jwt).',
      },
      'jwt-audiences': {
        array: true,
        description: 'One or more jwt audiences to use for a JWT oauth filter (optional if type=jwt).',
      },
      'cors-allow-origin': {
        array: true,
        description: 'The allowed origins for the CORS filter (optional if type=cors)',
      },
      'cors-allow-methods': {
        array: true,
        description: 'The allowed HTTP methods for the CORS filter (optional if type=cors)',
      },
      'cors-expose-headers': {
        array: true,
        description: 'The allowed HTTP headers for the CORS filter (optional if type=cors)',
      },
      'cors-allow-headers': {
        array: true,
        description: 'The allowed HTTP headers in the request (optional if type=cors)',
      },
      'cors-max-age': {
        number: true,
        description: 'The age (in seconds) the CORS filter may be cached (optional if type=cors)',
      },
      'cors-allow-credentials': {
        boolean: true,
        description: 'Whether credentials are allowed to be sent in the CORS filter (optional if type=cors)',
      },
      'csp-policy': {
        string: true,
        description: 'The contents of the content-security-policy header to use. (required if type=csp)',
      },
    };

    const filters_update_option = {
      description: {
        alias: 'd',
        string: true,
        demand: false,
        description: 'The description used for the http filter.',
      },
      org: {
        alias: 'o',
        string: true,
        demand: false,
        description: 'The name of the organization who owns this filter.',
      },
      type: {
        alias: 't',
        choices: ['jwt', 'cors', 'csp'],
        demand: false,
        description: 'The type of http filter.',
      },
      'jwt-issuer': {
        string: true,
        description: 'The issuer to use for a JWT oauth filter (required if type=jwt).',
      },
      'jwt-jwks-uri': {
        string: true,
        description: 'The jwks uri to use for a JWT oauth filter (required if type=jwt).',
      },
      'jwt-audiences': {
        array: true,
        description: 'One or more jwt audiences to use for a JWT oauth filter (optional if type=jwt).',
      },
      'cors-allow-origin': {
        array: true,
        description: 'The allowed origins for the CORS filter (optional if type=cors)',
      },
      'cors-allow-methods': {
        array: true,
        description: 'The allowed HTTP methods for the CORS filter (optional if type=cors)',
      },
      'cors-expose-headers': {
        array: true,
        description: 'The exposed HTTP headers returned in the response (optional if type=cors)',
      },
      'cors-allow-headers': {
        array: true,
        description: 'The allowed HTTP headers in the request (optional if type=cors)',
      },
      'cors-max-age': {
        number: true,
        description: 'The age (in seconds) the CORS filter may be cached (optional if type=cors)',
      },
      'cors-allow-credentials': {
        boolean: true,
        description: 'Whether credentials are allowed to be sent in the CORS filter (optional if type=cors)',
      },
      'csp-policy': {
        string: true,
        description: 'The contents of the content-security-policy header to use. (required if type=csp)',
      },
    };

    const filters_attach = {
      excludes: {
        alias: 'e',
        array: true,
        description: 'One or more relative path prefixes to exclude from the filter (availble only on JWT filters).',
      },
      includes: {
        alias: 'i',
        array: true,
        description: 'One or more relative path prefixes to explicitly include (otherwise everything is included, only on JWT filters).',
      },
      app: {
        alias: 'a',
        demand: true,
        string: true,
        description: 'The app to act on',
      },
      confirm: {
        alias: 'c',
        demand: false,
        string: true,
        description: 'Confirm with the application name that you want to continue attaching this filter.',
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

    const optional_app = {
      app: {
        alias: 'a',
        demand: false,
        string: true,
        description: 'If specified, view the filters on a specific app.',
      },
    };

    appkit.args
      .command('filters', 'List available http filters that can be attached.', optional_app, list.bind(null, appkit))
      .command('filters:info FILTER_NAME', 'Show detailed information for a filter', {}, info.bind(null, appkit))
      .command('filters:create FILTER_NAME', 'Create a new http filter', filters_create_option, create.bind(null, appkit))
      .command('filters:update FILTER_NAME', 'Update an existing http filter', filters_update_option, update.bind(null, appkit))
      .command('filters:destroy FILTER_NAME', 'Destroy an http filter', confirm_option, destroy.bind(null, appkit))
      .command('apps:filters:attach FILTER_NAME', 'Attach an http filter to an app', filters_attach, attach.bind(null, appkit))
      .command('apps:filters:detach FILTER_ATTACHMENT_ID', 'Detach an http filter to an app', { ...require_app_option, ...confirm_option }, detach.bind(null, appkit))
      .command('apps:filters:update FILTER_ATTACHMENT_ID', 'Update an http filter attachment on an app', filters_attach, attach_update.bind(null, appkit))
      .command('apps:filters', 'List http filters currently on an app', require_app_option, list_attachments.bind(null, appkit))
      // aliases
      .command('filters:attach FILTER_NAME', false, filters_attach, attach.bind(null, appkit))
      .command('filters:detach FILTER_ATTACHMENT_ID', false, require_app_option, detach.bind(null, appkit));
  },
  update() {
    // do nothing.
  },
  group: 'filters',
  help: 'manage filters on an app',
  primary: true,
};
