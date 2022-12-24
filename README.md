# Multi Tenant Node-RED management app for Kubernetes

A small web app to stand up new Node-RED instances using Kubernetes.

This is meant to purely be a PoC, a real production deployment would require a lot
more features.

## Deprecated 

This project is now deprecated, there will be no more updates and no support for anybody triyng to use it. If you are looking for a Multi Tenant Node-RED solution I suggest you look at [FlowForge](https://flowforge.com).

## Downlaod

```
$ git clone --recurse-submodules https://github.com/hardillb/multi-tenant-node-red-k8s-manager.git
```

## Configure

Edit the `settings.js` file to set the domiain and the MongoDB URL for storing the authentication details for the new instances.

In the following example the environment variables `ROOT_DOMAIN` and `MONGO_URL` are used to populate these values.

e.g.

```module.exports = {
	"mongodb": process.env["MONGO_URL"],
	"rootDomain": process.env["ROOT_DOMAIN"],
	"node-red-container": "private.example.com/custom-node-red",
	"admin": "admin",
	"password": "password",
	"logHistory": 250
}
```

 - `admin` is the admin username
 - `password` is the admin password
 - `logHistory` is the number of lines of pervious logs to show

 The app uses the default service account to access the Kubenetes API
