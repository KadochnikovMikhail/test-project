import Fastify from 'fastify';
import axios from 'axios';
import { Contract } from '../../contract';

const server2 = Fastify();

// Секретный ключ
const SECRET_KEY = 'secret_key';

// Эндпоинт отправляющий контракт
server2.get('/send-contract', async (_, reply) => {
    try {
        const contract: Contract = { message: 'Привет, Сервер 1!' };
        const response = await axios.post('http://localhost:3000/contract', contract, {
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Key': SECRET_KEY,
            },
        });

        const data = response.data;
        reply.send(data);
    } catch (err) {
        console.error(err);
        reply.status(500).send({ error: 'Не удалось отправить контракт' });
    }
});

server2.post<{ Body: Contract }>('/contract', async (request, reply) => {
    const { message } = request.body;
    const authKey = request.headers['x-auth-key'];

    // Проверяем, что ключ авторизации совпадает с секретным ключом
    if (authKey !== SECRET_KEY) {
        reply.status(401).send({ error: 'Unauthorized' });
        return;
    }

    if (typeof message === 'string') {
        return { message };
    }
    reply.status(400).send({ error: 'Invalid contract' });
});


// Запускаем сервер
server2.listen(3001, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Сервер 2 слушает ${address}`);
});
