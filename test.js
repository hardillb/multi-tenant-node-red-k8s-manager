const KubeConfig = require('kubernetes-client').KubeConfig
const Client = require('kubernetes-client').Client

const stream = require('stream')


const kubeconfig = new KubeConfig()
kubeconfig.loadFromFile('./config')

const Request = require('kubernetes-client/backends/request')
const backend = new Request({ kubeconfig })
const client = new Client({ backend, version: '1.13' })

async function main() {
	// const namespaces = await client.api.v1.namespaces.get()
	//console.log('Namespaces: ', JSON.stringify(namespaces, null, ' '))

	// const deployments = await client.apis.apps.v1.namespaces('default').deployments.get()
	// console.log("Deployments: ", JSON.stringify(deployments, null, ' '))

	// const pods = await client.api.v1.namespaces("default").pods.get()
	//console.log("Pods: ", JSON.stringify(pods, null, ' '))

	let r2 = {
		kind: "Pod",
		metadata: {
			name: "r2",
			labels: {
				name: "r2"
			}
		},
		spec: {
			containers:[
				{
					name: "node-red",
					image: "docker-pi.local:5000/custom-node-red",
					env: [
						{ name: "APP_NAME", value: "r2"},
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

	//const r2Pod = await client.api.v1.namespaces("default").pods.post({body:r2})
	//console.log("r2: ", JSON.stringify(r2Pod, null, ' '))

	let r2s = {
		kind: "Service",
		metadata: {
			name: "r2-service"
		},
		spec: {
			selector: {
				name: "r2"
			},
			ports: [
				{ port:1880, protocol: "TCP"}
			]
		}
	}

	//const r2Service = await client.api.v1.namespaces("default").services.post({ body: r2s})
	//console.log("r2: ", JSON.stringify(r2Service, null, ' '))

// apiVersion: networking.k8s.io/v1
// kind: Ingress
// metadata:
//   name: nr-ingress
// spec:
//   rules:
//   - host: "ubuntu.local"
//     http:
//       paths:
//       - pathType: Prefix
//         path: "/"
//         backend:
//           service:
//             name: r1
//             port:
//               number: 1880 


	let r2i = {
		kind: "Ingress",
		metadata: {
			name: "r2-ingress"
		},
		spec: {
			rules: [
				{
					host: "r2.ubuntu.local",
					http: {
						paths: [
							{
								pathType: "Prefix",
								path: "/",
								backend: {
									serviceName: "r2-service",
									servicePort: 1880
								}
							}
						]
					}
				}
			]
		}
	}

	// const r2Ingress = await client.apis.extensions.v1beta1.namespaces("default").ingresses.post({ body: r2i})
	// console.log("r2: ", JSON.stringify(r2Ingress, null, ' '))

	// const status = await client.api.v1.pods.get({qs:{
	// 	labelSelector: "nodered=true"
	// }})
	// console.log(JSON.stringify(status.body.items,null, ' '));

	const logs = await client.api.v1.namespaces("default").pods("r1").log.getByteStream({qs: {follow: true, tailLines: 10}})
	// const logStream = new stream.PassThrough();

	// logStream.on('data', (chunk) => {
	// 	console.log(chunk.toString('utf8'));
	// })

	// logs.pipe(logStream)

	logs.on('data', chunk => {
		console.log(chunk.toString('utf8'))
	})
	
	setTimeout(()=>{
		logs.abort()
	}, 5000)
}

main()