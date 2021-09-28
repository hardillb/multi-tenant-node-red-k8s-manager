const fs = require('fs');
const ws = require('ws');
const cors = require('cors');
const http = require('http');
const path = require('path');
const util = require('util');
const stream = require('stream');
const morgan = require('morgan');
const Client = require('kubernetes-client').Client
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const passport = require('passport');
const KubeConfig = require('kubernetes-client').KubeConfig
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const BasicStrategy = require('passport-http').BasicStrategy;
const SimpleNodeLogger = require('simple-node-logger');

const kubeconfig = new KubeConfig()
// kubeconfig.loadFromFile('./config/config')
// const Request = require('kubernetes-client/backends/request')
// const backend = new Request({ kubeconfig })
// const client = new Client({ backend, version: '1.13' })

const Request = require('kubernetes-client/backends/request')
kubeconfig.loadFromCluster()
const backend = new Request({ kubeconfig })
const client = new Client({ backend })
client.loadSpec()


const port = (process.env.PORT || 3000);
const host = (process.env.HOST || '0.0.0.0');
const cookieSecret = (process.env.COOKIE_SECRET || 'qscplmvb');

const settings = require('./config/settings.js');

// var docker = new Docker(settings.dockerodeSettings);

const logDirectory = path.join(__dirname, 'log');
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

// var loggingOptions = {
// 	logDirectory: 'log',
// 	fileNamePattern:'debug-<DATE>.log',
// 	timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS',
// 	dateFormat:'YYYY.MM.DD'
// };

//const logger = SimpleNodeLogger.createRollingFileLogger(loggingOptions);
const logger = SimpleNodeLogger.createSimpleLogger();

const logLevel = (process.env.LOG_LEVEL || "info");
logger.setLevel(logLevel);

// const accessLogStream = rfs.createStream('access.log', {
//   interval: '1d', // rotate daily
//   compress: 'gzip', // compress rotated files
//   maxFiles: 30,
//   path: logDirectory
// });

var mongoose_options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true
};

mongoose.connect(settings.mongodb, mongoose_options)
.then(() => {
	logger.info("Connected to the DB " + settings.mongodb);
})
.catch( err => {
	logger.info("failed to connect to DB " + settings.mongodb);
	process.exit(-1);
});
const Users = require('./models/users');
const Flows = require('./models/flows');
const Credentials = require('./models/credentials');
const Settings = require('./models/settings');
const Sessions = require('./models/sessions');
const Library = require('./models/library');
const app = express();

app.enable('trust proxy');
//app.use(morgan("combined", {stream: accessLogStream}));
app.use(morgan("combined"));
app.use(cookieParser(cookieSecret));
app.use(session({
  secret: cookieSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
 	// secure: true
  }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize())
app.use(passport.session());

passport.use(new BasicStrategy(function(username, password, done){
	if (username != settings.admin) {
		return done(null, false);
	}

	if (password == settings.password) {
		return done(null, {username: settings.admin})
	} else {
		return done(null, false);
	}
}));

passport.serializeUser(function(user, done){
	done(null, user.username);
});
passport.deserializeUser(function(id, done){
	done(null, {username: id})
});

app.use('/',cors(), express.static('/data'));
app.use('/',passport.authenticate(['basic'],{session: true}) , express.static('static'))

app.post('/instance', passport.authenticate(['basic'],{session: true}), function(req,res){
	logger.debug(req.body);

	var appname = req.body.appname
	var hostname = req.body.appname + "." + settings.rootDomain

	Users.findOne({appname: req.body.appname}, function(err, existingUser) {
		if (existingUser) {
			res.status(409).send({msg: "App Name already exists"});
		} else {
			var u = new Users({
				appname: req.body.appname,
				username: req.body.userid || "admin",
				email: req.body.email,
				permissions: "*"
			})

			u.setPassword(req.body.password)
			.then(() => {
				return u.save()
			})
			.then(() => {

				let p = {
					kind: "Pod",
					metadata: {
						name: req.body.appname,
						labels: {
							name: req.body.appname,
							nodered: "true"
						}
					},
					spec: {
						containers:[
							{
								name: "node-red",
								image: settings["node-red-container"],
								env: [
									{ name: "APP_NAME", value: req.body.appname},
									{ name: "MONGO_URL", value: "mongodb://mongo/nodered"}
								],
								ports: [
									{ name: "web", containerPort: 1880, protocol: "TCP"}
								]
							}
						],
						enableServiceLinks: false
					}
				}

				let s = {
					kind: "Service",
					metadata: {
						name: req.body.appname + "-service"
					},
					spec: {
						selector: {
							name: req.body.appname
						},
						ports: [
							{ port:1880, protocol: "TCP"}
						]
					}
				}

				let i = {
					kind: "Ingress",
					metadata: {
						name: req.body.appname + "-ingress"
					},
					spec: {
						rules: [
							{
								host: hostname, //req.body.appname+".ubuntu.local",
								http: {
									paths: [
										{
											pathType: "Prefix",
											path: "/",
											backend: {
												serviceName: req.body.appname+"-service",
												servicePort: 1880
											}
										}
									]
								}
							}
						]
					}
				}


				client.api.v1.namespaces("default").pods.post({body:p})
				.then(() => {
					return client.api.v1.namespaces("default").services.post({ body: s})
				})				
				.then( () => {
					return client.apis.extensions.v1beta1.namespaces("default").ingresses.post({ body: i})
				})

				.then(() => {
					res.status(201).send({started: true, hostname: hostname});
				})
				.catch(err => {
					logger.info(err);
					res.status(500).send({started: false, msg: "some screw up", err: err});
				})
			})
		}
	})
});

app.get('/instance', passport.authenticate(['basic'],{session: true}), function(req,res){
	client.api.v1.namespaces("default").pods.get({qs:{
		labelSelector: "nodered=true"
	}})
	.then(pods => {
		let containers = pods.body.items;
		res.send({containers: containers, domain: settings.rootDomain})
	})
	.catch(err => {
		res.status(400).send(err)
	})
});


app.post('/instance/:id', passport.authenticate(['basic'],{session: true}), function(req,res){
	if (req.body.command) {
		if (req.body.command == "remove") {
			var appname = req.body.appname;

			client.apis.extensions.v1beta1.namespaces("default").ingresses(appname+"-ingress").delete()
			.then(() =>{
				return client.api.v1.namespaces("default").services(appname+"-service").delete()
			})
			.then(() => {
				return client.api.v1.namespaces("default").pods(appname).delete()
			})
			.then(() => {
				//should delete flows and settings...
				return Promise.all([
						Users.deleteOne({appname: appname}),
						Flows.deleteOne({appname: appname}),
						Settings.deleteOne({appname: appname}),
						Sessions.deleteOne({appname: appname}),
						Library.deleteMany({appname: appname}),
						Credentials.deleteOne({appname: appname})
					])
			})
			.then( values => {
				console.log(values);
				console.log("cleared db")
				res.status(204).send({})
			})
			.catch( err => {
				console.log(err);
				res.status(500).send({err: err})
			})
		}
	}
});

const server = http.Server(app);
const wss = new ws.Server({ clientTracking: false, noServer: true });

server.on('upgrade', function(req, socket, head){
	//should do authentication here
	wss.handleUpgrade(req, socket, head, function (ws) {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection',function(ws, req){
	const containerId = req.url.substring(1);
	var inStream;
	const logStream = new stream.PassThrough();

	logStream.on('data', (chunk) => {
        ws.send(chunk.toString("binary"));
	})

	client.api.v1.namespaces("default").pods(containerId).log.getByteStream({qs: {follow: true, tailLine: settings.logHistory}})
	.then(logs => {
		inStream = logs;
		inStream.pipe(logStream)
	})
	.catch( err => {
		console.log("err");
	});

	ws.on('close', function(){
		inStream.abort()
	});
})

server.listen(port, host, function(){
	logger.info(util.format('App listening on  %s:%d!', host, port));
});
