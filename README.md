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

