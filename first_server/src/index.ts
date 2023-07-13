import fastify, { FastifyReply, FastifyRequest } from 'fastify';

const server = fastify();

interface ExtendedFastifyReply extends FastifyReply {
    res?: any;
}

const clientsAwaitingResponse = new Map<string, ExtendedFastifyReply>();

server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    // Гарантированный ответ от сервера
    reply.send({ message: 'Hello from the first server!' });
});

server.post('/connect', async (request: FastifyRequest, reply: FastifyReply) => {
    const client_id = generateClientId(); // Генерация нового идентификатора клиента
    const extendedReply = reply as ExtendedFastifyReply;
    clientsAwaitingResponse.set(client_id, extendedReply);
    console.log(Array.from(clientsAwaitingResponse.keys()));

    // Настройка заголовков для EventSource
    extendedReply.res?.setHeader('Access-Control-Allow-Origin', '*');
    extendedReply.res?.setHeader('Content-Type', 'text/event-stream');
    extendedReply.res?.setHeader('Cache-Control', 'no-cache');
    extendedReply.res?.setHeader('Connection', 'keep-alive');
    extendedReply.res?.flushHeaders();

    // Отправка успешного ответа с идентификатором клиента
    reply.status(200).send({ client_id });
});

// Обработка отключения клиента
server.addHook('onClose', async (instance) => {
    instance.server.on('close', () => {
        // Удаление клиента из мапы при отключении
        let client_id: string | undefined;
        for (const [key, value] of clientsAwaitingResponse.entries()) {
            if (value.res === instance) {
                client_id = key;
                break;
            }
        }

        if (client_id) {
            clientsAwaitingResponse.delete(client_id);
            console.log(`Client with ID ${client_id} disconnected and removed from the map.`);
        }
    });
});

// Обработка событий SSE для клиента
server.get<{ Params: { client_id: string } }>('/connect/:client_id', async (request, reply) => {
    const { client_id } = request.params;
    console.log(request.params)

    // Проверка наличия клиента в мапе
    if (!clientsAwaitingResponse.has(client_id)) {
        console.log(Array.from(clientsAwaitingResponse.keys()))
        reply.code(404 ).send('Client not found');
        return;
    }

    // Установка заголовков SSE
    reply
        .header('Access-Control-Allow-Origin', '*')
        .header('Content-Type', 'text/event-stream')
        .header('Cache-Control', 'no-cache')
        .header('Connection', 'keep-alive')
        .status(200);

    const clientResponse = clientsAwaitingResponse.get(client_id) as ExtendedFastifyReply;

    // Отправка событий клиенту через SSE
    const sendEvent = (event: string, data: any) => {
        clientResponse.res?.write(`event: ${event}\n`);
        clientResponse.res?.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Отправка приветственного события
    sendEvent('message', { message: 'Welcome!' });

    // Пример отправки события каждую секунду
    let count = 1;
    const interval = setInterval(() => {
        sendEvent('count', { count });
        count++;
    }, 1000);

    // Закрытие соединения при отключении клиента
    clientResponse.res?.on('close', () => {
        clearInterval(interval);
        reply.send('Connection closed');
    });
});

function generateClientId(): string {
    // Генерация уникального идентификатора клиента
    // В данном примере, просто генерируем случайное число
    return Math.random().toString(36).substring(7);
}

server.listen(3001, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log('First server is running on port 3001');
});
