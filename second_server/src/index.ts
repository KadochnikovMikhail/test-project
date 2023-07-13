import fastify, {FastifyReply, FastifyRequest} from "fastify";

const server = fastify();

const firstServerUrl = "http://localhost:3001";

server.get("/", async (request: FastifyRequest, reply: FastifyReply) => {

    try {
        const response = await server.inject({
            method: "GET",
            url: `${firstServerUrl}/`,
        });
        reply.send(response.payload);
    } catch (err) {
        console.error(err);
        reply.code(500).send("Error");
    }
});


server.post("/connect", async (request: FastifyRequest, reply: FastifyReply) => {

    async function connectToFirstServer() {
        try {
            const response = await server.inject({
                method: "POST",
                url: `${firstServerUrl}/connect`,
            });
            const {client_id} = response.json();


            reply
                .header("Access-Control-Allow-Origin", "*")
                .header("Content-Type", "text/event-stream")
                .header("Cache-Control", "no-cache")
                .header("Connection", "keep-alive")
                .status(200);


            const eventSource = new EventSource(`${firstServerUrl}/connect/${client_id}`);


            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                reply.send(data);
            };


            eventSource.onerror = () => {
                eventSource.close();
                console.log("Connection closed. Reconnecting...");


                setTimeout(() => {
                    connectToFirstServer();
                }, 5000);
            };


            const timeout = setTimeout(() => {
                eventSource.close();
            }, 20000);


            reply.raw.on("close", () => {
                clearTimeout(timeout);
                eventSource.close();
            });
        } catch (err) {
            console.error(err);
            reply.code(500).send("Error");
        }
    }

    await connectToFirstServer();

});

server.listen(3002, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log("Second server is running on port 3002");
});
