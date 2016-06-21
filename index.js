var crypto = require('crypto')
	  ldap = require('ldapjs'),
    sync = require('synchronize')
;

var ldap_middleware = {
  handleReq: function (req, res, next){
    switch (req.method) {
      case 'GET':
        auth(req, res, next, get);
      break;
      case 'PUT':
        auth(req, res, next, put);
      break;
      case 'POST':
        post(req, res, next);
      break;
      case 'DELETE':
        auth(req, res, next, del);
      break;

    }
  },
  passphrase: 'xxxxxxxxxxxxxxxxxxxxxxx',
  algorithm: 'aes-256-ctr',
  config: {
    url: 'ldap://localhost/'
  },
  tokenTimeout: 30
};

function auth(req, res, next, func) {
  var client = connect();
  if((req.cookies != undefined && req.cookies.auth != undefined) || req.query.auth != undefined) {
    if (req.query.auth != undefined) {
      var auth = JSON.parse(decrypt(req.query.auth));
    } else if (req.cookies != undefined && req.cookies.auth != undefined) {
      var auth = JSON.parse(decrypt(req.cookies.auth));
    }
    if (auth.expireTime < parseInt(new Date().getTime()/1000)) {
      res.status(401).json({err: "Auth datas expired"});
    } else if (auth.dn != undefined && auth.credential != undefined) {
      client.bind(auth.dn, auth.credential, function (err) {
        if (err) {
          res.status(401).json({err: err});
        } else {
          func(client, req, res, next);
        }
      });
    } else {
      res.status(401).json({err: "Invalid auth datas"});
    }
  } else {
    func(client, req, res, next);
  }
}

function del(client, req, res, next) {
  var parts = req._parsedUrl.pathname.substr(1).split('/');
  var apiversion = parts.shift();
  var dn = parts.shift();
  client.del(dn, function(err) {
    if (err) {
      res.status(400).json({err: err});
    } else {
      res.status(200).json({msg: "ok"});
    }
  });
}

function put(client, req, res, next) {
  if (req.body.command == undefined) {
    res.status(400).json({err: "No action found"});
    return;
  }
  var parts = req._parsedUrl.pathname.substr(1).split('/');
  var apiversion = parts.shift();
  var dn = parts.shift();
  
  switch(req.body.command) {
    case 'modify':
      if (req.body.actions == undefined || typeof req.body.actions != 'object' || Object.keys(req.body.actions).length < 1) {
        res.status(400).json({err: "No actions provided "});
        return;
      }
      sync.fiber(function() {
        for (var action in req.body.actions) {
          switch(action) {
            case 'add':
            case 'replace':
            case 'delete':
              for (var attribut in req.body.actions[action]) {
                console.log(action, attribut);
                var datas = {};
                datas[attribut] = req.body.actions[action][attribut];
                var change = new ldap.Change({
                  operation: action,
                  modification: datas
                });
                try {
                  sync.await(client.modify(dn, change, sync.defer()));
                } catch (e) {
                  if (!res._headerSent) {
                    res.status(400).json({err: e.toString()});
                  }
                }
              }
            break;
            default:
              res.status(400).json({err: "Unknown action " + action});
              return;
            break;
          }
        }
        if (!res._headerSent) {
          res.status(200).json({msg: "ok"});
        }
      });
    break;
    case 'add':
      if (req.body.datas == undefined || typeof req.body.datas != 'object') {
        res.status(400).json({err: "No datas provided "});
        return;
      }
      try {
        client.add(dn, req.body.datas, function(err) {
          if (err) {
            res.status(400).json({err: err});
          } else {
            res.status(200).json({msg: "ok"});
          }
        });
      } catch (e) {
        res.status(400).json({err: e.toString()});
        return;
      }
    break;
    case 'modifydn':
      if (req.body.newdn == undefined) {
        res.status(400).json({err: "No new DN provided "});
        return;
      }
      try {
        client.modifyDN(dn, req.body.newdn, function(err) {
          if (err) {
            res.status(400).json({err: err});
          } else {
            res.status(200).json({msg: "ok"});
          }
        });
      } catch (e) {
        res.status(400).json({err: e.toString()});
        return;
      }
    break;
    default:
      res.status(400).json({err: "Unknown command " + req.body.command});
      return;
    break;
  }
}

function get(client, req, res, next) {
  var parts = req._parsedUrl.pathname.substr(1).split('/');
  var entries = [];
  try {
    var opts = {};
    var apiversion = parts.shift();
    var dn = parts.shift();
    while (part = parts.shift()) {
      switch(part) {
        case 'one':
        case 'sub':
        case 'base':
          opts['scope'] = part;
        break;
        default:
          if (part.indexOf('=') > -1) {
            opts['filter'] = decodeURI(part);
          } else {
            opts['attributes'] = part.split(',');
          }
        break;
      }
    }
    try {
      client.search(dn, opts, function (err, lres) {
        if (!err) {
          lres.on('searchEntry', function(entry) {
            var obj = entry.object;
            var raw = entry.raw;
            var jpegPhoto = raw.jpegPhoto;
            if (jpegPhoto) obj.jpegPhoto = jpegPhoto.toString('base64');
            entries.push(obj);
          });
          lres.on('error', function(err) {
            res.status(400).json({err: err});
          });
          lres.on('end', function(result) {
            if(result.status == 0) {
              res.json(entries);
            } else {
              res.status(400).json({err: result});
            }
          });
        }
      });
    } catch (e) {
      res.status(400).json({err: e.toString()});
      return;
    }
  } catch (e) {
    res.status(400).json({err: e.toString()});
    return;
  }
}

function connect() {
  return ldap.createClient({
    url: ldap_middleware.config['url'],
    tlsOptions: ldap_middleware.config['options']
  });
}

// res.send(req.originalUrl);

function post(req, res, next) {
  if (req.body.dn != undefined && req.body.credential != undefined) {
    var auth = {
      expireTime:ldap_middleware.tokenTimeout + parseInt(new Date().getTime()/1000),
      dn: req.body.dn,
      credential: req.body.credential
    };
    var datas = encrypt(JSON.stringify(auth));
    res.cookie('auth', datas);
    res.send(datas);
  } else {
    next();
  }
}

function encrypt(text){
  var cipher = crypto.createCipher(ldap_middleware.algorithm,ldap_middleware.passphrase)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}
 
function decrypt(text){
  var decipher = crypto.createDecipher(ldap_middleware.algorithm,ldap_middleware.passphrase)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}


module.exports = ldap_middleware;
