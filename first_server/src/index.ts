import Fastify from 'fastify';
import EventSource from 'eventsource';
import http from 'http';
import {Contract} from "../../contract";

const server1 = Fastify();

const SECRET_KEY = 'secret_key';

const clients: http.ServerResponse[] = [];


server1.get('/subscribe', (request, reply) => {

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    const client = reply.raw;
    clients.push(client);

    client.write('data: 123\n\n');

    client.on('close', () => {
        clients.splice(clients.indexOf(client), 1);
    });
});


const sendSSEMessage = (message: Contract) => {
    clients.forEach((client) => {
        client.write(`data: ${JSON.stringify(message)}\n\n`);
    });
};


server1.get('/receive-contract', (request, reply) => {
    const authKey = request.headers['x-auth-key'];
    if (authKey !== SECRET_KEY) {
        reply.status(401).send({message: 'Unauthorized'});
        return;
    }

    const es = new EventSource('http://localhost:3001/subscribe');

    es.onmessage = (event) => {
        const message = JSON.parse(event.data) as Contract;
        console.log('Received message from Server 2:', message);
    };

    es.onerror = (error) => {
        console.error('Error occurred:', error);
    };

    reply.send({message: 'Subscribed to Server 2 SSE'});
});

server1.post<{ Body: Contract }>('/send-contract', (request, reply) => {
    const authKey = request.headers['x-auth-key'];
    if (authKey !== SECRET_KEY) {
        reply.status(401).send({message: 'Unauthorized'});
        return;
    }

    const contract = request.body as Contract;

    sendSSEMessage(contract);

    reply.send({message: 'Contract sent to Server 2'});
});

server1.listen(3000, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Сервер 1 слушает ${address}`);
});

