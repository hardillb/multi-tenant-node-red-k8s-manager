module.exports = {
	"mongodb": process.env["MONGO_URL"],
	"rootDomain": process.env["ROOT_DOMAIN"],
	"node-red-container": "docker-pi.local:5000/custom-node-red",
	"admin": "admin",
	"password": "password",
	"logHistory": 250
}