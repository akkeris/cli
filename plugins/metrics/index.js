"use strict"

const chart = require('chart');

let cpu_metrics = ['cpu_system_seconds_total', 'cpu_usage_seconds_total', 'cpu_user_seconds_total'];
let memory_metrics = ['memory_usage_bytes', 'memory_cache', 'memory_rss', 'memory_working_set_bytes'];
let network_metrics = ['network_receive_bytes_total', 'network_transmit_bytes_total'];
let io_metrics = ['fs_usage_bytes'];
let web_metrics = ['response_time', 'requests'];

let all_metrics = cpu_metrics.concat(memory_metrics).concat(io_metrics).concat(network_metrics).concat(web_metrics);


function sample_type(metric) {
  if(metric.indexOf("seconds") > -1) {
    return "%";
  } else if (metric.indexOf("bytes") > -1 || metric.indexOf("rss") > -1 || metric.indexOf("working") > -1 || metric.indexOf("cache") > -1) {
    return 'mb';
  } else if (metric === 'requests') {
    return 'incoming http'
  } else if (metric === 'response_time') {
    return 'ms'
  } else {
    return 'count';
  }
}
function normalize_type(metric, value) {
  if(metric.indexOf("seconds") > -1 || metric === "response_time") {
    return Math.floor(value * 1000) / 1000;
  } else if (metric.indexOf("bytes") > -1 || metric.indexOf("rss") > -1 || metric.indexOf("working") > -1 || metric.indexOf("cache") > -1) {
    return Math.floor(value / 1024 / 1024 * 1000) / 1000;
  } else {
    return value;
  }
}

function display_metrics(appkit, args, filters, err, systems_metrics) {
  if(err) {
    return appkit.terminal.error(err);
  }
  Object.keys(systems_metrics).forEach(system => {
    Object.keys(systems_metrics[system]).forEach(metric => {
      let data = systems_metrics[system][metric];
      let metric_name = metric.replace(/\_/g, ' ').replace('bytes total','').trim();
      let dates = Object.keys(data);
      let start = dates[0];
      let end = dates[dates.length - 1];
      let start_date = new Date();
      start_date.setTime(start * 1000);
      let end_date = new Date();
      end_date.setTime(end * 1000);
      console.log(appkit.terminal.markdown(`###===### ${system} process: ${metric_name} (${sample_type(metric)}) from ${start_date} to ${end_date}, ${dates.length} samples`));
      console.log(chart(dates.map(x => normalize_type(metric,data[x])), {height:30, width:process.stdout.columns - 2}));
    });
  });
}


function display_all_metrics(appkit, args, filters, err, systems_metrics) {
  if(err) {
    return appkit.terminal.error(err);
  }
  display_metrics(appkit, args, filters, err, systems_metrics);
}

function build_url(base_url, args) {
  let q = [];
  if(args.resolution) {
    q.push("resolution=" + args.resolution);
  }
  if(args.from) {
    q.push("from=" + (new Date(args.from)).toISOString())
  }
  if(args.to) {
    q.push("to=" + (new Date(args.to)).toISOString())
  }
  return base_url + (q.length === 0 ? '' : '?' + q.join('&'))
}

function metrics(appkit, args) {
  appkit.api.get(build_url('/apps/' + args.app + '/metrics', args),  display_all_metrics.bind(null, appkit, args, all_metrics));
}

module.exports = {
  init:function(appkit) {
    let require_only_app = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on'
      }
    };
    let require_app_option = {
      'app':{
        'alias':'a',
        'demand':true,
        'string':true,
        'description':'The app to act on'
      },
      'resolution':{
        'alias':'r',
        'demand':false,
        'string':true,
        'description':'The resolution to use (e.g. 30m, 10m, 5m, 1h, 1d)'
      },
      'from':{
        'alias':'f',
        'demand':false,
        'string':true,
        'description':'The \'from\' date to use (e.g. 1/1/2000 05:05:02AM)'
      },
      'to':{
        'alias':'t',
        'demand':false,
        'string':true,
        'description':'The \'to\' date to use (e.g., 1/1/2000 05:05:02AM)'
      }
    };
    appkit.args
      .command('metrics', 'View metrics for an app', require_app_option, metrics.bind(null, appkit))
  },
  update:function() {
    // do nothing.
  },
  group:'metrics',
  help:'view cpu, memory, network and file system usage',
  primary:true
}
