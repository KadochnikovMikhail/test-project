import fastify, { FastifyReply, FastifyRequest } from "fastify";

const server = fastify();

interface ExtendedFastifyReply extends FastifyReply {
    res?: any;
}

const clientsAwaitingResponse = new Map<string, ExtendedFastifyReply>();

server.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({ message: "Hello from the first server!" });
});

server.post("/connect", async (request: FastifyRequest, reply: FastifyReply) => {
    const client_id = generateClientId();
    const extendedReply = reply as ExtendedFastifyReply;
    clientsAwaitingResponse.set(client_id, extendedReply);
    console.log(Array.from(clientsAwaitingResponse.keys()));


    extendedReply.res?.setHeader("Access-Control-Allow-Origin", "*");
    extendedReply.res?.setHeader("Content-Type", "text/event-stream");
    extendedReply.res?.setHeader("Cache-Control", "no-cache");
    extendedReply.res?.setHeader("Connection", "keep-alive");
    extendedReply.res?.flushHeaders();

    reply.status(200).send({ client_id });
});


server.addHook("onClose", async (instance) => {
    instance.server.on("close", () => {

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


server.get<{ Params: { client_id: string } }>("/connect/:client_id", async (request, reply) => {
    const { client_id } = request.params;
    console.log(request.params)

    if (!clientsAwaitingResponse.has(client_id)) {
        console.log(Array.from(clientsAwaitingResponse.keys()))
        reply.code(404 ).send("Client not found");
        return;
    }


    reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .status(200);

    const clientResponse = clientsAwaitingResponse.get(client_id) as ExtendedFastifyReply;


    const sendEvent = (event: string, data: any) => {
        clientResponse.res?.write(`event: ${event}\n`);
        clientResponse.res?.write(`data: ${JSON.stringify(data)}\n\n`);
    };


    sendEvent("message", { message: "Welcome!" });


    let count = 1;
    const interval = setInterval(() => {
        sendEvent("count", { count });
        count++;
    }, 1000);


    clientResponse.res?.on("close", () => {
        clearInterval(interval);
        reply.send("Connection closed");
    });
});

function generateClientId(): string {

    return Math.random().toString(36).substring(7);
}

server.listen(3001, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log("First server is running on port 3001");
});
