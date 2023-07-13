import fastify, { FastifyReply, FastifyRequest } from 'fastify';

const server = fastify();

const firstServerUrl = 'http://localhost:3001'; // URL первого сервера

server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    // Запрос к первому серверу
    try {
        const response = await server.inject({
            method: 'GET',
            url: `${firstServerUrl}/`,
        });
        reply.send(response.payload);
    } catch (err) {
        console.error(err);
        reply.code(500).send('Error');
    }
});

// Обработка запроса на подключение к первому серверу
server.post('/connect', async (request: FastifyRequest, reply: FastifyReply) => {
    // Функция для повторного подключения
    async function connectToFirstServer() {
        try {
            const response = await server.inject({
                method: 'POST',
                url: `${firstServerUrl}/connect`,
            });
            const { client_id } = response.json(); // Получение идентификатора клиента из ответа

            // Установка заголовков для ответа
            reply
                .header('Access-Control-Allow-Origin', '*')
                .header('Content-Type', 'text/event-stream')
                .header('Cache-Control', 'no-cache')
                .header('Connection', 'keep-alive')
                .status(200);

            // Создание объекта EventSource для подключения к первому серверу
            const eventSource = new EventSource(`${firstServerUrl}/connect/${client_id}`);

            // Обработка события при получении данных от первого сервера
            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                reply.send(data);
            };

            // Обработка события при отключении от первого сервера
            eventSource.onerror = () => {
                eventSource.close();
                console.log('Connection closed. Reconnecting...');

                // Повторное подключение через 5 секунд
                setTimeout(() => {
                    connectToFirstServer();
                }, 5000);
            };

            // Принудительное отключение через 20 секунд
            const timeout = setTimeout(() => {
                eventSource.close();
            }, 20000);

            // Закрытие таймера и соединения при отключении клиента
            reply.raw.on('close', () => {
                clearTimeout(timeout);
                eventSource.close();
            });
        } catch (err) {
            console.error(err);
            reply.code(500).send('Error');
        }
    }

    await connectToFirstServer();

});

server.listen(3002, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log('Second server is running on port 3002');
});
