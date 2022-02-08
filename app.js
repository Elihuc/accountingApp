const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const apiRoutes = require('./controllers');
app.use('/api', apiRoutes);

const mongo_uri = ''//ADD MONGODB CONNECTION;

const port = 6022;
mongoose.connect(mongo_uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
}).then(results => {
    app.listen(port, function(){
        console.log('Connect via port: ' + port);
    })
}).catch(error => {
    console.log(error);
})