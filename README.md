# express-ldap2rest
LDAP to RESP middleware for expressjs based on ldapjs

## Features
- Both ldap & ldaps
- Authentication by DN
- Token to avoid password resubmission
- Entry browsing with filter and scope
- Entry renaming
- Entry deleting
- Attribut adding, replacement and deleting

## How to use
- `npm install express-ldap2rest express body-parser cookie-parser`
- Create a `server.js` file like :
```
var express = require('express'),
	app = express(),
	middleware = require('express-ldap2rest'),
	bodyParser = require('body-parser'),
	cookieParser = require('cookie-parser')
;

middleware.passphrase = 'StrongPassword';
middleware.config = {
  url: 'ldaps://ldap.exemple.com/',
  options: { rejectUnauthorized: false }
};
middleware.tokenTimeout = 3600;

app.use(bodyParser.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('static'));
app.use('/v1', middleware.handleReq);

app.listen(3000, function () {
  console.log('Listening on port 3000!');
});

```
- Run `node server.js`

## Request it

### Authenticate (if needed by your LDAP policies)
- curl 'http://127.0.0.1:3000/v1' --data-urlencode 'dn=cn=admin,dc=exemple,dc=com' --data-urlencode 'credential=MyPassword'
It will return a token

### Browse your LDAP
- Without auth: `curl http://localhost:3000/v1/dc=exemple,dc=com`
- With auth: `curl http://localhost:3000/v1/dc=exemple,dc=com?auth=<your_token>` (auth param may be passed as cookie instead as GET param)
- Change scope (base by default): `curl http://localhost:3000/v1/dc=exemple,dc=com/sub`
- Select only some attributes: `curl http://localhost:3000/v1/dc=exemple,dc=com/cn,mail`
- Filter: 
	- `curl http://localhost:3000/v1/dc=exemple,dc=com/cn=jo*`
	- `curl http://localhost:3000/v1/dc=exemple,dc=com/(|(cn=jo*)(cn=ba*))`
- Combine scope, filter and attributes: `curl http://localhost:3000/v1/dc=exemple,dc=com/sub/cn,mail/(|(cn=jo*)(cn=ba*))`

### Add a new entry

- Method: PUT
- data:
```
{
  "command": "add",
  "datas": {
   	"objectclass": "users",
    "mail": "test@test.org",
    "givenName": "blah",
    "sn": "blah",
    "uid": "test"
  }
}
```

