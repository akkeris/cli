var cli_table = require('cli-table');
// colors array: [dark, med, light]
var colors_red = ['\033[2;31m','\033[1;31m','\033[1;91m'];
var colors_blue = ['\033[2;34m','\033[1;34m','\033[38;5;104m'];
var colors_yellow = ['\033[33m', '\033[1;93m','\033[38;5;228m']
var colors_gray = ['\033[2;37m', '\033[37m']
var colors_green = ['\033[32m','\033[92m']
// default color 
var colors = colors_blue;

// highlight color
var highlight = '\033[1;38;5;105m'; //125

// error color
var error_color = '\033[1;38;5;124m';

// success task checked.
var task_ok = '\033[0m\033[36m ✓ \033[0m';
var task_warn = '\033[33m ⚠ \033[0m';
var task_error = '\033[31m ✕ \033[0m';

var hideCursor = '\033[?25l';
var showCursor = '\033[?25h';
var clearLine = '\033[2K';
var saveCursor = '\0337';
var restoreCursor = '\0338';
var normalColor = '\033[0m';
var ui = require ('cliui');



function task(text) {
  console.assert(text, 'A task name must be provided!');
  text = markdown(text);
  var loading_text = ['\u28fe','\u28fd','\u28fb','\u28bf','\u287f','\u28df','\u28ef','\u28f7'];
  var i = 0;
  var interval = null;
  var start = function() {
    process.stdout.write(hideCursor + text + ' ...  ');
    interval = setInterval(function() {
      process.stdout.write('\b' + highlight + loading_text[i % loading_text.length] + '\033[0m');
      i++;
    }, 100);
  };
  var end = function(result) {
    if(interval) {
      clearInterval(interval);
    }
    process.stdout.write( '\b' + normalColor + showCursor);
    if(result.toLowerCase() === 'ok') {
      process.stdout.write(task_ok + '\n');
    } else if (result.toLowerCase() === 'warn') {
      process.stdout.write(task_warn + '\n');
    } else if (result.toLowerCase() === 'error') {
      process.stdout.write(task_error + '\n');
    } else {
      process.stdout.write('\n');
    }
  };
  return {start:start,end:end};
}


function loading(text) {
  text = markdown(text);
  var loading_text_moons = ['🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔'];
  var loading_text_clocks = ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'];
  var loading_text_binary = ['\u28fe','\u28fd','\u28fb','\u28bf','\u287f','\u28df','\u28ef','\u28f7'];
  var loading_text = loading_text_binary;
  text = text || "Loading";
  var i = 0;
  var interval = null;
  var start = function() {
    process.stdout.write(saveCursor + hideCursor + text + ' ...  ');
    interval = setInterval(function() {
      process.stdout.write('\b' + highlight + loading_text[i % loading_text.length] + '\033[0m');
      i++;
    }, 75);
  };
  var end = function() {
    if(interval) {
      clearInterval(interval);
    }
    process.stdout.write( clearLine + normalColor + showCursor + restoreCursor);
  };
  return {start:start,end:end};
}

function error(obj) {
  if(obj && obj.code && obj.code === 401) {
    process.stderr.write(' ' + error_color + '▸' + normalColor + ' You do not appear to be logged in, use "aka auth:login" and try again.\n' + normalColor);
    return;
  } else if(obj.code && obj.body) {
    try {
      var msg = JSON.parse(obj.body.toString());
      console.error('☠  ' + error_color + 'Error ' + obj.code + normalColor + (msg.message ? (', ' + msg.message) : obj.body.toString() ));
    } catch (e) {
      var msg = obj.body.toString();
      console.error('☠  ' + error_color + 'Error ' + normalColor, obj.code, msg && msg !== '' ? msg : 'The specified item was not found. Did you forget to provide an app name, or other parameter?' );
    }
  } else if(obj.message) {
    console.error('☠  ' + obj.message);
  } else {
    console.error('☠  ' + obj);
  }
}

function fromKeyedArrayToTable(data) {
  var out = [];
  Object.keys(data).forEach(function(key) {
    data[key].forEach(function(item, i) {
      out[i] = out[i] || {};
      out[i][key] = item;
    })
  });
  return out;
}

function table(obj) {
  if(obj.length === 0) {
    console.log('No data found.');
    return;
  }
  var keys = Object.keys(obj[0]);
  var t = new cli_table({head:keys,style:{head:['bold','blue']}});
  obj.forEach(function(o) {
    var d = [];
    keys.forEach(function(k) {
      if(o[k] && typeof(o[k]) === 'object') {
        o[k] = Object.keys(o[k]).map(function(z) { return z + '=' + (o[k][z] ? o[k][z].toString() : null); }).join(', ');
      }
      d.push(o[k] ? o[k].toString() : '');
    });
    t.push(d);
  });
  console.log(t.toString());
}

function vtable(obj, sort) {
  var dis = ui({width:process.stdout.columns});
  var keys = sort ? Object.keys(obj).sort() : Object.keys(obj);

  var max_width = 35;
  keys.forEach(function(d) {
    if(obj[d] && typeof(obj[d]) === 'object') {
      var subkeys = sort ? Object.keys(obj[d]).sort() : Object.keys(obj[d]);
      obj[d] = subkeys.map(function(z) { return z + '=' + (obj[d][z] ? obj[d][z].toString() : '') }).join(', ');
    }
    max_width = d.length > max_width ? d.length : max_width;
  });
  keys.forEach(function(d) {
    dis.div({text:colors[2] + d + normalColor, width:max_width + 2, padding:[0,1,0,1]}, {text:obj[d], padding:[0,1,0,1]});
  })
  console.log(dis.toString());
}

function shell(obj) {
  Object.keys(obj).forEach(function(d) {
    console.log(d + '="' + obj[d] + '"');
  });
}

function header(text) {
  console.log(highlight + '➟➟➟ ' + normalColor + text);
}

function subheader(text) {

}

function hidden(prompt, callback) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  var stdin = process.openStdin(), i = 0;
  var data_track = function(char) {
    char = char + "";
    switch (char) {
      case "\n":
      case "\r":
      case "\u0004":
        stdin.pause();
        break;
      default:
        process.stdout.write("\033[2K\033[200D"+prompt+"["+((i%2==1)?"=-":"-=")+"]");
        i++;
        break;
    }
  };
  process.stdin.on('data', data_track);

  rl.question(prompt, function(value) {
    rl.history = rl.history.slice(1);
    process.stdin.removeListener('data', data_track);
    rl.close();
    callback(value);
  });
}

function print(err, obj, sort) {
  if(err) {
    return error(err);
  } else if (Array.isArray(obj)) {
    return table(obj);
  } else {
    if(obj.name && obj.id) {
      console.log(markdown(`###===### ^^^${obj.name} (${obj.id})^^^`));
    }
    return vtable(obj, sort);
  }
}

function markdown(strs) {
  return strs.replace(/(\*\*\*)(.+)(\*\*\*)/g, colors[1] + '$2' + normalColor)
             .replace(/(\*\*)(.+)(\*\*)/g, colors[2] + '$2' + normalColor)
             .replace(/(\*)(.+)(\*)/g, colors[0] + '$2' + normalColor)
             .replace(/(\~\~\~)([^\~]+)(\~\~\~)/g, colors_yellow[1] + '$2' + normalColor)
             .replace(/(\~\~)([^\~]+)(\~\~)/g, colors_yellow[0] + '$2' + normalColor)
             .replace(/(\!\!)([^!]+)(\!\!)/g, colors_red[1] + '$2' + normalColor)
             .replace(/(\#\#\#)([^#]+)(\#\#\#)/g, colors_gray[0] + '$2' + normalColor)
             .replace(/(\#\#)([^#]+)(\#\#)/g, colors_gray[1] + '$2' + normalColor)
             .replace(/(\^\^\^)([^\^]+)(\^\^\^)/g, colors_green[0] + '$2' + normalColor)
             .replace(/(\^\^)([^\^]+)(\^\^)/g, colors_green[1] + '$2' + normalColor)
}

function format_objects(formatter, not_found, err, data) {
  if(data && data.length > 0) {
    data = data.map(formatter).map(markdown);
    console.log(data.join('\n'));
  } else if (data && data.length === 0) {
    console.log(not_found);
  } else {
    error(err);
  }
}

function question(prompt, cb) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question(prompt, function(answer) {
    rl.close();
    cb(answer);
  });
}

function input(cb) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('> ', (answer) => {
    rl.close();
    cb(answer);
  });
}

function confirm(strs, cb) {
  console.log(markdown(strs));
  input(cb);
}

function soft_error(strs) {
  console.log(markdown("  !!▸!!    " + strs));
}

module.exports = {
  question:question,
  hidden:hidden,
  soft_error:soft_error,
  confirm:confirm,
  input:input,
  loading:loading, 
  task:task, 
  error:error, 
  table:table, 
  vtable:vtable, 
  shell:shell, 
  color:colors[2], 
  nocolor:normalColor, 
  highlight:highlight, 
  header:header, 
  fromKeyedArrayToTable:fromKeyedArrayToTable,
  print:print,
  markdown:markdown,
  format_objects:format_objects
};