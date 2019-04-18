const http = require('http');
const request = require('request-promise-native');
const {execSync} = require('child_process');

const getPost = (req) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            const body = Buffer.concat(chunks);
            resolve(body.toString());
        });
        req.on('error', (err) => reject(err));
    });
};

//
// Server
//
const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    try {
        if (req.method === 'POST') {
            getPost(req).then(data => {
                if (data) {
                    const dataArray = JSON.parse(data);
                    try {
                        console.log(dataArray);
                        const imageName = dataArray.repository.repo_name;
                        if (!/^[a-z]+\/[a-z]+$/.test(imageName)) {
                            throw new Error('Invalid image name: ' + imageName);
                        }
                        ls = execSync(`docker pull ${imageName} && docker service update --force $(docker service ls|grep ${imageName} | awk '{print $1}')`);
                        console.log(ls);
                        request.post({
                            url: dataArray.callback_url,
                            json: true,
                            body: {
                                state: 'success',
                                description: 'Image pulled, service updated',
                                context: 'Deploying to our webserver'
                            }
                        }).catch(e => {
                            throw e;
                        });
                        res.statusCode = 200;
                        res.end(JSON.stringify({state: 'success'}));
                    } catch (e) {
                        request.post({
                            url: dataArray.callback_url,
                            json: true,
                            body: {
                                state: 'error',
                                description: 'Encountered the following error' + e.message,
                                context: 'Deploying to our webserver'
                            }
                        }).catch(e => {
                            throw e;
                        });
                        res.statusCode = 500;
                        res.end(JSON.stringify({state: 'error'}));
                    }
                } else {
                    throw new Error('No JSON provided');
                }
            });
        } else {
            res.statusCode = 500;
            res.end(JSON.stringify({state: 'error'}));
        }
    } catch (e) {
        console.error(e);
        res.statusCode = 500;
        res.end(JSON.stringify({state: 'error'}));
    }
});

const config = {
    port: process.env.PORT || 3000,
    hostname: '0.0.0.0'
}

server.listen(config.port, config.hostname, () => {
    console.info(`Server running at http://${config.hostname}:${config.port}/`);
});
