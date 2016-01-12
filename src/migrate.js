var path = require('path');
var app = require(path.resolve(__dirname, 'server'));

app.dataSources.db.automigrate().then(process.exit).catch(console.error);