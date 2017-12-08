"use strict"

function list(appkit, args) {
  console.assert(!(args.org && args.space), 'An organization and space cannot be used at the same time.');
  let url = "/account/invoices";
  if(args.org) {
    url = "/organizations/" + args.org + "/invoices";
  } else if (args.space) {
    url = "/spaces/" + args.space + "/invoices";
  }
  appkit.api.get(url, (err, data) => {
    if(err) {
      return appkit.terminal.error(err);
    }
    appkit.terminal.print(null,data.map((x) => {
      let id = x["$ref"].split('/');
      id = id[id.length - 1];
      let from = new Date(id);
      let to = new Date(from.getFullYear(), from.getMonth() + 2, 0);
      return {
        "id":id, 
        "start_date":from.toLocaleString(),
        "end_date":to.toLocaleString() 
      };
    }));
  }); 
}

function get(appkit, args) {
  console.assert(!(args.org && args.space), 'An organization and space cannot be used at the same time.');
  console.assert(args.ID, 'An invoice id was not provided.');

  let id = new Date(args.ID);
  let now = new Date();
  if(id.getTime() > now.getTime()) {
    return appkit.terminal.error({code:404, body:'{"message":"The speicifed invoice was not found"}'});
  }

  args.org = args.org || args.o;
  args.space = args.space || args.s;
  args.details = args.details || args.d;

  let url = "/account/invoices/";
  if(args.org) {
    url = "/organizations/" + args.org + "/invoices/";
  } else if (args.space) {
    url = "/spaces/" + args.space + "/invoices/";
  }

  appkit.api.get(url + args.ID, (err, data) => {
    if(err) {
      return appkit.terminal.error(err);
    }


    if(args.details) {
      appkit.terminal.table(data.items)
    }
    appkit.terminal.vtable({
      "Addons":Math.round(data.addons_total * 100) / 100,
      "Databases":Math.round(data.database_total * 100) / 100,
      "Platform":Math.round(data.platform_total * 100) / 100,
      "Start":data.period_start,
      "End":data.period_end,
      "Status":data.payment_status,
      "Total":Math.round(data.total * 100) / 100  
    });
  });
}

module.exports = {
  init:function(appkit) {
    let invoices = {
      'org':{
        'alias':'o',
        'demand':false,
        'string':true,
        'description':'Filter by organization.'
      },
      'space':{
        'alias':'s',
        'demand':false,
        'string':true,
        'description':'Filter by space.'
      },
      'details':{
        'alias':'d',
        'demand':false,
        'boolean':true,
        'default':false,
        'description':'Show itemized details.'
      }
    };
    
    appkit.args
      .command('invoices', 'list all invoices for all organizations', invoices, list.bind(null, appkit))
      .command('invoices:info ID', 'get invoice', invoices, get.bind(null, appkit))
      
  },
  update:function() {
    // do nothing.
  },
  group:'invoices',
  help:'manage and view invoices',
  primary:true
}
