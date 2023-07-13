import Fastify from 'fastify';
import axios from 'axios';
import EventSource from 'eventsource';
import http from 'http';

interface Contract {
    message: string;
}

const server1 = Fastify();

// Секретный ключ
const SECRET_KEY = 'secret_key';

// Создаем массив подключенных клиентов для SSE
const clients: http.ServerResponse[] = [];

// Эндпоинт для подписки на SSE
server1.get('/subscribe', (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    const client = reply.raw;
    clients.push(client);

    // Отправляем сообщение SSE с пустым полем данных для установки соединения
    client.write('data: 123\n\n');

    // Обработчик закрытия соединения SSE
    client.on('close', () => {
        clients.splice(clients.indexOf(client), 1);
    });
});

// Функция для отправки сообщения через SSE
const sendSSEMessage = (message: Contract) => {
    clients.forEach((client) => {
        client.write(`data: ${JSON.stringify(message)}\n\n`);
    });
};

// Эндпоинт для получения SSE-сообщений от сервера 2
server1.get('/receive-contract', (request, reply) => {
    const es = new EventSource('http://localhost:3001/subscribe');

    es.onmessage = (event) => {
        const message = JSON.parse(event.data) as Contract;
        console.log('Received message from Server 2:', message);
    };

    es.onerror = (error) => {
        console.error('Error occurred:', error);
    };

    reply.send({ message: 'Subscribed to Server 2 SSE' });
});

// Эндпоинт для отправки контракта на сервер 2
server1.post('/send-contract', (request, reply) => {
    const contract = request.body as Contract; // Предполагается, что контракт будет отправлен в теле запроса

    // Отправить контракт на сервер 2 через SSE сообщение
    sendSSEMessage(contract);

    reply.send({ message: 'Contract sent to Server 2' });
});


// Запускаем сервер 1
server1.listen(3000, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Сервер 1 слушает ${address}`);
});
